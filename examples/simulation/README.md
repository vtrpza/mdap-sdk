# MDAP Live Simulation: 1000-Step Code Analysis Chain

Demonstrates MDAP's voting-based error correction with real LLM API calls.

## Overview

This simulation runs 1000 iterations of a 3-step code analysis pipeline:

1. **Identify Issues** - Detect bugs, code smells, security issues
2. **Classify Severity** - Rate as critical/high/medium/low
3. **Suggest Fix** - Provide a one-line fix suggestion

Each step uses MDAP's `reliable()` wrapper with first-to-ahead-by-k voting (k=3 by default).

## Prerequisites

- Node.js 18+
- OpenAI API key with access to gpt-4o-mini
- Built MDAP packages (`pnpm build` from root)

## Usage

### Basic Run (1000 steps, ~$1-4 cost)

```bash
OPENAI_API_KEY=sk-... npx tsx examples/simulation/code-analysis-1000.ts
```

### Dry Run (no API calls)

```bash
npx tsx examples/simulation/code-analysis-1000.ts --dry-run
```

### Custom Options

```bash
OPENAI_API_KEY=sk-... npx tsx examples/simulation/code-analysis-1000.ts \
  --steps 100 \       # Number of iterations
  --k 5 \             # Voting k value (higher = more reliable)
  --max-cost 2 \      # Stop if cost exceeds $2
  --delay 100         # Delay between steps (ms)
```

### Resume from Checkpoint

Checkpoints are saved every 100 iterations:

```bash
OPENAI_API_KEY=sk-... npx tsx examples/simulation/code-analysis-1000.ts \
  --resume results/checkpoint-1234567890.json
```

## Output

### Real-time Progress

```
[42/1000] ✓ divide
  ├─ identify:  ✓ (3 samples, 100%)
  ├─ classify:  ✓ (4 samples, 75%)
  └─ suggest:   ✓ (3 samples, 100%)
  Time: 2.3s | Avg: 2.1s/step | ETA: 33m 45s
Progress: 42/1000 | Success: 100.0% | Samples: 420 | Cost: $0.042
```

### Final Report

```
╔════════════════════════════════════════════════════════════════╗
║                      SIMULATION COMPLETE                       ║
╠════════════════════════════════════════════════════════════════╣
║  Total Iterations:  1000                                       ║
║  Successful:        998                                        ║
║  Failed:            2                                          ║
║  Success Rate:      99.80%                                     ║
╠════════════════════════════════════════════════════════════════╣
║  Total Samples:     10,234                                     ║
║  Flagged Samples:   156                                        ║
║  Avg Confidence:    94.2%                                      ║
╠════════════════════════════════════════════════════════════════╣
║  COMPARISON (vs single-sample):                                ║
║    Expected failures (no MDAP): ~60                            ║
║    Actual failures (with MDAP): 2                              ║
║    Reliability improvement:     30x                            ║
╚════════════════════════════════════════════════════════════════╝
```

### Results File

Results are saved to `results/simulation-{timestamp}.json`:

```json
{
  "config": { "steps": 1000, "k": 3, "model": "gpt-4o-mini" },
  "results": {
    "totalIterations": 1000,
    "successRate": 0.998,
    "totalSamples": 10234,
    "avgConfidence": 0.942,
    "estimatedCostUsd": 2.34
  },
  "comparison": {
    "singleSampleExpectedFailures": 60,
    "mdapActualFailures": 2,
    "reliabilityImprovement": "30x"
  }
}
```

## Cost Estimation

| Steps | K | Est. API Calls | Est. Cost |
|-------|---|----------------|-----------|
| 100   | 3 | ~1,000         | $0.10-0.50 |
| 500   | 3 | ~5,000         | $0.50-2.00 |
| 1000  | 3 | ~10,000        | $1.00-4.00 |
| 1000  | 5 | ~15,000        | $1.50-6.00 |

Costs vary based on convergence rates and flagging.

## Code Snippets

The simulation analyzes 1000 TypeScript code snippets including:

- **Intentional bugs**: Off-by-one errors, null dereferencing, division by zero
- **Security issues**: SQL injection, hardcoded secrets
- **Performance issues**: O(n^3) algorithms, missing memoization
- **Good patterns**: Proper error handling, type safety
- **Edge cases**: Empty checks, deep cloning issues

See `code-snippets.ts` for the full list.

## Architecture

```
code-analysis-1000.ts
        │
        ▼
┌───────────────────┐
│  For each snippet │
└────────┬──────────┘
         │
         ▼
┌───────────────────────────────────────────────────────┐
│  Step 1: identifyIssues                               │
│  ┌─────────────────────────────────────────────────┐  │
│  │  reliable({ k: 3 })                             │  │
│  │    → Sample 1: {"issues": [...]}  ✓ 1 vote      │  │
│  │    → Sample 2: {"issues": [...]}  ✓ 2 votes     │  │
│  │    → Sample 3: {"issues": [...]}  ✓ 3 votes ★   │  │
│  └─────────────────────────────────────────────────┘  │
└────────┬──────────────────────────────────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────────┐
│  Step 2: classifySeverity                             │
│  ┌─────────────────────────────────────────────────┐  │
│  │  reliable({ k: 3 })                             │  │
│  │    → Sample 1: {"severity": "medium"} ✓ 1 vote  │  │
│  │    → Sample 2: {"severity": "high"} (different) │  │
│  │    → Sample 3: {"severity": "medium"} ✓ 2 votes │  │
│  │    → Sample 4: {"severity": "medium"} ✓ 3 votes ★│  │
│  └─────────────────────────────────────────────────┘  │
└────────┬──────────────────────────────────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────────┐
│  Step 3: suggestFix                                   │
│  ┌─────────────────────────────────────────────────┐  │
│  │  reliable({ k: 3 })                             │  │
│  │    → Sample 1: "Add null check" ✓ 1 vote        │  │
│  │    → Sample 2: "Add null check" ✓ 2 votes       │  │
│  │    → Sample 3: "Add null check" ✓ 3 votes ★     │  │
│  └─────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘
```
