/**
 * Triage → GitHub Issues: one issue per actionable report of a program.
 *
 *   node sync.mjs          (inside the composite action; settings come from the environment)
 *
 * Reads the program's queue straight from the contract with genlayer-js
 * (list_reports with status ACTIONABLE), so the issues never depend on the
 * site being up. The filing and judging transactions are looked up on the
 * explorer's API when it answers; without it the issues still carry the
 * report and contract links.
 *
 * Environment:
 *   TRIAGE_PROGRAM   program id (required)
 *   TRIAGE_CONTRACT  contract address
 *   TRIAGE_RPC       Studio Next RPC
 *   TRIAGE_SITE      the site, for report links
 *   TRIAGE_EXPLORER  the explorer, for transaction links
 *   TRIAGE_LABEL     base label, default "triage"
 *   TRIAGE_DRY_RUN   "true" to print the plan and change nothing
 *   GITHUB_TOKEN, GITHUB_REPOSITORY   from the workflow
 */

import fs from 'node:fs';

import { abi, createClient } from 'genlayer-js';
import { studioDevnet } from 'genlayer-js/chains';

import { issueBody, issueTitle, labelsFor, parseMarker, plan } from './lib.mjs';

const env = process.env;
const PROGRAM = Number(env.TRIAGE_PROGRAM);
const CONTRACT = env.TRIAGE_CONTRACT || '0x17c378994ebdF51ca536A8020dC04129F3612373';
const RPC = env.TRIAGE_RPC || 'https://studio-next.genlayer.com/api';
const SITE = (env.TRIAGE_SITE || 'https://triage-genlayer.vercel.app').replace(/\/$/, '');
const EXPLORER = (env.TRIAGE_EXPLORER || 'https://explorer-studio-dev.genlayer.com').replace(/\/$/, '');
const LABEL = env.TRIAGE_LABEL || 'triage';
const DRY = String(env.TRIAGE_DRY_RUN || '').toLowerCase() === 'true';
const REPO = env.GITHUB_REPOSITORY;
const TOKEN = env.GITHUB_TOKEN;

if (!Number.isInteger(PROGRAM) || PROGRAM < 1) throw new Error('set the program input to a program id');
if (!REPO || (!TOKEN && !DRY)) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required');

// -- the chain -------------------------------------------------------------------------------
const client = createClient({ chain: { ...studioDevnet, id: 61997, rpcUrls: { default: { http: [RPC] } } } });

async function retried(fn, attempts = 5) {
  let wait = 2000;
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i >= attempts) throw error;
      await new Promise((r) => setTimeout(r, wait));
      wait *= 2;
    }
  }
}

async function view(functionName, args) {
  return JSON.parse(String(await retried(() => client.readContract({ address: CONTRACT, functionName, args }))));
}

async function queue() {
  const program = await view('get_program', [PROGRAM]);
  if (!program.found) throw new Error(`program ${PROGRAM} does not exist on ${CONTRACT}`);
  const items = [];
  for (let offset = 0; ; offset += 50) {
    const page = await view('list_reports', [PROGRAM, 'ACTIONABLE', offset, 50]);
    items.push(...page.items);
    if (offset + 50 >= page.total) break;
  }
  return { program, items };
}

/** report id -> { submit, judge } transaction hashes, from the explorer's index of the contract. Best effort. */
async function transactions() {
  const out = {};
  try {
    for (let page = 1; page <= 40; page++) {
      const response = await fetch(`${EXPLORER}/api/transactions?address=${CONTRACT}&limit=100&page=${page}`);
      if (!response.ok) break;
      const body = await response.json();
      for (const tx of body.transactions ?? []) {
        if (!tx?.data?.calldata || !['ACCEPTED', 'FINALIZED'].includes(String(tx.status).toUpperCase())) continue;
        let call;
        try {
          call = abi.calldata.decode(Uint8Array.from(Buffer.from(tx.data.calldata, 'base64')));
        } catch {
          continue;
        }
        if (!(call instanceof Map)) continue;
        const method = String(call.get('') ?? '');
        const args = call.get('args') ?? [];
        const rounds = tx?.consensus_data?.leader_receipt;
        const leader = Array.isArray(rounds) ? rounds[0] : rounds;
        if (String(leader?.execution_result ?? '').toUpperCase() !== 'SUCCESS') continue;
        const raw = typeof leader?.result === 'string' ? Buffer.from(leader.result, 'base64') : null;
        if (!raw || raw[0] !== 0) continue;
        if (method === 'judge' && args[0] !== undefined) (out[String(args[0])] ??= {}).judge ??= tx.hash;
        if (method === 'submit') {
          let returned;
          try {
            returned = abi.calldata.decode(raw.subarray(1));
          } catch {
            continue;
          }
          (out[String(returned)] ??= {}).submit ??= tx.hash;
        }
      }
      if (page >= Number(body?.pagination?.totalPages ?? 1)) break;
    }
  } catch {
    // Links to transactions are a convenience; the report and contract links remain.
  }
  return out;
}

