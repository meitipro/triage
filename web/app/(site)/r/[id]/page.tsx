import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BonusBox, JudgeBox, TesterNote } from '@/components/ReportActions';
import { Addr, KindTag, ReadError, StatusBadge, Tx } from '@/components/ui';
import { txIndex } from '@/lib/explorer';
import { capped, dayTime, gen } from '@/lib/format';
import limits from '@/lib/contract.generated.json';
import { getReport, readError } from '@/lib/read';
import type { Report } from '@/lib/types';

export const revalidate = 20;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const r = await getReport(Number(id));
    if (r.found) return { title: `#${r.id} ${r.title}`, description: r.summary || r.body.slice(0, 160) };
  } catch {
    /* fall through */
  }
  return { title: `Report ${id}` };
}

/** What the verdict did with the money, read from the report's own fields. */
function settlement(r: Report): string {
  const stake = gen(r.stake);
  const reward = gen(r.reward);
  switch (r.status) {
    case 'ACTIONABLE':
      return `${stake} stake back plus the ${reward} reward, ${gen(r.credited)} into the tester's balance. The report joined the team's queue.`;
    case 'DUPLICATE':
      return `${stake} stake back to the tester. The reserved ${reward} returned to the pool.`;
    case 'OUT_OF_SCOPE':
      return `${stake} stake back to the tester. The reserved ${reward} returned to the pool.`;
    case 'LOW_EFFORT':
      return `The ${stake} stake went to the pool that pays everyone else, and the reserved ${reward} returned to it.`;
    default:
      return `${stake} staked, ${reward} reserved from the pool until the validators decide.`;
  }
}

export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ filed?: string }> }) {
  const { id: raw } = await params;
  const { filed } = await searchParams;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) notFound();
  let r: Report | null = null;
  let error = '';
  try {
    const got = await getReport(id);
    if (!got.found) notFound();
    r = got;
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith('NEXT_')) throw e;
    error = readError(e);
  }
  if (error || !r) {
    return (
      <div className="c-wrap py-14">
        <ReadError message={error || 'The report could not be read.'} />
      </div>
    );
  }
  const txs = await txIndex();
  const submitTx = txs.submit[String(r.id)]?.hash;
  const judgeTx = txs.judge[String(r.id)]?.hash;
  const bonuses = txs.bonus[String(r.id)] ?? [];

  return (
    <div className="c-wrap py-12">
      <p className="c-eyebrow">
        <Link href={`/p/${r.program_id}`} className="hover:text-[var(--ink)]">
          {r.program_name}
        </Link>{' '}
        · report #{r.id}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <StatusBadge status={r.status} duplicateOf={r.duplicate_of} />
        <KindTag kind={r.kind} />
        {r.bonus !== '0' && <span className="c-verdict yes">+{gen(r.bonus, false)} bonus</span>}
      </div>
      <h1 className={`c-h2 mt-4 max-w-[30em] ${r.status === 'LOW_EFFORT' ? 'c-struck' : ''}`}>{r.title}</h1>
      <p className="c-faint mt-2 text-[13px]">
        Filed by <Addr address={r.tester} /> on {dayTime(r.filed_at)} <Tx hash={submitTx} label="tx" />
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div className="c-card pad">
            <p className="c-eyebrow">The report, as filed</p>
            <p className="c-text mt-3">{r.body}</p>
          </div>
          {r.status === 'DUPLICATE' && r.duplicate_of > 0 && (
            <div className="c-card pad mt-4">
              <p className="c-eyebrow">Repeats</p>
              <Link href={`/r/${r.duplicate_of}`} className="mt-2 block text-[16px] font-medium hover:text-[var(--accent-ink)]">
                <span className="mono c-faint mr-2 text-[13px]">#{r.duplicate_of}</span>
                {r.duplicate_title}
              </Link>
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          {r.status === 'FILED' ? (
            <JudgeBox report={r} filed={filed === '1'} />
          ) : (
            <div className="c-card pad">
              <p className="c-eyebrow">Verdict</p>
              <div className="mt-3">
                <StatusBadge status={r.status} duplicateOf={r.duplicate_of} />
              </div>
              {r.summary && <p className="mt-3 font-medium">{capped(r.summary, limits.limits.summary)}</p>}
              {r.reason && <p className="c-muted mt-2 text-[14px] leading-relaxed">{capped(r.reason, limits.limits.reason)}</p>}
              <p className="c-faint mt-3 text-[12.5px]">
                Validators agreed on the label{r.status === 'DUPLICATE' ? ' and the report it repeats' : ''}; the summary and
                reason are the leader&apos;s. Asked by <Addr address={r.judged_by} /> on {dayTime(r.judged_at)}.
              </p>
              {judgeTx && (
                <p className="mt-2">
                  <Tx hash={judgeTx} label="judge tx" />
                </p>
              )}
            </div>
          )}
          <div className="c-card pad">
            <p className="c-eyebrow">Settlement</p>
            <p className="c-muted mt-2 text-[14px] leading-relaxed">{settlement(r)}</p>
            {r.bonus !== '0' && (
              <p className="mt-2 text-[14px] text-[var(--accent-ink)]">
                Plus {gen(r.bonus)} in bonus{r.bonus_count > 1 ? `es (${r.bonus_count})` : ''} from the team.
              </p>
            )}
            {bonuses.length > 0 && (
              <p className="mt-1 flex flex-wrap gap-3">
                {bonuses.map((b) => (
                  <Tx key={b.hash} hash={b.hash} label="bonus" />
                ))}
              </p>
            )}
          </div>
          <TesterNote report={r} />
          {r.status === 'ACTIONABLE' && <BonusBox report={r} />}
        </aside>
      </div>
    </div>
  );
}
