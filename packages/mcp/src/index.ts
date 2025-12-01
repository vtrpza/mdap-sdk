/**
 * @mdap/mcp - MDAP MCP Server
 *
 * Exposes MDAP voting-based reliability as MCP tools for any MCP client
 * (Claude Code, Cursor, VS Code, etc.)
 *
 * Tools:
 * - mdap_estimate_cost: Predict cost before running a workflow
 * - mdap_validate: Check if a response passes red-flag rules
 *
 * @packageDocumentation
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  estimateCost,
  formatCostEstimate,
  RedFlag,
  type CostEstimateConfig,
  type RedFlagRule
} from '@mdap/core';

/**
 * Create an MDAP MCP server instance
 */
export function createMdapServer() {
  const server = new McpServer({
    name: 'mdap-server',
    version: '0.1.0'
  });

  // Tool: mdap_estimate_cost
  // Predict cost before running a workflow
  server.registerTool(
    'mdap_estimate_cost',
    {
      title: 'MDAP Cost Estimator',
      description: 'Estimate the cost of running a multi-step workflow with MDAP reliability. Returns cost, API calls, tokens, and time estimates based on the paper "Solving a Million-Step LLM Task with Zero Errors".',
      inputSchema: {
        steps: z.number().int().positive().describe('Number of steps in the workflow'),
        successRate: z.number().min(0).max(1).default(0.99).describe('Per-step success rate (0-1). Default: 0.99'),
        targetReliability: z.number().min(0).max(1).default(0.95).describe('Target overall success probability (0-1). Default: 0.95'),
        inputCostPerMillion: z.number().positive().default(0.5).describe('Cost per 1M input tokens in USD. Default: 0.5 (gpt-4.1-mini)'),
        outputCostPerMillion: z.number().positive().default(1.5).describe('Cost per 1M output tokens in USD. Default: 1.5 (gpt-4.1-mini)'),
        avgInputTokens: z.number().int().positive().default(300).describe('Average input tokens per step. Default: 300'),
        avgOutputTokens: z.number().int().positive().default(200).describe('Average output tokens per step. Default: 200')
      },
      outputSchema: {
        cost: z.number().describe('Estimated total cost in USD'),
        apiCalls: z.number().describe('Estimated number of API calls'),
        tokens: z.number().describe('Estimated total tokens'),
        kRequired: z.number().describe('The k value required for target reliability'),
        estimatedTimeMs: z.number().describe('Estimated time in milliseconds'),
        formatted: z.string().describe('Human-readable formatted estimate')
      }
    },
    async (args) => {
      const config: CostEstimateConfig = {
        steps: args.steps,
        successRate: args.successRate,
        targetReliability: args.targetReliability,
        inputCostPerMillion: args.inputCostPerMillion,
        outputCostPerMillion: args.outputCostPerMillion,
        avgInputTokens: args.avgInputTokens,
        avgOutputTokens: args.avgOutputTokens
      };

      const estimate = estimateCost(config);
      const formatted = formatCostEstimate(estimate);

      const output = {
        cost: estimate.cost,
        apiCalls: estimate.apiCalls,
        tokens: estimate.tokens,
        kRequired: estimate.kRequired,
        estimatedTimeMs: estimate.estimatedTimeMs,
        formatted
      };

      return {
        content: [{ type: 'text', text: formatted }],
        structuredContent: output
      };
    }
  );

  // Tool: mdap_validate
  // Check if a response passes red-flag rules
  server.registerTool(
    'mdap_validate',
    {
      title: 'MDAP Response Validator',
      description: 'Validate a response against MDAP red-flag rules. Returns whether the response passes and which rules it violated. Use this to check LLM outputs for signs of confusion.',
      inputSchema: {
        response: z.string().describe('The LLM response to validate'),
        rules: z.array(z.object({
          type: z.enum(['tooLong', 'emptyResponse', 'invalidJson', 'mustMatch', 'mustNotMatch', 'containsPhrase']).describe('Type of red flag rule'),
          value: z.union([z.string(), z.number(), z.array(z.string())]).optional().describe('Rule parameter (max length for tooLong, regex for mustMatch/mustNotMatch, phrases for containsPhrase)')
        })).default([
          { type: 'tooLong', value: 750 },
          { type: 'emptyResponse' },
          { type: 'invalidJson' }
        ]).describe('Red flag rules to apply. Default: tooLong(750), emptyResponse, invalidJson')
      },
      outputSchema: {
        valid: z.boolean().describe('Whether the response passes all rules'),
        violations: z.array(z.string()).describe('List of violated rule names'),
        response: z.string().describe('The original response'),
        tokenEstimate: z.number().describe('Estimated token count (chars/4)')
      }
    },
    async (args) => {
      const violations: string[] = [];

      // Build red flag rules from input
      const rules: RedFlagRule<string>[] = args.rules.map(rule => {
        switch (rule.type) {
          case 'tooLong':
            return RedFlag.tooLong(typeof rule.value === 'number' ? rule.value : 750);
          case 'emptyResponse':
            return RedFlag.emptyResponse();
          case 'invalidJson':
            return RedFlag.invalidJson();
          case 'mustMatch':
            return RedFlag.mustMatch(new RegExp(rule.value as string));
          case 'mustNotMatch':
            return RedFlag.mustNotMatch(new RegExp(rule.value as string));
          case 'containsPhrase':
            return RedFlag.containsPhrase(rule.value as string[]);
          default:
            return RedFlag.emptyResponse(); // fallback
        }
      });

      // Check each rule
      for (const rule of rules) {
        if (rule.check(args.response)) {
          violations.push(rule.name);
        }
      }

      const valid = violations.length === 0;
      const tokenEstimate = Math.ceil(args.response.length / 4);

      const output = {
        valid,
        violations,
        response: args.response,
        tokenEstimate
      };

      const message = valid
        ? `✅ Response is valid (no red flags triggered). Estimated tokens: ${tokenEstimate}`
        : `❌ Response flagged! Violations: ${violations.join(', ')}. Estimated tokens: ${tokenEstimate}`;

      return {
        content: [{ type: 'text', text: message }],
        structuredContent: output
      };
    }
  );

  // Tool: mdap_calculate_k
  // Calculate optimal k value for a workflow
  server.registerTool(
    'mdap_calculate_k',
    {
      title: 'MDAP K Calculator',
      description: 'Calculate the optimal k value (vote threshold) for a given number of steps and target reliability. Higher k = more reliable but more expensive.',
      inputSchema: {
        steps: z.number().int().positive().describe('Number of steps in the workflow'),
        successRate: z.number().min(0).max(1).default(0.99).describe('Per-step success rate (0-1). Default: 0.99'),
        targetReliability: z.number().min(0).max(1).default(0.95).describe('Target overall success probability (0-1). Default: 0.95')
      },
      outputSchema: {
        k: z.number().describe('Recommended k value'),
        steps: z.number().describe('Number of steps'),
        successRate: z.number().describe('Per-step success rate'),
        targetReliability: z.number().describe('Target reliability'),
        expectedSamplesPerStep: z.number().describe('Expected samples per step with this k'),
        recommendation: z.string().describe('Human-readable recommendation')
      }
    },
    async (args) => {
      // Calculate k using the paper's formula: k_min = ceil(ln(t^(-1/s) - 1) / ln((1-p)/p))
      const { steps, successRate, targetReliability } = args;
      const p = successRate;
      const t = targetReliability;
      const s = steps;

      // Calculate minimum k
      const errorRatio = (1 - p) / p;
      const targetPerStep = Math.pow(t, -1 / s) - 1;
      const k = Math.max(1, Math.ceil(Math.log(targetPerStep) / Math.log(errorRatio)));

      // Expected samples per step: approximately 2k-1 for first-to-ahead-by-k
      const expectedSamplesPerStep = Math.round((2 * k - 1) * (1 / p));

      const recommendation = k <= 3
        ? `k=${k} is efficient. Your workflow should complete with ~${expectedSamplesPerStep} samples per step.`
        : k <= 5
          ? `k=${k} is moderate. Consider breaking down into smaller steps if possible.`
          : `k=${k} is high. Your per-step success rate (${(p * 100).toFixed(1)}%) may be too low. Consider improving prompts or using a better model.`;

      const output = {
        k,
        steps,
        successRate,
        targetReliability,
        expectedSamplesPerStep,
        recommendation
      };

      return {
        content: [{ type: 'text', text: `Recommended k: ${k}\n\n${recommendation}` }],
        structuredContent: output
      };
    }
  );

  return server;
}

/**
 * Start the MDAP MCP server with stdio transport
 */
export async function startServer() {
  const server = createMdapServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}

// Export types
export type { McpServer };
