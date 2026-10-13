import { randomBytes } from 'crypto';
import { prisma } from '../../database/prisma';
import { IntegrationRepository } from './integration.repository';
import { BANK_PARSERS, dispatch } from './email.parsers';
import {
  extractGmailConfirmationUrl,
  extractIngestToken,
  normaliseInboundEmail,
} from './email.providers';
import { AppError, NotFoundError } from '../../shared/AppError';
import type { IngestResult, NormalisedEmail } from './email.types';

/**
 * Ingestion for forwarded bank alerts.
 *
 * SECURITY MODEL — worth reading before changing anything here.
 *
 * There is deliberately NO allow-list of bank sender addresses. Such a list
 * would only ever contain the banks of whoever happened to be testing, and
 * would silently drop everyone else's alerts. Instead two other controls do the
 * work, and they are stronger:
 *
 *   1. The ingest address is a SECRET. Each user forwards to
 *      aa-<random token>@ingest.<domain>; without the token an attacker has
 *      nowhere to deliver to.
 *   2. Nothing becomes an expense on its own. Every parsed alert lands as
 *      `pending` and only becomes an Expense when the user explicitly accepts
 *      it. The review queue IS the security boundary — a forged alert is a row
 *      the user declines, not money silently added to their ledger.
 *
 * The sender is recorded as provenance so the UI can show where each row came
 * from and flag the first time an address is seen, but it never decides whether
 * an email is processed.
 */
export class EmailIngestService {
  constructor(private integrations: IntegrationRepository) {}

  /* ---- The user's forwarding address ------------------------------------ */

  /**
   * Mint the ingest token lazily, on first request.
   *
   * Random rather than a cuid: this value appears in an email address that sits
   * in the user's Gmail filter and in message headers, so it must be
   * unguessable rather than merely unique — a sequential or timestamped id
   * would let someone enumerate other people's ingest addresses.
   *
   * LOWERCASE HEX, deliberately, not base64url. Mail systems may normalise the
   * case of a recipient address in transit, and the local part is treated
   * case-insensitively by most providers. A mixed-case token therefore fails to
   * match after a single case-folding hop, which presents as alerts silently
   * vanishing. 16 bytes of hex is 128 bits of entropy and immune to folding.
   */
  async getIngestAddress(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    let token = user.ingestToken;
    if (!token) {
      token = randomBytes(16).toString('hex');
      await prisma.user.update({ where: { id: userId }, data: { ingestToken: token } });
    }

    // Two deployment shapes, so this works with or without owning a domain.
    //
    // EMAIL_INGEST_BASE_ADDRESS is the free path: paste the fixed address a
    // provider gave you (e.g. abc123@inbound.postmarkapp.com) and each user
    // gets a plus-addressed variant of it. EMAIL_INGEST_DOMAIN is the custom
    // domain path. Base address wins when both are set, since it is the more
    // specific instruction.
    // Exactly one '@' required. A value pasted twice
    // ("a@host.coma@host.com") still "includes an @", and splitting it yields a
    // domain of "host.coma@host.com" — producing an address that looks almost
    // right and silently delivers nowhere. Seen in the wild during setup, so it
    // is rejected rather than half-honoured.
    const base = process.env.EMAIL_INGEST_BASE_ADDRESS?.trim();
    if (base && (base.match(/@/g) || []).length !== 1) {
      throw new AppError(
        'EMAIL_INGEST_BASE_ADDRESS is malformed - it must be a single email address.',
        500,
      );
    }
    if (base) {
      const [local, domain] = base.split('@');
      return {
        address: `${local}+${token}@${domain}`,
        mode: 'shared' as const,
        configured: true,
      };
    }

    const prefix = process.env.EMAIL_INGEST_PREFIX || 'aa-';
    const domain = process.env.EMAIL_INGEST_DOMAIN;

    return {
      address: `${prefix}${token}@${domain || 'ingest.example.com'}`,
      mode: 'domain' as const,
      // False means the address shown is a placeholder: mail sent to it will go
      // nowhere until an inbound provider is pointed at this endpoint.
      configured: Boolean(domain),
    };
  }

  /**
   * Replace the token, invalidating the old address.
   *
   * Needed because the address is a bearer secret: if it leaks (a forwarded
   * thread, a screenshot) the only remedy is a new one.
   */
  async rotateIngestAddress(userId: string) {
    const token = randomBytes(16).toString('hex');
    await prisma.user.update({ where: { id: userId }, data: { ingestToken: token } });
    return this.getIngestAddress(userId);
  }

  /* ---- Ingestion --------------------------------------------------------- */

