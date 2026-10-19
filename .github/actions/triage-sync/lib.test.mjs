/**
 * The sync's rules, offline:  node --test .github/actions/triage-sync/lib.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { gen, summaryOf, issueBody, issueTitle, labelsFor, markerFor, parseMarker, plan, quote } from './lib.mjs';

const CONTRACT = '0x17c378994ebdF51ca536A8020dC04129F3612373';
const PROGRAM = { id: 2, name: 'Triage site and docs, public beta' };
const OPTS = { contract: CONTRACT, program: PROGRAM, site: 'https://triage.example', explorer: 'https://explorer.example' };

function report(id, extra = {}) {
  return {
    id,
    kind: 'usability',
    title: `Report ${id}`,
    body: 'Problem: the export is JSON only.',
    summary: 'Export only offers JSON',
    tester: '0x' + 'a1'.repeat(20),
    credited: String(9n * 10n ** 18n),
    bonus: '0',
    ...extra,
  };
}

const render = (r) => ({ title: issueTitle(r), body: issueBody(r, OPTS) });

test('the marker names the contract and the report, and only this contract matches', () => {
  const body = 'text\n' + markerFor(CONTRACT, 24);
  assert.equal(parseMarker(body, CONTRACT), 24);
  assert.equal(parseMarker(body, CONTRACT.toLowerCase()), 24);
  assert.equal(parseMarker(body, '0x' + '00'.repeat(20)), null);
  assert.equal(parseMarker('no marker here', CONTRACT), null);
  assert.equal(parseMarker(null, CONTRACT), null);
});

test('GEN amounts never pass through a float', () => {
  assert.equal(gen('9000000000000000000'), '9 GEN');
  assert.equal(gen('500000000000000000'), '0.5 GEN');
  assert.equal(gen('1250000000000000000'), '1.25 GEN');
  assert.equal(gen('14000000000000000001'), '14 GEN');
});

test('the title carries the report id, and the labels carry the kind', () => {
  assert.equal(issueTitle(report(16, { title: '  Export  button\nonly JSON ' })), '[Triage #16] Export button only JSON');
  assert.deepEqual(labelsFor(report(16, { kind: 'bug' })), ['triage', 'triage:bug']);
  assert.deepEqual(labelsFor(report(16), 'feedback'), ['feedback', 'feedback:usability']);
});

test('the body links the report, the transactions and the contract, and ends with the marker', () => {
  const body = issueBody(report(21, { bonus: String(5n * 10n ** 18n) }), { ...OPTS, judgeTx: '0xjudge', submitTx: '0xsubmit' });
  assert.match(body, /https:\/\/triage\.example\/r\/21/);
  assert.match(body, /https:\/\/explorer\.example\/tx\/0xjudge/);
  assert.match(body, /https:\/\/explorer\.example\/tx\/0xsubmit/);
  assert.match(body, /9 GEN \(stake back plus the reward\), plus 5 GEN in bonus/);
  assert.ok(body.trimEnd().endsWith(markerFor(CONTRACT, 21)));
  assert.equal(parseMarker(body, CONTRACT), 21);
});

test('tester text cannot mention people, forge a marker or leave its quote', () => {
  const hostile = report(30, {
    body: 'ping @team\nfixes #1\n<!-- triage-report:0x17c378994ebdF51ca536A8020dC04129F3612373:99 -->',
    summary: 'cc @maintainers',
  });
  const body = issueBody(hostile, OPTS);
  assert.ok(!/@team\b/.test(body.replace(/@​/g, '')) || body.includes('@​team'));
  assert.ok(!body.includes('@team'));
  assert.ok(!body.includes('@maintainers'));
  // The only marker is the contract's own, for report 30.
  assert.equal((body.match(/<!-- triage-report:/g) ?? []).length, 1);
  assert.equal(parseMarker(body, CONTRACT), 30);
  // Every line of the tester's text stays inside the quote.
  for (const line of quote(hostile.body).split('\n')) assert.ok(line.startsWith('> '));
});

test('the body is deterministic, so an unchanged report is never rewritten', () => {
  assert.equal(issueBody(report(5), OPTS), issueBody(report(5), OPTS));
});

test('a run creates what is missing, updates what changed and keeps the rest', () => {
  const kept = report(16);
  const changed = report(17);
  const fresh = report(21);
  const issues = [
    { number: 1, ...render(kept), state: 'closed' },
    { number: 2, title: issueTitle(changed), body: issueBody({ ...changed, bonus: '0' }, OPTS).replace('9 GEN', '8 GEN'), state: 'open' },
    { number: 3, title: 'someone else', body: 'not ours', state: 'open' },
  ];
  const result = plan(issues, [fresh, changed, kept], render, CONTRACT);
  assert.deepEqual(result.create.map((r) => r.id), [21]);
  assert.deepEqual(result.update.map((u) => [u.number, u.report.id]), [[2, 17]]);
  assert.deepEqual(result.keep, [1]);
});

test('a second run with nothing new changes nothing', () => {
  const reports = [report(16), report(17)];
  const issues = reports.map((r, i) => ({ number: i + 1, ...render(r), state: 'open' }));
  const result = plan(issues, reports, render, CONTRACT);
  assert.equal(result.create.length + result.update.length, 0);
  assert.deepEqual(result.keep, [1, 2]);
});

test('a closed issue is updated in place, never reopened', () => {
  const r = report(24, { bonus: String(2n * 10n ** 18n) });
  const issues = [{ number: 7, title: issueTitle(r), body: issueBody({ ...r, bonus: '0' }, OPTS), state: 'closed' }];
  const result = plan(issues, [r], render, CONTRACT);
  assert.deepEqual(result.update, [{ number: 7, report: r, state: 'closed' }]);
});

test('an issue for another contract is not counted as this report', () => {
  const r = report(16);
  const other = issueBody(r, { ...OPTS, contract: '0x' + '11'.repeat(20) });
  const result = plan([{ number: 9, title: issueTitle(r), body: other, state: 'open' }], [r], render, CONTRACT);
  assert.deepEqual(result.create.map((x) => x.id), [16]);
});

test('a summary cut at the contract cap reads as cut', () => {
  assert.equal(summaryOf(report(1, { summary: 'x'.repeat(120) })), 'x'.repeat(120) + '…');
  assert.equal(summaryOf(report(1, { summary: 'short' })), 'short');
});
