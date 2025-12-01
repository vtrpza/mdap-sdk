# MDAP SDK Project Overview

## What is MDAP?

MDAP (Massively Decomposed Agentic Processes) is a TypeScript SDK implementing voting-based error correction for LLM agents, based on the research paper "Solving a Million-Step LLM Task with Zero Errors" (arXiv:2511.09030).

## Core Concept

LLMs have persistent error rates. Even at 99% accuracy per step, long workflows fail. MDAP uses:
1. **Decomposition** - Break tasks into single-step operations
2. **Voting** - Run multiple samples, pick the consistent winner (first-to-ahead-by-k)
3. **Red-flagging** - Discard responses showing signs of confusion

## Project Structure

```
mdap-sdk/
├── packages/
│   ├── core/           # Core voting, red flags, cost estimation, workflow
│   ├── adapters/       # OpenAI, Anthropic LLM adapters
│   ├── cli/            # Command-line tools (mdap estimate, mdap validate)
│   ├── mcp/            # MCP server for Claude Code integration
│   └── claude-agent/   # Claude Agent SDK integration
├── templates/
│   ├── agents/         # Subagent templates (mdap-executor, validator, decomposer)
│   └── hooks/          # Hook templates for Claude Code
├── examples/
│   ├── basic.ts        # Basic usage example
│   └── workflow.ts     # Workflow orchestration example
└── .github/workflows/  # CI/CD (test on Node 18/20/22, publish to npm)
```

## Key Files

### Core Package (`packages/core/src/`)
- `voter.ts` - Voting implementation (reliable(), vote())
- `red-flags.ts` - RedFlag rules (tooLong, emptyResponse, invalidJson, etc.)
- `cost.ts` - Cost estimation (estimateCost, calculateMinK)
- `workflow.ts` - Workflow orchestration (workflow(), pipeline(), parallel(), decompose())
- `types.ts` - TypeScript interfaces

### Tests (`packages/core/src/__tests__/`)
- `voter.test.ts` - 15 tests
- `red-flags.test.ts` - 32 tests
- `cost.test.ts` - 29 tests
- **Total: 76 tests**

### CLI Package (`packages/cli/src/`)
- `cli.ts` - Main CLI entry point
- Commands: `estimate`, `validate`, `help`, `version`

## API Highlights

### reliable() wrapper
```typescript
const extract = reliable({
  vote: { k: 3 },
  redFlags: [RedFlag.tooLong(750), RedFlag.invalidJson()]
})(async (text: string) => {
  return await llm(`Extract entities from: ${text}`);
});
```

### Workflow orchestration
```typescript
const wf = workflow<string>('analysis')
  .step('extract', extractFn)
  .step('summarize', summarizeFn);
const result = await wf.run(input);
```

### Parallel execution
```typescript
const results = await parallel({
  entities: extractFn,
  sentiment: sentimentFn
}, { vote: { k: 2 } });
```

## Build & Test

```bash
pnpm install
pnpm build        # Build all packages
pnpm test         # Run all tests (76 tests)
pnpm typecheck    # Type checking
```

## Critical Usage Note

**Prompt Design for Convergence**: Voting only works when responses can converge. Use:
- Constrained categories (not free text)
- Structured JSON output
- Low temperature (0.1)
- JSON validation red flags
- maxSamples: 30 (fail fast)

See README.md "Designing Prompts for Convergence" section.

## Status

**ALL ROADMAP ITEMS COMPLETE**

- [x] Core voting, red flags, cost estimation
- [x] OpenAI/Anthropic adapters
- [x] MCP server
- [x] Claude Code subagents
- [x] Claude Agent SDK integration
- [x] Workflow orchestration
- [x] CLI tool
- [x] Unit tests (113 tests across 4 test files)
- [x] GitHub Actions CI/CD
- [x] Semantic deduplication (fuzzy matching, JSON-aware, custom similarity)
- [x] Dashboard (real-time web UI with SSE)

## New Packages Added

### @mdap/dashboard
- Web UI for monitoring workflows
- Real-time updates via Server-Sent Events
- Workflow tracking with step details
- Statistics: success rate, avg confidence, samples

### Semantic Deduplication (in @mdap/core)
- `createSemanticSerializer()` - Normalize responses for voting
- `withSemanticDedup()` - Config helper
- `SemanticPatterns.json()` - JSON-aware (ignores key order)
- `SemanticPatterns.fuzzy(threshold)` - Fuzzy text matching
- `clusterResponses()` - Group similar responses
