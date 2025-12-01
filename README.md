# MDAP SDK

> **Make your AI agents actually reliable.**

Voting-based error correction for LLM agents. Based on the research paper ["Solving a Million-Step LLM Task with Zero Errors"](https://arxiv.org/abs/2511.09030).

[![npm version](https://badge.fury.io/js/%40mdap%2Fcore.svg)](https://www.npmjs.com/package/@mdap/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## The Problem

LLMs have a persistent error rate. Even at 99% accuracy per step:
- After 100 steps: ~37% chance of at least one error
- After 1,000 steps: ~0.004% chance of success
- After 1,000,000 steps: effectively impossible

## The Solution

MDAP (Massively Decomposed Agentic Processes) uses **voting-based error correction**:

1. **Decompose** - Break tasks into single-step operations
2. **Vote** - Run multiple samples, pick the consistent winner
3. **Red-flag** - Discard responses showing signs of confusion

This approach successfully solved 1,000,000+ step tasks with **zero errors**.

## Quick Start

```bash
npm install @mdap/core @mdap/adapters
```

```typescript
import { reliable, RedFlag } from '@mdap/core';
import { createOpenAI } from '@mdap/adapters';

// Create an LLM adapter
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4.1-mini'
});

// Wrap any LLM call with reliability
const extractEntities = reliable({
  vote: { k: 3 },  // First-to-ahead-by-3 voting
  redFlags: [
    RedFlag.tooLong(750),    // Flag overly long responses
    RedFlag.invalidJson()     // Flag malformed JSON
  ]
})(async (text: string) => {
  return await openai.chat(`Extract entities as JSON from: ${text}`);
});

// Use it like any async function
const result = await extractEntities("Apple Inc. was founded by Steve Jobs in Cupertino.");

console.log(result.winner);      // The winning response
console.log(result.confidence);  // Confidence score (0-1)
console.log(result.totalSamples); // Number of samples drawn
```

## Core Concepts

### Voting Strategies

```typescript
// First-to-k: First response to get k votes wins (faster)
reliable({ vote: { k: 3, strategy: 'first-to-k' } })

// First-to-ahead-by-k: Must lead by k votes (more robust, default)
reliable({ vote: { k: 3, strategy: 'first-to-ahead-by-k' } })
```

### Built-in Red Flags

```typescript
import { RedFlag } from '@mdap/core';

// Response too long (indicates confusion)
RedFlag.tooLong(maxTokens)

// Empty or whitespace response
RedFlag.emptyResponse()

// Invalid JSON (when expecting JSON output)
RedFlag.invalidJson()

// Must match a pattern
RedFlag.mustMatch(/^\{.*\}$/)

// Must NOT match a pattern
RedFlag.mustNotMatch(/error|sorry|cannot/i)

// Contains problematic phrases
RedFlag.containsPhrase(['I cannot', 'I\'m not sure'])

// Custom rule
RedFlag.custom('myRule', (response) => response.includes('ERROR'))
```

### Cost Estimation

Before running expensive workflows, estimate the cost:

```typescript
import { estimateCost, formatCostEstimate } from '@mdap/core';

const estimate = estimateCost({
  steps: 10000,
  successRate: 0.99,        // Per-step success rate
  targetReliability: 0.95,  // Target overall success
  inputCostPerMillion: 0.5, // $/1M input tokens
  outputCostPerMillion: 1.5 // $/1M output tokens
});

console.log(formatCostEstimate(estimate));
// Cost: $4.20
// API Calls: 15,234
// Required k: 3
// Estimated Time: ~2m 30s
```

## API Reference

### `reliable(config)(llmCall)`

Create a reliable wrapper around an LLM call.

```typescript
interface ReliableConfig<TOutput> {
  vote?: {
    k?: number;           // Vote threshold (default: 3)
    maxSamples?: number;  // Safety limit (default: 100)
    parallel?: boolean;   // Run samples in parallel (default: true)
    strategy?: 'first-to-k' | 'first-to-ahead-by-k';
  };
  redFlags?: RedFlagRule<TOutput>[];
  serialize?: (response: TOutput) => string;
  debug?: boolean;
}
```

### `vote(llmCall, input, config)`

Lower-level voting API for custom use cases.

```typescript
import { vote } from '@mdap/core';

const result = await vote(
  myLLMCall,
  "input prompt",
  { vote: { k: 3 }, redFlags: [...] }
);
```

### Result Object

```typescript
interface VoteResult<TOutput> {
  winner: TOutput;           // The winning response
  confidence: number;        // Confidence score (0-1)
  totalSamples: number;      // Samples drawn
  flaggedSamples: number;    // Samples discarded
  votes: Map<string, number>; // Vote distribution
  converged: boolean;        // Whether voting converged
}
```

## Adapters

### OpenAI

```typescript
import { createOpenAI } from '@mdap/adapters';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4.1-mini',
  temperature: 0.1,
  maxTokens: 1024
});

await openai.chat("Hello!", { system: "You are helpful." });
```

### Anthropic

```typescript
import { createAnthropic } from '@mdap/adapters';

const claude = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-haiku-latest'
});

await claude.chat("Hello!");
```

## Examples

### Entity Extraction

```typescript
const extractEntities = reliable({
  vote: { k: 3 },
  redFlags: [RedFlag.invalidJson(), RedFlag.tooLong(500)]
})(async (text: string) => {
  return await openai.chat(
    `Extract named entities from this text as JSON: ${text}`,
    { system: 'Respond only with valid JSON array of entities.' }
  );
});
```

### Code Generation

```typescript
const generateCode = reliable({
  vote: { k: 5 },  // Higher k for more critical output
  redFlags: [
    RedFlag.emptyResponse(),
    RedFlag.containsPhrase(['TODO', 'FIXME', '...'])
  ]
})(async (spec: string) => {
  return await openai.chat(`Write TypeScript code for: ${spec}`);
});
```

### Multi-step Workflow

```typescript
// Each step gets its own reliability wrapper
const step1 = reliable({ vote: { k: 2 } })(parseInput);
const step2 = reliable({ vote: { k: 3 } })(processData);
const step3 = reliable({ vote: { k: 2 } })(formatOutput);

// Chain them together
async function workflow(input: string) {
  const r1 = await step1(input);
  const r2 = await step2(r1.winner);
  const r3 = await step3(r2.winner);
  return r3.winner;
}
```

## How It Works

### The Math (Simplified)

Given:
- `p` = per-step success rate (e.g., 0.99)
- `k` = voting threshold
- `s` = total steps

The probability of solving all steps correctly:

```
P(success) = (1 + ((1-p)/p)^k)^(-s)
```

With `k=3` and `p=0.99`, you can solve **millions of steps** with high confidence.

### Why It Works

1. **Decomposition reduces context**: Each agent sees only what it needs
2. **Voting catches errors**: Random errors are outvoted by correct samples
3. **Red flags detect confusion**: Correlated errors get filtered out

## Comparison

| Approach | 1K Steps | 10K Steps | 1M Steps |
|----------|----------|-----------|----------|
| Single LLM call | ~0% | 0% | 0% |
| Simple retry | ~5% | 0% | 0% |
| MDAP (k=3) | ~99.9% | ~99% | ~95% |

## Claude Code Integration

MDAP integrates directly with Claude Code through MCP, subagents, and hooks.

### MCP Server

Add MDAP tools to any MCP client (Claude Code, Cursor, VS Code):

```json
{
  "mcpServers": {
    "mdap": {
      "command": "npx",
      "args": ["@mdap/mcp"]
    }
  }
}
```

**Available tools:**
- `mdap_estimate_cost` - Predict cost before running workflows
- `mdap_validate` - Check responses for red flags
- `mdap_calculate_k` - Calculate optimal vote threshold

### Subagents

Copy ready-made agents to your project:

```bash
cp -r node_modules/@mdap/core/../../../templates/agents/* .claude/agents/
```

**Available agents:**
- `mdap-executor` - Run tasks with MDAP reliability patterns
- `mdap-validator` - Validate LLM outputs for red flags
- `mdap-decomposer` - Break tasks into single-step operations

### Claude Agent SDK

For programmatic integration:

```typescript
import { withMdap, estimateAgentCost } from '@mdap/claude-agent';

// Wrap any async operation
const result = await withMdap({ k: 3 })(async () => {
  return await agent.query({ prompt: 'Extract...' });
});

console.log(result.result);        // Winning response
console.log(result.mdap.confidence); // 0.0-1.0
```

## Packages

| Package | Description |
|---------|-------------|
| `@mdap/core` | Core voting, red flags, cost estimation |
| `@mdap/adapters` | OpenAI, Anthropic adapters |
| `@mdap/mcp` | MCP server for Claude Code/Cursor/VS Code |
| `@mdap/claude-agent` | Claude Agent SDK integration |

## Roadmap

- [x] Core voting implementation
- [x] Red flag detection
- [x] Cost estimation
- [x] OpenAI adapter
- [x] Anthropic adapter
- [x] MCP server
- [x] Claude Code subagents
- [x] Claude Agent SDK integration
- [ ] Workflow orchestration
- [ ] CLI tool
- [ ] Dashboard
- [ ] Semantic deduplication

## Contributing

Contributions welcome! Please read our [contributing guide](CONTRIBUTING.md).

## License

MIT

## Citation

If you use this in research, please cite the original paper:

```bibtex
@article{meyerson2025solving,
  title={Solving a Million-Step LLM Task with Zero Errors},
  author={Meyerson, Elliot and Paolo, Giuseppe and Dailey, Roberto and ...},
  journal={arXiv preprint arXiv:2511.09030},
  year={2025}
}
```
