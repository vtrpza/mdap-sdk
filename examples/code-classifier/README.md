# Code Classifier Case Study

A real-world comparison demonstrating MDAP's voting-based error correction for code classification.

## Quick Start

```bash
# Set your API key
export OPENAI_API_KEY=sk-...

# Run the full comparison (250 steps each, ~$1.40 total)
npx tsx examples/code-classifier/run-comparison.ts

# Or run individually:
npx tsx examples/code-classifier/without-mdap.ts  # Baseline
npx tsx examples/code-classifier/with-mdap.ts     # MDAP
```

## What This Demonstrates

| Metric           | Baseline (1 call) | MDAP (k=3 voting) |
| ---------------- | ----------------- | ----------------- |
| Accuracy         | 78.8%             | 78.0%             |
| Valid Responses  | 100%              | 100%              |
| Convergence Rate | N/A               | 100%              |
| Avg Confidence   | N/A               | 99.4%             |
| Token Overhead   | 1x                | 3.27x             |

**Key Insight**: MDAP provides **consistency and confidence** rather than improved accuracy on subjective tasks. The ~22% "error rate" represents genuinely ambiguous classifications where even humans might disagree (e.g., is a missing `await` a BUG or PERFORMANCE issue?).

## Dataset

50 TypeScript/JavaScript code snippets with known classifications:

- **BUG** (15): Null pointers, off-by-one, async issues
- **SECURITY** (10): SQL injection, XSS, hardcoded secrets
- **STYLE** (10): Magic numbers, poor naming, dead code
- **PERFORMANCE** (10): N+1 queries, inefficient algorithms
- **NONE** (5): Clean, well-written code

Each snippet is classified 5 times (250 total steps) to measure consistency.

## How It Works

### Baseline (`without-mdap.ts`)

Simple single-call classification:

```typescript
const response = await openai.chat(classifyPrompt);
return normalize(response); // Hope it's correct!
```

### MDAP (`with-mdap.ts`)

Voting-based classification with red flags:

```typescript
const result = await executeReliable({
  prompt: classifyPrompt,
  k: 3, // First to lead by 3 votes wins
  redFlags: [
    "emptyResponse",
    "mustMatch:^(BUG|SECURITY|STYLE|PERFORMANCE|NONE)$",
  ],
});
return result.winner; // Validated by consensus
```

## Configuration

Environment variables:

- `OPENAI_API_KEY` - Required
- `RUNS_PER_SNIPPET` - Number of runs per snippet (default: 5)

## Results

Results are saved to `examples/code-classifier/results/`:

- `comparison-{timestamp}.json` - Summary statistics
- `raw-results-{timestamp}.json` - Full raw data

## Cost Estimate

From actual run (250 steps each):

- **Baseline**: 46,352 tokens (~$0.02)
- **MDAP**: 151,488 tokens (~$0.07)
- **Total**: ~$0.09 for the full comparison
- **Token Overhead**: 3.27x

## See Also

- [Full Case Study Documentation](/docs/case-study-code-classifier.md)
- [Main README](/README.md)
- [MDAP Paper](https://arxiv.org/abs/2505.13398)
