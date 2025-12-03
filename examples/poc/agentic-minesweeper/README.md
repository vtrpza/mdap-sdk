# Agentic Minesweeper POC

Proof-of-concept demonstrating that **cheaper models + MDAP can outperform expensive models alone** in long sequential agentic tasks.

## Hypothesis

Based on the paper ["Solving a Million-Step LLM Task with Zero Errors"](https://arxiv.org/abs/2511.09030):

> In sequential agentic pipelines, random errors cascade and compound. MDAP's voting mechanism catches these random errors before they propagate, enabling reliable completion of long tasks.

**We predict:**

- `gpt-4.1-mini` alone will produce buggy, incomplete Minesweeper games
- `gpt-4.1-mini + MDAP` will produce polished, working games
- `gpt-4o` alone (6x more expensive) will still have issues
- **Cost-effectiveness**: Cheap model + MDAP beats expensive model alone

## Methodology

### Task

Build a complete Minesweeper game from a single specification through 120 atomic code steps.

Each step is a small, atomic change:

- Add a CSS rule
- Define a variable
- Write a function
- Add an event listener

This mirrors the paper's approach where "steps are small enough that, for each step, a correct solution is likely to be sampled."

### Trial Configuration

| Config        | Model        | MDAP      | Trials | Est. Cost |
| ------------- | ------------ | --------- | ------ | --------- |
| mini-baseline | gpt-4.1-mini | No        | 5      | ~$0.15    |
| mini-mdap     | gpt-4.1-mini | Yes (k=3) | 5      | ~$0.50    |
| 4o-baseline   | gpt-4o       | No        | 3      | ~$1.80    |

### Measurement

**Primary metric**: Does it "feel better"?

- Open the generated `index.html`
- Play the game
- Assess: Does it look good? Does it work?

**Secondary metrics**:

- Completion rate (did agent finish all steps?)
- Cost per trial
- Time per trial
- Samples per step (for MDAP)

## Running the Experiment

```bash
# Set your API key
export OPENAI_API_KEY="sk-..."

# Run all trials
npx tsx examples/poc/agentic-minesweeper/run-trials.ts

# Or run a single test trial
npx tsx examples/poc/agentic-minesweeper/agent-loop.ts
```

### Environment Variables

| Variable         | Default      | Description             |
| ---------------- | ------------ | ----------------------- |
| `OPENAI_API_KEY` | (required)   | Your OpenAI API key     |
| `MODEL`          | gpt-4.1-mini | Model to use            |
| `USE_MDAP`       | false        | Enable MDAP voting      |
| `K`              | 3            | Vote threshold for MDAP |
| `MAX_STEPS`      | 120          | Number of build steps   |
| `TEMPERATURE`    | 0.1          | Sampling temperature    |

## Output

After running, check:

```
outputs/
  mini-baseline-trial-1-xxx/index.html   # Open in browser
  mini-mdap-trial-1-xxx/index.html       # Open in browser
  4o-baseline-trial-1-xxx/index.html     # Open in browser

results/
  comparison-xxx.json                     # Full trial data
```

## Why This Proves MDAP's Value

1. **Long sequential task**: 120 steps where errors cascade
2. **Real-world relevant**: Building a UI is what developers do with AI
3. **Clear success criteria**: The game either works or it doesn't
4. **Cost comparison**: Shows cheaper model + MDAP beats expensive model

## Expected Results

| Config        | Expected Outcome                                |
| ------------- | ----------------------------------------------- |
| mini-baseline | Broken CSS, missing features, coherence drift   |
| mini-mdap     | Polished UI, all features work, consistent      |
| 4o-baseline   | Better than mini-baseline, but still has issues |

**The compelling proof**: Users can play both games and _feel_ the difference.

## Paper Reference

Based on: "Solving a Million-Step LLM Task with Zero Errors" (Meyerson et al., 2025)

Key insight: Even small per-step error rates (0.14%) make long sequential tasks impossible without error correction. MDAP reduces effective error rate from ε to ε^k through voting.
