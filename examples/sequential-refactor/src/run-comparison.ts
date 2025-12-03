/**
 * Sequential Refactoring Comparison Runner
 *
 * Runs both baseline (single LLM call) and MDAP (voting) approaches
 * on a 500-step sequential code refactoring task.
 *
 * Optimized approach: LLM outputs just the replacement, we apply it.
 *
 * Run with: OPENAI_API_KEY=sk-... npx tsx examples/sequential-refactor/src/run-comparison.ts
 */

import * as fs from "fs";
import * as path from "path";
import { executeReliable } from "../../../packages/core/src/index.js";
import type {
  Issue,
  IssuesManifest,
  StepResult,
  ChainResult,
} from "./types.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MAX_STEPS = parseInt(process.env.MAX_STEPS ?? "500", 10);
const START_STEP = parseInt(process.env.START_STEP ?? "1", 10);

if (!OPENAI_API_KEY) {
  console.error("Error: OPENAI_API_KEY environment variable is required");
  process.exit(1);
}

// Load data
const scriptDir =
  import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname);
const dataDir = path.resolve(scriptDir, "..", "data");
const buggyCode = fs.readFileSync(
  path.join(dataDir, "legacy-codebase.ts"),
  "utf-8",
);
const goldenCode = fs.readFileSync(
  path.join(dataDir, "legacy-codebase.golden.ts"),
  "utf-8",
);
const issuesManifest: IssuesManifest = JSON.parse(
  fs.readFileSync(path.join(dataDir, "issues.json"), "utf-8"),
);

/**
 * Build the prompt for a single refactoring step
 * Harder: LLM must analyze and fix, not just copy
 */
function buildPrompt(issue: Issue, stepNum: number): string {
  // Don't show the answer - make the LLM figure it out
  return `You are fixing bug #${stepNum} in a TypeScript codebase.

BUGGY CODE:
\`\`\`
${issue.before}
\`\`\`

ISSUE TYPE: ${issue.category}
PROBLEM: ${issue.description}

Fix this code. Output ONLY the fixed code snippet, nothing else.
No explanations, no markdown code blocks, just the corrected code.

FIXED CODE:`;
}

/**
 * Apply a fix to the code
 */
function applyFix(code: string, issue: Issue, replacement: string): string {
  return code.replace(issue.before, replacement);
}

/**
 * Check if the fix was correctly applied
 */
function isCorrectFix(replacement: string, issue: Issue): boolean {
  // Normalize whitespace for comparison
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  return normalize(replacement) === normalize(issue.after);
}

/**
 * Single LLM call (baseline)
 */
async function callLLM(
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
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 500, // Much smaller - just need the fix
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

/**
 * Run baseline chain (single LLM call per step)
 */
async function runBaseline(
  onProgress?: (step: number, total: number, result: StepResult) => void,
): Promise<ChainResult> {
  const steps: StepResult[] = [];
  let currentCode = buggyCode;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let firstDivergence: number | null = null;
  const startTime = Date.now();

  const issues = issuesManifest.issues.slice(START_STEP - 1, MAX_STEPS);

  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    const stepNum = START_STEP + i;
    const stepStart = Date.now();

    const prompt = buildPrompt(issue, stepNum);

    try {
      const { content, inputTokens, outputTokens } = await callLLM(prompt);
      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;

      // Clean the response
      const replacement = content.trim();
      const isCorrect = isCorrectFix(replacement, issue);

      if (!isCorrect && firstDivergence === null) {
        firstDivergence = stepNum;
      }

      // Apply the fix (even if wrong - to simulate cascade)
      currentCode = applyFix(currentCode, issue, replacement);

      const result: StepResult = {
        step: stepNum,
        issue,
        success: true,
        codeAfter: replacement,
        expectedCode: issue.after,
        matchesExpected: isCorrect,
        latencyMs: Date.now() - stepStart,
      };

      steps.push(result);
      onProgress?.(stepNum, MAX_STEPS, result);
    } catch (error) {
      const result: StepResult = {
        step: stepNum,
        issue,
        success: false,
        codeAfter: "",
        expectedCode: issue.after,
        matchesExpected: false,
        latencyMs: Date.now() - stepStart,
      };
      steps.push(result);
      if (firstDivergence === null) firstDivergence = stepNum;
      onProgress?.(stepNum, MAX_STEPS, result);
    }

    // Small rate limiting delay
    await new Promise((r) => setTimeout(r, 50));
  }

  const stepsMatchingExpected = steps.filter((s) => s.matchesExpected).length;

  // Check final code matches golden
  let goldenMatches = 0;
  let tempCode = buggyCode;
  for (const step of steps) {
    if (step.matchesExpected) {
      tempCode = applyFix(tempCode, step.issue, step.issue.after);
      goldenMatches++;
    }
  }

  return {
    method: "baseline",
    totalSteps: steps.length,
    successfulSteps: steps.filter((s) => s.success).length,
    firstDivergence,
    stepsMatchingExpected,
    finalMatchesGolden: stepsMatchingExpected === steps.length,
    steps,
    totalLatencyMs: Date.now() - startTime,
    totalInputTokens,
    totalOutputTokens,
    estimatedCost:
      (totalInputTokens * 0.4 + totalOutputTokens * 1.6) / 1_000_000,
  };
}

