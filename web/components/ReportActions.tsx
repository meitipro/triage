'use client';

import Link from 'next/link';
import { useState } from 'react';

import { gen, toWei } from '@/lib/format';
import type { Report } from '@/lib/types';

import { TxProgress, useWrite } from './Actions';
import { WalletGate, useWallet } from './Wallet';

/**
 * Ask the validators. Reports are judged in filing order, so when an earlier
 * report is still waiting, the button judges that one first and says so.
 */
export function JudgeBox({ report, filed }: { report: Report; filed: boolean }) {
  const target = report.next_to_judge || report.id;
  const { state, busy, run } = useWrite([`report:${report.id}`, `report:${target}`, `program:${report.program_id}`]);
  const mine = target === report.id;
  return (
    <div className="c-card pad flex flex-col gap-3">
      {filed && mine && <p className="font-medium">Your report is filed and its reward is reserved. One more signature asks the validators to triage it.</p>}
      {mine ? (
        <p className="c-muted text-[14px]">
          This report is next in its program&apos;s queue. Anyone may ask the validators; it takes about a minute and only
          the network fee.
        </p>
      ) : (
        <p className="c-muted text-[14px]">
          Reports are judged in the order they were filed, so a copy can never be judged before its original.{' '}
          <Link className="c-link" href={`/r/${target}`}>
            Report #{target}
          </Link>{' '}
          was filed earlier in this program and is judged first.
        </p>
      )}
      <WalletGate action="ask the validators">
        <button className="c-btn solid" disabled={busy} onClick={() => run('judge', [target])}>
          {mine ? 'Ask the validators' : `Judge #${target} first`}
        </button>
      </WalletGate>
      <TxProgress state={state} waiting="Validators are triaging" />
    </div>
  );
}

/** The team tips an actionable report; the bonus lands in the tester's balance. */
export function BonusBox({ report }: { report: Report }) {
  const w = useWallet();
  const { state, busy, run } = useWrite([`report:${report.id}`, `program:${report.program_id}`]);
  const [amount, setAmount] = useState('');
  const wei = toWei(amount);
  if (!w.account || w.account.toLowerCase() !== report.team.toLowerCase()) return null;
  return (
    <div className="c-card pad flex flex-col gap-2">
      <p className="c-eyebrow">Tip a bonus</p>
      <p className="c-muted text-[13.5px]">
        Every actionable report earns the same reward. A bonus is how the team rewards an important one; it goes straight
        to the tester&apos;s balance.
      </p>
      <WalletGate action="tip a bonus">
        <div className="flex gap-2">
          <input className="c-input mono" placeholder="GEN, e.g. 20" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" aria-label="Bonus in GEN" />
          <button className="c-btn" disabled={busy || !wei || wei <= 0n} onClick={async () => (await run('bonus', [report.id], wei ?? 0n)).phase === 'done' && setAmount('')}>
            Tip
          </button>
        </div>
      </WalletGate>
      {report.bonus !== '0' && <p className="c-faint text-[12.5px]">Tipped so far: {gen(report.bonus)}.</p>}
      <TxProgress state={state} waiting="Validators are recording the bonus" />
    </div>
  );
}

/** For the tester who filed it: where the money went, and the way to withdraw. */
export function TesterNote({ report }: { report: Report }) {
  const w = useWallet();
  if (!w.account || w.account.toLowerCase() !== report.tester.toLowerCase() || report.status === 'FILED') return null;
  return (
    <div className="c-note accent">
      {report.credited === '0' && report.bonus === '0'
        ? 'This was your report. The stake went to the pool.'
        : 'This was your report. What it earned is in your balance.'}{' '}
      <Link href="/me" className="underline">
        Withdraw from My reports
      </Link>
      .
    </div>
  );
}
