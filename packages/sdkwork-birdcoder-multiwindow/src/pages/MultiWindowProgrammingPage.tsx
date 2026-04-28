import {
  buildProjectCodingSessionIndex,
  buildWorkbenchCodingSessionTurnContext,
  useProjects,
  useToast,
  useWorkbenchPreferences,
} from '@sdkwork/birdcoder-commons';
import type {
  BirdCoderCodingSession,
} from '@sdkwork/birdcoder-types';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MultiWindowComposer } from '../components/MultiWindowComposer.tsx';
import { MultiWindowGrid } from '../components/MultiWindowGrid.tsx';
import { MultiWindowHeader } from '../components/MultiWindowHeader.tsx';
import { MultiWindowSessionPicker } from '../components/MultiWindowSessionPicker.tsx';
import {
  createDefaultMultiWindowPaneConfig,
} from '../runtime/multiWindowConfig.ts';
import {
  buildMultiWindowPendingAddProgress,
  resolveNextMultiWindowAddWindowCount,
} from '../runtime/multiWindowAddFlow.ts';
import {
  buildMultiWindowMessageMetadata,
} from '../runtime/multiWindowMessageMetadata.ts';
import {
  buildMultiWindowPaneDispatchPrompt,
} from '../runtime/multiWindowPromptProfile.ts';
import {
  DEFAULT_MULTI_WINDOW_ACTIVE_WINDOW_COUNT,
  MAX_MULTI_WINDOW_PANES,
  normalizeMultiWindowActiveWindowCount,
  type MultiWindowLayoutCount,
} from '../runtime/multiWindowLayout.ts';
import {
  collectFailedMultiWindowDispatchPaneIds,
  dispatchMultiWindowPrompt,
  type MultiWindowDispatchBatchSummary,
  type MultiWindowDispatchPaneResult,
} from '../runtime/multiWindowDispatch.ts';
import {
  countMultiWindowDispatchablePanes,
  resolveMultiWindowComposerDisabledReason,
  resolveMultiWindowPaneDispatchability,
  type MultiWindowComposerDisabledReason,
} from '../runtime/multiWindowDispatchability.ts';
import {
  buildMultiWindowProvisionedSessionTitle,
  resolveMultiWindowPaneSessionProvisioningStatus,
} from '../runtime/multiWindowSessionProvisioning.ts';
import {
  buildMultiWindowWorkspaceState,
  readMultiWindowWorkspaceState,
  resolveBrowserMultiWindowWorkspaceStorage,
  writeMultiWindowWorkspaceState,
} from '../runtime/multiWindowWorkspaceState.ts';
import type {
  MultiWindowDispatchState,
  MultiWindowGlobalMode,
  MultiWindowPaneBinding,
  MultiWindowPaneConfig,
  MultiWindowPaneRuntimeStatus,
  MultiWindowProgrammingPageProps,
} from '../types.ts';

function buildPaneDispatchResultMap(
  results: readonly MultiWindowDispatchPaneResult[],
): Map<string, MultiWindowDispatchPaneResult> {
  return new Map(
    results.map((result) => [result.paneId, result]),
  );
}

function getSessionEngineId(codingSession: BirdCoderCodingSession | null): string {
  return codingSession?.engineId?.trim() ?? '';
}

function getSessionModelId(codingSession: BirdCoderCodingSession | null): string {
  return codingSession?.modelId?.trim() ?? '';
}

function replacePane(
  panes: readonly MultiWindowPaneConfig[],
  nextPane: MultiWindowPaneConfig,
): MultiWindowPaneConfig[] {
  return panes.map((pane) => (pane.id === nextPane.id ? nextPane : pane));
}

function updatePaneById(
  panes: readonly MultiWindowPaneConfig[],
  paneId: string,
  updater: (pane: MultiWindowPaneConfig) => MultiWindowPaneConfig,
): MultiWindowPaneConfig[] {
  return panes.map((pane) => (pane.id === paneId ? updater(pane) : pane));
}

type MultiWindowPreferencesCarrier = Parameters<typeof createDefaultMultiWindowPaneConfig>[2];

function createFallbackPaneConfigs(
  preferences?: MultiWindowPreferencesCarrier,
): MultiWindowPaneConfig[] {
  return Array.from({ length: MAX_MULTI_WINDOW_PANES }, (_, index) =>
    createDefaultMultiWindowPaneConfig(index, undefined, preferences),
  );
}

function ensureMultiWindowPaneCapacity(
  panes: readonly MultiWindowPaneConfig[],
  preferences?: MultiWindowPreferencesCarrier,
): MultiWindowPaneConfig[] {
  const boundedPanes = panes.slice(0, MAX_MULTI_WINDOW_PANES).map((pane, index) => {
    const fallbackPane = createDefaultMultiWindowPaneConfig(index, undefined, preferences);
    return {
      ...fallbackPane,
      ...pane,
      selectedEngineId: pane.selectedEngineId || fallbackPane.selectedEngineId,
      selectedModelId: pane.selectedModelId || fallbackPane.selectedModelId,
    };
  });
  if (boundedPanes.length >= MAX_MULTI_WINDOW_PANES) {
    return [...boundedPanes];
  }

  return [
    ...boundedPanes,
    ...Array.from({ length: MAX_MULTI_WINDOW_PANES - boundedPanes.length }, (_, offset) =>
      createDefaultMultiWindowPaneConfig(boundedPanes.length + offset, undefined, preferences),
    ),
  ];
}

