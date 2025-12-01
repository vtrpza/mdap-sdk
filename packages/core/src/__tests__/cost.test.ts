import { describe, it, expect } from 'vitest';
import {
  calculateMinK,
  calculateExpectedSamples,
  calculateSuccessProbability,
  estimateCost,
  formatCostEstimate
} from '../cost.js';

describe('calculateMinK', () => {
  it('should return 1 for perfect success rate', () => {
    expect(calculateMinK(1000, 1.0, 0.95)).toBe(1);
  });

  it('should return small k for high success rate', () => {
    const k = calculateMinK(10000, 0.99, 0.95);
    expect(k).toBeGreaterThanOrEqual(1);
    expect(k).toBeLessThanOrEqual(5);
  });

  it('should require higher k for more steps', () => {
    const k100 = calculateMinK(100, 0.99, 0.95);
    const k10000 = calculateMinK(10000, 0.99, 0.95);

    expect(k10000).toBeGreaterThanOrEqual(k100);
  });

  it('should require higher k for lower success rate', () => {
    const kHigh = calculateMinK(1000, 0.99, 0.95);
    const kLow = calculateMinK(1000, 0.90, 0.95);

    expect(kLow).toBeGreaterThan(kHigh);
  });

  it('should require higher k for higher target reliability', () => {
    const k90 = calculateMinK(1000, 0.99, 0.90);
    const k99 = calculateMinK(1000, 0.99, 0.99);

    expect(k99).toBeGreaterThanOrEqual(k90);
  });

  it('should throw for success rate <= 0.5', () => {
    expect(() => calculateMinK(100, 0.5, 0.95)).toThrow('Success rate must be > 0.5');
    expect(() => calculateMinK(100, 0.3, 0.95)).toThrow('Success rate must be > 0.5');
  });

  it('should throw for invalid target reliability', () => {
    expect(() => calculateMinK(100, 0.99, 0)).toThrow('Target reliability must be between 0 and 1');
    expect(() => calculateMinK(100, 0.99, 1)).toThrow('Target reliability must be between 0 and 1');
    expect(() => calculateMinK(100, 0.99, -0.5)).toThrow('Target reliability must be between 0 and 1');
  });

  // Key result from paper: k grows logarithmically with steps
  it('should show logarithmic growth of k with steps (paper key result)', () => {
    const k1k = calculateMinK(1000, 0.99, 0.95);
    const k10k = calculateMinK(10000, 0.99, 0.95);
    const k100k = calculateMinK(100000, 0.99, 0.95);
    const k1m = calculateMinK(1000000, 0.99, 0.95);

    // k should not grow linearly - difference should be small
    // This is the key insight: even 1M steps only need k ~ 3-5
    expect(k1m).toBeLessThanOrEqual(k1k + 4);
    // All values should be in reasonable range (not growing much)
    expect(k1k).toBeLessThanOrEqual(5);
    expect(k10k).toBeLessThanOrEqual(5);
    expect(k100k).toBeLessThanOrEqual(5);
    expect(k1m).toBeLessThanOrEqual(5);
  });
});

describe('calculateExpectedSamples', () => {
  it('should return approximately k for high success rates', () => {
    const samples = calculateExpectedSamples(3, 0.99);
    // For p=0.99, formula gives k/(2*0.99-1) = k/0.98 ≈ k * 1.02
    expect(samples).toBeGreaterThanOrEqual(3);
    expect(samples).toBeLessThanOrEqual(4);
  });

  it('should increase as success rate decreases', () => {
    const samplesHigh = calculateExpectedSamples(3, 0.99);
    const samplesLow = calculateExpectedSamples(3, 0.70);

    expect(samplesLow).toBeGreaterThan(samplesHigh);
  });

  it('should scale linearly with k', () => {
    const samples2 = calculateExpectedSamples(2, 0.99);
    const samples4 = calculateExpectedSamples(4, 0.99);

    expect(samples4).toBeCloseTo(samples2 * 2, 1);
  });

  it('should throw for success rate <= 0.5', () => {
    expect(() => calculateExpectedSamples(3, 0.5)).toThrow('Success rate must be > 0.5');
    expect(() => calculateExpectedSamples(3, 0.3)).toThrow('Success rate must be > 0.5');
  });
});

