import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { FileReport } from '@/components/FileReport';
import { Empty, ReadError } from '@/components/ui';
import { allReports, getProgram, readError } from '@/lib/read';
import type { Program, ReportRow } from '@/lib/types';

export const revalidate = 20;

export const metadata: Metadata = { title: 'File a report' };

export default async function FilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) notFound();
  let p: Program | null = null;
  let accepted: ReportRow[] = [];
  let error = '';
  try {
    const got = await getProgram(id);
    if (!got.found) notFound();
    p = got;
    accepted = (await allReports(id, 'ACTIONABLE')).items;
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith('NEXT_')) throw e;
    error = readError(e);
  }
  if (error || !p) {
    return (
      <div className="c-wrap py-14">
        <ReadError message={error || 'The program could not be read.'} />
      </div>
    );
  }
  const open = !p.closed && Date.now() / 1000 < p.ends_at;
  return (
    <div className="c-wrap py-12">
      <p className="c-eyebrow">
        <Link href={`/p/${p.id}`} className="hover:text-[var(--ink)]">
          {p.name}
        </Link>
      </p>
      <h1 className="c-h2 mt-2">File a report</h1>
      <details className="c-card pad mt-6">
        <summary className="cursor-pointer font-medium">The scope you are reporting against</summary>
        <p className="c-text c-muted mt-3 text-[14.5px]">{p.scope}</p>
      </details>
      <div className="mt-8">
        {open ? (
          <FileReport
            program={p}
            accepted={accepted.map((r) => ({ id: r.id, title: r.title, summary: r.summary }))}
          />
        ) : (
          <Empty>
            This program {p.closed ? 'is closed' : 'has ended'} and takes no more reports.{' '}
            <Link className="c-link" href="/programs">
              Browse the open programs
            </Link>
            .
          </Empty>
        )}
      </div>
    </div>
  );
}