function moveClosedPaneToInactiveTail(
  panes: readonly MultiWindowPaneConfig[],
  paneId: string,
  preferences?: MultiWindowPreferencesCarrier,
): MultiWindowPaneConfig[] {
  const paneIndex = panes.findIndex((pane) => pane.id === paneId);
  if (paneIndex < 0) {
    return [...panes];
  }

  const closedPane = panes[paneIndex];
  const resetClosedPane = {
    ...createDefaultMultiWindowPaneConfig(paneIndex, undefined, preferences),
    id: closedPane?.id ?? createDefaultMultiWindowPaneConfig(paneIndex, undefined, preferences).id,
  };

  return [
    ...panes.slice(0, paneIndex),
    ...panes.slice(paneIndex + 1),
    resetClosedPane,
  ].slice(0, MAX_MULTI_WINDOW_PANES);
}

function upsertDispatchPaneResult(
  results: readonly MultiWindowDispatchPaneResult[],
  nextResult: MultiWindowDispatchPaneResult,
): MultiWindowDispatchPaneResult[] {
  const existingIndex = results.findIndex((result) => result.paneId === nextResult.paneId);
  if (existingIndex < 0) {
    return [...results, nextResult];
  }

  return results.map((result, index) => (index === existingIndex ? nextResult : result));
}

function mergeDispatchPaneResults(
  previousResults: readonly MultiWindowDispatchPaneResult[],
  nextResults: readonly MultiWindowDispatchPaneResult[],
): MultiWindowDispatchPaneResult[] {
  const nextResultsByPaneId = new Map(
    nextResults.map((result) => [result.paneId, result]),
  );
  const mergedResults = previousResults.map((result) =>
    nextResultsByPaneId.get(result.paneId) ?? result,
  );
  const mergedPaneIds = new Set(mergedResults.map((result) => result.paneId));

  for (const result of nextResults) {
    if (!mergedPaneIds.has(result.paneId)) {
      mergedResults.push(result);
    }
  }

  return mergedResults;
}

function buildInitialDispatchPaneResult(
  pane: MultiWindowPaneConfig,
  binding: MultiWindowPaneBinding | undefined,
): MultiWindowDispatchPaneResult {
  const provisioningStatus = resolveMultiWindowPaneSessionProvisioningStatus(
    pane,
    binding?.codingSession,
  );

  return {
    codingSessionId: pane.codingSessionId,
    durationMs: 0,
    paneId: pane.id,
    projectId: pane.projectId,
    status:
      pane.enabled === false || provisioningStatus.status === 'skipped'
        ? 'skipped'
        : 'pending',
  };
}

function buildCancelledDispatchPaneResult(
  result: MultiWindowDispatchPaneResult,
  completedAt: number,
): MultiWindowDispatchPaneResult {
  return {
    ...result,
    completedAt,
    durationMs:
      typeof result.startedAt === 'number'
        ? Math.max(0, completedAt - result.startedAt)
        : result.durationMs,
    status: 'cancelled',
  };
}

function buildFailedDispatchPaneResult(
  result: MultiWindowDispatchPaneResult,
  completedAt: number,
  errorMessage: string,
): MultiWindowDispatchPaneResult {
  return {
    ...result,
    completedAt,
    durationMs:
      typeof result.startedAt === 'number'
        ? Math.max(0, completedAt - result.startedAt)
        : result.durationMs,
    errorMessage,
    status: 'failed',
  };
}

function resolveUnexpectedDispatchErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return 'Multi-window dispatch failed unexpectedly.';
}

function buildManualCancelDispatchResults({
  bindingsByPaneId,
  completedAt,
  previousResults,
  visiblePanes,
}: {
  bindingsByPaneId: Map<string, MultiWindowPaneBinding>;
  completedAt: number;
  previousResults: readonly MultiWindowDispatchPaneResult[];
  visiblePanes: readonly MultiWindowPaneConfig[];
}): MultiWindowDispatchPaneResult[] {
  const previousResultsByPaneId = new Map(
    previousResults.map((result) => [result.paneId, result]),
  );

  return visiblePanes.map((pane) => {
    const previousResult =
      previousResultsByPaneId.get(pane.id) ??
      buildInitialDispatchPaneResult(pane, bindingsByPaneId.get(pane.id));
    if (previousResult.status !== 'pending') {
      return previousResult;
    }

    return buildCancelledDispatchPaneResult(previousResult, completedAt);
  });
}

