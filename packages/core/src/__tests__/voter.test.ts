import { describe, it, expect, vi } from 'vitest';
import { reliable, vote } from '../voter.js';
import { RedFlag } from '../red-flags.js';

describe('vote', () => {
  it('should return winner when k votes reached with first-to-k strategy', async () => {
    const mockLLM = vi.fn()
      .mockResolvedValue('answer');

    const result = await vote(mockLLM, 'test input', {
      vote: { k: 3, strategy: 'first-to-k' }
    });

    expect(result.winner).toBe('answer');
    expect(result.converged).toBe(true);
    expect(result.confidence).toBe(1);
    expect(mockLLM).toHaveBeenCalledTimes(3);
  });

  it('should handle first-to-ahead-by-k strategy correctly', async () => {
    let callCount = 0;
    const mockLLM = vi.fn().mockImplementation(() => {
      callCount++;
      // First 2 calls return 'A', next 1 returns 'B', then 'A' wins
      return Promise.resolve(callCount <= 2 ? 'A' : callCount === 3 ? 'B' : 'A');
    });

    const result = await vote(mockLLM, 'test input', {
      vote: { k: 3, strategy: 'first-to-ahead-by-k', parallel: false }
    });

    expect(result.winner).toBe('A');
    expect(result.converged).toBe(true);
    // A needs to be 3 ahead of B (which has 1 vote), so A needs 4 votes
  });

  it('should flag and discard responses that trigger red flags', async () => {
    let callCount = 0;
    const mockLLM = vi.fn().mockImplementation(() => {
      callCount++;
      // First 2 responses are too long, then 3 good ones
      if (callCount <= 2) {
        return Promise.resolve('x'.repeat(1000));
      }
      return Promise.resolve('short');
    });

    const result = await vote(mockLLM, 'test input', {
      vote: { k: 3, strategy: 'first-to-k', parallel: false },
      redFlags: [RedFlag.tooLong(100)]
    });

    expect(result.winner).toBe('short');
    expect(result.flaggedSamples).toBe(2);
    expect(result.totalSamples).toBe(5);
  });

  it('should handle empty responses as flags', async () => {
    let callCount = 0;
    const mockLLM = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve('');
      if (callCount === 2) return Promise.resolve('   ');
      return Promise.resolve('valid');
    });

    const result = await vote(mockLLM, 'test input', {
      vote: { k: 3, strategy: 'first-to-k', parallel: false },
      redFlags: [RedFlag.emptyResponse()]
    });

    expect(result.winner).toBe('valid');
    expect(result.flaggedSamples).toBe(2);
  });

  it('should throw when all samples are flagged', async () => {
    const mockLLM = vi.fn().mockResolvedValue('');

    await expect(
      vote(mockLLM, 'test input', {
        vote: { k: 3, maxSamples: 5, parallel: false },
        redFlags: [RedFlag.emptyResponse()]
      })
    ).rejects.toThrow('No valid samples');
  });

  it('should return leader when maxSamples reached without convergence', async () => {
    let callCount = 0;
    const mockLLM = vi.fn().mockImplementation(() => {
      callCount++;
      // Alternate between A and B - never converges
      return Promise.resolve(callCount % 2 === 0 ? 'A' : 'B');
    });

    const result = await vote(mockLLM, 'test input', {
      vote: { k: 10, maxSamples: 6, parallel: false }
    });

    expect(result.converged).toBe(false);
    expect(result.totalSamples).toBe(6);
    expect(['A', 'B']).toContain(result.winner);
  });

  it('should call onSample callback for each valid sample', async () => {
    const mockLLM = vi.fn().mockResolvedValue('answer');
    const onSample = vi.fn();

    await vote(mockLLM, 'test input', {
      vote: { k: 3, parallel: false },
      onSample
    });

    expect(onSample).toHaveBeenCalledTimes(3);
    expect(onSample).toHaveBeenCalledWith('answer', expect.any(Number));
  });

  it('should call onFlag callback for flagged samples', async () => {
    let callCount = 0;
    const mockLLM = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve(callCount === 1 ? '' : 'valid');
    });
    const onFlag = vi.fn();

    await vote(mockLLM, 'test input', {
      vote: { k: 3, parallel: false },
      redFlags: [RedFlag.emptyResponse()],
      onFlag
    });

    expect(onFlag).toHaveBeenCalledTimes(1);
  });
});

describe('reliable', () => {
  it('should create a working wrapper function', async () => {
    const mockLLM = vi.fn().mockResolvedValue('result');

    const reliableFn = reliable({
      vote: { k: 3 }
    })(mockLLM);

    const result = await reliableFn('input');

    expect(result.winner).toBe('result');
    expect(typeof reliableFn).toBe('function');
  });

  it('should pass input to the wrapped function', async () => {
    const mockLLM = vi.fn().mockResolvedValue('output');

    const reliableFn = reliable({ vote: { k: 2 } })(mockLLM);
    await reliableFn('my-input');

    expect(mockLLM).toHaveBeenCalledWith('my-input');
  });

  it('should use custom serializer for vote comparison', async () => {
    let callCount = 0;
    const mockLLM = vi.fn().mockImplementation(() => {
      callCount++;
      // Return objects that serialize to same string
      return Promise.resolve({ value: 42, timestamp: callCount });
    });

    const reliableFn = reliable({
      vote: { k: 3, parallel: false },
      serialize: (obj) => JSON.stringify({ value: (obj as { value: number }).value })
    })(mockLLM);

    const result = await reliableFn('input');

    expect(result.winner).toEqual({ value: 42, timestamp: expect.any(Number) });
    expect(result.confidence).toBe(1);
  });

  it('should work with async functions that return different types', async () => {
    const mockLLM = vi.fn().mockResolvedValue(JSON.stringify({ name: 'test' }));

    const reliableFn = reliable({
      vote: { k: 2 },
      redFlags: [RedFlag.invalidJson()]
    })(mockLLM);

    const result = await reliableFn('parse this');
    expect(JSON.parse(result.winner)).toEqual({ name: 'test' });
  });
});

describe('voting edge cases', () => {
  it('should handle concurrent identical responses in parallel mode', async () => {
    const mockLLM = vi.fn().mockResolvedValue('same');

    const result = await vote(mockLLM, 'input', {
      vote: { k: 3, parallel: true, initialBatch: 5 }
    });

    expect(result.winner).toBe('same');
    expect(result.confidence).toBe(1);
  });

  it('should handle errors in LLM calls gracefully', async () => {
    let callCount = 0;
    const mockLLM = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        return Promise.reject(new Error('API Error'));
      }
      return Promise.resolve('valid');
    });

    const result = await vote(mockLLM, 'input', {
      vote: { k: 3, parallel: false }
    });

    expect(result.winner).toBe('valid');
    expect(result.flaggedSamples).toBe(2); // Errors count as flagged
  });

  it('should calculate confidence correctly with mixed votes', async () => {
    let callCount = 0;
    const mockLLM = vi.fn().mockImplementation(() => {
      callCount++;
      // 3 'A', 1 'B', 1 'C' - A wins with 60% confidence
      const responses = ['A', 'A', 'B', 'A', 'C'];
      return Promise.resolve(responses[callCount - 1] || 'A');
    });

    const result = await vote(mockLLM, 'input', {
      vote: { k: 3, strategy: 'first-to-k', parallel: false }
    });

    expect(result.winner).toBe('A');
    // After 4 calls: A=3, B=1 -> confidence = 3/4 = 0.75
    expect(result.confidence).toBeCloseTo(0.75, 2);
  });
});
