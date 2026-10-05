import { AppError } from '../../shared/AppError';
import type {
  MonoAccount,
  MonoAccountDetailsResponse,
  MonoAuthResponse,
  MonoTransaction,
  MonoTransactionsResponse,
  NormalisedTransaction,
} from './mono.types';

/**
 * The only place in the codebase that talks to Mono.
 *
 * Everything Mono-shaped is contained here so that when the sandbox reveals the
 * real payloads (see the warning in mono.types.ts), the blast radius of any
 * correction is this one file. Services above it work exclusively with
 * `NormalisedTransaction`, which is our shape, not theirs.
 *
 * Two invariants this module is responsible for:
 *   1. The secret key never leaves the server.
 *   2. Amounts are converted from minor units exactly once, here.
 */

const DEFAULT_BASE_URL = 'https://api.withmono.com';

/**
 * Mono returns money in the smallest denomination (kobo for NGN). AuditAce
 * stores naira. Getting this wrong makes every imported expense 100x too big —
 * and a ₦2,450 lunch showing as ₦245,000 is wrong in a way that still looks
 * like a number, so it would not necessarily be caught by eye.
 */
const MINOR_UNITS_PER_MAJOR = 100;

function baseUrl(): string {
  return (process.env.MONO_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

function secretKey(): string {
  const key = process.env.MONO_SECRET_KEY;
  if (!key) {
    // A 500, not a 400: the caller did nothing wrong, the server is misconfigured.
    throw new AppError('Bank linking is not configured on this server.', 500);
  }
  return key;
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  query?: Record<string, string | undefined>;
  /** Ask Mono to hit the bank rather than serve cached data. */
  realTime?: boolean;
}

async function monoRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, realTime } = options;

  const url = new URL(path.replace(/^\//, ''), `${baseUrl()}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    accept: 'application/json',
    'mono-sec-key': secretKey(),
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (realTime) headers['x-real-time'] = 'true';

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      // Without a timeout a hung upstream would hold an Express worker open
      // until the platform kills it.
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === 'TimeoutError' ? 'timed out' : 'failed';
    throw new AppError(`Could not reach the bank data provider (request ${reason}).`, 502);
  }

  const text = await response.text();
  let payload: unknown = undefined;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = undefined;
    }
  }

  if (!response.ok) {
    const message =
      (payload as { message?: string } | undefined)?.message ||
      `Bank data provider returned ${response.status}.`;
    // 4xx from Mono is usually our fault (bad code, unlinked account), but it is
    // never the end user's fault in a way they can act on, so it surfaces as a
    // bad gateway rather than passing their status through.
    throw new AppError(message, response.status === 401 || response.status === 403 ? 502 : 502);
  }

  return payload as T;
}

/** Pull an account id out of whichever envelope Mono used. */
function extractAccountId(payload: MonoAuthResponse): string {
  const id = payload?.id ?? payload?.data?.id;
  if (!id) {
    throw new AppError('The bank data provider did not return an account id.', 502);
  }
  return id;
}

export const monoClient = {
  /**
   * Exchange the short-lived `code` the Connect widget hands the browser for a
   * persistent account id. This is the only step that must happen server-side
   * for correctness rather than just for secrecy: the code is single-use.
   */
  async exchangeCode(code: string): Promise<string> {
    const payload = await monoRequest<MonoAuthResponse>('/v2/accounts/auth', {
      method: 'POST',
      body: { code },
    });
    return extractAccountId(payload);
  },

  async getAccount(monoAccountId: string): Promise<MonoAccount> {
    const payload = await monoRequest<MonoAccountDetailsResponse>(
      `/v2/accounts/${encodeURIComponent(monoAccountId)}`,
    );
    const account = payload?.account ?? payload?.data?.account;
    if (!account) {
      throw new AppError('The bank data provider returned no account details.', 502);
    }
    return account;
  },

  /**
   * Transactions for a window. `paginate=false` asks Mono for the whole range in
   * one response, which keeps sync a single call — acceptable because we always
   * sync a bounded window rather than all history.
   */
  async getTransactions(
    monoAccountId: string,
    range: { start?: string; end?: string } = {},
    realTime = false,
  ): Promise<MonoTransaction[]> {
    const payload = await monoRequest<MonoTransactionsResponse>(
      `/v2/accounts/${encodeURIComponent(monoAccountId)}/transactions`,
      {
        query: { start: range.start, end: range.end, paginate: 'false' },
        realTime,
      },
    );
    return payload?.data ?? payload?.transactions ?? [];
  },

  /**
   * Ask Mono to backfill categories. Fire-and-forget by design: it is
   * asynchronous on their side (they webhook when done), so a failure here must
   * not fail the sync that triggered it. Categories are a nicety; the
   * transactions themselves are the point.
   */
  async requestCategorisation(monoAccountId: string): Promise<void> {
    await monoRequest(`/v2/accounts/${encodeURIComponent(monoAccountId)}/transactions/categorise`, {
      method: 'POST',
    });
  },

  async unlink(monoAccountId: string): Promise<void> {
    await monoRequest(`/v2/accounts/${encodeURIComponent(monoAccountId)}/unlink`, {
      method: 'POST',
    });
  },
};

/**
 * Convert one Mono transaction into our shape, or explain why it cannot be.
 *
 * Returns null for rows we cannot trust rather than guessing: a transaction
 * with no id cannot be deduped, and one with no amount or date is not usable as
 * an expense. Skipping a row is recoverable; importing a corrupt one is not.
 */
export function normaliseTransaction(raw: MonoTransaction): NormalisedTransaction | null {
  const externalId = raw.id ?? raw._id;
  if (!externalId) return null;

  if (typeof raw.amount !== 'number' || !Number.isFinite(raw.amount)) return null;

  const date = raw.date ? new Date(raw.date) : null;
  if (!date || Number.isNaN(date.getTime())) return null;

  const type = String(raw.type ?? '').toLowerCase();
  if (type !== 'debit' && type !== 'credit') return null;

  return {
    externalId,
    // The single conversion point. Rounded to the kobo to avoid float dust
    // turning ₦2,450.00 into ₦2,449.9999999999995.
    amount: Math.round(Math.abs(raw.amount)) / MINOR_UNITS_PER_MAJOR,
    currency: raw.currency ?? 'NGN',
    narration: (raw.narration ?? '').trim() || 'Bank transaction',
    type,
    date,
    balance:
      typeof raw.balance === 'number' && Number.isFinite(raw.balance)
        ? Math.round(raw.balance) / MINOR_UNITS_PER_MAJOR
        : null,
    suggestedCategory: raw.category ?? null,
  };
}

export function describeAccount(account: MonoAccount): {
  institution: string;
  accountName: string | null;
  accountNumberMask: string | null;
  currency: string;
} {
  const number = account.accountNumber ?? account.account_number ?? null;
  return {
    institution: account.institution?.name ?? 'Unknown bank',
    accountName: account.name ?? null,
    // Last four only — see the note on LinkedAccount.accountNumberMask.
    accountNumberMask: number ? number.slice(-4) : null,
    currency: account.currency ?? 'NGN',
  };
}
