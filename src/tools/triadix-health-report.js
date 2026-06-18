import fs from 'fs';
import { TriadicEngine, asciiCoherenceChart, formatSummaryMarkdown } from './triadix-core.js';

class TriadixHealthReport {
  constructor() { this.name = 'triadix-health-report'; }

  async execute(params) {
    try {
      const stateFile = String(params?.stateFile || '').trim();
      if (!stateFile) throw new Error('stateFile is required');
      if (!fs.existsSync(stateFile)) throw new Error(`State file not found: ${stateFile}`);

      const tau = Number(params?.tau ?? 0.244);
      const healthMode = String(params?.healthMode ?? 'p25');

      const engine = TriadicEngine.loadFromFile(stateFile);
      engine.tau = tau;
      engine.healthMode = healthMode;

      const report = engine.statusReport();
      const stats = report.coherenceStats;
      const asciiChart = asciiCoherenceChart(engine.chain, tau);
      const summaryMarkdown = formatSummaryMarkdown(report, stats);

      let healthVerdict = '';
      if (!report.healthEvaluable) {
        healthVerdict = `⚠️ ${engine.chain.length} blocks — need ${engine.minHealthBlocks} minimum.`;
      } else if (report.healthy) {
        healthVerdict = `✅ HEALTHY. p25=${stats.p25.toFixed(6)} ≥ τ=${tau}. ${(stats.fractionGeTau * 100).toFixed(1)}% meet threshold.`;
      } else {
        healthVerdict = `❌ UNHEALTHY. p25=${stats.p25.toFixed(6)} < τ=${tau}. Only ${(stats.fractionGeTau * 100).toFixed(1)}% meet threshold.`;
      }

      return {
        success: true, chainLength: engine.chain.length,
        valid: report.valid, healthy: report.healthy, healthEvaluable: report.healthEvaluable,
        tau, healthMode, coherence: stats,
        mempoolSize: engine.mempool.length, waitingMempoolSize: engine.waitingMempool.length,
        accountNonces: engine.accountNonces, checkpoints: engine.checkpointMap(),
        merkleRoot: engine.getMerkleRoot(),
        contracts: report.contracts, vmGasUsed: report.vmGasUsed,
        consensusState: report.consensus, networkState: report.network,
        agentActions: report.agentActions, agentCoherence: report.agentCoherence,
        wallets: report.wallets,
        asciiChart, summaryMarkdown, healthVerdict, error: '',
      };
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  }
}

export default new TriadixHealthReport();
