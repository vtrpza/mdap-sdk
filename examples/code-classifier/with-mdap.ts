/**
 * Code Classifier WITH MDAP
 *
 * MDAP-powered classifier using voting-based error correction.
 * This demonstrates the reliability improvements from the paper's methodology.
 *
 * Run with: OPENAI_API_KEY=sk-... npx tsx examples/code-classifier/with-mdap.ts
 */

import { executeReliable } from "../../packages/core/src/index.js";
import { snippets, CATEGORIES, type CodeSnippet } from "./snippets.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("Error: OPENAI_API_KEY environment variable is required");
  process.exit(1);
}

export interface ClassificationResult {
  snippetId: number;
  run: number;
  expected: string;
  actual: string;
  rawResponse: string;
  valid: boolean;
  correct: boolean;
  latencyMs: number;
  totalSamples: number;
  flaggedSamples: number;
  confidence: number;
  converged: boolean;
  inputTokens: number;
  outputTokens: number;
}

const SYSTEM_PROMPT = `You are a code review assistant. Classify code snippets into exactly one category.

Categories:
- BUG: Logic errors, null pointers, off-by-one errors, unhandled exceptions, type issues
- SECURITY: SQL injection, XSS, hardcoded secrets, path traversal, command injection
- STYLE: Naming conventions, magic numbers, code organization, formatting issues
- PERFORMANCE: Inefficient algorithms, memory leaks, N+1 queries, blocking operations
- NONE: Clean, well-written code with no significant issues

IMPORTANT: Respond with ONLY the category name. No explanations, no punctuation, no additional text.`;

function buildPrompt(code: string): string {
  return `Classify this code:

\`\`\`
${code}
\`\`\`

Category:`;
}

function isValidCategory(response: string): boolean {
  const cleaned = response.trim().toUpperCase();
  return CATEGORIES.includes(cleaned as (typeof CATEGORIES)[number]);
}

function normalizeResponse(response: string): string {
  return response.trim().toUpperCase();
}

export async function classifySnippet(
  snippet: CodeSnippet,
  run: number,
): Promise<ClassificationResult> {
  const prompt = buildPrompt(snippet.code);
  const start = Date.now();

  // Use MDAP's executeReliable for voting-based classification
  const result = await executeReliable({
    prompt,
    system: SYSTEM_PROMPT,
    k: 3, // Paper default - first to lead by 3 wins
    maxSamples: 15, // Reasonable limit for classification
    redFlags: [
      "emptyResponse",
      // Must be one of our categories
      `mustMatch:^(BUG|SECURITY|STYLE|PERFORMANCE|NONE)$`,
    ],
    provider: "openai",
    model: "gpt-4.1-mini",
    temperature: 0.1,
    maxTokens: 50,
    apiKey: OPENAI_API_KEY,
  });

  const latencyMs = Date.now() - start;

  const normalized = normalizeResponse(result.winner);
  const valid = isValidCategory(result.winner);
  const correct = valid && normalized === snippet.expected;

  return {
    snippetId: snippet.id,
    run,
    expected: snippet.expected,
    actual: normalized,
    rawResponse: result.winner,
    valid,
    correct,
    latencyMs,
    totalSamples: result.totalSamples,
    flaggedSamples: result.flaggedSamples,
    confidence: result.confidence,
    converged: result.converged,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
  };
}

export async function runWithMdap(
  runsPerSnippet: number = 5,
  onProgress?: (completed: number, total: number) => void,
): Promise<ClassificationResult[]> {
  const results: ClassificationResult[] = [];
  const total = snippets.length * runsPerSnippet;
  let completed = 0;

  for (const snippet of snippets) {
    for (let run = 0; run < runsPerSnippet; run++) {
      try {
        const result = await classifySnippet(snippet, run);
        results.push(result);
      } catch (error) {
        // Record error as invalid result
        results.push({
          snippetId: snippet.id,
          run,
          expected: snippet.expected,
          actual: "ERROR",
          rawResponse: String(error),
          valid: false,
          correct: false,
          latencyMs: 0,
          totalSamples: 0,
          flaggedSamples: 0,
          confidence: 0,
          converged: false,
          inputTokens: 0,
          outputTokens: 0,
        });
      }

      completed++;
      onProgress?.(completed, total);

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return results;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("🛡️ Running Code Classifier WITH MDAP\n");

  runWithMdap(5, (completed, total) => {
    process.stdout.write(`\rProgress: ${completed}/${total}`);
  }).then((results) => {
    console.log("\n\n📊 Results:\n");

    const valid = results.filter((r) => r.valid).length;
    const correct = results.filter((r) => r.correct).length;
    const converged = results.filter((r) => r.converged).length;
    const total = results.length;

    const avgSamples =
      results.reduce((sum, r) => sum + r.totalSamples, 0) / total;
    const avgFlagged =
      results.reduce((sum, r) => sum + r.flaggedSamples, 0) / total;
    const avgConfidence =
      results.reduce((sum, r) => sum + r.confidence, 0) / total;

    console.log(`Total steps: ${total}`);
    console.log(
      `Valid responses: ${valid} (${((valid / total) * 100).toFixed(1)}%)`,
    );
    console.log(
      `Correct classifications: ${correct} (${((correct / total) * 100).toFixed(1)}%)`,
    );
    console.log(
      `Converged: ${converged} (${((converged / total) * 100).toFixed(1)}%)`,
    );
    console.log(`\nMDAP Stats:`);
    console.log(`  Avg samples per classification: ${avgSamples.toFixed(2)}`);
    console.log(`  Avg flagged per classification: ${avgFlagged.toFixed(2)}`);
    console.log(`  Avg confidence: ${(avgConfidence * 100).toFixed(1)}%`);

    // Show some failure examples
    const failures = results.filter((r) => !r.correct);
    if (failures.length > 0) {
      console.log(`\n❌ Incorrect classifications (${failures.length} total):`);
      failures.slice(0, 5).forEach((f) => {
        console.log(
          `  Snippet #${f.snippetId}: Expected "${f.expected}", got "${f.actual}" (${(f.confidence * 100).toFixed(0)}% confidence)`,
        );
      });
    }
  });
}
