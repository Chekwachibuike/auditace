import type { BankParser, NormalisedEmail, ParsedAlert } from './email.types';

/**
 * Bank alert parsing.
 *
 * Two real samples (see __fixtures__/) showed that Nigerian bank alerts are far
 * more alike than they first appear. Both carry the same core vocabulary —
 * Account Name, Description, Reference Number, Value Date — and differ only in
 * three mechanical ways:
 *
 *   1. SEPARATOR.  One bank flattens its HTML table to `Label \n : \n value`,
 *      the other to `Label \t value`.
 *   2. LABEL WORDING.  "Account Number" vs "A/C Number", "Current Balance" vs
 *      "Available Balance", "Transaction Date & Time" vs "Transaction Date".
 *   3. AMOUNT PLACEMENT.  One labels it ("Transaction Amount: 12,000.00 NGN"),
 *      the other states it bare above the table ("NGN 2,000.00").
 *
 * So this is ONE parser driven by label aliases, not one parser per bank.
 * Adding a bank usually means adding a synonym to a list below rather than
 * writing new extraction logic — and a bank whose template already matches is
 * supported the day it first sends an alert.
 */

/* ---- Shared helpers ------------------------------------------------------ */

/**
 * "NGN2,450.00" / "₦2,450.00" / "12,000.00 NGN" / "2450" -> number
 *
 * Returns null rather than NaN or 0 for anything unreadable. A silent 0 would
 * pass validation and land in the ledger as a free transaction.
 */
export function parseAmount(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.,]/g, '').replace(/,/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

const MONTHS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

/**
 * Parse an alert date, falling back to when the mail arrived.
 *
 * Both observed formats are day-first (`06-10-2026`, `05-Oct-2026`), and that
 * is the whole reason this function exists: `new Date('06-10-2026')` reads it
 * US-style as 10 June, silently filing an October expense five months early.
 * Day-first patterns are therefore tried before any native parsing.
 *
 * Every branch builds the date with Date.UTC, never `new Date(y, m, d)`. An
 * alert states a calendar day with no timezone, and the rest of the system
 * stores those as UTC midnight (POST /expenses turns "2026-09-15" into exactly
 * that). Building a LOCAL midnight here would shift the day backwards for every
 * user east of UTC the moment it is serialised — in WAT a 6 October transaction
 * is written as 2026-10-05T23:00:00Z and then displays as the 5th.
 */
export function parseDate(raw: string | undefined | null, fallback: Date): Date {
  if (!raw) return fallback;

  // 05-Oct-2026 / 05 Oct 2026
  const named = /\b(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{4})\b/.exec(raw);
  if (named) {
    const month = MONTHS.indexOf(named[2].slice(0, 3).toLowerCase());
    if (month >= 0) {
      const date = new Date(Date.UTC(Number(named[3]), month, Number(named[1])));
      if (!Number.isNaN(date.getTime())) return date;
    }
  }

  // 06-10-2026 / 06/10/2026 — day first, never month first.
  const dmy = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/.exec(raw);
  if (dmy) {
    const date = new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])));
    if (!Number.isNaN(date.getTime())) return date;
  }

  // 2026-10-06
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(raw);
  if (iso) {
    const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    if (!Number.isNaN(date.getTime())) return date;
  }

  const loose = new Date(raw);
  return Number.isNaN(loose.getTime()) ? fallback : loose;
}

