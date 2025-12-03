/**
 * Rate Limiting Wrapper for MDAP Adapters
 *
 * Provides rate limiting, retry with exponential backoff, and request queuing
 * to respect API rate limits (especially important for lower tiers).
 *
 * @example
 * ```typescript
 * import { createOpenAI, withRateLimit } from '@mdap/adapters';
 *
 * const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
 *
 * // Wrap with rate limiting (500 RPM = ~8 requests/second)
 * const rateLimitedOpenAI = withRateLimit(openai, {
 *   requestsPerMinute: 500,
 *   maxRetries: 3,
 *   retryDelayMs: 1000
 * });
 *
 * // Use normally - rate limiting is automatic
 * const result = await rateLimitedOpenAI.chat('Hello');
 * ```
 */

import type { ChatOptions } from "./openai.js";

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum requests per minute.
   * OpenAI tiers: Free=3, Tier1=500, Tier2=5000, Tier3=5000
   * @default 500 (Tier 1)
   */
  requestsPerMinute?: number;

  /**
   * Maximum concurrent requests.
   * @default 5
   */
  maxConcurrent?: number;

  /**
   * Maximum retries for rate limit errors (429).
   * @default 3
   */
  maxRetries?: number;

  /**
   * Base delay between retries in ms (exponential backoff applied).
   * @default 1000
   */
  retryDelayMs?: number;

  /**
   * Maximum retry delay in ms.
   * @default 30000
   */
  maxRetryDelayMs?: number;

  /**
   * Jitter factor (0-1) to add randomness to retry delays.
   * @default 0.1
   */
  jitterFactor?: number;
}

/**
 * Common adapter interface that both OpenAI and Anthropic adapters satisfy
 */
export interface ChatAdapter {
  chat: (prompt: string, options?: ChatOptions) => Promise<string>;
  config: Record<string, unknown>;
}

/**
 * Rate-limited adapter interface
 */
export interface RateLimitedAdapter extends ChatAdapter {
  /**
   * Get current rate limiter statistics
   */
  stats: () => RateLimitStats;

  /**
   * Reset the rate limiter state
   */
  reset: () => void;
}

/**
 * Rate limiter statistics
 */
export interface RateLimitStats {
  /** Total requests made */
  totalRequests: number;
  /** Requests currently in flight */
  inFlight: number;
  /** Requests waiting in queue */
  queued: number;
  /** Total retries performed */
  totalRetries: number;
  /** Requests that failed after all retries */
  failedRequests: number;
  /** Average response time in ms */
  avgResponseTimeMs: number;
}

/**
 * Token bucket rate limiter implementation
 */
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms

  constructor(requestsPerMinute: number) {
    this.maxTokens = requestsPerMinute;
    this.tokens = requestsPerMinute;
    this.refillRate = requestsPerMinute / 60000; // convert to per-ms
    this.lastRefill = Date.now();
  }

  /**
   * Try to consume a token. Returns wait time in ms if tokens not available.
   */
  tryConsume(): number {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return 0;
    }

    // Calculate wait time until 1 token is available
    const tokensNeeded = 1 - this.tokens;
    return Math.ceil(tokensNeeded / this.refillRate);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }
}

/**
 * Request queue for managing concurrent requests
 */
interface QueuedRequest {
  execute: () => Promise<string>;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}

/**
 * Create a rate-limited wrapper around any chat adapter
 *
 * @param adapter The adapter to wrap (OpenAI or Anthropic)
 * @param config Rate limit configuration
 * @returns A rate-limited adapter with the same interface
 */