function buildUnexpectedFailureDispatchResults({
  bindingsByPaneId,
  completedAt,
  errorMessage,
  previousResults,
  visiblePanes,
}: {
  bindingsByPaneId: Map<string, MultiWindowPaneBinding>;
  completedAt: number;
  errorMessage: string;
  previousResults: readonly MultiWindowDispatchPaneResult[];
  visiblePanes: readonly MultiWindowPaneConfig[];
}): MultiWindowDispatchPaneResult[] {
  const previousResultsByPaneId = new Map(
    previousResults.map((result) => [result.paneId, result]),
  );

  return visiblePanes.map((pane) => {
    const previousResult =
      previousResultsByPaneId.get(pane.id) ??
      buildInitialDispatchPaneResult(pane, bindingsByPaneId.get(pane.id));
    if (previousResult.status !== 'pending') {
      return previousResult;
    }

    return buildFailedDispatchPaneResult(previousResult, completedAt, errorMessage);
  });
}

function buildManualCancelDispatchSummary({
  completedAt,
  previousSummary,
  results,
}: {
  completedAt: number;
  previousSummary: MultiWindowDispatchBatchSummary | null;
  results: readonly MultiWindowDispatchPaneResult[];
}): MultiWindowDispatchBatchSummary {
  const startedAt =
    previousSummary?.startedAt ??
    results
      .map((result) => result.startedAt)
      .find((startedAtValue): startedAtValue is number => typeof startedAtValue === 'number') ??
    completedAt;
  const successPaneCount = results.filter((result) => result.status === 'success').length;
  const failedPaneCount = results.filter((result) => result.status === 'failed').length;
  const skippedPaneCount = results.filter((result) => result.status === 'skipped').length;
  const cancelledPaneCount = results.filter((result) => result.status === 'cancelled').length;
  const pendingPaneCount = results.filter((result) => result.status === 'pending').length;

  return {
    cancelledPaneCount,
    completedAt,
    dispatchablePaneCount: results.length - skippedPaneCount,
    durationMs: Math.max(0, completedAt - startedAt),
    effectiveConcurrency: previousSummary?.effectiveConcurrency ?? 0,
    failedPaneCount,
    maxObservedConcurrency: previousSummary?.maxObservedConcurrency ?? 0,
    pendingPaneCount,
    requestedConcurrency: previousSummary?.requestedConcurrency ?? MAX_MULTI_WINDOW_PANES,
    skippedPaneCount,
    startedAt,
    successPaneCount,
    totalPaneCount: results.length,
  };
}

