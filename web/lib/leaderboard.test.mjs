/**
 * The leaderboard's ranking, offline:  node --test web/lib/leaderboard.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { percent, rank, toCsv } from './leaderboard.mjs';

const GEN = 10n ** 18n;
const A = '0x' + 'aa'.repeat(20);
const B = '0x' + 'bb'.repeat(20);
const C = '0x' + 'cc'.repeat(20);
const D = '0x' + 'dd'.repeat(20);

let next = 1;
function r(tester, status, extra = {}) {
  return {
    id: next++,
    tester,
    program_id: 2,
    status,
    reward: String(8n * GEN),
    stake: String(GEN),
    bonus: '0',
    filed_at: 1000 + next,
    judged_at: status === 'FILED' ? 0 : 2000 + next,
    ...extra,
  };
}

test('more actionable reports rank first, then a higher acceptance rate', () => {
  const rows = rank([
    r(A, 'ACTIONABLE'),
    r(A, 'LOW_EFFORT'),
    r(B, 'ACTIONABLE'),
    r(B, 'ACTIONABLE'),
    r(C, 'ACTIONABLE'),
  ]);
  assert.deepEqual(rows.map((x) => x.tester), [B, C, A]);
  assert.deepEqual(rows.map((x) => x.rank), [1, 2, 3]);
  assert.equal(rows[2].acceptance_bp, 5000);
});

test('ties fall to fewer low-effort reports, then the earlier first acceptance, then the address', () => {
  const rows = rank([
    r(B, 'ACTIONABLE', { judged_at: 50 }),
    r(B, 'DUPLICATE'),
    r(A, 'ACTIONABLE', { judged_at: 40 }),
    r(A, 'OUT_OF_SCOPE'),
    r(D, 'ACTIONABLE', { judged_at: 10 }),
    r(D, 'LOW_EFFORT'),
  ]);
  // B and A: 1 actionable, 50%, no low effort; A was accepted first. D has a low-effort report.
  assert.deepEqual(rows.map((x) => x.tester), [A, B, D]);
});

test('earned is rewards plus bonuses, lost is low-effort stakes, all in wei', () => {
  const [row] = rank([r(A, 'ACTIONABLE', { bonus: String(5n * GEN) }), r(A, 'LOW_EFFORT'), r(A, 'FILED')]);
  assert.equal(row.earned, 13n * GEN);
  assert.equal(row.lost, GEN);
  assert.equal(row.filed, 3);
  assert.equal(row.judged, 2);
  assert.equal(row.waiting, 1);
});

test('a waiting report counts as filed, never as judged', () => {
  const [row] = rank([r(A, 'FILED'), r(A, 'FILED')]);
  assert.equal(row.judged, 0);
  assert.equal(row.acceptance_bp, 0);
});

test('one program, or every program but the excluded ones', () => {
  const reports = [r(A, 'ACTIONABLE', { program_id: 1 }), r(B, 'ACTIONABLE', { program_id: 2 }), r(B, 'ACTIONABLE', { program_id: 3 })];
  assert.deepEqual(rank(reports, { program: 1 }).map((x) => x.tester), [A]);
  const all = rank(reports, { exclude: new Set([1]) });
  assert.deepEqual(all.map((x) => [x.tester, x.actionable, x.programs]), [[B, 2, 2]]);
});

test('addresses group without regard to case', () => {
  const rows = rank([r(A, 'ACTIONABLE'), r(A.toUpperCase().replace('0X', '0x'), 'ACTIONABLE')]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].actionable, 2);
});

test('percent never goes through a float', () => {
  assert.equal(percent(10000), '100%');
  assert.equal(percent(6666), '66.66%');
  assert.equal(percent(5005), '50.05%');
  assert.equal(percent(0), '0%');
});

test('the CSV has one header and one row per tester, amounts in wei', () => {
  const csv = toCsv(rank([r(A, 'ACTIONABLE'), r(B, 'LOW_EFFORT')]));
  const lines = csv.trimEnd().split('\r\n');
  assert.equal(lines.length, 3);
  assert.ok(lines[0].startsWith('rank,tester,actionable,judged,acceptance_rate'));
  assert.ok(lines[1].includes(`,${8n * GEN},0,`));
  assert.ok(lines[2].includes(`,0,${GEN},`));
});