/** Collapse whitespace and trim — alert bodies are full of table padding. */
export function tidy(value: string | undefined | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Last-resort direction detection, for alerts that do not state it in prose.
 *
 * Debit terms are tested first because credit alerts rarely mention debiting,
 * while debit alerts often mention both. Returns null when neither appears, so
 * the caller records `unparsed` rather than guessing — a wrong direction either
 * invents spending or hides it.
 */
export function detectType(text: string): 'debit' | 'credit' | null {
  const t = text.toLowerCase();
  if (/\bdebit(ed)?\b|\bwithdraw(al|n)?\b|\bpurchase\b|\bdr\b/.test(t)) return 'debit';
  if (/\bcredit(ed)?\b|\bdeposit(ed)?\b|\breceived\b|\bcr\b/.test(t)) return 'credit';
  return null;
}

/**
 * Read a labelled value, trying each alias in order.
 *
 * `[\s:]*` is the separator bridge and is what makes one reader work across
 * both templates: \s covers the tab in `Label \t value` and the newlines in
 * `Label \n : \n value`, while the colon class covers the colon itself. It
 * stops at the first character that is neither whitespace nor a colon, which is
 * why a value containing a colon ("NIP:EXAMPLE SCHOOLS LTD") survives intact —
 * the bridge cannot eat into it.
 *
 * ORDER MATTERS. Pass the most specific alias first: searching "Transaction
 * Date" against a body containing "Transaction Date & Time" matches the prefix
 * and then captures "& Time: ..." as the value.
 */
export function field(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // \b so a short alias like "Amount" or "Ref" cannot match inside another
    // word. It still matches the tail of a longer label ("Transaction Amount"),
    // which is wanted — that is the same field.
    const match = new RegExp('\\b' + escaped + '[\\s:]*([^\\n\\t]+)', 'i').exec(text);
    const value = tidy(match?.[1]);
    if (value) return value;
  }
  return null;
}

const BALANCE_LABEL = /(?:Available|Current|Closing|Ledger|Running)\s+Balance/i;

/**
 * The balance, read by position rather than by the generic field() reader.
 *
 * One bank writes `Current Balance as at 06-10-2026 12:07:45 : 13,237.23 NGN` —
 * the label carries a timestamp, so the colon bridge stops at "as" and would
 * return the whole trailing string. Taking the first properly-formed decimal
 * after the label skips the date and the time (neither contains a decimal
 * point) and lands on the figure.
 */
function findBalance(text: string): number | null {
  const match = new RegExp(BALANCE_LABEL.source + '[\\s\\S]*?([\\d,]+\\.\\d{2})', 'i').exec(text);
  return parseAmount(match?.[1]);
}

/**
 * The transaction amount.
 *
 * Tries the labelled field first, then falls back to a bare currency amount for
 * templates that state it above the table. The fallback deliberately searches
 * only the text BEFORE the balance label: the balance is also a currency
 * amount, and without that cut a labelless alert would happily report the
 * closing balance as the amount spent.
 */
function findAmount(text: string): { amount: number | null; raw: string | null } {
  const labelled = field(text, ['Transaction Amount', 'Amount Credited', 'Amount Debited', 'Amount', 'Amt']);
  const fromLabel = parseAmount(labelled);
  if (fromLabel !== null) return { amount: fromLabel, raw: labelled };

  const balanceAt = text.search(BALANCE_LABEL);
  const region = balanceAt > -1 ? text.slice(0, balanceAt) : text;

  const leading = /\b(?:NGN|USD|GBP|EUR|₦)\s*([\d,]+(?:\.\d{2})?)/i.exec(region);
  if (leading) return { amount: parseAmount(leading[1]), raw: leading[0] };

  const trailing = /([\d,]+\.\d{2})\s*(?:NGN|USD|GBP|EUR|₦)\b/i.exec(region);
  if (trailing) return { amount: parseAmount(trailing[1]), raw: trailing[0] };

  return { amount: null, raw: null };
}

/* ---- Registry ------------------------------------------------------------ */

/**
 * The shared Nigerian bank alert template.
 *
 * Matched on body structure, not sender domain. These layouts come from a small
 * number of shared vendor templates, so structure generalises across banks
 * while a sender allow-list would need extending for every new bank and would
 * break the moment one changed its sending domain.
 */
