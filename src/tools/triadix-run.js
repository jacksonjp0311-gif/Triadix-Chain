import { TriadicEngine, asciiCoherenceChart, formatSummaryMarkdown } from './triadix-core.js';

class TriadixRun {
  constructor() { this.name = 'triadix-run'; }

  async execute(params) {
    try {
      const blocks = Math.max(1, Math.min(100000, Number(params?.blocks ?? 96)));
      const tau = Number(params?.tau ?? 0.244);
      const healthMode = String(params?.healthMode ?? 'p25');
      const nodeId = String(params?.nodeId || 'node-1');
      const validators = params?.validators || [];

      const t0 = Date.now();
      const engine = new TriadicEngine({ tau, healthMode, nodeId, validators });
      const chain = engine.run(blocks);
      const elapsed = (Date.now() - t0) / 1000;

      const valid = engine.isChainValid();
      const stats = engine.coherenceStats();
      const report = engine.statusReport();
      const evaluable = engine.isHealthEvaluable();
      const healthy = evaluable ? engine.isHealthy() : null;

      return {
        success: true,
        chainLength: chain.length,
        valid, healthy, healthEvaluable: evaluable,
        tau, healthMode, coherence: stats,
        genesis: chain[0] ? { index: chain[0].index, hE: chain[0].hE, hI: chain[0].hI, hC: chain[0].hC, metrics: chain[0].metrics } : null,
        latestBlock: chain.length > 0 ? { index: chain[chain.length - 1].index, hE: chain[chain.length - 1].hE, hI: chain[chain.length - 1].hI, hC: chain[chain.length - 1].hC, metrics: chain[chain.length - 1].metrics } : null,
        elapsedSeconds: elapsed, blocksPerSecond: chain.length / elapsed,
        chain: blocks <= 200 ? chain : undefined,
        merkleRoot: engine.getMerkleRoot(),
        contracts: engine.vm.listContracts(), vmGasUsed: engine.vm.gasUsed,
        consensusState: engine.consensus.getConsensusState(),
        networkState: engine.gossip.getNetworkState(),
        agentActions: engine.agentBridge.getActionHistory().length,
        agentCoherence: engine.agentBridge.getAgentCoherence(),
        wallets: engine.wallets.size,
        asciiChart: asciiCoherenceChart(chain, tau),
        summaryMarkdown: formatSummaryMarkdown(report, stats),
        error: '',
      };
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  }
}

export default new TriadixRun();
