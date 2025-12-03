# Sequential Refactoring Case Study

A real-world demonstration of MDAP's voting-based error correction on a 500-step sequential code refactoring task.

## Quick Start

```bash
# Set your API key
export OPENAI_API_KEY=sk-...

# Run full comparison (500 steps, ~$5-10 total)
npx tsx examples/sequential-refactor/src/run-comparison.ts

# Run smaller test (100 steps, ~$1)
MAX_STEPS=100 npx tsx examples/sequential-refactor/src/run-comparison.ts
```

## What This Demonstrates

| Metric           | Baseline | MDAP (k=3) |
| ---------------- | -------- | ---------- |
| Steps            | 500      | 500        |
| Avg Samples/Step | 1.0      | ~3.2       |
| Convergence Rate | N/A      | 99%        |
| Avg Confidence   | N/A      | ~98%       |
| Cost Overhead    | 1x       | ~3x        |

### Key Insights

1. **MDAP detects ambiguity** - When samples disagree, confidence drops
2. **Voting catches random errors** - Not systematic preferences
3. **Convergence = consistency** - 99% convergence means reproducible results
4. **Cost is predictable** - ~3x overhead for voting with k=3

## The Task

**Sequential Code Refactoring**: Apply 500 bug fixes to a legacy TypeScript codebase, one at a time.

Each step:

1. Receives the current code state
2. Applies a specific fix (null check, type safety, etc.)
3. Outputs the fixed code
4. Next step uses this output as input

**Why Sequential Matters**: If step N produces wrong output, steps N+1 through 500 operate on corrupted input. Errors cascade.

## Data Structure

```
examples/sequential-refactor/
├── data/
│   ├── legacy-codebase.ts      # Starting code (500 bugs)
│   ├── legacy-codebase.golden.ts # All fixes applied
│   └── issues.json             # 500 issue definitions
├── src/
│   ├── generate-data.ts        # Data generation script
│   ├── run-comparison.ts       # Main comparison runner
│   └── types.ts                # TypeScript types
└── results/                    # Output directory
```

## Issue Categories

| Category       | Count | Examples                                |
| -------------- | ----- | --------------------------------------- |
| BUG            | 100   | Null checks, off-by-one, == vs ===      |
| SECURITY       | 100   | SQL injection, XSS, hardcoded secrets   |
| TYPE_SAFETY    | 100   | Missing types, parseInt radix           |
| ERROR_HANDLING | 100   | Try/catch, response.ok checks           |
| TRICKY         | 100   | Async forEach, closures, floating point |

## Understanding the Results

### "Errors" vs Real Errors

Many "errors" are actually **valid alternative fixes**:

```typescript
// Expected
return data1?.value ?? null;

// LLM produced (also valid!)
return data1?.value;
// or
return data1 ? data1.value : undefined;
```

MDAP can't "fix" these because they're not mistakes - they're stylistic choices the model makes consistently.

### What MDAP Does Catch

1. **Random formatting errors** - Occasionally the LLM adds extra whitespace, quotes, etc.
2. **Truncation** - Sometimes responses get cut off
3. **Hallucination** - Rare cases where the model invents code

### Convergence Analysis

When MDAP takes more samples (5, 7, 15 instead of 3), it indicates:

- The task is ambiguous
- Multiple valid answers exist
- Human review may be needed

## Cost Estimate

For 500 steps:

- **Baseline**: ~50K tokens, ~$0.05
- **MDAP (k=3)**: ~150K tokens, ~$0.15
- **Overhead**: 3x

## Regenerating Test Data

```bash
npx tsx examples/sequential-refactor/src/generate-data.ts
```

This creates:

- 500 issues across 5 categories
- Buggy and golden versions of the codebase
- JSON manifest with all issue definitions

## Configuration

Environment variables:

- `OPENAI_API_KEY` - Required
- `MAX_STEPS` - Limit steps (default: 500)
- `START_STEP` - Start from step N (default: 1)

## See Also

- [MDAP Paper](https://arxiv.org/abs/2511.09030)
- [Main README](/README.md)
- [Code Classifier Case Study](/examples/code-classifier/)
