/**
 * Voting Benchmarks
 * Measures performance of core voting mechanisms
 */
import { bench, describe } from 'vitest';
import { vote, reliable } from '../voter.js';
import { RedFlag } from '../red-flags.js';

// Mock LLM calls with deterministic responses
const createMockLLM = (responses: string[]) => {
  let idx = 0;
  return async (_input: string) => {
    const response = responses[idx % responses.length];
    idx++;
    return response;
  };
};

// Create responses with varying consensus patterns
const unanimousResponses = Array(100).fill('same response');
const splitResponses = ['response A', 'response B', 'response A', 'response B', 'response A'];
const threeWaySplit = ['A', 'B', 'C', 'A', 'B', 'C', 'A', 'A', 'A'];
const noisyResponses = Array.from({ length: 50 }, (_, i) =>
  i < 35 ? 'consensus' : `noise_${i}`
);

describe('vote() - Consensus Scenarios', () => {
  bench('unanimous responses (k=3)', async () => {
    await vote(createMockLLM(unanimousResponses), 'input', { vote: { k: 3, parallel: false } });
  });

  bench('unanimous responses (k=5)', async () => {
    await vote(createMockLLM(unanimousResponses), 'input', { vote: { k: 5, parallel: false } });
  });

  bench('split vote 60/40 (k=3)', async () => {
    await vote(createMockLLM(splitResponses), 'input', { vote: { k: 3, parallel: false } });
  });

  bench('three-way split converging (k=3)', async () => {
    await vote(createMockLLM(threeWaySplit), 'input', { vote: { k: 3, parallel: false } });
  });

  bench('noisy with 70% consensus (k=3)', async () => {
    await vote(createMockLLM(noisyResponses), 'input', { vote: { k: 3, parallel: false } });
  });
});

describe('vote() - K Value Scaling', () => {
  const responses = unanimousResponses;

  bench('k=1 (minimum)', async () => {
    await vote(createMockLLM(responses), 'input', { vote: { k: 1, parallel: false } });
  });

  bench('k=2', async () => {
    await vote(createMockLLM(responses), 'input', { vote: { k: 2, parallel: false } });
  });

  bench('k=3 (default)', async () => {
    await vote(createMockLLM(responses), 'input', { vote: { k: 3, parallel: false } });
  });

  bench('k=5', async () => {
    await vote(createMockLLM(responses), 'input', { vote: { k: 5, parallel: false } });
  });

  bench('k=10 (high reliability)', async () => {
    await vote(createMockLLM(responses), 'input', { vote: { k: 10, parallel: false } });
  });
});

describe('vote() - Parallel vs Sequential', () => {
  bench('parallel=false (sequential)', async () => {
    await vote(createMockLLM(unanimousResponses), 'input', {
      vote: { k: 3, parallel: false }
    });
  });

  bench('parallel=true (concurrent)', async () => {
    await vote(createMockLLM(unanimousResponses), 'input', {
      vote: { k: 3, parallel: true, initialBatch: 3 }
    });
  });

  bench('parallel with large initial batch', async () => {
    await vote(createMockLLM(unanimousResponses), 'input', {
      vote: { k: 3, parallel: true, initialBatch: 10 }
    });
  });
});

describe('vote() - Voting Strategies', () => {
  bench('first-to-k strategy', async () => {
    await vote(createMockLLM(splitResponses), 'input', {
      vote: { k: 3, strategy: 'first-to-k', parallel: false }
    });
  });

  bench('first-to-ahead-by-k strategy', async () => {
    await vote(createMockLLM(splitResponses), 'input', {
      vote: { k: 3, strategy: 'first-to-ahead-by-k', parallel: false }
    });
  });
});

describe('reliable() - Wrapper Overhead', () => {
  bench('reliable() with no red flags', async () => {
    const fn = reliable<string>({ vote: { k: 3 } })(
      createMockLLM(unanimousResponses)
    );
    await fn('input');
  });

  bench('reliable() with 1 red flag', async () => {
    const fn = reliable<string>({
      vote: { k: 3 },
      redFlags: [RedFlag.tooLong(1000)]
    })(createMockLLM(unanimousResponses));
    await fn('input');
  });

  bench('reliable() with 3 red flags', async () => {
    const fn = reliable<string>({
      vote: { k: 3 },
      redFlags: [
        RedFlag.tooLong(1000),
        RedFlag.emptyResponse(),
        RedFlag.invalidJson()
      ]
    })(createMockLLM(unanimousResponses));
    await fn('input');
  });

  bench('reliable() with 5 red flags', async () => {
    const fn = reliable<string>({
      vote: { k: 3 },
      redFlags: [
        RedFlag.tooLong(1000),
        RedFlag.emptyResponse(),
        RedFlag.invalidJson(),
        RedFlag.mustMatch(/response/),
        RedFlag.mustNotMatch(/error/)
      ]
    })(createMockLLM(unanimousResponses));
    await fn('input');
  });
});

describe('vote() - Serialization', () => {
  const objectResponses = Array(100).fill(null).map(() => ({ key: 'value', count: 42 }));
  const mockObjectLLM = async () => objectResponses[0];

  bench('default JSON serialization', async () => {
    await vote(mockObjectLLM, 'input', { vote: { k: 3, parallel: false } });
  });

  bench('custom fast serialization', async () => {
    await vote(mockObjectLLM, 'input', {
      vote: { k: 3, parallel: false },
      serialize: (obj) => `${obj.key}-${obj.count}`
    });
  });
});
