import Link from 'next/link';

import { Empty, Initials, ReadError, StatusBadge, Tx } from '@/components/ui';
import { txIndex } from '@/lib/explorer';
import { gen, plural } from '@/lib/format';
import { allPrograms, isGolden, listReports, readError } from '@/lib/read';
import type { Program, ReportRow, Verdict } from '@/lib/types';

export const revalidate = 20;

const FAQ = [
  {
    q: 'What counts as low effort?',
    a: 'A report that is vague or generic ("UI could be better"), has no specifics, or is a list of unconnected suggestions with no detail. It is the only label that costs the tester their stake, so the rubric defines it precisely. A short report is not low effort when it is precise, and the language it is written in is never judged.',
  },
  {
    q: 'What about duplicates?',
    a: 'The judge sees the last 25 accepted reports of the program, by id, title and one-line summary. A report that describes the same issue is labelled DUPLICATE with the id it repeats, and the tester gets the stake back, but no reward. Reports are judged in the order they were filed, so a copy can never be judged before the original.',
  },
  {
    q: 'Security bugs?',
    a: 'Never as a report. Reports are public on chain, so a critical vulnerability goes through the program’s private disclosure contact, which the scope names. Triage is for product feedback.',
  },
  {
    q: 'Who decides, and can the team refuse to pay?',
    a: 'The team never judges. Several GenLayer validators apply the same public rubric and must agree on the label, and the reward is reserved from the pool the moment a report is filed, so a team cannot run out of money to avoid paying.',
  },
  {
    q: 'Which network?',
    a: 'GenLayer Studio Next, chain 61997. Every program, report, verdict and payment on this site is read from the contract and links to its transaction on the explorer.',
  },
];

/** The card in the hero: the live program with the most judged reports, and one report of each label. */
function pickQueue(programs: Program[]): Program | null {
  const live = programs.filter((p) => !isGolden(p));
  const pool = live.some((p) => p.judged > 0) ? live : programs;
  return [...pool].sort((a, b) => b.judged - a.judged)[0] ?? null;
}

const ORDER: Verdict[] = ['ACTIONABLE', 'DUPLICATE', 'LOW_EFFORT', 'OUT_OF_SCOPE'];

