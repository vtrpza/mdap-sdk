/**
 * Built-in Red Flag Rules
 * Based on Section 3.3 of the MAKER paper
 */

import type { RedFlagRule, ResponseMeta } from './types.js';

/**
 * Create a red flag rule that flags responses exceeding a token/character limit.
 * From the paper: "once an LLM gets initially confused, it can go off the rails
 * and over-analyze a situation in a cycle of self-destruction"
 *
 * @param maxTokens Maximum allowed tokens (defaults to checking characters if tokens unavailable)
 * @param maxChars Maximum allowed characters (fallback when tokens unavailable)
 */
export function tooLong(maxTokens: number = 750, maxChars?: number): RedFlagRule<string> {
  const charLimit = maxChars ?? maxTokens * 4; // Rough estimate: 1 token ≈ 4 chars

  return {
    name: `tooLong(${maxTokens} tokens)`,
    check: (response: string, meta?: ResponseMeta): boolean => {
      // Use token count if available
      if (meta?.tokens !== undefined) {
        return meta.tokens > maxTokens;
      }
      // Fall back to character count
      return response.length > charLimit;
    }
  };
}

/**
 * Create a red flag rule that flags empty or whitespace-only responses.
 */
export function emptyResponse(): RedFlagRule<string> {
  return {
    name: 'emptyResponse',
    check: (response: string): boolean => {
      return !response || response.trim().length === 0;
    }
  };
}

/**
 * Create a red flag rule that flags responses that aren't valid JSON.
 * From the paper: "when an agent produces an answer in an incorrect format,
 * it is more likely to have become confused"
 */
export function invalidJson(): RedFlagRule<string> {
  return {
    name: 'invalidJson',
    check: (response: string): boolean => {
      try {
        JSON.parse(response);
        return false; // Valid JSON, don't flag
      } catch {
        return true; // Invalid JSON, flag it
      }
    }
  };
}

/**
 * Create a red flag rule that flags responses not matching a regex pattern.
 *
 * @param pattern Regex pattern the response must match
 * @param name Optional name for the rule
 */
export function mustMatch(pattern: RegExp, name?: string): RedFlagRule<string> {
  return {
    name: name ?? `mustMatch(${pattern.source})`,
    check: (response: string): boolean => {
      return !pattern.test(response);
    }
  };
}

/**
 * Create a red flag rule that flags responses matching a regex pattern.
 *
 * @param pattern Regex pattern that indicates a bad response
 * @param name Optional name for the rule
 */
export function mustNotMatch(pattern: RegExp, name?: string): RedFlagRule<string> {
  return {
    name: name ?? `mustNotMatch(${pattern.source})`,
    check: (response: string): boolean => {
      return pattern.test(response);
    }
  };
}

/**
 * Create a red flag rule that flags responses containing certain phrases.
 * Useful for catching LLM "confusion" indicators like "I'm not sure" or "Error:"
 *
 * @param phrases Array of phrases that indicate a problematic response
 */
export function containsPhrase(phrases: string[]): RedFlagRule<string> {
  const lowerPhrases = phrases.map(p => p.toLowerCase());

  return {
    name: `containsPhrase([${phrases.slice(0, 2).join(', ')}${phrases.length > 2 ? '...' : ''}])`,
    check: (response: string): boolean => {
      const lowerResponse = response.toLowerCase();
      return lowerPhrases.some(phrase => lowerResponse.includes(phrase));
    }
  };
}

/**
 * Create a custom red flag rule from a predicate function.
 *
 * @param name Name for the rule
 * @param predicate Function that returns true to flag the response
 */
export function custom<TOutput>(
  name: string,
  predicate: (response: TOutput, meta?: ResponseMeta) => boolean
): RedFlagRule<TOutput> {
  return {
    name,
    check: predicate
  };
}

/**
 * Convenience object for accessing all built-in red flag creators
 */
export const RedFlag = {
  tooLong,
  emptyResponse,
  invalidJson,
  mustMatch,
  mustNotMatch,
  containsPhrase,
  custom
} as const;
