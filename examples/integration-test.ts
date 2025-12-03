/**
 * MDAP SDK Integration Test
 *
 * Run with: OPENAI_API_KEY=your-key npx tsx examples/integration-test.ts
 *
 * This test verifies the SDK works with real OpenAI API calls.
 * Uses rate limiting to respect tier 1 limits (500 RPM).
 */

import {
  reliable,
  vote,
  RedFlag,
  VotePresets,
  estimateCost,
  calculateExpectedSamples,
  calculateSuccessProbability,
} from "../packages/core/src/index.js";
import {
  createOpenAI,
  withRateLimit,
  RateLimitPresets,
} from "../packages/adapters/src/index.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY environment variable is required");
  console.log(
    "\nUsage: OPENAI_API_KEY=your-key npx tsx examples/integration-test.ts",
  );
  process.exit(1);
}

console.log("🚀 MDAP SDK Integration Test\n");

// Create rate-limited OpenAI adapter
const openai = createOpenAI({
  apiKey: OPENAI_API_KEY,
  model: "gpt-4o-mini",
  temperature: 0.3,
});

// Cast to any to avoid type complexity with generics
const rateLimitedOpenAI = withRateLimit(
  openai as any,
  RateLimitPresets.openai_tier1,
);

/**
 * Test 1: Simple vote with string response
 */
async function testSimpleVote() {
  console.log("📊 Test 1: Simple Voting\n");

  const result = await vote(
    async (_input: string) => {
      return await rateLimitedOpenAI.chat(
        "What is 2 + 2? Reply with just the number.",
      );
    },
    "math",
    {
      vote: { k: 2, maxSamples: 10 },
      redFlags: [RedFlag.emptyResponse(), RedFlag.tooLong(50)],
      debug: true,
    },
  );

  console.log("\nResult:");
  console.log(`  Winner: "${result.winner}"`);
  console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
  console.log(`  Total Samples: ${result.totalSamples}`);
  console.log(`  Converged: ${result.converged}`);
  console.log(`  Rate Limiter Stats:`, rateLimitedOpenAI.stats());

  // Verify result
  const isCorrect = result.winner.includes("4");
  console.log(
    `\n${isCorrect ? "✅" : "❌"} Test 1: ${isCorrect ? "PASSED" : "FAILED"}`,
  );

  return isCorrect;
}

/**
 * Test 2: Reliable wrapper with JSON output
 */
async function testReliableJson() {
  console.log("\n📊 Test 2: Reliable Wrapper with JSON\n");

  const extractEntities = reliable<string>({
    vote: VotePresets.fast, // k=2, fast convergence
    redFlags: [
      RedFlag.emptyResponse(),
      RedFlag.invalidJson(),
      RedFlag.tooLong(500),
    ],
    debug: true,
  })(async (text: string) => {
    return await rateLimitedOpenAI.chat(
      `Extract entities from this text and return as JSON array.
       Text: "${text}"
       Return format: ["entity1", "entity2", ...]
       Only return the JSON array, nothing else.`,
    );
  });

  const result = await extractEntities(
    "Apple CEO Tim Cook announced the new iPhone in California.",
  );

  console.log("\nResult:");
  console.log(`  Winner: ${result.winner}`);
  console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
  console.log(`  Total Samples: ${result.totalSamples}`);
  console.log(`  Rate Limiter Stats:`, rateLimitedOpenAI.stats());

  // Verify result is valid JSON with expected entities
  let isCorrect = false;
  try {
    const entities = JSON.parse(result.winner);
    isCorrect = Array.isArray(entities) && entities.length > 0;
    console.log(`  Parsed entities: ${JSON.stringify(entities)}`);
  } catch (e) {
    console.log(`  Failed to parse JSON: ${e}`);
  }

  console.log(
    `\n${isCorrect ? "✅" : "❌"} Test 2: ${isCorrect ? "PASSED" : "FAILED"}`,
  );

  return isCorrect;
}

/**
 * Test 3: Cost estimation
 */
function testCostEstimation() {
  console.log("\n📊 Test 3: Cost Estimation\n");

  const steps = 10;
  const k = 3;
  const successRate = 0.95; // 95% per-step success

  // Use the actual SDK functions
  const expectedSamples = calculateExpectedSamples(k, successRate);
  const successProbability = calculateSuccessProbability(steps, k, successRate);

  // Full cost estimate
  const estimate = estimateCost({
    steps,
    successRate,
    targetReliability: 0.99,
    inputCostPerMillion: 0.15, // gpt-4o-mini
    outputCostPerMillion: 0.6,
    avgInputTokens: 500,
    avgOutputTokens: 200,
  });

  console.log("Cost Estimate for 10-step pipeline:");
  console.log(`  k required: ${estimate.kRequired}`);
  console.log(`  Expected samples per step: ${expectedSamples.toFixed(2)}`);
  console.log(`  Total API calls: ${estimate.apiCalls}`);
  console.log(`  Estimated cost: $${estimate.cost.toFixed(4)}`);
  console.log(
    `  Success probability: ${(successProbability * 100).toFixed(2)}%`,
  );

  const isValid =
    estimate.kRequired >= 1 &&
    estimate.apiCalls > 0 &&
    successProbability > 0.5;

  console.log(
    `\n${isValid ? "✅" : "❌"} Test 3: ${isValid ? "PASSED" : "FAILED"}`,
  );

  return isValid;
}

/**
 * Run all tests
 */
async function runTests() {
  const results: boolean[] = [];

  try {
    // Test cost estimation first (no API calls)
    results.push(testCostEstimation());

    // Test simple voting
    results.push(await testSimpleVote());

    // Test reliable wrapper with JSON
    results.push(await testReliableJson());
  } catch (error) {
    console.error("\n❌ Test failed with error:", error);
    process.exit(1);
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📋 Test Summary\n");

  const passed = results.filter((r) => r).length;
  const total = results.length;

  console.log(`  Passed: ${passed}/${total}`);
  console.log(`  Rate Limiter Final Stats:`, rateLimitedOpenAI.stats());

  if (passed === total) {
    console.log("\n✅ All tests passed!");
    process.exit(0);
  } else {
    console.log(`\n❌ ${total - passed} test(s) failed`);
    process.exit(1);
  }
}

runTests();
