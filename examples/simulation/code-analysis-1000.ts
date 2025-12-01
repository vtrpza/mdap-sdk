#!/usr/bin/env npx tsx
/**
 * MDAP Live Simulation: 1000-Step Code Analysis Chain
 *
 * Demonstrates MDAP's voting-based error correction with real LLM API calls.
 * Runs 1000 iterations of a 3-step code analysis pipeline using OpenAI gpt-4o-mini.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... npx tsx examples/simulation/code-analysis-1000.ts
 *
 * Options:
 *   --steps N       Number of iterations (default: 1000)
 *   --k N           Voting k value (default: 3)
 *   --dry-run       Test without API calls
 *   --max-cost N    Stop if cost exceeds $N (default: 5)
 *   --resume FILE   Resume from checkpoint
 */

import { reliable, RedFlag, estimateCost, formatCostEstimate } from '../../packages/core/src/index.js';
import { createOpenAI } from '../../packages/adapters/src/index.js';
import { getSnippet, totalSnippets } from './code-snippets.js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Configuration
// ============================================================================

interface Config {
  steps: number;
  k: number;
  model: string;
  dryRun: boolean;
  maxCost: number;
  resumeFile?: string;
  delayMs: number;
  checkpointInterval: number;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    steps: 1000,
    k: 3,
    model: 'gpt-4o-mini',
    dryRun: false,
    maxCost: 5,
    delayMs: 50, // Small delay between steps to avoid rate limits
    checkpointInterval: 100,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--steps':
        config.steps = parseInt(args[++i], 10);
        break;
      case '--k':
        config.k = parseInt(args[++i], 10);
        break;
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--max-cost':
        config.maxCost = parseFloat(args[++i]);
        break;
      case '--resume':
        config.resumeFile = args[++i];
        break;
      case '--delay':
        config.delayMs = parseInt(args[++i], 10);
        break;
    }
  }

  return config;
}

// ============================================================================
// Metrics Tracking
// ============================================================================

interface StepMetrics {
  iteration: number;
  snippetName: string;
  identify: { samples: number; flagged: number; confidence: number; converged: boolean; timeMs: number };
  classify: { samples: number; flagged: number; confidence: number; converged: boolean; timeMs: number };
  suggest: { samples: number; flagged: number; confidence: number; converged: boolean; timeMs: number };
  totalTimeMs: number;
  success: boolean;
  error?: string;
}

interface SimulationState {
  config: Config;
  startTime: number;
  metrics: StepMetrics[];
  totalSamples: number;
  totalFlagged: number;
  totalSuccesses: number;
  totalFailures: number;
  estimatedCost: number;
  currentIteration: number;
}

function createInitialState(config: Config): SimulationState {
  return {
    config,
    startTime: Date.now(),
    metrics: [],
    totalSamples: 0,
    totalFlagged: 0,
    totalSuccesses: 0,
    totalFailures: 0,
    estimatedCost: 0,
    currentIteration: 0,
  };
}

// ============================================================================
// OpenAI Setup
// ============================================================================

