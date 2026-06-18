import fs from 'fs';
import path from 'path';
import { TriadicEngine, makeTx, computeTxId, asciiCoherenceChart, formatSummaryMarkdown } from './triadix-core.js';

class TriadixDeployContract {
  constructor() { this.name = 'triadix-deploy-contract'; }

  async execute(params) {
    try {
      const stateFile = String(params?.stateFile || '').trim();
      const contractAddress = String(params?.contractAddress || '').trim();
      const contractCode = String(params?.contractCode || '');
      const owner = String(params?.owner || 'deployer');
      const action = String(params?.action || 'deploy');
      const method = String(params?.method || 'main');
      const args = params?.args && typeof params.args === 'object' ? params.args : {};
      const initialState = params?.initialState && typeof params.initialState === 'object' ? params.initialState : {};
      const gasLimit = Number(params?.gasLimit || (action === 'deploy' ? 100000 : 50000));

      if (!contractAddress) throw new Error('contractAddress is required');

      let engine;
      if (stateFile && fs.existsSync(stateFile)) {
        engine = TriadicEngine.loadFromFile(stateFile);
      } else {
        engine = new TriadicEngine();
        engine.run(1);
      }

      let result;
      if (action === 'deploy') {
        if (!contractCode) throw new Error('contractCode is required for deploy');
        result = engine.vm.deploy(contractAddress, contractCode, owner, initialState, gasLimit);
        const tx = makeTx(owner, contractAddress, 0, 'contract-deploy', engine.accountNonces[owner] || 0);
        tx.txId = computeTxId(tx);
        tx.contract = { action: 'deploy', address: contractAddress, code: contractCode, initialState };
        engine.addBlock([tx]);
        result = { success: true, action: 'deploy', ...result };
      } else if (action === 'call') {
        result = engine.vm.call(contractAddress, method, args, owner, gasLimit);
        result.action = 'call';
        const tx = makeTx(owner, contractAddress, 0, `contract-call:${method}`, engine.accountNonces[owner] || 0);
        tx.txId = computeTxId(tx);
        tx.contract = { action: 'call', address: contractAddress, method, args };
        tx.contractResult = result;
        engine.addBlock([tx]);
      } else {
        throw new Error(`Unknown action: ${action}`);
      }

      if (stateFile) engine.saveToFile(stateFile);
      else engine.saveToFile(path.join(process.cwd(), 'triadix-run', 'state', 'contract_state.json'));

      const report = engine.statusReport();
      return {
        success: true, contractAddress, action, result,
        contractState: engine.vm.getState(contractAddress),
        allContracts: engine.vm.listContracts(),
        vmLogs: engine.vm.logs.slice(-10),
        gasConsumed: result.gasConsumed || result.gasCost || 0,
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

export default new TriadixDeployContract();
