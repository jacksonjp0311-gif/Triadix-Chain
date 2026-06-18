# Triadix Chain — Architecture Deep Dive

## Core Philosophy

Triadix is built on a simple insight: **a ledger should not only verify linkage, but also measure the internal health of its own state.** This is achieved through a triadic hash cycle that creates three entangled hash trajectories, with coherence metrics that quantify how well those trajectories are aligned.

## The Triadic Hash Cycle

```
Input:  (hE, hI, hC, payload)
Output: (hE', hI', hC')

pE = payload                          (raw)
pI = bytes(sorted(payload))           (sorted)
pC = SHA256(payload)                  (pre-hashed)

hE' = SHA256(hE || hI || hC || pE)
hI' = SHA256(hI || hC || hE || pI)
hC' = SHA256(hC || hE || hI || pC)
```

### Why Three Channels?

| Channel | Measures | Sensitivity |
|---------|----------|-------------|
| **hE** | Content entropy | Changes with any byte in payload |
| **hI** | Distribution entropy | Changes only with byte frequency, not order |
| **hC** | Digest-space entropy | Changes with any bit in the SHA-256 digest |

The **phase drift** (Δφ) between these channels detects when the payload distribution is becoming anomalous — even if the hash linkage is still valid.

## Coherence Metrics

```
E  = entropy(hE) / 8                    ∈ [0, 1]
I  = entropy(hI) / 8                    ∈ [0, 1]
Δφ = avg(hamming(hE,hI), hamming(hI,hC), hamming(hC,hE))  ∈ [0, 1]
C  = (E × I) / (1 + |Δφ|)             ∈ [0, 1]
```

- **High E, High I, Low Δφ** → High coherence (healthy chain)
- **Low E or Low I** → Low entropy in one channel (suspicious)
- **High Δφ** → Channels are diverging (drift detected)

## Subsystem Architecture

### 1. Ledger Engine
- Genesis block creation
- Block assembly with transaction ordering
- Full recomputation-based validation
- Nonce tracking and duplicate detection
- Checkpoint generation

### 2. Ed25519 Wallets
- Native Node.js `crypto.generateKeyPairSync('ed25519')`
- Sign/verify arbitrary messages
- Transaction signing with public key attachment
- Wallet restoration from private key

### 3. Merkle Trees
- Built automatically from block transactions
- SPV-style inclusion proofs
- Light client verification without full chain download

### 4. Smart Contract VM
- Sandboxed JavaScript execution via `new Function()`
- Gas metering per operation
- Persistent state per contract address
- Transfer and logging primitives

### 5. PBFT Consensus
- Pre-prepare → Prepare → Commit → Committed lifecycle
- Configurable quorum (default 2/3)
- View changes for primary failure
- Checkpointing and state transfer

### 6. P2P Gossip Protocol
- WebSocket transport (real TCP)
- In-process simulation for testing
- Message deduplication
- 5 message types: NEW_TX, NEW_BLOCK, PEER_DISCOVERY, CHAIN_SYNC, CONSENSUS_VOTE

### 7. Agent Memory Bridge
- Maps agent actions to triadic transactions
- Auto-block building every 5 actions
- Per-agent coherence tracking
- Tamper-evident action provenance

### 8. SQLite Persistence
- 7 tables for chains, blocks, transactions, contracts, peers, consensus, agent actions
- JSON file fallback when no DB context
- Full import/export support

## Data Flow

```
Agent Action → AgentMemoryBridge.recordAction()
  → Transaction created (sender=agentId, receiver=tool:name)
  → Added to mempool
  → Auto-block every 5 transactions
    → Block assembled with triadic hash cycle
    → Merkle tree built from transactions
    → Coherence metrics computed
    → Block appended to chain
      → Gossip broadcast (NEW_BLOCK)
      → PBFT consensus (if validators configured)
      → SQLite persistence (if DB available)
```

## Security Properties

| Property | Mechanism |
|----------|-----------|
| **Tamper evidence** | Full recomputation validation — any change breaks the chain |
| **Non-repudiation** | Ed25519 signatures on transactions |
| **Byzantine fault tolerance** | PBFT with 2/3 quorum tolerates f faulty validators out of 3f+1 |
| **Light client verification** | Merkle SPV proofs |
| **Contract safety** | Gas metering prevents infinite loops |
| **Coherence monitoring** | Real-time health metrics detect state drift |
