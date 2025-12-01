import { describe, it, expect } from 'vitest';
import {
  RedFlag,
  tooLong,
  emptyResponse,
  invalidJson,
  mustMatch,
  mustNotMatch,
  containsPhrase,
  custom
} from '../red-flags.js';

describe('RedFlag.tooLong', () => {
  it('should flag responses exceeding token limit', () => {
    const rule = RedFlag.tooLong(100);

    expect(rule.check('x'.repeat(500))).toBe(true); // ~125 tokens
    expect(rule.check('x'.repeat(300))).toBe(false); // ~75 tokens
  });

  it('should use chars/4 as token estimate', () => {
    const rule = RedFlag.tooLong(10);

    expect(rule.check('x'.repeat(40))).toBe(false); // exactly 10 tokens
    expect(rule.check('x'.repeat(44))).toBe(true);  // 11 tokens
  });

  it('should have descriptive name', () => {
    const rule = RedFlag.tooLong(100);
    expect(rule.name).toContain('tooLong');
  });
});

describe('RedFlag.emptyResponse', () => {
  it('should flag empty strings', () => {
    const rule = RedFlag.emptyResponse();

    expect(rule.check('')).toBe(true);
  });

  it('should flag whitespace-only strings', () => {
    const rule = RedFlag.emptyResponse();

    expect(rule.check('   ')).toBe(true);
    expect(rule.check('\n\t\r')).toBe(true);
  });

  it('should not flag strings with content', () => {
    const rule = RedFlag.emptyResponse();

    expect(rule.check('hello')).toBe(false);
    expect(rule.check('  hello  ')).toBe(false);
  });

  it('should have correct name', () => {
    const rule = RedFlag.emptyResponse();
    expect(rule.name).toBe('emptyResponse');
  });
});

describe('RedFlag.invalidJson', () => {
  it('should flag invalid JSON', () => {
    const rule = RedFlag.invalidJson();

    expect(rule.check('not json')).toBe(true);
    expect(rule.check('{invalid}')).toBe(true);
    expect(rule.check('{"unclosed": ')).toBe(true);
  });

  it('should not flag valid JSON', () => {
    const rule = RedFlag.invalidJson();

    expect(rule.check('{"key": "value"}')).toBe(false);
    expect(rule.check('[1, 2, 3]')).toBe(false);
    expect(rule.check('null')).toBe(false);
    expect(rule.check('"string"')).toBe(false);
    expect(rule.check('123')).toBe(false);
  });

  it('should handle edge cases', () => {
    const rule = RedFlag.invalidJson();

    expect(rule.check('')).toBe(true);
    expect(rule.check('   ')).toBe(true);
  });

  it('should have correct name', () => {
    const rule = RedFlag.invalidJson();
    expect(rule.name).toBe('invalidJson');
  });
});

describe('RedFlag.mustMatch', () => {
  it('should flag responses that do not match pattern', () => {
    const rule = RedFlag.mustMatch(/^\{.*\}$/s);

    expect(rule.check('plain text')).toBe(true);
    expect(rule.check('[1,2,3]')).toBe(true);
  });

  it('should not flag responses that match pattern', () => {
    const rule = RedFlag.mustMatch(/^\{.*\}$/s);

    expect(rule.check('{"key": "value"}')).toBe(false);
    expect(rule.check('{}')).toBe(false);
  });

  it('should work with complex patterns', () => {
    const rule = RedFlag.mustMatch(/^(async\s+)?function/);

    expect(rule.check('function foo() {}')).toBe(false);
    expect(rule.check('async function bar() {}')).toBe(false);
    expect(rule.check('const x = 1')).toBe(true);
  });

  it('should have descriptive name', () => {
    const rule = RedFlag.mustMatch(/test/);
    expect(rule.name).toContain('mustMatch');
  });
});

describe('RedFlag.mustNotMatch', () => {
  it('should flag responses that match pattern', () => {
    const rule = RedFlag.mustNotMatch(/error|sorry|cannot/i);

    expect(rule.check('I cannot do that')).toBe(true);
    expect(rule.check('Sorry, error occurred')).toBe(true);
  });

  it('should not flag responses that do not match pattern', () => {
    const rule = RedFlag.mustNotMatch(/error|sorry|cannot/i);

    expect(rule.check('Here is the result')).toBe(false);
    expect(rule.check('{"data": 123}')).toBe(false);
  });

  it('should have descriptive name', () => {
    const rule = RedFlag.mustNotMatch(/test/);
    expect(rule.name).toContain('mustNotMatch');
  });
});

