# MDAP SDK Benchmarks

## Overview

Performance benchmarks for the MDAP SDK core functions. Benchmarks created using vitest bench.

## Cost Estimation Functions

**Environment**: Node.js, vitest bench
**Status**: Partial results (memory limit reached during extended runs)

### calculateMinK - Required K Value

Calculates minimum k needed for target reliability across different step counts.

| Scenario | ops/sec | Notes |
|----------|---------|-------|
| 10 steps, p=0.99, t=0.95 | ~20.3M | Fastest |
| 100 steps, p=0.99, t=0.95 | ~20.5M | |
| 1,000 steps, p=0.99, t=0.95 | ~20.1M | |
| 10,000 steps, p=0.99, t=0.95 | ~20.2M | |
| 100,000 steps, p=0.99, t=0.95 | ~20.1M | Slowest |
| 1,000,000 steps, p=0.99, t=0.95 | ~20.5M | |

**Key Finding**: Performance is constant O(1) regardless of step count - the logarithmic formula executes in ~50 nanoseconds.

### calculateMinK - Varying Success Rates

| Success Rate | ops/sec |
|--------------|---------|
| p=0.95 (lower accuracy) | ~20.2M |
| p=0.99 (typical) | ~20.3M |
| p=0.999 (high accuracy) | ~20.2M |
| p=0.9999 (very high) | ~20.2M |

**Key Finding**: Success rate has negligible impact on calculation performance.

## Benchmark Files

Located in `packages/core/src/__benchmarks__/`:

- `cost.bench.ts` - Cost estimation and mathematical functions
- `red-flags.bench.ts` - Red flag rule checking performance
- `voter.bench.ts` - Voting mechanism performance

## Running Benchmarks

```bash
# Run all benchmarks (may require increased memory)
NODE_OPTIONS="--max-old-space-size=4096" pnpm bench:run

# Run specific benchmark file
npx vitest bench --run src/__benchmarks__/cost.bench.ts
```

## Notes

- vitest bench is experimental and memory-intensive for high-iteration tests
- Cost functions achieve ~20M ops/sec (50ns per operation)
- Voting benchmarks require async operations and consume more memory
- For production profiling, consider using Node.js `--prof` or clinic.js

## Live Simulation Results

See `examples/simulation/` for real-world performance with simulated LLM calls.
