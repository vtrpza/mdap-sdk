# MDAP SDK - Session Context & Project Understanding

## Session Date: 2025-12-01

## Project Origin

This project implements concepts from the research paper **"Solving a Million-Step LLM Task with Zero Errors"** (arXiv:2511.09030v1, November 2025) by researchers from Cognizant AI Lab and UT Austin.

### Paper Key Concepts
- **MDAP**: Massively Decomposed Agentic Processes
- **MAKER**: Maximal Agentic decomposition + first-to-ahead-by-K Error correction + Red-flagging
- Successfully solved 1M+ step tasks with zero errors using voting-based error correction

### Core Innovation from Paper
1. **Maximal Agentic Decomposition (MAD)** - Break tasks into single-step operations
2. **First-to-ahead-by-k Voting** - Statistical error correction via multi-sampling
3. **Red-flagging** - Discard responses showing signs of confusion (long responses, format errors)

### Key Mathematical Results
- `p_full = (1 + ((1-p)/p)^k)^(-s)` - Probability of solving s steps
- `k_min = Θ(ln s)` - Required k grows logarithmically with steps
- `E[cost] = Θ(s ln s)` - Expected cost scales log-linearly (efficient!)

---

## Product Direction

### User Profile
- **Role**: Indie hacker
- **Focus**: Developer Platform/SDK
- **Constraint**: Speed to market
- **Stack**: TypeScript-first

### Business Model
- Open-source core (`@mdap/core`)
- Paid cloud services (future)
- Pricing: Free tier → $29/mo Pro → Enterprise

### Target Market
- Developers building AI agents who need reliability
- Anyone using LLMs for multi-step workflows

---

## Technical Implementation

### Project Structure
```
mdap-sdk/
├── packages/
│   ├── core/           # @mdap/core - voting, red-flags, cost estimation
│   ├── adapters/       # @mdap/adapters - OpenAI, Anthropic adapters
│   ├── mcp/            # @mdap/mcp - MCP server for Claude Code/Cursor
│   └── claude-agent/   # @mdap/claude-agent - Claude Agent SDK integration
├── templates/
│   ├── agents/         # Subagent markdown files (mdap-executor, validator, decomposer)
│   └── hooks/          # Hook JSON templates for Claude Code
├── examples/           # Usage examples
├── README.md           # Full documentation
└── package.json        # pnpm monorepo
```

### Core API
```typescript
import { reliable, RedFlag, estimateCost } from '@mdap/core';

const myTask = reliable({
  vote: { k: 3, strategy: 'first-to-ahead-by-k' },
  redFlags: [RedFlag.tooLong(750), RedFlag.invalidJson()]
})(async (input) => {
  return await llm.call(input);
});
```

### Implemented Features
- [x] `reliable()` wrapper function
- [x] First-to-k voting
- [x] First-to-ahead-by-k voting
- [x] Built-in red flags (tooLong, invalidJson, emptyResponse, etc.)
- [x] Cost estimation with paper's scaling laws
- [x] OpenAI adapter
- [x] Anthropic adapter
- [x] TypeScript types
- [x] README with examples

### Implemented Features (Phase 2)
- [x] `@mdap/mcp` - MCP server with tools (estimate_cost, validate, calculate_k)
- [x] `@mdap/claude-agent` - Claude Agent SDK integration
- [x] Subagent templates (mdap-executor, mdap-validator, mdap-decomposer)
- [x] Hook templates (response length check, command chain check)

### Pending Features
- [ ] Unit tests
- [ ] CLI tool (`npx mdap run`)
- [ ] Workflow orchestration
- [ ] Dashboard
- [ ] Semantic deduplication
- [ ] GitHub Actions CI/CD

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `packages/core/src/voter.ts` | Main `reliable()` and `vote()` implementation |
| `packages/core/src/red-flags.ts` | Built-in red flag rules |
| `packages/core/src/cost.ts` | Cost estimation using paper's equations |
| `packages/core/src/types.ts` | TypeScript interfaces |
| `packages/adapters/src/openai.ts` | OpenAI API adapter |
| `packages/adapters/src/anthropic.ts` | Anthropic API adapter |
| `packages/mcp/src/index.ts` | MCP server with MDAP tools |
| `packages/claude-agent/src/index.ts` | Claude Agent SDK integration |
| `templates/agents/mdap-executor.md` | Subagent for reliable task execution |
| `templates/agents/mdap-validator.md` | Subagent for output validation |
| `templates/agents/mdap-decomposer.md` | Subagent for task decomposition |

---

## Next Steps for Future Sessions

1. **Install & Build**: `pnpm install && pnpm build`
2. **Add Tests**: Unit tests for voter.ts logic
3. **Set up CI**: GitHub Actions for test/publish
4. **Launch**: Post on HN, Twitter, create waitlist

---

## Research Paper Location
Original PDF: `/home/fatdog/Work/vibe/2511.09030v1.pdf`
