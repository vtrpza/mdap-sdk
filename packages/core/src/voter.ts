/**
 * Voting Implementation
 * Based on Section 3.2 of the MAKER paper: "First-to-ahead-by-k Voting"
 */

import type {
  LLMCall,
  VoteConfig,
  VoteResult,
  RedFlagRule,
  ResponseMeta,
  ReliableConfig,
} from "./types.js";

const DEFAULT_VOTE_CONFIG: Required<VoteConfig> = {
  k: 3,
  maxSamples: 100,
  parallel: true,
  initialBatch: 3,
  continuationBatch: 2,
  maxConcurrency: 5,
  strategy: "first-to-ahead-by-k",
  earlyTermination: true,
};

/**
 * Default serializer for vote comparison
 */
function defaultSerialize<T>(response: T): string {
  if (typeof response === "string") {
    return response;
  }
  if (response === null || response === undefined) {
    return String(response);
  }
  try {
    return JSON.stringify(response);
  } catch {
    return String(response);
  }
}

/**
 * Check if a response should be flagged (discarded)
 */
function checkRedFlags<TOutput>(
  response: TOutput,
  redFlags: RedFlagRule<TOutput>[],
  meta?: ResponseMeta,
  onFlag?: (response: TOutput, rule: RedFlagRule<TOutput>) => void,
): RedFlagRule<TOutput> | null {
  for (const rule of redFlags) {
    if (rule.check(response, meta)) {
      onFlag?.(response, rule);
      return rule;
    }
  }
  return null;
}

/**
 * Check if voting should terminate based on the strategy
 */
function shouldTerminate(
  votes: Map<string, number>,
  k: number,
  strategy: "first-to-k" | "first-to-ahead-by-k",
): string | null {
  if (votes.size === 0) return null;

  const entries = Array.from(votes.entries());
  entries.sort((a, b) => b[1] - a[1]); // Sort by vote count descending

  const [leader, leaderVotes] = entries[0];
  const secondPlace = entries[1]?.[1] ?? 0;

  if (strategy === "first-to-k") {
    // Simple: first candidate to reach k votes wins
    if (leaderVotes >= k) {
      return leader;
    }
  } else {
    // First-to-ahead-by-k: leader must be k votes ahead of all others
    if (leaderVotes >= k + secondPlace) {
      return leader;
    }
  }

  return null;
}

/**
 * Check if the leader is guaranteed to win (meet convergence criteria).
 * Used for early termination optimization.
 *
 * Returns true if leader will definitely win even in worst case (all remaining
 * samples go to a single competitor).
 */
function isLeaderGuaranteedToWin(
  votes: Map<string, number>,
  k: number,
  strategy: "first-to-k" | "first-to-ahead-by-k",
  remainingSamples: number,
): boolean {
  if (votes.size === 0) return false;

  const entries = Array.from(votes.entries());
  entries.sort((a, b) => b[1] - a[1]);

  const [_leader, leaderVotes] = entries[0];
  const secondPlace = entries[1]?.[1] ?? 0;

  if (strategy === "first-to-k") {
    // Leader wins if they already have k votes
    // Even if all remaining go to second place, leader already won
    return leaderVotes >= k;
  } else {
    // first-to-ahead-by-k: leader must be k ahead of all others
    // Worst case: all remaining samples go to second place
    const worstCaseSecondPlace = secondPlace + remainingSamples;
    // Leader wins if they're still k ahead in worst case
    return leaderVotes >= k + worstCaseSecondPlace;
  }
}

/**
 * Execute the voting process
 *
 * @param llmCall The LLM function to call for each sample
 * @param input The input to pass to the LLM
 * @param config Voting configuration
 */
