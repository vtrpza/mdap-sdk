/**
 * Red Flag Benchmarks
 * Measures performance of response validation rules
 */
import { bench, describe } from 'vitest';
import { RedFlag } from '../red-flags.js';

// Test data
const shortResponse = 'OK';
const mediumResponse = 'This is a medium length response with some content.';
const longResponse = 'x'.repeat(5000);
const jsonResponse = JSON.stringify({ name: 'test', value: 42, nested: { a: 1, b: 2 } });
const invalidJsonResponse = '{ invalid json }';
const responseWithPhrases = 'I am not sure about this. Let me think... Actually, I cannot help with that.';

describe('RedFlag.tooLong - Token Length Check', () => {
  const rule100 = RedFlag.tooLong(100);
  const rule500 = RedFlag.tooLong(500);
  const rule1000 = RedFlag.tooLong(1000);

  bench('check short response (< threshold)', () => {
    rule100.check(shortResponse);
  });

  bench('check medium response (near threshold)', () => {
    rule100.check(mediumResponse);
  });

  bench('check long response (5000 chars)', () => {
    rule1000.check(longResponse);
  });

  bench('threshold 100 tokens', () => {
    rule100.check(mediumResponse);
  });

  bench('threshold 500 tokens', () => {
    rule500.check(mediumResponse);
  });

  bench('threshold 1000 tokens', () => {
    rule1000.check(mediumResponse);
  });
});

describe('RedFlag.emptyResponse', () => {
  const rule = RedFlag.emptyResponse();

  bench('check non-empty response', () => {
    rule.check(mediumResponse);
  });

  bench('check empty string', () => {
    rule.check('');
  });

  bench('check whitespace only', () => {
    rule.check('   \n\t  ');
  });
});

describe('RedFlag.invalidJson', () => {
  const rule = RedFlag.invalidJson();

  bench('check valid JSON', () => {
    rule.check(jsonResponse);
  });

  bench('check invalid JSON', () => {
    rule.check(invalidJsonResponse);
  });

  bench('check non-JSON text', () => {
    rule.check(mediumResponse);
  });

  bench('check large valid JSON', () => {
    const largeJson = JSON.stringify(Array.from({ length: 100 }, (_, i) => ({ id: i, value: `item_${i}` })));
    rule.check(largeJson);
  });
});

describe('RedFlag.mustMatch - Regex Matching', () => {
  const simpleRule = RedFlag.mustMatch(/OK/);
  const complexRule = RedFlag.mustMatch(/\b\d{4}-\d{2}-\d{2}\b/); // Date pattern
  const globalRule = RedFlag.mustMatch(/test/gi);

  bench('simple pattern match (success)', () => {
    simpleRule.check('Response: OK');
  });

  bench('simple pattern match (failure)', () => {
    simpleRule.check('Response: Error');
  });

  bench('complex date pattern', () => {
    complexRule.check('Date: 2024-01-15');
  });

  bench('global case-insensitive pattern', () => {
    globalRule.check('Test TEST test');
  });
});

describe('RedFlag.mustNotMatch - Negative Regex', () => {
  const errorRule = RedFlag.mustNotMatch(/error|fail|exception/i);
  const profanityRule = RedFlag.mustNotMatch(/\b(bad|wrong|awful)\b/i);

  bench('check clean response', () => {
    errorRule.check(mediumResponse);
  });

  bench('check response with error keyword', () => {
    errorRule.check('An error occurred during processing');
  });

  bench('word boundary matching', () => {
    profanityRule.check('This is a bad response');
  });
});

describe('RedFlag.containsPhrase - Phrase Detection', () => {
  const singlePhrase = RedFlag.containsPhrase(['I cannot']);
  const multiplePhrases = RedFlag.containsPhrase([
    'I am not sure',
    'Let me think',
    'I cannot help',
    'I do not know',
    'Perhaps maybe'
  ]);
  const manyPhrases = RedFlag.containsPhrase(
    Array.from({ length: 20 }, (_, i) => `phrase_${i}`)
  );

  bench('single phrase check (found)', () => {
    singlePhrase.check(responseWithPhrases);
  });

  bench('single phrase check (not found)', () => {
    singlePhrase.check(mediumResponse);
  });

  bench('5 phrases check', () => {
    multiplePhrases.check(responseWithPhrases);
  });

  bench('20 phrases check', () => {
    manyPhrases.check(mediumResponse);
  });
});

describe('RedFlag.custom - Custom Rules', () => {
  const simpleCustom = RedFlag.custom<string>('lengthCheck', (r) => r.length > 100);
  const complexCustom = RedFlag.custom<string>('wordCount', (r) => r.split(/\s+/).length > 50);
  const regexCustom = RedFlag.custom<string>('noNumbers', (r) => !/\d/.test(r));

  bench('simple length check', () => {
    simpleCustom.check(mediumResponse);
  });

  bench('word count check', () => {
    complexCustom.check(longResponse);
  });

  bench('regex-based custom check', () => {
    regexCustom.check(mediumResponse);
  });
});

describe('Combined Red Flags - Real World Scenarios', () => {
  const productionRules = [
    RedFlag.tooLong(750),
    RedFlag.emptyResponse(),
    RedFlag.invalidJson(),
    RedFlag.containsPhrase(['I cannot', 'I am unable', 'error'])
  ];

  const checkAll = (response: string) => {
    for (const rule of productionRules) {
      if (rule.check(response)) return true;
    }
    return false;
  };

  bench('4 rules - valid response', () => {
    checkAll(jsonResponse);
  });

  bench('4 rules - flagged response', () => {
    checkAll(responseWithPhrases);
  });

  bench('4 rules - long response', () => {
    checkAll(longResponse);
  });
});