  async ingest(payload: Record<string, unknown>): Promise<IngestResult> {
    const email = normaliseInboundEmail(payload);
    if (!email) {
      throw new AppError('Could not read the inbound email payload.', 422);
    }

    const token = extractIngestToken(email.to, email.mailboxHash);
    if (!token) {
      // Not addressed to an ingest mailbox at all. Accepted and discarded
      // rather than errored: the sender is a mail provider retrying a bounce,
      // and a non-2xx would simply make it try again forever.
      return { status: 'ignored', reason: 'Recipient is not an ingest address' };
    }

    const user = await prisma.user.findUnique({ where: { ingestToken: token } });
    if (!user) {
      return { status: 'ignored', reason: 'No account matches that ingest address' };
    }

    return this.processForUser(user.id, email);
  }

  /**
   * Does this message plausibly concern money?
   *
   * Used to decide whether the BODY is worth keeping. It is deliberately
   * looser than any parser's own `matches`: a bank we have never seen should
   * still get its body stored so the format can be read and supported, which is
   * the opposite of the privacy rule below and has to win for genuine alerts.
   */
  private looksFinancial(email: NormalisedEmail): boolean {
    if (BANK_PARSERS.some((p) => p.matches(email))) return true;
    const t = `${email.subject}\n${email.text}`;
    const money = /\b(?:NGN|USD|GBP|EUR|₦)\s*[\d,]+|[\d,]+\.\d{2}\s*(?:NGN|USD|GBP|EUR)\b/i;
    const banking = /\b(debit|credit|transaction|withdraw|deposit|balance|account)\b/i;
    return money.test(t) && banking.test(t);
  }

  private async processForUser(userId: string, email: NormalisedEmail): Promise<IngestResult> {
    const existing = await prisma.inboundEmail.findUnique({
      where: { userId_messageId: { userId, messageId: email.messageId } },
    });
    if (existing) {
      return { status: 'duplicate', reason: 'This email has already been received' };
    }

    // PRIVACY GUARD.
    //
    // Forwarded mail is stored in full so a failed parse can be re-read later.
    // That is right for a bank alert and badly wrong for everything else: if
    // someone sets Gmail's blanket "forward a copy of incoming mail" instead of
    // a filter — an easy mistake, the controls sit next to each other — every
    // personal email would be written to this table in plain text.
    //
    // So the body is only retained when the message either looks financial or
    // comes from a sender that has produced a successful parse before. Anything
    // else is recorded as `discarded` with its sender and subject but NO body,
    // which keeps enough to warn the user that their filter is too broad while
    // retaining nothing private.
    /**
     * Gmail's forwarding confirmation is the ONE non-bank email that has to
     * survive the privacy guard.
     *
     * Setting this feature up requires clicking a link that Gmail sends to the
     * ingest address and nowhere else. The guard below correctly classes it as
     * "not a bank alert" and drops the body - which destroys the only copy of
     * the link and leaves the user unable to finish setup, with no indication
     * why. That is exactly what happened: a rotated address could not be
     * verified because the confirmation had already been discarded.
     *
     * Only the LINK is kept, not the message. That is stricter than the guard
     * it bypasses, not looser: the rest of the body - which names the account
     * and quotes Google's boilerplate - is still thrown away.
     */
    const confirmationUrl = extractGmailConfirmationUrl(email.from, email.text);
    if (confirmationUrl) {
      await prisma.inboundEmail.create({
        data: {
          userId,
          messageId: email.messageId,
          fromAddress: email.from,
          toAddress: email.to,
          subject: email.subject,
          receivedAt: email.receivedAt,
          bodyText: confirmationUrl,
          status: 'confirmation',
        },
      });
      return {
        status: 'ignored',
        reason: 'Gmail forwarding confirmation saved. Open Settings to confirm.',
      };
    }

    const senderIsKnown =
      (await prisma.inboundEmail.count({
        where: { userId, fromAddress: email.from, status: 'parsed' },
      })) > 0;

    if (!senderIsKnown && !this.looksFinancial(email)) {
      await prisma.inboundEmail.create({
        data: {
          userId,
          messageId: email.messageId,
          fromAddress: email.from,
          toAddress: email.to,
          subject: email.subject,
          receivedAt: email.receivedAt,
          bodyText: '',
          status: 'discarded',
          parseError: 'Not a bank alert - body not stored',
        },
      });
      return {
        status: 'ignored',
        reason: 'Not a bank alert; body discarded. Check your Gmail filter is not forwarding all mail.',
      };
    }

    // Store the raw message BEFORE attempting to understand it. A parser that
    // cannot read an alert must still leave evidence behind — otherwise the
    // spend is silently missing and nobody can tell anything was lost.
    const stored = await prisma.inboundEmail.create({
      data: {
        userId,
        messageId: email.messageId,
        fromAddress: email.from,
        toAddress: email.to,
        subject: email.subject,
        receivedAt: email.receivedAt,
        bodyText: email.text,
      },
    });

    return this.parseStored(userId, stored.id);
  }

