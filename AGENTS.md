# AGENTS.md

## Commands

```bash
pnpm install                                # Install dependencies
pnpm build                                  # Build all packages (required before test/publish)
pnpm test                                   # Run all tests
pnpm --filter @mdap/core test voter.test.ts # Run single test file
pnpm typecheck                              # Type checking
pnpm lint                                   # Linting
```

## Code Style

- **Imports**: Use `import type` for type-only imports. Add `.js` extension for local imports.
- **Types**: Strict TypeScript. Prefix unused params with `_` (e.g., `_unused`).
- **Naming**: camelCase for functions/variables, PascalCase for types/interfaces.
- **Exports**: Named exports preferred. Re-export public API from `index.ts`.
- **Errors**: Throw `Error` with descriptive prefix (e.g., `"MDAP: No valid samples..."`).
- **Comments**: JSDoc for public APIs with `@example` blocks. Brief inline comments for complex logic.
- **Formatting**: ES2022 target, ESM modules, 2-space indent.

## Architecture

Monorepo: `@mdap/core` (no deps) -> `@mdap/adapters`, `@mdap/cli`, `@mdap/dashboard`, `@mdap/mcp`, `@mdap/claude-agent`.
Tests live in `__tests__/` directories. Benchmarks in `__benchmarks__/`.

## Agentic Execution

MDAP provides tools for agents to self-correct using voting-based error correction.

### MCP Tool: `mdap_execute`

Run any prompt with full MDAP reliability:

```bash
# Via MCP
mdap_execute({
  prompt: "Extract entities as JSON",
  k: 3,
  redFlags: ["tooLong:750", "invalidJson"]
})
```

### CLI Command: `mdap execute`

```bash
# Execute with MDAP reliability
mdap execute "Your prompt" --k 3 --red-flags "tooLong:750,invalidJson"

# Output as JSON for scripting
mdap execute "Your prompt" --json
```

### Paper-Aligned Defaults

Based on "Solving a Million-Step LLM Task with Zero Errors":

- `k: 3` - Vote threshold (sufficient for 1M+ steps)
- `temperature: 0.1` - Low for voting consistency
- `tooLong:750` - Error rate increases sharply above ~700 tokens
- `model: gpt-4.1-mini` - Most cost-effective
