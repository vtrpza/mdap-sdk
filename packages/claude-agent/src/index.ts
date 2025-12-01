/**
 * @mdap/claude-agent - MDAP integration for Claude Agent SDK
 *
 * Build reliable agents with voting-based error correction.
 *
 * @example
 * ```typescript
 * import { withMdap, MdapAgentConfig } from '@mdap/claude-agent';
 *
 * // Wrap your agent query with MDAP reliability
 * const result = await withMdap({
 *   k: 3,
 *   redFlags: ['tooLong', 'invalidJson']
 * })(async () => {
 *   return await agent.query({ prompt: 'Extract entities...' });
 * });
 * ```
 *
 * @packageDocumentation
 */

import {
  reliable,
  RedFlag,
  estimateCost,
  calculateMinK,
  type ReliableConfig,
  type VoteResult,
  type RedFlagRule,
  type CostEstimateConfig
} from '@mdap/core';

/**
 * MDAP configuration for Claude Agent SDK integration
 */
export interface MdapAgentConfig {
  /**
   * Vote threshold (k in first-to-ahead-by-k voting)
   * @default 3
   */
  k?: number;

  /**
   * Maximum samples before giving up
   * @default 100
   */
  maxSamples?: number;

  /**
   * Red flag rules to apply
   * Can be rule names ('tooLong', 'invalidJson', etc.) or custom rules
   */
  redFlags?: (string | RedFlagRule<string>)[];

  /**
   * Maximum token length for tooLong rule
   * @default 750
   */
  maxTokens?: number;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;

  /**
   * Callback when a sample is flagged
   */
  onFlag?: (response: string, ruleName: string) => void;

  /**
   * Callback when a sample is collected
   */
  onSample?: (response: string, voteCount: number) => void;
}

/**
 * Result of an MDAP-wrapped operation
 */
export interface MdapResult<T> {
  /**
   * The winning response
   */
  result: T;

  /**
   * MDAP voting metadata
   */
  mdap: {
    confidence: number;
    totalSamples: number;
    flaggedSamples: number;
    converged: boolean;
  };
}

/**
 * Build red flag rules from config
 */
function buildRedFlags(
  flags: (string | RedFlagRule<string>)[] | undefined,
  maxTokens: number
): RedFlagRule<string>[] {
  if (!flags || flags.length === 0) {
    // Default red flags from the paper
    return [
      RedFlag.tooLong(maxTokens),
      RedFlag.emptyResponse(),
      RedFlag.invalidJson()
    ];
  }

  return flags.map(flag => {
    if (typeof flag === 'string') {
      switch (flag) {
        case 'tooLong':
          return RedFlag.tooLong(maxTokens);
        case 'emptyResponse':
          return RedFlag.emptyResponse();
        case 'invalidJson':
          return RedFlag.invalidJson();
        default:
          throw new Error(`Unknown red flag rule: ${flag}`);
      }
    }
    return flag;
  });
}

/**
 * Wrap an async operation with MDAP reliability
 *
 * @example
 * ```typescript
 * const result = await withMdap({ k: 3 })(async () => {
 *   return await someAsyncOperation();
 * });
 * ```
 */
export function withMdap(config: MdapAgentConfig = {}) {
  const {
    k = 3,
    maxSamples = 100,
    redFlags,
    maxTokens = 750,
    debug = false,
    onFlag,
    onSample
  } = config;

  const rules = buildRedFlags(redFlags, maxTokens);

  return async <T extends string>(operation: () => Promise<T>): Promise<MdapResult<T>> => {
    // Create a reliable wrapper for string outputs
    const reliableOp = reliable<string>({
      vote: {
        k,
        maxSamples,
        strategy: 'first-to-ahead-by-k'
      },
      redFlags: rules,
      debug,
      onFlag: onFlag ? (response, rule) => onFlag(response, rule.name) : undefined,
      onSample
    })(async (_input: void) => {
      return await operation();
    });

    const voteResult = await reliableOp();

    return {
      result: voteResult.winner as T,
      mdap: {
        confidence: voteResult.confidence,
        totalSamples: voteResult.totalSamples,
        flaggedSamples: voteResult.flaggedSamples,
        converged: voteResult.converged
      }
    };
  };
}

