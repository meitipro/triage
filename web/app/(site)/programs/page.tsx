import type { Metadata } from 'next';
import Link from 'next/link';

import { Empty, Initials, ReadError } from '@/components/ui';
import { day, dayTime, gen, plural } from '@/lib/format';
import { allPrograms, isGolden, readError } from '@/lib/read';
import type { Program } from '@/lib/types';

export const revalidate = 20;
export const metadata: Metadata = { title: 'Programs' };

function Row({ p }: { p: Program }) {
  const ended = Date.now() / 1000 >= p.ends_at;
  const state = p.closed ? 'closed' : ended ? 'ended' : 'open';
  return (
    <Link href={`/p/${p.id}`} className="c-row-link flex flex-wrap items-center gap-4 border-b border-[var(--line)] px-5 py-4 last:border-b-0">
      <Initials name={p.name} />
      <span className="min-w-[200px] flex-1">
        <span className="block font-medium">{p.name}</span>
        <span className="c-faint mono block text-[12px]">
          reward {gen(p.reward)} · stake {gen(p.stake)} · {plural(p.reports, 'report')} · {p.actionable} actionable
        </span>
      </span>
      <span className="text-right">
        <span className="mono block">{gen(p.pool)}</span>
        <span className="c-faint block text-[12px]">
          {state === 'open' ? `runs to ${p.trial ? dayTime(p.ends_at) : day(p.ends_at)}` : state}
        </span>
      </span>
    </Link>
  );
}

export default async function Programs() {
  let programs: Program[] = [];
  let error = '';
  try {
    programs = await allPrograms();
  } catch (e) {
    error = readError(e);
  }
  const live = programs.filter((p) => !isGolden(p));
  const golden = programs.filter(isGolden);
  return (
    <div className="c-wrap py-12">
      <h1 className="c-h2">Programs</h1>
      <p className="c-lead mt-3">Every program on the contract, newest first. Read the scope before you file.</p>
      <div className="mt-8">
        {error ? (
          <ReadError message={error} />
        ) : live.length ? (
          <div className="c-card">{live.map((p) => <Row key={p.id} p={p} />)}</div>
        ) : (
          <Empty>No program is open yet.</Empty>
        )}
      </div>
      {golden.length > 0 && (
        <div className="mt-10">
          <p className="c-eyebrow">Evaluation</p>
          <p className="c-muted mt-2 text-[14px]">The program the golden cases ran in, kept apart so it does not read as a real queue.</p>
          <div className="c-card mt-3">{golden.map((p) => <Row key={p.id} p={p} />)}</div>
        </div>
      )}
    </div>
  );
}
