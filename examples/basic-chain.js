/**
 * Triadix Chain v3.0 — Basic Chain Example
 * Generates a triadic hash chain, validates it, and prints coherence stats.
 */

import { TriadicEngine, asciiCoherenceChart } from '../src/core/triadix-core.js';

console.log('═══════════════════════════════════════════');
console.log('  TRIADIX CHAIN v3.0 — Basic Chain Example');
console.log('═══════════════════════════════════════════\n');

// Create engine with 4 validators for PBFT
const engine = new TriadicEngine({
  tau: 0.244,
  healthMode: 'p25',
  nodeId: 'node-1',
  validators: ['v1', 'v2', 'v3', 'v4'],
  agentId: 'demo-agent',
});

// Generate 96 blocks
const t0 = Date.now();
const chain = engine.run(96);
const elapsed = (Date.now() - t0) / 1000;

// Results
const stats = engine.coherenceStats();
const report = engine.statusReport();

console.log(`Chain length:    ${chain.length} blocks`);
console.log(`Valid:           ${engine.isChainValid() ? '✅ Yes' : '❌ No'}`);
console.log(`Healthy:         ${engine.isHealthy() ? '✅ Yes' : '❌ No'}`);
console.log(`Time:            ${elapsed.toFixed(4)}s (${(chain.length / elapsed).toFixed(0)} blocks/sec)`);
console.log(`Merkle root:     ${engine.getMerkleRoot()?.substring(0, 40)}...`);
console.log('');
console.log('Coherence:');
console.log(`  min:   ${stats.min.toFixed(6)}`);
console.log(`  max:   ${stats.max.toFixed(6)}`);
console.log(`  mean:  ${stats.mean.toFixed(6)}`);
console.log(`  p25:   ${stats.p25.toFixed(6)} (τ = 0.244)`);
console.log(`  p50:   ${stats.p50.toFixed(6)}`);
console.log(`  final: ${stats.final.toFixed(6)}`);
console.log(`  fraction ≥ τ: ${(stats.fractionGeTau * 100).toFixed(1)}%`);
console.log('');
console.log('Subsystems:');
console.log(`  Contracts:  ${report.contracts.length} deployed`);
console.log(`  Validators: ${report.consensus.validatorCount} (quorum: ${report.consensus.quorumSize})`);
console.log(`  Peers:      ${report.network.peerCount}`);
console.log(`  Wallets:    ${report.wallets}`);
console.log('');

// ASCII chart
console.log(asciiCoherenceChart(chain, 0.244));
console.log('\n✅ Basic chain example complete.');
