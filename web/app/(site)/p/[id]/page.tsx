import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CapLeft, FundBox, JudgeNext, TeamBox } from '@/components/ProgramActions';
import { Addr, Empty, Initials, KindTag, ReadError, StatusBadge, Tx } from '@/components/ui';
import { txIndex } from '@/lib/explorer';
import { day, dayTime, gen, plural } from '@/lib/format';
import { FILTERS } from '@/lib/labels';
import { allReports, getProgram, getReport, readError } from '@/lib/read';
import type { Program, ReportPage, Status } from '@/lib/types';

export const revalidate = 20;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const p = await getProgram(Number(id));
    if (p.found) return { title: p.name, description: p.scope.slice(0, 180) };
  } catch {
    /* fall through */
  }
  return { title: `Program ${id}` };
}

/** "2 h", "1 d": how long ago, from the server's clock. */
function ago(seconds: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - seconds);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
}

function count(p: Program, status: Status): number {
  return { ACTIONABLE: p.actionable, DUPLICATE: p.duplicate, OUT_OF_SCOPE: p.out_of_scope, LOW_EFFORT: p.low_effort, FILED: p.waiting }[status];
}

export default async function ProgramPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string }> }) {
  const { id: raw } = await params;
  const { status: wanted } = await searchParams;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) notFound();
  const status = (FILTERS.find((f) => f.status === String(wanted ?? '').toUpperCase())?.status ?? 'ACTIONABLE') as Status;

  let p: Program | null = null;
  let page: ReportPage | null = null;
  let nextTitle = '';
  let error = '';
  try {
    const got = await getProgram(id);
    if (!got.found) notFound();
    p = got;
    page = await allReports(id, status);
    if (p.next_to_judge) {
      const next = await getReport(p.next_to_judge);
      if (next.found) nextTitle = next.title;
    }
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith('NEXT_')) throw e;
    error = readError(e);
  }
  if (error || !p || !page) {
    return (
      <div className="c-wrap py-14">
        <ReadError message={error || 'The program could not be read.'} />
      </div>
    );
  }
  const txs = await txIndex();
  const ended = Date.now() / 1000 >= p.ends_at;
  const pct = p.judged ? Math.round((p.actionable * 100) / p.judged) : 0;

  return (
    <div className="c-wrap py-12">
      {/* -- terms in one line --------------------------------------------- */}
      <div className="flex flex-wrap items-start gap-4">
        <Initials name={p.name} size={48} />
        <div className="min-w-0 flex-1">
          <h1 className="c-h2">{p.name}</h1>
          <p className="c-muted mt-2 text-[14.5px]">
            {p.closed ? `closed ${day(p.closed_at)}` : `${ended ? 'ended' : 'runs to'} ${p.trial ? dayTime(p.ends_at) : day(p.ends_at)}`}
            {p.trial ? ' (one-hour trial)' : ''} · {gen(p.reward)} reward · {gen(p.stake)} stake · {plural(p.weekly_cap, 'report')} a week per tester
          </p>
          <p className="c-faint mt-1 text-[13px]">
            Opened by <Addr address={p.team} /> {txs.program[String(p.id)] && <Tx hash={txs.program[String(p.id)].hash} label="tx" />}
          </p>
        </div>
        {!p.closed && !ended && (
          <Link href={`/p/${p.id}/report`} className="c-btn solid">
            File a report
          </Link>
        )}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {/* -- the scope ------------------------------------------------- */}
          <div className="c-card pad">
            <p className="c-eyebrow">Scope</p>
            <p className="c-text mt-3">{p.scope}</p>
            <p className="c-faint mt-4 text-[12.5px]">
              Fixed for the life of the program. Reports are public: a security vulnerability goes to the private contact
              the scope names, never here.
            </p>
          </div>

          {/* -- the queue and the full record ------------------------------- */}
          <div className="mt-8 flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <Link key={f.status} href={`/p/${p.id}?status=${f.status}`} className="c-tab" aria-current={f.status === status ? 'page' : undefined} scroll={false}>
                {f.label} <span className="mono c-faint">{count(p, f.status)}</span>
              </Link>
            ))}
            <span className="ml-auto flex gap-2">
              <a className="c-btn small ghost" href={`/api/export/${p.id}?format=csv`} download={`triage-program-${p.id}-queue.csv`}>
                Export CSV
              </a>
              <a className="c-btn small ghost" href={`/api/export/${p.id}`} download={`triage-program-${p.id}-queue.json`}>
                JSON
              </a>
            </span>
          </div>
          <div className="c-card mt-3">
            {page.items.length ? (
              page.items.map((r) => (
                <Link key={r.id} href={`/r/${r.id}`} className="c-row-link grid grid-cols-[52px_minmax(0,1fr)_auto] gap-3 border-b border-[var(--line)] px-4 py-3 last:border-b-0">
                  <span className="mono c-faint pt-0.5 text-[13px]">#{r.id}</span>
                  <span className="min-w-0">
                    <span className={`block truncate font-medium ${r.status === 'LOW_EFFORT' ? 'c-struck' : ''}`}>{r.title}</span>
                    <span className="c-muted block truncate text-[13.5px]">
                      {r.status === 'DUPLICATE' ? `Repeats #${r.duplicate_of}. ` : ''}
                      {r.summary || (r.status === 'FILED' ? 'Waiting for the judge.' : '')}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1.5">
                    <span className="flex items-center gap-2">
                      <KindTag kind={r.kind} />
                      {r.bonus !== '0' && <span className="c-verdict yes">+{gen(r.bonus, false)} bonus</span>}
                      {status !== 'ACTIONABLE' && <StatusBadge status={r.status} duplicateOf={r.duplicate_of} />}
                    </span>
                    <span className="mono c-faint text-[12px]">{ago(r.filed_at)}</span>
                  </span>
                </Link>
              ))
            ) : (
              <div className="p-4">
                <Empty>
                  {status === 'ACTIONABLE'
                    ? 'No report has been judged actionable yet. The queue fills as validators accept reports.'
                    : 'Nothing here yet.'}
                </Empty>
              </div>
            )}
          </div>
          <p className="c-faint mt-3 text-[12.5px]">
            {status === 'ACTIONABLE' ? 'Only actionable reports, newest first. ' : 'Newest first. '}
            Validators compared each one with the scope and the last 25 accepted reports.
          </p>
        </div>

        {/* -- the pool, honestly ------------------------------------------- */}
        <aside className="flex flex-col gap-4">
          <div className="c-card pad">
            <p className="c-eyebrow">Pool</p>
            <p className="c-big mt-2">{gen(p.pool)}</p>
            <p className="c-muted mt-2 text-[13.5px] leading-relaxed">
              {gen(p.funded)} funded, plus {gen(p.lost)} from lost stakes, less {gen(p.paid)} paid
              {p.returned !== '0' ? `, ${gen(p.returned)} returned to the team` : ''} and {gen(p.reserved)} reserved for{' '}
              {plural(p.waiting, 'report')} in judging.
            </p>
            {p.bonuses !== '0' && <p className="c-faint mt-2 text-[12.5px]">Bonuses tipped on top: {gen(p.bonuses)}.</p>}
          </div>
          <div className="c-card">
            <p className="c-eyebrow px-5 pt-4">This program</p>
            <dl className="mt-2">
              {[
                ['Reports', String(p.reports)],
                ['Actionable', `${p.actionable}${p.judged ? `, ${pct}% of judged` : ''}`],
                ['Paid to testers', gen(p.paid)],
                ['Lost to the pool', gen(p.lost)],
                ['Distinct testers', String(p.testers)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 border-t border-[var(--line)] px-5 py-2.5 text-[14px]">
                  <dt className="c-muted">{k}</dt>
                  <dd className="mono">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          {!p.closed && !ended && (
            <div className="flex flex-col gap-1.5">
              <Link href={`/p/${p.id}/report`} className="c-btn solid wide">
                File a report
              </Link>
              <CapLeft program={p} />
            </div>
          )}
          <JudgeNext program={p} title={nextTitle} />
          <TeamBox program={p} />
          <FundBox program={p} />
          {p.funding_log.length > 0 && (
            <div className="c-card pad">
              <p className="c-eyebrow">Funding</p>
              <ul className="mt-2 flex flex-col gap-1.5 text-[13px]">
                {p.funding_log.map((f) => (
                  <li key={f.n} className="flex items-baseline justify-between gap-3">
                    <Addr address={f.funder} />
                    <span className="mono">{gen(f.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
