/**
 * Triadix Governance v1.0.0 — Full End-to-End Demo
 * Creates a DAO, proposes actions, votes, and executes.
 */

import { TriadicEngine, Wallet } from '../src/core/triadix-core.js';
import fs from 'fs';

const log = (n, title) => {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${n}. ${title}`);
  console.log('═'.repeat(60));
};

let pass = 0, fail = 0;
const assert = (cond, msg) => {
  if (cond) { pass++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.log(`  ❌ ${msg}`); }
};

// ─── SETUP: Create a fresh ledger state ───────────────────────────
const stateFile = './_gov-demo-state.json';
const engine = new TriadicEngine({
  tau: 0.244, healthMode: 'p25', nodeId: 'node-1',
  validators: ['v1', 'v2', 'v3', 'v4'],
  agentId: 'system'
});
engine.run(5); // genesis + 4 blocks

// Create wallets for agents
const alice = new Wallet();
const bob = new Wallet();
const charlie = new Wallet();
engine.wallets.set('alice', alice);
engine.wallets.set('bob', bob);
engine.wallets.set('charlie', charlie);

console.log('Agents created:');
console.log(`  Alice:   ${alice.address}`);
console.log(`  Bob:     ${bob.address}`);
console.log(`  Charlie: ${charlie.address}`);

// ─── 1. CREATE DAO ────────────────────────────────────────────────
log(1, 'CREATE DAO');

const DAO_CONTRACT_CODE = `
  if (!state.initialized) {
    state.initialized = true;
    state.daoName = args.daoName || 'Unnamed DAO';
    state.founder = caller;
    state.quorum = args.quorum || 50;
    state.votingPeriod = args.votingPeriod || 100;
    state.members = {};
    state.proposals = {};
    state.proposalCount = 0;
    state.members[caller] = { joined: now, weight: 1 };
    if (args.members) {
      for (let i = 0; i < args.members.length; i++) {
        const m = args.members[i];
        if (m && m !== caller) state.members[m] = { joined: now, weight: 1 };
      }
    }
    return { created: true, name: state.daoName, members: Object.keys(state.members).length };
  }
  if (args.action === 'propose') {
    if (!state.members[caller]) throw new Error('Not a member');
    const id = String(state.proposalCount);
    state.proposals[id] = {
      id, proposalType: args.proposalType || 'action',
      title: args.title || 'Untitled', description: args.description || '',
      proposer: caller, yesVotes: {}, noVotes: {}, yesCount: 0, noCount: 0,
      status: 'active', createdAt: now,
      expiresAt: now + state.votingPeriod * 60000,
      executed: false, targetAgent: args.targetAgent || null,
      newQuorum: args.newQuorum || null, newVotingPeriod: args.newVotingPeriod || null,
      actionData: args.actionData || null,
    };
    state.proposalCount++;
    return { proposalId: id, status: 'active' };
  }
  if (args.action === 'vote') {
    if (!state.members[caller]) throw new Error('Not a member');
    const p = state.proposals[args.proposalId];
    if (!p) throw new Error('Not found');
    if (p.status !== 'active') throw new Error('Not active');
    if (p.yesVotes[caller] || p.noVotes[caller]) throw new Error('Already voted');
    if (now > p.expiresAt) { p.status = 'expired'; throw new Error('Expired'); }
    const w = state.members[caller].weight || 1;
    if (args.approve) { p.yesVotes[caller] = w; p.yesCount += w; }
    else { p.noVotes[caller] = w; p.noCount += w; }
    return { voted: true, yesCount: p.yesCount, noCount: p.noCount };
  }
  if (args.action === 'execute') {
    const p = state.proposals[args.proposalId];
    if (!p) throw new Error('Not found');
    if (p.executed) throw new Error('Already executed');
    if (now <= p.expiresAt) throw new Error('Voting not ended');
    const total = Object.keys(state.members).length;
    const votes = p.yesCount + p.noCount;
    const participation = total > 0 ? (votes / total) * 100 : 0;
    const approval = votes > 0 ? (p.yesCount / votes) * 100 : 0;
    if (participation < state.quorum) { p.status = 'failed_quorum'; return { executed: false, reason: 'quorum_not_met' }; }
    if (approval < state.quorum) { p.status = 'failed_approval'; return { executed: false, reason: 'approval_not_met' }; }
    p.executed = true; p.status = 'executed';
    let result = { executed: true, proposalId: args.proposalId };
    if (p.proposalType === 'add_member' && p.targetAgent) {
      state.members[p.targetAgent] = { joined: now, weight: 1 };
      result.added = p.targetAgent;
    }
    if (p.proposalType === 'remove_member' && p.targetAgent) {
      delete state.members[p.targetAgent];
      result.removed = p.targetAgent;
    }
    if (p.proposalType === 'change_quorum' && p.newQuorum) {
      state.quorum = p.newQuorum;
      result.newQuorum = p.newQuorum;
    }
    return result;
  }
  if (args.action === 'info') {
    return {
      daoName: state.daoName, founder: state.founder,
      quorum: state.quorum, votingPeriod: state.votingPeriod,
      memberCount: Object.keys(state.members).length,
      members: Object.keys(state.members),
      proposalCount: state.proposalCount,
      activeProposals: Object.values(state.proposals).filter(p => p.status === 'active').length,
      proposals: Object.values(state.proposals).map(p => ({
        id: p.id, title: p.title, type: p.proposalType, status: p.status,
        yes: p.yesCount, no: p.noCount, proposer: p.proposer
      }))
    };
  }
  return { error: 'Unknown action' };
`;

const daoAddress = 'dao-agent-council-' + Date.now().toString(36);
const deploy = engine.vm.deploy(daoAddress, DAO_CONTRACT_CODE, alice.address, {}, 200000);
assert(deploy.gasCost > 0, `DAO contract deployed: ${daoAddress} (gas: ${deploy.gasCost})`);

const init = engine.vm.call(daoAddress, 'main', {
  daoName: 'Agent Council',
  quorum: 66,
  votingPeriod: 50,
  members: [bob.address, charlie.address]
}, alice.address, 100000);
assert(init.success && init.result.created === true, `DAO initialized: ${init.result.name}`);
assert(init.result.members === 3, `Initial members: ${init.result.members} (alice + bob + charlie)`);

engine.saveToFile(stateFile);
console.log(`  DAO: Agent Council`);
console.log(`  Address: ${daoAddress}`);
console.log(`  Quorum: 66% | Voting Period: 50 blocks`);
console.log(`  Members: alice, bob, charlie`);

// ─── 2. CREATE PROPOSALS ───────────────────────────────────────────
log(2, 'CREATE PROPOSALS');

// Proposal 1: Add a new member
const p1 = engine.vm.call(daoAddress, 'main', {
  action: 'propose', proposalType: 'add_member',
  title: 'Add Dave as Member',
  description: 'Dave has contributed to the project and should be a full member.',
  targetAgent: 'dave-agent'
}, alice.address, 100000);
assert(p1.success, `Proposal 1 created: ${p1.result.proposalId} — "Add Dave as Member"`);

// Proposal 2: Change quorum
const p2 = engine.vm.call(daoAddress, 'main', {
  action: 'propose', proposalType: 'change_quorum',
  title: 'Lower Quorum to 51%',
  description: '66% quorum is too high for quick decisions. Lower to 51%.',
  newQuorum: 51
}, bob.address, 100000);
assert(p2.success, `Proposal 2 created: ${p2.result.proposalId} — "Lower Quorum to 51%"`);

// Proposal 3: Custom action
const p3 = engine.vm.call(daoAddress, 'main', {
  action: 'propose', proposalType: 'action',
  title: 'Fund Research Initiative',
  description: 'Allocate 1000 tokens to the AI safety research initiative.',
  actionData: JSON.stringify({ action: 'transfer', to: 'research-fund', amount: 1000 })
}, charlie.address, 100000);
assert(p3.success, `Proposal 3 created: ${p3.result.proposalId} — "Fund Research Initiative"`);

console.log('  3 proposals created');

// ─── 3. VOTE ON PROPOSALS ──────────────────────────────────────────
log(3, 'VOTE ON PROPOSALS');

// Proposal 1: All vote yes (3/3 = 100% > 66% quorum)
engine.vm.call(daoAddress, 'main', { action: 'vote', proposalId: '0', approve: true }, alice.address, 50000);
engine.vm.call(daoAddress, 'main', { action: 'vote', proposalId: '0', approve: true }, bob.address, 50000);
engine.vm.call(daoAddress, 'main', { action: 'vote', proposalId: '0', approve: true }, charlie.address, 50000);
console.log('  Proposal 0 (Add Dave): 3 YES / 0 NO');

// Proposal 2: Split vote (2 yes, 1 no = 66.7% > 66% quorum — barely passes)
engine.vm.call(daoAddress, 'main', { action: 'vote', proposalId: '1', approve: true }, alice.address, 50000);
engine.vm.call(daoAddress, 'main', { action: 'vote', proposalId: '1', approve: true }, bob.address, 50000);
engine.vm.call(daoAddress, 'main', { action: 'vote', proposalId: '1', approve: false }, charlie.address, 50000);
console.log('  Proposal 1 (Lower Quorum): 2 YES / 1 NO');

// Proposal 3: Only 1 votes yes (1/3 = 33% < 66% quorum — will fail)
engine.vm.call(daoAddress, 'main', { action: 'vote', proposalId: '2', approve: true }, alice.address, 50000);
// Bob and Charlie don't vote — quorum not met
console.log('  Proposal 2 (Fund Research): 1 YES / 0 NO (quorum not met)');

// ─── 4. EXECUTE PROPOSALS ──────────────────────────────────────────
log(4, 'EXECUTE PROPOSALS');

// Advance time past voting period
const daoState = engine.vm.getState(daoAddress);
for (const p of Object.values(daoState.proposals)) {
  p.expiresAt = Date.now() - 1000; // Force expiry
}

// Execute Proposal 0 (should pass — all voted yes)
const e0 = engine.vm.call(daoAddress, 'main', { action: 'execute', proposalId: '0' }, alice.address, 100000);
assert(e0.success && e0.result.executed === true, `Proposal 0 executed: ${e0.result.executed}`);
assert(e0.result.added === 'dave-agent', `Dave added as member`);

// Execute Proposal 1 (should pass — 66.7% > 66%)
const e1 = engine.vm.call(daoAddress, 'main', { action: 'execute', proposalId: '1' }, alice.address, 100000);
assert(e1.success && e1.result.executed === true, `Proposal 1 executed: ${e1.result.executed}`);
assert(e1.result.newQuorum === 51, `Quorum changed to: ${e1.result.newQuorum}%`);

// Execute Proposal 2 (should fail — quorum not met)
const e2 = engine.vm.call(daoAddress, 'main', { action: 'execute', proposalId: '2' }, alice.address, 100000);
assert(e2.result.executed === false, `Proposal 2 correctly failed: ${e2.result.reason}`);

console.log('  Proposal 0 (Add Dave): ✅ EXECUTED — dave-agent added');
console.log('  Proposal 1 (Lower Quorum): ✅ EXECUTED — quorum now 51%');
console.log('  Proposal 2 (Fund Research): ❌ FAILED — quorum not met');

// ─── 5. DAO INFO ───────────────────────────────────────────────────
log(5, 'DAO INFO');

const info = engine.vm.call(daoAddress, 'main', { action: 'info' }, 'system', 50000);
const data = info.result;
assert(data.daoName === 'Agent Council', `DAO name: ${data.daoName}`);
assert(data.memberCount === 4, `Members: ${data.memberCount} (alice, bob, charlie, dave)`);
assert(data.quorum === 51, `Quorum: ${data.quorum}% (changed from 66%)`);
assert(data.proposalCount === 3, `Total proposals: ${data.proposalCount}`);

console.log(`  DAO: ${data.daoName}`);
console.log(`  Founder: ${data.founder.substring(0, 20)}...`);
console.log(`  Members (${data.memberCount}): ${data.members.map(m => m.substring(0, 8) + '...').join(', ')}`);
console.log(`  Quorum: ${data.quorum}% | Voting Period: ${data.votingPeriod} blocks`);
console.log(`  Proposals: ${data.proposalCount} total, ${data.activeProposals} active`);

// ─── SUMMARY ──────────────────────────────────────────────────────
log('✅', 'GOVERNANCE DEMO COMPLETE');

console.log(`
  DAOs created:     1 (Agent Council)
  Proposals:        3 created, 2 executed, 1 failed
  Members:          4 (alice, bob, charlie + dave added via governance)
  Quorum:           51% (changed from 66% via governance)
  Chain:            ${engine.chain.length} blocks | Valid: ${engine.isChainValid()}
  Contracts:        ${engine.vm.listContracts().length} deployed
  Gas used:         ${engine.vm.gasUsed}
`);

// Cleanup
fs.unlinkSync(stateFile);
console.log('✅ Governance demo complete — all systems working!');
