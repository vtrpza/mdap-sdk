/**
 * MDAP Workflow Example
 *
 * Demonstrates how to chain multiple reliable steps together
 * using the workflow orchestration API.
 *
 * Run with: npx tsx examples/workflow.ts
 */

import {
  workflow,
  pipeline,
  parallel,
  decompose,
  RedFlag
} from '../packages/core/dist/index.js';

// Mock LLM call - in real usage this would call your actual LLM
async function mockLLM(prompt: string): Promise<string> {
  // Simulate some randomness to show voting in action
  await new Promise(resolve => setTimeout(resolve, 10));

  if (prompt.includes('extract entities')) {
    return JSON.stringify({
      people: ['John Doe', 'Jane Smith'],
      organizations: ['Acme Corp'],
      locations: ['New York']
    });
  }

  if (prompt.includes('summarize')) {
    return 'This document discusses business relationships between individuals and organizations in New York.';
  }

  if (prompt.includes('sentiment')) {
    return 'neutral';
  }

  if (prompt.includes('decompose')) {
    return JSON.stringify(['task 1', 'task 2', 'task 3']);
  }

  return 'Unknown request';
}

async function main() {
  console.log('MDAP Workflow Examples\n');
  console.log('='.repeat(50));

  // Example 1: Simple workflow with chained steps
  console.log('\n1. Simple Workflow (Extract -> Summarize)\n');

  const analysisWorkflow = workflow<string>('document-analysis', {
    vote: { k: 2 },
    redFlags: [RedFlag.emptyResponse()]
  })
    .step('extract', async (text: string) => {
      return mockLLM(`extract entities from: ${text}`);
    })
    .step('summarize', async (entities: string) => {
      return mockLLM(`summarize: ${entities}`);
    });

  const result1 = await analysisWorkflow.run('John Doe from Acme Corp met Jane Smith in New York.');

  console.log('Final output:', result1.output);
  console.log('Total samples:', result1.totalSamples);
  console.log('Time taken:', result1.totalTimeMs, 'ms');
  console.log('Steps completed:');
  for (const step of result1.steps) {
    console.log(`  - ${step.name}: ${step.timeMs}ms (${step.result?.confidence?.toFixed(2) ?? 'N/A'} confidence)`);
  }

  // Example 2: Parallel execution
  console.log('\n' + '='.repeat(50));
  console.log('\n2. Parallel Execution (Multiple analyses at once)\n');

  const result2 = await parallel({
    entities: () => mockLLM('extract entities from: Sample document'),
    sentiment: () => mockLLM('sentiment analysis: Sample document'),
    summary: () => mockLLM('summarize: Sample document')
  }, {
    vote: { k: 2 }
  });

  console.log('Parallel results:');
  console.log('  Entities:', result2.entities.winner.substring(0, 50) + '...');
  console.log('  Sentiment:', result2.sentiment.winner);
  console.log('  Summary:', result2.summary.winner.substring(0, 50) + '...');

  // Example 3: Pipeline (simpler API for linear workflows)
  console.log('\n' + '='.repeat(50));
  console.log('\n3. Pipeline (Linear chain of operations)\n');

  const myPipeline = pipeline<string, string>([
    {
      name: 'extract',
      fn: async (input) => mockLLM(`extract entities from: ${input}`)
    },
    {
      name: 'analyze',
      fn: async (entities) => mockLLM(`sentiment analysis: ${entities}`)
    }
  ], {
    vote: { k: 2 }
  });

  const result3 = await myPipeline('Sample input text');
  console.log('Pipeline output:', result3.output);
  console.log('Success:', result3.success);

  // Example 4: Workflow with conditional branching
  console.log('\n' + '='.repeat(50));
  console.log('\n4. Conditional Branching\n');

  const conditionalWorkflow = workflow<{ text: string; needsDetail: boolean }>('conditional-analysis')
    .step('preprocess', async (input) => {
      return JSON.stringify({ text: input.text.toUpperCase(), needsDetail: input.needsDetail });
    })
    .branch(
      'analyze',
      (input) => {
        const data = JSON.parse(input);
        return data.needsDetail;
      },
      async (input) => mockLLM(`detailed analysis: ${input}`),
      async (input) => mockLLM(`quick summary: ${input}`)
    );

  const result4 = await conditionalWorkflow.run({ text: 'test input', needsDetail: true });
  console.log('Conditional result:', result4.output);

  // Example 5: Decompose pattern (split, execute in parallel, aggregate)
  console.log('\n' + '='.repeat(50));
  console.log('\n5. Decompose Pattern (MAKER methodology)\n');

  const result5 = await decompose<string, string, string>(
    'Large document to process',
    // Decomposer: split into subtasks
    async (input) => {
      const response = await mockLLM(`decompose task: ${input}`);
      return JSON.parse(response);
    },
    // Executor: process each subtask
    async (subtask) => mockLLM(`process: ${subtask}`),
    // Aggregator: combine results
    (results) => {
      return results.map(r => r.winner).join(' | ');
    },
    { vote: { k: 2 } }
  );

  console.log('Decomposed result:', result5.output);
  console.log('Total samples across all subtasks:', result5.totalSamples);
  console.log('Steps:');
  for (const step of result5.steps) {
    console.log(`  - ${step.name}: ${step.timeMs}ms`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('\nAll examples completed!');
}

main().catch(console.error);
