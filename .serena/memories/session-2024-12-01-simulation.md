# Session: Live Simulation & Convergence Learning

## Date: 2025-12-01

## Key Accomplishments

### 1. Fixed GitHub Actions pnpm Version Mismatch
- **Issue**: `pnpm/action-setup@v4` conflicted with `packageManager` in package.json
- **Fix**: Removed explicit `version: 9` from workflow files, let action auto-detect from package.json
- **Files**: `.github/workflows/ci.yml`, `.github/workflows/publish.yml`

### 2. Created Benchmark Suite
- **Location**: `packages/core/src/__benchmarks__/`
- **Files**: `voter.bench.ts`, `red-flags.bench.ts`, `cost.bench.ts`
- **Results**: Cost functions achieve ~20M ops/sec (50ns per operation)
- **Note**: vitest bench is memory-intensive, may need `--max-old-space-size=4096`

### 3. Built Live Simulation (1000 Steps)
- **Location**: `examples/simulation/`
- **Files**:
  - `code-analysis-1000.ts` - Main simulation script
  - `code-snippets.ts` - 1000 TypeScript snippets for analysis
  - `README.md` - Usage documentation
- **Commands**: `pnpm simulate`, `pnpm simulate:dry`

### 4. Critical Learning: Prompt Design for Convergence

**Problem Discovered**: Open-ended prompts don't converge!
- First attempt: "identify bugs" → 100 samples, 2% confidence
- LLM describes same bug in 100 different ways

**Solution Applied**:
- Constrained categories: `NULL_SAFETY, ERROR_HANDLING, TYPE_SAFETY, SECURITY, PERFORMANCE, NONE`
- Structured JSON output: `{"categories":["CATEGORY"]}`
- Lower temperature: 0.3 → 0.1
- Lower maxSamples: 100 → 30 (fail fast)
- Added JSON validation red flag

**Result**: 3 samples, 100% confidence (instead of 100 samples, 2%)

### 5. Documentation Added to README.md
- New section: "⚠️ Designing Prompts for Convergence" (lines 101-184)
- Covers: best practices, temperature settings, JSON validation, when voting won't help

## Simulation Configuration (Optimized)

```typescript
// LLM Settings
temperature: 0.1      // Low for consistency
maxTokens: 150        // Short responses

// Voting Settings  
maxSamples: 30        // Fail fast on hard cases
k: 3                  // First-to-ahead-by-3

// Red Flags
- tooLong(200)
- emptyResponse()
- containsPhrase(['I cannot', 'I am unable', 'sorry'])
- custom invalidJson validator
```

## Key Insight for Future Development

**Voting works when there's a "correct" answer to converge on.**

For subjective tasks (code review opinions), you need:
- Constrained categories (not free text)
- Structured output schemas
- Lower temperature

Voting is NOT suitable for:
- Creative writing
- Brainstorming
- Subjective opinions

## Files Modified This Session

| File | Change |
|------|--------|
| `.github/workflows/ci.yml` | Removed pnpm version override |
| `.github/workflows/publish.yml` | Removed pnpm version override |
| `packages/core/package.json` | Added bench scripts |
| `package.json` | Added simulate scripts |
| `README.md` | Added convergence documentation |
| `BENCHMARKS.md` | Created with partial results |
| `examples/simulation/*` | Created simulation suite |
| `packages/core/src/__benchmarks__/*` | Created benchmark files |

## Running Simulation

The optimized simulation is running with ~10-15s per step, ETA ~3 hours for 1000 steps.
Results will be saved to `examples/simulation/results/simulation-{timestamp}.json`
