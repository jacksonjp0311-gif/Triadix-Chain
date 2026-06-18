import fs from 'fs';
import { TriadicEngine, computeTxId, makeTx, Wallet } from './triadix-core.js';

function parseBool(value, defaultValue = false) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return defaultValue;
}

class TriadixSubmitTx {
  constructor() { this.name = 'triadix-submit-tx'; }

  async execute(params) {
    try {
      const stateFile = String(params?.stateFile || '').trim();
      if (!stateFile) throw new Error('stateFile is required');
      if (!fs.existsSync(stateFile)) throw new Error(`State file not found: ${stateFile}`);

      const sender = String(params?.sender || '').trim();
      const receiver = String(params?.receiver || '').trim();
      if (!sender || !receiver) throw new Error('sender and receiver are required');

      const amount = Number(params?.amount ?? 10);
      const data = String(params?.data || '');
      let nonce = Number(params?.nonce ?? 0);
      const signTx = parseBool(params?.sign, false);
      const walletLabel = String(params?.walletLabel || sender);

      const engine = TriadicEngine.loadFromFile(stateFile);
      if (nonce === 0) nonce = engine.accountNonces[sender] || 0;

      const tx = makeTx(sender, receiver, amount, data, nonce);
      tx.txId = computeTxId(tx);

      if (engine.receipts[tx.txId]) throw new Error(`Duplicate transaction: ${tx.txId}`);

      // v3.0: Ed25519 signing
      if (signTx) {
        let wallet = engine.getWallet(walletLabel);
        if (!wallet) {
          wallet = new Wallet();
          engine.wallets.set(walletLabel, wallet);
        }
        wallet.signTx(tx);
      }

      const expectedNonce = engine.accountNonces[sender] || 0;
      if (nonce === expectedNonce) {
        engine.mempool.push(tx);
        engine.mempool.sort((a, b) => a.sender !== b.sender ? a.sender.localeCompare(b.sender) : a.nonce - b.nonce);
      } else {
        engine.waitingMempool.push(tx);
        engine.waitingMempool.sort((a, b) => a.sender !== b.sender ? a.sender.localeCompare(b.sender) : a.nonce - b.nonce);
      }

      // Gossip broadcast
      engine.gossip.gossip(engine.gossip.createMessage('NEW_TX', { txId: tx.txId, sender, receiver, amount }));

      engine.saveToFile(stateFile);

      return {
        success: true, txId: tx.txId, accepted: true, queued: nonce !== expectedNonce,
        mempoolSize: engine.mempool.length, waitingSize: engine.waitingMempool.length,
        chainLength: engine.chain.length, gossipBroadcast: true,
        signed: signTx, signature: tx.signature || null,
        error: '',
      };
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  }
}

export default new TriadixSubmitTx();
