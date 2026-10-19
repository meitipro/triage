/**
 * The pure part of the Triage → GitHub Issues sync: how a report becomes an
 * issue, how an issue is recognised again, and what to do on each run.
 * No network here, so every rule is tested with node:test (lib.test.mjs).
 *
 * One issue per actionable report, recognised by a marker in its body that
 * names the contract and the report id. A run creates the issues that do not
 * exist yet and updates the ones whose text changed (a bonus was tipped). It
 * never reopens an issue the team closed, and never touches an issue it did
 * not create.
 */

export const GEN = 10n ** 18n;
/** The contract stores the leader's summary cut at 120 characters, sometimes mid-word. */
export const SUMMARY_CAP = 120;

/** `<!-- triage-report:0xabc…:24 -->`, the only thing that identifies an issue as a report's. */
export function markerFor(contract, reportId) {
  return `<!-- triage-report:${String(contract).toLowerCase()}:${Number(reportId)} -->`;
}

/** The report id an issue body carries for this contract, or null. */
export function parseMarker(body, contract) {
  const m = /<!-- triage-report:(0x[0-9a-fA-F]{40}):(\d+) -->/.exec(String(body ?? ''));
  if (!m || m[1].toLowerCase() !== String(contract).toLowerCase()) return null;
  return Number(m[2]);
}

/** Wei as GEN, never through a float: "8 GEN", "0.5 GEN". */
export function gen(wei) {
  const value = BigInt(wei);
  const whole = value / GEN;
  const frac = value % GEN;
  const digits = frac.toString().padStart(18, '0').slice(0, 6).replace(/0+$/, '');
  return digits ? `${whole}.${digits} GEN` : `${whole} GEN`;
}

/** The summary, marked as cut when it reached the contract's cap. */
export function summaryOf(report) {
  const text = String(report.summary ?? '').replace(/@/g, '@​');
  return String(report.summary ?? '').length >= SUMMARY_CAP ? text.trimEnd() + '…' : text;
}

/** GitHub issue titles hold 256 characters; report titles hold 100, so this only guards odd input. */
export function issueTitle(report) {
  const title = `[Triage #${report.id}] ${String(report.title).replace(/\s+/g, ' ').trim()}`;
  return title.length > 256 ? title.slice(0, 255) + '…' : title;
}

/** Labels for a report: the base label, and its kind. */
export function labelsFor(report, prefix = 'triage') {
  return [prefix, `${prefix}:${report.kind}`];
}

/**
 * Untrusted text into Markdown. A tester wrote the title and body; a model
 * wrote the summary. They must not ping people, close issues by keyword, or
 * break out of the block they sit in.
 */
export function quote(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/@/g, '@​')
    .replace(/<!--/g, '&lt;!--')
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

/**
 * The issue body for one actionable report. Deterministic: the same report
 * and links always give the same text, so an unchanged report is never
 * rewritten.
 */
export function issueBody(report, { contract, program, site, explorer, judgeTx = '', submitTx = '' }) {
  const lines = [
    `**${report.kind}** · program ${program.id}, ${program.name} · filed by \`${report.tester}\``,
    '',
    quote(report.body ?? ''),
    '',
    `**Validators' summary:** ${summaryOf(report)}`,
    '',
    `| | |`,
    `|---|---|`,
    `| Verdict | ACTIONABLE, agreed by GenLayer validators |`,
    `| Paid to the tester | ${gen(report.credited)} (stake back plus the reward)${report.bonus && report.bonus !== '0' ? `, plus ${gen(report.bonus)} in bonus` : ''} |`,
    `| Report | ${site}/r/${report.id} |`,
  ];
  if (submitTx) lines.push(`| Filed in | ${explorer}/tx/${submitTx} |`);
  if (judgeTx) lines.push(`| Judged in | ${explorer}/tx/${judgeTx} |`);
  lines.push(`| Contract | ${explorer}/address/${contract} |`);
  lines.push('', `<sub>Opened by the Triage sync from the contract's queue. Closing this issue does not change anything on chain.</sub>`);
  lines.push(markerFor(contract, report.id));
  return lines.join('\n');
}

/**
 * What to do this run.
 *   issues   every issue already on the repo: { number, title, body, state, labels: [names] }
 *   reports  the program's actionable reports, as list_reports returns them
 * Returns { create: [report], update: [{ number, report }], keep: [number] }.
 */
export function plan(issues, reports, render, contract) {
  const byReport = new Map();
  for (const issue of issues) {
    const id = parseMarker(issue.body, contract);
    if (id !== null && !byReport.has(id)) byReport.set(id, issue);
  }
  const out = { create: [], update: [], keep: [] };
  for (const report of [...reports].sort((a, b) => a.id - b.id)) {
    const issue = byReport.get(report.id);
    if (!issue) {
      out.create.push(report);
      continue;
    }
    const want = render(report);
    if (issue.body === want.body && issue.title === want.title) out.keep.push(issue.number);
    else out.update.push({ number: issue.number, report, state: issue.state });
  }
  return out;
}
