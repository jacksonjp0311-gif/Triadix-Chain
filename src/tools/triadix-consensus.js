import { TriadicEngine, asciiCoherenceChart, formatSummaryMarkdown } from './triadix-core.js';
import fs from 'fs';

class TriadixConsensus {
  constructor() { this.name = 'triadix-consensus'; }

  async execute(params) {
    try {
      const action = String(params?.action || 'status');
      const stateFile = String(params?.stateFile || '').trim();
      const proposalId = String(params?.proposalId || '').trim();
      const validatorId = String(params?.validatorId || '').trim();
      const approve = params?.approve !== undefined ? Boolean(params?.approve) : true;
      const newValidators = params?.validators || [];
      const phase = String(params?.phase || 'prepare');
      const newView = Number(params?.newView || 0);

      let engine;
      if (stateFile && fs.existsSync(stateFile)) {
        engine = TriadicEngine.loadFromFile(stateFile);
      } else {
        engine = new TriadicEngine();
        engine.run(1);
        engine.consensus = engine.consensus; // already created in constructor
      }

      const consensus = engine.consensus;
      let result = {};

      switch (action) {
        case 'add-validators':
          for (const v of newValidators) consensus.validators.add(String(v));
          result = { added: newValidators, validators: Array.from(consensus.validators) };
          break;
        case 'remove-validator':
          if (validatorId) consensus.validators.delete(validatorId);
          result = { removed: validatorId, validators: Array.from(consensus.validators) };
          break;
        case 'elect-primary':
          result = { primary: consensus.electPrimary(), viewNumber: consensus.viewNumber };
          break;
        case 'propose':
          if (!proposalId) throw new Error('proposalId required');
          result = consensus.propose(proposalId, engine.chain[engine.chain.length - 1]?.hC || '0'.repeat(64));
          break;
        case 'vote':
          if (!proposalId || !validatorId) throw new Error('proposalId and validatorId required');
          result = consensus.vote(proposalId, validatorId, phase, approve);
          break;
        case 'check':
          if (!proposalId) throw new Error('proposalId required');
          result = consensus.checkProposal(proposalId);
          break;
        case 'view-change':
          result = consensus.requestViewChange(newView);
          break;
        case 'state-transfer':
          result = consensus.getStateTransfer();
          break;
        case 'commit-block': {
          if (!proposalId) throw new Error('proposalId required');
          const check = consensus.checkProposal(proposalId);
          if (check.status !== 'committed') throw new Error(`Not committed: ${check.status}`);
          engine.addBlock();
          result = { committed: true, proposalId, newBlockIndex: engine.chain.length - 1 };
          break;
        }
        case 'status':
        default:
          result = consensus.getConsensusState();
          break;
      }

      if (stateFile) engine.saveToFile(stateFile);

      const report = engine.statusReport();
      return {
        success: true, action, consensusResult: result,
        consensusState: consensus.getConsensusState(),
        chainLength: engine.chain.length, chainValid: report.valid,
        asciiChart: engine.chain.length > 1 ? asciiCoherenceChart(engine.chain, engine.tau) : undefined,
        summaryMarkdown: formatSummaryMarkdown(report, report.coherenceStats),
        error: '',
      };
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  }
}

export default new TriadixConsensus();
