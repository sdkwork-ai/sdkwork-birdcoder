import type {
  MultiWindowPaneConfig,
} from '../types.ts';
import {
  resolveMultiWindowPaneSessionProvisioningStatus,
  type MultiWindowPaneSessionBindingSummary,
  type MultiWindowPaneSessionProvisioningReason,
} from './multiWindowSessionProvisioning.ts';

export type MultiWindowPaneDispatchabilityStatus = 'dispatchable' | 'not-dispatchable';

export type MultiWindowComposerDisabledReason =
  | 'loading'
  | 'no-dispatchable-windows'
  | 'no-projects'
  | 'no-windows';

export interface MultiWindowPaneDispatchability {
  reason: MultiWindowPaneSessionProvisioningReason;
  requiresSessionProvisioning: boolean;
  status: MultiWindowPaneDispatchabilityStatus;
}

export interface MultiWindowPaneDispatchabilityInput {
  binding: MultiWindowPaneSessionBindingSummary | null | undefined;
  pane: MultiWindowPaneConfig;
}

interface ResolveMultiWindowComposerDisabledReasonOptions {
  dispatchablePaneCount: number;
  hasFetchedProjects: boolean;
  projectCount: number;
  visiblePaneCount: number;
}

export function resolveMultiWindowPaneDispatchability(
  pane: MultiWindowPaneConfig,
  binding: MultiWindowPaneSessionBindingSummary | null | undefined,
): MultiWindowPaneDispatchability {
  const provisioningStatus = resolveMultiWindowPaneSessionProvisioningStatus(pane, binding);
  const isDispatchable = provisioningStatus.status !== 'skipped';

  return {
    reason: provisioningStatus.reason,
    requiresSessionProvisioning: provisioningStatus.status === 'needs-session',
    status: isDispatchable ? 'dispatchable' : 'not-dispatchable',
  };
}

export function countMultiWindowDispatchablePanes(
  inputs: readonly MultiWindowPaneDispatchabilityInput[],
): number {
  return inputs.filter(({ binding, pane }) =>
    resolveMultiWindowPaneDispatchability(pane, binding).status === 'dispatchable',
  ).length;
}

export function resolveMultiWindowComposerDisabledReason({
  dispatchablePaneCount,
  hasFetchedProjects,
  projectCount,
  visiblePaneCount,
}: ResolveMultiWindowComposerDisabledReasonOptions): MultiWindowComposerDisabledReason | null {
  if (!hasFetchedProjects) {
    return 'loading';
  }
  if (projectCount <= 0) {
    return 'no-projects';
  }
  if (visiblePaneCount <= 0) {
    return 'no-windows';
  }
  if (dispatchablePaneCount <= 0) {
    return 'no-dispatchable-windows';
  }

  return null;
}
