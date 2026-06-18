/**
 * Triadix Chain v3.0 — P2P WebSocket Network Example
 * Starts a WebSocket server, connects peers, and broadcasts messages.
 */

import { TriadicEngine } from '../src/core/triadix-core.js';

console.log('═══════════════════════════════════════════');
console.log('  TRIADIX CHAIN v3.0 — P2P Network Demo');
console.log('═══════════════════════════════════════════\n');

const engine = new TriadicEngine({ nodeId: 'node-1' });
engine.run(10);

const gossip = engine.gossip;

// ── Start WebSocket Server ────────────────────────────────────────
console.log('Starting WebSocket server...');
const server = await gossip.startServer(19001);
console.log(`  Server started on port ${server.port}`);
console.log(`  Node ID: ${server.nodeId}\n`);

// ── Add Peers ─────────────────────────────────────────────────────
console.log('Adding peers...');
gossip.addPeer('peer-alpha', '127.0.0.1', 19002, 'Alpha Node');
gossip.addPeer('peer-beta', '127.0.0.1', 19003, 'Beta Node');
gossip.addPeer('peer-gamma', '127.0.0.1', 19004, 'Gamma Node');
console.log(`  Peers: ${gossip.peers.size}`);
console.log(`  Peer list: ${gossip.listPeers().map(p => p.peerId).join(', ')}\n`);

// ── Broadcast Messages ────────────────────────────────────────────
console.log('Broadcasting NEW_TX...');
const txMsg = gossip.createMessage('NEW_TX', {
  txId: 'tx-' + Date.now().toString(36),
  from: 'alice', to: 'bob', amount: 25, nonce: 0
});
const txDelivery = gossip.gossip(txMsg);
console.log(`  Delivered to: ${txDelivery.delivered} peers`);
console.log(`  WS delivered: ${txDelivery.wsDelivered}`);
console.log(`  Message ID: ${txDelivery.messageId}\n`);

console.log('Broadcasting NEW_BLOCK...');
const blockMsg = gossip.createMessage('NEW_BLOCK', {
  index: engine.chain.length - 1,
  hC: engine.chain[engine.chain.length - 1].hC,
});
const blockDelivery = gossip.gossip(blockMsg);
console.log(`  Delivered to: ${blockDelivery.delivered} peers\n`);

console.log('Broadcasting PEER_DISCOVERY...');
const discMsg = gossip.createMessage('PEER_DISCOVERY', {
  knownPeers: gossip.listPeers().map(p => ({ id: p.peerId, port: p.port })),
});
const discDelivery = gossip.gossip(discMsg);
console.log(`  Delivered to: ${discDelivery.delivered} peers\n`);

// ── Dedup Test ────────────────────────────────────────────────────
console.log('Testing dedup (same message again)...');
const dup = gossip.gossip(txMsg);
console.log(`  Result: ${dup.reason} ✅\n`);

// ── Network State ─────────────────────────────────────────────────
const netState = gossip.getNetworkState();
console.log('Network state:');
console.log(`  Server running: ${netState.serverRunning}`);
console.log(`  Peer count: ${netState.peerCount}`);
console.log(`  WS connections: ${netState.wsConnections}`);
console.log(`  Messages seen: ${netState.messagesSeen}`);
console.log(`  Chain tip: index=${netState.chainTip?.index}, hC=${netState.chainTip?.hC?.substring(0, 20)}...\n`);

// ── Full Network Simulation ──────────────────────────────────────
console.log('Running full network simulation (10 peers)...');
const simResult = gossip.createMessage('CHAIN_SYNC', { blocks: engine.chain.length });
for (let i = 0; i < 10; i++) {
  gossip.addPeer(`sim-peer-${i}`, '127.0.0.1', 2000 + i, `Sim Node ${i}`);
}
const simDelivery = gossip.gossip(simResult);
console.log(`  Simulated ${gossip.peers.size} peers`);
console.log(`  Broadcast delivered to: ${simDelivery.delivered} peers\n`);

// ── Stop Server ───────────────────────────────────────────────────
console.log('Stopping WebSocket server...');
const stopResult = await gossip.stopServer();
console.log(`  Server stopped: ${stopResult.stopped}`);
console.log(`  Server running: ${gossip.getNetworkState().serverRunning}`);

console.log('\n✅ P2P network example complete.');
