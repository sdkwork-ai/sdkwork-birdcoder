import {
  MAX_MULTI_WINDOW_PANES,
} from './multiWindowLayout.ts';

export type MultiWindowDispatchPaneStatus =
  | 'pending'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'not-submitted';
export type MultiWindowDispatchBatchStatus =
  | 'success'
  | 'partial-failure'
  | 'failed'
  | 'skipped'
  | 'stopped';

export const DEFAULT_MULTI_WINDOW_MAX_CONCURRENT_DISPATCHES = 4;

export class MultiWindowDispatchStoppedError extends Error {
  constructor() {
    super('Multi-window dispatch stopped before prompt submission');
    this.name = 'MultiWindowDispatchStoppedError';
  }
}

export interface MultiWindowDispatchPromptInput {
  codingSessionId: string;
  pane: MultiWindowDispatchPaneTarget;
  projectId: string;
  prompt: string;
  signal?: AbortSignal;
}

export interface MultiWindowDispatchPaneSendResult {
  codingSessionId?: string;
}

export interface MultiWindowDispatchPaneTarget {
  codingSessionId: string;
  enabled?: boolean;
  id: string;
  projectId: string;
  requiresSessionProvisioning?: boolean;
  sendPrompt: (
    input: MultiWindowDispatchPromptInput,
  ) => Promise<MultiWindowDispatchPaneSendResult | void> | MultiWindowDispatchPaneSendResult | void;
}

export interface MultiWindowDispatchPaneResult {
  codingSessionId: string;
  completedAt?: number;
  durationMs: number;
  errorMessage?: string;
  paneId: string;
  projectId: string;
  startedAt?: number;
  status: MultiWindowDispatchPaneStatus;
}

export interface MultiWindowDispatchBatchSummary {
  completedAt: number;
  dispatchablePaneCount: number;
  durationMs: number;
  effectiveConcurrency: number;
  failedPaneCount: number;
  maxObservedConcurrency: number;
  notSubmittedPaneCount: number;
  pendingPaneCount: number;
  requestedConcurrency: number;
  skippedPaneCount: number;
  startedAt: number;
  successPaneCount: number;
  totalPaneCount: number;
}

export interface DispatchMultiWindowPromptOptions {
  maxConcurrentDispatches?: number;
  onPaneResult?: (result: MultiWindowDispatchPaneResult) => void;
  panes: readonly MultiWindowDispatchPaneTarget[];
  prompt: string;
  signal?: AbortSignal;
}

export interface DispatchMultiWindowPromptResult {
  prompt: string;
  results: MultiWindowDispatchPaneResult[];
  summary: MultiWindowDispatchBatchSummary;
  status: MultiWindowDispatchBatchStatus;
}

export function collectFailedMultiWindowDispatchPaneIds(
  results: readonly MultiWindowDispatchPaneResult[],
): string[] {
  const seenPaneIds = new Set<string>();
  const paneIds: string[] = [];

  for (const result of results) {
    if (result.status !== 'failed') {
      continue;
    }

    const paneId = result.paneId.trim();
    if (!paneId || seenPaneIds.has(paneId)) {
      continue;
    }

    seenPaneIds.add(paneId);
    paneIds.push(paneId);
  }

  return paneIds;
}

function normalizePrompt(value: string): string {
  return value.trim();
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  return 'Dispatch failed';
}

function normalizeDispatchConcurrency(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_MULTI_WINDOW_MAX_CONCURRENT_DISPATCHES;
  }

  return Math.max(1, Math.min(MAX_MULTI_WINDOW_PANES, Math.floor(value)));
}

function shouldDispatchPane(
  pane: MultiWindowDispatchPaneTarget,
  prompt: string,
): boolean {
  return (
    pane.enabled !== false &&
    prompt.length > 0 &&
    pane.projectId.trim().length > 0 &&
    (pane.codingSessionId.trim().length > 0 || pane.requiresSessionProvisioning === true)
  );
}

