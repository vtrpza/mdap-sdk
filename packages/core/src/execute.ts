/**
 * Execute Module - Shared execution logic for MCP and CLI
 *
 * Provides a high-level API for running prompts with full MDAP reliability
 * (voting + red flags). This is the core of agentic self-correction.
 *
 * Based on the paper: "Solving a Million-Step LLM Task with Zero Errors"
 *
 * @packageDocumentation
 */

import { vote } from "./voter.js";
import { RedFlag } from "./red-flags.js";
import type { VoteResult, RedFlagRule } from "./types.js";

/**
 * Supported LLM providers
 */
export type Provider = "openai" | "anthropic";

/**
 * Red flag input - can be string format or object format
 *
 * String format examples:
 * - "tooLong:750" - flag if > 750 tokens
 * - "invalidJson" - flag if not valid JSON
 * - "emptyResponse" - flag if empty
 * - "mustMatch:^\\{.*\\}$" - must match regex
 * - "mustNotMatch:error|failed" - must not match regex
 * - "containsPhrase:I cannot,I'm not sure" - flag if contains phrase
 *
 * Object format:
 * - { type: "tooLong", value: 750 }
 * - { type: "invalidJson" }
 * - { type: "mustMatch", pattern: "^\\{.*\\}$" }
 */
export type RedFlagInput =
  | string
  | {
      type:
        | "tooLong"
        | "emptyResponse"
        | "invalidJson"
        | "mustMatch"
        | "mustNotMatch"
        | "containsPhrase";
      value?: number;
      pattern?: string;
      phrases?: string[];
    };

/**
 * Configuration for executeReliable
 */
export interface ExecuteConfig {
  /**
   * The prompt to send to the LLM
   */
  prompt: string;

  /**
   * Optional system prompt
   */
  system?: string;

  /**
   * Vote threshold - first candidate to lead by k votes wins
   * @default 3 (paper recommendation)
   */
  k?: number;

  /**
   * Maximum samples before giving up
   * @default 30
   */
  maxSamples?: number;

  /**
   * Red flag rules to apply
   * @default ["tooLong:750", "emptyResponse"]
   */
  redFlags?: RedFlagInput[];

  /**
   * LLM provider to use
   * @default "openai"
   */
  provider?: Provider;

  /**
   * Model to use
   * @default "gpt-4.1-mini" (paper recommendation)
   */
  model?: string;

  /**
   * Temperature for sampling
   * @default 0.1 (paper recommendation for voting consistency)
   */
  temperature?: number;

  /**
   * Maximum tokens to generate per response
   * @default 1024
   */
  maxTokens?: number;

  /**
   * API key (defaults to env var based on provider)
   */
  apiKey?: string;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}

/**
 * Result of executeReliable
 */
export interface ExecuteResult {
  /**
   * The winning response
   */
  winner: string;

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
   * Whether the vote converged (winner found) or hit maxSamples
   */
  converged: boolean;

  /**
   * Vote counts for each unique response
   */
  votes: Record<string, number>;

  /**
   * Token usage and cost tracking
   */
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };

  /**
   * Warning message if vote didn't converge
   */
  warning?: string;
}

/**
 * Model pricing per million tokens (USD)
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2.0, output: 8.0 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
  // Anthropic
  "claude-3-5-sonnet-latest": { input: 3.0, output: 15.0 },
  "claude-3-5-haiku-latest": { input: 0.8, output: 4.0 },
  "claude-3-opus-latest": { input: 15.0, output: 75.0 },
};

/**
 * Parse a red flag input (string or object) into a RedFlagRule
 */
