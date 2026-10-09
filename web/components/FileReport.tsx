'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { gen } from '@/lib/format';
import { KIND_LABEL, weekOf } from '@/lib/labels';
import type { Kind, Program, TesterStats } from '@/lib/types';

import { TxProgress, readFresh, useWrite } from './Actions';
import { StatusBadge } from './ui';
import { WalletGate } from './Wallet';

const MAX_TITLE = 100;
const MAX_BODY = 1500;

/** The structure every good report of each kind has. Each field becomes one labelled line of the body. */
const FIELDS: Record<Kind, { key: string; label: string; hint: string; rows: number }[]> = {
  bug: [
    { key: 'Steps', label: 'Steps to reproduce', hint: '1. Open swap on Base, USDC to ETH, 25 USDC. 2. Approve USDC, wait for confirmation. 3. …', rows: 4 },
    { key: 'Expected', label: 'Expected', hint: 'The button enables after the approval confirms.', rows: 2 },
    { key: 'Actual', label: 'Actual', hint: 'It stays disabled until the page is reloaded.', rows: 2 },
    { key: 'Environment', label: 'Environment', hint: 'Chrome 128, macOS 15, web app, reproduced twice.', rows: 1 },
  ],
  usability: [
    { key: 'Problem', label: 'What gets in the way', hint: 'On a 375 px screen the Max button sits under the keyboard.', rows: 3 },
    { key: 'Where', label: 'Where it happens', hint: 'Approval dialog, mobile app 2.4.1, iPhone SE.', rows: 1 },
    { key: 'Why it matters', label: 'Why it matters', hint: 'There is no way to approve the full balance without closing the keyboard.', rows: 2 },
  ],
  idea: [
    { key: 'Problem', label: 'The concrete problem', hint: 'Slippage resets to 0.5% when switching chains; two swaps failed this week.', rows: 3 },
    { key: 'Idea', label: 'The idea', hint: 'Remember the last slippage value per chain.', rows: 2 },
    { key: 'Why', label: 'Why it helps', hint: 'Switching chains would no longer silently change a setting that makes swaps fail.', rows: 2 },
  ],
};

export function composeBody(kind: Kind, values: Record<string, string>): string {
  return FIELDS[kind]
    .map((f) => [f.key, (values[f.key] ?? '').trim()] as const)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

type Accepted = { id: number; title: string; summary: string };

/** A title search over accepted reports: a hint for honest testers, not the judge. */
function similar(title: string, accepted: Accepted[]): Accepted[] {
  const words = title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);
  if (!words.length) return [];
  return accepted
    .map((a) => {
      const hay = `${a.title} ${a.summary}`.toLowerCase();
      return { a, hits: words.filter((w) => hay.includes(w)).length };
    })
    .filter((x) => x.hits > 0)
    .sort((x, y) => y.hits - x.hits)
    .slice(0, 4)
    .map((x) => x.a);
}

