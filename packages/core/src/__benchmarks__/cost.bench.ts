/**
 * Cost Estimation Benchmarks
 * Measures performance of mathematical calculations from the MAKER paper
 */
import { bench, describe } from 'vitest';
import {
  calculateMinK,
  calculateExpectedSamples,
  calculateSuccessProbability,
  estimateCost,
  formatCostEstimate
} from '../cost.js';

describe('calculateMinK - Required K Value', () => {
  bench('10 steps, 99% success, 95% target', () => {
    calculateMinK(10, 0.99, 0.95);
  });

  bench('100 steps, 99% success, 95% target', () => {
    calculateMinK(100, 0.99, 0.95);
  });

  bench('1,000 steps, 99% success, 95% target', () => {
    calculateMinK(1000, 0.99, 0.95);
  });

  bench('10,000 steps, 99% success, 95% target', () => {
    calculateMinK(10000, 0.99, 0.95);
  });

  bench('100,000 steps, 99% success, 95% target', () => {
    calculateMinK(100000, 0.99, 0.95);
  });

  bench('1,000,000 steps, 99% success, 95% target', () => {
    calculateMinK(1000000, 0.99, 0.95);
  });
});

describe('calculateMinK - Varying Success Rates', () => {
  bench('p=0.95 (lower accuracy)', () => {
    calculateMinK(1000, 0.95, 0.95);
  });

  bench('p=0.99 (typical)', () => {
    calculateMinK(1000, 0.99, 0.95);
  });

  bench('p=0.999 (high accuracy)', () => {
    calculateMinK(1000, 0.999, 0.95);
  });

  bench('p=0.9999 (very high accuracy)', () => {
    calculateMinK(1000, 0.9999, 0.95);
  });
});

describe('calculateMinK - Varying Target Reliability', () => {
  bench('target=0.90 (90%)', () => {
    calculateMinK(1000, 0.99, 0.90);
  });

  bench('target=0.95 (95%)', () => {
    calculateMinK(1000, 0.99, 0.95);
  });

  bench('target=0.99 (99%)', () => {
    calculateMinK(1000, 0.99, 0.99);
  });

  bench('target=0.999 (99.9%)', () => {
    calculateMinK(1000, 0.99, 0.999);
  });

  bench('target=0.9999 (99.99%)', () => {
    calculateMinK(1000, 0.99, 0.9999);
  });
});

describe('calculateExpectedSamples', () => {
  bench('k=1, p=0.99', () => {
    calculateExpectedSamples(1, 0.99);
  });

  bench('k=3, p=0.99', () => {
    calculateExpectedSamples(3, 0.99);
  });

  bench('k=5, p=0.99', () => {
    calculateExpectedSamples(5, 0.99);
  });

  bench('k=10, p=0.99', () => {
    calculateExpectedSamples(10, 0.99);
  });

  bench('k=3, p=0.75 (lower accuracy)', () => {
    calculateExpectedSamples(3, 0.75);
  });

  bench('k=3, p=0.999 (high accuracy)', () => {
    calculateExpectedSamples(3, 0.999);
  });
});

describe('calculateSuccessProbability', () => {
  bench('10 steps, k=3, p=0.99', () => {
    calculateSuccessProbability(10, 3, 0.99);
  });

  bench('100 steps, k=3, p=0.99', () => {
    calculateSuccessProbability(100, 3, 0.99);
  });

  bench('1000 steps, k=3, p=0.99', () => {
    calculateSuccessProbability(1000, 3, 0.99);
  });

  bench('10000 steps, k=5, p=0.99', () => {
    calculateSuccessProbability(10000, 5, 0.99);
  });

  bench('1000000 steps, k=5, p=0.99', () => {
    calculateSuccessProbability(1000000, 5, 0.99);
  });
});

describe('estimateCost - Full Cost Estimation', () => {
  bench('small workflow (10 steps)', () => {
    estimateCost({
      steps: 10,
      successRate: 0.99,
      targetReliability: 0.95
    });
  });

  bench('medium workflow (1000 steps)', () => {
    estimateCost({
      steps: 1000,
      successRate: 0.99,
      targetReliability: 0.95
    });
  });

  bench('large workflow (100000 steps)', () => {
    estimateCost({
      steps: 100000,
      successRate: 0.99,
      targetReliability: 0.95
    });
  });

  bench('million-step workflow', () => {
    estimateCost({
      steps: 1000000,
      successRate: 0.99,
      targetReliability: 0.95
    });
  });

  bench('full config (all parameters)', () => {
    estimateCost({
      steps: 10000,
      successRate: 0.99,
      targetReliability: 0.95,
      inputCostPerMillion: 1.5,
      outputCostPerMillion: 2.0,
      avgInputTokens: 500,
      avgOutputTokens: 200
    });
  });
});

describe('formatCostEstimate - Output Formatting', () => {
  const smallEstimate = estimateCost({ steps: 10 });
  const largeEstimate = estimateCost({ steps: 100000 });

  bench('format small estimate', () => {
    formatCostEstimate(smallEstimate);
  });

  bench('format large estimate', () => {
    formatCostEstimate(largeEstimate);
  });
});

describe('Real World Scenarios', () => {
  bench('Claude Code session (500 steps)', () => {
    estimateCost({
      steps: 500,
      successRate: 0.98,
      targetReliability: 0.95,
      inputCostPerMillion: 3.0,  // Claude pricing
      outputCostPerMillion: 15.0,
      avgInputTokens: 1000,
      avgOutputTokens: 500
    });
  });

  bench('Data pipeline (10000 steps)', () => {
    estimateCost({
      steps: 10000,
      successRate: 0.995,
      targetReliability: 0.99,
      inputCostPerMillion: 0.15,  // GPT-4o-mini pricing
      outputCostPerMillion: 0.60,
      avgInputTokens: 200,
      avgOutputTokens: 100
    });
  });

  bench('Million-step research task', () => {
    estimateCost({
      steps: 1000000,
      successRate: 0.99,
      targetReliability: 0.95,
      inputCostPerMillion: 0.075,  // Batch pricing
      outputCostPerMillion: 0.30,
      avgInputTokens: 300,
      avgOutputTokens: 150
    });
  });
});

describe('Batch Calculations - Throughput', () => {
  const configs = Array.from({ length: 100 }, (_, i) => ({
    steps: (i + 1) * 100,
    successRate: 0.99,
    targetReliability: 0.95
  }));

  bench('100 sequential cost estimates', () => {
    for (const config of configs) {
      estimateCost(config);
    }
  });

  bench('calculate k for 100 different step counts', () => {
    for (let i = 1; i <= 100; i++) {
      calculateMinK(i * 100, 0.99, 0.95);
    }
  });
});
