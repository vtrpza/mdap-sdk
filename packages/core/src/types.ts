/**
 * MDAP Core Types
 * Based on the paper: "Solving a Million-Step LLM Task with Zero Errors"
 */

/**
 * A function that can be called to generate a response from an LLM
 */
export type LLMCall<TInput, TOutput> = (input: TInput) => Promise<TOutput>;

/**
 * Configuration for the voting mechanism
 */
export interface VoteConfig {
  /**
   * The "k" in first-to-ahead-by-k voting.
   * A candidate wins when it has k more votes than any other candidate.
   * Higher k = more reliable but more expensive.
   * @default 3
   */
  k: number;

  /**
   * Maximum number of samples to draw before giving up.
   * Safety limit to prevent infinite loops.
   * @default 100
   */
  maxSamples?: number;

  /**
   * Whether to run samples in parallel.
   * Faster but uses more concurrent API calls.
   * @default true
   */
  parallel?: boolean;

  /**
   * Number of initial parallel samples to draw.
   * Only used when parallel=true.
   * @default k
   */
  initialBatch?: number;

  /**
   * Voting strategy to use.
   * - 'first-to-k': First candidate to reach k votes wins (simpler)
   * - 'first-to-ahead-by-k': First candidate to lead by k votes wins (more robust)
   * @default 'first-to-ahead-by-k'
   */
  strategy?: 'first-to-k' | 'first-to-ahead-by-k';
}

/**
 * A red flag rule that checks if a response should be discarded
 */
export interface RedFlagRule<TOutput = string> {
  /**
   * Name of the red flag rule (for debugging/logging)
   */
  name: string;

  /**
   * Check if the response should be flagged (discarded).
   * Return true to flag/discard, false to keep.
   */
  check: (response: TOutput, meta?: ResponseMeta) => boolean;
}

/**
 * Metadata about a response from the LLM
 */
export interface ResponseMeta {
  /**
   * Number of tokens in the response (if available)
   */
  tokens?: number;

  /**
   * Raw response text before parsing
   */
  rawText?: string;

  /**
   * Time taken to generate the response in ms
   */
  latencyMs?: number;
}

/**
 * Result of a vote operation
 */
export interface VoteResult<TOutput> {
  /**
   * The winning response
   */
  winner: TOutput;

  /**
   * Confidence score (0-1) based on vote distribution
   */
  confidence: number;

  /**
   * Total number of samples drawn
   */
  totalSamples: number;

  /**
   * Number of samples that were flagged and discarded
   */
  flaggedSamples: number;

  /**
   * Vote counts for each unique response
   */
  votes: Map<string, number>;

  /**
   * Whether the vote converged (winner found) or hit maxSamples
   */
  converged: boolean;
}

/**
 * Configuration for the reliable() wrapper
 */
export interface ReliableConfig<TOutput = string> {
  /**
   * Voting configuration
   */
  vote?: Partial<VoteConfig>;

  /**
   * Red flag rules to apply
   */
  redFlags?: RedFlagRule<TOutput>[];

  /**
   * Function to serialize a response for vote comparison.
   * By default, uses JSON.stringify for objects, String() for primitives.
   */
  serialize?: (response: TOutput) => string;

  /**
   * Called when a sample is flagged and discarded
   */
  onFlag?: (response: TOutput, rule: RedFlagRule<TOutput>) => void;

  /**
   * Called when a sample is successfully collected
   */
  onSample?: (response: TOutput, voteCount: number) => void;

  /**
   * Enable debug logging
   */
  debug?: boolean;
}

/**
 * A reliable wrapper around an LLM call
 */
export interface ReliableFunction<TInput, TOutput> {
  (input: TInput): Promise<VoteResult<TOutput>>;
}

/**
 * Cost estimation result
 */
export interface CostEstimate {
  /**
   * Estimated total cost in USD
   */
  cost: number;

  /**
   * Estimated number of API calls
   */
  apiCalls: number;

  /**
   * Estimated total tokens
   */
  tokens: number;

  /**
   * The k value required for target reliability
   */
  kRequired: number;

  /**
   * Estimated time in milliseconds
   */
  estimatedTimeMs: number;
}

/**
 * Configuration for cost estimation
 */
export interface CostEstimateConfig {
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
   * Target overall success probability (0-1)
   * @default 0.95
   */
  targetReliability?: number;

  /**
   * Cost per 1M input tokens in USD
   */
  inputCostPerMillion?: number;

  /**
   * Cost per 1M output tokens in USD
   */
  outputCostPerMillion?: number;

  /**
   * Average input tokens per step
   */
  avgInputTokens?: number;

  /**
   * Average output tokens per step
   */
  avgOutputTokens?: number;
}
