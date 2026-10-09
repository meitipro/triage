import { unstable_cache } from 'next/cache';

import { CONTRACT, readClient, retried } from './genlayer-core.mjs';
import type { NotFound, Program, Report, ReportPage, TesterStats } from './types';

/**
 * Reads happen on the server, cached for a short while under tags.
 *
 * Studio Next rate-limits each IP, and every visitor's page view would
 * otherwise spend the server's budget. Shared reads are cached for 20 seconds;
 * after a decided write the page POSTs /api/refresh, which expires the tags it
 * touched, so the person who wrote sees their own result at once.
 */

const client = readClient();
const REVALIDATE = 20;

async function view<T>(method: string, args: (number | string)[]): Promise<T> {
  const raw = await retried(() => client.readContract({ address: CONTRACT, functionName: method, args }), 3);
  return JSON.parse(String(raw)) as T;
}

export const tags = {
  programs: 'programs',
  reports: 'reports',
  program: (id: number) => `program:${id}`,
  report: (id: number) => `report:${id}`,
  tester: (address: string) => `tester:${address.toLowerCase()}`,
};

export function getProgram(id: number): Promise<Program | NotFound> {
  return unstable_cache(() => view<Program | NotFound>('get_program', [id]), ['get_program', String(id)], {
    revalidate: REVALIDATE,
    tags: [tags.programs, tags.program(id)],
  })();
}

/** Every program, newest first. get_program answers the count even for an id that does not exist. */
export async function allPrograms(): Promise<Program[]> {
  const head = await getProgram(0);
  const count = head.programs ?? 0;
  const out: Program[] = [];
  for (let id = count; id >= 1; id--) {
    const p = await getProgram(id);
    if (p.found) out.push(p);
  }
  return out;
}

export function getReport(id: number): Promise<Report | NotFound> {
  return unstable_cache(() => view<Report | NotFound>('get_report', [id]), ['get_report', String(id)], {
    revalidate: REVALIDATE,
    tags: [tags.reports, tags.report(id)],
  })();
}

/** Reports newest first; program 0 lists every program's. The queue is status ACTIONABLE. */
export function listReports(programId: number, status = '', offset = 0, limit = 50): Promise<ReportPage> {
  return unstable_cache(
    () => view<ReportPage>('list_reports', [programId, status, offset, limit]),
    ['list_reports', String(programId), status, String(offset), String(limit)],
    { revalidate: REVALIDATE, tags: [tags.reports, tags.programs, tags.program(programId)] },
  )();
}

/** Every report of one status in a program, in pages of fifty. */
export async function allReports(programId: number, status = ''): Promise<ReportPage> {
  const first = await listReports(programId, status, 0, 50);
  if (!first.found) return first;
  const items = [...first.items];
  for (let offset = 50; offset < first.total; offset += 50) {
    const page = await listReports(programId, status, offset, 50);
    if (page.found) items.push(...page.items);
  }
  return { ...first, items };
}

export function testerStats(address: string): Promise<TesterStats> {
  return unstable_cache(() => view<TesterStats>('tester_stats', [address]), ['tester_stats', address.toLowerCase()], {
    revalidate: REVALIDATE,
    tags: [tags.reports, tags.tester(address)],
  })();
}

/** Programs opened by eval/ and by the reviewer-path script, which lists keep apart from the rest. */
export function isGolden(p: { name: string }): boolean {
  return /^Triage golden set$/.test(p.name);
}

/** A read failed: say so in one sentence rather than failing the page. */
export function readError(error: unknown): string {
  const text = String((error as Error)?.message ?? error);
  if (/-32029|rate limit/i.test(text)) return 'Studio Next is rate limiting reads right now. Wait a minute and reload.';
  return 'Studio Next did not answer this read. Reload in a moment.';
}
