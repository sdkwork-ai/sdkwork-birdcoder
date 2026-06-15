import type {
  MultiWindowPaneConfig,
} from '../types.ts';

export type MultiWindowPaneSessionProvisioningStatus = 'ready' | 'needs-session' | 'skipped';

export type MultiWindowPaneSessionProvisioningReason =
  | 'disabled'
  | 'engine-model-mismatch'
  | 'missing-project'
  | 'missing-session'
  | 'session-ready';

export interface MultiWindowPaneSessionBindingSummary {
  codingSessionId?: string | null;
  engineId?: string | null;
  id?: string | null;
  modelId?: string | null;
}

export interface MultiWindowPaneSessionProvisioningResult {
  reason: MultiWindowPaneSessionProvisioningReason;
  status: MultiWindowPaneSessionProvisioningStatus;
}

function normalizeText(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function normalizeComparableText(value: string | null | undefined): string {
  return normalizeText(value).toLocaleLowerCase();
}

export function resolveMultiWindowPaneSessionProvisioningStatus(
  pane: MultiWindowPaneConfig,
  binding: MultiWindowPaneSessionBindingSummary | null | undefined,
): MultiWindowPaneSessionProvisioningResult {
  if (pane.enabled === false) {
    return {
      reason: 'disabled',
      status: 'skipped',
    };
  }

  if (!normalizeText(pane.projectId)) {
    return {
      reason: 'missing-project',
      status: 'skipped',
    };
  }

  const paneSessionId = normalizeText(pane.codingSessionId);
  const bindingSessionId = normalizeText(binding?.codingSessionId ?? binding?.id);
  if (!paneSessionId || !bindingSessionId || paneSessionId !== bindingSessionId) {
    return {
      reason: 'missing-session',
      status: 'needs-session',
    };
  }

  const paneEngineId = normalizeComparableText(pane.selectedEngineId);
  const bindingEngineId = normalizeComparableText(binding?.engineId);
  const paneModelId = normalizeComparableText(pane.selectedModelId);
  const bindingModelId = normalizeComparableText(binding?.modelId);
  if (!bindingEngineId || !bindingModelId || paneEngineId !== bindingEngineId || paneModelId !== bindingModelId) {
    return {
      reason: 'engine-model-mismatch',
      status: 'needs-session',
    };
  }

  return {
    reason: 'session-ready',
    status: 'ready',
  };
}

export function buildMultiWindowProvisionedSessionTitle(
  pane: MultiWindowPaneConfig,
  paneIndex: number,
): string {
  const normalizedTitle = normalizeText(pane.title) || `Window ${paneIndex + 1}`;
  const engineId = normalizeText(pane.selectedEngineId);
  const modelId = normalizeText(pane.selectedModelId);
  const modelIdentity = [engineId, modelId].filter(Boolean).join('/');

  return modelIdentity
    ? `${normalizedTitle} - ${modelIdentity}`
    : normalizedTitle;
}