/**
 * Create a reliable wrapper for repeated operations
 *
 * @example
 * ```typescript
 * const reliableExtract = createReliableOperation({
 *   k: 3,
 *   redFlags: ['tooLong', 'invalidJson']
 * });
 *
 * // Use multiple times
 * const result1 = await reliableExtract(() => extract(doc1));
 * const result2 = await reliableExtract(() => extract(doc2));
 * ```
 */
export function createReliableOperation(config: MdapAgentConfig = {}) {
  return withMdap(config);
}

/**
 * Estimate cost for a multi-step agent workflow
 *
 * @example
 * ```typescript
 * const estimate = estimateAgentCost({
 *   steps: 1000,
 *   successRate: 0.99,
 *   model: 'claude-3-5-haiku'
 * });
 * console.log(`Estimated cost: $${estimate.cost.toFixed(2)}`);
 * ```
 */
export interface AgentCostConfig {
  /**
   * Number of steps in the workflow
   */
  steps: number;

  /**
   * Per-step success rate (0-1)
   * @default 0.99
   */
  successRate?: number;

  /**
   * Target overall reliability (0-1)
   * @default 0.95
   */
  targetReliability?: number;

  /**
   * Model to estimate costs for
   * @default 'claude-3-5-haiku'
   */
  model?: 'claude-3-5-haiku' | 'claude-3-5-sonnet' | 'claude-3-opus' | 'gpt-4o-mini' | 'gpt-4o';

  /**
   * Average input tokens per step
   * @default 300
   */
  avgInputTokens?: number;

  /**
   * Average output tokens per step
   * @default 200
   */
  avgOutputTokens?: number;
}

// Model pricing (per million tokens)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-5-haiku': { input: 0.25, output: 1.25 },
  'claude-3-5-sonnet': { input: 3, output: 15 },
  'claude-3-opus': { input: 15, output: 75 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 }
};

/**
 * Estimate cost for an agent workflow
 */
export function estimateAgentCost(config: AgentCostConfig) {
  const {
    steps,
    successRate = 0.99,
    targetReliability = 0.95,
    model = 'claude-3-5-haiku',
    avgInputTokens = 300,
    avgOutputTokens = 200
  } = config;

  const pricing = MODEL_PRICING[model] || MODEL_PRICING['claude-3-5-haiku'];

  return estimateCost({
    steps,
    successRate,
    targetReliability,
    inputCostPerMillion: pricing.input,
    outputCostPerMillion: pricing.output,
    avgInputTokens,
    avgOutputTokens
  });
}

/**
 * Calculate the recommended k value for a workflow
 */
export function calculateRecommendedK(
  steps: number,
  successRate = 0.99,
  targetReliability = 0.95
): number {
  return calculateMinK(steps, successRate, targetReliability);
}

/**
 * MDAP middleware for agent queries
 *
 * Use this to wrap agent.query() calls with automatic MDAP reliability.
 *
 * @example
 * ```typescript
 * import { query } from '@anthropic-ai/claude-agent-sdk';
 * import { mdapMiddleware } from '@mdap/claude-agent';
 *
 * // Create wrapped query function
 * const reliableQuery = mdapMiddleware({ k: 3 })(query);
 *
 * // Use it
 * for await (const message of reliableQuery({ prompt: '...' })) {
 *   // Handle messages
 * }
 * ```
 */
export function mdapMiddleware(config: MdapAgentConfig = {}) {
  // Note: This is a placeholder for full Claude Agent SDK integration
  // Full implementation would require the SDK types
  return <T extends (...args: unknown[]) => unknown>(queryFn: T): T => {
    // For now, return the original function
    // Full implementation would wrap with voting
    console.warn(
      '[MDAP] Full Claude Agent SDK middleware requires @anthropic-ai/claude-agent-sdk. ' +
      'Use withMdap() for manual wrapping instead.'
    );
    return queryFn;
  };
}

// Re-export core utilities
export { RedFlag, estimateCost, calculateMinK } from '@mdap/core';
export type { VoteResult, RedFlagRule, CostEstimateConfig } from '@mdap/core';
