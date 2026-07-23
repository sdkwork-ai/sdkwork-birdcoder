import {
  buildAgentSessionProjectScopedKey,
  buildProjectAgentSessionIndex,
  buildWorkbenchAgentSessionTurnContext,
  useProjects,
  useToast,
  useWorkbenchChatSelection,
  useWorkbenchAgentSessionCreationActions,
  useWorkbenchPreferences,
} from '@sdkwork/birdcoder-pc-workbench';
import type {
  AgentSessionView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
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
  DEFAULT_MULTI_WINDOW_MAX_CONCURRENT_DISPATCHES,
  dispatchMultiWindowPrompt,
  MultiWindowDispatchStoppedError,
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
  buildMultiWindowLayoutState,
  MULTI_WINDOW_DEFAULT_LAYOUT_SCOPE_ID,
  readMultiWindowLayoutState,
  resolveBrowserMultiWindowLayoutStorage,
  type MultiWindowLayoutState,
  writeMultiWindowLayoutState,
} from '../runtime/multiWindowLayoutState.ts';
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

function getSessionEngineId(agentSession: AgentSessionView | null): string {
  return agentSession?.engineId?.trim() ?? '';
}

function getSessionModelId(agentSession: AgentSessionView | null): string {
  return agentSession?.modelId?.trim() ?? '';
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

const MULTI_WINDOW_LAYOUT_STATE_PERSIST_DELAY_MS = 160;

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
    binding?.agentSession,
  );

  return {
    agentSessionId: pane.agentSessionId,
    durationMs: 0,
    paneId: pane.id,
    projectId: pane.projectId,
    status:
      pane.enabled === false || provisioningStatus.status === 'skipped'
        ? 'skipped'
        : 'pending',
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

function buildFallbackDispatchSummary({
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
  const notSubmittedPaneCount = results.filter(
    (result) => result.status === 'not-submitted',
  ).length;
  const pendingPaneCount = results.filter((result) => result.status === 'pending').length;

  return {
    completedAt,
    dispatchablePaneCount: results.length - skippedPaneCount,
    durationMs: Math.max(0, completedAt - startedAt),
    effectiveConcurrency: previousSummary?.effectiveConcurrency ?? 0,
    failedPaneCount,
    maxObservedConcurrency: previousSummary?.maxObservedConcurrency ?? 0,
    notSubmittedPaneCount,
    pendingPaneCount,
    requestedConcurrency:
      previousSummary?.requestedConcurrency ?? DEFAULT_MULTI_WINDOW_MAX_CONCURRENT_DISPATCHES,
    skippedPaneCount,
    startedAt,
    successPaneCount,
    totalPaneCount: results.length,
  };
}

export const MultiWindowProgrammingPage = memo(function MultiWindowProgrammingPage({
  initialAgentSessionId,
  isVisible = true,
  projectId,
  onAgentSessionChange,
  onProjectChange,
}: MultiWindowProgrammingPageProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { preferences, updatePreferences } = useWorkbenchPreferences();
  const {
    createAgentSession,
    hasFetched,
    projects,
    sendMessage,
  } = useProjects({
    isActive: isVisible,
    targetProjectId: projectId,
  });
  const { createAgentSessionWithSelection } = useWorkbenchChatSelection({
    createAgentSession,
    preferences,
    updatePreferences,
  });
  const { createAgentSessionFromRequest } = useWorkbenchAgentSessionCreationActions({
    addToast,
    createAgentSessionWithSelection,
    currentProjectId: projectId?.trim() ?? '',
    selectAgentSession: () => undefined,
    labels: {
      creationFailed: t('multiWindow.failedToCreateSession'),
      creationSucceeded: t('multiWindow.sessionCreated'),
      noProjectSelected: t('multiWindow.selectProjectFirst'),
    },
  });
  const [initialLayoutState] = useState(() =>
    readMultiWindowLayoutState(
      resolveBrowserMultiWindowLayoutStorage(),
      MULTI_WINDOW_DEFAULT_LAYOUT_SCOPE_ID,
    ),
  );
  const [windowCount, setWindowCount] = useState(
    initialLayoutState?.windowCount ?? DEFAULT_MULTI_WINDOW_ACTIVE_WINDOW_COUNT,
  );
  const [panes, setPanes] = useState<MultiWindowPaneConfig[]>(() =>
    initialLayoutState?.panes.length
      ? ensureMultiWindowPaneCapacity(initialLayoutState.panes, preferences)
      : createFallbackPaneConfigs(preferences),
  );
  const [composerValue, setComposerValue] = useState('');
  const [lastBroadcastPrompt, setLastBroadcastPrompt] = useState('');
  const [dispatchState, setDispatchState] = useState<MultiWindowDispatchState>('idle');
  const [dispatchResults, setDispatchResults] = useState<MultiWindowDispatchPaneResult[]>([]);
  const [dispatchSummary, setDispatchSummary] = useState<MultiWindowDispatchBatchSummary | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [isStoppingDispatch, setIsStoppingDispatch] = useState(false);
  const [sessionPickerPaneId, setSessionPickerPaneId] = useState<string | null>(null);
  const [pendingWindowCountTarget, setPendingWindowCountTarget] = useState<number | null>(null);
  const [creatingSessionPaneId, setCreatingSessionPaneId] = useState<string | null>(null);
  const activeDispatchBatchIdRef = useRef<string | null>(null);
  const activeDispatchAbortControllerRef = useRef<AbortController | null>(null);
  const pendingLayoutStatePersistenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLayoutStatePersistenceRef = useRef<MultiWindowLayoutState | null>(null);
  const sessionIndex = useMemo(
    () => buildProjectAgentSessionIndex(projects),
    [projects],
  );
  const notifyActiveAgentSessionSelection = useCallback((
    nextProjectId: string,
    nextAgentSessionId: string,
  ) => {
    if (!isVisible) {
      return;
    }

    onProjectChange?.(nextProjectId);
    onAgentSessionChange?.(nextAgentSessionId, nextProjectId);
  }, [isVisible, onAgentSessionChange, onProjectChange]);
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

  const discardActiveDispatchBatch = useCallback((options: { resetDispatching?: boolean } = {}) => {
    activeDispatchAbortControllerRef.current?.abort();
    activeDispatchAbortControllerRef.current = null;
    activeDispatchBatchIdRef.current = null;
    setIsStoppingDispatch(false);
    if (options.resetDispatching !== false) {
      setIsDispatching(false);
    }
  }, []);

  const flushPendingMultiWindowLayoutStatePersistence = useCallback(() => {
    if (pendingLayoutStatePersistenceTimeoutRef.current !== null) {
      clearTimeout(pendingLayoutStatePersistenceTimeoutRef.current);
      pendingLayoutStatePersistenceTimeoutRef.current = null;
    }

    const pendingLayoutState = pendingLayoutStatePersistenceRef.current;
    pendingLayoutStatePersistenceRef.current = null;
    if (!pendingLayoutState) {
      return;
    }

    writeMultiWindowLayoutState(
      resolveBrowserMultiWindowLayoutStorage(),
      pendingLayoutState,
    );
  }, []);

  const scheduleMultiWindowLayoutStatePersistence = useCallback((
    layoutState: MultiWindowLayoutState,
  ) => {
    pendingLayoutStatePersistenceRef.current = layoutState;
    if (pendingLayoutStatePersistenceTimeoutRef.current !== null) {
      clearTimeout(pendingLayoutStatePersistenceTimeoutRef.current);
    }

    pendingLayoutStatePersistenceTimeoutRef.current = setTimeout(() => {
      pendingLayoutStatePersistenceTimeoutRef.current = null;
      const pendingLayoutState = pendingLayoutStatePersistenceRef.current;
      pendingLayoutStatePersistenceRef.current = null;
      if (!pendingLayoutState) {
        return;
      }

      writeMultiWindowLayoutState(
        resolveBrowserMultiWindowLayoutStorage(),
        pendingLayoutState,
      );
    }, MULTI_WINDOW_LAYOUT_STATE_PERSIST_DELAY_MS);
  }, []);

  useEffect(() => {
    scheduleMultiWindowLayoutStatePersistence(
      buildMultiWindowLayoutState({
        layoutScopeId: MULTI_WINDOW_DEFAULT_LAYOUT_SCOPE_ID,
        panes,
        windowCount,
      }),
    );
  }, [panes, scheduleMultiWindowLayoutStatePersistence, windowCount]);

  useEffect(() => () => {
    flushPendingMultiWindowLayoutStatePersistence();
    discardActiveDispatchBatch({ resetDispatching: false });
  }, [discardActiveDispatchBatch, flushPendingMultiWindowLayoutStatePersistence]);

  const bindingsByPaneId = useMemo(() => {
    const bindings = new Map<string, MultiWindowPaneBinding>();
    for (const pane of panes) {
      const sessionLocation =
        pane.projectId && pane.agentSessionId
          ? sessionIndex.agentSessionLocationsByProjectIdAndId.get(
              buildAgentSessionProjectScopedKey(pane.projectId, pane.agentSessionId),
            ) ?? null
          : null;
      const project =
        sessionLocation?.project ??
        sessionIndex.projectsById.get(pane.projectId) ??
        null;
      const agentSession =
        sessionLocation?.agentSession ??
        project?.agentSessions.find((session) => session.id === pane.agentSessionId) ??
        null;
      bindings.set(pane.id, {
        agentSession,
        messages: agentSession?.items ?? [],
        project,
      });
    }

    return bindings;
  }, [panes, sessionIndex]);
  const visiblePaneDispatchabilityInputs = useMemo(
    () =>
      visiblePanes.map((pane) => ({
        pane,
        binding: bindingsByPaneId.get(pane.id)?.agentSession,
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

  const handleSelectSessionForPane = useCallback((nextProjectId: string, nextAgentSessionId: string) => {
    if (!selectedPickerPane) {
      return;
    }

    const sessionLocation =
      sessionIndex.agentSessionLocationsByProjectIdAndId.get(
        buildAgentSessionProjectScopedKey(nextProjectId, nextAgentSessionId),
      ) ?? null;
    const agentSession = sessionLocation?.agentSession ?? null;
    setPanes((previousPanes) =>
      updatePaneById(previousPanes, selectedPickerPane.id, (pane) => ({
        ...pane,
        agentSessionId: nextAgentSessionId,
        projectId: nextProjectId,
        selectedEngineId: getSessionEngineId(agentSession) || pane.selectedEngineId,
        selectedModelId: getSessionModelId(agentSession) || pane.selectedModelId,
        title: agentSession?.title ? `${selectedPickerPane.title.split('.')[0]}. ${agentSession.title}` : pane.title,
      })),
    );
    notifyActiveAgentSessionSelection(nextProjectId, nextAgentSessionId);
    resolveNextPickerAfterActivation(activateSelectedPickerPane(selectedPickerPane.id));
  }, [
    activateSelectedPickerPane,
    notifyActiveAgentSessionSelection,
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
      const newSession = await createAgentSessionFromRequest({
        engineId: selectedPickerPane.selectedEngineId,
        modelId: selectedPickerPane.selectedModelId,
        projectId: nextProjectId,
        source: 'multi-window',
        title: t('multiWindow.newSessionTitle', {
          index: panes.indexOf(selectedPickerPane) + 1,
        }),
      }, {
        shouldSelectCreatedSession: () => false,
      });
      if (!newSession) return;
      setPanes((previousPanes) =>
        updatePaneById(previousPanes, selectedPickerPane.id, (pane) => ({
          ...pane,
          agentSessionId: newSession.id,
          projectId: nextProjectId,
          selectedEngineId: newSession.engineId?.trim() || pane.selectedEngineId,
          selectedModelId: newSession.modelId?.trim() || pane.selectedModelId,
          title: `${panes.indexOf(selectedPickerPane) + 1}. ${newSession.title}`,
        })),
      );
      notifyActiveAgentSessionSelection(nextProjectId, newSession.id);
      resolveNextPickerAfterActivation(activateSelectedPickerPane(selectedPickerPane.id));
    } catch (error) {
      console.error('Failed to create multi-window coding session', error);
    } finally {
      setCreatingSessionPaneId(null);
    }
  }, [
    activateSelectedPickerPane,
    createAgentSessionFromRequest,
    notifyActiveAgentSessionSelection,
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
    discardActiveDispatchBatch();
    activeDispatchBatchIdRef.current = dispatchBatchId;
    activeDispatchAbortControllerRef.current = dispatchAbortController;
    setLastBroadcastPrompt(prompt);
    setIsDispatching(true);
    setIsStoppingDispatch(false);
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
        maxConcurrentDispatches: DEFAULT_MULTI_WINDOW_MAX_CONCURRENT_DISPATCHES,
        onPaneResult: (paneResult) => {
          if (!isActiveDispatchBatch(dispatchBatchId)) {
            return;
          }

          setDispatchResults((previousResults) =>
            upsertDispatchPaneResult(previousResults, paneResult),
          );
        },
        panes: dispatchTargets.map(({ pane, paneIndex }) => ({
          agentSessionId: pane.agentSessionId,
          enabled: pane.enabled,
          id: pane.id,
          projectId: pane.projectId,
          requiresSessionProvisioning:
            resolveMultiWindowPaneSessionProvisioningStatus(
              pane,
              bindingsByPaneId.get(pane.id)?.agentSession,
            ).status === 'needs-session',
          sendPrompt: async ({ prompt: dispatchPrompt }) => {
            if (!isActiveDispatchBatch(dispatchBatchId) || dispatchAbortController.signal.aborted) {
              throw new MultiWindowDispatchStoppedError();
            }

            let effectivePane = pane;
            let effectiveAgentSessionId = pane.agentSessionId;
            const provisioningStatus = resolveMultiWindowPaneSessionProvisioningStatus(
              pane,
              bindingsByPaneId.get(pane.id)?.agentSession,
            );
            if (provisioningStatus.status === 'needs-session') {
              const provisionedSession = await createAgentSessionFromRequest({
                engineId: pane.selectedEngineId,
                modelId: pane.selectedModelId,
                projectId: pane.projectId,
                source: 'multi-window',
                title: buildMultiWindowProvisionedSessionTitle(pane, paneIndex),
              }, {
                rethrowError: true,
                shouldSelectCreatedSession: () => false,
                showFailureToast: false,
                showSuccessToast: false,
              });
              if (!provisionedSession) {
                throw new Error('Multi-window session provisioning returned no session.');
              }
              effectiveAgentSessionId = provisionedSession.id;
              effectivePane = {
                ...pane,
                agentSessionId: provisionedSession.id,
                projectId: provisionedSession.projectId.trim() || pane.projectId,
                selectedEngineId: provisionedSession.engineId?.trim() || pane.selectedEngineId,
                selectedModelId: provisionedSession.modelId?.trim() || pane.selectedModelId,
                title: buildMultiWindowProvisionedSessionTitle(pane, paneIndex),
              };
              if (isActiveDispatchBatch(dispatchBatchId)) {
                setPanes((previousPanes) =>
                  updatePaneById(previousPanes, pane.id, () => effectivePane),
                );
                notifyActiveAgentSessionSelection(
                  effectivePane.projectId,
                  effectiveAgentSessionId,
                );
              }
              if (!isActiveDispatchBatch(dispatchBatchId) || dispatchAbortController.signal.aborted) {
                throw new MultiWindowDispatchStoppedError();
              }
            }

            const context = buildWorkbenchAgentSessionTurnContext({
              projectId: effectivePane.projectId,
              sessionId: effectiveAgentSessionId,
            });
            const dispatchPromptProfile = buildMultiWindowPaneDispatchPrompt(
              dispatchPrompt,
              effectivePane,
            );
            if (!isActiveDispatchBatch(dispatchBatchId) || dispatchAbortController.signal.aborted) {
              throw new MultiWindowDispatchStoppedError();
            }
            const sentMessage = await sendMessage(
              effectivePane.projectId,
              effectiveAgentSessionId,
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
            const nextAgentSessionId = sentMessage?.sessionId.trim() ?? '';
            if (
              isActiveDispatchBatch(dispatchBatchId) &&
              nextAgentSessionId &&
              nextAgentSessionId !== effectiveAgentSessionId
            ) {
              setPanes((previousPanes) =>
                updatePaneById(previousPanes, pane.id, (currentPane) => ({
                  ...currentPane,
                  agentSessionId: nextAgentSessionId,
                })),
              );
              notifyActiveAgentSessionSelection(effectivePane.projectId, nextAgentSessionId);
              return {
                agentSessionId: nextAgentSessionId,
              };
            }

            return {
              agentSessionId: effectiveAgentSessionId,
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
      if (result.status === 'stopped') {
        addToast(t('multiWindow.dispatchStopped'), 'info');
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
        buildFallbackDispatchSummary({
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
        setIsStoppingDispatch(false);
      }
    }
  }, [
    addToast,
    bindingsByPaneId,
    createAgentSessionFromRequest,
    discardActiveDispatchBatch,
    dispatchResults,
    dispatchSummary,
    isActiveDispatchBatch,
    isDispatching,
    notifyActiveAgentSessionSelection,
    sendMessage,
    t,
    visiblePanes,
    windowCount,
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

  const handleStopDispatch = useCallback(() => {
    if (!isDispatching || isStoppingDispatch) {
      return;
    }

    const activeController = activeDispatchAbortControllerRef.current;
    if (!activeController || activeController.signal.aborted) {
      return;
    }

    activeController.abort();
    setIsStoppingDispatch(true);
    addToast(t('multiWindow.dispatchStopRequested'), 'info');
  }, [
    addToast,
    isDispatching,
    isStoppingDispatch,
    t,
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
        isStoppingDispatch={isStoppingDispatch}
        value={composerValue}
        onStopDispatch={handleStopDispatch}
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
          selectedAgentSessionId={selectedPickerPane.agentSessionId}
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
