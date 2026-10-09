import { NextResponse } from 'next/server';

import { DEPLOYMENT } from '@/lib/genlayer-core.mjs';
import { txIndex } from '@/lib/explorer';
import { allReports, getProgram } from '@/lib/read';

/**
 * The queue, for trackers: every actionable report of a program, newest first,
 * with its body, summary, bonus and the transactions that filed and judged it.
 *
 *   GET /api/export/5             JSON
 *   GET /api/export/5?format=csv  CSV, one row per report
 *
 * Read from the contract (list_reports with status ACTIONABLE), never from a copy.
 */

function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: 'unknown program' }, { status: 404 });
  const program = await getProgram(id);
  if (!program.found) return NextResponse.json({ error: 'unknown program' }, { status: 404 });
  const queue = await allReports(id, 'ACTIONABLE');
  const txs = await txIndex();
  const site = new URL(request.url).origin;
  const items = queue.items.map((r) => ({
    id: r.id,
    url: `${site}/r/${r.id}`,
    kind: r.kind,
    title: r.title,
    body: r.body ?? '',
    summary: r.summary,
    tester: r.tester,
    filed_at: new Date(r.filed_at * 1000).toISOString(),
    judged_at: new Date(r.judged_at * 1000).toISOString(),
    bonus_wei: r.bonus,
    submit_tx: txs.submit[String(r.id)]?.hash ?? '',
    judge_tx: txs.judge[String(r.id)]?.hash ?? '',
  }));
  if (new URL(request.url).searchParams.get('format') === 'csv') {
    const columns = Object.keys(items[0] ?? { id: 0, url: '', kind: '', title: '', body: '', summary: '', tester: '', filed_at: '', judged_at: '', bonus_wei: '', submit_tx: '', judge_tx: '' });
    const lines = [columns.join(','), ...items.map((row) => columns.map((c) => csvCell((row as Record<string, unknown>)[c])).join(','))];
    return new NextResponse(lines.join('\r\n') + '\r\n', {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="triage-program-${id}-queue.csv"` },
    });
  }
  return NextResponse.json({
    program: { id, name: program.name, scope: program.scope, team: program.team, actionable: program.actionable },
    contract: DEPLOYMENT.triage,
    network: { name: 'GenLayer Studio Next', chainId: DEPLOYMENT.chainId, explorer: DEPLOYMENT.explorer },
    items,
  });
}
