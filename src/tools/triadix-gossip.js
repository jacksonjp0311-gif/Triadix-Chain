import { TriadicEngine, asciiCoherenceChart, formatSummaryMarkdown } from './triadix-core.js';
import fs from 'fs';

class TriadixGossip {
  constructor() { this.name = 'triadix-gossip'; }

  async execute(params) {
    try {
      const action = String(params?.action || 'gossip-status');
      const stateFile = String(params?.stateFile || '').trim();
      const peerId = String(params?.peerId || '').trim();
      const peerHost = String(params?.peerHost || '127.0.0.1');
      const peerPort = Number(params?.peerPort || 0);
      const peerLabel = String(params?.peerLabel || '');
      const messageType = String(params?.messageType || 'PEER_DISCOVERY');
      const simulatePeers = Number(params?.simulatePeers || 0);
      const wsPort = Number(params?.wsPort || 0);
      const wsConnectHost = String(params?.wsConnectHost || '');
      const wsConnectPort = Number(params?.wsConnectPort || 0);

      let engine;
      if (stateFile && fs.existsSync(stateFile)) {
        engine = TriadicEngine.loadFromFile(stateFile);
      } else {
        engine = new TriadicEngine();
        engine.run(1);
      }

      const gossip = engine.gossip;
      let result = {};

      switch (action) {
        case 'add-peer':
          if (!peerId) throw new Error('peerId required');
          result = gossip.addPeer(peerId, peerHost, peerPort, peerLabel);
          break;
        case 'remove-peer':
          gossip.removePeer(peerId);
          result = { removed: peerId };
          break;
        case 'list-peers':
          result = { peers: gossip.listPeers(), count: gossip.peers.size };
          break;
        case 'broadcast-tx': {
          const txData = params?.txData || { type: 'test', from: 'alice', to: 'bob', amount: 5 };
          const msg = gossip.createMessage(messageType, txData);
          result = { message: msg, delivery: gossip.gossip(msg) };
          break;
        }
        case 'broadcast-block': {
          const blockRef = engine.chain.length > 0
            ? { index: engine.chain.length - 1, hC: engine.chain[engine.chain.length - 1].hC }
            : { index: 0, hC: '0'.repeat(64) };
          const msg = gossip.createMessage('NEW_BLOCK', blockRef);
          result = { message: msg, delivery: gossip.gossip(msg), blockRef };
          break;
        }
        case 'start-ws-server':
          if (!wsPort) throw new Error('wsPort required');
          result = await gossip.startServer(wsPort);
          break;
        case 'stop-ws-server':
          result = await gossip.stopServer();
          break;
        case 'connect-ws':
          if (!peerId || !wsConnectHost || !wsConnectPort) throw new Error('peerId, wsConnectHost, wsConnectPort required');
          result = await gossip.connectToPeer(peerId, wsConnectHost, wsConnectPort);
          break;
        case 'gossip-status':
          result = gossip.getNetworkState();
          break;
        case 'full-network-sim': {
          const nPeers = Math.max(2, Math.min(50, simulatePeers || 5));
          const simulatedPeers = [];
          for (let i = 0; i < nPeers; i++) {
            const pid = `peer-${i + 1}`;
            const port = 8000 + i;
            simulatedPeers.push({ peerId: pid, port, ...gossip.addPeer(pid, '127.0.0.1', port, `Node ${i + 1}`) });
          }
          const broadcasts = [];
          const txMsg = gossip.createMessage('NEW_TX', { type: 'multi-sig', from: 'alice', to: 'bob', amount: 25, nonce: 0 });
          broadcasts.push({ type: 'NEW_TX', ...gossip.gossip(txMsg) });
          const blockMsg = gossip.createMessage('NEW_BLOCK', { index: engine.chain.length - 1 || 0, hC: engine.chain.length > 0 ? engine.chain[engine.chain.length - 1].hC : '0'.repeat(64) });
          broadcasts.push({ type: 'NEW_BLOCK', ...gossip.gossip(blockMsg) });
          const discMsg = gossip.createMessage('PEER_DISCOVERY', { knownPeers: simulatedPeers.map(p => ({ id: p.peerId, port: p.port })) });
          broadcasts.push({ type: 'PEER_DISCOVERY', ...gossip.gossip(discMsg) });
          result = { networkSize: nPeers, simulatedPeers, broadcastResults: broadcasts, messagesSeen: gossip.seenMessages.size, messageLog: gossip.messageLog, networkState: gossip.getNetworkState() };
          break;
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      if (stateFile) engine.saveToFile(stateFile);

      const report = engine.statusReport();
      return {
        success: true, action, gossipResult: result,
        networkState: gossip.getNetworkState(),
        chainLength: engine.chain.length, chainValid: report.valid,
        asciiChart: engine.chain.length > 1 ? asciiCoherenceChart(engine.chain, engine.tau) : undefined,
        summaryMarkdown: formatSummaryMarkdown(report, report.coherenceStats),
        error: '',
      };
    } catch (error) {
      return { success: false, error: error?.message || String(error) });
    }
  }
}

export default new TriadixGossip();