function createLLM(config: Config) {
  if (config.dryRun) {
    // Mock LLM for dry runs
    return {
      chat: async (prompt: string) => {
        await new Promise(r => setTimeout(r, 10)); // Simulate latency
        if (prompt.includes('Classify issues')) {
          const categories = ['NULL_SAFETY', 'ERROR_HANDLING', 'TYPE_SAFETY', 'SECURITY', 'PERFORMANCE', 'NONE'];
          return JSON.stringify({ categories: [categories[Math.floor(Math.random() * 3)]] });
        } else if (prompt.includes('severity')) {
          return JSON.stringify({ severity: 'medium' });
        } else if (prompt.includes('fix type')) {
          const fixes = ['ADD_NULL_CHECK', 'ADD_ERROR_HANDLING', 'VALIDATE_INPUT', 'NO_FIX_NEEDED'];
          return JSON.stringify({ fix: fixes[Math.floor(Math.random() * fixes.length)] });
        } else {
          return JSON.stringify({ fix: 'ADD_NULL_CHECK' });
        }
      }
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable not set');
    console.error('Usage: OPENAI_API_KEY=sk-... npx tsx examples/simulation/code-analysis-1000.ts');
    process.exit(1);
  }

  return createOpenAI({
    apiKey,
    model: config.model,
    temperature: 0.1, // Low temperature for consistent output
    maxTokens: 150,   // Shorter responses = more consistent
  });
}

// ============================================================================
// Analysis Pipeline Steps
// ============================================================================

function createAnalysisPipeline(llm: ReturnType<typeof createLLM>, k: number) {
  // JSON validation helper
  const isValidJson = (str: string): boolean => {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  };

  const baseRedFlags = [
    RedFlag.tooLong(200),
    RedFlag.emptyResponse(),
    RedFlag.containsPhrase(['I cannot', 'I am unable', 'I do not have', 'sorry']),
  ];

  const jsonRedFlags = [
    ...baseRedFlags,
    RedFlag.custom<string>('invalidJson', (r) => !isValidJson(r)),
  ];

  // Step 1: Classify Issues (constrained categories for better convergence)
  // maxSamples: 15 for fail-fast - if no consensus in 15, unlikely to converge
  const identifyIssues = reliable<string>({
    vote: { k, strategy: 'first-to-ahead-by-k', parallel: false, maxSamples: 15 },
    redFlags: jsonRedFlags,
  })(async (code: string) => {
    return await llm.chat(
      `Classify issues in this TypeScript code.
Pick categories from: NULL_SAFETY, ERROR_HANDLING, TYPE_SAFETY, SECURITY, PERFORMANCE, NONE
Respond ONLY with JSON: {"categories":["CATEGORY"]}

Code:
${code}`,
      { system: 'Respond with exactly one JSON object. No explanation.' }
    );
  });

  // Step 2: Classify Severity (single word for better convergence)
  // maxSamples: 10 - severity is simple, should converge quickly
  const classifySeverity = reliable<string>({
    vote: { k, strategy: 'first-to-ahead-by-k', parallel: false, maxSamples: 10 },
    redFlags: jsonRedFlags,
  })(async (issuesJson: string) => {
    return await llm.chat(
      `Rate severity of these issues.
Options: critical, high, medium, low, none
Respond ONLY with JSON: {"severity":"WORD"}

Issues: ${issuesJson}`,
      { system: 'Respond with exactly one JSON object. No explanation.' }
    );
  });

  // Step 3: Suggest Fix Type (constrained categories for production convergence)
  const suggestFix = reliable<string>({
    vote: { k, strategy: 'first-to-ahead-by-k', parallel: false, maxSamples: 15 },
    redFlags: jsonRedFlags,
  })(async (context: string) => {
    return await llm.chat(
      `What fix type is needed?
Pick ONE from: ADD_NULL_CHECK, ADD_ERROR_HANDLING, ADD_TYPE_ANNOTATION, VALIDATE_INPUT, USE_SAFE_METHOD, IMPROVE_PERFORMANCE, NO_FIX_NEEDED
Respond ONLY with JSON: {"fix":"FIX_TYPE"}

${context}`,
      { system: 'Respond with exactly one JSON object. No explanation.' }
    );
  });

  return { identifyIssues, classifySeverity, suggestFix };
}

// ============================================================================
// Progress Display
// ============================================================================

function clearLine() {
  process.stdout.write('\r\x1b[K');
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

function printProgress(state: SimulationState, current: StepMetrics | null) {
  const { config, metrics, totalSamples, totalSuccesses, totalFailures, estimatedCost, startTime } = state;
  const elapsed = Date.now() - startTime;
  const avgTimePerStep = metrics.length > 0 ? elapsed / metrics.length : 0;
  const remaining = (config.steps - metrics.length) * avgTimePerStep;

  clearLine();

  if (current) {
    const stepSymbol = current.success ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    console.log(`[${current.iteration}/${config.steps}] ${stepSymbol} ${current.snippetName}`);
    console.log(`  ├─ identify:  ${current.identify.converged ? '✓' : '○'} (${current.identify.samples} samples, ${(current.identify.confidence * 100).toFixed(0)}%)`);
    console.log(`  ├─ classify:  ${current.classify.converged ? '✓' : '○'} (${current.classify.samples} samples, ${(current.classify.confidence * 100).toFixed(0)}%)`);
    console.log(`  └─ suggest:   ${current.suggest.converged ? '✓' : '○'} (${current.suggest.samples} samples, ${(current.suggest.confidence * 100).toFixed(0)}%)`);
    console.log(`  Time: ${formatTime(current.totalTimeMs)} | Avg: ${formatTime(avgTimePerStep)}/step | ETA: ${formatTime(remaining)}`);
  }

  // Summary line
  const successRate = metrics.length > 0 ? (totalSuccesses / metrics.length * 100).toFixed(1) : '0.0';
  process.stdout.write(`Progress: ${metrics.length}/${config.steps} | Success: ${successRate}% | Samples: ${totalSamples} | Cost: $${estimatedCost.toFixed(3)}`);
}

// ============================================================================
// Checkpointing
// ============================================================================

function saveCheckpoint(state: SimulationState) {
  const checkpointDir = path.join(import.meta.dirname || '.', 'results');
  fs.mkdirSync(checkpointDir, { recursive: true });

  const checkpointFile = path.join(checkpointDir, `checkpoint-${state.startTime}.json`);
  fs.writeFileSync(checkpointFile, JSON.stringify(state, null, 2));
  return checkpointFile;
}

function loadCheckpoint(file: string): SimulationState | null {
  try {
    const data = fs.readFileSync(file, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// ============================================================================
// Cost Estimation
// ============================================================================

const COST_PER_1K_INPUT = 0.00015;  // gpt-4o-mini input
const COST_PER_1K_OUTPUT = 0.0006; // gpt-4o-mini output
const AVG_INPUT_TOKENS = 200;
const AVG_OUTPUT_TOKENS = 50;

function estimateStepCost(samples: number): number {
  const inputCost = (samples * AVG_INPUT_TOKENS / 1000) * COST_PER_1K_INPUT;
  const outputCost = (samples * AVG_OUTPUT_TOKENS / 1000) * COST_PER_1K_OUTPUT;
  return inputCost + outputCost;
}

// ============================================================================
// Main Simulation
// ============================================================================

async function runSimulation() {
  const config = parseArgs();

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         MDAP Live Simulation: Code Analysis Chain              ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║  Steps: ${config.steps.toString().padEnd(6)} | k: ${config.k} | Model: ${config.model.padEnd(15)} ║`);
  console.log(`║  Mode: ${config.dryRun ? 'DRY RUN (no API calls)'.padEnd(47) : 'LIVE (real API calls)'.padEnd(47)} ║`);
  console.log(`║  Max Cost: $${config.maxCost.toFixed(2).padEnd(44)} ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log();

  // Print cost estimate
  const estimate = estimateCost({
    steps: config.steps * 3, // 3 steps per iteration
    successRate: 0.98,
    targetReliability: 0.95,
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.60,
    avgInputTokens: AVG_INPUT_TOKENS,
    avgOutputTokens: AVG_OUTPUT_TOKENS,
  });
  console.log('Estimated cost (theoretical):');
  console.log(formatCostEstimate(estimate).split('\n').map(l => `  ${l}`).join('\n'));
  console.log();

  // Initialize or resume state
  let state: SimulationState;
  if (config.resumeFile) {
    const loaded = loadCheckpoint(config.resumeFile);
    if (loaded) {
      state = loaded;
      state.config = config; // Allow config overrides
      console.log(`Resumed from checkpoint: ${config.resumeFile}`);
      console.log(`  Continuing from iteration ${state.metrics.length + 1}`);
    } else {
      console.error(`Could not load checkpoint: ${config.resumeFile}`);
      process.exit(1);
    }
  } else {
    state = createInitialState(config);
  }

  // Create LLM and pipeline
  const llm = createLLM(config);
  const pipeline = createAnalysisPipeline(llm, config.k);

  console.log('\nStarting simulation...\n');

  // Main loop
  for (let i = state.metrics.length; i < config.steps; i++) {
    const { code, name } = getSnippet(i);
    const iterationStart = Date.now();

    const metrics: StepMetrics = {
      iteration: i + 1,
      snippetName: name,
      identify: { samples: 0, flagged: 0, confidence: 0, converged: false, timeMs: 0 },
      classify: { samples: 0, flagged: 0, confidence: 0, converged: false, timeMs: 0 },
      suggest: { samples: 0, flagged: 0, confidence: 0, converged: false, timeMs: 0 },
      totalTimeMs: 0,
      success: true,
    };

    try {
      // Step 1: Identify issues
      const step1Start = Date.now();
      const identifyResult = await pipeline.identifyIssues(code);
      metrics.identify = {
        samples: identifyResult.totalSamples,
        flagged: identifyResult.flaggedSamples,
        confidence: identifyResult.confidence,
        converged: identifyResult.converged,
        timeMs: Date.now() - step1Start,
      };
      state.totalSamples += identifyResult.totalSamples;
      state.totalFlagged += identifyResult.flaggedSamples;
      state.estimatedCost += estimateStepCost(identifyResult.totalSamples);

      // Step 2: Classify severity
      const step2Start = Date.now();
      const classifyResult = await pipeline.classifySeverity(identifyResult.winner);
      metrics.classify = {
        samples: classifyResult.totalSamples,
        flagged: classifyResult.flaggedSamples,
        confidence: classifyResult.confidence,
        converged: classifyResult.converged,
        timeMs: Date.now() - step2Start,
      };
      state.totalSamples += classifyResult.totalSamples;
      state.totalFlagged += classifyResult.flaggedSamples;
      state.estimatedCost += estimateStepCost(classifyResult.totalSamples);

      // Step 3: Suggest fix
      const step3Start = Date.now();
      const context = `Code: ${name}\nIssues: ${identifyResult.winner}\nSeverity: ${classifyResult.winner}`;
      const suggestResult = await pipeline.suggestFix(context);
      metrics.suggest = {
        samples: suggestResult.totalSamples,
        flagged: suggestResult.flaggedSamples,
        confidence: suggestResult.confidence,
        converged: suggestResult.converged,
        timeMs: Date.now() - step3Start,
      };
      state.totalSamples += suggestResult.totalSamples;
      state.totalFlagged += suggestResult.flaggedSamples;
      state.estimatedCost += estimateStepCost(suggestResult.totalSamples);

      metrics.success = true;
      state.totalSuccesses++;

    } catch (error) {
      metrics.success = false;
      metrics.error = error instanceof Error ? error.message : String(error);
      state.totalFailures++;
    }

    metrics.totalTimeMs = Date.now() - iterationStart;
    state.metrics.push(metrics);
    state.currentIteration = i + 1;

    // Display progress
    printProgress(state, metrics);
    console.log();

    // Check cost limit
    if (state.estimatedCost > config.maxCost) {
      console.log(`\n⚠️  Cost limit reached ($${state.estimatedCost.toFixed(2)} > $${config.maxCost})`);
      break;
    }

    // Checkpoint
    if ((i + 1) % config.checkpointInterval === 0) {
      const checkpointFile = saveCheckpoint(state);
      console.log(`  📁 Checkpoint saved: ${checkpointFile}`);
    }

    // Rate limit delay
    if (config.delayMs > 0 && !config.dryRun) {
      await new Promise(r => setTimeout(r, config.delayMs));
    }
  }

  // Final report
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                      SIMULATION COMPLETE                       ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');

  const elapsed = Date.now() - state.startTime;
  const avgConfidence = state.metrics.reduce((sum, m) =>
    sum + (m.identify.confidence + m.classify.confidence + m.suggest.confidence) / 3, 0
  ) / state.metrics.length;

  console.log(`║  Total Iterations:  ${state.metrics.length.toString().padEnd(43)} ║`);
  console.log(`║  Successful:        ${state.totalSuccesses.toString().padEnd(43)} ║`);
  console.log(`║  Failed:            ${state.totalFailures.toString().padEnd(43)} ║`);
  console.log(`║  Success Rate:      ${((state.totalSuccesses / state.metrics.length) * 100).toFixed(2).padEnd(42)}% ║`);
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║  Total Samples:     ${state.totalSamples.toString().padEnd(43)} ║`);
  console.log(`║  Flagged Samples:   ${state.totalFlagged.toString().padEnd(43)} ║`);
  console.log(`║  Avg Confidence:    ${(avgConfidence * 100).toFixed(1).padEnd(42)}% ║`);
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║  Total Time:        ${formatTime(elapsed).padEnd(43)} ║`);
  console.log(`║  Avg Time/Step:     ${formatTime(elapsed / state.metrics.length).padEnd(43)} ║`);
  console.log(`║  Estimated Cost:    $${state.estimatedCost.toFixed(4).padEnd(42)} ║`);
  console.log('╠════════════════════════════════════════════════════════════════╣');

  // Comparison with theoretical single-sample approach
  // At 98% accuracy, 1000 iterations would expect ~20 failures without MDAP
  const expectedSingleSampleFailures = Math.round(state.metrics.length * 3 * 0.02);
  const improvement = expectedSingleSampleFailures > 0
    ? (expectedSingleSampleFailures / Math.max(1, state.totalFailures)).toFixed(1)
    : 'N/A';

  console.log(`║  COMPARISON (vs single-sample):                                ║`);
  console.log(`║    Expected failures (no MDAP): ~${expectedSingleSampleFailures.toString().padEnd(30)} ║`);
  console.log(`║    Actual failures (with MDAP): ${state.totalFailures.toString().padEnd(31)} ║`);
  console.log(`║    Reliability improvement:     ${improvement}x${' '.repeat(30 - improvement.length)} ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝');

  // Save final results
  const resultsDir = path.join(import.meta.dirname || '.', 'results');
  fs.mkdirSync(resultsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFile = path.join(resultsDir, `simulation-${timestamp}.json`);

  const finalResults = {
    config: {
      steps: config.steps,
      k: config.k,
      model: config.model,
      dryRun: config.dryRun,
    },
    results: {
      totalIterations: state.metrics.length,
      totalSteps: state.metrics.length * 3,
      successfulIterations: state.totalSuccesses,
      failedIterations: state.totalFailures,
      successRate: state.totalSuccesses / state.metrics.length,
      totalSamples: state.totalSamples,
      flaggedSamples: state.totalFlagged,
      avgConfidence: avgConfidence,
      totalTimeMs: elapsed,
      avgTimePerStepMs: elapsed / state.metrics.length,
      estimatedCostUsd: state.estimatedCost,
    },
    comparison: {
      singleSampleExpectedFailures: expectedSingleSampleFailures,
      mdapActualFailures: state.totalFailures,
      reliabilityImprovement: improvement,
    },
    metrics: state.metrics,
  };

  fs.writeFileSync(resultsFile, JSON.stringify(finalResults, null, 2));
  console.log(`\n📊 Results saved to: ${resultsFile}`);
}

// Run
runSimulation().catch(console.error);
