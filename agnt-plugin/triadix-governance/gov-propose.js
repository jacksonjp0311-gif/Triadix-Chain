import fs from 'fs';
import { TriadicEngine } from './node_modules/triadix-ledger/triadix-core.js';

/**
 * Create a proposal in a DAO.
 * Proposals can be: action, add_member, remove_member, change_quorum, change_voting_period, custom
 */

class GovPropose {
  constructor() { this.name = 'gov-propose'; }

  async execute(params) {
    try {
      const stateFile = String(params?.stateFile || '').trim();
      if (!stateFile) throw new Error('stateFile is required');
      if (!fs.existsSync(stateFile)) throw new Error(`State file not found: ${stateFile}`);

      const daoAddress = String(params?.daoAddress || '').trim();
      const proposer = String(params?.proposer || '').trim();
      const proposalType = String(params?.proposalType || 'action');
      const title = String(params?.title || '').trim();
      const description = String(params?.description || '').trim();

      if (!daoAddress) throw new Error('daoAddress is required');
      if (!proposer) throw new Error('proposer is required');
      if (!title) throw new Error('title is required');

      const engine = TriadicEngine.loadFromFile(stateFile);

      // Verify DAO exists
      const daoState = engine.vm.getState(daoAddress);
      if (!daoState || !daoState.initialized) throw new Error(`DAO not found: ${daoAddress}`);

      // Build proposal args
      const callArgs = {
        action: 'propose',
        proposalType,
        title,
        description,
        createdAt: Date.now(),
        targetAgent: params?.targetAgent ? String(params.targetAgent).trim() : null,
        newQuorum: params?.newQuorum ? Number(params.newQuorum) : null,
        newVotingPeriod: params?.newVotingPeriod ? Number(params.newVotingPeriod) : null,
        actionData: params?.actionData ? String(params.actionData) : null,
      };

      const result = engine.vm.call(daoAddress, 'main', callArgs, proposer, 100000);
      if (!result.success) throw new Error(`Proposal failed: ${result.error}`);

      // Record as transaction
      const tx = { sender: proposer, receiver: daoAddress, 0: 0, data: `PROPOSE:${title}`, nonce: engine.accountNonces[proposer] || 0 };
      tx.txId = proposer + '-propose-' + Date.now().toString(36);
      engine.addBlock([tx]);

      engine.saveToFile(stateFile);

      return {
        success: true,
        proposalId: result.result?.proposalId || 'unknown',
        proposalType,
        proposer,
        title,
        txId: tx.txId,
        chainLength: engine.chain.length,
        error: '',
      };
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  }
}

export default new GovPropose();
