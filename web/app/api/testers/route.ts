import { NextResponse } from 'next/server';

import { DEPLOYMENT } from '@/lib/genlayer-core.mjs';
import { percent, rank, toCsv } from '@/lib/leaderboard.mjs';
import { allPrograms, allReports, isGolden } from '@/lib/read';

/**
 * The tester leaderboard, for campaign rewards or points.
 *
 *   GET /api/testers                     every program but the evaluation set, JSON
 *   GET /api/testers?program=2           one program
 *   GET /api/testers?program=2&format=csv
 *
 * Read from the contract (list_reports over every program), ranked by
 * web/lib/leaderboard.mjs. Amounts are wei as decimal strings.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const program = Number(url.searchParams.get('program')) > 0 ? Number(url.searchParams.get('program')) : 0;
  const programs = await allPrograms();
  if (program && !programs.some((p) => p.id === program)) return NextResponse.json({ error: 'unknown program' }, { status: 404 });
  const exclude = new Set(programs.filter(isGolden).map((p) => p.id));
  const rows = rank((await allReports(0, '')).items, { program, exclude });
  if (url.searchParams.get('format') === 'csv') {
    return new NextResponse(toCsv(rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="triage-testers${program ? `-program-${program}` : ''}.csv"`,
      },
    });
  }
  return NextResponse.json({
    program: program || null,
    excluded_programs: program ? [] : [...exclude],
    contract: DEPLOYMENT.triage,
    testers: rows.map((r) => ({
      ...r,
      acceptance_rate: percent(r.acceptance_bp),
      earned: r.earned.toString(),
      lost: r.lost.toString(),
    })),
  });
}