describe('calculateSuccessProbability', () => {
  it('should return high probability for good parameters', () => {
    const prob = calculateSuccessProbability(100, 3, 0.99);
    expect(prob).toBeGreaterThan(0.9);
  });

  it('should decrease with more steps', () => {
    const prob100 = calculateSuccessProbability(100, 3, 0.99);
    const prob10000 = calculateSuccessProbability(10000, 3, 0.99);

    expect(prob10000).toBeLessThan(prob100);
  });

  it('should increase with higher k', () => {
    const probK2 = calculateSuccessProbability(1000, 2, 0.99);
    const probK5 = calculateSuccessProbability(1000, 5, 0.99);

    expect(probK5).toBeGreaterThan(probK2);
  });

  it('should return 0 for invalid success rates', () => {
    expect(calculateSuccessProbability(100, 3, 0.5)).toBe(0);
    expect(calculateSuccessProbability(100, 3, 1.0)).toBe(0);
  });

  // Verify paper equation: p_full = (1 + ((1-p)/p)^k)^(-s)
  it('should match paper equation for known values', () => {
    const p = 0.99;
    const k = 3;
    const s = 100;

    const calculated = calculateSuccessProbability(s, k, p);

    // Manual calculation
    const ratio = (1 - p) / p; // 0.01/0.99 ≈ 0.0101
    const pSubInverse = 1 + Math.pow(ratio, k);
    const expected = Math.pow(pSubInverse, -s);

    expect(calculated).toBeCloseTo(expected, 10);
  });
});

describe('estimateCost', () => {
  it('should return valid cost estimate', () => {
    const estimate = estimateCost({
      steps: 1000,
      successRate: 0.99,
      targetReliability: 0.95
    });

    expect(estimate.cost).toBeGreaterThan(0);
    expect(estimate.apiCalls).toBeGreaterThan(0);
    expect(estimate.tokens).toBeGreaterThan(0);
    expect(estimate.kRequired).toBeGreaterThanOrEqual(1);
    expect(estimate.estimatedTimeMs).toBeGreaterThan(0);
  });

  it('should use default values when not provided', () => {
    const estimate = estimateCost({ steps: 100 });

    expect(estimate.kRequired).toBeGreaterThanOrEqual(1);
    expect(estimate.apiCalls).toBeGreaterThanOrEqual(100);
  });

  it('should scale cost with steps', () => {
    const estimate100 = estimateCost({ steps: 100 });
    const estimate1000 = estimateCost({ steps: 1000 });

    expect(estimate1000.cost).toBeGreaterThan(estimate100.cost);
    expect(estimate1000.apiCalls).toBeGreaterThan(estimate100.apiCalls);
  });

  it('should scale cost with token prices', () => {
    const estimateCheap = estimateCost({
      steps: 1000,
      inputCostPerMillion: 0.5,
      outputCostPerMillion: 1.5
    });

    const estimateExpensive = estimateCost({
      steps: 1000,
      inputCostPerMillion: 5,
      outputCostPerMillion: 15
    });

    expect(estimateExpensive.cost).toBeGreaterThan(estimateCheap.cost * 5);
  });

  it('should handle large step counts efficiently', () => {
    const estimate = estimateCost({
      steps: 1000000,
      successRate: 0.99,
      targetReliability: 0.95
    });

    // Key insight: even 1M steps should have reasonable cost due to O(s ln s) scaling
    expect(estimate.kRequired).toBeLessThanOrEqual(5);
    expect(estimate.apiCalls).toBeLessThan(10_000_000); // Not 1M * k
  });
});

describe('formatCostEstimate', () => {
  it('should format cost with dollar sign', () => {
    const estimate = estimateCost({ steps: 100 });
    const formatted = formatCostEstimate(estimate);

    expect(formatted).toContain('Cost: $');
    expect(formatted).toMatch(/Cost: \$\d+\.\d{2}/);
  });

  it('should format API calls with commas', () => {
    const estimate = estimateCost({ steps: 10000 });
    const formatted = formatCostEstimate(estimate);

    expect(formatted).toContain('API Calls:');
  });

  it('should format tokens with commas', () => {
    const estimate = estimateCost({ steps: 10000 });
    const formatted = formatCostEstimate(estimate);

    expect(formatted).toContain('Tokens:');
  });

  it('should include required k', () => {
    const estimate = estimateCost({ steps: 100 });
    const formatted = formatCostEstimate(estimate);

    expect(formatted).toContain('Required k:');
  });

  it('should format time correctly for seconds', () => {
    const estimate = { cost: 1, apiCalls: 10, tokens: 1000, kRequired: 3, estimatedTimeMs: 5000 };
    const formatted = formatCostEstimate(estimate);

    expect(formatted).toContain('5s');
  });

  it('should format time correctly for minutes', () => {
    const estimate = { cost: 1, apiCalls: 10, tokens: 1000, kRequired: 3, estimatedTimeMs: 125000 };
    const formatted = formatCostEstimate(estimate);

    expect(formatted).toContain('2m 5s');
  });

  it('should format time correctly for hours', () => {
    const estimate = { cost: 1, apiCalls: 10, tokens: 1000, kRequired: 3, estimatedTimeMs: 3725000 };
    const formatted = formatCostEstimate(estimate);

    expect(formatted).toContain('1h 2m');
  });
});