function resolveBatchStatus(
  results: readonly MultiWindowDispatchPaneResult[],
): MultiWindowDispatchBatchStatus {
  const successCount = results.filter((result) => result.status === 'success').length;
  const failedCount = results.filter((result) => result.status === 'failed').length;
  const notSubmittedCount = results.filter((result) => result.status === 'not-submitted').length;

  if (successCount > 0 && failedCount > 0) {
    return 'partial-failure';
  }
  if (failedCount > 0) {
    return 'failed';
  }
  if (notSubmittedCount > 0) {
    return 'stopped';
  }
  if (successCount > 0) {
    return 'success';
  }
  return 'skipped';
}

function buildBatchSummary({
  completedAt,
  dispatchablePaneCount,
  effectiveConcurrency,
  maxObservedConcurrency,
  requestedConcurrency,
  results,
  startedAt,
  totalPaneCount,
}: {
  completedAt: number;
  dispatchablePaneCount: number;
  effectiveConcurrency: number;
  maxObservedConcurrency: number;
  requestedConcurrency: number;
  results: readonly MultiWindowDispatchPaneResult[];
  startedAt: number;
  totalPaneCount: number;
}): MultiWindowDispatchBatchSummary {
  const successPaneCount = results.filter((result) => result.status === 'success').length;
  const failedPaneCount = results.filter((result) => result.status === 'failed').length;
  const skippedPaneCount = results.filter((result) => result.status === 'skipped').length;
  const notSubmittedPaneCount = results.filter(
    (result) => result.status === 'not-submitted',
  ).length;
  const pendingPaneCount = results.filter((result) => result.status === 'pending').length;

  return {
    completedAt,
    dispatchablePaneCount,
    durationMs: Math.max(0, completedAt - startedAt),
    effectiveConcurrency,
    failedPaneCount,
    maxObservedConcurrency,
    notSubmittedPaneCount,
    pendingPaneCount,
    requestedConcurrency,
    skippedPaneCount,
    startedAt,
    successPaneCount,
    totalPaneCount,
  };
}

function buildSkippedPaneResult(pane: MultiWindowDispatchPaneTarget): MultiWindowDispatchPaneResult {
  return {
    codingSessionId: pane.codingSessionId,
    durationMs: 0,
    paneId: pane.id,
    projectId: pane.projectId,
    status: 'skipped',
  };
}

function buildNotSubmittedPaneResult(
  pane: MultiWindowDispatchPaneTarget,
  stoppedAt = Date.now(),
): MultiWindowDispatchPaneResult {
  return {
    codingSessionId: pane.codingSessionId,
    completedAt: stoppedAt,
    durationMs: 0,
    paneId: pane.id,
    projectId: pane.projectId,
    status: 'not-submitted',
  };
}

function isDispatchStoppedBeforeSubmission(error: unknown): boolean {
  return error instanceof MultiWindowDispatchStoppedError;
}

function publishPaneResult(
  result: MultiWindowDispatchPaneResult,
  onPaneResult?: (result: MultiWindowDispatchPaneResult) => void,
): void {
  try {
    onPaneResult?.({ ...result });
  } catch (error) {
    console.error('Failed to publish multi-window pane progress', error);
  }
}

function readDispatchPaneSendResultCodingSessionId(
  result: MultiWindowDispatchPaneSendResult | void,
): string {
  if (!result || typeof result !== 'object') {
    return '';
  }

  return result.codingSessionId?.trim() ?? '';
}

