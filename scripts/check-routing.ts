/**
 * Routing checks for inbound payloads.
 *
 *   npx ts-node --transpile-only scripts/check-routing.ts
 *
 * These assert WHO a message was for, which is separate from what the alert
 * says. Getting it wrong is silent: the webhook answers 200, no row is
 * written, and the spend simply never appears.
 */
import { normaliseInboundEmail, extractIngestToken } from '../src/modules/integrations/email.providers';

const TOKEN = '8b99f22b72f68455e93d3b89e204585c';
const INGEST = '24a3dcba7d23797f1bd7a93bd1b7efce+' + TOKEN + '@inbound.postmarkapp.com';

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
console.log(failures === 0 ? '\nALL ROUTING CHECKS PASSED\n' : `\n${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