export function withRateLimit(
  adapter: ChatAdapter,
  config: RateLimitConfig = {},
): RateLimitedAdapter {
  const {
    requestsPerMinute = 500,
    maxConcurrent = 5,
    maxRetries = 3,
    retryDelayMs = 1000,
    maxRetryDelayMs = 30000,
    jitterFactor = 0.1,
  } = config;

  const bucket = new TokenBucket(requestsPerMinute);
  const queue: QueuedRequest[] = [];

  // Statistics tracking
  let totalRequests = 0;
  let inFlight = 0;
  let totalRetries = 0;
  let failedRequests = 0;
  let totalResponseTime = 0;
  let completedRequests = 0;

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  function calculateRetryDelay(attempt: number): number {
    const exponentialDelay = retryDelayMs * Math.pow(2, attempt);
    const cappedDelay = Math.min(exponentialDelay, maxRetryDelayMs);

    // Add jitter: +/- jitterFactor * delay
    const jitter = cappedDelay * jitterFactor * (Math.random() * 2 - 1);
    return Math.max(0, Math.round(cappedDelay + jitter));
  }

  /**
   * Check if an error is a rate limit error (429)
   */
  function isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.message.includes("429") ||
        error.message.toLowerCase().includes("rate limit")
      );
    }
    return false;
  }

  /**
   * Check if an error is retryable (rate limit or server error)
   */
  function isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      // Rate limit errors
      if (isRateLimitError(error)) return true;
      // Server errors (5xx)
      if (
        error.message.includes("500") ||
        error.message.includes("502") ||
        error.message.includes("503") ||
        error.message.includes("504")
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Sleep for a given duration
   */
  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute a request with retry logic
   */
  async function executeWithRetry(
    prompt: string,
    options?: ChatOptions,
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const result = await adapter.chat(prompt, options);
        const elapsed = Date.now() - startTime;

        // Update stats
        totalResponseTime += elapsed;
        completedRequests++;

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries && isRetryableError(error)) {
          totalRetries++;
          const delay = calculateRetryDelay(attempt);

          // If rate limited, also pause the bucket
          if (isRateLimitError(error)) {
            bucket.reset(); // Reset tokens to prevent immediate retries
          }

          await sleep(delay);
        } else {
          break;
        }
      }
    }

    failedRequests++;
    throw lastError ?? new Error("Request failed after retries");
  }

  /**
   * Process the request queue
   */
  async function processQueue(): Promise<void> {
    while (queue.length > 0 && inFlight < maxConcurrent) {
      // Check rate limit
      const waitTime = bucket.tryConsume();
      if (waitTime > 0) {
        await sleep(waitTime);
        continue;
      }

      const request = queue.shift();
      if (!request) break;

      inFlight++;

      // Execute without awaiting to allow parallel processing
      request
        .execute()
        .then((result) => {
          inFlight--;
          request.resolve(result);
          processQueue(); // Process next in queue
        })
        .catch((error) => {
          inFlight--;
          request.reject(error);
          processQueue(); // Process next in queue
        });
    }
  }

  /**
   * Rate-limited chat function
   */
  async function chat(prompt: string, options?: ChatOptions): Promise<string> {
    totalRequests++;

    return new Promise<string>((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        execute: () => executeWithRetry(prompt, options),
        resolve,
        reject,
      };

      queue.push(queuedRequest);
      processQueue();
    });
  }

  return {
    chat,
    config: adapter.config,

    stats: () => ({
      totalRequests,
      inFlight,
      queued: queue.length,
      totalRetries,
      failedRequests,
      avgResponseTimeMs:
        completedRequests > 0
          ? Math.round(totalResponseTime / completedRequests)
          : 0,
    }),

    reset: () => {
      bucket.reset();
      totalRequests = 0;
      inFlight = 0;
      totalRetries = 0;
      failedRequests = 0;
      totalResponseTime = 0;
      completedRequests = 0;
      // Note: queue is not cleared - pending requests will complete
    },
  };
}

/**
 * Preset rate limit configurations for common API tiers
 */
export const RateLimitPresets = {
  /** OpenAI Free tier: 3 RPM */
  openai_free: {
    requestsPerMinute: 3,
    maxConcurrent: 1,
    maxRetries: 5,
    retryDelayMs: 20000,
  } satisfies RateLimitConfig,

  /** OpenAI Tier 1: 500 RPM */
  openai_tier1: {
    requestsPerMinute: 500,
    maxConcurrent: 10,
    maxRetries: 3,
    retryDelayMs: 1000,
  } satisfies RateLimitConfig,

  /** OpenAI Tier 2+: 5000 RPM */
  openai_tier2: {
    requestsPerMinute: 5000,
    maxConcurrent: 50,
    maxRetries: 3,
    retryDelayMs: 500,
  } satisfies RateLimitConfig,

  /** Anthropic Tier 1: 50 RPM */
  anthropic_tier1: {
    requestsPerMinute: 50,
    maxConcurrent: 5,
    maxRetries: 3,
    retryDelayMs: 2000,
  } satisfies RateLimitConfig,

  /** Anthropic Tier 2+: 1000 RPM */
  anthropic_tier2: {
    requestsPerMinute: 1000,
    maxConcurrent: 20,
    maxRetries: 3,
    retryDelayMs: 1000,
  } satisfies RateLimitConfig,

  /** Conservative: very slow, for testing */
  conservative: {
    requestsPerMinute: 10,
    maxConcurrent: 2,
    maxRetries: 5,
    retryDelayMs: 5000,
  } satisfies RateLimitConfig,
} as const;
