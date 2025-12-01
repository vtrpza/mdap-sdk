#!/usr/bin/env node
/**
 * MDAP CLI
 *
 * Usage:
 *   npx mdap estimate --steps 10000 --success-rate 0.99
 *   npx mdap validate "response text" --rules tooLong,invalidJson
 *   npx mdap run --config mdap.config.json
 */

import {
  estimateCost,
  formatCostEstimate,
  calculateMinK,
  RedFlag,
  type RedFlagRule
} from '@mdap/core';

const VERSION = '0.1.0';

function printHelp() {
  console.log(`
MDAP CLI v${VERSION}
Make your AI agents actually reliable.

USAGE
  mdap <command> [options]

COMMANDS
  estimate    Estimate cost for a multi-step workflow
  validate    Check a response against red-flag rules
  version     Show version number
  help        Show this help message

EXAMPLES
  # Estimate cost for 10,000 steps
  mdap estimate --steps 10000

  # Estimate with custom parameters
  mdap estimate --steps 10000 --success-rate 0.99 --target 0.95

  # Validate a response
  mdap validate "Your LLM response here" --max-tokens 750

  # Calculate optimal k value
  mdap estimate --steps 1000000 --success-rate 0.99

For more info: https://github.com/vtrpza/mdap-sdk
`);
}

function printVersion() {
  console.log(`mdap v${VERSION}`);
}

interface EstimateOptions {
  steps: number;
  successRate: number;
  target: number;
  inputCost: number;
  outputCost: number;
  inputTokens: number;
  outputTokens: number;
}

function parseEstimateArgs(args: string[]): EstimateOptions {
  const options: EstimateOptions = {
    steps: 1000,
    successRate: 0.99,
    target: 0.95,
    inputCost: 0.5,
    outputCost: 1.5,
    inputTokens: 300,
    outputTokens: 200
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--steps':
      case '-s':
        options.steps = parseInt(next, 10);
        i++;
        break;
      case '--success-rate':
      case '-p':
        options.successRate = parseFloat(next);
        i++;
        break;
      case '--target':
      case '-t':
        options.target = parseFloat(next);
        i++;
        break;
      case '--input-cost':
        options.inputCost = parseFloat(next);
        i++;
        break;
      case '--output-cost':
        options.outputCost = parseFloat(next);
        i++;
        break;
      case '--input-tokens':
        options.inputTokens = parseInt(next, 10);
        i++;
        break;
      case '--output-tokens':
        options.outputTokens = parseInt(next, 10);
        i++;
        break;
    }
  }

  return options;
}

function runEstimate(args: string[]) {
  const options = parseEstimateArgs(args);

  console.log('\n📊 MDAP Cost Estimation\n');
  console.log(`Parameters:`);
  console.log(`  Steps: ${options.steps.toLocaleString()}`);
  console.log(`  Success Rate: ${(options.successRate * 100).toFixed(1)}%`);
  console.log(`  Target Reliability: ${(options.target * 100).toFixed(1)}%`);
  console.log(`  Input Cost: $${options.inputCost}/1M tokens`);
  console.log(`  Output Cost: $${options.outputCost}/1M tokens`);
  console.log();

  try {
    const estimate = estimateCost({
      steps: options.steps,
      successRate: options.successRate,
      targetReliability: options.target,
      inputCostPerMillion: options.inputCost,
      outputCostPerMillion: options.outputCost,
      avgInputTokens: options.inputTokens,
      avgOutputTokens: options.outputTokens
    });

    console.log('Results:');
    console.log(formatCostEstimate(estimate).split('\n').map(l => `  ${l}`).join('\n'));
    console.log();

    // Additional insights
    const kFor99 = calculateMinK(options.steps, options.successRate, 0.99);
    const kFor999 = calculateMinK(options.steps, options.successRate, 0.999);

    console.log('K values for different reliability targets:');
    console.log(`  95% reliability: k=${estimate.kRequired}`);
    console.log(`  99% reliability: k=${kFor99}`);
    console.log(`  99.9% reliability: k=${kFor999}`);
    console.log();
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}

interface ValidateOptions {
  maxTokens: number;
  rules: string[];
}

function parseValidateArgs(args: string[]): { response: string; options: ValidateOptions } {
  const options: ValidateOptions = {
    maxTokens: 750,
    rules: ['tooLong', 'emptyResponse']
  };

  let response = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg.startsWith('--')) {
      switch (arg) {
        case '--max-tokens':
          options.maxTokens = parseInt(next, 10);
          i++;
          break;
        case '--rules':
          options.rules = next.split(',').map(r => r.trim());
          i++;
          break;
      }
    } else if (!response) {
      response = arg;
    }
  }

  return { response, options };
}

function buildRules(ruleNames: string[], maxTokens: number): RedFlagRule<string>[] {
  return ruleNames.map(name => {
    switch (name) {
      case 'tooLong':
        return RedFlag.tooLong(maxTokens);
      case 'emptyResponse':
        return RedFlag.emptyResponse();
      case 'invalidJson':
        return RedFlag.invalidJson();
      default:
        console.warn(`Unknown rule: ${name}, skipping`);
        return null;
    }
  }).filter((r): r is RedFlagRule<string> => r !== null);
}

function runValidate(args: string[]) {
  const { response, options } = parseValidateArgs(args);

  if (!response) {
    console.error('Error: No response provided to validate');
    console.log('Usage: mdap validate "Your response text" [--max-tokens 750] [--rules tooLong,invalidJson]');
    process.exit(1);
  }

  console.log('\n🔍 MDAP Response Validation\n');

  const rules = buildRules(options.rules, options.maxTokens);
  const violations: string[] = [];

  for (const rule of rules) {
    const flagged = rule.check(response);
    const status = flagged ? '❌' : '✅';
    console.log(`  ${status} ${rule.name}`);
    if (flagged) {
      violations.push(rule.name);
    }
  }

  console.log();
  const tokenEstimate = Math.ceil(response.length / 4);
  console.log(`Token estimate: ~${tokenEstimate}`);
  console.log(`Response length: ${response.length} chars`);
  console.log();

  if (violations.length === 0) {
    console.log('✅ Response passed all checks');
  } else {
    console.log(`❌ Response flagged by: ${violations.join(', ')}`);
    process.exit(1);
  }
}

// Main entry point
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'estimate':
    runEstimate(args.slice(1));
    break;
  case 'validate':
    runValidate(args.slice(1));
    break;
  case 'version':
  case '-v':
  case '--version':
    printVersion();
    break;
  case 'help':
  case '-h':
  case '--help':
  case undefined:
    printHelp();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.log('Run "mdap help" for usage information');
    process.exit(1);
}
