/**
 * OpenAI Adapter for MDAP
 *
 * Provides a simple wrapper around the OpenAI SDK that works with MDAP's reliable() function.
 *
 * @example
 * ```typescript
 * import { reliable, RedFlag } from '@mdap/core';
 * import { createOpenAI } from '@mdap/adapters/openai';
 *
 * const openai = createOpenAI({
 *   apiKey: process.env.OPENAI_API_KEY,
 *   model: 'gpt-4.1-mini'
 * });
 *
 * const extract = reliable({
 *   vote: { k: 3 },
 *   redFlags: [RedFlag.tooLong(750)]
 * })(async (text: string) => {
 *   return await openai.chat(`Extract entities from: ${text}`);
 * });
 * ```
 */

export interface OpenAIConfig {
  /**
   * OpenAI API key. Defaults to OPENAI_API_KEY env var.
   */
  apiKey?: string;

  /**
   * Model to use.
   * @default 'gpt-4.1-mini'
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

  /**
   * Base URL for API calls (for proxies or compatible APIs).
   */
  baseURL?: string;
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

export interface OpenAIAdapter {
  /**
   * Send a chat message and get a response
   */
  chat: (prompt: string, options?: ChatOptions) => Promise<string>;

  /**
   * Get the current configuration
   */
  config: OpenAIConfig;
}

/**
 * Create an OpenAI adapter
 *
 * @param config Configuration options
 * @returns An adapter object with chat() method
 */
export function createOpenAI(config: OpenAIConfig = {}): OpenAIAdapter {
  const {
    apiKey = process.env.OPENAI_API_KEY,
    model = 'gpt-4.1-mini',
    temperature = 0.1,
    maxTokens = 1024,
    baseURL = 'https://api.openai.com/v1'
  } = config;

  if (!apiKey) {
    throw new Error('OpenAI API key is required. Set OPENAI_API_KEY env var or pass apiKey option.');
  }

  async function chat(prompt: string, options: ChatOptions = {}): Promise<string> {
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(options.system ? [{ role: 'system', content: options.system }] : []),
          { role: 'user', content: prompt }
        ],
        temperature: options.temperature ?? temperature,
        max_tokens: options.maxTokens ?? maxTokens
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0]?.message?.content ?? '';
  }

  return {
    chat,
    config: { apiKey, model, temperature, maxTokens, baseURL }
  };
}

/**
 * Quick helper to create a chat function from API key
 */
export function openaiChat(apiKey?: string, model?: string) {
  const adapter = createOpenAI({ apiKey, model });
  return adapter.chat;
}
