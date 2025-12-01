/**
 * Workflow orchestration for MDAP
 * Chain multiple reliable steps together with automatic error handling
 */

import type { VoteResult, ReliableConfig, RedFlagRule } from './types.js';
import { reliable } from './voter.js';

/**
 * A single step in a workflow
 */
export interface WorkflowStep<TInput, TOutput> {
  /**
   * Name of the step (for logging/debugging)
   */
  name: string;

  /**
   * The LLM call to execute
   */
  execute: (input: TInput) => Promise<TOutput>;

  /**
   * Reliability configuration for this step
   */
  config?: Partial<ReliableConfig<TOutput>>;

  /**
   * Transform the output before passing to the next step
   */
  transform?: (result: VoteResult<TOutput>) => TOutput;

  /**
   * Skip this step if condition returns true
   */
  skipIf?: (input: TInput) => boolean;

  /**
   * Retry configuration
   */
  retry?: {
    maxAttempts: number;
    delayMs?: number;
    backoffMultiplier?: number;
  };
}

/**
 * Result of a workflow execution
 */
export interface WorkflowResult<TOutput> {
  /**
   * Final output of the workflow
   */
  output: TOutput;

  /**
   * Results from each step
   */
  steps: StepResult<unknown>[];

  /**
   * Total time taken in milliseconds
   */
  totalTimeMs: number;

  /**
   * Total samples drawn across all steps
   */
  totalSamples: number;

  /**
   * Whether all steps completed successfully
   */
  success: boolean;

  /**
   * Error if workflow failed
   */
  error?: Error;
}

/**
 * Result of a single step execution
 */
export interface StepResult<TOutput> {
  /**
   * Name of the step
   */
  name: string;

  /**
   * Vote result from the step
   */
  result?: VoteResult<TOutput>;

  /**
   * Time taken for this step in milliseconds
   */
  timeMs: number;

  /**
   * Whether the step was skipped
   */
  skipped: boolean;

  /**
   * Number of retry attempts
   */
  attempts: number;

  /**
   * Error if step failed
   */
  error?: Error;
}

/**
 * Workflow builder for chaining reliable steps
 */
export class Workflow<TInput, TOutput = TInput> {
  private steps: WorkflowStep<unknown, unknown>[] = [];
  private globalConfig: Partial<ReliableConfig<unknown>> = {};

  constructor(
    private name: string,
    config?: Partial<ReliableConfig<unknown>>
  ) {
    if (config) {
      this.globalConfig = config;
    }
  }

  /**
   * Add a step to the workflow
   */
  step<TNext>(
    name: string,
    execute: (input: TOutput) => Promise<TNext>,
    config?: Partial<ReliableConfig<TNext>> & {
      transform?: (result: VoteResult<TNext>) => TNext;
      skipIf?: (input: TOutput) => boolean;
      retry?: { maxAttempts: number; delayMs?: number; backoffMultiplier?: number };
    }
  ): Workflow<TInput, TNext> {
    const step: WorkflowStep<TOutput, TNext> = {
      name,
      execute,
      config: config as Partial<ReliableConfig<TNext>>,
      transform: config?.transform,
      skipIf: config?.skipIf,
      retry: config?.retry
    };

    this.steps.push(step as WorkflowStep<unknown, unknown>);
    return this as unknown as Workflow<TInput, TNext>;
  }

  /**
   * Add a parallel branch that executes multiple steps concurrently
   */
  parallel<TResults extends unknown[]>(
    name: string,
    branches: Array<{
      name: string;
      execute: (input: TOutput) => Promise<unknown>;
      config?: Partial<ReliableConfig<unknown>>;
    }>,
    merge: (results: VoteResult<unknown>[]) => TResults[number]
  ): Workflow<TInput, TResults[number]> {
    const parallelStep: WorkflowStep<TOutput, TResults[number]> = {
      name,
      execute: async (input: TOutput) => {
        const promises = branches.map(async (branch) => {
          const mergedConfig = { ...this.globalConfig, ...branch.config };
          const reliableCall = reliable(mergedConfig)(branch.execute);
          return reliableCall(input);
        });

        const results = await Promise.all(promises);
        return merge(results);
      }
    };

    this.steps.push(parallelStep as WorkflowStep<unknown, unknown>);
    return this as unknown as Workflow<TInput, TResults[number]>;
  }

