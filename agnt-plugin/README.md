# Triadix Ledger v2.0

**Three hashes. One truth. Zero blind spots.**

A coherence-native triadic ledger kernel for AGNT. Not just a hash chain — a full distributed ledger platform with smart contracts, BFT consensus, P2P networking, and persistent storage.

## What Makes Triadix Different

Most ledgers answer one question: *"Did the chain link correctly?"*

Triadix answers two:
1. **Did the chain link correctly?** — Full recomputation-based validation
2. **Is the evolving internal state still coherent?** — Triadic state cycle with entropy, phase drift, and coherence metrics

That second question is the breakthrough. No other ledger monitors its own internal state health in real time.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  TRIADIX LEDGER v2.0                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  TRIADIC HASH CYCLE          COHERENCE METRICS          │
│  ┌─────┐ ┌─────┐ ┌─────┐   E = entropy(hE)           │
│  │ hE  │ │ hI  │ │ hC  │   I = entropy(hI)           │
│  └──┬──┘ └──┬──┘ └──┬──┘   Δφ = avg hamming distance  │
│     └───────┼───────┘       C = (E×I)/(1+|Δφ|)       │
│             │                                           │
│  ┌──────────┴──────────────────────────────────────┐   │
│  │              LEDGER ENGINE                       │   │
│  │  Genesis → Blocks → Mempool → Receipts          │   │
│  │  Nonces → Checkpoints → Validation              │   │
│  └───────┬──────────┬──────────┬──────────┬────────┘   │
│          │          │          │          │             │
│  ┌───────┴──┐ ┌─────┴───┐ ┌───┴────┐ ┌──┴──────┐     │
│  │ CONTRACT │ │  BFT    │ │  P2P   │ │ SQLITE  │     │
│  │ VM       │ │CONSENSUS│ │ GOSSIP │ │PERSIST  │     │
│  │ Sandboxed│ │ 2/3     │ │Broadcast│ │ AGNT DB │     │
│  │ JS exec  │ │ Quorum  │ │ Dedup  │ │ Tables  │     │
│  │ State    │ │ Propose │ │ Peers  │ │ Chains  │     │
│  │ Transfer │ │ Vote    │ │ Sync   │ │ Blocks  │     │
│  │ Log      │ │ Commit  │ │        │ │ Txns    │     │
│  └──────────┘ └─────────┘ └────────┘ └─────────┘     │
│                                                         │
│  8 Tools • Bundled Dependencies • ~15 KB                  │
└─────────────────────────────────────────────────────────┘
```

## 8 Tools

| Tool | Purpose |
|------|---------|
| **triadix-run** | Generate triadic hash chain. Genesis → N blocks → coherence metrics → validation → health report. |
| **triadix-submit-tx** | Submit signed transaction to mempool. Auto-broadcasts via gossip protocol. |
| **triadix-status** | Full chain status: validation, health, coherence, mempool, contracts, consensus, network. |
| **triadix-health-report** | Detailed health report with ASCII coherence chart and markdown summary. |
| **triadix-deploy-contract** | Deploy or call smart contracts. Experimental gas-metered JS execution with state, logging, transfers; not a hardened security sandbox. |
| **triadix-consensus** | BFT-lite consensus: propose → vote → quorum (2/3) → commit finalized blocks. |
| **triadix-gossip** | P2P gossip protocol: peers, broadcast TXs/blocks, network discovery, full simulation. |
| **triadix-persist** | Chain persistence: save/load, import/export, list chains, AGNT SQLite integration. |

## Quick Start

### 1. Generate a Chain
```
Tool: triadix-run
Parameters: blocks=96, tau=0.244, healthMode=p25
```
Returns: chain, validation, health, coherence stats, ASCII chart, markdown report.

### 2. Deploy a Smart Contract
```
Tool: triadix-deploy-contract
Parameters:
  contractAddress = "counter-1"
  action = "deploy"
  contractCode = "if (!state.count) state.count = 0; state.count += (args.amount || 1); return state.count;"
  owner = "alice"
  initialState = {"count": 0}
