'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { dayTime, gen } from '@/lib/format';
import type { TesterStats } from '@/lib/types';

import { TxProgress, readFresh, useWrite } from './Actions';
import { KindTag, StatusBadge } from './ui';
import { WalletGate } from './Wallet';

/** The tester page: read fresh from the browser for the connected wallet, never from the shared cache. */
export function MePanel() {
  const { w, state, busy, run } = useWrite([]);
  const [stats, setStats] = useState<TesterStats | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!w.account) return;
    try {
      setStats(await readFresh<TesterStats>('tester_stats', [w.account]));
      setError('');
    } catch {
      setError('Studio Next did not answer this read. Try again in a moment.');
    }
  }, [w.account]);

  useEffect(() => {
    setStats(null);
    load();
  }, [load]);

  useEffect(() => {
    if (state.phase === 'done') load();
  }, [state.phase, load]);

  async function withdraw() {
    await run('withdraw', [], 0n);
  }

  const rate = stats && stats.judged ? Math.round((stats.actionable * 100) / stats.judged) : null;

  return (
    <WalletGate action="see your reports">
      {error && <div className="c-note">{error}</div>}
      {!stats ? (
        <div className="c-note flex items-center gap-2">
          <span className="c-spin" /> Reading your record from the chain…
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <dl className="c-kv c-card overflow-hidden">
              {[
                ['Filed', String(stats.filed)],
                ['Actionable', String(stats.actionable)],
                ['Acceptance rate', rate === null ? '—' : `${rate}%`],
                ['Earned', gen(stats.earned)],
                ['Duplicates', String(stats.duplicate)],
                ['Out of scope', String(stats.out_of_scope)],
                ['Low effort', String(stats.low_effort)],
                ['Stakes lost', gen(stats.lost)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dd className="mono">{v}</dd>
                  <dt>{k}</dt>
                </div>
              ))}
            </dl>
            <p className="c-faint mt-2 text-[12.5px]">
              Acceptance rate is actionable reports out of judged ones. Campaigns can use it as a fair input to rewards.
            </p>
            <div className="c-card mt-6">
              {stats.items.length ? (
                stats.items.map((r) => (
                  <Link key={r.id} href={`/r/${r.id}`} className="c-row-link grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--line)] px-4 py-3 last:border-b-0">
                    <span className="mono c-faint text-[13px]">#{r.id}</span>
                    <span className="min-w-0">
                      <span className={`block truncate font-medium ${r.status === 'LOW_EFFORT' ? 'c-struck' : ''}`}>{r.title}</span>
                      <span className="c-faint block text-[12.5px]">
                        program {r.program_id} · {dayTime(r.filed_at)}
                        {r.credited !== '0' ? ` · ${gen(r.credited)} credited` : ''}
                        {r.bonus !== '0' ? ` · ${gen(r.bonus)} bonus` : ''}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <KindTag kind={r.kind} />
                      <StatusBadge status={r.status} duplicateOf={r.duplicate_of} />
                    </span>
                  </Link>
                ))
              ) : (
                <div className="p-4">
                  <div className="c-note">
                    No reports from this wallet yet.{' '}
                    <Link className="c-link" href="/programs">
                      Pick a program
                    </Link>{' '}
                    and read its scope.
                  </div>
                </div>
              )}
            </div>
          </div>
          <aside className="flex flex-col gap-4">
            <div className="c-card pad">
              <p className="c-eyebrow">Balance</p>
              <p className="c-big mt-2 text-[var(--accent)]">{gen(stats.balance)}</p>
              <p className="c-muted mt-2 text-[13.5px]">
                Withdrawn so far: {gen(stats.withdrawn)}. Withdraw sends the whole balance to this wallet in its own
                transaction; the GEN arrives when the transaction is final.
              </p>
              <button className="c-btn solid wide mt-4" disabled={busy || stats.balance === '0'} onClick={withdraw}>
                Withdraw {gen(stats.balance)}
              </button>
              <div className="mt-3">
                <TxProgress state={state} waiting="Validators are recording the withdrawal" />
              </div>
            </div>
          </aside>
        </div>
      )}
    </WalletGate>
  );
}
