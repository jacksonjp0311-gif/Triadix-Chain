/**
 * Triadix Chain v3.0.1 — Full Integration Test
 */

import { TriadicEngine, Wallet, MerkleTree, asciiCoherenceChart, formatSummaryMarkdown } from './src/core/triadix-core.js';
import fs from 'fs';

let pass = 0, fail = 0;
const assert = (cond, msg) => {
  if (cond) { pass++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.log(`  ❌ ${msg}`); }
};

const log = (n, title) => {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${n}. ${title}`);
  console.log('═'.repeat(60));
};

// 1. CHAIN GENERATION + COHERENCE
log(1, 'CHAIN GENERATION + COHERENCE');
const engine = new TriadicEngine({
  tau: 0.244, healthMode: 'p25', nodeId: 'node-1',
  validators: ['v1', 'v2', 'v3', 'v4'], agentId: 'annie'
});
const t0 = Date.now();
const chain = engine.run(96);
const elapsed = (Date.now() - t0) / 1000;
const stats = engine.coherenceStats();
assert(chain.length === 96, '96 blocks generated');
assert(engine.isChainValid(), 'Chain is valid');
assert(stats.p25 > 0.23, `p25 coherence: ${stats.p25.toFixed(6)}`);
assert(stats.min > 0.20, `min coherence: ${stats.min.toFixed(6)}`);
assert(engine.getMerkleRoot() !== null, `Merkle root: ${engine.getMerkleRoot().substring(0, 32)}...`);

// 2. ED25519 WALLET + SIGNED TRANSACTIONS
log(2, 'ED25519 WALLET + SIGNED TRANSACTIONS');
const wallet = new Wallet();
assert(wallet.address.length === 40, `Address: ${wallet.address}`);
const msg = 'triadix-payment-alice-to-bob-50-tokens';
const sig = wallet.sign(msg);
assert(sig.length > 0, `Signature: ${sig.substring(0, 40)}...`);
assert(Wallet.verify(msg, sig, wallet.publicKey), 'Signature verified');
assert(!Wallet.verify('tampered', sig, wallet.publicKey), 'Tampered rejected');
const w2 = Wallet.fromPrivateKey(wallet.privateKey);
assert(w2.address === wallet.address, 'Restored wallet matches');
assert(w2.publicKey === wallet.publicKey, 'Restored public key matches');
const tx = { sender: wallet.address, receiver: 'bob', amount: 50, data: 'payment', nonce: 0 };
const signedTx = wallet.signTx(tx);
assert(signedTx.signature.length > 0 && signedTx.txId.length === 64, 'TX signed');

// 3. SMART CONTRACTS + GAS METERING
log(3, 'SMART CONTRACTS + GAS METERING');
const counterCode = `
  if (!state.count) state.count = 0;
  if (!state.history) state.history = [];
  if (args.action === 'increment') {
    state.count = add(state.count, args.amount || 1);
    state.history.push({ by: caller, amount: args.amount || 1 });
    log('count: ' + state.count);
    return state.count;
  }
  if (args.action === 'transfer') {
    const tx = transfer(args.to, args.amount);
    state.count = add(state.count, -args.amount);
    return { balance: state.count, tx };
  }
  return state.count;
`;
const deploy = engine.vm.deploy('counter-1', counterCode, 'alice', { count: 0, history: [] }, 100000);
assert(deploy.gasCost > 0, `Deploy gas: ${deploy.gasCost}`);
const c1 = engine.vm.call('counter-1', 'main', { action: 'increment', amount: 5 }, 'alice', 50000);
assert(c1.success && c1.result === 5, `Increment(5): ${c1.result}`);
const c2 = engine.vm.call('counter-1', 'main', { action: 'increment', amount: 3 }, 'bob', 50000);
assert(c2.success && c2.result === 8, `Increment(3): ${c2.result}`);
const c3 = engine.vm.call('counter-1', 'main', { action: 'transfer', to: 'charlie', amount: 2 }, 'alice', 50000);
assert(c3.success && c3.result.balance === 6, `Transfer(2): balance=${c3.result.balance}`);
assert(engine.vm.logs.length > 0, `VM logs: ${engine.vm.logs.length} entries`);

// 4. PBFT CONSENSUS
log(4, 'PBFT CONSENSUS');
const pbft = engine.consensus;
assert(pbft.validatorCount === 4, `Validators: ${pbft.validatorCount}`);
assert(pbft.getQuorumSize() === 3, `Quorum: ${pbft.getQuorumSize()}`);
const primary = pbft.electPrimary();
assert(primary !== null, `Primary: ${primary}`);
const prop = pbft.propose('block-97', chain[95].hC);
assert(prop.phase === 'pre-prepare', `Proposed: ${prop.proposalId}`);
pbft.vote('block-97', 'v1', 'prepare', true);
pbft.vote('block-97', 'v2', 'prepare', true);
pbft.vote('block-97', 'v3', 'prepare', true);
let check = pbft.checkProposal('block-97');
assert(check.status === 'prepared', `Prepared: ${check.prepareCount}/${check.quorum}`);
pbft.vote('block-97', 'v1', 'commit', true);
pbft.vote('block-97', 'v2', 'commit', true);
pbft.vote('block-97', 'v3', 'commit', true);
check = pbft.checkProposal('block-97');
assert(check.status === 'committed', `Committed: ${check.commitCount}/${check.quorum}`);
assert(pbft.consensusLog.length > 0, `Log: ${pbft.consensusLog.length} entries`);

// 5. MERKLE PROOFS
log(5, 'MERKLE PROOFS (SPV)');
const leaves = ['tx-a', 'tx-b', 'tx-c', 'tx-d'];
const tree = new MerkleTree(leaves);
const root = tree.getRoot();
assert(root.length === 64, `Root: ${root.substring(0, 32)}...`);
const proof = tree.getProof(1);
assert(proof !== null && proof.length > 0, `Proof: ${proof.length} siblings`);
assert(MerkleTree.verifyProof('tx-b', proof, root), 'Proof verified');
assert(!MerkleTree.verifyProof('fake', proof, root), 'Fake rejected');

// 6. AGENT MEMORY BRIDGE
log(6, 'AGENT MEMORY BRIDGE');
const bridge = engine.agentBridge;
bridge.recordAction('tool_call', 'web_search', { query: 'AI agents' }, { results: 8 });
bridge.recordAction('tool_call', 'execute_javascript', { code: '1+1' }, { result: 2 });
bridge.recordAction('memory_save', 'save_agent_memory', { type: 'fact' }, { saved: true });
bridge.recordAction('tool_call', 'triadix-run', { blocks: 96 }, { valid: true });
bridge.recordAction('tool_call', 'triadix-consensus', { action: 'propose' }, { committed: true });
assert(bridge.getActionHistory().length === 5, `Actions: ${bridge.getActionHistory().length}`);
assert(engine.chain.length > 96, `Auto-block: ${engine.chain.length} blocks`);
const coherence = bridge.getAgentCoherence();
assert(coherence.evaluable, 'Coherence evaluable');
assert(coherence.avgCoherence > 0, `Avg coherence: ${coherence.avgCoherence.toFixed(6)}`);

// 7. P2P GOSSIP
log(7, 'P2P GOSSIP');
const gossip = engine.gossip;
gossip.addPeer('peer-1', '127.0.0.1', 8001, 'Peer 1');
gossip.addPeer('peer-2', '127.0.0.1', 8002, 'Peer 2');
assert(gossip.peers.size === 2, `Peers: ${gossip.peers.size}`);
const gMsg = gossip.createMessage('NEW_TX', { from: 'alice', to: 'bob', amount: 10 });
const delivery = gossip.gossip(gMsg);
assert(delivery.delivered > 0, `Delivered: ${delivery.delivered}`);
const dup = gossip.gossip(gMsg);
assert(dup.reason === 'already_seen', 'Dedup working');

// 8. PERSISTENCE
log(8, 'PERSISTENCE');
const stateFile = './_test-state.json';
engine.saveToFile(stateFile);
assert(fs.existsSync(stateFile), 'State saved');
const loaded = TriadicEngine.loadFromFile(stateFile);
assert(loaded.chain.length === engine.chain.length, `Loaded: ${loaded.chain.length} blocks`);
assert(loaded.isChainValid(), 'Loaded chain valid');
fs.unlinkSync(stateFile);

// 9. MULTI-SIG WALLET
log(9, 'MULTI-SIG WALLET CONTRACT');
const walletCode = `
  if (!state.owners) state.owners = args.owners || [caller];
  if (!state.required) state.required = args.required || 1;
  if (!state.transactions) state.transactions = [];
  if (args.action === 'propose') {
    const id = state.transactions.length;
    state.transactions.push({ to: args.to, amount: args.amount, proposer: caller, approvals: [caller], executed: false, id });
    return id;
  }
  if (args.action === 'approve') {
    const t = state.transactions[args.txId];
    if (!t) throw new Error('Tx not found');
    if (t.approvals.includes(caller)) throw new Error('Already approved');
    t.approvals.push(caller);
    if (t.approvals.length >= state.required) { t.executed = true; }
    return { txId: args.txId, approvals: t.approvals.length, executed: t.executed };
  }
  return { txCount: state.transactions.length };
`;
engine.vm.deploy('wallet-1', walletCode, 'alice', { owners: ['alice','bob','charlie'], required: 2, transactions: [] });
const p1 = engine.vm.call('wallet-1', 'main', { action: 'propose', to: 'dave', amount: 100 }, 'alice');
assert(p1.result === 0, `Proposal ID: ${p1.result}`);
const a1 = engine.vm.call('wallet-1', 'main', { action: 'approve', txId: 0 }, 'bob');
assert(a1.result.executed === true, `2-of-3 executed: ${a1.result.executed}`);

// 10. FORMATTING
log(10, 'ASCII CHART + MARKDOWN');
const chart = asciiCoherenceChart(chain, 0.244);
assert(chart.includes('Coherence C_n') && chart.includes('●'), 'ASCII chart OK');
const report = engine.statusReport();
const md = formatSummaryMarkdown(report, stats);
assert(md.includes('# Triadix Ledger Report') && md.includes('Coherence Statistics'), 'Markdown OK');

// SUMMARY
console.log(`\n${'═'.repeat(60)}`);
console.log(`  RESULTS`);
console.log('═'.repeat(60));
console.log(`\n  ✅ Passed: ${pass}  ❌ Failed: ${fail}  📊 Total: ${pass + fail}`);
if (fail === 0) console.log('\n  🎉 ALL TESTS PASSED — Triadix Chain v3.0.1 is solid!');
else console.log(`\n  ⚠️  ${fail} test(s) failed`);
console.log(`\n  Chain: ${engine.chain.length} blocks | Valid: ${engine.isChainValid()}`);
console.log(`  Contracts: ${engine.vm.listContracts().length} | Gas: ${engine.vm.gasUsed}`);
console.log(`  PBFT: ${pbft.validatorCount} validators | Phase: ${pbft.phase} | Committed: ${pbft.committed.size}`);
console.log(`  Wallets: ${engine.wallets.size} | Agent actions: ${bridge.getActionHistory().length}`);
console.log(`  Peers: ${gossip.peers.size} | Merkle: ${engine.getMerkleRoot().substring(0, 20)}...`);
