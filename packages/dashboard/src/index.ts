/**
 * @mdap/dashboard - MDAP Dashboard
 *
 * Web UI for monitoring MDAP workflows in real-time.
 *
 * @example
 * ```typescript
 * import { startDashboard, getTracker } from '@mdap/dashboard';
 *
 * // Start the dashboard server
 * const server = await startDashboard({ port: 3000 });
 *
 * // Get the tracker for instrumenting workflows
 * const tracker = server.getTracker();
 *
 * // Track a workflow
 * const workflow = tracker.startWorkflow('my-workflow');
 * const step = tracker.startStep(workflow.id, 'extract');
 * // ... run your MDAP operations
 * tracker.completeStep(workflow.id, step.id, voteResult);
 * tracker.completeWorkflow(workflow.id);
 * ```
 *
 * @packageDocumentation
 */

export { DashboardServer, startDashboard } from './server.js';
export {
  WorkflowTracker,
  getTracker,
  createTrackingCallbacks
} from './tracker.js';

export type {
  TrackedWorkflow,
  TrackedStep,
  TrackedSample,
  DashboardStats,
  DashboardEvent,
  DashboardConfig
} from './types.js';
