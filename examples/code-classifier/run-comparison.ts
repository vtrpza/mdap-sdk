/**
 * Code Classifier Comparison Runner
 *
 * Runs both the baseline (without MDAP) and MDAP-powered classifiers
 * on the same dataset, compares results, and generates a report.
 *
 * Run with: OPENAI_API_KEY=sk-... npx tsx examples/code-classifier/run-comparison.ts
 */

import * as fs from "fs";
import * as path from "path";
import {
  runWithoutMdap,
  type ClassificationResult as BaselineResult,
} from "./without-mdap.js";
import {
  runWithMdap,
  type ClassificationResult as MdapResult,
} from "./with-mdap.js";
import { snippets } from "./snippets.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("Error: OPENAI_API_KEY environment variable is required");
  process.exit(1);
}

interface ComparisonReport {
  timestamp: string;
  runsPerSnippet: number;
  totalSteps: number;
  baseline: {
    validRate: number;
    accuracyRate: number;
    errorRate: number;
    avgLatencyMs: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    results: BaselineResult[];
  };
  mdap: {
    validRate: number;
    accuracyRate: number;
    errorRate: number;
    avgLatencyMs: number;
    avgSamplesPerStep: number;
    avgFlaggedPerStep: number;
    convergenceRate: number;
    avgConfidence: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    results: MdapResult[];
  };
  improvement: {
    errorReduction: number; // e.g., 0.92 = 92% fewer errors
    accuracyGain: number; // e.g., 0.12 = 12% more accurate
    tokenOverhead: number; // e.g., 2.5 = 2.5x more tokens
  };
  byCategory: Record<
    string,
    {
      baseline: { correct: number; total: number; rate: number };
      mdap: { correct: number; total: number; rate: number };
    }
  >;
}

function calculateStats<T extends BaselineResult | MdapResult>(
  results: T[],
): {
  validRate: number;
  accuracyRate: number;
  errorRate: number;
  avgLatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
} {
  const total = results.length;
  const valid = results.filter((r) => r.valid).length;
  const correct = results.filter((r) => r.correct).length;
  const avgLatencyMs = results.reduce((sum, r) => sum + r.latencyMs, 0) / total;
  const totalInputTokens = results.reduce((sum, r) => sum + r.inputTokens, 0);
  const totalOutputTokens = results.reduce((sum, r) => sum + r.outputTokens, 0);

  return {
    validRate: valid / total,
    accuracyRate: correct / total,
    errorRate: 1 - correct / total,
    avgLatencyMs,
    totalInputTokens,
    totalOutputTokens,
  };
}

function calculateMdapStats(results: MdapResult[]): {
  avgSamplesPerStep: number;
  avgFlaggedPerStep: number;
  convergenceRate: number;
  avgConfidence: number;
} {
  const total = results.length;
  return {
    avgSamplesPerStep:
      results.reduce((sum, r) => sum + r.totalSamples, 0) / total,
    avgFlaggedPerStep:
      results.reduce((sum, r) => sum + r.flaggedSamples, 0) / total,
    convergenceRate: results.filter((r) => r.converged).length / total,
    avgConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / total,
  };
}

function calculateByCategory(
  baselineResults: BaselineResult[],
  mdapResults: MdapResult[],
): ComparisonReport["byCategory"] {
  const categories = ["BUG", "SECURITY", "STYLE", "PERFORMANCE", "NONE"];
  const result: ComparisonReport["byCategory"] = {};

  for (const cat of categories) {
    const baselineForCat = baselineResults.filter((r) => r.expected === cat);
    const mdapForCat = mdapResults.filter((r) => r.expected === cat);

    result[cat] = {
      baseline: {
        correct: baselineForCat.filter((r) => r.correct).length,
        total: baselineForCat.length,
        rate:
          baselineForCat.filter((r) => r.correct).length /
          baselineForCat.length,
      },
      mdap: {
        correct: mdapForCat.filter((r) => r.correct).length,
        total: mdapForCat.length,
        rate: mdapForCat.filter((r) => r.correct).length / mdapForCat.length,
      },
    };
  }

  return result;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function printReport(report: ComparisonReport): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 CODE CLASSIFIER COMPARISON REPORT");
  console.log("=".repeat(60));
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(
    `Total steps: ${report.totalSteps} (${snippets.length} snippets × ${report.runsPerSnippet} runs)`,
  );

  console.log("\n" + "-".repeat(60));
  console.log("OVERALL RESULTS");
  console.log("-".repeat(60));

  console.log(`
                           Baseline (1 call)    MDAP (voting)
Accuracy:                  ${formatPercent(report.baseline.accuracyRate).padEnd(20)} ${formatPercent(report.mdap.accuracyRate)}
Error Rate:                ${formatPercent(report.baseline.errorRate).padEnd(20)} ${formatPercent(report.mdap.errorRate)}
Valid Response Rate:       ${formatPercent(report.baseline.validRate).padEnd(20)} ${formatPercent(report.mdap.validRate)}
Avg Latency:               ${report.baseline.avgLatencyMs.toFixed(0).padEnd(20)} ${report.mdap.avgLatencyMs.toFixed(0)} ms
`);

  console.log("-".repeat(60));
  console.log("MDAP-SPECIFIC STATS");
  console.log("-".repeat(60));
  console.log(`
Avg Samples per Step:      ${report.mdap.avgSamplesPerStep.toFixed(2)}
Avg Flagged per Step:      ${report.mdap.avgFlaggedPerStep.toFixed(2)}
Convergence Rate:          ${formatPercent(report.mdap.convergenceRate)}
Avg Confidence:            ${formatPercent(report.mdap.avgConfidence)}
`);

  console.log("-".repeat(60));
  console.log("IMPROVEMENT SUMMARY");
  console.log("-".repeat(60));
  console.log(`
Error Reduction:           ${formatPercent(report.improvement.errorReduction)} fewer errors
Accuracy Gain:             +${formatPercent(report.improvement.accuracyGain)}
Token Overhead:            ${report.improvement.tokenOverhead.toFixed(2)}x more tokens
`);

  console.log("-".repeat(60));
  console.log("BY CATEGORY");
  console.log("-".repeat(60));
  console.log(`
Category         Baseline Accuracy    MDAP Accuracy    Improvement
────────────────────────────────────────────────────────────────────`);

  for (const [cat, stats] of Object.entries(report.byCategory)) {
    const improvement = stats.mdap.rate - stats.baseline.rate;
    const sign = improvement >= 0 ? "+" : "";
    console.log(
      `${cat.padEnd(16)} ${formatPercent(stats.baseline.rate).padEnd(20)} ${formatPercent(stats.mdap.rate).padEnd(16)} ${sign}${formatPercent(improvement)}`,
    );
  }

  console.log("\n" + "=".repeat(60));
  console.log("KEY TAKEAWAYS");
  console.log("=".repeat(60));

  if (report.improvement.errorReduction > 0.5) {
    console.log(
      `✅ MDAP reduced errors by ${formatPercent(report.improvement.errorReduction)}`,
    );
  }

  if (report.mdap.convergenceRate > 0.95) {
    console.log(
      `✅ High convergence rate (${formatPercent(report.mdap.convergenceRate)}) indicates consistent results`,
    );
  }

  if (report.mdap.avgConfidence > 0.9) {
    console.log(
      `✅ High average confidence (${formatPercent(report.mdap.avgConfidence)}) indicates strong agreement`,
    );
  }

  if (report.improvement.tokenOverhead < 4) {
    console.log(
      `✅ Modest token overhead (${report.improvement.tokenOverhead.toFixed(1)}x) for significant reliability gains`,
    );
  }

  console.log("\n");
}

