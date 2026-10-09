/**
 * Walk the reviewer's path from fresh accounts, through the site's own code, to finality.
 *
 *   node scripts/reviewer-path.mjs https://<the deployed site> [run-name]
 *
 * Two accounts made for this run, which have never touched the contract:
 *   1. faucet     the deployed site's /api/faucet funds both, sent the address in lower case
 *   2. open       the team opens a one-hour trial program: 3 GEN reward, 1 GEN stake, 10 GEN in the pool
 *   3. refusal    the tester files with half the stake; the contract refuses, and the site's
 *                 success test must read it as refused although the status is ACCEPTED
 *   4. refusal    the team files in its own program, and is refused
 *   5. file       the tester files a specific report and a vague one; two rewards are reserved
 *   6. refusal    the tester asks for the later report to be judged first, and is refused
 *   7. judge      the team asks for the first verdict, the tester for the second; both read back
 *   8. bonus      when the first is actionable: refused from the tester, then tipped by the team
 *   9. refusal    the team tries to close before the trial hour is up
 *  10. withdraw   the tester withdraws; after finality the wallet must have moved by what the
 *                 contract credited minus the fee the transaction's own accounting reports
 *  11. read       the program, report, export and programs pages on the deployed site show the chain
 *  12. close      after the hour, the team closes; the same check for the unused pool coming back
 *
 * Every write goes through lib/genlayer-core.mjs with the stand-in wallet, the
 * code the browser runs. Each step is written to
 * ../docs/reviewer-path.studio-next.json before anything is printed about it.
 * Keys stay in ~/.triage/accounts.json and are never printed.
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
    args: method === 'submit' ? [args[0], args[1], args[2], `${String(args[3]).length} characters`] : args,
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

async function report(id) {
  return view('get_report', [id]);
}

// -- accounts ---------------------------------------------------------------------------------
const tName = `review_team_${run}`;
const rName = `review_tester_${run}`;
const team = ensureAccount(tName);
const tester = ensureAccount(rName);
if (!log.accounts) {
  const nonces = { team: Number(await rpc('eth_getTransactionCount', [team, 'latest'])), tester: Number(await rpc('eth_getTransactionCount', [tester, 'latest'])) };
  log.accounts = { team, tester, nonces_at_start: nonces };
  save();
  console.log(`accounts: team ${team}, tester ${tester}, nonces at start ${JSON.stringify(nonces)}`);
}

// -- 1. faucet, through the deployed site --------------------------------------------------------
for (const [who, address] of [['team', team], ['tester', tester]]) {
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

// -- 2. open a one-hour trial program ----------------------------------------------------------------
const name = `Reviewer path ${run}`;
const SCOPE =
  'The Triage website: the programs list, a program page, filing a report and a report page. Not in scope: the docs, ' +
  'the GenLayer network, the Studio Next explorer and wallets. Security issues go to a private advisory on the GitHub repository, never here.';
const REWARD = 3n * GEN;
const STAKE = 1n * GEN;
const opened = await write('open', tName, 'open_program', [name, SCOPE, REWARD, STAKE, 5, 0], 10n * GEN);
const pid = Number(opened.returned);
log.program_id = pid;
save();
console.log(`  program ${pid}`);

// -- 3, 4. refusals the site must call refusals, although their status is ACCEPTED --------------------------
const A_TITLE = 'Programs list does not show how many reports are waiting for the judge';
const A_BODY =
  'Problem: each row on /programs shows the reward, the stake, the number of reports and how many are actionable, but ' +
  'not how many are still waiting for the judge. A program with ten unjudged reports looks the same as one with none.\n' +
  'Where: the /programs page, every program row, desktop and mobile.\n' +
  'Why it matters: reports are judged in filing order, so a tester choosing where to file wants to know how long the line is.';
await write('submit-wrong-stake', rName, 'submit', [pid, 'usability', A_TITLE, A_BODY], STAKE / 2n, { expect: 'refused' });
await write('submit-by-team', tName, 'submit', [pid, 'usability', A_TITLE, A_BODY], STAKE, { expect: 'refused' });

// -- 5, 6. two reports, filed with the stake ---------------------------------------------------------------
const a = await write('submit-a', rName, 'submit', [pid, 'usability', A_TITLE, A_BODY], STAKE);
const aId = Number(a.returned);
const b = await write('submit-b', rName, 'submit', [pid, 'idea', 'Improve it', 'Needs improvement. Make everything better.'], STAKE);
const bId = Number(b.returned);
const afterFiling = await view('get_program', [pid]);
if (!stepFor('read-reserved')) {
  note({ key: 'read-reserved', pass: BigInt(afterFiling.reserved) === 2n * REWARD && BigInt(afterFiling.pool) === 10n * GEN - 2n * REWARD, reserved: afterFiling.reserved, pool: afterFiling.pool });
}

// -- 7. filing order: the later report cannot be judged first ------------------------------------------------
await write('judge-b-first', rName, 'judge', [bId], 0n, { expect: 'refused' });

// -- 8, 9. the team asks for the first verdict, the tester for the second --------------------------------------
await write('judge-a', tName, 'judge', [aId]);
const va = await report(aId);
if (!stepFor('read-verdict-a')) note({ key: 'read-verdict-a', pass: va.status !== 'FILED' && va.judged_by.toLowerCase() === team.toLowerCase(), verdict: va.status, summary: va.summary, reason: va.reason, credited: va.credited, judged_by: va.judged_by });
console.log(`  -> #${aId} ${va.status}: ${va.reason}`);
await write('judge-b', rName, 'judge', [bId]);
const vb = await report(bId);
if (!stepFor('read-verdict-b')) note({ key: 'read-verdict-b', pass: vb.status !== 'FILED', verdict: vb.status, summary: vb.summary, reason: vb.reason, credited: vb.credited });
console.log(`  -> #${bId} ${vb.status}: ${vb.reason}`);

// -- 10. a bonus from the team, refused from anyone else ----------------------------------------------------------
if (va.status === 'ACTIONABLE') {
  await write('bonus-by-tester', rName, 'bonus', [aId], GEN, { expect: 'refused' });
  await write('bonus', tName, 'bonus', [aId], GEN);
}

// -- 11. close is refused before the trial hour is up -----------------------------------------------------------------
const program = await view('get_program', [pid]);
if (Date.now() / 1000 < program.ends_at - 120) await write('close-early', tName, 'close', [pid], 0n, { expect: 'refused' });

// -- 12. withdraw, checked to the wei after finality ------------------------------------------------------------------
const stats = await view('tester_stats', [tester]);
const credit = BigInt(stats.balance);
if (credit > 0n) {
  await payoutChecked('withdraw', rName, tester, 'withdraw', [], credit);
  await write('withdraw-again', rName, 'withdraw', [], 0n, { expect: 'refused' });
} else {
  await write('withdraw-nothing', rName, 'withdraw', [], 0n, { expect: 'refused' });
}

// -- 13. the deployed site shows what the chain holds ---------------------------------------------------------------------
for (const [key, url, needle] of [
  ['page-program', `${site}/p/${pid}`, name],
  ['page-report', `${site}/r/${aId}`, A_TITLE],
  ['page-export', `${site}/api/export/${pid}`, va.status === 'ACTIONABLE' ? A_TITLE : `"id":${pid}`],
  ['page-programs', `${site}/programs`, name],
]) {
  if (stepFor(key)?.pass) continue;
  let pass = false;
  let status = 0;
  for (let attempt = 0; attempt < 6 && !pass; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 10000));
    const response = await fetch(url, { cache: 'no-store' });
    status = response.status;
    pass = response.ok && (await response.text()).replace(/<!-- -->/g, '').replace(/&#x27;/g, "'").includes(needle);
  }
  note({ key, pass, url, http: status });
  console.log(`${key}: HTTP ${status} ${pass ? 'shows it' : 'MISSING'}  ${url}`);
}

// -- 14. close after the trial hour, checked to the wei ----------------------------------------------------------------------
const wait = (program.ends_at + 20) * 1000 - Date.now();
if (wait > 0 && !stepFor('balance-close')) {
  console.log(`waiting ${Math.ceil(wait / 60000)} min for the trial hour to end`);
  await new Promise((r) => setTimeout(r, wait));
}
const before = await view('get_program', [pid]);
await payoutChecked('close', tName, team, 'close', [pid], BigInt(before.pool));
await write('close-again', tName, 'close', [pid], 0n, { expect: 'refused' });
const after = await view('get_program', [pid]);
if (!stepFor('read-program')) {
  note({
    key: 'read-program',
    pass: after.closed && BigInt(after.funded) + BigInt(after.lost) === BigInt(after.pool) + BigInt(after.reserved) + BigInt(after.paid) + BigInt(after.returned),
    funded: after.funded,
    lost: after.lost,
    paid: after.paid,
    returned: after.returned,
    pool: after.pool,
    reserved: after.reserved,
    bonuses: after.bonuses,
    closed: after.closed,
  });
}

log.finished = new Date().toISOString();
save();
const failed = log.steps.filter((s) => !s.pass).map((s) => s.key);
console.log(`\nrecorded in docs/reviewer-path.studio-next.json (run ${run}); ${failed.length ? 'not passing: ' + failed.join(', ') : 'every step passed'}`);