describe('RedFlag.containsPhrase', () => {
  it('should flag responses containing any phrase', () => {
    const rule = RedFlag.containsPhrase(['TODO', 'FIXME', '...']);

    expect(rule.check('// TODO: implement this')).toBe(true);
    expect(rule.check('function() { ... }')).toBe(true);
    expect(rule.check('FIXME later')).toBe(true);
  });

  it('should not flag clean responses', () => {
    const rule = RedFlag.containsPhrase(['TODO', 'FIXME']);

    expect(rule.check('function add(a, b) { return a + b; }')).toBe(false);
  });

  it('should match case-insensitively by default', () => {
    const rule = RedFlag.containsPhrase(['TODO']);

    expect(rule.check('TODO')).toBe(true);
    expect(rule.check('todo')).toBe(true); // Implementation is case-insensitive
  });

  it('should have descriptive name', () => {
    const rule = RedFlag.containsPhrase(['test']);
    expect(rule.name).toContain('containsPhrase');
  });
});

describe('RedFlag.custom', () => {
  it('should create custom rule with provided check function', () => {
    const rule = RedFlag.custom('hasBadWord', (response) =>
      response.toLowerCase().includes('bad')
    );

    expect(rule.check('this is bad')).toBe(true);
    expect(rule.check('this is BAD')).toBe(true);
    expect(rule.check('this is good')).toBe(false);
  });

  it('should use provided name', () => {
    const rule = RedFlag.custom('myCustomRule', () => false);
    expect(rule.name).toBe('myCustomRule');
  });

  it('should work with complex logic', () => {
    const rule = RedFlag.custom('tooManyLines', (response) =>
      response.split('\n').length > 5
    );

    expect(rule.check('line1\nline2\nline3')).toBe(false);
    expect(rule.check('1\n2\n3\n4\n5\n6')).toBe(true);
  });
});

describe('standalone functions', () => {
  it('tooLong should work the same as RedFlag.tooLong', () => {
    const rule1 = tooLong(100);
    const rule2 = RedFlag.tooLong(100);

    const testStr = 'x'.repeat(500);
    expect(rule1.check(testStr)).toBe(rule2.check(testStr));
  });

  it('emptyResponse should work the same as RedFlag.emptyResponse', () => {
    const rule1 = emptyResponse();
    const rule2 = RedFlag.emptyResponse();

    expect(rule1.check('')).toBe(rule2.check(''));
    expect(rule1.check('test')).toBe(rule2.check('test'));
  });

  it('invalidJson should work the same as RedFlag.invalidJson', () => {
    const rule1 = invalidJson();
    const rule2 = RedFlag.invalidJson();

    expect(rule1.check('invalid')).toBe(rule2.check('invalid'));
    expect(rule1.check('{"valid": true}')).toBe(rule2.check('{"valid": true}'));
  });

  it('mustMatch should work the same as RedFlag.mustMatch', () => {
    const pattern = /^test/;
    const rule1 = mustMatch(pattern);
    const rule2 = RedFlag.mustMatch(pattern);

    expect(rule1.check('test123')).toBe(rule2.check('test123'));
    expect(rule1.check('no match')).toBe(rule2.check('no match'));
  });

  it('mustNotMatch should work the same as RedFlag.mustNotMatch', () => {
    const pattern = /error/;
    const rule1 = mustNotMatch(pattern);
    const rule2 = RedFlag.mustNotMatch(pattern);

    expect(rule1.check('error here')).toBe(rule2.check('error here'));
    expect(rule1.check('no problem')).toBe(rule2.check('no problem'));
  });

  it('containsPhrase should work the same as RedFlag.containsPhrase', () => {
    const phrases = ['TODO'];
    const rule1 = containsPhrase(phrases);
    const rule2 = RedFlag.containsPhrase(phrases);

    expect(rule1.check('// TODO')).toBe(rule2.check('// TODO'));
    expect(rule1.check('done')).toBe(rule2.check('done'));
  });

  it('custom should work the same as RedFlag.custom', () => {
    const checkFn = (r: string) => r.length > 10;
    const rule1 = custom('test', checkFn);
    const rule2 = RedFlag.custom('test', checkFn);

    expect(rule1.check('short')).toBe(rule2.check('short'));
    expect(rule1.check('this is very long')).toBe(rule2.check('this is very long'));
  });
});