export function FileReport({ program, accepted }: { program: Program; accepted: Accepted[] }) {
  const router = useRouter();
  const { w, state, busy, run } = useWrite([`program:${program.id}`]);
  const [kind, setKind] = useState<Kind>('bug');
  const [title, setTitle] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [used, setUsed] = useState<number | null>(null);

  const body = composeBody(kind, values);
  const near = useMemo(() => similar(title, accepted), [title, accepted]);
  const tooLong = title.length > MAX_TITLE || body.length > MAX_BODY;
  const isTeam = w.account && w.account.toLowerCase() === program.team.toLowerCase();

  useEffect(() => {
    if (!w.account) return;
    let live = true;
    readFresh<TesterStats>('tester_stats', [w.account])
      .then((s) => {
        const week = weekOf(Math.floor(Date.now() / 1000));
        if (live) setUsed(s.items.filter((r) => r.program_id === program.id && r.week === week).length);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [w.account, program.id, state.phase]);

  async function file() {
    const done = await run('submit', [program.id, kind, title.trim(), body], BigInt(program.stake));
    if (done.phase === 'done' && typeof done.returned === 'number') router.push(`/r/${done.returned}?filed=1`);
    else if (done.phase === 'done' && done.returned !== undefined) router.push(`/r/${Number(done.returned)}?filed=1`);
  }

  const left = used === null ? null : Math.max(0, program.weekly_cap - used);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Kind of report">
          {(Object.keys(FIELDS) as Kind[]).map((k) => (
            <button key={k} role="tab" aria-selected={kind === k} className="c-tab" onClick={() => setKind(k)}>
              {KIND_LABEL[k]}
            </button>
          ))}
          <span className="c-faint ml-auto text-[13px]">
            {left === null ? `${program.weekly_cap} reports a week per tester` : `${left} of ${program.weekly_cap} reports left this week`}
          </span>
        </div>

        <div className="c-card pad mt-4 flex flex-col gap-4">
          <div>
            <label className="c-label" htmlFor="title">
              Title
            </label>
            <input id="title" className="c-input" value={title} maxLength={MAX_TITLE + 20} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'bug' ? 'Swap button stays disabled after approving USDC' : kind === 'usability' ? 'Approval amount field hides the Max button on small screens' : 'Remember the last slippage setting per chain'} />
            <p className={`mt-1 text-[12px] ${title.length > MAX_TITLE ? 'text-[var(--danger)]' : 'c-faint'}`}>
              {title.length} / {MAX_TITLE}
            </p>
          </div>
          {FIELDS[kind].map((f) => (
            <div key={f.key}>
              <label className="c-label" htmlFor={f.key}>
                {f.label}
              </label>
              {f.rows > 1 ? (
                <textarea id={f.key} className="c-textarea" style={{ minHeight: f.rows * 30 + 30 }} value={values[f.key] ?? ''} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} placeholder={f.hint} />
              ) : (
                <input id={f.key} className="c-input" value={values[f.key] ?? ''} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} placeholder={f.hint} />
              )}
            </div>
          ))}
          <p className={`text-[12px] ${body.length > MAX_BODY ? 'text-[var(--danger)]' : 'c-faint'}`}>
            The report as filed: {body.length} / {MAX_BODY} characters. Specific steps and results are what make a report
            actionable; the language you write in is never judged.
          </p>
        </div>

        <div className="c-note mt-4">
          Reports are public on chain. A security vulnerability goes to the private contact the scope names, never here.
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {isTeam ? (
            <div className="c-note">This wallet opened the program. The team cannot file reports in its own program.</div>
          ) : (
            <WalletGate action="file a report">
              <div className="flex flex-wrap items-center gap-3">
                <button className="c-btn solid" disabled={busy || !title.trim() || !body || tooLong || left === 0} onClick={file}>
                  File with {gen(program.stake)} stake
                </button>
                <span className="c-faint text-[13px]">plus the network fee deposit, estimated before you sign</span>
              </div>
            </WalletGate>
          )}
          <TxProgress state={state} waiting="Validators are recording your report" />
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        <div className="c-card">
          <p className="c-eyebrow px-5 pt-4">What happens to your {gen(program.stake)}</p>
          <div className="mt-2">
            {(
              [
                ['ACTIONABLE', `${gen(program.stake)} back plus ${gen(program.reward)}`],
                ['DUPLICATE', `${gen(program.stake)} back, linked`],
                ['OUT_OF_SCOPE', `${gen(program.stake)} back`],
                ['LOW_EFFORT', `${gen(program.stake)} to the pool`],
              ] as const
            ).map(([v, text]) => (
              <div key={v} className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-5 py-2.5">
                <StatusBadge status={v} />
                <span className={`text-right text-[13.5px] ${v === 'ACTIONABLE' ? 'text-[var(--accent-ink)]' : 'c-muted'}`}>{text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="c-card pad">
          <p className="c-eyebrow">Similar accepted reports</p>
          {near.length ? (
            <ul className="mt-3 flex flex-col gap-2 text-[14px]">
              {near.map((a) => (
                <li key={a.id}>
                  <Link href={`/r/${a.id}`} className="hover:text-[var(--accent-ink)]" target="_blank">
                    <span className="mono c-faint mr-2 text-[12.5px]">#{a.id}</span>
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="c-muted mt-2 text-[13.5px]">{title.trim() ? 'No accepted report shares a word with this title.' : 'Type a title to search the accepted reports.'}</p>
          )}
          <p className="c-faint mt-3 text-[12.5px]">Search by title, a hint, not the judge. The judge reads the last 25 accepted reports in full.</p>
        </div>
      </aside>
    </div>
  );
}
