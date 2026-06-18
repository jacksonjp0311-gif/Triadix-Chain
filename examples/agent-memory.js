/**
 * Triadix Chain v3.0 — Agent Memory Integration Example
 * Records agent actions as triadic transactions with auto-block building.
 */

import { TriadicEngine } from '../src/core/triadix-core.js';

console.log('═══════════════════════════════════════════');
console.log('  TRIADIX CHAIN v3.0 — Agent Memory Demo');
console.log('═══════════════════════════════════════════\n');

const engine = new TriadicEngine({
  tau: 0.244, nodeId: 'node-1', agentId: 'annie',
});
engine.run(10);

const bridge = engine.agentBridge;

// ── Record Agent Actions ──────────────────────────────────────────
console.log('Recording agent actions...\n');

const actions = [
  { type: 'tool_call', tool: 'web_search', input: { query: 'latest AI research' }, output: { results: 8 } },
  { type: 'tool_call', tool: 'execute_javascript', input: { code: 'Math.PI * 2' }, output: { result: 6.283 } },
  { type: 'memory_save', tool: 'save_agent_memory', input: { type: 'fact', content: 'User prefers concise answers' }, output: { saved: true } },
  { type: 'tool_call', tool: 'triadix-run', input: { blocks: 96 }, output: { valid: true, healthy: true } },
  { type: 'tool_call', tool: 'triadix-consensus', input: { action: 'propose' }, output: { committed: true } },
  { type: 'tool_call', tool: 'triadix-deploy-contract', input: { action: 'deploy' }, output: { address: 'counter-1' } },
  { type: 'memory_save', tool: 'save_agent_memory', input: { type: 'preference', content: 'Use Ed25519 for signing' }, output: { saved: true } },
  { type: 'tool_call', tool: 'triadix-gossip', input: { action: 'broadcast-tx' }, output: { delivered: 3 } },
];

for (const a of actions) {
  const r = bridge.recordAction(a.type, a.tool, a.input, a.output);
  console.log(`  ${a.type}:${a.tool} → tx ${r.txId.substring(0, 16)}... (mempool: ${r.mempoolSize})`);
}

console.log(`\nTotal actions recorded: ${bridge.getActionHistory().length}`);
console.log(`Chain length: ${engine.chain.length} (auto-built blocks from actions)`);

// ── Agent Coherence ───────────────────────────────────────────────
console.log('\n── Agent Coherence Report ──');
const coherence = bridge.getAgentCoherence();
if (coherence.evaluable) {
  console.log(`  Agent blocks:     ${coherence.agentBlocks}`);
  console.log(`  Avg coherence:    ${coherence.avgCoherence.toFixed(6)}`);
  console.log(`  Min coherence:    ${coherence.minCoherence.toFixed(6)}`);
  console.log(`  Max coherence:    ${coherence.maxCoherence.toFixed(6)}`);
  console.log(`  Drift:            ${coherence.drift.toFixed(6)}`);
  console.log(`  Status:           ${coherence.drift < 0.05 ? '✅ Stable' : '⚠️ Drifting'}`);
} else {
  console.log('  Not enough data for coherence evaluation');
}

// ── Action History ────────────────────────────────────────────────
console.log('\n── Action History ──');
for (const a of bridge.getActionHistory()) {
  console.log(`  [${new Date(a.timestamp).toISOString()}] ${a.actionType}:${a.toolName}`);
}

console.log('\n✅ Agent memory example complete.');
