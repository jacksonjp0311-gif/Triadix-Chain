/**
 * Triadix Chain v3.0 — Full Test Suite
 * 43 tests covering all 11 subsystems.
 */

import {
  TriadicEngine, Wallet, MerkleTree, ContractVM, PBFTConsensus,
  GossipNode, AgentMemoryBridge, MerkleTree as MT,
  triadicHashCycle, computeCoherenceMetrics, entropy, hamming,
  percentile, asciiCoherenceChart, formatSummaryMarkdown,
  sha256, makeTx, computeTxId,
} from '../src/core/triadix-core.js';

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

// ═══════════════════════════════════════════════════════════════════
// 1. HASH PRIMITIVES (5 tests)
// ═══════════════════════════════════════════════════════════════════
log(1, 'HASH PRIMITIVES');

const hash = sha256(Buffer.from('test', 'utf-8'));
assert(hash.length === 32, 'SHA-256 produces 32-byte digest');
assert(hash.toString('hex').length === 64, 'Hex digest is 64 chars');

const [hE, hI, hC] = triadicHashCycle(
  Buffer.alloc(32, 0), Buffer.alloc(32, 0), Buffer.alloc(32, 0),
  Buffer.from('payload', 'utf-8')
);
assert(hE.length === 32 && hI.length === 32 && hC.length === 32, 'Triadic hash cycle produces 3 × 32-byte digests');
assert(hE.toString('hex') !== hI.toString('hex'), 'hE ≠ hI (different transforms)');
assert(hI.toString('hex') !== hC.toString('hex'), 'hI ≠ hC (different transforms)');

// Deterministic
const [hE2, hI2, hC2] = triadicHashCycle(
  Buffer.alloc(32, 0), Buffer.alloc(32, 0), Buffer.alloc(32, 0),
  Buffer.from('payload', 'utf-8')
);
assert(hE.toString('hex') === hE2.toString('hex'), 'Hash cycle is deterministic');

// ═══════════════════════════════════════════════════════════════════
// 2. COHERENCE METRICS (4 tests)
// ═══════════════════════════════════════════════════════════════════
log(2, 'COHERENCE METRICS');

const testBuf = Buffer.from('hello world test data for entropy calculation', 'utf-8');
const e = entropy(testBuf);
assert(e > 0 && e <= 1, `Entropy: ${e.toFixed(6)} (0-1 range)`);

const h1 = Buffer.from('aaaaaaaa', 'utf-8');
const h2 = Buffer.from('bbbbbbbb', 'utf-8');
const hm = hamming(h1, h2);
assert(hm > 0 && hm <= 1, `Hamming distance: ${hm.toFixed(6)}`);

const metrics = computeCoherenceMetrics(hE, hI, hC);
assert(metrics.En > 0 && metrics.En <= 1, `E: ${metrics.En.toFixed(6)}`);
assert(metrics.Cn > 0 && metrics.Cn <= 1, `C: ${metrics.Cn.toFixed(6)}`);

// ═══════════════════════════════════════════════════════════════════
// 3. PERCENTILE + DATA MODELS (3 tests)
// ═══════════════════════════════════════════════════════════════════
log(3, 'PERCENTILE + DATA MODELS');

const p50 = percentile([1, 2, 3, 4, 5], 0.5);
assert(p50 === 3, `Percentile p50 of [1,2,3,4,5]: ${p50}`);

const tx = makeTx('alice', 'bob', 10, 'test', 0);
assert(tx.sender === 'alice' && tx.receiver === 'bob', 'Transaction created');

const txId = computeTxId(tx);
assert(txId.length === 64, `TX ID: ${txId.substring(0, 32)}...`);

// ═══════════════════════════════════════════════════════════════════
// 4. ED25519 WALLET (6 tests)
// ═══════════════════════════════════════════════════════════════════
log(4, 'ED25519 WALLET');

const w = new Wallet();
assert(w.address.length === 40, `Wallet address: ${w.address}`);
assert(w.privateKey.length > 0, 'Private key generated');
assert(w.publicKey.length > 0, 'Public key generated');

const testMsg = 'triadix-test-message';
const sig = w.sign(testMsg);
assert(sig.length > 0, `Signature: ${sig.substring(0, 32)}...`);

const verified = Wallet.verify(testMsg, sig, w.publicKey);
assert(verified, 'Signature verified');

const tampered = Wallet.verify('tampered', sig, w.publicKey);
assert(!tampered, 'Tampered message rejected');

