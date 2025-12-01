/**
 * Dashboard Types
 */

import type { VoteResult, WorkflowResult, StepResult } from '@mdap/core';

/**
 * A tracked workflow execution
 */
export interface TrackedWorkflow {
  id: string;
  name: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed';
  steps: TrackedStep[];
  totalSamples: number;
  result?: unknown;
  error?: string;
}

/**
 * A tracked step within a workflow
 */
export interface TrackedStep {
  id: string;
  name: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  samples: TrackedSample[];
  result?: VoteResult<unknown>;
  timeMs?: number;
}

/**
 * A tracked sample (individual LLM call)
 */
export interface TrackedSample {
  id: string;
  timestamp: Date;
  response?: string;
  flagged: boolean;
  flagReason?: string;
  voteCount?: number;
}

/**
 * Aggregated statistics
 */
export interface DashboardStats {
  totalWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  runningWorkflows: number;
  totalSteps: number;
  totalSamples: number;
  totalFlagged: number;
  avgSamplesPerStep: number;
  avgConfidence: number;
  avgTimePerWorkflow: number;
}

/**
 * Event types for real-time updates
 */
export type DashboardEvent =
  | { type: 'workflow:start'; workflow: TrackedWorkflow }
  | { type: 'workflow:complete'; workflow: TrackedWorkflow }
  | { type: 'workflow:fail'; workflow: TrackedWorkflow; error: string }
  | { type: 'step:start'; workflowId: string; step: TrackedStep }
  | { type: 'step:complete'; workflowId: string; step: TrackedStep }
  | { type: 'sample:add'; workflowId: string; stepId: string; sample: TrackedSample }
  | { type: 'stats:update'; stats: DashboardStats };

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  /**
   * Port to run the dashboard server on
   * @default 3000
   */
  port?: number;

  /**
   * Host to bind to
   * @default 'localhost'
   */
  host?: string;

  /**
   * Maximum number of workflows to keep in memory
   * @default 100
   */
  maxWorkflows?: number;

  /**
   * Enable verbose logging
   * @default false
   */
  verbose?: boolean;
}