  /**
   * Add a conditional branch
   */
  branch<TNext>(
    name: string,
    condition: (input: TOutput) => boolean,
    ifTrue: (input: TOutput) => Promise<TNext>,
    ifFalse: (input: TOutput) => Promise<TNext>,
    config?: Partial<ReliableConfig<TNext>>
  ): Workflow<TInput, TNext> {
    const branchStep: WorkflowStep<TOutput, TNext> = {
      name,
      execute: async (input: TOutput) => {
        if (condition(input)) {
          return ifTrue(input);
        }
        return ifFalse(input);
      },
      config: config as Partial<ReliableConfig<TNext>>
    };

    this.steps.push(branchStep as WorkflowStep<unknown, unknown>);
    return this as unknown as Workflow<TInput, TNext>;
  }

  /**
   * Add a retry wrapper around the previous step
   */
  withRetry(maxAttempts: number, delayMs = 1000, backoffMultiplier = 2): this {
    if (this.steps.length === 0) {
      throw new Error('Cannot add retry to empty workflow');
    }

    const lastStep = this.steps[this.steps.length - 1];
    lastStep.retry = { maxAttempts, delayMs, backoffMultiplier };
    return this;
  }

  /**
   * Execute the workflow
   */
  async run(input: TInput): Promise<WorkflowResult<TOutput>> {
    const startTime = Date.now();
    const stepResults: StepResult<unknown>[] = [];
    let currentInput: unknown = input;
    let totalSamples = 0;

    for (const step of this.steps) {
      const stepStart = Date.now();
      const stepResult: StepResult<unknown> = {
        name: step.name,
        timeMs: 0,
        skipped: false,
        attempts: 0
      };

      try {
        // Check skip condition
        if (step.skipIf && step.skipIf(currentInput)) {
          stepResult.skipped = true;
          stepResult.timeMs = Date.now() - stepStart;
          stepResults.push(stepResult);
          continue;
        }

        // Execute with retries
        const maxAttempts = step.retry?.maxAttempts ?? 1;
        let lastError: Error | undefined;
        let result: VoteResult<unknown> | undefined;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          stepResult.attempts = attempt;

          try {
            const mergedConfig = { ...this.globalConfig, ...step.config };
            const reliableCall = reliable(mergedConfig)(step.execute);
            result = await reliableCall(currentInput);
            totalSamples += result.totalSamples;
            break;
          } catch (error) {
            lastError = error as Error;

            if (attempt < maxAttempts && step.retry) {
              const delay = (step.retry.delayMs ?? 1000) *
                Math.pow(step.retry.backoffMultiplier ?? 2, attempt - 1);
              await sleep(delay);
            }
          }
        }

        if (!result) {
          throw lastError ?? new Error(`Step "${step.name}" failed after ${maxAttempts} attempts`);
        }

        stepResult.result = result;

        // Transform output if needed
        if (step.transform) {
          currentInput = step.transform(result);
        } else {
          currentInput = result.winner;
        }
      } catch (error) {
        stepResult.error = error as Error;
        stepResult.timeMs = Date.now() - stepStart;
        stepResults.push(stepResult);

        return {
          output: currentInput as TOutput,
          steps: stepResults,
          totalTimeMs: Date.now() - startTime,
          totalSamples,
          success: false,
          error: error as Error
        };
      }

      stepResult.timeMs = Date.now() - stepStart;
      stepResults.push(stepResult);
    }

    return {
      output: currentInput as TOutput,
      steps: stepResults,
      totalTimeMs: Date.now() - startTime,
      totalSamples,
      success: true
    };
  }
}

/**
 * Create a new workflow
 */
export function workflow<TInput>(
  name: string,
  config?: Partial<ReliableConfig<unknown>>
): Workflow<TInput, TInput> {
  return new Workflow<TInput, TInput>(name, config);
}

/**
 * Create a pipeline of functions that are executed in sequence
 */
