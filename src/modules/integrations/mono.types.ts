/**
 * Wire types for the Mono Connect (bank data) API.
 *
 * ⚠️ UNVERIFIED. Every shape in this file was written from Mono's published
 * documentation and has NOT yet been checked against a live sandbox response.
 * That distinction matters: when this client was written, the AuditAce API's
 * own contract document turned out to disagree with the running server in four
 * separate places. Treat these as a best guess until someone runs the sandbox
 * and confirms them.
 *
 * Everything here is deliberately permissive — optional fields, tolerant id
 * handling — so that an unexpected payload surfaces as one clear error in
 * `normaliseTransaction` rather than as `undefined` leaking into the database.
 */

/** Response from exchanging a Connect `code` for a persistent account id. */
export interface MonoAuthResponse {
  id?: string;
  /** Some Mono responses nest the id; accept either. */
  data?: { id?: string };
}

export interface MonoInstitution {
  name?: string;
  bankCode?: string;
  type?: string;
}

export interface MonoAccount {
  id?: string;
  _id?: string;
  name?: string;
  accountNumber?: string;
  account_number?: string;
  currency?: string;
  balance?: number;
  institution?: MonoInstitution;
}

/** `GET /v2/accounts/{id}` — the account envelope wraps the account itself. */
export interface MonoAccountDetailsResponse {
  account?: MonoAccount;
  data?: { account?: MonoAccount };
  meta?: { data_status?: string; auth_method?: string };
}

/**
 * A single transaction.
 *
 * `amount` is in MINOR units — kobo for Nigeria, pesewa for Ghana, cents for
 * Kenya/South Africa. Nothing outside this module should ever see that value;
 * `normaliseTransaction` converts it once, at the boundary.
 */
export interface MonoTransaction {
  id?: string;
  _id?: string;
  amount?: number;
  date?: string;
  narration?: string;
  /** "debit" | "credit" */
  type?: string;
  balance?: number;
  currency?: string;
  /** Null until Mono's categorisation job has run. Never assume it is set. */
  category?: string | null;
}

export interface MonoTransactionsResponse {
  data?: MonoTransaction[];
  /** Older/alternate envelope. */
  transactions?: MonoTransaction[];
  meta?: {
    total?: number;
    page?: number;
    previous?: string | null;
    next?: string | null;
  };
}

/**
 * The normalised, unit-corrected form the rest of the app works with.
 *
 * Deliberately NOT Mono-shaped: a statement parser or an email parser produces
 * this same type, which is what lets one ingestion pipeline serve every source.
 */
export interface NormalisedTransaction {
  /** The source's own id for the row — see ImportedTransaction.externalId. */
  externalId: string;
  /** MAJOR units (naira), already converted. */
  amount: number;
  currency: string;
  narration: string;
  /** "debit" | "credit" */
  type: 'debit' | 'credit';
  date: Date;
  balance: number | null;
  suggestedCategory: string | null;
}

/** Webhook envelope. */
export interface MonoWebhookEvent {
  event?: string;
  data?: {
    id?: string;
    account?: string | MonoAccount;
    meta?: { data_status?: string };
    [key: string]: unknown;
  };
}
