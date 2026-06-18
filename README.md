# Triadix Chain

**Three hashes. One truth. Zero blind spots.**

[![Version](https://img.shields.io/badge/version-3.0.1-blue.svg)](https://github.com/jacksonjp0311-gif/Triadix-Chain)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![AGNT](https://img.shields.io/badge/AGNT-plugin-8B5CF6.svg)](https://agnt.gg)
[![Tests](https://img.shields.io/badge/tests-43%2F43%20passing-brightgreen.svg)](tests/)
[![Dependencies](https://img.shields.io/badge/dependencies-ws-lightgrey.svg)](package.json)

A **coherence-native triadic ledger kernel** — not just a hash chain, but a full distributed ledger platform. Create cryptographically verifiable chains, deploy smart contracts, run BFT consensus, coordinate agents over P2P gossip, and monitor the internal health of your system in real time.

> **Why Triadix exists:** Most ledgers answer one question — *"Did the chain link correctly?"* Triadix answers two — *"Did the chain link correctly, AND is the evolving internal state still coherent?"* That second question is the breakthrough.

---

## ✨ What's New in v3.0

All 6 gaps from the v2.0 roadmap are closed:

| Feature | Description | Status |
|---------|-------------|--------|
| 🔐 **Ed25519 Wallet Signing** | Native Node.js Ed25519 keypairs — sign, verify, restore from private key, sign transactions | ✅ |
| 🌳 **Merkle Proofs (SPV)** | Build Merkle trees from transactions, generate and verify SPV-style inclusion proofs | ✅ |
| ⛽ **Gas/Fee Model** | Contract execution metering — per-op gas costs, configurable limits, fee calculation | ✅ |
| 🏛️ **Full PBFT Consensus** | Complete pre-prepare → prepare → commit lifecycle, view changes, checkpointing, state transfer | ✅ |
| 🌐 **WebSocket P2P Transport** | Real WebSocket server + client in gossip node — broadcast over TCP, not just in-process | ✅ |
| 🧠 **Agent Memory Integration** | `AgentMemoryBridge` — map `save_agent_memory()` calls to triadic transactions, auto-block every 5 actions | ✅ |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TRIADIX CHAIN v3.0                          │
│                    "Three hashes. One truth."                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   TRIADIC HASH CYCLE              COHERENCE METRICS                 │
│   ┌──────┐ ┌──────┐ ┌──────┐    E  = entropy(hE) / 8              │
│   │  hE  │ │  hI  │ │  hC  │    I  = entropy(hI) / 8              │
│   └──┬───┘ └──┬───┘ └──┬───┘    Δφ = avg hamming(hE,hI,hC)        │
│      └────────┼────────┘        C  = (E × I) / (1 + |Δφ|)        │
│               │                                                     │
│   ┌───────────┴────────────────────────────────────────────────┐   │
│   │                    LEDGER ENGINE                            │   │
│   │  Genesis → Blocks → Mempool → Receipts → Checkpoints       │   │
│   │  Validation → Merkle Trees → Nonces → State Serialization  │   │
│   └──────┬──────────┬──────────┬──────────┬──────────┬────────┘   │
│          │          │          │          │          │             │
│   ┌──────┴───┐ ┌────┴────┐ ┌──┴───┐ ┌───┴───┐ ┌───┴──────┐     │
│   │ CONTRACT │ │  FULL   │ │ P2P  │ │AGENT  │ │ SQLITE   │     │
│   │ VM v2    │ │  PBFT   │ │GOSSIP│ │MEMORY │ │ PERSIST  │     │
│   │ Gas      │ │ Consensus│ │ v2   │ │BRIDGE │ │          │     │
│   │ Metering │ │ View    │ │ WS   │ │ Auto  │ │ AGNT DB  │     │
│   │ Sandbox  │ │ Changes │ │ TCP  │ │ Block │ │ Tables   │     │
│   │ State    │ │ Checkpts│ │ Dedup│ │ Track │ │ Chains   │     │
│   │ Transfer │ │ Transfer│ │ Peers│ │ Coher.│ │ Txns     │     │
│   └──────────┘ └─────────┘ └──────┘ └───────┘ └──────────┘     │
│          │          │          │          │          │             │
│   ┌──────┴──────────┴──────────┴──────────┴──────────┴────────┐   │
│   │              Ed25519 Wallet + Merkle Trees                 │   │
│   │  Sign │ Verify │ Restore │ SPV Proofs │ Light Clients     │   │
│   └────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   8 Tools • Bundled Dependencies • ~21 KB • 43/43 Tests Passing      │
└─────────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### As an AGNT Plugin

1. Copy `agnt-plugin/triadix-ledger.agnt` to your AGNT plugins folder
2. Or install via the AGNT marketplace
3. Use any of the 8 tools from chat or workflows:

```
"Generate a triadic hash chain with 96 blocks"
→ triadix-run { blocks: 96 }

"Deploy a counter contract"
→ triadix-deploy-contract { action: "deploy", contractAddress: "counter-1", contractCode: "..." }

"Run PBFT consensus on block 97"
→ triadix-consensus { action: "propose", proposalId: "block-97" }
→ triadix-consensus { action: "vote", proposalId: "block-97", validatorId: "v1" }
→ triadix-consensus { action: "check", proposalId: "block-97" }
```

### As a Standalone Library

```javascript
import { TriadicEngine, Wallet, MerkleTree, PBFTConsensus } from './src/core/triadix-core.js';

// 1. Create engine and generate chain
const engine = new TriadicEngine({ tau: 0.244, validators: ['v1','v2','v3','v4'] });
engine.run(96);
console.log('Valid:', engine.isChainValid());
console.log('Healthy:', engine.isHealthy());
console.log('Merkle root:', engine.getMerkleRoot());

// 2. Create wallet and sign transactions
const wallet = new Wallet();
const tx = wallet.signTx({ sender: wallet.address, receiver: 'bob', amount: 50, data: 'payment', nonce: 0 });
console.log('Signature:', tx.signature);
console.log('Verified:', Wallet.verify('msg', tx.signature, wallet.publicKey));

// 3. Deploy and call smart contracts
engine.vm.deploy('counter', counterCode, 'alice', { count: 0 });
const result = engine.vm.call('counter', 'main', { action: 'increment', amount: 5 }, 'alice');
console.log('Gas consumed:', result.gasConsumed, 'Cost:', result.gasCost);

// 4. Run PBFT consensus
engine.consensus.propose('block-97', engine.chain[engine.chain.length-1].hC);
engine.consensus.vote('block-97', 'v1', 'prepare', true);
engine.consensus.vote('block-97', 'v2', 'prepare', true);
engine.consensus.vote('block-97', 'v3', 'prepare', true);
console.log(engine.consensus.checkProposal('block-97')); // → committed

// 5. P2P networking
await engine.gossip.startServer(8001);
engine.gossip.addPeer('peer-1', '127.0.0.1', 8002);
engine.gossip.gossip(engine.gossip.createMessage('NEW_BLOCK', { index: 95, hC: engine.chain[95].hC }));

// 6. Agent memory integration
engine.agentBridge.recordAction('tool_call', 'web_search', { query: 'AI' }, { results: 5 });
console.log('Agent coherence:', engine.agentBridge.getAgentCoherence());
```

## 📊 Benchmarks

| Metric | Value |
|--------|-------|
| Chain throughput | ~6,400 blocks/sec (pure JS, single-threaded) |
| 100K block validation | < 3 seconds |
| Memory (100 blocks) | ~200 KB |
| Memory (10K blocks) | ~20 MB |
| Plugin size | Generated .agnt package with bundled dependencies |
| Test coverage | 43/43 tests passing (100%) |
| Ed25519 sign | < 0.5ms per operation |
| Merkle proof | < 0.1ms for 10K leaves |

## 🔬 The Triadic Hash Cycle

Each block updates three coupled SHA-256 channels:

| Channel | Payload Transform | Purpose |
|---------|------------------|---------|
| **hE** | Raw payload (`pE`) | Measures content entropy |
| **hI** | Sorted payload (`pI`) | Measures distribution entropy |
| **hC** | SHA-256 of payload (`pC`) | Measures digest-space entropy |

```
hE' = SHA256(hE || hI || hC || payload)
hI' = SHA256(hI || hC || hE || sorted(payload))
hC' = SHA256(hC || hE || hI || SHA256(payload))
```

This creates three **independent but entangled** hash trajectories. The coherence between them is what makes Triadix unique.

## 📐 Coherence Metrics

| Metric | Formula | Meaning |
|--------|---------|---------|
| **E** | `entropy(hE) / 8` | Normalized Shannon entropy of raw channel (0–1) |
| **I** | `entropy(hI) / 8` | Normalized Shannon entropy of sorted channel (0–1) |
| **Δφ** | `avg(hamming(hE,hI), hamming(hI,hC), hamming(hC,hE))` | Phase drift between channels (0–1) |
| **C** | `(E × I) / (1 + |Δφ|)` | Overall coherence score (0–1) |

**Health policy modes:**

| Mode | Rule |
|------|------|
| `p25` | 25th percentile of C must be ≥ τ (default τ = 0.244) |
| `p50` | Median C must be ≥ τ |
| `p05` | 5th percentile of C must be ≥ τ (strict) |
| `all` | 100% of blocks must have C ≥ τ |
| `fraction` | ≥ 95% of blocks must have C ≥ τ |

**Calibrated anchor:** 100K blocks at 3,442 blocks/sec → p25 = 0.244 = τ, 75.1% fraction ≥ τ

## 🔧 8 AGNT Tools

| Tool | Purpose | Key Parameters |
|------|---------|---------------|
| **triadix-run** | Generate chain | `blocks`, `tau`, `healthMode`, `nodeId`, `validators` |
| **triadix-submit-tx** | Submit transaction | `sender`, `receiver`, `amount`, `sign` (Ed25519), `walletLabel` |
| **triadix-status** | Full chain status | `stateFile`, `tau`, `healthMode` |
| **triadix-health-report** | Health report + charts | `stateFile`, `tau`, `healthMode` |
| **triadix-deploy-contract** | Deploy/call contracts | `contractAddress`, `action`, `contractCode`, `gasLimit` |
| **triadix-consensus** | PBFT consensus | `action` (propose/vote/check/view-change/state-transfer), `proposalId`, `validatorId`, `phase` |
| **triadix-gossip** | P2P networking | `action` (start-ws-server/connect-ws/broadcast-tx/full-network-sim), `wsPort`, `simulatePeers` |
| **triadix-persist** | Chain persistence | `action` (save/load/import-chain/list-chains), `stateFile`, `chainId` |

## 🌳 Merkle Trees (SPV Proofs)

Every block automatically builds a Merkle tree from its transactions:

```javascript
// Get the Merkle root for the latest block
const root = engine.getMerkleRoot();

// Generate an SPV inclusion proof
const proof = engine.getMerkleProof(0); // proof for tx[0]

// Verify the proof (can be done by light clients)
const valid = MerkleTree.verifyProof('tx-id-0', proof, root);
// → true
```

## ⛽ Gas Model

Contract execution is metered to prevent infinite loops:

| Operation | Gas Cost |
|-----------|----------|
| Base execution | `code.length` gas |
| `state` read/write | 1 gas per access |
| `log(msg)` | 1 gas per call |
| `transfer(to, amount)` | 100 gas per call |
| `add(a, b)` | 1 gas per call |
| `mul(a, b)` | 2 gas per call |

Gas cost to user = `gasConsumed × gasPrice` (default gasPrice = 0.001)

## 🏛️ PBFT Consensus

Full Practical Byzantine Fault Tolerance:

```
Client → Primary:  REQUEST
Primary → All:     PRE-PREPARE (proposal)
All → All:         PREPARE (vote, need 2f+1)
All → All:         COMMIT (vote, need 2f+1)
All:               COMMITED (execute)

View Changes:      If primary faulty → VIEW-CHANGE → new primary elected
Checkpointing:     Every N blocks → stable checkpoint + state digest
State Transfer:    Catch up to latest checkpoint + recent blocks
```

## 🌐 P2P Gossip Protocol

Message types:
- `NEW_TX` — broadcast new transaction
- `NEW_BLOCK` — broadcast new block
- `PEER_DISCOVERY` — share known peers
- `CHAIN_SYNC` — request/receive chain data
- `CONSENSUS_VOTE` — broadcast consensus votes

Features:
- WebSocket transport (real TCP connections)
- Message deduplication
- TTL/hop counting
- Broadcast simulation (up to 50 nodes for testing)
- Server + client mode

## 🧠 Agent Memory Integration

Maps AGNT agent actions to triadic transactions:

```javascript
const bridge = engine.agentBridge;

// Every tool call becomes a triadic transaction
bridge.recordAction('tool_call', 'web_search', { query: 'AI' }, { results: 5 });
bridge.recordAction('memory_save', 'save_agent_memory', { type: 'fact' }, { saved: true });

// Auto-blocks every 5 transactions
// Agent coherence is tracked across all agent-involved blocks
const coherence = bridge.getAgentCoherence();
// → { evaluable: true, avgCoherence: 0.248, drift: 0.012, agentBlocks: 3 }
```

## 🗄️ SQLite Persistence

When integrated with AGNT's database layer:

| Table | Contents |
|-------|----------|
| `triadix_chains` | Chain metadata, health, coherence stats |
| `triadix_blocks` | Per-block hashes + metrics |
| `triadix_transactions` | All transactions |
| `triadix_contracts` | Deployed contracts + state + gas |
| `triadix_peers` | Network peer registry |
| `triadix_consensus_log` | Full consensus history |
| `triadix_agent_actions` | Agent action provenance |

Falls back to JSON file persistence when no DB context available.

## 📁 Repository Structure

```
Triadix-Chain/
├── README.md                   ← You are here
├── LICENSE                     ← MIT
├── package.json                ← Project metadata
├── .gitignore
├── src/
│   ├── core/
│   │   └── triadix-core.js     ← All 11 subsystems (30KB)
│   └── tools/
│       ├── triadix-run.js
│       ├── triadix-submit-tx.js
│       ├── triadix-status.js
│       ├── triadix-health-report.js
│       ├── triadix-deploy-contract.js
│       ├── triadix-consensus.js
│       ├── triadix-gossip.js
│       └── triadix-persist.js
├── examples/
│   ├── basic-chain.js          ← Generate a chain
│   ├── smart-contract.js       ← Deploy + call contracts
│   ├── consensus.js            ← Full PBFT lifecycle
│   ├── p2p-network.js          ← WebSocket P2P demo
│   └── agent-memory.js         ← Agent action provenance
├── tests/
│   └── triadix.test.js         ← 43 tests, all passing
├── docs/
│   ├── architecture.md         ← Deep architecture docs
│   ├── coherence.md            ← Coherence theory
│   └── triadic-hash-cycle.md   ← Hash cycle math
└── agnt-plugin/
    ├── triadix-ledger.agnt     ← Ready-to-install AGNT plugin
    ├── manifest.json           ← Plugin metadata
    ├── package.json
    └── README.md               ← Plugin-specific docs
```

## 🧪 Running Tests

```bash
cd tests
node triadix.test.js

# Output:
# ✅ 43/43 tests passed
# 🎉 ALL TESTS PASSED — v3.0 ready!
```

## 🎯 Use Cases

| Use Case | How Triadix Helps |
|----------|-------------------|
| **Provenance tracking** | Tamper-evident audit logs for agent actions via Merkle proofs |
| **Coherence monitoring** | Real-time health metrics detect drift in decision systems |
| **Smart contracts** | On-chain programs with gas metering + coherence-verified state |
| **Multi-agent consensus** | PBFT agreement between AGNT agents |
| **P2P coordination** | WebSocket gossip for agent communication networks |
| **Light clients** | Merkle SPV proofs for verify-without-downloading |
| **Ed25519 identity** | Cryptographic signing for wallets, transactions, consensus votes |
| **Agent memory** | Coherence-tracked, tamper-evident memory for AI agents |

## 🛣️ Roadmap

| Version | Status | Features |
|---------|--------|----------|
| v1.2 | ✅ Done | Triadic hash cycle, coherence metrics, CLI, Python |
| v2.0 | ✅ Done | Contract VM, BFT-lite, P2P gossip, SQLite, JS port |
| v3.0 | ✅ Done | Ed25519, Merkle proofs, gas model, full PBFT, WebSocket, agent bridge |
| v4.0 | 🔮 Planned | Network layer (libp2p), WASM contract VM, ZK proofs, sharding |

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

## 👤 Author

**James Jackson** — [@jacksonjp0311-gif](https://github.com/jacksonjp0311-gif)

---

*Three hashes. One truth. Zero blind spots.*
