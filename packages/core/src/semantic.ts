/**
 * Semantic Deduplication
 *
 * Detects semantically equivalent responses for better voting accuracy.
 * Instead of exact string matching, groups responses that mean the same thing.
 */

import type { ReliableConfig } from './types.js';

/**
 * A function that determines semantic similarity between two responses
 * Returns a number between 0 (completely different) and 1 (identical/equivalent)
 */
export type SimilarityFunction<T> = (a: T, b: T) => number;

/**
 * A function that normalizes a response before comparison
 */
export type NormalizeFunction<T> = (response: T) => string;

/**
 * Configuration for semantic deduplication
 */
export interface SemanticConfig<T = string> {
  /**
   * Similarity threshold (0-1). Responses above this threshold are considered equivalent.
   * @default 0.9
   */
  threshold?: number;

  /**
   * Custom similarity function. If not provided, uses default text-based similarity.
   */
  similarity?: SimilarityFunction<T>;

  /**
   * Custom normalization function. Applied before similarity comparison.
   */
  normalize?: NormalizeFunction<T>;

  /**
   * Enable JSON-aware comparison for structured data
   * @default false
   */
  jsonAware?: boolean;

  /**
   * Ignore case when comparing strings
   * @default true
   */
  ignoreCase?: boolean;

  /**
   * Ignore whitespace differences
   * @default true
   */
  ignoreWhitespace?: boolean;
}

/**
 * Normalize a string by removing extra whitespace and optionally lowercasing
 */
function normalizeString(s: string, ignoreCase: boolean, ignoreWhitespace: boolean): string {
  let result = s;
  if (ignoreWhitespace) {
    result = result.replace(/\s+/g, ' ').trim();
  }
  if (ignoreCase) {
    result = result.toLowerCase();
  }
  return result;
}

/**
 * Normalize JSON by sorting keys and removing formatting
 */
