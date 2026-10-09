'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { gen, toWei } from '@/lib/format';

import { TxProgress, useWrite } from './Actions';
import { WalletGate } from './Wallet';

const MAX_NAME = 80;
const MAX_SCOPE = 1200;

const EXAMPLE =
  'Swaps, token approvals and the fee preview on Base and Arbitrum, in the web and mobile apps. Not in scope: partner bridges, price feeds, and anything about the token or airdrop. Security issues go to security@yourteam.example, never here.';

export function OpenProgramForm() {
  const router = useRouter();
  const { state, busy, run } = useWrite([]);
  const [name, setName] = useState('');
  const [scope, setScope] = useState('');
  const [reward, setReward] = useState('8');
  const [stake, setStake] = useState('1');
  const [cap, setCap] = useState('5');
  const [days, setDays] = useState('14');
  const [funding, setFunding] = useState('100');

  const rewardWei = toWei(reward);
  const stakeWei = toWei(stake);
  const fundingWei = toWei(funding);
  const capN = Number(cap);
  const daysN = Number(days);
  const problems = [
    !name.trim() && 'Name the program.',
    name.length > MAX_NAME && `The name is longer than ${MAX_NAME} characters.`,
    !scope.trim() && 'Write the scope.',
    scope.length > MAX_SCOPE && `The scope is longer than ${MAX_SCOPE} characters.`,
    (!rewardWei || rewardWei <= 0n) && 'The reward must be above zero.',
    (!stakeWei || stakeWei <= 0n) && 'The stake must be above zero.',
    !(Number.isInteger(capN) && capN >= 1 && capN <= 20) && 'The weekly cap is a whole number from 1 to 20.',
    !(Number.isInteger(daysN) && daysN >= 0 && daysN <= 120) && 'The duration is a whole number of days from 0 (a one-hour trial) to 120.',
    rewardWei && fundingWei !== null && fundingWei < rewardWei && 'The first funding must cover at least one reward.',
  ].filter(Boolean) as string[];
  const reports = rewardWei && fundingWei && rewardWei > 0n ? fundingWei / rewardWei : 0n;

  async function open() {
    const done = await run('open_program', [name.trim(), scope.trim(), rewardWei, stakeWei, capN, daysN], fundingWei ?? 0n);
    if (done.phase === 'done' && done.returned !== undefined) router.push(`/p/${Number(done.returned)}`);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="c-card pad flex flex-col gap-5">
        <div>
          <label className="c-label" htmlFor="name">
            Program name
          </label>
          <input id="name" className="c-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Orrin Wallet beta" />
        </div>
        <div>
          <label className="c-label" htmlFor="scope">
            Scope
          </label>
          <textarea id="scope" className="c-textarea" style={{ minHeight: 170 }} value={scope} onChange={(e) => setScope(e.target.value)} placeholder={EXAMPLE} />
          <p className={`mt-1 text-[12px] ${scope.length > MAX_SCOPE ? 'text-[var(--danger)]' : 'c-faint'}`}>
            {scope.length} / {MAX_SCOPE}
          </p>
          <ul className="c-muted mt-2 list-disc pl-5 text-[13.5px] leading-relaxed">
            <li>Name what you want feedback on: the features, the platforms, the networks.</li>
            <li>Name what is excluded. Validators label anything outside the scope OUT OF SCOPE, and the tester keeps the stake.</li>
            <li>Say where security issues go. Reports are public, so they must never be filed here.</li>
            <li>The scope cannot change during the program. A new scope means a new program.</li>
          </ul>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ['reward', 'Reward per actionable report (GEN)', reward, setReward],
              ['stake', 'Stake per report (GEN)', stake, setStake],
              ['cap', 'Reports per tester per week', cap, setCap],
              ['days', 'Duration in days (0 = one-hour trial)', days, setDays],
            ] as const
          ).map(([id, label, value, set]) => (
            <div key={id}>
              <label className="c-label" htmlFor={id}>
                {label}
              </label>
              <input id={id} className="c-input mono" value={value} onChange={(e) => set(e.target.value)} inputMode="decimal" />
            </div>
          ))}
        </div>
        <div>
          <label className="c-label" htmlFor="funding">
            First funding (GEN)
          </label>
          <input id="funding" className="c-input mono" value={funding} onChange={(e) => setFunding(e.target.value)} inputMode="decimal" />
          <p className="c-faint mt-1 text-[12.5px]">Covers {reports.toString()} actionable report{reports === 1n ? '' : 's'} at this reward. Anyone can top the pool up later.</p>
        </div>
        {problems.length > 0 && (
          <ul className="c-faint text-[13px]">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <WalletGate action="open a program">
          <button className="c-btn solid" disabled={busy || problems.length > 0} onClick={open}>
            Open with {fundingWei ? gen(fundingWei) : '0 GEN'}
          </button>
        </WalletGate>
        <TxProgress state={state} waiting="Validators are recording the program" />
      </div>
      <aside className="flex flex-col gap-4">
        <div className="c-card pad">
          <p className="c-eyebrow">How the money moves</p>
          <ul className="c-muted mt-3 flex flex-col gap-2 text-[13.5px] leading-relaxed">
            <li>Each filed report reserves one reward from the pool, so a report is never judged against an empty pool.</li>
            <li>Actionable: the tester gets the stake back plus the reward.</li>
            <li>Duplicate or out of scope: the stake goes back, the reward returns to the pool.</li>
            <li>Low effort: the stake joins the pool.</li>
            <li>You never judge. Validators do, against your scope and the last 25 accepted reports.</li>
            <li>Once the program ends and every report is judged, closing returns the unused pool to you.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
