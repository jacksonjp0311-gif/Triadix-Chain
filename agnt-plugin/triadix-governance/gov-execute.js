import fs from 'fs';
import { TriadicEngine } from './node_modules/triadix-ledger/triadix-core.js';

/**
 * Execute a passed DAO proposal. Voting period must have ended and quorum must be met.
 */

class GovExecute {
  constructor() { this.name = 'gov-execute'; }

  async execute(params) {
    try {
      const stateFile = String(params?.stateFile || '').trim();
      if (!stateFile) throw new Error('stateFile is required');
      if (!fs.existsSync(stateFile)) throw new Error(`State file not found: ${stateFile}`);

      const daoAddress = String(params?.daoAddress || '').trim();
      const proposalId = String(params?.proposalId || '').trim();
      const executor = String(params?.executor || '').trim();

      if (!daoAddress) throw new Error('daoAddress is required');
      if (!proposalId) throw new Error('proposalId is required');
      if (!executor) throw new Error('executor is required');

      const engine = TriadicEngine.loadFromFile(stateFile);

      // Verify DAO exists
      const daoState = engine.vm.getState(daoAddress);
      if (!daoState || !daoState.initialized) throw new Error(`DAO not found: ${daoAddress}`);

      const result = engine.vm.call(daoAddress, 'main', {
        action: 'execute',
        proposalId,
      }, executor, 100000);

      if (!result.success) throw new Error(`Execution failed: ${result.error}`);

      const execResult = result.result || {};

      // Record as transaction
      const tx = { sender: executor, receiver: daoAddress, 0: 0, data: `EXECUTE:${proposalId}`, nonce: engine.accountNonces[executor] || 0 };
      tx.txId = executor + '-execute-' + Date.now().toString(36);
      engine.addBlock([tx]);

      engine.saveToFile(stateFile);

      return {
        success: true,
        proposalId,
        executed: execResult.executed || false,
        result: execResult,
        txId: tx.txId,
        chainLength: engine.chain.length,
        error: '',
      };
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  }
}

export default new GovExecute();