export async function vote<TInput, TOutput>(
  llmCall: LLMCall<TInput, TOutput>,
  input: TInput,
  config: ReliableConfig<TOutput> = {},
): Promise<VoteResult<TOutput>> {
  const voteConfig = { ...DEFAULT_VOTE_CONFIG, ...config.vote };
  const {
    k,
    maxSamples,
    parallel,
    initialBatch,
    continuationBatch,
    maxConcurrency,
    strategy,
    earlyTermination,
  } = voteConfig;
  const redFlags = config.redFlags ?? [];
  const serialize = config.serialize ?? defaultSerialize;

  const votes = new Map<string, number>();
  const responses = new Map<string, TOutput>(); // Store actual responses by serialized key
  let totalSamples = 0;
  let flaggedSamples = 0;

  /**
   * Draw a single sample and process it
   */
  async function drawSample(): Promise<{ flagged: boolean; key?: string }> {
    totalSamples++;

    try {
      const response = await llmCall(input);

      // Check red flags
      const flaggedRule = checkRedFlags(
        response,
        redFlags,
        undefined,
        config.onFlag,
      );
      if (flaggedRule) {
        flaggedSamples++;
        if (config.debug) {
          console.log(
            `[MDAP] Sample ${totalSamples} flagged by: ${flaggedRule.name}`,
          );
        }
        return { flagged: true };
      }

      // Serialize and count vote
      const key = serialize(response);
      const currentVotes = (votes.get(key) ?? 0) + 1;
      votes.set(key, currentVotes);
      responses.set(key, response);

      config.onSample?.(response, currentVotes);

      if (config.debug) {
        console.log(
          `[MDAP] Sample ${totalSamples}: "${key.slice(0, 50)}..." -> ${currentVotes} votes`,
        );
      }

      return { flagged: false, key };
    } catch (error) {
      // Treat errors as flagged samples
      flaggedSamples++;
      if (config.debug) {
        console.log(`[MDAP] Sample ${totalSamples} errored:`, error);
      }
      return { flagged: true };
    }
  }

  // Initial batch of samples (parallel if enabled)
  const initialBatchSize = parallel ? Math.max(initialBatch, k) : 1;

  if (parallel) {
    // Respect maxConcurrency for initial batch
    const batchSize = Math.min(initialBatchSize, maxConcurrency);
    await Promise.all(
      Array(batchSize)
        .fill(null)
        .map(() => drawSample()),
    );
  } else {
    for (let i = 0; i < initialBatchSize; i++) {
      await drawSample();
    }
  }

  // Continue sampling until we have a winner or hit max
  while (totalSamples < maxSamples) {
    // Check for winner
    const winner = shouldTerminate(votes, k, strategy);
    if (winner !== null) {
      const winnerVotes = votes.get(winner) ?? 0;
      const totalValidVotes = Array.from(votes.values()).reduce(
        (a, b) => a + b,
        0,
      );

      return {
        winner: responses.get(winner)!,
        confidence: winnerVotes / totalValidVotes,
        totalSamples,
        flaggedSamples,
        votes,
        converged: true,
      };
    }

    // Early termination: check if leader is guaranteed to win
    const remainingSamples = maxSamples - totalSamples;
    if (
      earlyTermination &&
      isLeaderGuaranteedToWin(votes, k, strategy, remainingSamples)
    ) {
      // Leader is guaranteed to win even in worst case - terminate early
      const entries = Array.from(votes.entries());
      entries.sort((a, b) => b[1] - a[1]);
      const [winnerKey, winnerVotes] = entries[0];
      const totalValidVotes = Array.from(votes.values()).reduce(
        (a, b) => a + b,
        0,
      );

      if (config.debug) {
        console.log(
          `[MDAP] Early termination: leader guaranteed to win (${winnerVotes} votes, ${remainingSamples} remaining)`,
        );
      }

      return {
        winner: responses.get(winnerKey)!,
        confidence: winnerVotes / totalValidVotes,
        totalSamples,
        flaggedSamples,
        votes,
        converged: true,
      };
    }

    // Draw continuation batch in parallel (if enabled) or single sample
    if (parallel && continuationBatch > 1) {
      const batchSize = Math.min(
        continuationBatch,
        maxSamples - totalSamples,
        maxConcurrency,
      );
      await Promise.all(
        Array(batchSize)
          .fill(null)
          .map(() => drawSample()),
      );
    } else {
      await drawSample();
    }
  }

  // Hit maxSamples without convergence - return the leader
  const entries = Array.from(votes.entries());
  entries.sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    throw new Error(
      `MDAP: No valid samples after ${maxSamples} attempts. All were flagged.`,
    );
  }

  const [winnerKey, winnerVotes] = entries[0];
  const totalValidVotes = Array.from(votes.values()).reduce((a, b) => a + b, 0);

  return {
    winner: responses.get(winnerKey)!,
    confidence: winnerVotes / totalValidVotes,
    totalSamples,
    flaggedSamples,
    votes,
    converged: false,
  };
}

/**
 * Create a reliable wrapper around an LLM call.
 * This is the main API entry point for most users.
 *
 * @example
 * ```typescript
 * const reliableExtract = reliable({
 *   vote: { k: 3 },
 *   redFlags: [RedFlag.tooLong(750), RedFlag.invalidJson()]
 * })(async (text: string) => {
 *   return await openai.chat({ prompt: `Extract JSON from: ${text}` });
 * });
 *
 * const result = await reliableExtract("Some document...");
 * console.log(result.winner); // The winning response
 * console.log(result.confidence); // How confident we are
 * ```
 */
export function reliable<TOutput = string>(
  config: ReliableConfig<TOutput> = {},
) {
  return function <TInput>(
    llmCall: LLMCall<TInput, TOutput>,
  ): (input: TInput) => Promise<VoteResult<TOutput>> {
    return async (input: TInput) => {
      return vote(llmCall, input, config);
    };
  };
}