export function parseRedFlag(input: RedFlagInput): RedFlagRule<string> {
  if (typeof input === "string") {
    // Parse string format: "type:value" or just "type"
    const colonIndex = input.indexOf(":");
    const type = colonIndex > 0 ? input.slice(0, colonIndex) : input;
    const value = colonIndex > 0 ? input.slice(colonIndex + 1) : undefined;

    switch (type) {
      case "tooLong":
        return RedFlag.tooLong(value ? parseInt(value, 10) : 750);
      case "emptyResponse":
        return RedFlag.emptyResponse();
      case "invalidJson":
        return RedFlag.invalidJson();
      case "mustMatch":
        if (!value)
          throw new Error("mustMatch requires a pattern: mustMatch:regex");
        return RedFlag.mustMatch(new RegExp(value));
      case "mustNotMatch":
        if (!value)
          throw new Error(
            "mustNotMatch requires a pattern: mustNotMatch:regex",
          );
        return RedFlag.mustNotMatch(new RegExp(value));
      case "containsPhrase":
        if (!value)
          throw new Error(
            "containsPhrase requires phrases: containsPhrase:phrase1,phrase2",
          );
        return RedFlag.containsPhrase(value.split(",").map((p) => p.trim()));
      default:
        throw new Error(`Unknown red flag type: ${type}`);
    }
  }

  // Object format
  switch (input.type) {
    case "tooLong":
      return RedFlag.tooLong(input.value ?? 750);
    case "emptyResponse":
      return RedFlag.emptyResponse();
    case "invalidJson":
      return RedFlag.invalidJson();
    case "mustMatch":
      if (!input.pattern) throw new Error("mustMatch requires a pattern");
      return RedFlag.mustMatch(new RegExp(input.pattern));
    case "mustNotMatch":
      if (!input.pattern) throw new Error("mustNotMatch requires a pattern");
      return RedFlag.mustNotMatch(new RegExp(input.pattern));
    case "containsPhrase":
      if (!input.phrases || input.phrases.length === 0)
        throw new Error("containsPhrase requires phrases array");
      return RedFlag.containsPhrase(input.phrases);
    default:
      throw new Error(
        `Unknown red flag type: ${(input as { type: string }).type}`,
      );
  }
}

/**
 * Parse multiple red flag inputs
 */
export function parseRedFlags(inputs: RedFlagInput[]): RedFlagRule<string>[] {
  return inputs.map(parseRedFlag);
}

/**
 * Get default red flags (paper-aligned)
 */
export function getDefaultRedFlags(): RedFlagInput[] {
  return ["tooLong:750", "emptyResponse"];
}

/**
 * Calculate estimated cost based on token usage and model
 */
