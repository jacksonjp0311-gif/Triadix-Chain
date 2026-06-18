/**
 * Triadix Chain v3.0 — Smart Contract Example
 * Deploys a counter contract and a multi-sig wallet, then calls them.
 */

import { TriadicEngine } from '../src/core/triadix-core.js';

console.log('═══════════════════════════════════════════');
console.log('  TRIADIX CHAIN v3.0 — Smart Contract Demo');
console.log('═══════════════════════════════════════════\n');

const engine = new TriadicEngine({ tau: 0.244, nodeId: 'node-1' });
engine.run(1); // genesis

// ── Counter Contract ──────────────────────────────────────────────
const counterCode = `
  if (!state.count) state.count = 0;
  if (!state.history) state.history = [];

  if (args.action === 'increment') {
    state.count = add(state.count, args.amount || 1);
    state.history.push({ action: 'increment', amount: args.amount || 1, by: caller });
    log('Incremented by ' + (args.amount || 1) + ' from ' + caller);
    return state.count;
  }

  if (args.action === 'decrement') {
    state.count = add(state.count, -(args.amount || 1));
    state.history.push({ action: 'decrement', amount: args.amount || 1, by: caller });
    return state.count;
  }

  if (args.action === 'transfer') {
    const tx = transfer(args.to, args.amount);
    state.count = add(state.count, -args.amount);
    log('Transfer ' + args.amount + ' to ' + args.to);
    return { balance: state.count, tx };
  }

  return state.count;
`;

console.log('Deploying counter contract...');
const deploy = engine.vm.deploy('counter-1', counterCode, 'alice', { count: 0, history: [] });
console.log(`  Deployed at: ${deploy.address}`);
console.log(`  Gas cost: ${deploy.gasCost}`);
console.log(`  Owner: ${deploy.owner}\n`);

console.log('Calling increment(5)...');
const r1 = engine.vm.call('counter-1', 'main', { action: 'increment', amount: 5 }, 'alice');
console.log(`  Result: ${r1.result} | Gas: ${r1.gasConsumed} | Cost: ${r1.gasCost}`);
console.log(`  State: ${JSON.stringify(r1.state)}`);
console.log(`  Logs: ${JSON.stringify(r1.logs)}\n`);

console.log('Calling increment(3)...');
const r2 = engine.vm.call('counter-1', 'main', { action: 'increment', amount: 3 }, 'bob');
console.log(`  Result: ${r2.result} | Gas: ${r2.gasConsumed}\n`);

console.log('Calling transfer(charlie, 2)...');
const r3 = engine.vm.call('counter-1', 'main', { action: 'transfer', to: 'charlie', amount: 2 }, 'alice');
console.log(`  Result: ${JSON.stringify(r3.result)} | Gas: ${r3.gasConsumed}\n`);

console.log('Calling getBalance...');
const r4 = engine.vm.call('counter-1', 'main', {}, 'alice');
console.log(`  Final count: ${r4.result}`);
console.log(`  VM logs: ${JSON.stringify(engine.vm.logs)}\n`);

// ── Multi-sig Wallet Contract ─────────────────────────────────────
const walletCode = `
  if (!state.owners) state.owners = args.owners || [caller];
  if (!state.required) state.required = args.required || 1;
  if (!state.transactions) state.transactions = [];

  if (args.action === 'propose') {
    const txId = state.transactions.length;
    state.transactions.push({ to: args.to, amount: args.amount, proposer: caller, approvals: [caller], executed: false, id: txId });
    log('Proposed tx ' + txId + ': ' + args.amount + ' to ' + args.to);
    return txId;
  }

  if (args.action === 'approve') {
    const tx = state.transactions[args.txId];
    if (!tx) throw new Error('Tx not found');
    if (tx.approvals.includes(caller)) throw new Error('Already approved');
    tx.approvals.push(caller);
    if (tx.approvals.length >= state.required) {
      tx.executed = true;
      log('Tx ' + args.txId + ' executed! ' + tx.amount + ' to ' + tx.to);
    }
    return { txId: args.txId, approvals: tx.approvals.length, executed: tx.executed };
  }

  return { txCount: state.transactions.length, pending: state.transactions.filter(t => !t.executed).length };
`;

console.log('Deploying multi-sig wallet...');
const wDeploy = engine.vm.deploy('wallet-1', walletCode, 'alice', { owners: ['alice', 'bob', 'charlie'], required: 2, transactions: [] });
console.log(`  Deployed at: ${wDeploy.address}\n`);

console.log('Proposing tx: send 100 to dave...');
const p1 = engine.vm.call('wallet-1', 'main', { action: 'propose', to: 'dave', amount: 100 }, 'alice');
console.log(`  Proposal ID: ${p1.result}\n`);

console.log('Bob approves...');
const a1 = engine.vm.call('wallet-1', 'main', { action: 'approve', txId: 0 }, 'bob');
console.log(`  Result: ${JSON.stringify(a1.result)} (2-of-3 threshold met → executed)\n`);

console.log('All contracts:');
console.log(JSON.stringify(engine.vm.listContracts(), null, 2));
console.log('\n✅ Smart contract example complete.');
