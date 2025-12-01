# MDAP SDK - Architecture Decisions

## Decision Log

### 1. TypeScript-First Approach
**Decision**: Build TypeScript SDK first, not Python
**Rationale**: 
- User is indie hacker targeting modern web developers
- Agent frameworks like Vercel AI SDK, LangChain.js are TS
- npm ecosystem is huge, easier distribution
- Can run in browser for demos

### 2. Monorepo Structure
**Decision**: Use pnpm workspaces with separate packages
**Rationale**:
- `@mdap/core` - standalone, no dependencies
- `@mdap/adapters` - optional, peer deps on LLM SDKs
- Allows tree-shaking and minimal installs

### 3. Decorator-Style API
**Decision**: `reliable(config)(asyncFn)` pattern
**Rationale**:
- Familiar to JS developers (HOC pattern)
- Easy to wrap existing code
- Composable and type-safe

### 4. Red Flags as First-Class Feature
**Decision**: Built-in red flag rules with custom option
**Rationale**:
- Paper emphasizes red-flagging as critical for correlated errors
- Common patterns (tooLong, invalidJson) should be easy
- Custom rules for domain-specific needs

### 5. Cost Estimation from Paper Math
**Decision**: Implement exact formulas from paper
**Rationale**:
- Key differentiator - predict before you run
- Validates approach against proven math
- Helps users choose optimal k value

### 6. Fetch-Based Adapters (No SDK Dependencies)
**Decision**: Use raw fetch instead of openai/anthropic SDKs
**Rationale**:
- Fewer dependencies
- Works in more environments (edge, browser)
- Users can still use their own SDK if preferred

---

## API Design Principles

1. **Simple by default**: `reliable({ k: 3 })(fn)` just works
2. **Progressive disclosure**: Advanced options available but not required
3. **Type safety**: Full TypeScript with inference
4. **Observable**: Debug mode, callbacks for monitoring
5. **Predictable**: Same input → same behavior
