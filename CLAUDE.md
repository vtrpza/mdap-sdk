# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MDAP SDK implements voting-based error correction for LLM agents based on the research paper "Solving a Million-Step LLM Task with Zero Errors". The core insight: run multiple LLM samples and use voting consensus to catch errors that any single call might make.

## Commands

```bash
# Install dependencies
pnpm install

# Build all packages (required before testing or publishing)
pnpm build

# Run all tests
pnpm test

# Run tests for a single package
pnpm --filter @mdap/core test

# Run a single test file
pnpm --filter @mdap/core test voter.test.ts

# Watch mode for tests
pnpm --filter @mdap/core test:watch

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Run benchmarks
pnpm --filter @mdap/core bench
```

## Architecture

### Monorepo Structure

This is a pnpm workspace monorepo. Package dependency order matters:

```
@mdap/core          (no internal deps)
    ↓
@mdap/adapters      (depends on core)
@mdap/cli           (depends on core)
@mdap/dashboard     (depends on core)
@mdap/mcp           (depends on core)
@mdap/claude-agent  (depends on core)
```

### Core Package (`packages/core/src/`)

The heart of MDAP with these modules:

- **voter.ts**: The main `reliable()` and `vote()` functions implementing "first-to-ahead-by-k" voting. A response wins when it leads by `k` votes over all others.
- **types.ts**: Core TypeScript interfaces (`VoteResult`, `ReliableConfig`, `RedFlagRule`, etc.)
- **red-flags.ts**: Discard rules like `tooLong()`, `invalidJson()`, `emptyResponse()` to filter out confused responses
- **cost.ts**: Pre-workflow cost estimation based on mathematical model
- **workflow.ts**: Higher-level orchestration with `pipeline()`, `parallel()`, `decompose()`
- **semantic.ts**: Semantic deduplication for grouping equivalent responses (JSON-aware, fuzzy matching)

### Key Concepts

**Voting**: Instead of trusting one LLM response, draw multiple samples. The response that achieves consensus (k votes ahead) wins. Catches random errors through majority agreement.

**Red Flags**: Patterns indicating "confused" responses get discarded before voting:

- Response too long (indicates hallucination)
- Invalid JSON (when expecting structured output)
- Contains phrases like "I cannot" or "I'm not sure"

**Convergence**: Prompts must be designed so correct answers converge (same output). Open-ended prompts won't reach consensus. Use fixed categories, JSON output, low temperature.

### Adapters Package

Provides `createOpenAI()` and `createAnthropic()` factory functions that return adapters with a `.chat()` method for use with the voting system.

## Testing Conventions

Tests use Vitest and live in `__tests__/` directories alongside source files. Benchmarks are in `__benchmarks__/`.

## Build System

All packages use `tsup` to build ESM modules. The root tsconfig uses `moduleResolution: bundler` and targets ES2022.