export default async function Landing() {
  let programs: Program[] = [];
  let recent: ReportRow[] = [];
  let card: ReportRow[] = [];
  let error = '';
  let queue: Program | null = null;
  try {
    programs = await allPrograms();
    recent = (await listReports(0, '', 0, 40)).items;
    queue = pickQueue(programs);
    if (queue) card = (await listReports(queue.id, '', 0, 50)).items;
  } catch (e) {
    error = readError(e);
  }
  const txs = await txIndex();
  const golden = new Set(programs.filter(isGolden).map((p) => p.id));
  const names = new Map(programs.map((p) => [p.id, p.name]));
  const judged = recent.filter((r) => r.status !== 'FILED');
  const live = judged.filter((r) => !golden.has(r.program_id));
  const verdicts = (live.length >= 4 ? live : judged).slice(0, 4);
  const shown = ORDER.map((v) => card.find((r) => r.status === v)).filter((r): r is ReportRow => Boolean(r));

  return (
    <>
      {/* -- hero ----------------------------------------------------------- */}
      <section className="c-wrap grid gap-12 pb-14 pt-14 lg:grid-cols-[1fr_1fr] lg:items-center lg:pt-20">
        <div>
          <p className="c-eyebrow">Feedback triage, judged on GenLayer</p>
          <h1 className="c-h1 mt-5">
            Pay for <em>signal</em>, not noise.
          </h1>
          <p className="c-lead mt-6">
            Teams fund a feedback program and write its scope. Testers stake a little on each report. GenLayer validators
            pay the specific, new, in-scope ones, and farmed noise loses its stake.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/programs" className="c-btn">
              Browse programs
            </Link>
            <Link href="/new" className="c-btn solid">
              Open a program
            </Link>
          </div>
          <p className="c-faint mt-5 text-[13.5px]">Honest duplicates get their stake back. Only low effort loses it.</p>
        </div>

        <div className="c-card overflow-hidden">
          {error ? (
            <div className="p-5">
              <ReadError message={error} />
            </div>
          ) : queue ? (
            <>
              <div className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-4">
                <Initials name={queue.name} />
                <div className="min-w-0 flex-1">
                  <Link href={`/p/${queue.id}`} className="block truncate font-semibold hover:text-[var(--accent-ink)]">
                    {queue.name}
                  </Link>
                  <p className="c-faint mono text-[12px]">
                    reward {gen(queue.reward)} · stake {gen(queue.stake)} · {plural(queue.reports, 'report')}
                  </p>
                </div>
                <span className="c-pill">
                  <span className="dot" />
                  {queue.closed ? 'CLOSED' : 'LIVE'}
                </span>
              </div>
              <dl className="grid grid-cols-3 gap-px bg-[var(--line)]">
                {[
                  [queue.actionable, 'Actionable', true],
                  [queue.duplicate, 'Duplicates', false],
                  [queue.low_effort, 'Low effort', false],
                ].map(([n, label, yes]) => (
                  <div key={String(label)} className="bg-[var(--surface)] px-5 py-4">
                    <dd className={`c-big ${yes ? 'text-[var(--accent)]' : ''}`}>{String(n)}</dd>
                    <dt className="c-eyebrow mt-1">{String(label)}</dt>
                  </div>
                ))}
              </dl>
              <div className="flex flex-col">
                {shown.length ? (
                  shown.map((r) => (
                    <Link key={r.id} href={`/r/${r.id}`} className="c-row-link flex items-center gap-3 border-t border-[var(--line)] px-5 py-3">
                      <span className="w-[150px] shrink-0">
                        <StatusBadge status={r.status} duplicateOf={r.duplicate_of} />
                      </span>
                      <span className={`truncate text-[14.5px] ${r.status === 'LOW_EFFORT' ? 'c-struck' : ''}`}>{r.title}</span>
                    </Link>
                  ))
                ) : (
                  <div className="border-t border-[var(--line)] p-5">
                    <Empty>No report in this program has been judged yet.</Empty>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-5">
              <Empty>No program is open yet. The first one appears here, read from the chain.</Empty>
            </div>
          )}
        </div>
      </section>

      {/* -- recent verdicts ---------------------------------------------- */}
      <section className="c-wrap pb-16">
        <p className="c-eyebrow">Recent verdicts</p>
        {verdicts.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {verdicts.map((r) => (
              <Link key={r.id} href={`/r/${r.id}`} className="c-card block p-4 transition-colors hover:border-[var(--line-strong)]">
                <StatusBadge status={r.status} duplicateOf={r.duplicate_of} />
                <p className={`mt-3 line-clamp-2 text-[14.5px] font-medium ${r.status === 'LOW_EFFORT' ? 'c-struck' : ''}`}>{r.title}</p>
                <p className="c-faint mt-1 truncate text-[12.5px]">{names.get(r.program_id) ?? `Program ${r.program_id}`}</p>
                <p className="mt-2">
                  <Tx hash={txs.judge[String(r.id)]?.hash} label="judged" />
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <Empty>No verdicts yet.</Empty>
          </div>
        )}
      </section>

      {/* -- how it works --------------------------------------------------- */}
      <section id="how" className="c-section">
        <div className="c-wrap">
          <p className="c-eyebrow">How it works</p>
          <h2 className="c-h2 mt-3 max-w-[22em]">Scope, stake, judge, settle.</h2>
          <div className="c-steps mt-8">
            {[
              ['01', 'Scope', 'The team says what it wants feedback on, and what not. The scope is fixed for the life of the program.'],
              ['02', 'Stake', 'Each report carries a small stake, and filing it reserves one reward from the pool.'],
              ['03', 'Judge', 'Validators label it against the scope and the last 25 accepted reports, and must agree on the label.'],
              ['04', 'Settle', 'Reward and stake back, stake back only, or the stake lost to the pool that pays everyone else.'],
            ].map(([n, t, d]) => (
              <div key={n}>
                <p className="mono c-faint text-[12px]">{n}</p>
                <p className="c-h3 mt-3">{t}</p>
                <p className="c-muted mt-2 text-[14.5px] leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -- why the stake stops farming ---------------------------------------- */}
      <section id="stake" className="c-section">
        <div className="c-wrap c-grid-2">
          <div>
            <p className="c-eyebrow">Why the stake stops farming</p>
            <h2 className="c-h2 mt-3">Noise costs money. Honest mistakes do not.</h2>
            <p className="c-lead mt-5">
              A farmer filing thousands of generic reports loses the stake on each one, and every lost stake grows the pool
              that pays real testers. A tester who files an honest duplicate or misreads the scope keeps theirs.
            </p>
            <p className="c-muted mt-4 text-[14.5px]">
              A weekly cap per tester per program, set by the team, limits volume even before the stake does.
            </p>
          </div>
          <div className="c-card overflow-x-auto">
            <table className="c-table">
              <thead>
                <tr>
                  <th>Verdict</th>
                  <th>The stake</th>
                  <th>The reward</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['ACTIONABLE', 'Back to the tester', 'To the tester'],
                    ['DUPLICATE', 'Back to the tester', 'Back to the pool'],
                    ['OUT_OF_SCOPE', 'Back to the tester', 'Back to the pool'],
                    ['LOW_EFFORT', 'To the pool', 'Back to the pool'],
                  ] as [Verdict, string, string][]
                ).map(([v, stake, reward]) => (
                  <tr key={v}>
                    <td>
                      <StatusBadge status={v} />
                    </td>
                    <td className={v === 'LOW_EFFORT' ? 'c-muted' : ''}>{stake}</td>
                    <td className={v === 'ACTIONABLE' ? 'text-[var(--accent-ink)]' : 'c-muted'}>{reward}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* -- for teams ------------------------------------------------------ */}
      <section id="teams" className="c-section">
        <div className="c-wrap">
          <p className="c-eyebrow">For teams</p>
          <h2 className="c-h2 mt-3 max-w-[24em]">Write a scope, fund a pool, get a clean queue.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ['Write a scope', 'Up to 1,200 characters on what you want feedback on, what you exclude, and where security issues go. A new scope means a new program, so testers know the rules cannot move under them.'],
              ['Fund a pool', 'Set a fixed reward per actionable report, the stake, a weekly cap per tester and a duration. Anyone can top the pool up, and lost stakes add to it.'],
              ['Get a clean queue', 'Only actionable reports reach the queue, newest first, with the duplicates linked and the noise struck through. Export it for your tracker, tip a bonus for an important one, and close the program to take back what is left.'],
            ].map(([t, d]) => (
              <div key={t} className="c-card pad">
                <p className="c-h3">{t}</p>
                <p className="c-muted mt-2 text-[14.5px] leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/new" className="c-btn solid">
              Open a program
            </Link>
            <Link href="/docs/open-a-program" className="c-btn ghost">
              Read how
            </Link>
          </div>
        </div>
      </section>

      {/* -- faq ------------------------------------------------------------ */}
      <section id="faq" className="c-section">
        <div className="c-wrap c-grid-2">
          <div>
            <p className="c-eyebrow">FAQ</p>
            <h2 className="c-h2 mt-3">Questions teams and testers ask.</h2>
          </div>
          <div className="flex flex-col">
            {FAQ.map((f) => (
              <details key={f.q} className="border-b border-[var(--line)] py-4">
                <summary className="cursor-pointer text-[16px] font-medium">{f.q}</summary>
                <p className="c-muted mt-2 text-[14.5px] leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
