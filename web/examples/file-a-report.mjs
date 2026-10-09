/**
 * File a report with the stake and ask the validators, with genlayer-js and a wallet.
 *
 *   node examples/file-a-report.mjs <account name> <program id> <kind> <title> <body file>
 *
 * In a browser the provider is window.ethereum and the account is the one the
 * wallet connected. Here a stand-in wallet signs for a local test account, so
 * the same code runs from a terminal. This file is the sample on the docs page
 * "Quickstart", copied in by scripts/gen_docs.py.
 */
import { readFileSync } from 'node:fs';

import { createClient } from 'genlayer-js';
import { studioDevnet } from 'genlayer-js/chains';

import { standinWallet } from '../scripts/standin-wallet.mjs';

const TRIAGE = '0x17c378994ebdF51ca536A8020dC04129F3612373';
const chain = { ...studioDevnet, id: 61997, rpcUrls: { default: { http: ['https://studio-next.genlayer.com/api'] } } };

const [name = 'docs_example', program = '1', kind = 'bug', title, file] = process.argv.slice(2);
const { address, provider } = standinWallet(name); // browser: window.ethereum
const client = createClient({ chain, account: address, provider });

async function read(functionName, args) {
  return JSON.parse(await client.readContract({ address: TRIAGE, functionName, args }));
}

/** One write: a fee deposit from the SDK's estimate, then the success test. */
async function write(functionName, args, value = 0n, rotations = 1) {
  const estimate = await client.estimateTransactionFees({
    leaderTimeunitsAllocation: 600,
    validatorTimeunitsAllocation: 600,
    totalMessageFees: 0,
    rotations: [rotations],
  });
  const hash = await client.writeContract({
    address: TRIAGE,
    functionName,
    args,
    value,
    fees: { distribution: estimate.distribution, feeValue: estimate.feeValue },
  });
  const receipt = await client.waitForTransactionReceipt({ hash, waitUntil: 'decided', interval: 4000, retries: 120 });
  const leader = receipt.consensus_data.leader_receipt[0];
  // ACCEPTED is not success on its own: a refusal is accepted too. Check the result.
  if (leader.execution_result !== 'SUCCESS' || leader.result.status !== 'return') {
    throw new Error(`${functionName} refused: ${JSON.stringify(leader.result.payload)}`);
  }
  return { hash, returned: leader.result.payload.readable };
}

// 1. File the report with exactly the program's stake. Filing reserves one reward.
const terms = await read('get_program', [Number(program)]);
const filed = await write('submit', [Number(program), kind, title, readFileSync(file, 'utf8')], BigInt(terms.stake));
const id = Number(filed.returned);

// 2. Ask the validators. Reports are judged in filing order: judge an earlier one first if it is waiting.
let next = (await read('get_report', [id])).next_to_judge;
while (next && next !== id) {
  await write('judge', [next], 0n, 3);
  next = (await read('get_report', [id])).next_to_judge;
}
const judged = await write('judge', [id], 0n, 3);

// 3. Read the verdict back from the contract.
const report = await read('get_report', [id]);
console.log(
  JSON.stringify({
    report: id,
    verdict: report.status,
    duplicate_of: report.duplicate_of,
    summary: report.summary,
    credited: report.credited,
    submit: filed.hash,
    judge: judged.hash,
  }),
);
