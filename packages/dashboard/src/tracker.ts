/**
 * Workflow Tracker
 *
 * Tracks workflow executions and provides data for the dashboard
 */

import type { VoteResult, ReliableConfig, RedFlagRule } from '@mdap/core';
import type {
  TrackedWorkflow,
  TrackedStep,
  TrackedSample,
  DashboardStats,
  DashboardEvent
} from './types.js';

type EventHandler = (event: DashboardEvent) => void;

/**
 * Workflow tracker singleton
 */
export class WorkflowTracker {
  private workflows: Map<string, TrackedWorkflow> = new Map();
  private maxWorkflows: number;
  private eventHandlers: Set<EventHandler> = new Set();
  private idCounter = 0;

  constructor(maxWorkflows = 100) {
    this.maxWorkflows = maxWorkflows;
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${++this.idCounter}`;
  }

  /**
   * Emit an event to all handlers
   */
  private emit(event: DashboardEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('[MDAP Dashboard] Event handler error:', error);
      }
    }
  }

  /**
   * Subscribe to dashboard events
   */
  subscribe(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * Start tracking a workflow
   */
  startWorkflow(name: string): TrackedWorkflow {
    const workflow: TrackedWorkflow = {
      id: this.generateId(),
      name,
      startedAt: new Date(),
      status: 'running',
      steps: [],
      totalSamples: 0
    };

    this.workflows.set(workflow.id, workflow);
    this.pruneOldWorkflows();
    this.emit({ type: 'workflow:start', workflow });
    this.emitStats();

    return workflow;
  }

  /**
   * Complete a workflow
   */
  completeWorkflow(workflowId: string, result?: unknown): void {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    workflow.status = 'completed';
    workflow.completedAt = new Date();
    workflow.result = result;

    this.emit({ type: 'workflow:complete', workflow });
    this.emitStats();
  }

  /**
   * Mark a workflow as failed
   */
  failWorkflow(workflowId: string, error: string): void {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    workflow.status = 'failed';
    workflow.completedAt = new Date();
    workflow.error = error;

    this.emit({ type: 'workflow:fail', workflow, error });
    this.emitStats();
  }

  /**
   * Start a step within a workflow
   */
  startStep(workflowId: string, name: string): TrackedStep {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const step: TrackedStep = {
      id: this.generateId(),
      name,
      startedAt: new Date(),
      status: 'running',
      samples: []
    };

    workflow.steps.push(step);
    this.emit({ type: 'step:start', workflowId, step });

    return step;
  }

  /**
   * Complete a step
   */
  completeStep(workflowId: string, stepId: string, result: VoteResult<unknown>): void {
    const workflow = this.workflows.get(workflowId);
    const step = workflow?.steps.find(s => s.id === stepId);
    if (!step) return;

    step.status = 'completed';
    step.completedAt = new Date();
    step.result = result;
    step.timeMs = step.completedAt.getTime() - step.startedAt.getTime();

    workflow!.totalSamples += result.totalSamples;

    this.emit({ type: 'step:complete', workflowId, step });
    this.emitStats();
  }

  /**
   * Record a sample
   */
  recordSample(
    workflowId: string,
    stepId: string,
    response: string | undefined,
    flagged: boolean,
    flagReason?: string,
    voteCount?: number
  ): TrackedSample {
    const workflow = this.workflows.get(workflowId);
    const step = workflow?.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found in workflow ${workflowId}`);
    }

    const sample: TrackedSample = {
      id: this.generateId(),
      timestamp: new Date(),
      response,
      flagged,
      flagReason,
      voteCount
    };

    step.samples.push(sample);
    this.emit({ type: 'sample:add', workflowId, stepId, sample });

    return sample;
  }

  /**
   * Get all workflows
   */
  getWorkflows(): TrackedWorkflow[] {
    return Array.from(this.workflows.values()).sort(
      (a, b) => b.startedAt.getTime() - a.startedAt.getTime()
    );
  }

  /**
   * Get a specific workflow
   */
  getWorkflow(id: string): TrackedWorkflow | undefined {
    return this.workflows.get(id);
  }

  /**
   * Get dashboard statistics
   */
  getStats(): DashboardStats {
    const workflows = Array.from(this.workflows.values());

    const completedWorkflows = workflows.filter(w => w.status === 'completed');
    const allSteps = workflows.flatMap(w => w.steps);
    const allSamples = allSteps.flatMap(s => s.samples);
    const flaggedSamples = allSamples.filter(s => s.flagged);

    const avgConfidence = completedWorkflows.length > 0
      ? completedWorkflows.reduce((acc, w) => {
          const stepConfidences = w.steps
            .filter(s => s.result)
            .map(s => s.result!.confidence);
          return acc + (stepConfidences.length > 0
            ? stepConfidences.reduce((a, b) => a + b, 0) / stepConfidences.length
            : 0);
        }, 0) / completedWorkflows.length
      : 0;

    const completedTimes = completedWorkflows
      .filter(w => w.completedAt)
      .map(w => w.completedAt!.getTime() - w.startedAt.getTime());

    const avgTimePerWorkflow = completedTimes.length > 0
      ? completedTimes.reduce((a, b) => a + b, 0) / completedTimes.length
      : 0;

    return {
      totalWorkflows: workflows.length,
      completedWorkflows: completedWorkflows.length,
      failedWorkflows: workflows.filter(w => w.status === 'failed').length,
      runningWorkflows: workflows.filter(w => w.status === 'running').length,
      totalSteps: allSteps.length,
      totalSamples: allSamples.length,
      totalFlagged: flaggedSamples.length,
      avgSamplesPerStep: allSteps.length > 0 ? allSamples.length / allSteps.length : 0,
      avgConfidence,
      avgTimePerWorkflow
    };
  }

  /**
   * Emit stats update event
   */
  private emitStats(): void {
    this.emit({ type: 'stats:update', stats: this.getStats() });
  }

  /**
   * Remove old workflows if over limit
   */
  private pruneOldWorkflows(): void {
    if (this.workflows.size <= this.maxWorkflows) return;

    const sorted = this.getWorkflows();
    const toRemove = sorted.slice(this.maxWorkflows);

    for (const workflow of toRemove) {
      this.workflows.delete(workflow.id);
    }
  }

  /**
   * Clear all workflows
   */
  clear(): void {
    this.workflows.clear();
    this.emitStats();
  }
}

// Global tracker instance
let globalTracker: WorkflowTracker | null = null;

/**
 * Get the global workflow tracker
 */
export function getTracker(maxWorkflows = 100): WorkflowTracker {
  if (!globalTracker) {
    globalTracker = new WorkflowTracker(maxWorkflows);
  }
  return globalTracker;
}

/**
 * Create tracking callbacks for reliable() config
 */
export function createTrackingCallbacks<T>(
  workflowId: string,
  stepId: string,
  tracker = getTracker()
): Pick<ReliableConfig<T>, 'onFlag' | 'onSample'> {
  return {
    onFlag: (response: T, rule: RedFlagRule<T>) => {
      tracker.recordSample(
        workflowId,
        stepId,
        String(response).slice(0, 500),
        true,
        rule.name
      );
    },
    onSample: (response: T, voteCount: number) => {
      tracker.recordSample(
        workflowId,
        stepId,
        String(response).slice(0, 500),
        false,
        undefined,
        voteCount
      );
    }
  };
}
