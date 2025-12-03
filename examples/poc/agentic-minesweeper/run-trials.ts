/**
 * Trial Runner for Agentic Minesweeper POC - Optimized Version
 *
 * Runs multiple trials comparing:
 * - gpt-4.1-mini without MDAP (baseline)
 * - gpt-4.1-mini with MDAP (k=3)
 * - gpt-4o without MDAP (expensive baseline)
 *
 * Optimizations:
 * - Parallel trial execution within each config
 * - Uses batched steps (17 batches vs 120 individual steps)
 *
 * Results are saved for analysis and the best outputs are kept for demo.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { runAgent, type AgentConfig, type TrialResult } from "./agent-loop.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TrialConfig {
  name: string;
  model: string;
  useMdap: boolean;
  trials: number;
}

interface ComparisonResult {
  timestamp: string;
  configs: TrialConfig[];
  results: {
    config: string;
    trials: TrialResult[];
    summary: {
      completionRate: number;
      avgSteps: number;
      avgCost: number;
      avgTimeMs: number;
      avgSamples: number;
    };
  }[];
}

// Trial configurations - Updated per user request
const TRIAL_CONFIGS: TrialConfig[] = [
  { name: "mini-baseline", model: "gpt-4.1-mini", useMdap: false, trials: 3 },
  { name: "mini-mdap", model: "gpt-4.1-mini", useMdap: true, trials: 3 },
  { name: "4o-baseline", model: "gpt-4o", useMdap: false, trials: 2 },
];

// Common settings - Updated for batched steps
const COMMON_CONFIG = {
  k: 3,
  temperature: 0.1,
  maxSteps: 17, // 17 batched steps (was 120 individual steps)
};

// Run a single trial - used for parallel execution
async function runSingleTrial(
  config: TrialConfig,
  trialNum: number,
): Promise<TrialResult | null> {
  const trialId = `${config.name}-trial-${trialNum}-${Date.now()}`;

  const agentConfig: AgentConfig = {
    model: config.model,
    useMdap: config.useMdap,
    k: COMMON_CONFIG.k,
    temperature: COMMON_CONFIG.temperature,
    maxSteps: COMMON_CONFIG.maxSteps,
    outputDir: path.join(__dirname, "outputs"),
    trialId,
  };

  try {
    const result = await runAgent(agentConfig);

    // Save individual result
    const resultPath = path.join(__dirname, "results", `${trialId}.json`);
    fs.mkdirSync(path.dirname(resultPath), { recursive: true });
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    console.error(`\n❌ Trial ${trialNum} failed:`, error);
    return null;
  }
}

// Run all trials for a config IN PARALLEL
async function runTrialSet(config: TrialConfig): Promise<TrialResult[]> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Running: ${config.name} (${config.trials} trials IN PARALLEL)`);
  console.log(`Model: ${config.model}, MDAP: ${config.useMdap}`);
  console.log("=".repeat(60));

  // Launch all trials in parallel
  const trialPromises = Array.from({ length: config.trials }, (_, i) =>
    runSingleTrial(config, i + 1),
  );

  const results = await Promise.all(trialPromises);

  // Filter out failed trials
  return results.filter((r): r is TrialResult => r !== null);
}

function calculateSummary(trials: TrialResult[]) {
  if (trials.length === 0) {
    return {
      completionRate: 0,
      avgSteps: 0,
      avgCost: 0,
      avgTimeMs: 0,
      avgSamples: 0,
    };
  }

  const completed = trials.filter((t) => t.completed).length;
  const avgSteps =
    trials.reduce((sum, t) => sum + t.totalSteps, 0) / trials.length;
  const avgCost =
    trials.reduce((sum, t) => sum + t.estimatedCost, 0) / trials.length;
  const avgTimeMs =
    trials.reduce((sum, t) => sum + t.totalTimeMs, 0) / trials.length;
  const avgSamples =
    trials.reduce((sum, t) => {
      const samples = t.steps.reduce((s, step) => s + step.samples, 0);
      return sum + samples / t.steps.length;
    }, 0) / trials.length;

  return {
    completionRate: completed / trials.length,
    avgSteps,
    avgCost,
    avgTimeMs,
    avgSamples,
  };
}

async function main() {
  console.log("🎮 MDAP Agentic Minesweeper POC");
  console.log("================================\n");
  console.log("This experiment compares:");
  console.log("  1. gpt-4.1-mini baseline (no MDAP)");
  console.log("  2. gpt-4.1-mini + MDAP (k=3)");
  console.log("  3. gpt-4o baseline (expensive)");
  console.log(`\nSteps per trial: ${COMMON_CONFIG.maxSteps}`);

  const comparison: ComparisonResult = {
    timestamp: new Date().toISOString(),
    configs: TRIAL_CONFIGS,
    results: [],
  };

  for (const config of TRIAL_CONFIGS) {
    const trials = await runTrialSet(config);
    const summary = calculateSummary(trials);

    comparison.results.push({
      config: config.name,
      trials,
      summary,
    });

    console.log(`\n📊 ${config.name} Summary:`);
    console.log(
      `   Completion Rate: ${(summary.completionRate * 100).toFixed(0)}%`,
    );
    console.log(`   Avg Steps: ${summary.avgSteps.toFixed(0)}`);
    console.log(`   Avg Cost: $${summary.avgCost.toFixed(4)}`);
    console.log(`   Avg Time: ${(summary.avgTimeMs / 1000).toFixed(1)}s`);
    if (config.useMdap) {
      console.log(`   Avg Samples/Step: ${summary.avgSamples.toFixed(2)}`);
    }
  }

  // Save comparison results
  const comparisonPath = path.join(
    __dirname,
    "results",
    `comparison-${Date.now()}.json`,
  );
  fs.writeFileSync(comparisonPath, JSON.stringify(comparison, null, 2));
  console.log(`\n📁 Full comparison saved to: ${comparisonPath}`);

  // Print final comparison
  console.log("\n" + "=".repeat(60));
  console.log("FINAL COMPARISON");
  console.log("=".repeat(60));

  console.log("\n| Config | Completion | Avg Cost | Avg Time |");
  console.log("|--------|------------|----------|----------|");

  for (const result of comparison.results) {
    const s = result.summary;
    console.log(
      `| ${result.config.padEnd(14)} | ${(s.completionRate * 100).toFixed(0).padStart(9)}% | $${s.avgCost.toFixed(4).padStart(7)} | ${(s.avgTimeMs / 1000).toFixed(1).padStart(7)}s |`,
    );
  }

  // Find best output per config (most steps completed)
  console.log("\n📂 Best outputs saved:");
  for (const result of comparison.results) {
    if (result.trials.length === 0) continue;
    const best = result.trials.reduce((a, b) =>
      a.totalSteps > b.totalSteps ? a : b,
    );
    console.log(
      `   ${result.config}: ${best.config.trialId} (${best.totalSteps} steps)`,
    );
  }
}

// Run
main().catch(console.error);