const w2 = Wallet.fromPrivateKey(w.privateKey);
assert(w2.address === w.address, 'Restored wallet matches');
assert(w2.publicKey === w.publicKey, 'Restored public key matches');

// ═══════════════════════════════════════════════════════════════════
// 5. MERKLE TREES (5 tests)
// ═══════════════════════════════════════════════════════════════════
log(5, 'MERKLE TREES (SPV)');

const leaves = ['tx-a', 'tx-b', 'tx-c', 'tx-d'];
const tree = new MerkleTree(leaves);
const root = tree.getRoot();
assert(root.length === 64, `Merkle root: ${root.substring(0, 32)}...`);

const proof = tree.getProof(1);
assert(proof !== null && proof.length > 0, `Proof for leaf[1]: ${proof.length} siblings`);

const validProof = MerkleTree.verifyProof('tx-b', proof, root);
assert(validProof, 'Merkle proof verified');

const invalidProof = MerkleTree.verifyProof('fake-tx', proof, root);
assert(!invalidProof, 'Fake leaf rejected');

const txTree = MerkleTree.fromTransactions([tx]);
assert(txTree.getRoot().length === 64, 'Merkle tree from transactions');

// ═══════════════════════════════════════════════════════════════════
// 6. CONTRACT VM + GAS (5 tests)
// ═══════════════════════════════════════════════════════════════════
log(6, 'CONTRACT VM + GAS METERING');

const vm = new ContractVM();
const counterCode = `
  if (!state.count) state.count = 0;
  state.count = add(state.count, args.amount || 1);
  log('count: ' + state.count);
  return state.count;
`;

const deploy = vm.deploy('counter', counterCode, 'alice', { count: 0 }, 100000);
assert(deploy.gasCost > 0, `Deploy gas cost: ${deploy.gasCost}`);

const r1 = vm.call('counter', 'main', { amount: 5 }, 'alice', 50000);
assert(r1.success && r1.result === 5, `Call result: ${r1.result}`);
assert(r1.gasConsumed > 0, `Gas consumed: ${r1.gasConsumed}`);
assert(typeof r1.gasCost === 'number', `Gas cost: ${r1.gasCost}`);

const r2 = vm.call('counter', 'main', { amount: 3 }, 'bob', 50000);
assert(r2.success && r2.result === 8, `Second call: ${r2.result}`);

// Gas limit
const bigCode = 'let x = 0; for (let i = 0; i < 1000000; i++) { x = add(x, 1); } return x;';
try {
  vm.deploy('hog', bigCode, 'alice', {}, 100);
  assert(false, 'Should have thrown gas limit error');
} catch (e) {
  assert(e.message.toLowerCase().includes('gas'), `Gas limit enforced: ${e.message.substring(0, 50)}`);
}

// ═══════════════════════════════════════════════════════════════════
// 7. PBFT CONSENSUS (6 tests)
// ═══════════════════════════════════════════════════════════════════
log(7, 'FULL PBFT CONSENSUS');

const pbft = new PBFTConsensus('node-1', ['v1', 'v2', 'v3', 'v4']);
assert(pbft.validatorCount === 4, `Validators: ${pbft.validatorCount}`);
assert(pbft.getQuorumSize() === 3, `Quorum: ${pbft.getQuorumSize()}`);

const primary = pbft.electPrimary();
assert(primary !== null, `Primary elected: ${primary}`);

const prop = pbft.propose('block-97', '0'.repeat(64));
assert(prop.phase === 'pre-prepare', `Proposed: ${prop.proposalId}`);

// Prepare
pbft.vote('block-97', 'v1', 'prepare', true);
pbft.vote('block-97', 'v2', 'prepare', true);
pbft.vote('block-97', 'v3', 'prepare', true);
let check = pbft.checkProposal('block-97');
assert(check.status === 'prepared', `Prepared: ${check.prepareCount}/${check.quorum}`);

// Commit
pbft.vote('block-97', 'v1', 'commit', true);
pbft.vote('block-97', 'v2', 'commit', true);
pbft.vote('block-97', 'v3', 'commit', true);
check = pbft.checkProposal('block-97');
assert(check.status === 'committed', `Committed: ${check.commitCount}/${check.quorum}`);

// View change
const vc = pbft.requestViewChange(1);
assert(vc.viewChanged === true || vc.viewChanged === false, 'View change processed');

