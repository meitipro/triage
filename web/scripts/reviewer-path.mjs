/**
 * Walk the reviewer's path from fresh accounts, through the site's own code, to finality.
 *
 *   node scripts/reviewer-path.mjs https://<the deployed site> [run-name]
 *
 * Two accounts made for this run, which have never touched the contract:
 *   1. faucet     the deployed site's /api/faucet funds both, sent the address in lower case
 *   2. open       Mia opens a program, English to Persian, 2 GEN a section, with 5 GEN in it
 *   3. sections   Mia adds two sections
 *   4. refusal    Tom submits without a claim; the contract refuses, and the site's
 *                 success test must read it as refused although the status is ACCEPTED
 *   5. pre-check  Tom claims section 1 and submits a translation with a changed number:
 *                 stored as PRECHECK_FAILED with the exact difference, no judge
 *   6. judge      Tom submits the fix and asks the validators; the verdict is read back
 *   7. refusal    Tom claims section 2; Mia tries to close while it is open, and is refused
 *   8. judge      Tom submits section 2 and Mia, not Tom, asks the validators
 *   9. withdraw   Tom withdraws; after finality his wallet must have moved by what the
 *                 contract credited minus the fee the transaction's own accounting reports
 *  10. close      Mia closes; the same check for the unused pool coming back to her
 *  11. read       the program, editor and export pages on the deployed site show the chain
 *
 * Every write goes through lib/genlayer-core.mjs with the stand-in wallet, the
 * code the browser runs. Each step is written to
 * ../docs/reviewer-path.studio-next.json before anything is printed about it.
 * Keys stay in ~/.faithful/accounts.json and are never printed.
 */

import fs from 'node:fs';
import path from 'node:path';

import { CONTRACT, outcomeOf, readClient, retried, submit, waitDecided, waitFinal, walletClient } from '../lib/genlayer-core.mjs';
import { balanceOf, ensureAccount, rpc, standinWallet } from './standin-wallet.mjs';

const site = (process.argv[2] ?? '').replace(/\/$/, '');
const run = process.argv[3] ?? 'rp1';
if (!site) {
  console.error('usage: node scripts/reviewer-path.mjs https://<site> [run-name]');
  process.exit(2);
}
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const RECORD = path.join(here, '..', '..', 'docs', 'reviewer-path.studio-next.json');
const record = fs.existsSync(RECORD) ? JSON.parse(fs.readFileSync(RECORD, 'utf8')) : { runs: {} };
const log = (record.runs[run] ??= { site, contract: CONTRACT, started: new Date().toISOString(), steps: [] });
const save = () => fs.writeFileSync(RECORD, JSON.stringify(record, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2) + '\n');
const GEN = 10n ** 18n;
const fmt = (wei) => `${Number(wei) / 1e18} GEN`;

const stepFor = (key) => log.steps.find((s) => s.key === key);
function note(entry) {
  log.steps.push({ at: new Date().toISOString(), ...entry });
  save();
}

const reader = readClient();
async function view(functionName, args) {
  return JSON.parse(String(await retried(() => reader.readContract({ address: CONTRACT, functionName, args }), 5)));
}

/** The net fee a decided transaction cost its sender, from its own fee accounting. */
async function feeAccounting(hash) {
  const tx = await rpc('eth_getTransactionByHash', [hash]).catch(() => null);
  const acct = tx?.data?.fee_accounting;
  if (!acct) return null;
  return {
    net: BigInt(acct.paid_fee_value ?? 0) - BigInt(acct.total_refunded ?? 0),
    paid: String(acct.paid_fee_value ?? 0),
    refunded: String(acct.total_refunded ?? 0),
    status: acct.status ?? null,
  };
}

/**
 * One write through the site's code. `expect` is 'ok' or 'refused'; a step is
 * recorded as passing only when the outcome is the expected one.
 */
async function write(key, account, method, args, value = 0n, { final = false, expect = 'ok' } = {}) {
  const prior = stepFor(key);
  if (prior?.pass) return prior;
  const { address, provider } = standinWallet(account);
  const client = walletClient(address, provider);
  const started = Date.now();
  const hash = await submit(client, { method, args, value, sender: address });
  const decided = await waitDecided(client, hash, method);
  const outcome = outcomeOf(decided);
  const entry = {
    key,
    method,
    account,
    from: address,
    args: method === 'submit' ? [args[0], args[1], `${String(args[2]).length} characters`] : args,
    value: value.toString(),
    hash,
    expect,
    ok: outcome.ok,
    pass: expect === 'ok' ? outcome.ok : !outcome.ok && Boolean(outcome.refusal),
    status: outcome.status,
    execution: outcome.execution,
    returned: outcome.returned ?? null,
    refusal: outcome.refusal || null,
    seconds_to_decision: Math.round((Date.now() - started) / 1000),
  };
  if (final && outcome.ok) {
    const done = await waitFinal(client, hash);
    entry.final_status = outcomeOf(done).status;
  }
  note(entry);
  console.log(`${key}: ${method} ${entry.ok ? 'ok' : 'refused: ' + (entry.refusal ?? entry.status)} (${entry.status}) in ${entry.seconds_to_decision} s ${entry.pass ? '' : 'UNEXPECTED'}  ${hash}`);
  if (!entry.pass) throw new Error(`${key}: expected ${expect}`);
  return entry;
}

