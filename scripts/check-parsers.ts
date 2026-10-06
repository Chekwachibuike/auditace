/**
 * Regression check for the bank alert parsers.
 *
 *   npx ts-node --transpile-only scripts/check-parsers.ts
 *
 * Every fixture in src/modules/integrations/__fixtures__ is a REAL alert, and
 * each expectation below was read off that alert by eye. Run this after
 * touching email.parsers.ts or adding a bank: a parser that silently starts
 * returning the balance instead of the amount, or reads 06-10-2026 as 10 June,
 * produces numbers that still look entirely plausible in the UI. This is the
 * only thing that catches that.
 */

import fs from 'fs';
import path from 'path';
import { dispatch } from '../src/modules/integrations/email.parsers';

interface Expectation {
  file: string;
  note: string;
  type: 'debit' | 'credit';
  amount: number;
  reference: string;
  date: string; // YYYY-MM-DD
  balance: number;
  narrationContains: string;
}

const CASES: Expectation[] = [
  {
    file: 'alert-nip-credit.txt',
    note: 'colon-on-own-line template, DD-MM-YYYY, amount labelled, currency trails',
    type: 'credit',
    amount: 12000,
    reference: 'S11663426',
    date: '2026-10-06',
    balance: 13237.23,
    narrationContains: 'EXAMPLE SCHOOLS',
  },
  {
    file: 'alert-access-debit.txt',
    note: 'tab-separated template, DD-Mon-YYYY, bare amount, currency leads',
    type: 'debit',
    amount: 2000,
    reference: '247AMHY2627800nP',
    date: '2026-10-05',
    balance: 19690.63,
    narrationContains: 'Chidi Example',
  },
];

const FIXTURES = path.join(__dirname, '..', 'src', 'modules', 'integrations', '__fixtures__');

let failures = 0;

function check(label: string, got: unknown, want: unknown) {
  const ok = got === want;
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(10)} got=${String(got).padEnd(24)} want=${String(want)}`,
  );
}

for (const c of CASES) {
  const text = fs.readFileSync(path.join(FIXTURES, c.file), 'utf8');

  const result = dispatch({
    messageId: 'test',
    from: 'alerts@bank.test',
    to: 'aa-abc123@ingest.test',
    subject: 'Transaction Alert',
    text,
    // Deliberately far from the real dates: if a parser falls back to the
    // received time instead of reading the alert, the date check fails loudly
    // rather than coincidentally passing.
    receivedAt: new Date('2020-01-01T00:00:00Z'),
  });

  console.log(`\n--- ${c.file}`);
  console.log(`    ${c.note}`);

  if (!result.alert) {
    console.log(`  FAIL  did not parse: ${result.reason}`);
    failures += 1;
    continue;
  }

  const a = result.alert;
  check('type', a.type, c.type);
  check('amount', a.amount, c.amount);
  check('reference', a.reference, c.reference);
  check('date', a.date.toISOString().slice(0, 10), c.date);
  check('balance', a.balanceAfter, c.balance);
  check('narration', a.narration.includes(c.narrationContains), true);
  console.log(`        parser=${result.parser?.name} currency=${a.currency} account=${a.account}`);
  console.log(`        narration="${a.narration}"`);
}

console.log(failures === 0 ? '\nALL CHECKS PASSED\n' : `\n${failures} CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
