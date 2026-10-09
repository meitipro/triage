import type { Metadata } from 'next';
import Link from 'next/link';

import { Empty, KindTag, ReadError, StatusBadge } from '@/components/ui';
import { dayTime } from '@/lib/format';
import { FILTERS, STATUS_LABEL } from '@/lib/labels';
import { allPrograms, listReports, readError } from '@/lib/read';
import type { ReportPage, Status } from '@/lib/types';

export const revalidate = 20;
export const metadata: Metadata = { title: 'Reports' };

const PAGE = 50;

export default async function Reports({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const q = await searchParams;
  const status = (FILTERS.find((f) => f.status === String(q.status ?? '').toUpperCase())?.status ?? '') as Status | '';
  const page = Math.max(1, Number(q.page) || 1);
  let list: ReportPage | null = null;
  let names = new Map<number, string>();
  let error = '';
  try {
    list = await listReports(0, status, (page - 1) * PAGE, PAGE);
    names = new Map((await allPrograms()).map((p) => [p.id, p.name]));
  } catch (e) {
    error = readError(e);
  }
  const pages = list ? Math.max(1, Math.ceil(list.total / PAGE)) : 1;
  return (
    <div className="c-wrap py-12">
      <h1 className="c-h2">Reports</h1>
      <p className="c-lead mt-3">Every report across every program, newest first, with the label the validators agreed on.</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/reports" className="c-tab" aria-current={status === '' ? 'page' : undefined}>
          All
        </Link>
        {FILTERS.map((f) => (
          <Link key={f.status} href={`/reports?status=${f.status}`} className="c-tab" aria-current={f.status === status ? 'page' : undefined}>
            {STATUS_LABEL[f.status]}
          </Link>
        ))}
      </div>
      <div className="mt-4">
        {error ? (
          <ReadError message={error} />
        ) : list && list.items.length ? (
          <div className="c-card">
            {list.items.map((r) => (
              <Link key={r.id} href={`/r/${r.id}`} className="c-row-link grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--line)] px-4 py-3 last:border-b-0">
                <span className="mono c-faint text-[13px]">#{r.id}</span>
                <span className="min-w-0">
                  <span className={`block truncate font-medium ${r.status === 'LOW_EFFORT' ? 'c-struck' : ''}`}>{r.title}</span>
                  <span className="c-faint block truncate text-[12.5px]">
                    {names.get(r.program_id) ?? `Program ${r.program_id}`} · {dayTime(r.filed_at)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <KindTag kind={r.kind} />
                  <StatusBadge status={r.status} duplicateOf={r.duplicate_of} />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <Empty>No reports here yet.</Empty>
        )}
      </div>
      {pages > 1 && (
        <div className="mt-4 flex gap-2">
          {page > 1 && (
            <Link className="c-btn small" href={`/reports?${status ? `status=${status}&` : ''}page=${page - 1}`}>
              Newer
            </Link>
          )}
          {page < pages && (
            <Link className="c-btn small" href={`/reports?${status ? `status=${status}&` : ''}page=${page + 1}`}>
              Older
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