export const MultiWindowProgrammingPage = memo(function MultiWindowProgrammingPage({
  isVisible = true,
  workspaceId,
  onCodingSessionChange,
  onProjectChange,
}: MultiWindowProgrammingPageProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { preferences } = useWorkbenchPreferences();
  const {
    createCodingSession,
    hasFetched,
    projects,
    sendMessage,
  } = useProjects(workspaceId, {
    isActive: isVisible,
  });
  const [initialWorkspaceState] = useState(() =>
    readMultiWindowWorkspaceState(
      resolveBrowserMultiWindowWorkspaceStorage(),
      workspaceId,
    ),
  );
  const [windowCount, setWindowCount] = useState(
    initialWorkspaceState?.windowCount ?? DEFAULT_MULTI_WINDOW_ACTIVE_WINDOW_COUNT,
  );
  const [panes, setPanes] = useState<MultiWindowPaneConfig[]>(() =>
    initialWorkspaceState?.panes.length
      ? ensureMultiWindowPaneCapacity(initialWorkspaceState.panes, preferences)
      : createFallbackPaneConfigs(preferences),
  );
  const [composerValue, setComposerValue] = useState('');
  const [lastBroadcastPrompt, setLastBroadcastPrompt] = useState('');
  const [dispatchState, setDispatchState] = useState<MultiWindowDispatchState>('idle');
  const [dispatchResults, setDispatchResults] = useState<MultiWindowDispatchPaneResult[]>([]);
  const [dispatchSummary, setDispatchSummary] = useState<MultiWindowDispatchBatchSummary | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [sessionPickerPaneId, setSessionPickerPaneId] = useState<string | null>(null);
  const [pendingWindowCountTarget, setPendingWindowCountTarget] = useState<number | null>(null);
  const [creatingSessionPaneId, setCreatingSessionPaneId] = useState<string | null>(null);
  const activeWorkspaceIdRef = useRef(workspaceId);
  const activeDispatchBatchIdRef = useRef<string | null>(null);
  const activeDispatchAbortControllerRef = useRef<AbortController | null>(null);
  const sessionIndex = useMemo(
    () => buildProjectCodingSessionIndex(projects),
    [projects],
  );
  const visiblePanes = useMemo(
    () => panes.slice(0, windowCount),
    [panes, windowCount],
  );
  const dispatchResultsByPaneId = useMemo(
    () => buildPaneDispatchResultMap(dispatchResults),
    [dispatchResults],
  );
  const retryFailedPaneIds = useMemo(
    () => collectFailedMultiWindowDispatchPaneIds(dispatchResults),
    [dispatchResults],
  );
  const visibleRetryFailedPaneIds = useMemo(() => {
    const visiblePaneIds = new Set(visiblePanes.map((pane) => pane.id));
    return retryFailedPaneIds.filter((paneId) => visiblePaneIds.has(paneId));
  }, [retryFailedPaneIds, visiblePanes]);
  const retryableFailedPaneIds = useMemo(
    () =>
      !isDispatching && lastBroadcastPrompt.trim().length > 0
        ? new Set(visibleRetryFailedPaneIds)
        : new Set<string>(),
    [isDispatching, lastBroadcastPrompt, visibleRetryFailedPaneIds],
  );
  const canRetryFailed =
    !isDispatching &&
    lastBroadcastPrompt.trim().length > 0 &&
    visibleRetryFailedPaneIds.length > 0;
  const selectedPickerPane =
    sessionPickerPaneId
      ? panes.find((pane) => pane.id === sessionPickerPaneId) ?? null
      : null;
  const selectedPickerPaneIndex = selectedPickerPane
    ? panes.findIndex((pane) => pane.id === selectedPickerPane.id)
    : -1;
  const sessionPickerAddProgress = useMemo(
    () =>
      buildMultiWindowPendingAddProgress({
        paneIndex: selectedPickerPaneIndex,
        pendingWindowCountTarget,
        windowCount,
      }),
    [pendingWindowCountTarget, selectedPickerPaneIndex, windowCount],
  );

  const isActiveDispatchBatch = useCallback((batchId: string) =>
    activeDispatchBatchIdRef.current === batchId,
  []);

  const cancelActiveDispatchBatch = useCallback((options: { resetDispatching?: boolean } = {}) => {
    activeDispatchAbortControllerRef.current?.abort();
    activeDispatchAbortControllerRef.current = null;
    activeDispatchBatchIdRef.current = null;
    if (options.resetDispatching !== false) {
      setIsDispatching(false);
    }
  }, []);

  useEffect(() => {
    if (activeWorkspaceIdRef.current === workspaceId) {
      return;
    }

    cancelActiveDispatchBatch();
    activeWorkspaceIdRef.current = workspaceId;
    const nextWorkspaceState = readMultiWindowWorkspaceState(
      resolveBrowserMultiWindowWorkspaceStorage(),
      workspaceId,
    );
    setWindowCount(nextWorkspaceState?.windowCount ?? DEFAULT_MULTI_WINDOW_ACTIVE_WINDOW_COUNT);
    setPanes(
      nextWorkspaceState?.panes.length
        ? ensureMultiWindowPaneCapacity(nextWorkspaceState.panes, preferences)
        : createFallbackPaneConfigs(preferences),
    );
    setDispatchState('idle');
    setDispatchResults([]);
    setDispatchSummary(null);
    setLastBroadcastPrompt('');
    setSessionPickerPaneId(null);
    setPendingWindowCountTarget(null);
    setCreatingSessionPaneId(null);
  }, [cancelActiveDispatchBatch, preferences, workspaceId]);

  useEffect(() => {
    writeMultiWindowWorkspaceState(
      resolveBrowserMultiWindowWorkspaceStorage(),
      buildMultiWindowWorkspaceState({
        panes,
        windowCount,
        workspaceId,
      }),
    );
  }, [panes, windowCount, workspaceId]);

  useEffect(() => () => {
    cancelActiveDispatchBatch({ resetDispatching: false });
  }, [cancelActiveDispatchBatch]);

  const bindingsByPaneId = useMemo(() => {
    const bindings = new Map<string, MultiWindowPaneBinding>();
    for (const pane of panes) {
      const sessionLocation = sessionIndex.codingSessionLocationsById.get(pane.codingSessionId);
      const project =
        sessionLocation?.project ??
        sessionIndex.projectsById.get(pane.projectId) ??
        null;
      const codingSession =
        sessionLocation?.codingSession ??
        project?.codingSessions.find((session) => session.id === pane.codingSessionId) ??
        null;
      bindings.set(pane.id, {
        codingSession,
        messages: codingSession?.messages ?? [],
        project,
      });
    }

    return bindings;
  }, [panes, sessionIndex]);
  const visiblePaneDispatchabilityInputs = useMemo(
    () =>
      visiblePanes.map((pane) => ({
        pane,
        binding: bindingsByPaneId.get(pane.id)?.codingSession,
      })),
    [bindingsByPaneId, visiblePanes],
  );
  const paneDispatchabilityByPaneId = useMemo(
    () =>
      new Map(
        visiblePaneDispatchabilityInputs.map(({ pane, binding }) => [
          pane.id,
          resolveMultiWindowPaneDispatchability(pane, binding),
        ]),
      ),
    [visiblePaneDispatchabilityInputs],
  );
  const visibleDispatchablePaneCount = useMemo(
    () => countMultiWindowDispatchablePanes(visiblePaneDispatchabilityInputs),
    [visiblePaneDispatchabilityInputs],
  );
  const composerDisabledReason: MultiWindowComposerDisabledReason | null = useMemo(
    () =>
      resolveMultiWindowComposerDisabledReason({
        dispatchablePaneCount: visibleDispatchablePaneCount,
        hasFetchedProjects: hasFetched,
        projectCount: projects.length,
        visiblePaneCount: visiblePanes.length,
      }),
    [hasFetched, projects.length, visibleDispatchablePaneCount, visiblePanes.length],
  );
  const composerDisabledReasonText = composerDisabledReason
    ? t(`multiWindow.broadcastDisabledReason.${composerDisabledReason}`)
    : '';

  const handlePaneChange = useCallback((nextPane: MultiWindowPaneConfig) => {
    setPanes((previousPanes) => replacePane(previousPanes, nextPane));
  }, []);

  const handleSetAllPaneModes = useCallback((mode: MultiWindowGlobalMode) => {
    setPanes((previousPanes) =>
      previousPanes.map((pane, index) =>
        index < windowCount
          ? {
              ...pane,
              mode,
            }
          : pane,
      ),
    );
  }, [windowCount]);

  const handleWindowCountChange = useCallback((count: MultiWindowLayoutCount) => {
    const nextWindowCount = normalizeMultiWindowActiveWindowCount(count);
    if (nextWindowCount <= windowCount) {
      setPendingWindowCountTarget(null);
      setSessionPickerPaneId((currentPaneId) => {
        if (!currentPaneId) {
          return null;
        }
        const currentPaneIndex = panes.findIndex((pane) => pane.id === currentPaneId);
        return currentPaneIndex >= nextWindowCount ? null : currentPaneId;
      });
      setWindowCount(nextWindowCount);
      return;
    }

    const targetPane = panes[windowCount];
    if (targetPane) {
      setPendingWindowCountTarget(nextWindowCount);
      setSessionPickerPaneId(targetPane.id);
    }
  }, [panes, windowCount]);

  const handleAddWindow = useCallback(() => {
    const nextWindowCount = resolveNextMultiWindowAddWindowCount(windowCount);
    if (nextWindowCount === windowCount) {
      return;
    }

    const targetPane = panes[windowCount];
    if (targetPane) {
      setPendingWindowCountTarget(nextWindowCount);
      setSessionPickerPaneId(targetPane.id);
    }
  }, [panes, windowCount]);

  const handleCloseWindow = useCallback((paneId: string) => {
    setSessionPickerPaneId((currentPaneId) => (currentPaneId === paneId ? null : currentPaneId));
    setPendingWindowCountTarget(null);
    setPanes((previousPanes) =>
      moveClosedPaneToInactiveTail(previousPanes, paneId, preferences),
    );
    setWindowCount((previousWindowCount) =>
      normalizeMultiWindowActiveWindowCount(previousWindowCount - 1),
    );
    setDispatchResults((previousResults) =>
      previousResults.filter((result) => result.paneId !== paneId),
    );
  }, [preferences]);

  const activateSelectedPickerPane = useCallback((paneId: string): number => {
    const paneIndex = panes.findIndex((pane) => pane.id === paneId);
    if (paneIndex < 0 || paneIndex < windowCount) {
      return windowCount;
    }

    const nextWindowCount = normalizeMultiWindowActiveWindowCount(paneIndex + 1);
    setWindowCount(nextWindowCount);
    return nextWindowCount;
  }, [panes, windowCount]);

  const resolveNextPickerAfterActivation = useCallback((activatedWindowCount: number) => {
    const targetWindowCount = pendingWindowCountTarget ?? activatedWindowCount;
    if (targetWindowCount > activatedWindowCount) {
      const nextPane = panes[activatedWindowCount];
      if (nextPane) {
        setSessionPickerPaneId(nextPane.id);
        return;
      }
    }

    setPendingWindowCountTarget(null);
    setSessionPickerPaneId(null);
  }, [panes, pendingWindowCountTarget]);

  const handleCloseSessionPicker = useCallback(() => {
    setPendingWindowCountTarget(null);
    setSessionPickerPaneId(null);
  }, []);

  const handleStopPendingAddSequence = useCallback(() => {
    setPendingWindowCountTarget(null);
  }, []);

  const handleSelectSessionForPane = useCallback((nextProjectId: string, nextCodingSessionId: string) => {
    if (!selectedPickerPane) {
      return;
    }

    const sessionLocation = sessionIndex.codingSessionLocationsById.get(nextCodingSessionId);
    const codingSession = sessionLocation?.codingSession ?? null;
    setPanes((previousPanes) =>
      updatePaneById(previousPanes, selectedPickerPane.id, (pane) => ({
        ...pane,
        codingSessionId: nextCodingSessionId,
        projectId: nextProjectId,
        selectedEngineId: getSessionEngineId(codingSession) || pane.selectedEngineId,
        selectedModelId: getSessionModelId(codingSession) || pane.selectedModelId,
        title: codingSession?.title ? `${selectedPickerPane.title.split('.')[0]}. ${codingSession.title}` : pane.title,
      })),
    );
    onProjectChange?.(nextProjectId);
    onCodingSessionChange?.(nextCodingSessionId);
    resolveNextPickerAfterActivation(activateSelectedPickerPane(selectedPickerPane.id));
  }, [
    activateSelectedPickerPane,
    onCodingSessionChange,
    onProjectChange,
    resolveNextPickerAfterActivation,
    selectedPickerPane,
    sessionIndex,
  ]);

  const handleCreateSessionForPane = useCallback(async (nextProjectId: string) => {
    if (!selectedPickerPane) {
      return;
    }

    setCreatingSessionPaneId(selectedPickerPane.id);
    try {
      const newSession = await createCodingSession(
        nextProjectId,
        t('multiWindow.newSessionTitle', { index: panes.indexOf(selectedPickerPane) + 1 }),
        {
          engineId: selectedPickerPane.selectedEngineId,
          modelId: selectedPickerPane.selectedModelId,
        },
      );
      setPanes((previousPanes) =>
        updatePaneById(previousPanes, selectedPickerPane.id, (pane) => ({
          ...pane,
          codingSessionId: newSession.id,
          projectId: nextProjectId,
          selectedEngineId: newSession.engineId?.trim() || pane.selectedEngineId,
          selectedModelId: newSession.modelId?.trim() || pane.selectedModelId,
          title: `${panes.indexOf(selectedPickerPane) + 1}. ${newSession.title}`,
        })),
      );
      onProjectChange?.(nextProjectId);
      onCodingSessionChange?.(newSession.id);
      resolveNextPickerAfterActivation(activateSelectedPickerPane(selectedPickerPane.id));
      addToast(t('multiWindow.sessionCreated'), 'success');
    } catch (error) {
      console.error('Failed to create multi-window coding session', error);
      addToast(t('multiWindow.failedToCreateSession'), 'error');
    } finally {
      setCreatingSessionPaneId(null);
    }
  }, [
    addToast,
    activateSelectedPickerPane,
    createCodingSession,
    onCodingSessionChange,
    onProjectChange,
    panes,
    resolveNextPickerAfterActivation,
    selectedPickerPane,
    t,
  ]);

  const dispatchPromptToPanes = useCallback(async (
    rawPrompt: string,
    options: {
      clearComposerOnSuccess?: boolean;
      targetPaneIds?: readonly string[];
    } = {},
  ) => {
    const prompt = rawPrompt.trim();
    const targetPaneIds = options.targetPaneIds
      ? new Set(options.targetPaneIds.map((paneId) => paneId.trim()).filter(Boolean))
      : null;
    const panesToDispatch = targetPaneIds
      ? visiblePanes.filter((pane) => targetPaneIds.has(pane.id))
      : visiblePanes;

    if (!prompt || isDispatching || (targetPaneIds && panesToDispatch.length === 0)) {
      return;
    }

    const dispatchBatchId = `multiwindow-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const dispatchAbortController = new AbortController();
    const previousResultsByPaneId = new Map(
      dispatchResults.map((result) => [result.paneId, result]),
    );
    cancelActiveDispatchBatch();
    activeDispatchBatchIdRef.current = dispatchBatchId;
    activeDispatchAbortControllerRef.current = dispatchAbortController;
    setLastBroadcastPrompt(prompt);
    setIsDispatching(true);
    setDispatchState('running');
    setDispatchSummary(null);
    const initialDispatchResults = visiblePanes.map((pane) => {
      if (targetPaneIds && !targetPaneIds.has(pane.id)) {
        return (
          previousResultsByPaneId.get(pane.id) ??
          buildInitialDispatchPaneResult(pane, bindingsByPaneId.get(pane.id))
        );
      }

      return buildInitialDispatchPaneResult(pane, bindingsByPaneId.get(pane.id));
    });
    setDispatchResults(initialDispatchResults);
    const broadcastId = dispatchBatchId;
    const dispatchTargets = panesToDispatch.map((pane) => ({
      pane,
      paneIndex: Math.max(0, visiblePanes.findIndex((visiblePane) => visiblePane.id === pane.id)),
    }));

    try {
      const result = await dispatchMultiWindowPrompt({
        maxConcurrentDispatches: MAX_MULTI_WINDOW_PANES,
        onPaneResult: (paneResult) => {
          if (!isActiveDispatchBatch(dispatchBatchId)) {
            return;
          }

          setDispatchResults((previousResults) =>
            upsertDispatchPaneResult(previousResults, paneResult),
          );
        },
        panes: dispatchTargets.map(({ pane, paneIndex }) => ({
          codingSessionId: pane.codingSessionId,
          enabled: pane.enabled,
          id: pane.id,
          projectId: pane.projectId,
          requiresSessionProvisioning:
            resolveMultiWindowPaneSessionProvisioningStatus(
              pane,
              bindingsByPaneId.get(pane.id)?.codingSession,
            ).status === 'needs-session',
          sendPrompt: async ({ prompt: dispatchPrompt }) => {
            if (!isActiveDispatchBatch(dispatchBatchId) || dispatchAbortController.signal.aborted) {
              throw new Error('Dispatch cancelled');
            }

            let effectivePane = pane;
            let effectiveCodingSessionId = pane.codingSessionId;
            const provisioningStatus = resolveMultiWindowPaneSessionProvisioningStatus(
              pane,
              bindingsByPaneId.get(pane.id)?.codingSession,
            );
            if (provisioningStatus.status === 'needs-session') {
              const provisionedSession = await createCodingSession(
                pane.projectId,
                buildMultiWindowProvisionedSessionTitle(pane, paneIndex),
                {
                  engineId: pane.selectedEngineId,
                  modelId: pane.selectedModelId,
                },
              );
              if (!isActiveDispatchBatch(dispatchBatchId) || dispatchAbortController.signal.aborted) {
                throw new Error('Dispatch cancelled');
              }

              effectiveCodingSessionId = provisionedSession.id;
              effectivePane = {
                ...pane,
                codingSessionId: provisionedSession.id,
                projectId: provisionedSession.projectId?.trim() || pane.projectId,
                selectedEngineId: provisionedSession.engineId?.trim() || pane.selectedEngineId,
                selectedModelId: provisionedSession.modelId?.trim() || pane.selectedModelId,
                title: buildMultiWindowProvisionedSessionTitle(pane, paneIndex),
              };
              setPanes((previousPanes) =>
                updatePaneById(previousPanes, pane.id, () => effectivePane),
              );
              onProjectChange?.(effectivePane.projectId);
              onCodingSessionChange?.(effectiveCodingSessionId);
            }

            const context = buildWorkbenchCodingSessionTurnContext({
              projectId: effectivePane.projectId,
              sessionId: effectiveCodingSessionId,
              workspaceId,
            });
            const dispatchPromptProfile = buildMultiWindowPaneDispatchPrompt(
              dispatchPrompt,
              effectivePane,
            );
            const sentMessage = await sendMessage(
              effectivePane.projectId,
              effectiveCodingSessionId,
              dispatchPromptProfile.prompt,
              context,
              {
                metadata: buildMultiWindowMessageMetadata({
                  broadcastId,
                  executionProfile: dispatchPromptProfile.executionProfile,
                  pane: effectivePane,
                  paneIndex,
                  windowCount,
                }),
              },
            );
            if (!isActiveDispatchBatch(dispatchBatchId) || dispatchAbortController.signal.aborted) {
              throw new Error('Dispatch cancelled');
            }

            const nextCodingSessionId = sentMessage?.codingSessionId?.trim() ?? '';
            if (nextCodingSessionId && nextCodingSessionId !== effectiveCodingSessionId) {
              setPanes((previousPanes) =>
                updatePaneById(previousPanes, pane.id, (currentPane) => ({
                  ...currentPane,
                  codingSessionId: nextCodingSessionId,
                })),
              );
              return {
                codingSessionId: nextCodingSessionId,
              };
            }

            return {
              codingSessionId: effectiveCodingSessionId,
            };
          },
        })),
        prompt,
        signal: dispatchAbortController.signal,
      });

      if (!isActiveDispatchBatch(dispatchBatchId)) {
        return;
      }

      setDispatchResults((previousResults) =>
        targetPaneIds
          ? mergeDispatchPaneResults(previousResults, result.results)
          : result.results,
      );
      setDispatchSummary(result.summary);
      setDispatchState(result.status);
      if (result.status === 'success') {
        if (options.clearComposerOnSuccess !== false) {
          setComposerValue('');
        }
        addToast(t('multiWindow.dispatchSucceeded'), 'success');
        return;
      }
      if (result.status === 'partial-failure') {
        addToast(t('multiWindow.dispatchPartialFailure'), 'error');
        return;
      }
      if (result.status === 'failed') {
        addToast(t('multiWindow.dispatchFailed'), 'error');
        return;
      }
      if (result.status === 'cancelled') {
        addToast(t('multiWindow.dispatchCancelled'), 'info');
        return;
      }
      addToast(t('multiWindow.dispatchSkipped'), 'info');
    } catch (error) {
      if (!isActiveDispatchBatch(dispatchBatchId)) {
        return;
      }

      console.error('Failed to dispatch multi-window prompt', error);
      const completedAt = Date.now();
      const errorMessage = resolveUnexpectedDispatchErrorMessage(error);
      const failedResults = buildUnexpectedFailureDispatchResults({
        bindingsByPaneId,
        completedAt,
        errorMessage,
        previousResults: initialDispatchResults,
        visiblePanes,
      });
      setDispatchResults(failedResults);
      setDispatchSummary(
        buildManualCancelDispatchSummary({
          completedAt,
          previousSummary: dispatchSummary,
          results: failedResults,
        }),
      );
      setDispatchState('failed');
      addToast(t('multiWindow.dispatchFailed'), 'error');
    } finally {
      if (isActiveDispatchBatch(dispatchBatchId)) {
        activeDispatchBatchIdRef.current = null;
        activeDispatchAbortControllerRef.current = null;
        setIsDispatching(false);
      }
    }
  }, [
    addToast,
    bindingsByPaneId,
    cancelActiveDispatchBatch,
    createCodingSession,
    dispatchResults,
    dispatchSummary,
    isActiveDispatchBatch,
    isDispatching,
    onCodingSessionChange,
    onProjectChange,
    sendMessage,
    t,
    visiblePanes,
    windowCount,
    workspaceId,
  ]);

  const handleBroadcastPrompt = useCallback(async () => {
    await dispatchPromptToPanes(composerValue, {
      clearComposerOnSuccess: true,
    });
  }, [composerValue, dispatchPromptToPanes]);

  const handleRetryFailedPrompt = useCallback(async () => {
    await dispatchPromptToPanes(lastBroadcastPrompt, {
      clearComposerOnSuccess: false,
      targetPaneIds: collectFailedMultiWindowDispatchPaneIds(dispatchResults),
    });
  }, [dispatchPromptToPanes, dispatchResults, lastBroadcastPrompt]);

  const handleRetryPanePrompt = useCallback(async (paneId: string) => {
    if (!visibleRetryFailedPaneIds.includes(paneId)) {
      return;
    }

    await dispatchPromptToPanes(lastBroadcastPrompt, {
      clearComposerOnSuccess: false,
      targetPaneIds: [paneId],
    });
  }, [dispatchPromptToPanes, lastBroadcastPrompt, visibleRetryFailedPaneIds]);

  const handleCancelDispatch = useCallback(() => {
    if (!isDispatching) {
      return;
    }

    const completedAt = Date.now();
    const nextResults = buildManualCancelDispatchResults({
      bindingsByPaneId,
      completedAt,
      previousResults: dispatchResults,
      visiblePanes,
    });
    cancelActiveDispatchBatch();
    setDispatchResults(nextResults);
    setDispatchSummary(
      buildManualCancelDispatchSummary({
        completedAt,
        previousSummary: dispatchSummary,
        results: nextResults,
      }),
    );
    setDispatchState('cancelled');
    addToast(t('multiWindow.dispatchCancelled'), 'info');
  }, [
    addToast,
    bindingsByPaneId,
    cancelActiveDispatchBatch,
    dispatchResults,
    dispatchSummary,
    isDispatching,
    t,
    visiblePanes,
  ]);

  return (
    <div className="relative flex h-full w-full min-w-0 flex-col bg-[#0e0e11] text-gray-200">
      <MultiWindowHeader
        dispatchablePaneCount={visibleDispatchablePaneCount}
        dispatchState={dispatchState}
        windowCount={windowCount}
        onAddWindow={handleAddWindow}
        onSetAllPaneModes={handleSetAllPaneModes}
        onWindowCountChange={handleWindowCountChange}
      />
      <MultiWindowGrid
        bindingsByPaneId={bindingsByPaneId}
        dispatchResultsByPaneId={dispatchResultsByPaneId}
        paneDispatchabilityByPaneId={paneDispatchabilityByPaneId}
        panes={panes}
        preferences={preferences}
        retryableFailedPaneIds={retryableFailedPaneIds}
        windowCount={windowCount}
        onAddWindow={handleAddWindow}
        onClosePane={handleCloseWindow}
        onOpenSessionPicker={setSessionPickerPaneId}
        onPaneChange={handlePaneChange}
        onRetryPane={handleRetryPanePrompt}
      />
      <MultiWindowComposer
        canRetryFailed={canRetryFailed}
        disabledReason={composerDisabledReasonText}
        dispatchSummary={dispatchSummary}
        dispatchState={dispatchState}
        disabled={Boolean(composerDisabledReasonText)}
        isDispatching={isDispatching}
        value={composerValue}
        onCancelDispatch={handleCancelDispatch}
        onRetryFailed={handleRetryFailedPrompt}
        onSubmit={handleBroadcastPrompt}
        onValueChange={setComposerValue}
      />
      {selectedPickerPane ? (
        <MultiWindowSessionPicker
          isCreatingSession={creatingSessionPaneId === selectedPickerPane.id}
          addProgress={sessionPickerAddProgress}
          pane={selectedPickerPane}
          preferences={preferences}
          projects={projects}
          selectedCodingSessionId={selectedPickerPane.codingSessionId}
          selectedProjectId={selectedPickerPane.projectId}
          onClose={handleCloseSessionPicker}
          onCreateSession={handleCreateSessionForPane}
          onPaneChange={handlePaneChange}
          onSelectSession={handleSelectSessionForPane}
          onStopPendingAddSequence={handleStopPendingAddSequence}
        />
      ) : null}
    </div>
  );
});

MultiWindowProgrammingPage.displayName = 'MultiWindowProgrammingPage';
