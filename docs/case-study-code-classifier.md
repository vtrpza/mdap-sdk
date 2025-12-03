# Case Study: Code Classifier

A real-world comparison demonstrating MDAP's voting-based error correction for code classification.

## Executive Summary

| Metric              | Baseline | MDAP  | Observation     |
| ------------------- | -------- | ----- | --------------- |
| Accuracy            | 78.8%    | 78.0% | Same (expected) |
| Valid Response Rate | 100%     | 100%  | Both valid      |
| Convergence Rate    | N/A      | 100%  | Perfect         |
| Avg Confidence      | N/A      | 99.4% | Very high       |
| Avg Samples/Step    | 1        | 3.07  | ~3x overhead    |

### Key Insight

**MDAP doesn't improve accuracy on subjective tasks** - it ensures consistency and catches errors.

The ~22% "error rate" consists of genuinely ambiguous cases where reasonable people (and models) might disagree. For example:

- Is a missing `await` a **BUG** or **PERFORMANCE** issue?
- Is string concatenation in a loop **PERFORMANCE** or **STYLE**?

MDAP's value is in:

1. **Catching malformed responses** before they propagate
2. **Providing confidence scores** to flag uncertain cases
3. **Ensuring reproducible results** via voting consensus

## Methodology

### Dataset

50 TypeScript/JavaScript code snippets with human-labeled classifications:

- **BUG** (15): Null pointers, off-by-one, async issues
- **SECURITY** (10): SQL injection, XSS, hardcoded secrets
- **STYLE** (10): Magic numbers, poor naming, dead code
- **PERFORMANCE** (10): N+1 queries, inefficient algorithms
- **NONE** (5): Clean, well-written code

Each snippet classified 5 times (250 total steps) to measure consistency.

### Configuration

- **Model**: gpt-4.1-mini (paper recommendation)
- **Temperature**: 0.1 (low for consistency)
- **MDAP k**: 3 (first to lead by 3 votes wins)
- **Red Flags**: `emptyResponse`, `mustMatch:^(BUG|SECURITY|STYLE|PERFORMANCE|NONE)$`

## Results by Category

| Category    | Baseline | MDAP  | Notes                                      |
| ----------- | -------- | ----- | ------------------------------------------ |
| BUG         | 66.7%    | 66.7% | Hardest - often ambiguous with PERFORMANCE |
| SECURITY    | 94.0%    | 90.0% | Easiest - clear patterns                   |
| STYLE       | 90.0%    | 90.0% | Well-defined category                      |
| PERFORMANCE | 60.0%    | 60.0% | Often confused with BUG                    |
| NONE        | 100%     | 100%  | Correctly identified clean code            |

### Analysis

The BUG and PERFORMANCE categories have the lowest accuracy because many issues can be classified either way:

```typescript
// Is this a BUG or PERFORMANCE issue?
async function saveAll(items) {
  items.forEach(async (item) => {
    await saveItem(item); // Not awaited properly
  });
}
```

Both classifications are arguably correct - the LLM consistently picks one interpretation.

## MDAP-Specific Metrics

### Convergence

- **100% convergence rate** - Every classification reached consensus
- **Average 3.07 samples** - Very efficient (minimum is 3)
- **0 flagged responses** - All responses were valid format

### Confidence Distribution

- **99.4% average confidence** - Strong agreement between samples
- This means 3 out of 3 samples agreed on 99.4% of classifications

## When MDAP Helps Most

Based on this case study, MDAP provides the most value when:

1. **Response format matters** - The `mustMatch` red flag ensures valid categories
2. **Consistency is critical** - 100% convergence = reproducible results
3. **You need confidence scores** - Flag low-confidence results for human review

### When to Use Human Review

Classifications with <90% confidence (where samples disagree) likely represent:

- Genuinely ambiguous cases
- Edge cases the model struggles with
- Categories that need clearer definitions

## Cost Analysis

| Metric         | Baseline | MDAP    |
| -------------- | -------- | ------- |
| Input Tokens   | 46,020   | 150,213 |
| Output Tokens  | 332      | 1,275   |
| Token Overhead | 1x       | 3.27x   |
| Estimated Cost | ~$0.02   | ~$0.07  |

**Per classification**: ~$0.00008 (baseline) vs ~$0.00028 (MDAP)

For 1 million classifications:

- Baseline: ~$80
- MDAP: ~$280
- **Additional cost for guaranteed format validity and confidence scores**: $200

## Recommendations

### Use MDAP When:

- Response format must be strictly validated
- You need confidence scores for each result
- Consistency across runs is required
- Building pipelines where errors cascade

### Skip MDAP When:

- Task has only one "correct" answer
- You're exploring/prototyping
- Cost is the primary concern
- You'll manually review all outputs anyway

## Reproducing This Study

```bash
# Clone the repo
git clone https://github.com/vtrpza/mdap-sdk
cd mdap-sdk

# Install dependencies
pnpm install

# Run the comparison
OPENAI_API_KEY=sk-... npx tsx examples/code-classifier/run-comparison.ts
```

Results are saved to `results/comparison-{timestamp}.json`.

## Related Resources

- [MDAP Paper: Solving a Million-Step LLM Task with Zero Errors](https://arxiv.org/abs/2505.13398)
- [Quick Start Guide](/examples/code-classifier/README.md)
- [Main Documentation](/README.md)