const nigerianBankAlert: BankParser = {
  name: 'ng-bank-alert',
  label: 'Nigerian bank alert',

  // Matching is STRUCTURAL and deliberately generous, never a list of known
  // bank domains. An allow-list would work for whoever's banks happened to be
  // on it and silently reject everyone else's — the people most likely to be
  // affected are exactly the users nobody tested with. Any mail that states a
  // direction and carries a currency amount is worth attempting; if the attempt
  // fails it is stored as `unparsed` and surfaces for a human, which is a far
  // better failure than refusing to look.
  matches: (email) => {
    const t = email.text;
    const saysDirection =
      /\b(debit|credit)(ed)?\b/i.test(t) || /\bwithdraw|deposit|transfer\b/i.test(t);
    const hasAmount =
      /\b(?:NGN|USD|GBP|EUR|₦)\s*[\d,]+/i.test(t) || /[\d,]+\.\d{2}\s*(?:NGN|USD|GBP|EUR|₦)\b/i.test(t);
    const looksTabular =
      /Transaction Summary|Transaction Details|Account (?:Number|Name)|A\/C Number|Reference/i.test(t);
    return saysDirection && hasAmount && looksTabular;
  },

  parse: (email) => {
    // Direction is taken from an explicit statement wherever possible. The
    // Description routinely contains words like "TRF TO" that a keyword sweep
    // would read as a debit, so prose declarations win over detectType().
    const declared =
      /Transaction Details\s*-\s*(Credit|Debit)/i.exec(email.text)?.[1] ??
      /your account has been\s+(debited|credited)/i.exec(email.text)?.[1];

    const type: 'debit' | 'credit' | null = declared
      ? /^cred/i.test(declared)
        ? 'credit'
        : 'debit'
      : detectType(email.text);
    if (!type) return null;

    const { amount, raw: amountRaw } = findAmount(email.text);
    if (amount === null) return null;

    const currency = /\b(NGN|USD|GBP|EUR)\b/i.exec(amountRaw ?? '')?.[1]?.toUpperCase() ?? 'NGN';

    // "Value Date" first: it is present and clean in every sample, whereas
    // "Transaction Date" collides with "Transaction Date & Time".
    // Most specific first: "Transaction Date" would otherwise match the prefix
    // of "Transaction Date & Time" and capture "& Time: ..." as the value.
    const date = parseDate(
      field(email.text, [
        'Value Date',
        'Transaction Date & Time',
        'Transaction Date',
        'Date & Time',
        'Date',
      ]),
      email.receivedAt,
    );

    return {
      amount,
      currency,
      type,
      date,
      narration:
        field(email.text, [
          'Description',
          'Narration',
          'Transaction Narration',
          'Remarks',
          'Particulars',
          'Details',
        ]) ||
        tidy(email.subject) ||
        'Bank alert',
      balanceAfter: findBalance(email.text),
      account: field(email.text, [
        'Account Number',
        'A/C Number',
        'Acct Number',
        'Account No',
        'Acct No',
      ]),
      reference: field(email.text, [
        'Reference Number',
        'Transaction Reference',
        'Session ID',
        'Reference',
        'Ref No',
        'Ref',
      ]),
    };
  },
};

export const BANK_PARSERS: BankParser[] = [nigerianBankAlert];

export interface DispatchResult {
  parser: BankParser | null;
  alert: ParsedAlert | null;
  reason?: string;
}

/**
 * Pick a parser and run it.
 *
 * A parser that matches but cannot extract does NOT fall through to the next
 * one. If this template recognises a mail and fails on it, the right outcome is
 * "that parser needs fixing", not "let another one guess" — a loose second
 * match could produce a confident, wrong number, which is worse than no number.
 */
export function dispatch(email: NormalisedEmail): DispatchResult {
  const parser = BANK_PARSERS.find((p) => p.matches(email));

  if (!parser) {
    return { parser: null, alert: null, reason: `No parser matched sender ${email.from}` };
  }

  try {
    const alert = parser.parse(email);
    if (!alert) {
      return { parser, alert: null, reason: `${parser.label} parser could not read this alert` };
    }
    return { parser, alert };
  } catch (error) {
    return {
      parser,
      alert: null,
      reason: `${parser.label} parser threw: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    };
  }
}