```

### 3. Run Consensus
```
Tool: triadix-consensus
Parameters: action=propose, proposalId="block-97"

Tool: triadix-consensus
Parameters: action=vote, proposalId="block-97", validatorId="v1", approve=true
(repeat for v2, v3... until quorum reached)

Tool: triadix-consensus
Parameters: action=check, proposalId="block-97"
→ { status: "committed", approveCount: 3, quorum: 3 }
```

### 4. Simulate P2P Network
```
Tool: triadix-gossip
Parameters: action=full-network-sim, simulatePeers=10
```
Creates 10 peers, broadcasts TX/block/discovery messages, verifies dedup.

## The Triadic Hash Cycle

Each block updates three coupled SHA-256 channels:

```
pE = payload (raw)           → hE = SHA256(hE || hI || hC || pE)
pI = sorted(payload)         → hI = SHA256(hI || hC || hE || pI)
pC = SHA256(payload)         → hC = SHA256(hC || hE || hI || pC)
```

This creates three independent but entangled hash trajectories. The coherence between them is what makes Triadix unique.

## Coherence Metrics

| Metric | Formula | Meaning |
|--------|---------|---------|
| **E** | entropy(hE) / 8 | Normalized entropy of raw channel |
| **I** | entropy(hI) / 8 | Normalized entropy of sorted channel |
| **Δφ** | avg hamming(hE,hI,hC) | Phase drift between channels |
| **C** | (E × I) / (1 + \|Δφ\|) | Overall coherence score |

**Health policy**: Chain is healthy when `p25(C) ≥ τ` (default τ = 0.244).

## Smart Contract VM

Contracts use experimental gas-metered JavaScript execution with access to:
- **`state`** — persistent key-value store (committed on-chain)
- **`caller`** — address that triggered this call
- **`args`** — method arguments
- **`log(msg)`** — emit log events
- **`transfer(to, amount)`** — initiate transfers
- **`now`** — current timestamp

## BFT-Lite Consensus

Classic propose-vote-commit with configurable quorum:
- Default: 2/3 validator threshold
- Atomic commit once quorum reached
- Full proposal lifecycle tracking
- Integrates with triadic block hashes for proposal binding

## P2P Gossip Protocol

Message types:
- `NEW_TX` — broadcast new transaction
- `NEW_BLOCK` — broadcast new block
- `PEER_DISCOVERY` — share known peers
- `CHAIN_SYNC` — request chain data
- `CONSENSUS_VOTE` — broadcast consensus votes

Features: message dedup, TTL/hop counting, broadcast simulation up to 50 nodes.

## SQLite Persistence

When integrated with AGNT's database layer, creates tables:
- `triadix_chains` — chain metadata, health, coherence
- `triadix_blocks` — per-block hash + metrics
- `triadix_transactions` — all transactions
- `triadix_contracts` — deployed contracts + state
- `triadix_peers` — network peer table
- `triadix_consensus_log` — full consensus history

Falls back to JSON file persistence when no DB context available.

## Benchmarks

| Metric | Value |
|--------|-------|
| Throughput | ~6,400 blocks/sec (pure JS) |
| 100K block validation | < 3 seconds |
| Memory (100 blocks) | ~200 KB |
| Memory (10K blocks) | ~20 MB |
| Plugin size | Generated .agnt package with bundled dependencies |

## Use Cases

- **Provenance tracking** — tamper-evident audit logs for agent actions
- **Coherence monitoring** — detect drift in decision systems
- **Smart contracts** — on-chain programs with coherence-verified state
- **Multi-agent consensus** — BFT agreement between AGNT agents
- **P2P coordination** — gossip-based agent communication networks

## Author

James Jackson — [GitHub](https://github.com/jacksonjp0311-gif)

## License

MIT