/**
 * Run MDAP chain (voting per step)
 */
async function runMdap(
  onProgress?: (step: number, total: number, result: StepResult) => void,
): Promise<ChainResult> {
  const steps: StepResult[] = [];
  let currentCode = buggyCode;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let firstDivergence: number | null = null;
  const startTime = Date.now();

  const issues = issuesManifest.issues.slice(START_STEP - 1, MAX_STEPS);

  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    const stepNum = START_STEP + i;
    const stepStart = Date.now();

    const prompt = buildPrompt(issue, stepNum);

    try {
      const mdapResult = await executeReliable({
        prompt,
        k: 3,
        maxSamples: 15,
        redFlags: ["emptyResponse", "tooLong:1000"],
        provider: "openai",
        model: "gpt-4.1-mini",
        temperature: 0.1,
        maxTokens: 500,
        apiKey: OPENAI_API_KEY,
      });

      totalInputTokens += mdapResult.usage.inputTokens;
      totalOutputTokens += mdapResult.usage.outputTokens;

      // Clean the response
      const replacement = mdapResult.winner.trim();
      const isCorrect = isCorrectFix(replacement, issue);

      if (!isCorrect && firstDivergence === null) {
        firstDivergence = stepNum;
      }

      // Apply the fix
      currentCode = applyFix(currentCode, issue, replacement);

      const result: StepResult = {
        step: stepNum,
        issue,
        success: true,
        codeAfter: replacement,
        expectedCode: issue.after,
        matchesExpected: isCorrect,
        latencyMs: Date.now() - stepStart,
        totalSamples: mdapResult.totalSamples,
        flaggedSamples: mdapResult.flaggedSamples,
        confidence: mdapResult.confidence,
        converged: mdapResult.converged,
      };

      steps.push(result);
      onProgress?.(stepNum, MAX_STEPS, result);
    } catch (error) {
      const result: StepResult = {
        step: stepNum,
        issue,
        success: false,
        codeAfter: "",
        expectedCode: issue.after,
        matchesExpected: false,
        latencyMs: Date.now() - stepStart,
      };
      steps.push(result);
      if (firstDivergence === null) firstDivergence = stepNum;
      onProgress?.(stepNum, MAX_STEPS, result);
    }

    // Small rate limiting delay
    await new Promise((r) => setTimeout(r, 50));
  }

  const stepsMatchingExpected = steps.filter((s) => s.matchesExpected).length;

  return {
    method: "mdap",
    totalSteps: steps.length,
    successfulSteps: steps.filter((s) => s.success).length,
    firstDivergence,
    stepsMatchingExpected,
    finalMatchesGolden: stepsMatchingExpected === steps.length,
    steps,
    totalLatencyMs: Date.now() - startTime,
    totalInputTokens,
    totalOutputTokens,
    estimatedCost:
      (totalInputTokens * 0.4 + totalOutputTokens * 1.6) / 1_000_000,
  };
}

