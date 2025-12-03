/**
 * Shared Types for Sequential Refactoring Case Study
 */

export interface Issue {
  id: number;
  line: number;
  category: "BUG" | "SECURITY" | "TYPE_SAFETY" | "ERROR_HANDLING" | "TRICKY";
  difficulty: "easy" | "medium" | "hard";
  description: string;
  before: string;
  after: string;
}

export interface IssuesManifest {
  issues: Issue[];
}

export interface StepResult {
  step: number;
  issue: Issue;
  success: boolean;
  codeAfter: string;
  expectedCode: string;
  matchesExpected: boolean;
  latencyMs: number;
  // MDAP-specific
  totalSamples?: number;
  flaggedSamples?: number;
  confidence?: number;
  converged?: boolean;
}

export interface ChainResult {
  method: "baseline" | "mdap";
  totalSteps: number;
  successfulSteps: number;
  firstDivergence: number | null;
  stepsMatchingExpected: number;
  finalMatchesGolden: boolean;
  steps: StepResult[];
  totalLatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
}

export interface ComparisonReport {
  timestamp: string;
  baseline: ChainResult;
  mdap: ChainResult;
  summary: {
    baselineFirstDivergence: number | null;
    mdapFirstDivergence: number | null;
    baselineAccuracy: number;
    mdapAccuracy: number;
    errorReduction: number;
    costOverhead: number;
  };
}