/** Wait until every earlier transaction this account sent has settled its fee accounting. */
async function settled(address) {
  for (const s of log.steps.filter((x) => x.hash && x.from === address)) {
    for (let i = 0; i < 30; i++) {
      const f = await feeAccounting(s.hash);
      if (f?.status === 'settled') break;
      await new Promise((r) => setTimeout(r, 10000));
    }
  }
}

/** A payout, then the wallet after finality: before + what the contract paid - this transaction's net fee. */
async function payoutChecked(key, name, address, method, args, paid) {
  if (stepFor(`balance-${key}`)) return;
  await settled(address);
  const before = await balanceOf(address);
  const tx = await write(key, name, method, args, 0n, { final: true });
  let after = await balanceOf(address);
  let fee = await feeAccounting(tx.hash);
  for (let i = 0; i < 12 && fee?.status !== 'settled'; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    fee = await feeAccounting(tx.hash);
    after = await balanceOf(address);
  }
  const expected = fee === null ? null : before + paid - fee.net;
  note({
    key: `balance-${key}`,
    pass: expected === after,
    paid_by_contract: paid.toString(),
    returned: tx.returned,
    before: before.toString(),
    after: after.toString(),
    fee_paid: fee?.paid ?? null,
    fee_refunded: fee?.refunded ?? null,
    fee_status: fee?.status ?? null,
    expected: expected?.toString() ?? null,
    difference: expected === null ? null : (after - expected).toString(),
  });
  console.log(`  ${fmt(before)} -> ${fmt(after)}; paid ${fmt(paid)}, net fee ${fee === null ? '?' : fmt(fee.net)}; ${expected === after ? 'exact to the wei' : 'difference ' + (expected === null ? '?' : (after - expected).toString()) + ' wei'}`);
}

async function verdictOf(sectionId, submissionId) {
  const s = await view('get_section', [sectionId]);
  return s.submissions.find((x) => x.id === submissionId);
}

// -- accounts ---------------------------------------------------------------------------------
const mName = `review_mia_${run}`;
const tName = `review_tom_${run}`;
const mia = ensureAccount(mName);
const tom = ensureAccount(tName);
if (!log.accounts) {
  const nonces = { mia: Number(await rpc('eth_getTransactionCount', [mia, 'latest'])), tom: Number(await rpc('eth_getTransactionCount', [tom, 'latest'])) };
  log.accounts = { mia, tom, nonces_at_start: nonces };
  save();
  console.log(`accounts: Mia ${mia}, Tom ${tom}, nonces at start ${JSON.stringify(nonces)}`);
}