/**
 * Print results summary
 */
function printResults(baseline: ChainResult, mdap: ChainResult): void {
  console.log("\n" + "=".repeat(70));
  console.log("📊 SEQUENTIAL REFACTORING COMPARISON REPORT");
  console.log("=".repeat(70));

  console.log(`\nConfiguration:`);
  console.log(`  - Total steps: ${baseline.totalSteps}`);
  console.log(`  - Model: gpt-4.1-mini`);
  console.log(`  - MDAP k: 3`);

  console.log("\n" + "-".repeat(70));
  console.log("RESULTS SUMMARY");
  console.log("-".repeat(70));

  const col1 = 30;
  const col2 = 20;
  const col3 = 20;

  console.log(
    `\n${"Metric".padEnd(col1)}${"Baseline".padEnd(col2)}${"MDAP (k=3)".padEnd(col3)}`,
  );
  console.log("-".repeat(70));

  console.log(
    `${"Correct Steps".padEnd(col1)}${String(baseline.stepsMatchingExpected + "/" + baseline.totalSteps).padEnd(col2)}${String(mdap.stepsMatchingExpected + "/" + mdap.totalSteps).padEnd(col3)}`,
  );

  console.log(
    `${"Accuracy".padEnd(col1)}${((baseline.stepsMatchingExpected / baseline.totalSteps) * 100).toFixed(1).padEnd(col2 - 1)}%${((mdap.stepsMatchingExpected / mdap.totalSteps) * 100).toFixed(1).padEnd(col3 - 1)}%`,
  );

  console.log(
    `${"First Error".padEnd(col1)}${(baseline.firstDivergence ? `Step ${baseline.firstDivergence}` : "None").padEnd(col2)}${(mdap.firstDivergence ? `Step ${mdap.firstDivergence}` : "None").padEnd(col3)}`,
  );

  console.log(
    `${"All Correct".padEnd(col1)}${(baseline.finalMatchesGolden ? "Yes" : "No").padEnd(col2)}${(mdap.finalMatchesGolden ? "Yes" : "No").padEnd(col3)}`,
  );

  console.log(
    `${"Total Time".padEnd(col1)}${(baseline.totalLatencyMs / 1000).toFixed(1).padEnd(col2 - 1)}s${(mdap.totalLatencyMs / 1000).toFixed(1).padEnd(col3 - 1)}s`,
  );

  console.log(
    `${"Input Tokens".padEnd(col1)}${baseline.totalInputTokens.toLocaleString().padEnd(col2)}${mdap.totalInputTokens.toLocaleString().padEnd(col3)}`,
  );

  console.log(
    `${"Output Tokens".padEnd(col1)}${baseline.totalOutputTokens.toLocaleString().padEnd(col2)}${mdap.totalOutputTokens.toLocaleString().padEnd(col3)}`,
  );

  console.log(
    `${"Estimated Cost".padEnd(col1)}${"$" + baseline.estimatedCost.toFixed(2).padEnd(col2 - 1)}${"$" + mdap.estimatedCost.toFixed(2).padEnd(col3 - 1)}`,
  );

  // MDAP specific stats
  const mdapStepsWithSamples = mdap.steps.filter((s) => s.totalSamples);
  if (mdapStepsWithSamples.length > 0) {
    const avgSamples =
      mdapStepsWithSamples.reduce((sum, s) => sum + (s.totalSamples ?? 0), 0) /
      mdapStepsWithSamples.length;
    const avgConfidence =
      mdapStepsWithSamples.reduce((sum, s) => sum + (s.confidence ?? 0), 0) /
      mdapStepsWithSamples.length;
    const convergenceRate =
      mdapStepsWithSamples.filter((s) => s.converged).length /
      mdapStepsWithSamples.length;

    console.log("\n" + "-".repeat(70));
    console.log("MDAP STATISTICS");
    console.log("-".repeat(70));
    console.log(`Avg Samples per Step: ${avgSamples.toFixed(2)}`);
    console.log(`Avg Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    console.log(`Convergence Rate: ${(convergenceRate * 100).toFixed(1)}%`);
  }

  // Error analysis
  console.log("\n" + "-".repeat(70));
  console.log("ERROR ANALYSIS");
  console.log("-".repeat(70));

  const baselineErrors = baseline.steps.filter((s) => !s.matchesExpected);
  const mdapErrors = mdap.steps.filter((s) => !s.matchesExpected);

  console.log(`\nBaseline errors: ${baselineErrors.length}`);
  if (baselineErrors.length > 0 && baselineErrors.length <= 10) {
    baselineErrors.forEach((e) => {
      console.log(
        `  Step ${e.step}: Expected "${e.expectedCode.slice(0, 40)}..."`,
      );
      console.log(`           Got "${e.codeAfter.slice(0, 40)}..."`);
    });
  } else if (baselineErrors.length > 10) {
    console.log(`  First 5 errors:`);
    baselineErrors.slice(0, 5).forEach((e) => {
      console.log(
        `  Step ${e.step}: Expected "${e.expectedCode.slice(0, 30)}..." Got "${e.codeAfter.slice(0, 30)}..."`,
      );
    });
  }

  console.log(`\nMDAP errors: ${mdapErrors.length}`);
  if (mdapErrors.length > 0 && mdapErrors.length <= 10) {
    mdapErrors.forEach((e) => {
      console.log(
        `  Step ${e.step}: Expected "${e.expectedCode.slice(0, 40)}..."`,
      );
      console.log(`           Got "${e.codeAfter.slice(0, 40)}..."`);
    });
  } else if (mdapErrors.length > 10) {
    console.log(`  First 5 errors:`);
    mdapErrors.slice(0, 5).forEach((e) => {
      console.log(
        `  Step ${e.step}: Expected "${e.expectedCode.slice(0, 30)}..." Got "${e.codeAfter.slice(0, 30)}..."`,
      );
    });
  }

  // Key takeaways
  console.log("\n" + "=".repeat(70));
  console.log("KEY TAKEAWAYS");
  console.log("=".repeat(70));

  const baselineAcc = baseline.stepsMatchingExpected / baseline.totalSteps;
  const mdapAcc = mdap.stepsMatchingExpected / mdap.totalSteps;
  const improvement = mdapAcc - baselineAcc;

  if (improvement > 0) {
    console.log(
      `✅ MDAP improved accuracy by ${(improvement * 100).toFixed(1)} percentage points`,
    );
    console.log(
      `   (${baselineErrors.length} errors → ${mdapErrors.length} errors)`,
    );
  } else if (improvement < 0) {
    console.log(
      `❌ Baseline outperformed MDAP by ${(-improvement * 100).toFixed(1)} percentage points`,
    );
  } else {
    console.log(`⚖️  Both methods achieved the same accuracy`);
  }

  if (mdap.finalMatchesGolden && !baseline.finalMatchesGolden) {
    console.log(`✅ MDAP achieved 100% accuracy, baseline did not`);
  }

  const costOverhead = mdap.estimatedCost / baseline.estimatedCost;
  console.log(
    `💰 Cost overhead: ${costOverhead.toFixed(1)}x ($${baseline.estimatedCost.toFixed(2)} → $${mdap.estimatedCost.toFixed(2)})`,
  );

  console.log("\n");
}

async function main(): Promise<void> {
  console.log("🔧 MDAP Sequential Refactoring Case Study\n");
  console.log(`Configuration:`);
  console.log(`  - Steps: ${START_STEP} to ${MAX_STEPS}`);
  console.log(`  - Total steps: ${MAX_STEPS - START_STEP + 1}`);
  console.log(`  - Model: gpt-4.1-mini`);
  console.log();

  // Run baseline
  console.log("📋 Running BASELINE (single LLM call per step)...");
  const baselineResult = await runBaseline((step, total, result) => {
    const status = result.matchesExpected ? "✓" : "✗";
    process.stdout.write(`\r  Step ${step}/${total} ${status} `);
  });
  console.log(
    `\n  ✓ Baseline complete (${baselineResult.stepsMatchingExpected}/${baselineResult.totalSteps} correct)\n`,
  );

  // Run MDAP
  console.log("🛡️ Running MDAP (k=3 voting per step)...");
  const mdapResult = await runMdap((step, total, result) => {
    const status = result.matchesExpected ? "✓" : "✗";
    const samples = result.totalSamples ?? 1;
    process.stdout.write(
      `\r  Step ${step}/${total} ${status} (${samples} samples) `,
    );
  });
  console.log(
    `\n  ✓ MDAP complete (${mdapResult.stepsMatchingExpected}/${mdapResult.totalSteps} correct)\n`,
  );

  // Print results
  printResults(baselineResult, mdapResult);

  // Save results
  const resultsDir = path.resolve(scriptDir, "..", "results");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  // Save summary
  const summaryPath = path.join(resultsDir, `comparison-${timestamp}.json`);
  const summary = {
    timestamp: new Date().toISOString(),
    config: {
      maxSteps: MAX_STEPS,
      startStep: START_STEP,
      model: "gpt-4.1-mini",
      k: 3,
    },
    baseline: {
      totalSteps: baselineResult.totalSteps,
      correctSteps: baselineResult.stepsMatchingExpected,
      accuracy:
        baselineResult.stepsMatchingExpected / baselineResult.totalSteps,
      firstError: baselineResult.firstDivergence,
      allCorrect: baselineResult.finalMatchesGolden,
      totalTimeMs: baselineResult.totalLatencyMs,
      inputTokens: baselineResult.totalInputTokens,
      outputTokens: baselineResult.totalOutputTokens,
      cost: baselineResult.estimatedCost,
    },
    mdap: {
      totalSteps: mdapResult.totalSteps,
      correctSteps: mdapResult.stepsMatchingExpected,
      accuracy: mdapResult.stepsMatchingExpected / mdapResult.totalSteps,
      firstError: mdapResult.firstDivergence,
      allCorrect: mdapResult.finalMatchesGolden,
      totalTimeMs: mdapResult.totalLatencyMs,
      inputTokens: mdapResult.totalInputTokens,
      outputTokens: mdapResult.totalOutputTokens,
      cost: mdapResult.estimatedCost,
      avgSamples:
        mdapResult.steps.reduce((sum, s) => sum + (s.totalSamples ?? 0), 0) /
        mdapResult.steps.length,
      avgConfidence:
        mdapResult.steps.reduce((sum, s) => sum + (s.confidence ?? 0), 0) /
        mdapResult.steps.length,
    },
    improvement: {
      accuracyGain:
        (mdapResult.stepsMatchingExpected -
          baselineResult.stepsMatchingExpected) /
        baselineResult.totalSteps,
      errorReduction:
        baselineResult.stepsMatchingExpected < baselineResult.totalSteps
          ? (baselineResult.totalSteps -
              baselineResult.stepsMatchingExpected -
              (mdapResult.totalSteps - mdapResult.stepsMatchingExpected)) /
            (baselineResult.totalSteps - baselineResult.stepsMatchingExpected)
          : 0,
      costOverhead: mdapResult.estimatedCost / baselineResult.estimatedCost,
    },
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`📁 Summary saved to: ${summaryPath}`);

  // Save detailed results
  const detailedPath = path.join(resultsDir, `detailed-${timestamp}.json`);
  fs.writeFileSync(
    detailedPath,
    JSON.stringify(
      {
        baseline: baselineResult,
        mdap: mdapResult,
      },
      null,
      2,
    ),
  );
  console.log(`📁 Detailed results saved to: ${detailedPath}`);
}

main().catch(console.error);
