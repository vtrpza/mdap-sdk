#!/usr/bin/env node
/**
 * MDAP CLI
 *
 * Usage:
 *   npx mdap execute "your prompt" --k 3 --red-flags "tooLong:750,invalidJson"
 *   npx mdap estimate --steps 10000 --success-rate 0.99
 *   npx mdap validate "response text" --rules tooLong,invalidJson
 */

import {
  estimateCost,
  formatCostEstimate,
  calculateMinK,
  RedFlag,
  executeReliable,
  formatExecuteResult,
  type RedFlagRule,
  type RedFlagInput,
  type Provider,
} from "@mdap/core";

const VERSION = "0.1.0";

function printHelp() {
  console.log(`
MDAP CLI v${VERSION}
Make your AI agents actually reliable.

USAGE
  mdap <command> [options]

COMMANDS
  execute     Run a prompt with full MDAP reliability (voting + red flags)
  estimate    Estimate cost for a multi-step workflow
  validate    Check a response against red-flag rules
  version     Show version number
  help        Show this help message

EXAMPLES
  # Execute a prompt with MDAP reliability
  mdap execute "Extract entities as JSON from: Apple was founded by Steve Jobs" \\
    --system "Respond only with valid JSON" \\
    --k 3 \\
    --red-flags "tooLong:500,invalidJson"

  # Execute with different provider
  mdap execute "Summarize this text" --provider anthropic --model claude-3-5-haiku-latest

  # Estimate cost for 10,000 steps
  mdap estimate --steps 10000

  # Validate a response
  mdap validate "Your LLM response here" --max-tokens 750

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
    outputTokens: 200,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case "--steps":
      case "-s":
        options.steps = parseInt(next, 10);
        i++;
        break;
      case "--success-rate":
      case "-p":
        options.successRate = parseFloat(next);
        i++;
        break;
      case "--target":
      case "-t":
        options.target = parseFloat(next);
        i++;
        break;
      case "--input-cost":
        options.inputCost = parseFloat(next);
        i++;
        break;
      case "--output-cost":
        options.outputCost = parseFloat(next);
        i++;
        break;
      case "--input-tokens":
        options.inputTokens = parseInt(next, 10);
        i++;
        break;
      case "--output-tokens":
        options.outputTokens = parseInt(next, 10);
        i++;
        break;
    }
  }

  return options;
}

function runEstimate(args: string[]) {
  const options = parseEstimateArgs(args);

  console.log("\n📊 MDAP Cost Estimation\n");
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
      avgOutputTokens: options.outputTokens,
    });

    console.log("Results:");
    console.log(
      formatCostEstimate(estimate)
        .split("\n")
        .map((line: string) => `  ${line}`)
        .join("\n"),
    );
    console.log();

    // Additional insights
    const kFor99 = calculateMinK(options.steps, options.successRate, 0.99);
    const kFor999 = calculateMinK(options.steps, options.successRate, 0.999);

    console.log("K values for different reliability targets:");
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

function parseValidateArgs(args: string[]): {
  response: string;
  options: ValidateOptions;
} {
  const options: ValidateOptions = {
    maxTokens: 750,
    rules: ["tooLong", "emptyResponse"],
  };

  let response = "";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg.startsWith("--")) {
      switch (arg) {
        case "--max-tokens":
          options.maxTokens = parseInt(next, 10);
          i++;
          break;
        case "--rules":
          options.rules = next.split(",").map((r) => r.trim());
          i++;
          break;
      }
    } else if (!response) {
      response = arg;
    }
  }

  return { response, options };
}

function buildRules(
  ruleNames: string[],
  maxTokens: number,
): RedFlagRule<string>[] {
  return ruleNames
    .map((name) => {
      switch (name) {
        case "tooLong":
          return RedFlag.tooLong(maxTokens);
        case "emptyResponse":
          return RedFlag.emptyResponse();
        case "invalidJson":
          return RedFlag.invalidJson();
        default:
          console.warn(`Unknown rule: ${name}, skipping`);
          return null;
      }
    })
    .filter((r): r is RedFlagRule<string> => r !== null);
}

function runValidate(args: string[]) {
  const { response, options } = parseValidateArgs(args);

  if (!response) {
    console.error("Error: No response provided to validate");
    console.log(
      'Usage: mdap validate "Your response text" [--max-tokens 750] [--rules tooLong,invalidJson]',
    );
    process.exit(1);
  }

  console.log("\n🔍 MDAP Response Validation\n");

  const rules = buildRules(options.rules, options.maxTokens);
  const violations: string[] = [];

  for (const rule of rules) {
    const flagged = rule.check(response);
    const status = flagged ? "❌" : "✅";
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
    console.log("✅ Response passed all checks");
  } else {
    console.log(`❌ Response flagged by: ${violations.join(", ")}`);
    process.exit(1);
  }
}

// Execute command types and functions
interface ExecuteOptions {
  prompt: string;
  system?: string;
  k: number;
  maxSamples: number;
  redFlags: string[];
  provider: Provider;
  model?: string;
  temperature: number;
  json: boolean;
}

function parseExecuteArgs(args: string[]): ExecuteOptions {
  const options: ExecuteOptions = {
    prompt: "",
    k: 3,
    maxSamples: 30,
    redFlags: ["tooLong:750", "emptyResponse"],
    provider: "openai",
    temperature: 0.1,
    json: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg.startsWith("--")) {
      switch (arg) {
        case "--system":
          options.system = next;
          i++;
          break;
        case "--k":
          options.k = parseInt(next, 10);
          i++;
          break;
        case "--max-samples":
          options.maxSamples = parseInt(next, 10);
          i++;
          break;
        case "--red-flags":
          options.redFlags = next.split(",").map((r: string) => r.trim());
          i++;
          break;
        case "--provider":
          if (next === "openai" || next === "anthropic") {
            options.provider = next;
          } else {
            console.error(
              `Unknown provider: ${next}. Use 'openai' or 'anthropic'.`,
            );
            process.exit(1);
          }
          i++;
          break;
        case "--model":
          options.model = next;
          i++;
          break;
        case "--temperature":
          options.temperature = parseFloat(next);
          i++;
          break;
        case "--json":
          options.json = true;
          break;
      }
    } else if (!options.prompt) {
      options.prompt = arg;
    }
  }

  return options;
}

async function runExecute(args: string[]) {
  const options = parseExecuteArgs(args);

  if (!options.prompt) {
    console.error("Error: No prompt provided");
    console.log(
      'Usage: mdap execute "Your prompt" [--k 3] [--red-flags "tooLong:750,invalidJson"]',
    );
    process.exit(1);
  }

  if (!options.json) {
    console.log("\n🎯 MDAP Reliable Execute\n");
    console.log(
      `Prompt: "${options.prompt.slice(0, 50)}${options.prompt.length > 50 ? "..." : ""}"`,
    );
    console.log(`Provider: ${options.provider}`);
    console.log(`Model: ${options.model ?? "default"}`);
    console.log(`k: ${options.k}`);
    console.log(`Red flags: ${options.redFlags.join(", ")}`);
    console.log();
  }

  try {
    const result = await executeReliable({
      prompt: options.prompt,
      system: options.system,
      k: options.k,
      maxSamples: options.maxSamples,
      redFlags: options.redFlags as RedFlagInput[],
      provider: options.provider,
      model: options.model,
      temperature: options.temperature,
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatExecuteResult(result));
    }

    if (!result.converged) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}

// Main entry point
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case "execute":
    runExecute(args.slice(1));
    break;
  case "estimate":
    runEstimate(args.slice(1));
    break;
  case "validate":
    runValidate(args.slice(1));
    break;
  case "version":
  case "-v":
  case "--version":
    printVersion();
    break;
  case "help":
  case "-h":
  case "--help":
  case undefined:
    printHelp();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.log('Run "mdap help" for usage information');
    process.exit(1);
}
