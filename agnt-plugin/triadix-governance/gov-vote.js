import fs from 'fs';
import { TriadicEngine } from './node_modules/triadix-ledger/triadix-core.js';

/**
 * Vote on a DAO proposal. Only DAO members can vote.
 */

class GovVote {
  constructor() { this.name = 'gov-vote'; }

  async execute(params) {
    try {
      const stateFile = String(params?.stateFile || '').trim();
      if (!stateFile) throw new Error('stateFile is required');
      if (!fs.existsSync(stateFile)) throw new Error(`State file not found: ${stateFile}`);

      const daoAddress = String(params?.daoAddress || '').trim();
      const proposalId = String(params?.proposalId || '').trim();
      const voter = String(params?.voter || '').trim();
      const approve = params?.approve !== 'false';

      if (!daoAddress) throw new Error('daoAddress is required');
      if (!proposalId) throw new Error('proposalId is required');
      if (!voter) throw new Error('voter is required');

      const engine = TriadicEngine.loadFromFile(stateFile);

      // Verify DAO exists
      const daoState = engine.vm.getState(daoAddress);
      if (!daoState || !daoState.initialized) throw new Error(`DAO not found: ${daoAddress}`);

      const result = engine.vm.call(daoAddress, 'main', {
        action: 'vote',
        proposalId,
        approve,
      }, voter, 50000);

      if (!result.success) throw new Error(`Vote failed: ${result.error}`);

      // Record as transaction
      const tx = { sender: voter, receiver: daoAddress, 0: 0, data: `VOTE:${proposalId}:${approve}`, nonce: engine.accountNonces[voter] || 0 };
      tx.txId = voter + '-vote-' + Date.now().toString(36);
      engine.addBlock([tx]);

      engine.saveToFile(stateFile);

      return {
        success: true,
        proposalId,
        voter,
        vote: approve ? 'yes' : 'no',
        yesVotes: result.result?.yesCount || 0,
        noVotes: result.result?.noCount || 0,
        txId: tx.txId,
        error: '',
      };
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  }
}

export default new GovVote();
