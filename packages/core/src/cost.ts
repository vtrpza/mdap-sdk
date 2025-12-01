/**
 * Cost Estimation
 * Based on Section 3.2 scaling laws from the MAKER paper
 */

import type { CostEstimate, CostEstimateConfig } from './types.js';

/**
 * Calculate the minimum k required for a target reliability
 * From Equation 14 in the paper:
 * k_min = ceil(ln(t^(-m/s) - 1) / ln((1-p)/p))
 *
 * For MAD (m=1), this simplifies considerably.
 *
 * @param steps Number of steps (s)
 * @param successRate Per-step success rate (p)
 * @param targetReliability Target overall success probability (t)
 */
export function calculateMinK(
  steps: number,
  successRate: number,
  targetReliability: number
): number {
  if (successRate <= 0.5) {
    throw new Error('Success rate must be > 0.5 for voting to converge');
  }
  if (successRate >= 1) {
    return 1; // Perfect success rate needs only 1 sample
  }
  if (targetReliability <= 0 || targetReliability >= 1) {
    throw new Error('Target reliability must be between 0 and 1 (exclusive)');
  }

  // For MAD (m=1):
  // k_min = ceil(ln(t^(-1/s) - 1) / ln((1-p)/p))
  const m = 1; // MAD
  const exponent = -m / steps;
  const tPower = Math.pow(targetReliability, exponent);
  const numerator = Math.log(tPower - 1);
  const denominator = Math.log((1 - successRate) / successRate);

  const kMin = Math.ceil(numerator / denominator);

  // Ensure k is at least 1
  return Math.max(1, kMin);
}

/**
 * Calculate expected number of samples per step for first-to-ahead-by-k voting
 * From Section 3.2: E[samples] ≈ 2k * p_sub / (2p - 1)
 *
 * For high p, this is approximately k / (2p - 1)
 */
export function calculateExpectedSamples(
  k: number,
  successRate: number
): number {
  if (successRate <= 0.5) {
    throw new Error('Success rate must be > 0.5');
  }

  // Simplified formula for high success rates
  return k / (2 * successRate - 1);
}

/**
 * Calculate the probability of solving the full task
 * From Equation 13: p_full = (1 + ((1-p)/p)^k)^(-s)
 */
export function calculateSuccessProbability(
  steps: number,
  k: number,
  successRate: number
): number {
  if (successRate <= 0.5 || successRate >= 1) {
    return 0;
  }

  const ratio = (1 - successRate) / successRate;
  const pSubInverse = 1 + Math.pow(ratio, k);
  return Math.pow(pSubInverse, -steps);
}

/**
 * Estimate the cost of running an MDAP workflow
 *
 * @example
 * ```typescript
 * const estimate = estimateCost({
 *   steps: 10000,
 *   successRate: 0.99,
 *   targetReliability: 0.95,
 *   inputCostPerMillion: 1.5,   // $1.50 per 1M input tokens
 *   outputCostPerMillion: 2.0,  // $2.00 per 1M output tokens
 *   avgInputTokens: 500,
 *   avgOutputTokens: 200
 * });
 *
 * console.log(`Estimated cost: $${estimate.cost.toFixed(2)}`);
 * console.log(`Required k: ${estimate.kRequired}`);
 * ```
 */
export function estimateCost(config: CostEstimateConfig): CostEstimate {
  const {
    steps,
    successRate = 0.99,
    targetReliability = 0.95,
    inputCostPerMillion = 0.5,   // Default: cheap model like gpt-4.1-mini input
    outputCostPerMillion = 1.5,  // Default: gpt-4.1-mini output
    avgInputTokens = 500,
    avgOutputTokens = 300
  } = config;

  // Calculate minimum k required
  const kRequired = calculateMinK(steps, successRate, targetReliability);

  // Calculate expected samples per step
  const samplesPerStep = calculateExpectedSamples(kRequired, successRate);

  // Total API calls
  const apiCalls = Math.ceil(steps * samplesPerStep);

  // Total tokens
  const totalInputTokens = apiCalls * avgInputTokens;
  const totalOutputTokens = apiCalls * avgOutputTokens;
  const tokens = totalInputTokens + totalOutputTokens;

  // Cost calculation
  const inputCost = (totalInputTokens / 1_000_000) * inputCostPerMillion;
  const outputCost = (totalOutputTokens / 1_000_000) * outputCostPerMillion;
  const cost = inputCost + outputCost;

  // Time estimate (assuming ~500ms per API call average)
  const msPerCall = 500;
  const parallelFactor = Math.min(kRequired, 10); // Assume we can run up to 10 in parallel
  const estimatedTimeMs = (apiCalls / parallelFactor) * msPerCall;

  return {
    cost,
    apiCalls,
    tokens,
    kRequired,
    estimatedTimeMs
  };
}

/**
 * Format a cost estimate for display
 */
export function formatCostEstimate(estimate: CostEstimate): string {
  const hours = Math.floor(estimate.estimatedTimeMs / 3600000);
  const minutes = Math.floor((estimate.estimatedTimeMs % 3600000) / 60000);
  const seconds = Math.floor((estimate.estimatedTimeMs % 60000) / 1000);

  let timeStr: string;
  if (hours > 0) {
    timeStr = `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    timeStr = `${minutes}m ${seconds}s`;
  } else {
    timeStr = `${seconds}s`;
  }

  return [
    `Cost: $${estimate.cost.toFixed(2)}`,
    `API Calls: ${estimate.apiCalls.toLocaleString()}`,
    `Tokens: ${estimate.tokens.toLocaleString()}`,
    `Required k: ${estimate.kRequired}`,
    `Estimated Time: ~${timeStr}`
  ].join('\n');
}
