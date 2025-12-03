/**
 * Code Classifier WITHOUT MDAP
 *
 * Simple LLM classifier - single API call per classification.
 * This demonstrates the baseline approach that most developers use.
 *
 * Run with: OPENAI_API_KEY=sk-... npx tsx examples/code-classifier/without-mdap.ts
 */

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

async function callOpenAI(
  prompt: string,
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 50,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content: data.choices[0]?.message?.content ?? "",
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
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

  const { content, inputTokens, outputTokens } = await callOpenAI(prompt);
  const latencyMs = Date.now() - start;

  const normalized = normalizeResponse(content);
  const valid = isValidCategory(content);
  const correct = valid && normalized === snippet.expected;

  return {
    snippetId: snippet.id,
    run,
    expected: snippet.expected,
    actual: normalized,
    rawResponse: content,
    valid,
    correct,
    latencyMs,
    inputTokens,
    outputTokens,
  };
}

export async function runWithoutMdap(
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
  console.log("🔬 Running Code Classifier WITHOUT MDAP\n");

  runWithoutMdap(5, (completed, total) => {
    process.stdout.write(`\rProgress: ${completed}/${total}`);
  }).then((results) => {
    console.log("\n\n📊 Results:\n");

    const valid = results.filter((r) => r.valid).length;
    const correct = results.filter((r) => r.correct).length;
    const total = results.length;

    console.log(`Total steps: ${total}`);
    console.log(
      `Valid responses: ${valid} (${((valid / total) * 100).toFixed(1)}%)`,
    );
    console.log(
      `Correct classifications: ${correct} (${((correct / total) * 100).toFixed(1)}%)`,
    );

    // Show some failure examples
    const failures = results.filter((r) => !r.valid);
    if (failures.length > 0) {
      console.log(`\n❌ Example failures (${failures.length} total):`);
      failures.slice(0, 5).forEach((f) => {
        console.log(
          `  Snippet #${f.snippetId}: Expected "${f.expected}", got "${f.rawResponse.slice(0, 50)}..."`,
        );
      });
    }
  });
}