function normalizeJson(value: unknown): string {
  if (typeof value !== 'object' || value === null) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return '[' + value.map(normalizeJson).join(',') + ']';
  }

  // Sort object keys for consistent comparison
  const keys = Object.keys(value).sort();
  const pairs = keys.map(k => `"${k}":${normalizeJson((value as Record<string, unknown>)[k])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Try to parse and normalize JSON, fallback to string normalization
 */
function tryNormalizeJson(s: string, ignoreCase: boolean): string {
  try {
    const parsed = JSON.parse(s);
    let normalized = normalizeJson(parsed);
    if (ignoreCase) {
      normalized = normalized.toLowerCase();
    }
    return normalized;
  } catch {
    // Not valid JSON, return normalized string
    return normalizeString(s, ignoreCase, true);
  }
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity between two strings (0-1)
 */
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const maxLen = Math.max(a.length, b.length);
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

/**
 * Calculate Jaccard similarity based on word tokens
 */
function tokenSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.toLowerCase().split(/\s+/).filter(t => t.length > 0));
  const tokensB = new Set(b.toLowerCase().split(/\s+/).filter(t => t.length > 0));

  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }

  const union = tokensA.size + tokensB.size - intersection;
  return intersection / union;
}

/**
 * Combined similarity using both character-level and token-level metrics
 */
function combinedSimilarity(a: string, b: string): number {
  const charSim = stringSimilarity(a, b);
  const tokenSim = tokenSimilarity(a, b);
  // Weight token similarity slightly higher as it's more semantic
  return charSim * 0.4 + tokenSim * 0.6;
}

/**
 * Create a semantic similarity function based on configuration
 */
export function createSimilarityFunction<T = string>(
  config: SemanticConfig<T> = {}
): SimilarityFunction<T> {
  const {
    similarity,
    normalize,
    jsonAware = false,
    ignoreCase = true,
    ignoreWhitespace = true
  } = config;

  // Use custom similarity if provided
  if (similarity) {
    return similarity;
  }

  // Create default similarity for strings
  return ((a: T, b: T): number => {
    let strA = String(a);
    let strB = String(b);

    // Apply custom normalization if provided
    if (normalize) {
      strA = normalize(a);
      strB = normalize(b);
    }

    // JSON-aware normalization
    if (jsonAware) {
      strA = tryNormalizeJson(strA, ignoreCase);
      strB = tryNormalizeJson(strB, ignoreCase);
    } else {
      strA = normalizeString(strA, ignoreCase, ignoreWhitespace);
      strB = normalizeString(strB, ignoreCase, ignoreWhitespace);
    }

    // Exact match after normalization
    if (strA === strB) return 1;

    return combinedSimilarity(strA, strB);
  }) as SimilarityFunction<T>;
}

/**
 * Semantic clustering result
 */
export interface SemanticCluster<T> {
  /**
   * The canonical (most common) response in this cluster
   */
  canonical: T;

  /**
   * All responses in this cluster
   */
  members: T[];

  /**
   * Total vote count for this cluster
   */
  votes: number;
}

/**
 * Group responses into semantic clusters
 */
export function clusterResponses<T>(
  responses: T[],
  config: SemanticConfig<T> = {}
): SemanticCluster<T>[] {
  const threshold = config.threshold ?? 0.9;
  const similarity = createSimilarityFunction(config);

  const clusters: SemanticCluster<T>[] = [];

  for (const response of responses) {
    let foundCluster = false;

    for (const cluster of clusters) {
      if (similarity(response, cluster.canonical) >= threshold) {
        cluster.members.push(response);
        cluster.votes++;
        foundCluster = true;
        break;
      }
    }

    if (!foundCluster) {
      clusters.push({
        canonical: response,
        members: [response],
        votes: 1
      });
    }
  }

  // Sort clusters by vote count (descending)
  clusters.sort((a, b) => b.votes - a.votes);

  return clusters;
}

/**
 * Create a semantic serializer for use with reliable()
 *
 * This replaces the default exact-match serialization with semantic grouping,
 * so that semantically equivalent responses are counted as the same vote.
 *
 * @example
 * ```typescript
 * const semanticSerialize = createSemanticSerializer({
 *   threshold: 0.85,
 *   jsonAware: true
 * });
 *
 * const extract = reliable({
 *   vote: { k: 3 },
 *   serialize: semanticSerialize
 * })(myLLMCall);
 * ```
 */
export function createSemanticSerializer<T = string>(
  config: SemanticConfig<T> = {}
): (response: T) => string {
  const {
    jsonAware = false,
    ignoreCase = true,
    ignoreWhitespace = true,
    normalize
  } = config;

  return (response: T): string => {
    let str = String(response);

    if (normalize) {
      str = normalize(response);
    }

    if (jsonAware) {
      str = tryNormalizeJson(str, ignoreCase);
    } else {
      str = normalizeString(str, ignoreCase, ignoreWhitespace);
    }

    return str;
  };
}

/**
 * Create a ReliableConfig with semantic deduplication enabled
 */
export function withSemanticDedup<T = string>(
  baseConfig: ReliableConfig<T> = {},
  semanticConfig: SemanticConfig<T> = {}
): ReliableConfig<T> {
  return {
    ...baseConfig,
    serialize: createSemanticSerializer(semanticConfig) as (response: T) => string
  };
}

/**
 * Common semantic equivalence patterns
 */
export const SemanticPatterns = {
  /**
   * JSON-aware comparison (ignores key order, whitespace)
   */
  json: (): SemanticConfig<string> => ({
    jsonAware: true,
    ignoreCase: false,
    threshold: 1.0 // Exact match after normalization
  }),

  /**
   * Case-insensitive text comparison
   */
  caseInsensitive: (): SemanticConfig<string> => ({
    ignoreCase: true,
    ignoreWhitespace: true,
    threshold: 1.0
  }),

  /**
   * Fuzzy text matching (allows minor differences)
   */
  fuzzy: (threshold = 0.9): SemanticConfig<string> => ({
    ignoreCase: true,
    ignoreWhitespace: true,
    threshold
  }),

  /**
   * Semantic similarity for natural language responses
   */
  natural: (threshold = 0.85): SemanticConfig<string> => ({
    ignoreCase: true,
    ignoreWhitespace: true,
    threshold
  }),

  /**
   * Strict exact matching (default behavior)
   */
  exact: (): SemanticConfig<string> => ({
    ignoreCase: false,
    ignoreWhitespace: false,
    threshold: 1.0
  })
};
