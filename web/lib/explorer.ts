import { abi } from 'genlayer-js';
import { unstable_cache } from 'next/cache';

import { CONTRACT, EXPLORER } from './genlayer-core.mjs';

/**
 * The transactions behind programs and reports, read from the Studio Next
 * explorer's API. The contract cannot know its own transaction hashes, so the
 * site finds them here: the open_program whose returned id is the program, the
 * submit whose returned id is the report, the judge and bonus whose argument
 * is the report, and each tester's withdraw.
 *
 * Only decided, successful transactions count. A refused write is on the
 * explorer too, and it changed nothing.
 */

export type ContractTx = { method: string; hash: string; from: string; created: string; args: string[]; returned?: string };

export type TxIndex = {
  /** report id -> its submit transaction */
  submit: Record<string, ContractTx>;
  /** report id -> the judge transaction that decided it */
  judge: Record<string, ContractTx>;
  /** report id -> bonus transactions */
  bonus: Record<string, ContractTx[]>;
  /** program id -> its open_program transaction */
  program: Record<string, ContractTx>;
  /** program id -> other writes on it (fund, close) */
  programWrites: Record<string, ContractTx[]>;
  /** lower-case address -> withdraw transactions */
  withdraw: Record<string, ContractTx[]>;
};

/* eslint-disable @typescript-eslint/no-explicit-any */

function decode(b64: string): { method: string; args: unknown[] } | null {
  try {
    const bytes = Uint8Array.from(Buffer.from(b64, 'base64'));
    const out = abi.calldata.decode(bytes) as any;
    if (!(out instanceof Map)) return null;
    return { method: String(out.get('') ?? ''), args: (out.get('args') as unknown[]) ?? [] };
  } catch {
    return null;
  }
}

function leaderOf(tx: any): any {
  const rounds = tx?.consensus_data?.leader_receipt;
  if (Array.isArray(rounds)) return rounds.find((r: any) => String(r?.mode ?? '').toLowerCase() === 'leader') ?? rounds[0];
  return rounds;
}

/**
 * The explorer stores the leader's result as base64: one status byte (0 means
 * the method returned) and then the returned value, calldata-encoded.
 */
function succeeded(tx: any): { ok: boolean; returned?: string } {
  const status = String(tx?.status ?? '').toUpperCase();
  if (status !== 'ACCEPTED' && status !== 'FINALIZED') return { ok: false };
  const leader = leaderOf(tx);
  if (String(leader?.execution_result ?? '').toUpperCase() !== 'SUCCESS') return { ok: false };
  const result = leader?.result;
  if (typeof result === 'string') {
    try {
      const bytes = Uint8Array.from(Buffer.from(result, 'base64'));
      if (bytes[0] !== 0) return { ok: false };
      const value = abi.calldata.decode(bytes.subarray(1)) as unknown;
      return { ok: true, returned: typeof value === 'bigint' || typeof value === 'number' || typeof value === 'string' ? String(value) : undefined };
    } catch {
      return { ok: false };
    }
  }
  const ok = String(result?.status ?? '').toLowerCase() === 'return';
  const readable = result?.payload?.readable ?? result?.payload;
  return { ok, returned: typeof readable === 'string' ? readable : undefined };
}

async function scan(): Promise<TxIndex> {
  const index: TxIndex = { submit: {}, judge: {}, bonus: {}, program: {}, programWrites: {}, withdraw: {} };
  for (let page = 1; page <= 40; page++) {
    const url = `${EXPLORER}/api/transactions?address=${CONTRACT}&limit=100&page=${page}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`explorer answered ${response.status}`);
    const body = await response.json();
    for (const tx of body.transactions ?? []) {
      const call = tx?.data?.calldata ? decode(tx.data.calldata) : null;
      if (!call) continue;
      const done = succeeded(tx);
      if (!done.ok) continue;
      const row: ContractTx = {
        method: call.method,
        hash: tx.hash,
        from: String(tx.from_address ?? ''),
        created: String(tx.created_at ?? ''),
        args: call.args.map((a) => (typeof a === 'bigint' || typeof a === 'number' || typeof a === 'string' ? String(a) : '')),
        returned: done.returned,
      };
      const ret = done.returned && /^\d+$/.test(done.returned) ? done.returned : '';
      if (call.method === 'submit' && ret) index.submit[ret] ??= row;
      else if (call.method === 'judge' && row.args[0]) index.judge[row.args[0]] ??= row;
      else if (call.method === 'bonus' && row.args[0]) (index.bonus[row.args[0]] ??= []).push(row);
      else if (call.method === 'open_program' && ret) index.program[ret] ??= row;
      else if (['fund', 'close'].includes(call.method) && row.args[0]) (index.programWrites[row.args[0]] ??= []).push(row);
      else if (call.method === 'withdraw') (index.withdraw[row.from.toLowerCase()] ??= []).push(row);
    }
    const pages = Number(body?.pagination?.totalPages ?? 1);
    if (page >= pages) break;
  }
  return index;
}

const cachedScan = unstable_cache(scan, ['explorer-scan', CONTRACT], { revalidate: 60, tags: ['txs'] });

const EMPTY: TxIndex = { submit: {}, judge: {}, bonus: {}, program: {}, programWrites: {}, withdraw: {} };

/** The transaction index, or an empty one when the explorer does not answer: links are a convenience, never a dependency. */
export async function txIndex(): Promise<TxIndex> {
  try {
    return await cachedScan();
  } catch {
    return EMPTY;
  }
}
