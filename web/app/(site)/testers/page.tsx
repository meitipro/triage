import type { Metadata } from 'next';
import Link from 'next/link';

import { Addr, Empty, ReadError } from '@/components/ui';
import { gen, plural } from '@/lib/format';
import { percent, rank } from '@/lib/leaderboard.mjs';
import { allPrograms, allReports, isGolden, readError } from '@/lib/read';
import type { Program, ReportRow } from '@/lib/types';

export const revalidate = 20;
export const metadata: Metadata = {
  title: 'Testers',
  description: 'Testers ranked by accepted reports and acceptance rate, read from the contract, with a CSV for campaign rewards.',
};

export default async function Testers({ searchParams }: { searchParams: Promise<{ program?: string }> }) {
  const { program: raw } = await searchParams;
  const program = Number(raw) > 0 ? Number(raw) : 0;
  let programs: Program[] = [];
  let reports: ReportRow[] = [];
  let error = '';
  try {
    programs = await allPrograms();
    reports = (await allReports(0, '')).items;
  } catch (e) {
    error = readError(e);
  }
  const golden = new Set(programs.filter(isGolden).map((p) => p.id));
  const rows = rank(reports, { program, exclude: golden });
  const chosen = programs.find((p) => p.id === program);
  const csv = `/api/testers${program ? `?program=${program}&` : '?'}format=csv`;

  return (
    <div className="c-wrap py-12">
      <p className="c-eyebrow">For campaigns</p>
      <h1 className="c-h2 mt-2">Testers</h1>
      <p className="c-lead mt-3">
        Every tester, ranked by accepted reports and then by acceptance rate, read from the contract. A fair input to
        campaign rewards or points: farming lowers a tester&apos;s rate, and only validators decide what counts.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Link href="/testers" className="c-tab" aria-current={program === 0 ? 'page' : undefined}>
          All programs
        </Link>
        {programs
          .filter((p) => !isGolden(p))
          .map((p) => (
            <Link key={p.id} href={`/testers?program=${p.id}`} className="c-tab" aria-current={p.id === program ? 'page' : undefined}>
              {p.name}
            </Link>
          ))}
        <a className="c-btn small ghost ml-auto" href={csv} download>
          Export CSV
        </a>
      </div>

      <div className="mt-4">
        {error ? (
          <ReadError message={error} />
        ) : rows.length ? (
          <div className="c-card overflow-x-auto">
            <table className="c-table min-w-[760px]">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tester</th>
                  <th>Actionable</th>
                  <th>Acceptance</th>
                  <th>Duplicate</th>
                  <th>Out of scope</th>
                  <th>Low effort</th>
                  <th>Earned</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.tester}>
                    <td className="mono c-faint">{row.rank}</td>
                    <td>
                      <Addr address={row.tester} />
                      {row.waiting > 0 && <span className="c-faint ml-2 text-[12px]">{row.waiting} waiting</span>}
                    </td>
                    <td className="mono text-[var(--accent-ink)]">{row.actionable}</td>
                    <td className="mono">
                      {row.judged ? percent(row.acceptance_bp) : '—'}
                      <span className="c-faint text-[12px]"> of {row.judged}</span>
                    </td>
                    <td className="mono">{row.duplicate}</td>
                    <td className="mono">{row.out_of_scope}</td>
                    <td className={`mono ${row.low_effort ? 'c-struck' : ''}`}>{row.low_effort}</td>
                    <td className="mono">{gen(row.earned)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No reports {chosen ? `in ${chosen.name}` : ''} yet.</Empty>
        )}
      </div>
      <p className="c-faint mt-3 text-[12.5px]">
        {plural(rows.length, 'tester')}
        {chosen ? ` in ${chosen.name}` : ' across every program, the evaluation set aside'}. Acceptance is actionable reports out
        of judged ones; earned is rewards plus bonuses. Ties go to fewer low-effort reports, then to the earlier first
        accepted report.
      </p>
    </div>
  );
}
