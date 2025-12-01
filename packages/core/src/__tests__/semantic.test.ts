import { describe, it, expect } from 'vitest';
import {
  createSimilarityFunction,
  clusterResponses,
  createSemanticSerializer,
  withSemanticDedup,
  SemanticPatterns
} from '../semantic.js';

describe('Semantic Deduplication', () => {
  describe('createSimilarityFunction', () => {
    it('returns 1 for identical strings', () => {
      const similarity = createSimilarityFunction();
      expect(similarity('hello', 'hello')).toBe(1);
    });

    it('returns 1 for case-different strings with ignoreCase', () => {
      const similarity = createSimilarityFunction({ ignoreCase: true });
      expect(similarity('Hello', 'hello')).toBe(1);
    });

    it('returns < 1 for case-different strings without ignoreCase', () => {
      const similarity = createSimilarityFunction({ ignoreCase: false });
      expect(similarity('Hello', 'hello')).toBeLessThan(1);
    });

    it('returns 1 for whitespace-different strings with ignoreWhitespace', () => {
      const similarity = createSimilarityFunction({ ignoreWhitespace: true });
      expect(similarity('hello  world', 'hello world')).toBe(1);
    });

    it('calculates similarity for similar strings', () => {
      const similarity = createSimilarityFunction();
      const score = similarity('hello world', 'hello there');
      expect(score).toBeGreaterThan(0.3);
      expect(score).toBeLessThan(1);
    });

    it('returns low similarity for very different strings', () => {
      const similarity = createSimilarityFunction();
      const score = similarity('apple', 'xyz123');
      expect(score).toBeLessThan(0.5);
    });

    it('uses custom similarity function if provided', () => {
      const customSim = (a: string, b: string) => a === b ? 1 : 0.5;
      const similarity = createSimilarityFunction({ similarity: customSim });
      expect(similarity('a', 'b')).toBe(0.5);
    });

    it('applies custom normalize function', () => {
      const normalize = (s: string) => s.replace(/[0-9]/g, '');
      const similarity = createSimilarityFunction({ normalize });
      expect(similarity('abc123', 'abc456')).toBe(1);
    });
  });

  describe('JSON-aware comparison', () => {
    it('treats JSON with different key order as equivalent', () => {
      const similarity = createSimilarityFunction({ jsonAware: true });
      const a = '{"name": "John", "age": 30}';
      const b = '{"age": 30, "name": "John"}';
      expect(similarity(a, b)).toBe(1);
    });

    it('treats JSON with different whitespace as equivalent', () => {
      const similarity = createSimilarityFunction({ jsonAware: true });
      const a = '{"name":"John"}';
      const b = '{ "name" : "John" }';
      expect(similarity(a, b)).toBe(1);
    });

    it('treats different JSON values as different', () => {
      const similarity = createSimilarityFunction({ jsonAware: true });
      const a = '{"name": "John"}';
      const b = '{"name": "Jane"}';
      expect(similarity(a, b)).toBeLessThan(1);
    });

    it('handles nested JSON', () => {
      const similarity = createSimilarityFunction({ jsonAware: true });
      const a = '{"user": {"name": "John", "id": 1}}';
      const b = '{"user": {"id": 1, "name": "John"}}';
      expect(similarity(a, b)).toBe(1);
    });

    it('handles JSON arrays', () => {
      const similarity = createSimilarityFunction({ jsonAware: true });
      const a = '[1, 2, 3]';
      const b = '[1,2,3]';
      expect(similarity(a, b)).toBe(1);
    });

    it('falls back to string comparison for invalid JSON', () => {
      const similarity = createSimilarityFunction({ jsonAware: true });
      const a = 'not json';
      const b = 'not json';
      expect(similarity(a, b)).toBe(1);
    });
  });

  describe('clusterResponses', () => {
    it('groups identical responses together', () => {
      const responses = ['a', 'b', 'a', 'a', 'b'];
      const clusters = clusterResponses(responses);

      expect(clusters).toHaveLength(2);
      expect(clusters[0].canonical).toBe('a');
      expect(clusters[0].votes).toBe(3);
      expect(clusters[1].canonical).toBe('b');
      expect(clusters[1].votes).toBe(2);
    });

    it('groups similar responses based on threshold', () => {
      const responses = ['hello world', 'hello  world', 'goodbye'];
      const clusters = clusterResponses(responses, { threshold: 0.9 });

      expect(clusters).toHaveLength(2);
      expect(clusters[0].votes).toBe(2); // hello world variants
      expect(clusters[1].votes).toBe(1); // goodbye
    });

    it('keeps all responses separate with exact threshold', () => {
      const responses = ['a', 'A', 'b'];
      const clusters = clusterResponses(responses, {
        threshold: 1.0,
        ignoreCase: false
      });

      expect(clusters).toHaveLength(3);
    });

    it('groups case-insensitively', () => {
      const responses = ['Hello', 'HELLO', 'hello'];
      const clusters = clusterResponses(responses, { ignoreCase: true });

      expect(clusters).toHaveLength(1);
      expect(clusters[0].votes).toBe(3);
    });

    it('returns clusters sorted by vote count', () => {
      const responses = ['rare', 'common', 'common', 'common'];
      const clusters = clusterResponses(responses);

      expect(clusters[0].canonical).toBe('common');
      expect(clusters[0].votes).toBe(3);
    });

    it('stores all members in cluster', () => {
      const responses = ['a', 'a', 'a'];
      const clusters = clusterResponses(responses);

      expect(clusters[0].members).toHaveLength(3);
    });
  });

  describe('createSemanticSerializer', () => {
    it('normalizes strings for serialization', () => {
      const serialize = createSemanticSerializer();
      expect(serialize('Hello  World')).toBe('hello world');
    });

    it('normalizes JSON', () => {
      const serialize = createSemanticSerializer({ jsonAware: true });
      const a = serialize('{"b": 2, "a": 1}');
      const b = serialize('{"a": 1, "b": 2}');
      expect(a).toBe(b);
    });

    it('applies custom normalize function', () => {
      const serialize = createSemanticSerializer({
        normalize: (s) => s.toUpperCase(),
        ignoreCase: false // Disable case normalization to see the custom normalize effect
      });
      expect(serialize('hello')).toBe('HELLO');
    });
  });

  describe('withSemanticDedup', () => {
    it('creates config with semantic serializer', () => {
      const config = withSemanticDedup({}, { jsonAware: true });
      expect(config.serialize).toBeDefined();
    });

    it('preserves base config options', () => {
      const config = withSemanticDedup(
        { vote: { k: 5 }, debug: true },
        { threshold: 0.8 }
      );

      expect(config.vote?.k).toBe(5);
      expect(config.debug).toBe(true);
      expect(config.serialize).toBeDefined();
    });
  });

  describe('SemanticPatterns', () => {
    describe('json', () => {
      it('creates JSON-aware config', () => {
        const config = SemanticPatterns.json();
        expect(config.jsonAware).toBe(true);
        expect(config.threshold).toBe(1.0);
      });
    });

    describe('caseInsensitive', () => {
      it('creates case-insensitive config', () => {
        const config = SemanticPatterns.caseInsensitive();
        expect(config.ignoreCase).toBe(true);
        expect(config.ignoreWhitespace).toBe(true);
      });
    });

    describe('fuzzy', () => {
      it('creates fuzzy matching config with default threshold', () => {
        const config = SemanticPatterns.fuzzy();
        expect(config.threshold).toBe(0.9);
      });

      it('accepts custom threshold', () => {
        const config = SemanticPatterns.fuzzy(0.7);
        expect(config.threshold).toBe(0.7);
      });
    });

    describe('natural', () => {
      it('creates natural language config', () => {
        const config = SemanticPatterns.natural();
        expect(config.threshold).toBe(0.85);
        expect(config.ignoreCase).toBe(true);
      });
    });

    describe('exact', () => {
      it('creates exact matching config', () => {
        const config = SemanticPatterns.exact();
        expect(config.ignoreCase).toBe(false);
        expect(config.ignoreWhitespace).toBe(false);
        expect(config.threshold).toBe(1.0);
      });
    });
  });

  describe('Edge cases', () => {
    it('handles empty strings', () => {
      const similarity = createSimilarityFunction();
      expect(similarity('', '')).toBe(1);
      expect(similarity('a', '')).toBe(0);
      expect(similarity('', 'a')).toBe(0);
    });

    it('handles very long strings', () => {
      const similarity = createSimilarityFunction();
      const longA = 'a'.repeat(1000);
      const longB = 'a'.repeat(1000);
      expect(similarity(longA, longB)).toBe(1);
    });

    it('handles special characters', () => {
      const similarity = createSimilarityFunction();
      expect(similarity('hello! @#$', 'hello! @#$')).toBe(1);
    });

    it('handles unicode', () => {
      const similarity = createSimilarityFunction();
      expect(similarity('héllo wörld', 'héllo wörld')).toBe(1);
    });

    it('handles empty response array', () => {
      const clusters = clusterResponses([]);
      expect(clusters).toHaveLength(0);
    });

    it('handles single response', () => {
      const clusters = clusterResponses(['only one']);
      expect(clusters).toHaveLength(1);
      expect(clusters[0].votes).toBe(1);
    });
  });
});