// -- 1. faucet, through the deployed site --------------------------------------------------------
for (const [who, address] of [['mia', mia], ['tom', tom]]) {
  const key = `faucet-${who}`;
  if (stepFor(key)?.pass) continue;
  const response = await fetch(`${site}/api/faucet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: address.toLowerCase() }),
  });
  const body = await response.json().catch(() => ({}));
  const after = await balanceOf(address);
  const pass = response.ok && BigInt(body.after ?? 0) > BigInt(body.before ?? 0) && after > 0n;
  note({ key, pass, http: response.status, sent_address: address.toLowerCase(), answered_address: body.address, before: body.before, after: body.after, read_after: after.toString(), error: body.error });
  console.log(`${key}: HTTP ${response.status} ${fmt(BigInt(body.before ?? 0))} -> ${fmt(after)} ${body.error ?? ''}`);
  if (!pass) throw new Error(`${key} did not fund ${address}`);
}

// -- 2. open, 3. sections -------------------------------------------------------------------------
const name = `Reviewer path ${run}`;
const opened = await write('open', mName, 'create_program', [name, 'en', ['fa'], '{"recovery phrase": {"fa": "عبارت بازیابی"}}', 2n * GEN], 5n * GEN);
const pid = Number(opened.returned);
log.program_id = pid;
save();
console.log(`  program ${pid}`);
const SOURCES = ['The fee is 10 GEN.', 'Never share your recovery phrase. Anyone who has it can move your funds.'];
const added = await write('sections', mName, 'add_sections', [pid, JSON.stringify(SOURCES)]);
const s1 = Number(added.returned);
const s2 = s1 + 1;

// -- 4. a refusal the site must call a refusal ------------------------------------------------------
await write('submit-without-claim', tName, 'submit', [s1, 'fa', 'کارمزد ۱۰ GEN است.'], 0n, { expect: 'refused' });

// -- 5. a pre-check failure, stored with the exact difference ----------------------------------------
await write('claim-1', tName, 'claim', [s1, 'fa']);
const wrong = await write('submit-1-wrong', tName, 'submit', [s1, 'fa', 'کارمزد ۱۰۰ GEN است.']);
const wrongRow = await verdictOf(s1, Number(wrong.returned));
if (!stepFor('read-precheck')) note({ key: 'read-precheck', pass: wrongRow.verdict === 'PRECHECK_FAILED', verdict: wrongRow.verdict, problems: wrongRow.problems });
console.log(`  -> ${wrongRow.verdict}: ${wrongRow.problems.join('; ')}`);

// -- 6. the fix, judged ----------------------------------------------------------------------------
const fixed = await write('submit-1', tName, 'submit', [s1, 'fa', 'کارمزد ۱۰ GEN است.']);
await write('judge-1', tName, 'judge', [Number(fixed.returned)]);
const v1 = await verdictOf(s1, Number(fixed.returned));
if (!stepFor('read-verdict-1')) note({ key: 'read-verdict-1', pass: v1.verdict !== 'PENDING', verdict: v1.verdict, reason: v1.reason, credited: v1.credited });
console.log(`  -> ${v1.verdict}: ${v1.reason}`);

// -- 7. close is refused while a claim is open --------------------------------------------------------
await write('claim-2', tName, 'claim', [s2, 'fa']);
await write('close-while-open', mName, 'close', [pid], 0n, { expect: 'refused' });

// -- 8. section 2, judged at the maintainer's request -------------------------------------------------
const second = await write('submit-2', tName, 'submit', [s2, 'fa', 'هرگز عبارت بازیابی خود را با کسی به اشتراک نگذارید. هر کسی که آن را داشته باشد می‌تواند وجوه شما را منتقل کند.']);
await write('judge-2', mName, 'judge', [Number(second.returned)]);
const v2 = await verdictOf(s2, Number(second.returned));
if (!stepFor('read-verdict-2')) note({ key: 'read-verdict-2', pass: v2.verdict !== 'PENDING' && v2.judged_by.toLowerCase() === mia.toLowerCase(), verdict: v2.verdict, reason: v2.reason, credited: v2.credited, judged_by: v2.judged_by });
console.log(`  -> ${v2.verdict}: ${v2.reason}`);

// -- 9. withdraw, 10. close, both checked to the wei after finality ------------------------------------------
const tomPage = await view('list_submissions', [tom, 0, 10]);
const credit = BigInt(tomPage.balance);
if (credit > 0n) {
  await payoutChecked('withdraw', tName, tom, 'withdraw', [], credit);
  await write('withdraw-again', tName, 'withdraw', [], 0n, { expect: 'refused' });
} else if (!stepFor('withdraw-nothing')) {
  await write('withdraw-nothing', tName, 'withdraw', [], 0n, { expect: 'refused' });
}
const before = await view('get_program', [pid]);
// Section 2 may have ended FLAWED with Tom still holding it for a revision; close then waits for the claim to expire.
if (before.live_claims === 0) await payoutChecked('close', mName, mia, 'close', [pid], BigInt(before.pool));
const after = await view('get_program', [pid]);
if (!stepFor('read-program')) {
  note({
    key: 'read-program',
    pass: BigInt(after.funded) === BigInt(after.pool) + BigInt(after.paid) + BigInt(after.returned),
    funded: after.funded,
    paid: after.paid,
    returned: after.returned,
    pool: after.pool,
    closed: after.closed,
  });
}

// -- 11. the deployed site shows what the chain holds ---------------------------------------------------
for (const [key, url, needle] of [
  ['page-program', `${site}/p/${pid}`, name],
  ['page-editor', `${site}/s/${s1}/fa`, 'The fee is 10 GEN.'],
  ['page-export', `${site}/api/export/${pid}/fa`, `program ${pid}`],
  ['page-translator', `${site}/programs`, name],
]) {
  if (stepFor(key)?.pass) continue;
  let pass = false;
  let status = 0;
  for (let attempt = 0; attempt < 6 && !pass; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 10000));
    const response = await fetch(url, { cache: 'no-store' });
    status = response.status;
    pass = response.ok && (await response.text()).includes(needle);
  }
  note({ key, pass, url, http: status });
  console.log(`${key}: HTTP ${status} ${pass ? 'shows it' : 'MISSING'}  ${url}`);
}

log.finished = new Date().toISOString();
save();
const failed = log.steps.filter((s) => !s.pass).map((s) => s.key);
console.log(`\nrecorded in docs/reviewer-path.studio-next.json (run ${run}); ${failed.length ? 'not passing: ' + failed.join(', ') : 'every step passed'}`);
