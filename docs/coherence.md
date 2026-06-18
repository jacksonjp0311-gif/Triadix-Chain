# Coherence Theory

## What is Coherence?

In Triadix, **coherence** measures how well-aligned the three hash channels (hE, hI, hC) are after processing a block. A coherent chain is one where:

1. Both hE and hI maintain high entropy (the payload is well-distributed)
2. The phase drift Δφ between channels is small (the channels are tracking each other)

## Mathematical Foundation

### Shannon Entropy

For a byte sequence of length n with k distinct byte values:

```
H = -Σ(pᵢ × log₂(pᵢ)) / 8
```

where pᵢ is the frequency of byte value i, and division by 8 normalizes to [0, 1].

### Hamming Distance

For two equal-length byte sequences:

```
hamming(a, b) = Σ popcount(a[i] XOR b[i]) / (8 × len(a))
```

This measures the fraction of bits that differ between two hashes.

### Phase Drift

```
Δφ = (hamming(hE, hI) + hamming(hI, hC) + hamming(hC, hE)) / 3
```

The average pairwise Hamming distance between all three channels.

### Coherence Score

```
C = (E × I) / (1 + |Δφ|)
```

This formula rewards high entropy in both channels while penalizing phase drift. The denominator ensures that even with high entropy, if the channels are diverging, coherence drops.

## Interpretation

| C Range | Interpretation |
|---------|---------------|
| 0.25–0.27 | **Excellent** — High entropy, low drift (typical for healthy chains) |
| 0.20–0.25 | **Good** — Normal operation |
| 0.15–0.20 | **Warning** — Some drift or entropy loss |
| < 0.15 | **Critical** — Significant anomaly detected |

## Calibration

The default τ = 0.244 was calibrated from a 100K-block stress test:

```
100,000 blocks at 3,442 blocks/sec
p25 = 0.244040 → τ = 0.244
75.1% of blocks have C ≥ τ
```

## Health Policy Modes

| Mode | Rule | Use Case |
|------|------|----------|
| `p25` | 25th percentile of C ≥ τ | Balanced (default) |
| `p50` | Median C ≥ τ | Lenient |
| `p05` | 5th percentile C ≥ τ | Strict (financial) |
| `all` | 100% of blocks C ≥ τ | Maximum security |
| `fraction` | ≥ 95% of blocks C ≥ τ | High availability |

## Why This Matters

Traditional blockchains only verify that `hash(block_n) == previous_hash in block_n+1`. Triadix additionally verifies that the **internal state** of the chain remains healthy. This can detect:

- **Data corruption** — Even if linkage holds, coherence drops
- **Adversarial manipulation** — Crafted payloads that maintain linkage but distort distribution
- **Gradual drift** — Slow degradation of state quality over time
- **Anomalous blocks** — Outliers in coherence that warrant investigation
