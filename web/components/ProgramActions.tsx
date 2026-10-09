'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { dayTime, gen, toWei } from '@/lib/format';
import { weekOf } from '@/lib/labels';
import type { Program, TesterStats } from '@/lib/types';

import { TxProgress, readFresh, useWrite } from './Actions';
import { WalletGate, useWallet } from './Wallet';

/** Anyone tops up a running program's pool. */
export function FundBox({ program }: { program: Program }) {
  const { state, busy, run } = useWrite([`program:${program.id}`]);
  const [amount, setAmount] = useState('');
  const wei = toWei(amount);
  if (program.closed || Date.now() / 1000 >= program.ends_at) return null;
  return (
    <div className="c-card pad flex flex-col gap-2">
      <p className="c-eyebrow">Top up the pool</p>
      <WalletGate action="top up this pool">
        <div className="flex gap-2">
          <input className="c-input mono" placeholder="GEN, e.g. 40" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" aria-label="GEN to add" />
          <button className="c-btn" disabled={busy || !wei || wei <= 0n} onClick={async () => (await run('fund', [program.id], wei ?? 0n)).phase === 'done' && setAmount('')}>
            Fund
          </button>
        </div>
      </WalletGate>
      <p className="c-faint text-[12.5px]">Anyone can top up. What is left when the program closes goes back to the team.</p>
      <TxProgress state={state} waiting="Validators are recording the funding" />
    </div>
  );
}

/**
 * Reports are judged in filing order. Anyone may ask the validators to judge
 * the next one, so a report can never sit unjudged because the team or the
 * tester walked away.
 */
export function JudgeNext({ program, title }: { program: Program; title?: string }) {
  const { state, busy, run } = useWrite([`program:${program.id}`, `report:${program.next_to_judge}`]);
  if (!program.next_to_judge) return null;
  return (
    <div className="c-card pad flex flex-col gap-2">
      <p className="c-eyebrow">
        {program.waiting} report{program.waiting === 1 ? '' : 's'} waiting for the judge
      </p>
      <p className="c-muted text-[13.5px]">
        Next in filing order:{' '}
        <Link className="c-link" href={`/r/${program.next_to_judge}`}>
          #{program.next_to_judge}
          {title ? ` ${title}` : ''}
        </Link>
        . Anyone may ask; the network fee is the only cost.
      </p>
      <WalletGate action="ask the validators">
        <button className="c-btn wide" disabled={busy} onClick={() => run('judge', [program.next_to_judge])}>
          Judge #{program.next_to_judge}
        </button>
      </WalletGate>
      <TxProgress state={state} waiting="Validators are triaging" />
    </div>
  );
}

/** Close, for the team's wallet only, once the program has ended and nothing is waiting. */
export function TeamBox({ program }: { program: Program }) {
  const w = useWallet();
  const { state, busy, run } = useWrite([`program:${program.id}`]);
  if (!w.account || w.account.toLowerCase() !== program.team.toLowerCase() || program.closed) return null;
  const ended = Date.now() / 1000 >= program.ends_at;
  return (
    <div className="c-card pad flex flex-col gap-3">
      <p className="c-eyebrow">You run this program</p>
      <p className="c-muted text-[13.5px]">
        Tip a bonus from any actionable report&apos;s page. Closing returns the unused pool, {gen(program.pool)}, to you.{' '}
        {!ended
          ? `It opens when the program ends, ${dayTime(program.ends_at)}.`
          : program.waiting
            ? `Judge the ${program.waiting} waiting report${program.waiting === 1 ? '' : 's'} first.`
            : 'The program has ended and nothing is waiting.'}
      </p>
      <WalletGate action="close the program">
        <button className="c-btn wide ghost" disabled={busy || !ended || program.waiting > 0} onClick={() => run('close', [program.id])}>
          Close the program
        </button>
      </WalletGate>
      <TxProgress state={state} waiting="Validators are recording the close" />
    </div>
  );
}

/** For a connected wallet: how many reports it may still file in this program this week, read fresh from the chain. */
export function CapLeft({ program }: { program: Program }) {
  const w = useWallet();
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!w.account) {
      setLeft(null);
      return;
    }
    let live = true;
    readFresh<TesterStats>('tester_stats', [w.account])
      .then((s) => {
        const week = weekOf(Math.floor(Date.now() / 1000));
        const used = s.items.filter((r) => r.program_id === program.id && r.week === week).length;
        if (live) setLeft(Math.max(0, program.weekly_cap - used));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [w.account, program.id, program.weekly_cap]);
  return (
    <p className="c-faint text-center text-[12.5px]">
      {left === null ? `${program.weekly_cap} reports a week per tester` : `${left} of ${program.weekly_cap} reports left this week for your wallet`}
    </p>
  );
}
