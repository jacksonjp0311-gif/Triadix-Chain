import fs from 'fs';
import { TriadicEngine } from './node_modules/triadix-ledger/triadix-core.js';

/**
 * Get full DAO information: members, proposals, governance rules, status.
 */

class GovDaoInfo {
  constructor() { this.name = 'gov-dao-info'; }

  async execute(params) {
    try {
      const stateFile = String(params?.stateFile || '').trim();
      if (!stateFile) throw new Error('stateFile is required');
      if (!fs.existsSync(stateFile)) throw new Error(`State file not found: ${stateFile}`);

      const daoAddress = String(params?.daoAddress || '').trim();
      if (!daoAddress) throw new Error('daoAddress is required');

      const engine = TriadicEngine.loadFromFile(stateFile);

      // Verify DAO exists
      const daoState = engine.vm.getState(daoAddress);
      if (!daoState || !daoState.initialized) throw new Error(`DAO not found: ${daoAddress}`);

      // Get full info from contract
      const info = engine.vm.call(daoAddress, 'main', { action: 'info' }, 'system', 50000);
      if (!info.success) throw new Error(`Info failed: ${info.error}`);

      const data = info.result || {};

      return {
        success: true,
        daoName: data.daoName || 'Unknown',
        founder: data.founder || 'Unknown',
        members: data.members || [],
        quorum: data.quorum || 0,
        votingPeriod: data.votingPeriod || 0,
        proposalCount: data.proposalCount || 0,
        activeProposals: data.activeProposals || 0,
        proposals: (data.proposals || []).map(p => ({
          id: p.id,
          title: p.title,
          type: p.type,
          status: p.status,
          yesVotes: p.yes,
          noVotes: p.no,
          proposer: p.proposer,
        })),
        error: '',
      };
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  }
}

export default new GovDaoInfo();