// -- GitHub --------------------------------------------------------------------------------------
async function gh(method, path, body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 404 && method === 'GET') return null;
  if (!response.ok) throw new Error(`GitHub ${method} ${path}: ${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

async function existingIssues() {
  const out = [];
  for (let page = 1; page <= 50; page++) {
    const batch = await gh('GET', `/repos/${REPO}/issues?labels=${encodeURIComponent(LABEL)}&state=all&per_page=100&page=${page}`);
    if (!batch?.length) break;
    for (const issue of batch) {
      if (issue.pull_request) continue;
      out.push({ number: issue.number, title: issue.title, body: issue.body ?? '', state: issue.state, url: issue.html_url });
    }
    if (batch.length < 100) break;
  }
  return out;
}

const COLORS = { [LABEL]: 'a3e635', [`${LABEL}:bug`]: 'd73a4a', [`${LABEL}:usability`]: 'fbca04', [`${LABEL}:idea`]: '0e8a16' };

async function ensureLabels() {
  for (const [name, color] of Object.entries(COLORS)) {
    const found = await gh('GET', `/repos/${REPO}/labels/${encodeURIComponent(name)}`);
    if (!found) await gh('POST', `/repos/${REPO}/labels`, { name, color, description: 'An actionable report from a Triage program' });
  }
}

// -- run ---------------------------------------------------------------------------------------
const { program, items } = await queue();
const txs = await transactions();
const render = (report) => ({
  title: issueTitle(report),
  body: issueBody(report, {
    contract: CONTRACT,
    program,
    site: SITE,
    explorer: EXPLORER,
    submitTx: txs[String(report.id)]?.submit ?? '',
    judgeTx: txs[String(report.id)]?.judge ?? '',
  }),
});
const issues = TOKEN ? await existingIssues() : [];
const todo = plan(issues, items, render, CONTRACT);
const summary = [`## Triage sync: program ${PROGRAM}, ${program.name}`, '', `${items.length} actionable report(s) on chain.`, ''];

if (DRY) {
  summary.push(`Dry run: would create ${todo.create.length}, update ${todo.update.length}, keep ${todo.keep.length}.`);
} else {
  if (todo.create.length || todo.update.length) await ensureLabels();
  for (const report of todo.create) {
    const want = render(report);
    const issue = await gh('POST', `/repos/${REPO}/issues`, { ...want, labels: labelsFor(report, LABEL) });
    summary.push(`- created #${issue.number} for report ${report.id}: ${issue.html_url}`);
  }
  for (const { number, report } of todo.update) {
    // Text only: an issue the team closed stays closed.
    const issue = await gh('PATCH', `/repos/${REPO}/issues/${number}`, render(report));
    summary.push(`- updated #${issue.number} for report ${report.id}`);
  }
  summary.push('', `Created ${todo.create.length}, updated ${todo.update.length}, unchanged ${todo.keep.length}.`);
}
const known = new Set(items.map((r) => r.id));
const orphans = issues.filter((i) => {
  const id = parseMarker(i.body, CONTRACT);
  return id !== null && !known.has(id);
});
if (orphans.length) summary.push('', `${orphans.length} issue(s) name a report that is not in this program's queue; left as they are.`);

const text = summary.join('\n');
console.log(text);
if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, text + '\n');