  /**
   * Run the parsers over one stored email and record the outcome.
   *
   * Split out so it can be re-run later: when a parser is fixed or a bank is
   * added, everything already received can be re-read without asking the user
   * to find and forward old alerts again.
   */
  async parseStored(userId: string, inboundEmailId: string): Promise<IngestResult> {
    const stored = await prisma.inboundEmail.findFirst({
      where: { id: inboundEmailId, userId },
    });
    if (!stored) throw new NotFoundError('Inbound email not found');

    const email: NormalisedEmail = {
      messageId: stored.messageId,
      from: stored.fromAddress,
      to: stored.toAddress,
      subject: stored.subject,
      text: stored.bodyText,
      receivedAt: stored.receivedAt,
    };

    const { parser, alert, reason } = dispatch(email);

    if (!alert) {
      await prisma.inboundEmail.update({
        where: { id: stored.id },
        data: { status: 'unparsed', parserName: parser?.name ?? null, parseError: reason ?? null },
      });
      return { status: 'unparsed', parserName: parser?.name, reason };
    }

    // Prefer the bank's own reference: it identifies the movement of money, so
    // it stays stable even if the same alert is forwarded twice under different
    // message ids. Falling back to the message id keeps dedupe working for
    // banks that do not quote a reference.
    const externalId = alert.reference ? `ref:${alert.reference}` : `msg:${stored.messageId}`;

    const imported = await this.integrations.insertNewTransactions(userId, 'email', null, [
      {
        externalId,
        amount: alert.amount,
        currency: alert.currency,
        narration: alert.narration,
        type: alert.type,
        date: alert.date,
        balance: alert.balanceAfter ?? null,
        account: alert.account ?? null,
        suggestedCategory: null,
      },
    ]);

    await prisma.inboundEmail.update({
      where: { id: stored.id },
      data: {
        status: 'parsed',
        parserName: parser?.name ?? null,
        parseError: null,
      },
    });

    return {
      status: imported > 0 ? 'parsed' : 'duplicate',
      parserName: parser?.name,
      reason: imported > 0 ? undefined : 'Already imported from an earlier alert',
    };
  }

  /** Re-run the parsers over everything previously unreadable. */
  async reparseUnparsed(userId: string) {
    const stuck = await prisma.inboundEmail.findMany({
      where: { userId, status: 'unparsed' },
      select: { id: true },
    });

    const results = { attempted: stuck.length, parsed: 0, stillUnparsed: 0 };
    for (const row of stuck) {
      const result = await this.parseStored(userId, row.id);
      if (result.status === 'parsed' || result.status === 'duplicate') results.parsed += 1;
      else results.stillUnparsed += 1;
    }
    return results;
  }

  /**
   * How many non-bank emails have been discarded.
   *
   * The UI uses this to say "your Gmail filter looks too broad" — the single
   * most likely setup mistake, and invisible otherwise.
   */
  /**
   * The newest unused Gmail confirmation link, if one is waiting.
   *
   * Surfaced through the status endpoint so the person can finish setup from
   * the Settings screen. Before this existed the link lived only in the
   * database and someone had to go and read it out of a table, which is not a
   * thing a user can do.
   */
  async pendingConfirmationUrl(userId: string): Promise<string | null> {
    const row = await prisma.inboundEmail.findFirst({
      where: { userId, status: 'confirmation' },
      orderBy: { receivedAt: 'desc' },
      select: { bodyText: true },
    });
    return row?.bodyText || null;
  }

  async countDiscarded(userId: string) {
    return prisma.inboundEmail.count({ where: { userId, status: 'discarded' } });
  }

  /** Inbound emails, newest first — the "couldn't read these" list for the UI. */
  async listEmails(userId: string, status?: string) {
    return prisma.inboundEmail.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: { receivedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        fromAddress: true,
        subject: true,
        receivedAt: true,
        status: true,
        parserName: true,
        parseError: true,
      },
    });
  }

  /**
   * Distinct senders seen so far, with counts.
   *
   * Provenance for the UI rather than a filter: it lets the app say "3 alerts
   * from a sender you have not seen before", which is the honest way to surface
   * a possible forgery without blocking banks nobody anticipated.
   */
  async listSenders(userId: string) {
    const rows = await prisma.inboundEmail.groupBy({
      by: ['fromAddress'],
      where: { userId },
      _count: { fromAddress: true },
      _max: { receivedAt: true },
    });
    return rows
      .map((r) => ({
        from: r.fromAddress,
        count: r._count.fromAddress,
        lastSeen: r._max.receivedAt,
      }))
      .sort((a, b) => b.count - a.count);
  }
}