function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
): number {
  const pricing = MODEL_PRICING[model] ?? { input: 0.5, output: 1.5 };
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Estimate tokens from text (rough approximation: 1 token ≈ 4 chars)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * LLM adapter interface for executeReliable
 */
export interface LLMAdapter {
  chat: (prompt: string, options?: { system?: string }) => Promise<string>;
}

/**
 * Create an LLM adapter based on provider
 * This is a factory that dynamically imports the adapter
 */
export async function createAdapter(
  provider: Provider,
  config: {
    apiKey?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  },
): Promise<LLMAdapter> {
  const { apiKey, model, temperature = 0.1, maxTokens = 1024 } = config;

  if (provider === "openai") {
    const key = apiKey ?? process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error(
        "OpenAI API key required. Set OPENAI_API_KEY env var or pass apiKey.",
      );
    }

    // Create OpenAI adapter inline to avoid circular dependency with @mdap/adapters
    return {
      async chat(
        prompt: string,
        options?: { system?: string },
      ): Promise<string> {
        const response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
              model: model ?? "gpt-4.1-mini",
              messages: [
                ...(options?.system
                  ? [{ role: "system", content: options.system }]
                  : []),
                { role: "user", content: prompt },
              ],
              temperature,
              max_tokens: maxTokens,
            }),
          },
        );

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`OpenAI API error: ${response.status} ${error}`);
        }

        const data = (await response.json()) as {
          choices: Array<{ message: { content: string } }>;
        };

        return data.choices[0]?.message?.content ?? "";
      },
    };
  }

  if (provider === "anthropic") {
    const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error(
        "Anthropic API key required. Set ANTHROPIC_API_KEY env var or pass apiKey.",
      );
    }

    return {
      async chat(
        prompt: string,
        options?: { system?: string },
      ): Promise<string> {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: model ?? "claude-3-5-haiku-latest",
            max_tokens: maxTokens,
            ...(options?.system ? { system: options.system } : {}),
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Anthropic API error: ${response.status} ${error}`);
        }

        const data = (await response.json()) as {
          content: Array<{ type: string; text: string }>;
        };

        const textBlock = data.content.find((c) => c.type === "text");
        return textBlock?.text ?? "";
      },
    };
  }

  throw new Error(`Unknown provider: ${provider}`);
}

/**
 * Execute a prompt with full MDAP reliability (voting + red flags)
 *
 * This is the main entry point for agentic use - agents can call this
 * to self-validate their outputs using the paper's methodology.
 *
 * @example
 * ```typescript
 * const result = await executeReliable({
 *   prompt: "Extract entities as JSON from: Apple Inc. was founded by Steve Jobs",
 *   system: "Respond only with valid JSON",
 *   k: 3,
 *   redFlags: ["tooLong:500", "invalidJson"]
 * });
 *
 * console.log(result.winner);     // {"entities": ["Apple Inc.", "Steve Jobs"]}
 * console.log(result.confidence); // 1.0
 * console.log(result.converged);  // true
 * ```
 */
export async function executeReliable(
  config: ExecuteConfig,
): Promise<ExecuteResult> {
  const {
    prompt,
    system,
    k = 3,
    maxSamples = 30,
    redFlags = getDefaultRedFlags(),
    provider = "openai",
    model = provider === "openai" ? "gpt-4.1-mini" : "claude-3-5-haiku-latest",
    temperature = 0.1,
    maxTokens = 1024,
    apiKey,
    debug = false,
  } = config;

  // Create adapter
  const adapter = await createAdapter(provider, {
    apiKey,
    model,
    temperature,
    maxTokens,
  });

  // Parse red flags
  const rules = parseRedFlags(redFlags);

  // Track token usage
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Create LLM call function that tracks tokens
  const llmCall = async (_input: string): Promise<string> => {
    const response = await adapter.chat(prompt, { system });

    // Estimate tokens (we don't have exact counts without parsing response headers)
    const inputTokens = estimateTokens(prompt + (system ?? ""));
    const outputTokens = estimateTokens(response);

    totalInputTokens += inputTokens;
    totalOutputTokens += outputTokens;

    return response;
  };

  // Execute voting
  const voteResult: VoteResult<string> = await vote(llmCall, prompt, {
    vote: {
      k,
      maxSamples,
      strategy: "first-to-ahead-by-k",
    },
    redFlags: rules,
    debug,
  });

  // Convert Map to Record for serialization
  const votesRecord: Record<string, number> = {};
  for (const [key, value] of voteResult.votes) {
    votesRecord[key] = value;
  }

  // Calculate cost
  const estimatedCost = calculateCost(
    totalInputTokens,
    totalOutputTokens,
    model,
  );

  // Build result
  const result: ExecuteResult = {
    winner: voteResult.winner,
    confidence: voteResult.confidence,
    totalSamples: voteResult.totalSamples,
    flaggedSamples: voteResult.flaggedSamples,
    converged: voteResult.converged,
    votes: votesRecord,
    usage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      estimatedCost,
    },
  };

  // Add warning if not converged
  if (!voteResult.converged) {
    result.warning = `Vote did not converge after ${maxSamples} samples. Returning best candidate with ${Math.round(voteResult.confidence * 100)}% confidence. Consider: 1) Improving prompt for convergence, 2) Increasing maxSamples, 3) Using structured output (JSON).`;
  }

  return result;
}

/**
 * Format an ExecuteResult for human-readable output
 */
export function formatExecuteResult(result: ExecuteResult): string {
  const lines: string[] = [];

  if (result.converged) {
    lines.push(
      `✅ Converged with ${Math.round(result.confidence * 100)}% confidence`,
    );
  } else {
    lines.push(
      `⚠️  Did not converge (${Math.round(result.confidence * 100)}% confidence)`,
    );
  }

  lines.push(``);
  lines.push(`Winner:`);
  lines.push(result.winner);
  lines.push(``);
  lines.push(`Stats:`);
  lines.push(
    `  Samples: ${result.totalSamples} (${result.flaggedSamples} flagged)`,
  );
  lines.push(`  Tokens: ${result.usage.totalTokens.toLocaleString()}`);
  lines.push(`  Cost: $${result.usage.estimatedCost.toFixed(4)}`);

  if (result.warning) {
    lines.push(``);
    lines.push(`Warning: ${result.warning}`);
  }

  return lines.join("\n");
}
