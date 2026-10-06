import { createHash } from 'crypto';
import type { NormalisedEmail } from './email.types';

/**
 * Turn whatever an inbound-email provider posts into one `NormalisedEmail`.
 *
 * Cloudflare Email Routing, SendGrid Inbound Parse and Postmark all describe
 * the same message with different field names, and a self-hosted forwarder is
 * a fourth shape. Normalising here means the parsers and the service never
 * learn which provider is in front of them — swapping provider is a change to
 * this file alone.
 *
 * Everything is read defensively: these payloads arrive from outside and a
 * missing field must produce a clear rejection, never `undefined` written to
 * the database.
 */

type Payload = Record<string, unknown>;

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function firstString(payload: Payload, keys: string[]): string {
  for (const key of keys) {
    const v = payload[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/**
 * Pull a bare address out of a header value.
 * "GTBank Alerts <alerts@gtbank.com>" -> "alerts@gtbank.com"
 */
export function extractAddress(headerValue: string): string {
  const angled = /<([^>]+)>/.exec(headerValue);
  const raw = angled ? angled[1] : headerValue;
  return raw.trim().toLowerCase();
}

/**
 * Crude HTML to text. Many bank alerts are HTML-only.
 *
 * Deliberately not a full HTML parser: the parsers below match on amounts and
 * keywords, so all that is needed is readable text with the tags gone and the
 * whitespace collapsed. Entity handling covers the few that actually show up in
 * currency and spacing.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * A stable id when the provider gives us no Message-ID.
 *
 * Hashing sender + subject + body means the same message re-delivered collides
 * on the dedupe constraint. It deliberately excludes receivedAt, which the
 * provider sets and which therefore differs between two deliveries of the same
 * mail — including it would defeat the whole purpose.
 */
function contentHash(from: string, subject: string, text: string): string {
  return 'sha256:' + createHash('sha256').update(`${from}\n${subject}\n${text}`).digest('hex');
}

export function normaliseInboundEmail(payload: Payload): NormalisedEmail | null {
  const from = extractAddress(
    firstString(payload, ['from', 'From', 'sender', 'FromFull.Email', 'envelope_from']),
  );
  const to = extractAddress(
    firstString(payload, ['to', 'To', 'recipient', 'OriginalRecipient', 'envelope_to']),
  );

  if (!from || !to) return null;

  const subject = firstString(payload, ['subject', 'Subject', 'headers.subject']);

  let text = firstString(payload, ['text', 'TextBody', 'plain', 'body-plain', 'bodyPlain']);
  if (!text) {
    const html = firstString(payload, ['html', 'HtmlBody', 'body-html', 'bodyHtml']);
    if (html) text = htmlToText(html);
  }
  if (!text) {
    // Cloudflare Email Routing hands over the whole RFC822 message.
    const raw = firstString(payload, ['raw', 'rawEmail', 'MessageStream', 'message']);
    if (raw) {
      const split = raw.indexOf('\n\n');
      text = htmlToText(split > -1 ? raw.slice(split + 2) : raw);
    }
  }
  if (!text.trim()) return null;

  const headerId = firstString(payload, ['messageId', 'MessageID', 'message-id', 'Message-Id']);
  const messageId = headerId || contentHash(from, subject, text);

  const dateRaw = firstString(payload, ['date', 'Date', 'receivedAt', 'timestamp']);
  const parsedDate = dateRaw ? new Date(dateRaw) : null;
  const receivedAt =
    parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : new Date();

  const mailboxHash = firstString(payload, ['MailboxHash', 'mailboxHash', 'mailbox_hash']);

  return { messageId, from, to, subject, text: text.trim(), receivedAt, mailboxHash };
}

/**
 * Pull the user's ingest token out of the recipient address.
 *
 * TWO schemes are accepted, because which one is available depends on whether
 * the operator owns a domain:
 *
 *   1. OWN DOMAIN — `aa-9f3c2b…@ingest.example.com`
 *      The token is the local part after the configured prefix.
 *
 *   2. SHARED PROVIDER ADDRESS — `abc123+9f3c2b…@inbound.postmarkapp.com`
 *      Services like Postmark and CloudMailin hand out one fixed address on a
 *      domain you do not control, so the local part cannot be per-user. Plus
 *      addressing carries the token instead; Postmark even splits it out as
 *      `MailboxHash`. This is what lets the whole feature run with no domain
 *      purchase at all.
 *
 * Supporting both means moving from a free provider address to a custom domain
 * later is a configuration change, not a code change.
 *
 * `mailboxHash` is read first when the provider supplies it, since that is the
 * provider's own parse and more reliable than re-splitting the string.
 */
export function extractIngestToken(toAddress: string, mailboxHash?: string): string | null {
  const direct = (mailboxHash ?? '').trim().toLowerCase();
  if (direct.length >= 6) return direct;

  const local = toAddress.split('@')[0]?.toLowerCase() ?? '';
  if (!local) return null;

  // Scheme 2: anything after the first '+'.
  const plus = local.indexOf('+');
  if (plus > -1) {
    const tagged = local.slice(plus + 1);
    if (tagged.length >= 6) return tagged;
  }

  // Scheme 1: the configured prefix.
  const prefix = (process.env.EMAIL_INGEST_PREFIX || 'aa-').toLowerCase();
  if (local.startsWith(prefix)) {
    const token = local.slice(prefix.length).split('+')[0];
    if (token.length >= 6) return token;
  }

  return null;
}
