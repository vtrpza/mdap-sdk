/**
 * Anthropic (Claude) Adapter for MDAP
 *
 * @example
 * ```typescript
 * import { reliable, RedFlag } from '@mdap/core';
 * import { createAnthropic } from '@mdap/adapters/anthropic';
 *
 * const claude = createAnthropic({
 *   apiKey: process.env.ANTHROPIC_API_KEY,
 *   model: 'claude-3-5-haiku-latest'
 * });
 *
 * const extract = reliable({
 *   vote: { k: 3 },
 *   redFlags: [RedFlag.tooLong(750)]
 * })(async (text: string) => {
 *   return await claude.chat(`Extract entities from: ${text}`);
 * });
 * ```
 */

export interface AnthropicConfig {
  /**
   * Anthropic API key. Defaults to ANTHROPIC_API_KEY env var.
   */
  apiKey?: string;

  /**
   * Model to use.
   * @default 'claude-3-5-haiku-latest'
   */
  model?: string;

  /**
   * Temperature for sampling.
   * @default 0.1
   */
  temperature?: number;

  /**
   * Maximum tokens to generate.
   * @default 1024
   */
  maxTokens?: number;
}

export interface ChatOptions {
  /**
   * System prompt to use
   */
  system?: string;

  /**
   * Override temperature for this call
   */
  temperature?: number;

  /**
   * Override max tokens for this call
   */
  maxTokens?: number;
}

export interface AnthropicAdapter {
  /**
   * Send a chat message and get a response
   */
  chat: (prompt: string, options?: ChatOptions) => Promise<string>;

  /**
   * Get the current configuration
   */
  config: AnthropicConfig;
}

/**
 * Create an Anthropic adapter
 */
export function createAnthropic(config: AnthropicConfig = {}): AnthropicAdapter {
  const {
    apiKey = process.env.ANTHROPIC_API_KEY,
    model = 'claude-3-5-haiku-latest',
    temperature = 0.1,
    maxTokens = 1024
  } = config;

  if (!apiKey) {
    throw new Error('Anthropic API key is required. Set ANTHROPIC_API_KEY env var or pass apiKey option.');
  }

  // Type narrowing: apiKey is guaranteed to be string after the check above
  const validApiKey: string = apiKey;

  async function chat(prompt: string, options: ChatOptions = {}): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': validApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens ?? maxTokens,
        messages: [
          { role: 'user', content: prompt }
        ],
        ...(options.system && { system: options.system }),
        temperature: options.temperature ?? temperature
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${error}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };

    const textContent = data.content.find(c => c.type === 'text');
    return textContent?.text ?? '';
  }

  return {
    chat,
    config: { apiKey, model, temperature, maxTokens }
  };
}

/**
 * Quick helper to create a chat function from API key
 */
export function anthropicChat(apiKey?: string, model?: string) {
  const adapter = createAnthropic({ apiKey, model });
  return adapter.chat;
}
