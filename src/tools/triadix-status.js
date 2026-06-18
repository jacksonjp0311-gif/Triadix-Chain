import fs from 'fs';
import { TriadicEngine } from './triadix-core.js';

class TriadixStatus {
  constructor() { this.name = 'triadix-status'; }

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
      return {
        success: true,
        chainLength: engine.chain.length,
        valid: report.valid, healthy: report.healthy, healthEvaluable: report.healthEvaluable,
        tau, healthMode, coherence: report.coherenceStats,
        mempoolSize: engine.mempool.length, waitingMempoolSize: engine.waitingMempool.length,
        receiptCount: Object.keys(engine.receipts).length,
        checkpoints: engine.checkpointMap(), accountNonces: engine.accountNonces,
        merkleRoot: engine.getMerkleRoot(),
        contracts: report.contracts, vmGasUsed: report.vmGasUsed,
        consensusState: report.consensus,
        networkState: report.network,
        agentActions: report.agentActions,
        agentCoherence: report.agentCoherence,
        wallets: report.wallets,
        error: '',
      };
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  }
}

export default new TriadixStatus();
