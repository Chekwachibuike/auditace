/**
 * Types for the forwarded-bank-alert ingestion path.
 *
 * The flow is: the user sets a Gmail filter that auto-forwards alerts from
 * their bank to a personal address (aa-<token>@ingest.<domain>); an inbound
 * email service receives it and POSTs it here. Nothing Google-specific touches
 * this codebase — no OAuth, no scopes, no stored credentials, and nothing that
 * expires after seven days.
 */

/** One inbound message, after the provider's envelope has been stripped off. */
export interface NormalisedEmail {
  /**
   * Stable identity for dedupe. The RFC Message-ID when present, otherwise a
   * content hash — forwarding rules do not reliably preserve the header, and
   * without a stable key a re-delivery imports the same spend twice.
   */
  messageId: string;
  from: string;
  /** The address it was sent TO — carries the user's ingest token. */
  to: string;
  subject: string;
  /** Plain text. HTML-only mail is converted before it gets here. */
  text: string;
  receivedAt: Date;
}

/** What a bank parser extracts from one alert. */
export interface ParsedAlert {
  /** MAJOR units. Parsers are responsible for stripping separators. */
  amount: number;
  currency: string;
  type: 'debit' | 'credit';
  date: Date;
  narration: string;
  /** Balance after the transaction, when the alert states it. */
  balanceAfter?: number | null;
  /** Masked account identifier, when the alert states it. */
  account?: string | null;
  /**
   * The bank's own reference for the transaction, when the alert carries one.
   *
   * Strongly preferred over the email Message-ID for dedupe: forwarding rules
   * can rewrite message headers, and the same alert arriving twice would then
   * look like two transactions. A bank reference identifies the MOVEMENT OF
   * MONEY rather than the notification about it, so it stays stable no matter
   * how many times the mail is forwarded, resent or re-parsed.
   */
  reference?: string | null;
}

/**
 * A per-bank parser.
 *
 * Split into `matches` and `parse` on purpose: dispatch decides which bank sent
 * the mail (cheap, from sender/subject), and only then do we attempt the
 * expensive, format-specific extraction. It also means a parser can match but
 * still fail to parse — which is recorded as `unparsed` with the reason, rather
 * than silently falling through to another bank's parser and producing
 * plausible nonsense.
 */
export interface BankParser {
  /** Stable identifier stored on the row, e.g. "gtbank". */
  name: string;
  /** Human label for the UI. */
  label: string;
  matches(email: NormalisedEmail): boolean;
  /** Return null when the shape is recognised but the fields are not readable. */
  parse(email: NormalisedEmail): ParsedAlert | null;
}

export interface IngestResult {
  status: 'parsed' | 'unparsed' | 'duplicate' | 'ignored';
  parserName?: string;
  reason?: string;
  importedTransactionId?: string;
}
