/**
 * The tester leaderboard: every tester's record, ranked, from the reports the
 * contract returns. Plain JavaScript so node:test checks it
 * (leaderboard.test.mjs) and the page, the CSV route and the tests share it.
 *
 * The order is the spec's "ranked by accepted reports and acceptance rate":
 *   1. more ACTIONABLE reports
 *   2. a higher acceptance rate (actionable out of judged)
 *   3. fewer LOW_EFFORT reports
 *   4. the earlier first actionable report
 *   5. the address, so the order never depends on how the rows arrived
 * Rates are integer basis points; amounts stay wei as bigint. Nothing is a float.
 */

/**
 * @param {Array<{tester: string, program_id: number, status: string, reward: string, stake: string, bonus: string, filed_at: number, judged_at: number}>} reports
 * @param {{ program?: number, exclude?: Set<number> }} [options]
 */
export function rank(reports, { program = 0, exclude = new Set() } = {}) {
  const byTester = new Map();
  for (const r of reports) {
    if (program ? r.program_id !== program : exclude.has(r.program_id)) continue;
    const key = String(r.tester).toLowerCase();
    let row = byTester.get(key);
    if (!row) {
      row = {
        tester: r.tester,
        filed: 0,
        judged: 0,
        waiting: 0,
        actionable: 0,
        duplicate: 0,
        out_of_scope: 0,
        low_effort: 0,
        earned: 0n,
        lost: 0n,
        programs: new Set(),
        first_actionable_at: 0,
      };
      byTester.set(key, row);
    }
    row.filed += 1;
    row.programs.add(r.program_id);
    if (r.status === 'FILED') {
      row.waiting += 1;
      continue;
    }
    row.judged += 1;
    if (r.status === 'ACTIONABLE') {
      row.actionable += 1;
      row.earned += BigInt(r.reward) + BigInt(r.bonus || '0');
      if (!row.first_actionable_at || r.judged_at < row.first_actionable_at) row.first_actionable_at = r.judged_at;
    } else if (r.status === 'DUPLICATE') row.duplicate += 1;
    else if (r.status === 'OUT_OF_SCOPE') row.out_of_scope += 1;
    else if (r.status === 'LOW_EFFORT') {
      row.low_effort += 1;
      row.lost += BigInt(r.stake);
    }
  }
  const rows = [...byTester.values()].map((row) => ({
    ...row,
    programs: row.programs.size,
    acceptance_bp: row.judged ? Math.floor((row.actionable * 10000) / row.judged) : 0,
  }));
  rows.sort(
    (a, b) =>
      b.actionable - a.actionable ||
      b.acceptance_bp - a.acceptance_bp ||
      a.low_effort - b.low_effort ||
      (a.first_actionable_at || Infinity) - (b.first_actionable_at || Infinity) ||
      a.tester.toLowerCase().localeCompare(b.tester.toLowerCase()),
  );
  return rows.map((row, i) => ({ rank: i + 1, ...row }));
}

/** "66.66%" from basis points, without a float. */
export function percent(bp) {
  const whole = Math.floor(bp / 100);
  const frac = bp % 100;
  return frac ? `${whole}.${String(frac).padStart(2, '0')}%` : `${whole}%`;
}

const COLUMNS = [
  'rank',
  'tester',
  'actionable',
  'judged',
  'acceptance_rate',
  'duplicate',
  'out_of_scope',
  'low_effort',
  'waiting',
  'earned_wei',
  'lost_wei',
  'programs',
  'first_actionable_at',
];

/** The ranking as CSV, for a campaign's reward or points sheet. */
export function toCsv(rows) {
  const lines = [COLUMNS.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.rank,
        r.tester,
        r.actionable,
        r.judged,
        percent(r.acceptance_bp),
        r.duplicate,
        r.out_of_scope,
        r.low_effort,
        r.waiting,
        r.earned.toString(),
        r.lost.toString(),
        r.programs,
        r.first_actionable_at ? new Date(r.first_actionable_at * 1000).toISOString() : '',
      ].join(','),
    );
  }
  return lines.join('\r\n') + '\r\n';
}
