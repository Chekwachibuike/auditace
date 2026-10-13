/**
 * Routing checks for inbound payloads.
 *
 *   npx ts-node --transpile-only scripts/check-routing.ts
 *
 * These assert WHO a message was for, which is separate from what the alert
 * says. Getting it wrong is silent: the webhook answers 200, no row is
 * written, and the spend simply never appears.
 */
import {
  normaliseInboundEmail,
  extractIngestToken,
  extractGmailConfirmationUrl,
} from '../src/modules/integrations/email.providers';

/**
 * FABRICATED. Never put a real ingest token in a fixture or a test.
 *
 * The address is a bearer credential: anyone holding it can post bank alerts
 * into that account's review queue. An earlier version of this file carried a
 * live one, which is how it ended up in a public repository - a test file
 * reads as throwaway, so the value in it never gets a second look. The shape
 * is all these checks need.
 */
const TOKEN = '0000000000000000000000000000beef';
const INGEST = 'exampleserver+' + TOKEN + '@inbound.postmarkapp.com';

interface Case { name: string; payload: Record<string, unknown>; wantToken: string | null }

const CASES: Case[] = [
  {
    name: 'Gmail filter auto-forward (To: is the USER, envelope is the ingest address)',
    payload: {
      From: 'wemaalert@wemabank.com',
      To: 'Alat Customer <customer@example.com>',
      OriginalRecipient: INGEST,
      Subject: 'Your WEMA Account Has Been Debited',
      TextBody: 'Debit NGN 1,000.00',
    },
    wantToken: TOKEN,
  },
  {
    name: 'Gmail auto-forward WITH MailboxHash (provider parsed it for us)',
    payload: {
      From: 'wemaalert@wemabank.com',
      To: 'Alat Customer <customer@example.com>',
      OriginalRecipient: INGEST,
      MailboxHash: TOKEN,
      Subject: 'Alert',
      TextBody: 'Debit NGN 1,000.00',
    },
    wantToken: TOKEN,
  },
  {
    name: 'Manual forward (address typed into To:, no envelope field at all)',
    payload: {
      From: 'customer@example.com',
      To: INGEST,
      Subject: 'Fwd: Your WEMA Account Has Been Debited',
      TextBody: 'Debit NGN 1,000.00',
    },
    wantToken: TOKEN,
  },
  {
    name: 'Mail genuinely not for us (no ingest address anywhere) must be refused',
    payload: {
      From: 'someone@example.com',
      To: 'customer@example.com',
      OriginalRecipient: 'customer@example.com',
      Subject: 'Hello',
      TextBody: 'Nothing financial here',
    },
    wantToken: null,
  },
];

let failures = 0;
for (const c of CASES) {
  const email = normaliseInboundEmail(c.payload);
  const got = email ? extractIngestToken(email.to, email.mailboxHash) : null;
  const ok = got === c.wantToken;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}`);
  if (!ok) console.log(`        got=${got}  want=${c.wantToken}`);
}
/* ---- Gmail forwarding confirmation ------------------------------------- */
// Setting this feature up is impossible without this link, and the privacy
// guard that protects every other message would otherwise destroy the only
// copy of it. That happened once already, on a rotated address.
const VF = 'https://mail-settings.google.com/mail/vf-%5BANGjdJ_sample%5D-0R-token';
const UF = 'https://mail-settings.google.com/mail/uf-%5BANGjdJ_sample%5D-0R-token';
const HELP = 'https://support.google.com/mail/bin/answer.py?answer=184973';

const CONFIRM_CASES: [string, string, string, string | null][] = [
  ['the verify link is found', 'forwarding-noreply@google.com', 'click ' + VF + ' to confirm', VF],
  // Returning this one would silently UNDO the setup it claims to complete.
  ['the CANCEL link is never returned', 'forwarding-noreply@google.com', 'to stop, click ' + UF, null],
  ['verify wins when both are present', 'forwarding-noreply@google.com', UF + ' ... ' + VF, VF],
  // An earlier approach scanned for a run of digits and reported this
  // article id as if it were the confirmation code.
  ['a help-article id is not a code', 'forwarding-noreply@google.com', 'see ' + HELP, null],
  ['a lookalike sender is refused', 'forwarding-noreply@google.com.attacker.test', VF, null],
  ['an ordinary bank alert yields nothing', 'wemaalert@wemabank.com', 'Debit NGN 1,000.00', null],
];

for (const [name, from, text, want] of CONFIRM_CASES) {
  const got = extractGmailConfirmationUrl(from, text);
  const ok = got === want;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        got=${got}  want=${want}`);
}

console.log(failures === 0 ? '\nALL ROUTING CHECKS PASSED\n' : `\n${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
