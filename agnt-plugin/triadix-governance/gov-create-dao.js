import fs from 'fs';
import path from 'path';
import { TriadicEngine, Wallet } from './node_modules/triadix-ledger/triadix-core.js';

/**
 * Governance DAO Factory
 * 
 * Creates a new DAO with governance rules encoded as a smart contract
 * on the Triadix Chain ledger. The DAO contract manages:
 * - Member registry (who can vote)
 * - Proposal lifecycle (create → vote → execute)
 * - Quorum and voting period rules
 * - On-chain execution of passed proposals
 */

// The DAO governance contract code — deployed on-chain
const DAO_CONTRACT_CODE = `
  // Initialize DAO if not already done
  if (!state.initialized) {
    state.initialized = true;
    state.daoName = args.daoName || 'Unnamed DAO';
    state.founder = caller;
    state.quorum = args.quorum || 50;        // percentage
    state.votingPeriod = args.votingPeriod || 100; // blocks
    state.members = {};
    state.proposals = {};
    state.proposalCount = 0;
    state.ledgerCoherence = null;

    // Add founder as first member
    state.members[caller] = { joined: now, weight: 1 };

    // Add initial members if provided
    if (args.members) {
      for (let i = 0; i < args.members.length; i++) {
        const m = args.members[i];
        if (m && m !== caller) {
          state.members[m] = { joined: now, weight: 1 };
        }
      }
    }
    log('DAO created: ' + state.daoName + ' by ' + caller);
    return { created: true, name: state.daoName, members: Object.keys(state.members).length };
  }

  // ── Proposal Creation ──
  if (args.action === 'propose') {
    if (!state.members[caller]) throw new Error('Not a DAO member: ' + caller);
    const id = String(state.proposalCount);
    state.proposals[id] = {
      id,
      proposalType: args.proposalType || 'action',
      title: args.title || 'Untitled',
      description: args.description || '',
      proposer: caller,
      yesVotes: {},
      noVotes: {},
      yesCount: 0,
      noCount: 0,
      status: 'active',
      createdAt: args.createdAt || now,
      expiresAt: args.expiresAt || (now + state.votingPeriod * 60000),
      executed: false,
      targetAgent: args.targetAgent || null,
      newQuorum: args.newQuorum || null,
      newVotingPeriod: args.newVotingPeriod || null,
      actionData: args.actionData || null,
    };
    state.proposalCount++;
    log('Proposal ' + id + ' created by ' + caller + ': ' + args.title);
    return { proposalId: id, status: 'active' };
  }

  // ── Voting ──
  if (args.action === 'vote') {
    if (!state.members[caller]) throw new Error('Not a DAO member: ' + caller);
    const p = state.proposals[args.proposalId];
    if (!p) throw new Error('Proposal not found: ' + args.proposalId);
    if (p.status !== 'active') throw new Error('Proposal not active: ' + p.status);
    if (p.yesVotes[caller] || p.noVotes[caller]) throw new Error('Already voted');
    if (now > p.expiresAt) { p.status = 'expired'; throw new Error('Voting period expired'); }

    const weight = state.members[caller].weight || 1;
    if (args.approve) {
      p.yesVotes[caller] = weight;
      p.yesCount += weight;
    } else {
      p.noVotes[caller] = weight;
      p.noCount += weight;
    }
    log(caller + ' voted ' + (args.approve ? 'YES' : 'NO') + ' on proposal ' + args.proposalId);
    return { voted: true, yesCount: p.yesCount, noCount: p.noCount };
  }

  // ── Execute Proposal ──
  if (args.action === 'execute') {
    const p = state.proposals[args.proposalId];
    if (!p) throw new Error('Proposal not found');
    if (p.executed) throw new Error('Already executed');
    if (now <= p.expiresAt) throw new Error('Voting period not ended');

    const totalMembers = Object.keys(state.members).length;
    const totalVotes = p.yesCount + p.noCount;
    const participation = totalMembers > 0 ? (totalVotes / totalMembers) * 100 : 0;
    const approval = totalVotes > 0 ? (p.yesCount / totalVotes) * 100 : 0;

    if (participation < state.quorum) {
      p.status = 'failed_quorum';
      return { executed: false, reason: 'quorum_not_met', participation: participation.toFixed(2) + '%' };
    }
    if (approval < state.quorum) {
      p.status = 'failed_approval';
      return { executed: false, reason: 'approval_not_met', approval: approval.toFixed(2) + '%' };
    }

    // Execute based on proposal type
    p.executed = true;
    p.status = 'executed';
    let result = { executed: true, proposalId: args.proposalId };

    if (p.proposalType === 'add_member' && p.targetAgent) {
      state.members[p.targetAgent] = { joined: now, weight: 1 };
      result.added = p.targetAgent;
      log('Member added: ' + p.targetAgent);
    }
    if (p.proposalType === 'remove_member' && p.targetAgent) {
      delete state.members[p.targetAgent];
      result.removed = p.targetAgent;
      log('Member removed: ' + p.targetAgent);
    }
    if (p.proposalType === 'change_quorum' && p.newQuorum) {
      state.quorum = p.newQuorum;
      result.newQuorum = p.newQuorum;
      log('Quorum changed to: ' + p.newQuorum + '%');
    }
    if (p.proposalType === 'change_voting_period' && p.newVotingPeriod) {
      state.votingPeriod = p.newVotingPeriod;
      result.newVotingPeriod = p.newVotingPeriod;
      log('Voting period changed to: ' + p.newVotingPeriod + ' blocks');
    }
    if (p.proposalType === 'action' || p.proposalType === 'custom') {
      result.actionData = p.actionData;
      log('Action executed: ' + p.title);
    }

    return result;
  }

  // ── Get DAO Info ──
  if (args.action === 'info') {
    const activeProposals = Object.values(state.proposals).filter(p => p.status === 'active');
    return {
      daoName: state.daoName,
      founder: state.founder,
      quorum: state.quorum,
      votingPeriod: state.votingPeriod,
      memberCount: Object.keys(state.members).length,
      members: Object.keys(state.members),
      proposalCount: state.proposalCount,
      activeProposals: activeProposals.length,
      proposals: Object.values(state.proposals).map(p => ({
        id: p.id, title: p.title, type: p.proposalType, status: p.status,
        yes: p.yesCount, no: p.noCount, proposer: p.proposer
      }))
    };
  }

  // ── Get Single Proposal ──
  if (args.action === 'getProposal') {
    const p = state.proposals[args.proposalId];
    if (!p) throw new Error('Proposal not found');
    return { ...p };
  }

  return { error: 'Unknown action: ' + args.action };
`;

