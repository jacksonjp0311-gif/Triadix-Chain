/**
 * Triadix Chain v3.0 — Full PBFT Consensus Example
 * Demonstrates the complete pre-prepare → prepare → commit lifecycle.
 */

import { TriadicEngine } from '../src/core/triadix-core.js';

console.log('═══════════════════════════════════════════');
console.log('  TRIADIX CHAIN v3.0 — PBFT Consensus Demo');
console.log('═══════════════════════════════════════════\n');

const engine = new TriadicEngine({
  tau: 0.244, nodeId: 'node-1',
  validators: ['v1', 'v2', 'v3', 'v4'],
});
engine.run(1);

const pbft = engine.consensus;

// Elect primary
const primary = pbft.electPrimary();
console.log(`Primary elected: ${primary} (view ${pbft.viewNumber})`);
console.log(`Validators: ${Array.from(pbft.validators).join(', ')}`);
console.log(`Quorum: ${pbft.getQuorumSize()} (2/3 threshold)\n`);

// ── Full PBFT Lifecycle ───────────────────────────────────────────
console.log('── Phase 1: PRE-PREPARE ──');
const prop = pbft.propose('block-97', engine.chain[engine.chain.length - 1].hC);
console.log(`Proposal: ${prop.proposalId} by ${prop.proposer}`);
console.log(`Phase: ${prop.phase} | View: ${prop.viewNumber} | Round: ${prop.round}\n`);

console.log('── Phase 2: PREPARE ──');
for (const v of ['v1', 'v2', 'v3']) {
  const r = pbft.vote('block-97', v, 'prepare', true);
  console.log(`  ${v} votes prepare: ${r.accepted}`);
}
let check = pbft.checkProposal('block-97');
console.log(`Status: ${check.status} (${check.prepareCount}/${check.quorum} prepares)\n`);

console.log('── Phase 3: COMMIT ──');
for (const v of ['v1', 'v2', 'v3']) {
  const r = pbft.vote('block-97', v, 'commit', true);
  console.log(`  ${v} votes commit: ${r.accepted}`);
}
check = pbft.checkProposal('block-97');
console.log(`Status: ${check.status} (${check.commitCount}/${check.quorum} commits)\n`);

console.log('── Result ──');
console.log(`✅ Block committed!`);
console.log(`Consensus log entries: ${pbft.consensusLog.length}`);
console.log(`Phase: ${pbft.phase} | View: ${pbft.viewNumber}\n`);

// ── View Change Demo ──────────────────────────────────────────────
console.log('── View Change Demo ──');
const vc1 = pbft.requestViewChange(1);
console.log(`View change request: ${vc1.pending}/${vc1.needed} votes`);
const vc2 = pbft.requestViewChange(1);
console.log(`After more votes: ${vc2.viewChanged ? 'VIEW CHANGED' : 'still pending'}`);
if (vc2.viewChanged) {
  console.log(`New view: ${vc2.newView} | New primary: ${vc2.newPrimary}`);
}

console.log('\n✅ Consensus example complete.');
