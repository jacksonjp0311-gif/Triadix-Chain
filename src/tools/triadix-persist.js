import fs from 'fs';
import path from 'path';
import { TriadicEngine, asciiCoherenceChart, formatSummaryMarkdown } from './triadix-core.js';

class TriadixPersist {
  constructor() { this.name = 'triadix-persist'; }

  async execute(params) {
    try {
      const action = String(params?.action || 'save');
      const stateFile = String(params?.stateFile || '').trim();
      const chainId = String(params?.chainId || `chain-${Date.now().toString(36)}`);
      const name = String(params?.name || '');
      const loadFile = String(params?.loadFile || '');
      const exportPath = String(params?.exportPath || '').trim();

      let engine, result = {};

      switch (action) {
        case 'save': {
          if (!stateFile) {
            const defaultDir = path.join(process.cwd(), 'triadix-run', 'state');
            fs.mkdirSync(defaultDir, { recursive: true });
            const fileName = `${chainId}_state.json`;
            if (!engine) throw new Error('No engine to save. Run triadix-run first.');
            engine.saveToFile(path.join(defaultDir, fileName));
            result = { savedTo: path.join(defaultDir, fileName), chainId, name };
          } else {
            if (!engine) throw new Error('No engine to save.');
            engine.saveToFile(stateFile);
            result = { savedTo: stateFile, chainId, name };
          }
          break;
        }
        case 'load': {
          const fileToLoad = loadFile || stateFile;
          if (!fileToLoad) throw new Error('loadFile or stateFile required');
          if (!fs.existsSync(fileToLoad)) throw new Error(`File not found: ${fileToLoad}`);
          engine = TriadicEngine.loadFromFile(fileToLoad);
          result = { loaded: true, source: fileToLoad, chainId: engine.chainId, chainLength: engine.chain.length, valid: engine.isChainValid() };
          break;
        }
        case 'chain-info': {
          const infoFile = loadFile || stateFile;
          if (!infoFile || !fs.existsSync(infoFile)) throw new Error('Valid stateFile required');
          const data = JSON.parse(fs.readFileSync(infoFile, 'utf-8'));
          result = { chainId: data.chainId || 'unknown', chainLength: data.chain?.length || 0, mempoolSize: data.mempool?.length || 0, accountNonces: data.accountNonces || {}, checkpointCount: Object.keys(data.checkpoints || {}).length };
          break;
        }
        case 'list-chains': {
          const stateDir = path.join(process.cwd(), 'triadix-run', 'state');
          if (!fs.existsSync(stateDir)) { result = { chains: [], directory: stateDir }; break; }
          const files = fs.readdirSync(stateDir).filter(f => f.endsWith('.json'));
          result = { chains: files.map(f => {
            try {
              const data = JSON.parse(fs.readFileSync(path.join(stateDir, f), 'utf-8'));
              return { file: f, chainId: data.chainId || 'unknown', chainLength: data.chain?.length || 0, mempoolSize: data.mempool?.length || 0, updatedAt: fs.statSync(path.join(stateDir, f)).mtime.toISOString(), sizeKB: (fs.statSync(path.join(stateDir, f)).size / 1024).toFixed(1) };
            } catch { return { file: f, error: 'parse_failed' };
          }), count: files.length, directory: stateDir };
          break;
        }
        case 'import-chain': {
          const importFile = loadFile || stateFile;
          if (!importFile) throw new Error('loadFile required');
          const data = JSON.parse(fs.readFileSync(importFile, 'utf-8'));
          engine = new TriadicEngine();
          engine.chain = data.chain || []; engine.mempool = data.mempool || []; engine.accountNonces = data.accountNonces || {}; engine.receipts = data.receipts || {};
          if (data.hE) engine.hE = Buffer.from(data.hE, 'hex');
          if (data.hI) engine.hI = Buffer.from(data.hI, 'hex');
          if (data.hC) engine.hC = Buffer.from(data.hC, 'hex');
          if (data.chainId) engine.chainId = data.chainId;
          const outDir = path.join(process.cwd(), 'triadix-run', 'state');
          fs.mkdirSync(outDir, { recursive: true });
          const outFile = path.join(outDir, `${chainId}_imported.json`);
          engine.saveToFile(outFile);
          result = { imported: true, chainId: engine.chainId, chainLength: engine.chain.length, savedTo: outFile };
          break;
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      const report = engine ? engine.statusReport() : {};
      return {
        success: true, action, persistResult: result,
        chainLength: engine?.chain?.length || 0, chainValid: report.valid || false,
        asciiChart: engine && engine.chain.length > 1 ? asciiCoherenceChart(engine.chain, engine.tau) : undefined,
        summaryMarkdown: engine ? formatSummaryMarkdown(report, report.coherenceStats || {}) : '# No chain loaded',
        error: '',
      };
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  }
}

export default new TriadixPersist();
