/**
 * Basic MDAP Example
 *
 * Run with: npx tsx examples/basic.ts
 */

import { reliable, RedFlag, estimateCost, formatCostEstimate } from '../packages/core/src/index.js';
import { createOpenAI } from '../packages/adapters/src/openai.js';

// Create OpenAI adapter
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4.1-mini',
  temperature: 0.1
});

// Example 1: Simple entity extraction with reliability
const extractEntities = reliable({
  vote: { k: 3 },
  redFlags: [
    RedFlag.tooLong(500),
    RedFlag.invalidJson(),
    RedFlag.emptyResponse()
  ],
  debug: true  // Enable debug logging
})(async (text: string) => {
  return await openai.chat(
    `Extract named entities from this text as a JSON array. Only output valid JSON, nothing else.

Text: ${text}`,
    { system: 'You are a precise entity extractor. Respond only with a JSON array of entity objects.' }
  );
});

// Example 2: Code generation with higher k
const _generateFunction = reliable({
  vote: { k: 5 },  // Higher threshold for code
  redFlags: [
    RedFlag.emptyResponse(),
    RedFlag.containsPhrase(['TODO', 'FIXME', '// ...']),
    RedFlag.mustMatch(/^(async\s+)?function|^const\s+\w+\s*=/m)  // Must look like a function
  ]
})(async (spec: string) => {
  return await openai.chat(
    `Write a TypeScript function that: ${spec}

Only output the code, no explanations.`,
    { system: 'You are a precise code generator. Output only valid TypeScript code.' }
  );
});

async function main() {
  console.log('=== MDAP SDK Examples ===\n');

  // Cost estimation first
  console.log('📊 Cost Estimation for 10,000 steps:');
  const estimate = estimateCost({
    steps: 10000,
    successRate: 0.99,
    targetReliability: 0.95,
    inputCostPerMillion: 0.5,
    outputCostPerMillion: 1.5,
    avgInputTokens: 300,
    avgOutputTokens: 200
  });
  console.log(formatCostEstimate(estimate));
  console.log();

  // Run entity extraction
  console.log('🔍 Entity Extraction Example:');
  console.log('Input: "Apple Inc. was founded by Steve Jobs in Cupertino, California."');
  console.log();

  try {
    const result = await extractEntities(
      "Apple Inc. was founded by Steve Jobs in Cupertino, California."
    );

    console.log('Result:');
    console.log(`  Winner: ${result.winner}`);
    console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`  Total Samples: ${result.totalSamples}`);
    console.log(`  Flagged Samples: ${result.flaggedSamples}`);
    console.log(`  Converged: ${result.converged}`);
  } catch (error) {
    console.log('(Skipped - no API key or error)', error);
  }

  console.log();
  console.log('✅ Examples complete!');
}

main().catch(console.error);