async function main(): Promise<void> {
  const runsPerSnippet = parseInt(process.env.RUNS_PER_SNIPPET ?? "5", 10);
  const totalSteps = snippets.length * runsPerSnippet;

  console.log("🔬 MDAP Code Classifier Case Study\n");
  console.log(`Configuration:`);
  console.log(`  - ${snippets.length} code snippets`);
  console.log(`  - ${runsPerSnippet} runs per snippet`);
  console.log(`  - ${totalSteps} total classification steps`);
  console.log(`  - Model: gpt-4.1-mini`);
  console.log();

  // Run baseline
  console.log("📋 Running baseline classifier (without MDAP)...");
  const baselineResults = await runWithoutMdap(
    runsPerSnippet,
    (completed, total) => {
      process.stdout.write(`\r  Progress: ${completed}/${total}`);
    },
  );
  console.log("\n  ✓ Baseline complete\n");

  // Run MDAP
  console.log("🛡️ Running MDAP classifier (with voting)...");
  const mdapResults = await runWithMdap(runsPerSnippet, (completed, total) => {
    process.stdout.write(`\r  Progress: ${completed}/${total}`);
  });
  console.log("\n  ✓ MDAP complete\n");

  // Calculate stats
  const baselineStats = calculateStats(baselineResults);
  const mdapStats = calculateStats(mdapResults);
  const mdapSpecificStats = calculateMdapStats(mdapResults);
  const byCategory = calculateByCategory(baselineResults, mdapResults);

  // Calculate improvement
  const errorReduction =
    baselineStats.errorRate > 0
      ? (baselineStats.errorRate - mdapStats.errorRate) /
        baselineStats.errorRate
      : 0;
  const accuracyGain = mdapStats.accuracyRate - baselineStats.accuracyRate;
  const tokenOverhead =
    baselineStats.totalInputTokens + baselineStats.totalOutputTokens > 0
      ? (mdapStats.totalInputTokens + mdapStats.totalOutputTokens) /
        (baselineStats.totalInputTokens + baselineStats.totalOutputTokens)
      : 1;

  // Build report
  const report: ComparisonReport = {
    timestamp: new Date().toISOString(),
    runsPerSnippet,
    totalSteps,
    baseline: {
      ...baselineStats,
      results: baselineResults,
    },
    mdap: {
      ...mdapStats,
      ...mdapSpecificStats,
      results: mdapResults,
    },
    improvement: {
      errorReduction,
      accuracyGain,
      tokenOverhead,
    },
    byCategory,
  };

  // Print report
  printReport(report);

  // Save results to files
  const resultsDir = path.join(import.meta.dirname ?? ".", "results");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(resultsDir, `comparison-${timestamp}.json`);

  // Create a serializable version (remove raw results from main report file)
  const summaryReport = {
    ...report,
    baseline: { ...report.baseline, results: undefined },
    mdap: { ...report.mdap, results: undefined },
  };

  fs.writeFileSync(reportPath, JSON.stringify(summaryReport, null, 2));
  console.log(`📁 Report saved to: ${reportPath}`);

  // Save raw results separately
  const rawResultsPath = path.join(resultsDir, `raw-results-${timestamp}.json`);
  fs.writeFileSync(
    rawResultsPath,
    JSON.stringify(
      {
        baseline: baselineResults,
        mdap: mdapResults,
      },
      null,
      2,
    ),
  );
  console.log(`📁 Raw results saved to: ${rawResultsPath}`);
}

main().catch(console.error);