export async function dispatchMultiWindowPrompt({
  maxConcurrentDispatches,
  onPaneResult,
  panes,
  prompt,
  signal,
}: DispatchMultiWindowPromptOptions): Promise<DispatchMultiWindowPromptResult> {
  const batchStartedAt = Date.now();
  const normalizedPrompt = normalizePrompt(prompt);
  const boundedPanes = panes.slice(0, MAX_MULTI_WINDOW_PANES);
  const results: MultiWindowDispatchPaneResult[] = boundedPanes.map(buildSkippedPaneResult);
  const dispatchablePaneIndexes = boundedPanes
    .map((pane, index) => ({ index, pane }))
    .filter(({ pane }) => shouldDispatchPane(pane, normalizedPrompt));
  results.forEach((result, index) => {
    const pane = boundedPanes[index];
    if (pane && !shouldDispatchPane(pane, normalizedPrompt)) {
      publishPaneResult(result, onPaneResult);
    }
  });
  const requestedConcurrency = normalizeDispatchConcurrency(maxConcurrentDispatches);
  const concurrency =
    dispatchablePaneIndexes.length > 0
      ? Math.min(requestedConcurrency, dispatchablePaneIndexes.length)
      : 0;
  let cursor = 0;
  let activeDispatchCount = 0;
  let maxObservedConcurrency = 0;

  async function runNextPane(): Promise<void> {
    while (cursor < dispatchablePaneIndexes.length) {
      const currentCursor = cursor;
      cursor += 1;
      const target = dispatchablePaneIndexes[currentCursor];
      if (!target) {
        continue;
      }

      const { index, pane } = target;
      if (signal?.aborted) {
        results[index] = buildNotSubmittedPaneResult(pane);
        publishPaneResult(results[index]!, onPaneResult);
        continue;
      }

      const startedAt = Date.now();
      results[index] = {
        codingSessionId: pane.codingSessionId,
        durationMs: 0,
        paneId: pane.id,
        projectId: pane.projectId,
        startedAt,
        status: 'pending',
      };
      publishPaneResult(results[index]!, onPaneResult);
      activeDispatchCount += 1;
      maxObservedConcurrency = Math.max(maxObservedConcurrency, activeDispatchCount);
      try {
        const sendResult = await pane.sendPrompt({
          codingSessionId: pane.codingSessionId,
          pane,
          projectId: pane.projectId,
          prompt: normalizedPrompt,
          signal,
        });
        const effectiveCodingSessionId =
          readDispatchPaneSendResultCodingSessionId(sendResult) || pane.codingSessionId;
        const completedAt = Date.now();
        results[index] = {
          codingSessionId: effectiveCodingSessionId,
          completedAt,
          durationMs: Math.max(0, completedAt - startedAt),
          paneId: pane.id,
          projectId: pane.projectId,
          startedAt,
          status: 'success',
        };
        publishPaneResult(results[index]!, onPaneResult);
      } catch (error) {
        const completedAt = Date.now();
        if (isDispatchStoppedBeforeSubmission(error)) {
          results[index] = buildNotSubmittedPaneResult(pane, completedAt);
          publishPaneResult(results[index]!, onPaneResult);
          continue;
        }

        results[index] = {
          codingSessionId: pane.codingSessionId,
          completedAt,
          durationMs: Math.max(0, completedAt - startedAt),
          errorMessage: resolveErrorMessage(error),
          paneId: pane.id,
          projectId: pane.projectId,
          startedAt,
          status: 'failed',
        };
        publishPaneResult(results[index]!, onPaneResult);
      } finally {
        activeDispatchCount = Math.max(0, activeDispatchCount - 1);
      }
    }
  }

  await Promise.all(
    Array.from({ length: concurrency }, () => runNextPane()),
  );
  const batchCompletedAt = Date.now();

  return {
    prompt: normalizedPrompt,
    results,
    summary: buildBatchSummary({
      completedAt: batchCompletedAt,
      dispatchablePaneCount: dispatchablePaneIndexes.length,
      effectiveConcurrency: concurrency,
      maxObservedConcurrency,
      requestedConcurrency,
      results,
      startedAt: batchStartedAt,
      totalPaneCount: boundedPanes.length,
    }),
    status: resolveBatchStatus(results),
  };
}