class GovCreateDao {
  constructor() { this.name = 'gov-create-dao'; }

  async execute(params) {
    try {
      const stateFile = String(params?.stateFile || '').trim();
      if (!stateFile) throw new Error('stateFile is required');
      if (!fs.existsSync(stateFile)) throw new Error(`State file not found: ${stateFile}`);

      const daoName = String(params?.daoName || '').trim();
      const founder = String(params?.founder || '').trim();
      if (!daoName) throw new Error('daoName is required');
      if (!founder) throw new Error('founder is required');

      const quorum = Math.max(1, Math.min(100, Number(params?.quorum || 50)));
      const votingPeriod = Math.max(1, Number(params?.votingPeriod || 100));
      const membersRaw = params?.members ? String(params?.members).split(',').map(m => m.trim()).filter(m => m) : [];

      const engine = TriadicEngine.loadFromFile(stateFile);

      // Create a wallet for the founder if they don't have one
      let founderWallet = engine.getWallet(founder);
      if (!founderWallet) {
        founderWallet = new Wallet();
        engine.wallets.set(founder, founderWallet);
      }

      // Deploy the DAO contract
      const daoAddress = `dao-${daoName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;
      const deployResult = engine.vm.deploy(daoAddress, DAO_CONTRACT_CODE, founder, {}, 200000);

      // Initialize the DAO
      const initResult = engine.vm.call(daoAddress, 'main', {
        daoName, quorum, votingPeriod, members: membersRaw
      }, founder, 100000);

      if (!initResult.success) throw new Error(`DAO init failed: ${initResult.error}`);

      // Record as a transaction
      const tx = { sender: founder, receiver: daoAddress, 0: 0, data: `DAO_CREATE:${daoName}`, nonce: engine.accountNonces[founder] || 0 };
      tx.txId = founder + '-dao-create-' + Date.now().toString(36);
      engine.addBlock([tx]);

      engine.saveToFile(stateFile);

      return {
        success: true,
        daoAddress,
        daoName,
        founder,
        quorum,
        votingPeriod,
        members: [founder, ...membersRaw],
        txId: tx.txId,
        chainLength: engine.chain.length,
        gasUsed: deployResult.gasCost + (initResult.gasConsumed || 0),
        error: '',
      };
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  }
}

export default new GovCreateDao();