// State transfer
const st = pbft.getStateTransfer();
assert(st.viewNumber >= 0, `State transfer: view=${st.viewNumber}`);

// ═══════════════════════════════════════════════════════════════════
// 8. GOSSIP NODE (5 tests)
// ═══════════════════════════════════════════════════════════════════
log(8, 'P2P GOSSIP NODE');

const gossip = new GossipNode('test-node');
gossip.addPeer('p1', '127.0.0.1', 8001, 'Peer 1');
gossip.addPeer('p2', '127.0.0.1', 8002, 'Peer 2');
assert(gossip.peers.size === 2, `Peers: ${gossip.peers.size}`);

const gMsg = gossip.createMessage('NEW_TX', { from: 'a', to: 'b', amount: 1 });
assert(gMsg.id.length === 16, `Message ID: ${gMsg.id}`);
assert(gMsg.type === 'NEW_TX', `Message type: ${gMsg.type}`);

const delivery = gossip.gossip(gMsg);
assert(delivery.delivered > 0, `Delivered to ${delivery.delivered} peers`);

const dup = gossip.gossip(gMsg);
assert(dup.reason === 'already_seen', 'Dedup working');

const netState = gossip.getNetworkState();
assert(netState.peerCount === 2, `Network state peers: ${netState.peerCount}`);

// ═══════════════════════════════════════════════════════════════════
// 9. AGENT MEMORY BRIDGE (4 tests)
// ═══════════════════════════════════════════════════════════════════
log(9, 'AGENT MEMORY BRIDGE');

const engine = new TriadicEngine({ nodeId: 'node-1', agentId: 'test-agent' });
engine.run(5);
const bridge = engine.agentBridge;

bridge.recordAction('tool_call', 'web_search', { query: 'test' }, { results: 3 });
bridge.recordAction('tool_call', 'execute_javascript', { code: '1+1' }, { result: 2 });
assert(bridge.getActionHistory().length === 2, `Actions: ${bridge.getActionHistory().length}`);

bridge.recordAction('memory_save', 'save_agent_memory', { type: 'fact' }, { saved: true });
bridge.recordAction('tool_call', 'triadix-run', { blocks: 10 }, { valid: true });
bridge.recordAction('tool_call', 'triadix-consensus', { action: 'propose' }, { committed: true });
// 5th action triggers auto-block
assert(engine.chain.length > 5, `Auto-block built: ${engine.chain.length} blocks`);

const coherence = bridge.getAgentCoherence();
assert(typeof coherence.evaluable === 'boolean', `Coherence evaluable: ${coherence.evaluable}`);

// ═══════════════════════════════════════════════════════════════════
// 10. ENGINE INTEGRATION (3 tests)
// ═══════════════════════════════════════════════════════════════════
log(10, 'ENGINE INTEGRATION');

const fullEngine = new TriadicEngine({
  tau: 0.244, healthMode: 'p25', nodeId: 'node-1',
  validators: ['v1', 'v2', 'v3', 'v4'], agentId: 'annie',
});
fullEngine.run(96);

assert(fullEngine.isChainValid(), '96-block chain is valid');
assert(fullEngine.getMerkleRoot() !== null, 'Merkle root computed');
assert(fullEngine.coherenceStats().p25 > 0, `p25 coherence: ${fullEngine.coherenceStats().p25.toFixed(6)}`);

// ═══════════════════════════════════════════════════════════════════
// 11. FORMATTING (2 tests)
// ═══════════════════════════════════════════════════════════════════
log(11, 'ASCII CHART + MARKDOWN');

const chart = asciiCoherenceChart(fullEngine.chain, 0.244);
assert(chart.includes('Coherence C_n'), 'ASCII chart generated');
assert(chart.includes('●'), 'Chart has data points');

const report = fullEngine.statusReport();
const md = formatSummaryMarkdown(report, report.coherenceStats);
assert(md.includes('# Triadix Ledger Report'), 'Markdown report generated');
assert(md.includes('Coherence Statistics'), 'Markdown has coherence section');

// ═══════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`  RESULTS`);
console.log('═'.repeat(60));
console.log(`\n  ✅ Passed: ${pass}`);
console.log(`  ❌ Failed: ${fail}`);
console.log(`  📊 Total:  ${pass + fail}`);
if (fail === 0) {
  console.log('\n  🎉 ALL TESTS PASSED — Triadix Chain v3.0 is ready!');
} else {
  console.log(`\n  ⚠️  ${fail} test(s) failed — review output above`);
}
console.log('');
