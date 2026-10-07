import { randomBytes } from 'crypto';
import { prisma } from '../../database/prisma';
import { IntegrationRepository } from './integration.repository';
import { dispatch } from './email.parsers';
import { extractIngestToken, normaliseInboundEmail } from './email.providers';
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

  private async processForUser(userId: string, email: NormalisedEmail): Promise<IngestResult> {
    // Store the raw message FIRST, before attempting to understand it. A parser
    // that cannot read an alert must still leave evidence behind — otherwise
    // the spend is silently missing and nobody can tell that anything was lost.
    const existing = await prisma.inboundEmail.findUnique({
      where: { userId_messageId: { userId, messageId: email.messageId } },
    });
    if (existing) {
      return { status: 'duplicate', reason: 'This email has already been received' };
    }

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