export function pipeline<TInput, TOutput>(
  steps: Array<{
    name: string;
    fn: (input: unknown) => Promise<unknown>;
    config?: Partial<ReliableConfig<unknown>>;
  }>,
  globalConfig?: Partial<ReliableConfig<unknown>>
): (input: TInput) => Promise<WorkflowResult<TOutput>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let wf: Workflow<TInput, any> = workflow<TInput>(steps[0]?.name ?? 'pipeline', globalConfig);

  for (const step of steps) {
    wf = wf.step(step.name, step.fn, step.config);
  }

  return async (input: TInput): Promise<WorkflowResult<TOutput>> => {
    const result = await wf.run(input);
    return result as WorkflowResult<TOutput>;
  };
}

/**
 * Execute multiple independent operations in parallel with reliability
 */
export async function parallel<T extends Record<string, () => Promise<unknown>>>(
  operations: T,
  config?: Partial<ReliableConfig<unknown>>
): Promise<{ [K in keyof T]: VoteResult<Awaited<ReturnType<T[K]>>> }> {
  const entries = Object.entries(operations);
  const results = await Promise.all(
    entries.map(async ([key, fn]) => {
      const reliableCall = reliable(config ?? {})(fn);
      const result = await reliableCall(undefined);
      return [key, result] as const;
    })
  );

  return Object.fromEntries(results) as { [K in keyof T]: VoteResult<Awaited<ReturnType<T[K]>>> };
}

/**
 * Helper to sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Decompose a task into smaller subtasks and execute them
 */
export async function decompose<TInput, TSubtask, TOutput>(
  input: TInput,
  decomposer: (input: TInput) => Promise<TSubtask[]>,
  executor: (subtask: TSubtask) => Promise<TOutput>,
  aggregator: (results: VoteResult<TOutput>[]) => TOutput,
  config?: Partial<ReliableConfig<TOutput>>
): Promise<WorkflowResult<TOutput>> {
  const startTime = Date.now();
  const stepResults: StepResult<unknown>[] = [];
  let totalSamples = 0;

  try {
    // Decompose - use a separate config for decomposer since it returns TSubtask[]
    const decomposeStart = Date.now();
    const decomposeConfig = config as Partial<ReliableConfig<TSubtask[]>> ?? {};
    const reliableDecompose = reliable(decomposeConfig)(decomposer);
    const subtasksResult = await reliableDecompose(input);
    totalSamples += subtasksResult.totalSamples;

    stepResults.push({
      name: 'decompose',
      result: subtasksResult,
      timeMs: Date.now() - decomposeStart,
      skipped: false,
      attempts: 1
    });

    const subtasks = subtasksResult.winner;

    // Execute subtasks in parallel
    const executeStart = Date.now();
    const reliableExecutor = reliable(config ?? {})(executor);
    const results = await Promise.all(
      subtasks.map(async (subtask: TSubtask) => {
        const result = await reliableExecutor(subtask);
        totalSamples += result.totalSamples;
        return result;
      })
    );

    stepResults.push({
      name: 'execute',
      result: {
        winner: results,
        confidence: 1,
        totalSamples: results.reduce((acc: number, r: VoteResult<TOutput>) => acc + r.totalSamples, 0),
        flaggedSamples: 0,
        votes: new Map(),
        converged: true
      },
      timeMs: Date.now() - executeStart,
      skipped: false,
      attempts: 1
    });

    // Aggregate
    const aggregateStart = Date.now();
    const output = aggregator(results);

    stepResults.push({
      name: 'aggregate',
      result: { winner: output, confidence: 1, totalSamples: 0, flaggedSamples: 0, votes: new Map(), converged: true },
      timeMs: Date.now() - aggregateStart,
      skipped: false,
      attempts: 1
    });

    return {
      output,
      steps: stepResults,
      totalTimeMs: Date.now() - startTime,
      totalSamples,
      success: true
    };
  } catch (error) {
    return {
      output: undefined as unknown as TOutput,
      steps: stepResults,
      totalTimeMs: Date.now() - startTime,
      totalSamples,
      success: false,
      error: error as Error
    };
  }
}
