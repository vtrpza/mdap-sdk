/**
 * MDAP Core - Massively Decomposed Agentic Processes
 *
 * Make your AI agents reliable with voting-based error correction.
 * Based on the paper: "Solving a Million-Step LLM Task with Zero Errors"
 *
 * @example
 * ```typescript
 * import { reliable, RedFlag, estimateCost } from '@mdap/core';
 *
 * // Wrap any LLM call with reliability
 * const extract = reliable({
 *   vote: { k: 3 },
 *   redFlags: [RedFlag.tooLong(750), RedFlag.invalidJson()]
 * })(async (text: string) => {
 *   return await myLLM.call(`Extract entities from: ${text}`);
 * });
 *
 * // Use it
 * const result = await extract("Some document text...");
 * console.log(result.winner);     // The winning response
 * console.log(result.confidence); // Confidence score
 * ```
 *
 * @packageDocumentation
 */

// Core voting functionality
export { reliable, vote } from './voter.js';

// Red flag detection
export {
  RedFlag,
  tooLong,
  emptyResponse,
  invalidJson,
  mustMatch,
  mustNotMatch,
  containsPhrase,
  custom
} from './red-flags.js';

// Cost estimation
export {
  estimateCost,
  calculateMinK,
  calculateExpectedSamples,
  calculateSuccessProbability,
  formatCostEstimate
} from './cost.js';

// Workflow orchestration
export {
  Workflow,
  workflow,
  pipeline,
  parallel,
  decompose
} from './workflow.js';

// Types
export type {
  LLMCall,
  VoteConfig,
  VoteResult,
  RedFlagRule,
  ResponseMeta,
  ReliableConfig,
  ReliableFunction,
  CostEstimate,
  CostEstimateConfig
} from './types.js';

export type {
  WorkflowStep,
  WorkflowResult,
  StepResult
} from './workflow.js';
