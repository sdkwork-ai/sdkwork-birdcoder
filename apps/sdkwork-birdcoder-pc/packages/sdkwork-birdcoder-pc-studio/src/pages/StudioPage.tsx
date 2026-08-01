import { memo, startTransition, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  buildAgentSessionProjectScopedKey,
  buildProjectAgentSessionIndex,
  buildWorkbenchAgentSessionTurnContext,
  createIdleProjectMountRecoveryState,
  deleteWorkbenchAgentSessionItems,
  emitProjectMountRecoveryState,
  getDefaultRunConfigurations,
  globalEventBus,
  isProjectMountReadyForSessionSynchronization,
  rebindSelectedProjectDirectory,
  selectProjectDirectory,
  restoreWorkbenchAgentSessionItemFiles,
  type AgentApprovalDecisionInput,
  type AgentQuestionAnswerInput,
  type RunConfigurationRecord,
  type TerminalCommandRequest,
  useAgentSessionActions,
  useAgentSessionEngineModelSelection,
  useAgentSessionPendingInteractions,
  useFileSystem,
  useIDEServices,
  useProjectLocalWorkingDirectory,
  useProjectRuntimeLocation,
  useProjects,
  useProjectGitOverview,
  useProjectRunConfigurations,
  useSelectedAgentSessionItems,
  useSessionRefreshActions,
  useWorkbenchAgentSessionItemEditAction,
  ensureWorkbenchAgentSessionForTurnInput,
  regenerateWorkbenchAgentSessionFromLastUserItem,
  useWorkbenchAgentSessionCreationActions,
  useWorkbenchChatSelection,
  useWorkbenchPreferences,
  useAuth,
  useToast,
} from '@sdkwork/birdcoder-pc-workbench';
import { useImportedProjectSessionInventory } from '@sdkwork/birdcoder-pc-workbench/hooks/useImportedProjectSessionInventory';
import { getProviderSessionImportFailureCount } from '@sdkwork/birdcoder-pc-workbench/workbench/importedProjectHydration';
import { useSandboxDirectoryPicker } from '@sdkwork/drive-pc-sandbox-explorer';
import { buildBirdCoderAuthSessionInventoryScope } from '@sdkwork/birdcoder-pc-workbench/context/authSessionScope';
import {
  FileChange,
  isAgentSessionViewEngineBusy,
  isAgentSessionViewExecuting,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { useTranslation } from 'react-i18next';
import { resolveSafePreviewUrl } from '@sdkwork/birdcoder-pc-ui-shell';
import type { UniversalChatComposerSubmission } from '@sdkwork/birdcoder-pc-ui/components/UniversalChat';
import {
  type StudioAnalyzeReport,
  type StudioDeleteConfirmation,
} from './StudioPageDialogs';
import { StudioDialogSurface } from './StudioDialogSurface';
import { StudioChatSidebar } from './StudioChatSidebar';
import { StudioMainContent } from './StudioMainContent';
import { analyzeStudioCode } from './studioCodeAnalysis';
import { useStudioAgentSessionSync } from './useStudioAgentSessionSync';
import {
  StudioSessionTranscriptErrorState,
  StudioSessionTranscriptLoadingState,
} from './StudioSessionTranscriptLoadingState';
import { useStudioExecutionActions } from './useStudioExecutionActions';
import { useStudioProjectInventoryReconciliation } from './useStudioProjectInventoryReconciliation';
import { useStudioWorkbenchEventBindings } from './useStudioWorkbenchEventBindings';
import {
  EMPTY_STUDIO_CHAT_MESSAGES,
  getLanguageFromPath,
  restoreStudioSelectionAfterRefresh,
  type StudioPageProps,
} from './StudioPage.shared';

function StudioPageComponent({
  isVisible = true,
  workspaceId,
  projectId,
  initialAgentSessionId,
  onRequestProjectCreation,
  onProjectChange,
  onAgentSessionChange,
}: StudioPageProps) {
  const { t } = useTranslation();
  const { pickDirectory } = useSandboxDirectoryPicker();
  const [activeTab, setActiveTab] = useState<'preview' | 'simulator' | 'code'>('preview');
  const isSimulatorTabActive = activeTab === 'simulator';
  const handleActiveTabChange = useCallback((nextTab: 'preview' | 'simulator' | 'code') => {
    startTransition(() => {
      setActiveTab(nextTab);
    });
  }, []);
  const { preferences, updatePreferences } = useWorkbenchPreferences();
  const {
    hasMore: hasMoreProjects,
    hasFetched: hasFetchedProjects,
    error: projectsLoadError,
    isLoading: isLoadingProjects,
    isLoadingMore: isLoadingMoreProjects,
    projects,
    filteredProjects,
    searchQuery: projectSearchQuery,
    setSearchQuery: setProjectSearchQuery,
    cancelAgentTurn,
    submitAgentTurnInput,
    createAgentSession,
    editAgentSessionItem,
    deleteAgentSessionItem,
    forkAgentSession,
    loadMoreProjects,
    loadMoreProjectSessions,
    refreshProjects,
  } = useProjects({
    isActive: isVisible,
    targetProjectId: projectId,
    workspaceId,
  });
  const {
    agentSessionService,
    projectRuntimeLocationService,
    projectService,
  } = useIDEServices();
  const resolveProjectLocalWorkingDirectory = useProjectLocalWorkingDirectory();
  const resolveProjectRuntimeLocation = useProjectRuntimeLocation();
  const { sessionRevision, user } = useAuth();
  const userScope = buildBirdCoderAuthSessionInventoryScope(user?.id, sessionRevision);
  const { addToast } = useToast();
  const [sessionId, setSessionId] = useState<string>('');
  const [selectedSessionProjectId, setSelectedSessionProjectId] = useState<string | null>(null);
  const [selectionRefreshToken, setSelectionRefreshToken] = useState(0);
  const [failedAgentSessionItemsLoadId, setFailedAgentSessionItemsLoadId] =
    useState<string | null>(null);
  const pendingProjectChangeIdRef = useRef<string | null>(null);
  const pendingLocalAgentSessionSelectionKeyRef = useRef<string | null>(null);
  const [menuActiveProjectId, setMenuActiveProjectId] = useState<string>('');
  const [viewingDiff, setViewingDiff] = useState<FileChange | null>(null);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(256);
  const [codeExplorerWidth, setCodeExplorerWidth] = useState(256);
  const [terminalRequest, setTerminalRequest] = useState<TerminalCommandRequest>();
  const [isRunTaskVisible, setIsRunTaskVisible] = useState(false);
  const [isRunConfigVisible, setIsRunConfigVisible] = useState(false);
  const [isDebugConfigVisible, setIsDebugConfigVisible] = useState(false);
  const [runConfigurationDraft, setRunConfigurationDraft] = useState<RunConfigurationRecord>(
    getDefaultRunConfigurations()[0],
  );
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const handleToggleSidebar = useCallback(() => {
    setIsSidebarVisible(prev => !prev);
  }, []);
  const handleToggleProjectGitOverviewDrawer = useCallback(() => {
    setIsProjectGitOverviewDrawerOpen((previousState) => !previousState);
  }, []);
  const handleCloseProjectGitOverviewDrawer = useCallback(() => {
    setIsProjectGitOverviewDrawerOpen(false);
  }, []);
  const [isFindVisible, setIsFindVisible] = useState(false);
  const [isQuickOpenVisible, setIsQuickOpenVisible] = useState(false);
  const [isMountRecoveryActionPending, setIsMountRecoveryActionPending] = useState(false);
  const [isAnalyzeModalVisible, setIsAnalyzeModalVisible] = useState(false);
  const [analyzeReport, setAnalyzeReport] = useState<StudioAnalyzeReport | null>(null);
  const [previewPlatform, setPreviewPlatform] = useState<'web' | 'miniprogram' | 'app'>('web');
  const [previewWebDevice, setPreviewWebDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [previewMpPlatform, setPreviewMpPlatform] = useState<'wechat' | 'douyin' | 'alipay'>('wechat');
  const [previewAppPlatform, setPreviewAppPlatform] = useState<'ios' | 'android' | 'harmony'>('ios');
  const [previewDeviceModel, setPreviewDeviceModel] = useState<string>('iphone-14-pro');
  const [previewIsLandscape, setPreviewIsLandscape] = useState(false);
  const [isProjectGitOverviewDrawerOpen, setIsProjectGitOverviewDrawerOpen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('about:blank');
  const sessionIndex = useMemo(
    () => buildProjectAgentSessionIndex(projects),
    [projects],
  );
  const resolveProjectById = useCallback(
    (id: string | null | undefined) => {
      const normalizedProjectId = id?.trim() ?? '';
      return normalizedProjectId
        ? sessionIndex.projectsById.get(normalizedProjectId) ?? null
        : null;
    },
    [sessionIndex],
  );
  const resolveAgentSessionLocation = useCallback(
    (id: string | null | undefined, scopedProjectId?: string | null) => {
      const normalizedAgentSessionId = id?.trim() ?? '';
      if (!normalizedAgentSessionId) {
        return null;
      }

      const normalizedScopedProjectId = scopedProjectId?.trim() ?? '';
      if (normalizedScopedProjectId) {
        return sessionIndex.agentSessionLocationsByProjectIdAndId.get(
          buildAgentSessionProjectScopedKey(
            normalizedScopedProjectId,
            normalizedAgentSessionId,
          ),
        ) ?? null;
      }

      return sessionIndex.agentSessionLocationsById.get(normalizedAgentSessionId) ?? null;
    },
    [sessionIndex],
  );
  const selectedAgentSessionLocation = resolveAgentSessionLocation(
    sessionId,
    selectedSessionProjectId ?? projectId,
  );
  const sessionProjectId = selectedAgentSessionLocation?.project.projectId ?? '';
  const normalizedProjectId = projectId?.trim() ?? '';
  const normalizedSelectedSessionProjectId = selectedSessionProjectId?.trim() ?? '';
  const normalizedSessionProjectId = sessionProjectId?.trim() ?? '';
  const normalizedInitialAgentSessionId = initialAgentSessionId?.trim() || '';
  const currentProjectId =
    normalizedSessionProjectId || normalizedSelectedSessionProjectId || normalizedProjectId;
  const { runConfigurations, saveRunConfiguration } = useProjectRunConfigurations(currentProjectId || null);
  const selectedSession = selectedAgentSessionLocation?.agentSession;
  const {
    createAgentSessionWithSelection,
    selectedEngineId,
    selectedModelId,
    setSelectedEngineId,
    setSelectedModelId,
  } = useWorkbenchChatSelection({
    createAgentSession,
    preferences,
    updatePreferences,
    currentSessionEngineId: selectedSession?.engineId,
    currentSessionModelId: selectedSession?.modelId,
  });
  const notifyProjectChange = useCallback((nextProjectId: string) => {
    if (!isVisible || !onProjectChange) {
      return;
    }

    const normalizedNextProjectId = nextProjectId.trim();
    if (normalizedNextProjectId === currentProjectId) {
      return;
    }

    pendingProjectChangeIdRef.current = normalizedNextProjectId;
    onProjectChange(normalizedNextProjectId);
  }, [currentProjectId, isVisible, onProjectChange]);
  const selectAgentSession = useCallback((
    nextAgentSessionId: string,
    options?: { projectId?: string },
  ) => {
    const normalizedAgentSessionId = nextAgentSessionId.trim();
    if (!normalizedAgentSessionId) {
      return;
    }

    const nextProjectId =
      options?.projectId?.trim() ||
      (resolveAgentSessionLocation(normalizedAgentSessionId)?.project.projectId ?? '');

    if (
      normalizedAgentSessionId === sessionId &&
      nextProjectId === currentProjectId
    ) {
      setSelectionRefreshToken((previousState) => previousState + 1);
      return;
    }

    pendingLocalAgentSessionSelectionKeyRef.current = nextProjectId
      ? buildAgentSessionProjectScopedKey(nextProjectId, normalizedAgentSessionId)
      : normalizedAgentSessionId;
    if (nextProjectId) {
      setMenuActiveProjectId(nextProjectId);
    }
    setSessionId(normalizedAgentSessionId);
    setSelectedSessionProjectId(nextProjectId || null);
  }, [currentProjectId, resolveAgentSessionLocation, sessionId]);
  const { createAgentSessionFromRequest, createAgentSessionInProject } = useWorkbenchAgentSessionCreationActions({
    addToast,
    createAgentSessionWithSelection,
    currentProjectId,
    selectAgentSession,
    labels: {
      creationFailed: t('studio.failedToCreateSession'),
      creationSucceeded: t('studio.newSessionCreated'),
      noProjectSelected: t('studio.pleaseSelectProject'),
    },
  });
  const activateCreatedProjectSelection = useCallback((createdProjectId: string) => {
    notifyProjectChange(createdProjectId);
    setMenuActiveProjectId(createdProjectId);
    setSessionId('');
    setSelectedSessionProjectId(createdProjectId);
    pendingLocalAgentSessionSelectionKeyRef.current =
      buildAgentSessionProjectScopedKey(createdProjectId, '');
  }, [notifyProjectChange]);
  const createStudioAgentSessionInProject = useCallback(
    (projectId: string, engineId?: string, modelId?: string) =>
      createAgentSessionInProject(projectId, engineId, { modelId, source: 'studio' }),
    [createAgentSessionInProject],
  );
  const projectsRef = useRef(projects);
  const selectedAgentSessionIdRef = useRef(sessionId);
  const currentProjectIdRef = useRef(currentProjectId);
  const runConfigurationsRef = useRef(runConfigurations);
  const selectAgentSessionRef = useRef(selectAgentSession);

  useEffect(() => {
    projectsRef.current = projects;
    selectedAgentSessionIdRef.current = sessionId;
    currentProjectIdRef.current = currentProjectId;
    runConfigurationsRef.current = runConfigurations;
    selectAgentSessionRef.current = selectAgentSession;
  }, [
    currentProjectId,
    projects,
    runConfigurations,
    selectAgentSession,
    sessionId,
  ]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const unsubscribe = globalEventBus.on('toggleSidebar', handleToggleSidebar);
    return () => {
      unsubscribe();
    };
  }, [handleToggleSidebar, isVisible]);
  useAgentSessionActions(
    currentProjectId,
    createAgentSessionWithSelection,
    (agentSessionId) => {
      selectAgentSession(agentSessionId, {
        projectId: currentProjectId,
      });
    },
    {
      isActive: isVisible,
      createAgentSessionFromRequest,
    },
  );
  
  const [chatWidth, setChatWidth] = useState(720);
  const [deleteConfirmation, setDeleteConfirmation] = useState<StudioDeleteConfirmation | null>(null);

  useEffect(() => {
    if (
      !normalizedSessionProjectId ||
      !onProjectChange ||
      onAgentSessionChange ||
      !isVisible ||
      normalizedSessionProjectId === normalizedProjectId
    ) {
      return;
    }

    if (pendingProjectChangeIdRef.current === normalizedSessionProjectId) {
      pendingProjectChangeIdRef.current = null;
      return;
    }

    onProjectChange(normalizedSessionProjectId);
    setMenuActiveProjectId((previousProjectId) =>
      previousProjectId === normalizedSessionProjectId
        ? previousProjectId
        : normalizedSessionProjectId,
    );
  }, [
    isVisible,
    normalizedProjectId,
    normalizedSessionProjectId,
    onAgentSessionChange,
    onProjectChange,
  ]);

  useStudioAgentSessionSync({
    isActive: isVisible,
    projects,
    initialAgentSessionId: normalizedInitialAgentSessionId,
    initialProjectId: normalizedProjectId,
    onAgentSessionChange,
    pendingLocalAgentSessionSelectionKeyRef,
    selectedProjectId: currentProjectId,
    selectedAgentSessionId: sessionId,
    setSelectedAgentSessionId: setSessionId,
    setSelectedAgentSessionProjectId: setSelectedSessionProjectId,
  });

  useStudioProjectInventoryReconciliation({
    currentProjectId,
    hasFetchedProjects,
    isActive: isVisible,
    menuActiveProjectId,
    notifyProjectChange,
    projectId,
    projects,
    resolveAgentSessionLocation,
    resolveProjectById,
    selectedSessionProjectId,
    sessionId,
    setMenuActiveProjectId,
    setSelectedSessionProjectId,
    setSessionId,
  });

  const [isSubmittingTurn, setIsSubmittingTurn] = useState(false);

  const selectedSessionMessages = useMemo(
    () => selectedSession?.items ?? EMPTY_STUDIO_CHAT_MESSAGES,
    [selectedSession?.items],
  );
  const isSelectedSessionTurnActive = isAgentSessionViewExecuting(selectedSession);
  const isSelectedSessionEngineBusy = isAgentSessionViewEngineBusy(selectedSession);
  const isChatBusy = isSubmittingTurn || isSelectedSessionTurnActive;
  const isChatEngineBusy = isSubmittingTurn || isSelectedSessionEngineBusy;
  const currentProject =
    selectedAgentSessionLocation?.project ??
    resolveProjectById(currentProjectId);
  useEffect(() => {
    if (activeTab !== 'code' || !currentProjectId) {
      setIsProjectGitOverviewDrawerOpen(false);
    }
  }, [activeTab, currentProjectId]);
  useEffect(() => {
    setViewingDiff(null);
  }, [currentProjectId, sessionId]);
  const {
    handleRunTaskExecution,
    handleSaveDebugConfiguration,
    handleSubmitRunConfiguration,
    launchPreview,
    launchSimulator,
  } = useStudioExecutionActions({
    activeTab,
    addToast,
    currentProjectId,
    resolveProjectRuntimeLocation,
    previewAppPlatform,
    previewDeviceModel,
    previewIsLandscape,
    previewMpPlatform,
    previewPlatform,
    previewUrl,
    previewWebDevice,
    runConfigurationDraft,
    runConfigurations,
    saveRunConfiguration,
    setIsDebugConfigVisible,
    setIsRunConfigVisible,
    setIsRunTaskVisible,
    setPreviewKey,
    setPreviewUrl,
    t,
  });
  const {
    handleSelectedEngineChange,
    handleSelectedModelChange,
  } = useAgentSessionEngineModelSelection({
    preferences,
    selectedModelId,
    sessionId,
    setSelectedEngineId,
    setSelectedModelId,
  });
  const handleImportedProjectSessionsRefreshed = useCallback((result: {
    latestAgentSessionId: string | null;
    project: { projectId: string };
  }) => {
    const refreshedProjectId = result.project.projectId;
    if (currentProjectId !== refreshedProjectId) {
      return;
    }
    if (sessionId?.trim() || normalizedInitialAgentSessionId) {
      return;
    }
    if (result.latestAgentSessionId) {
      selectAgentSession(result.latestAgentSessionId, { projectId: refreshedProjectId });
    }
  }, [
    currentProjectId,
    normalizedInitialAgentSessionId,
    selectAgentSession,
    sessionId,
  ]);
  const {
    importProjectProviderSessions,
    invalidateImportedProjectSessionInventory,
    refreshImportedProject,
  } = useImportedProjectSessionInventory({
    agentSessionService,
    knownProjects: projects,
    onRefreshed: handleImportedProjectSessionsRefreshed,
    projectService,
    userScope,
    workspaceId,
  });

  const restoreSelectionAfterRefresh = (
    targetProjectId: string,
    targetAgentSessionId: string | null,
  ) => {
    restoreStudioSelectionAfterRefresh({
      currentProjectId,
      notifyProjectChange,
      pendingLocalAgentSessionSelectionKeyRef,
      selectAgentSession,
      sessionId,
      setMenuActiveProjectId,
      setSelectedSessionProjectId,
      setSessionId,
      targetAgentSessionId,
      targetProjectId,
    });
  };

  const {
    files,
    projectRoot,
    isLoading: isFileTreeLoading,
    fileTreeLoadError,
    loadingDirectoryPaths,
    openFiles,
    selectedFile,
    fileContent,
    saveError,
    isSearchingFiles,
    mountRecoveryState,
    selectFile,
    selectMessageFile,
    loadDirectory,
    closeFile,
    updateFileDraft,
    loadFileContent,
    saveFileContent,
    createFile,
    createFolder,
    deleteFile,
    deleteFolder,
    renameNode,
    searchFiles,
    restoreProjectMount,
    refreshFiles,
    flushPendingAutosave,
  } = useFileSystem(currentProjectId, {
    isActive: isVisible,
    loadActive: isVisible && activeTab === 'code',
    mountRecoveryActive: isVisible,
    realtimeActive: isVisible && activeTab === 'code',
  });
  const projectGitOverviewState = useProjectGitOverview({
    isActive: isVisible && activeTab === 'code',
    projectId: currentProjectId,
  });

  useEffect(() => {
    if (!isVisible) {
      return;
    }
    if (!currentProjectId) {
      return;
    }
    if (mountRecoveryState.status !== 'recovered') {
      invalidateImportedProjectSessionInventory(currentProjectId);
      return;
    }

    void refreshImportedProject(currentProjectId).catch((error) => {
      console.error('Failed to refresh mounted project sessions', error);
    });
  }, [
    currentProjectId,
    invalidateImportedProjectSessionInventory,
    isVisible,
    mountRecoveryState.status,
    refreshImportedProject,
  ]);

  useStudioWorkbenchEventBindings({
    addToast,
    isActive: isVisible,
    saveError,
    currentProjectIdRef,
    projectsRef,
    resolveProjectRuntimeLocation,
    runConfigurationsRef,
    selectedAgentSessionIdRef,
    selectAgentSessionRef,
    flushPendingAutosave,
    setIsDebugConfigVisible,
    setIsFindVisible,
    setIsQuickOpenVisible,
    setIsRunConfigVisible,
    setIsRunTaskVisible,
    setIsTerminalOpen,
    setTerminalRequest,
    t,
  });

  const previousMountRecoveryStatusRef = useRef(mountRecoveryState.status);

  useEffect(() => {
    if (
      mountRecoveryState.status === 'failed' &&
      previousMountRecoveryStatusRef.current !== 'failed'
    ) {
      addToast(mountRecoveryState.message ?? 'Unable to reopen the local project folder.', 'error');
    }
    previousMountRecoveryStatusRef.current = mountRecoveryState.status;
  }, [addToast, mountRecoveryState.message, mountRecoveryState.status]);

  useEffect(() => {
    if (!isVisible) {
      emitProjectMountRecoveryState({
        surface: 'studio',
        projectId: null,
        projectName: null,
        state: createIdleProjectMountRecoveryState(),
      });
      return;
    }

    emitProjectMountRecoveryState({
      surface: 'studio',
      projectId: currentProjectId ?? null,
      projectName: currentProject?.name ?? null,
      state: mountRecoveryState,
    });

    return () => {
      emitProjectMountRecoveryState({
        surface: 'studio',
        projectId: null,
        projectName: null,
        state: createIdleProjectMountRecoveryState(),
      });
    };
  }, [currentProject?.name, currentProjectId, isVisible, mountRecoveryState]);

  const isSelectedAgentSessionTranscriptVisible = isVisible && isSidebarVisible;
  const handleSelectedAgentSessionItemsLoadFailed = useCallback((agentSessionId: string) => {
    if (agentSessionId === sessionId) {
      setFailedAgentSessionItemsLoadId(agentSessionId);
    }
  }, [sessionId]);
  const handleSelectedAgentSessionItemsLoaded = useCallback((agentSessionId: string) => {
    setFailedAgentSessionItemsLoadId((failedSessionId) =>
      failedSessionId === agentSessionId ? null : failedSessionId,
    );
  }, []);
  const handleRetrySelectedAgentSessionItems = useCallback(() => {
    setSelectionRefreshToken((previousState) => previousState + 1);
  }, []);
  const handleSelectedAgentSessionUnavailable = useCallback((
    unavailableAgentSessionId: string,
    unavailableProjectId: string,
  ) => {
    if (unavailableAgentSessionId !== sessionId) {
      return;
    }
    const fallbackProjectId = unavailableProjectId.trim() || currentProjectId;
    setSessionId('');
    setSelectedSessionProjectId(fallbackProjectId || null);
    pendingLocalAgentSessionSelectionKeyRef.current = fallbackProjectId
      ? buildAgentSessionProjectScopedKey(fallbackProjectId, '')
      : null;
  }, [currentProjectId, sessionId]);
  const isSelectedAgentSessionItemsLoading = useSelectedAgentSessionItems({
    agentSessionService,
    isActive: isSelectedAgentSessionTranscriptVisible,
    onAgentSessionItemsLoadFailed: handleSelectedAgentSessionItemsLoadFailed,
    onAgentSessionItemsLoaded: handleSelectedAgentSessionItemsLoaded,
    onAgentSessionUnavailable: handleSelectedAgentSessionUnavailable,
    projectService,
    selectionRefreshToken,
    selectedAgentSession: selectedSession,
    selectedAgentSessionId: sessionId,
    selectedProject: selectedAgentSessionLocation?.project ?? currentProject ?? null,
    refreshProjectSessionInventory: refreshImportedProject,
  });
  const isSelectedAgentSessionHydrating = Boolean(
    sessionId &&
    isSelectedAgentSessionItemsLoading &&
    selectedSessionMessages.length === 0
  );
  const hasSelectedAgentSessionItemsLoadError = Boolean(
    sessionId
    && failedAgentSessionItemsLoadId === sessionId
    && selectedSessionMessages.length === 0
    && !isSelectedAgentSessionItemsLoading
  );
  const {
    earlierAgentSessionItemsError,
    handleLoadEarlierAgentSessionItems,
    handleRefreshAgentSessionItems,
    handleRefreshProjectSessions,
    loadingEarlierAgentSessionId,
    loadingEarlierAgentSessionProjectId,
    refreshingAgentSessionId,
    refreshingProjectId,
  } = useSessionRefreshActions({
    addToast,
    agentSessionService,
    getPreservedSelection: () => ({
      agentSessionId: sessionId,
      projectId: currentProjectId,
    }),
    messages: {
      failedToRefreshProjectSessions: t('studio.failedToRefreshProjectSessions'),
      failedToRefreshSessionMessages: t('studio.failedToRefreshSessionMessages'),
      projectSessionsRefreshed: (projectName: string) =>
        t('studio.projectSessionsRefreshed', { name: projectName }),
      sessionMessagesRefreshed: (agentSessionTitle: string) =>
        t('studio.sessionMessagesRefreshed', { name: agentSessionTitle }),
    },
    projectService,
    resolveAgentSessionLocation: (agentSessionId: string, targetProjectId?: string | null) =>
      resolveAgentSessionLocation(agentSessionId, targetProjectId),
    resolveAgentSessionTitle: (agentSessionId: string, targetProjectId?: string | null) =>
      resolveAgentSessionLocation(agentSessionId, targetProjectId)
        ?.agentSession.title ?? agentSessionId,
    resolveProjectName: (targetProjectId: string) =>
      resolveProjectById(targetProjectId)?.name ?? targetProjectId,
    restoreSelectionAfterRefresh,
    refreshProjectSessionInventory: refreshImportedProject,
  });
  const handleLoadEarlierSelectedAgentSessionItems = useCallback(() => {
    const targetAgentSessionId = sessionId.trim();
    const targetProjectId = selectedSession?.projectId.trim() || currentProjectId.trim();
    if (!targetAgentSessionId || !targetProjectId) {
      return Promise.resolve();
    }
    return handleLoadEarlierAgentSessionItems(targetAgentSessionId, targetProjectId);
  }, [
    currentProjectId,
    handleLoadEarlierAgentSessionItems,
    selectedSession?.projectId,
    sessionId,
  ]);
  const isLoadingEarlierSelectedAgentSessionItems = Boolean(
    sessionId
    && loadingEarlierAgentSessionId === sessionId
    && loadingEarlierAgentSessionProjectId === selectedSession?.projectId,
  );
  const pendingInteractionRefreshToken = useMemo(() => [
    currentProjectId,
    selectedSession?.agentId ?? '',
    selectedSession?.id ?? '',
    selectedSession?.runtimeStatus ?? '',
    selectedSession?.updatedAt ?? '',
    selectedSession?.lastTurnAt ?? '',
    selectedSession?.transcriptUpdatedAt ?? '',
  ].join('\u0001'), [currentProjectId, selectedSession]);
  const pendingInteractionIdentity =
    selectedSession?.id === sessionId
      ? { agentId: selectedSession.agentId, sessionId: selectedSession.id }
      : null;
  const pendingInteractionScopeKey =
    currentProjectId && pendingInteractionIdentity
      ? [
          currentProjectId,
          pendingInteractionIdentity.agentId,
          pendingInteractionIdentity.sessionId,
        ].join('\u0001')
      : null;
  const {
    approvals: pendingApprovals,
    error: pendingInteractionsError,
    isLoading: arePendingInteractionsLoading,
    questions: pendingUserQuestions,
    refreshPendingInteractions,
    submitApprovalDecision,
    submitQuestionAnswer,
  } = useAgentSessionPendingInteractions(
    pendingInteractionIdentity,
    pendingInteractionRefreshToken,
    pendingInteractionScopeKey,
    currentProjectId,
  );
  const handleSubmitApprovalDecision = useCallback(async (
    approvalId: string,
    request: AgentApprovalDecisionInput,
  ) => {
    await submitApprovalDecision(approvalId, request);
    if (sessionId) {
      await handleRefreshAgentSessionItems(sessionId, currentProjectId);
    }
  }, [currentProjectId, handleRefreshAgentSessionItems, sessionId, submitApprovalDecision]);
  const handleSubmitUserQuestionAnswer = useCallback(async (
    questionId: string,
    request: AgentQuestionAnswerInput,
  ) => {
    await submitQuestionAnswer(questionId, request);
    if (sessionId) {
      await handleRefreshAgentSessionItems(sessionId, currentProjectId);
    }
  }, [currentProjectId, handleRefreshAgentSessionItems, sessionId, submitQuestionAnswer]);
  const handleRetryPendingInteractions = useCallback(async () => {
    await refreshPendingInteractions();
  }, [refreshPendingInteractions]);

  useEffect(() => {
    if (!isRunConfigVisible) {
      return;
    }

    setRunConfigurationDraft(
      runConfigurations.find((config) => config.group === 'dev') ??
      runConfigurations[0] ??
        getDefaultRunConfigurations()[0],
    );
  }, [isRunConfigVisible, runConfigurations]);

  const handleSelectFile = useCallback((path: string) => {
    selectFile(path);
  }, [selectFile]);

  const handleAnalyzeCode = useCallback(() => {
    if (!selectedFile) {
      return;
    }

    setAnalyzeReport(analyzeStudioCode(fileContent));
    setIsAnalyzeModalVisible(true);
  }, [fileContent, selectedFile]);

  const handleEditMessage = useWorkbenchAgentSessionItemEditAction({
    editAgentSessionItem,
    resolveAgentSessionLocation: (agentSessionId: string) =>
      resolveAgentSessionLocation(agentSessionId, currentProjectId),
    sessionUnavailableMessage: t('chat.sendMessageSessionUnavailable'),
    setSelectionRefreshToken,
  });

  const handleDeleteMessage = useCallback(async (agentSessionId: string, sessionItemIds: string[]) => {
    const normalizedMessageIds = sessionItemIds
      .map((messageId) => messageId.trim())
      .filter((messageId) => messageId.length > 0);
    if (normalizedMessageIds.length === 0) {
      return;
    }

    setDeleteConfirmation({
      type: 'message',
      id: normalizedMessageIds[normalizedMessageIds.length - 1]!,
      ids: normalizedMessageIds,
      parentId: agentSessionId,
    });
  }, []);

  const executeDeleteMessage = async (agentSessionId: string, sessionItemIds: string[]) => {
    const project = resolveAgentSessionLocation(agentSessionId, currentProjectId)?.project;
    if (project) {
      try {
        const deletedMessageCount = await deleteWorkbenchAgentSessionItems({
          agentSessionId,
          deleteAgentSessionItem,
          sessionItemIds,
          projectId: project.projectId,
        });
        addToast(
          deletedMessageCount > 1 ? 'Reply deleted successfully' : t('studio.messageDeleted'),
          'success',
        );
      } catch (error) {
        console.error('Failed to delete coding session message', error);
        addToast(sessionItemIds.length > 1 ? 'Failed to delete reply' : t('studio.failedToDeleteMessage'), 'error');
      }
    }
  };

  const handleRegenerateMessage = useCallback(async (agentSessionId: string) => {
    if (isChatBusy) {
      return;
    }

    const resolvedSessionLocation = resolveAgentSessionLocation(agentSessionId, currentProjectId);
    const project = resolvedSessionLocation?.project;
    if (project) {
      const agentSession = resolvedSessionLocation?.agentSession;
      if (!agentSession) return;

      setIsSubmittingTurn(true);
      try {
        const didRegenerate =
          await regenerateWorkbenchAgentSessionFromLastUserItem({
            agentSession,
            deleteAgentSessionItem,
            projectId: project.projectId,
            regenerateTurnContext: buildWorkbenchAgentSessionTurnContext({
              currentFileContent: fileContent,
              currentFileLanguage: selectedFile ? getLanguageFromPath(selectedFile) : null,
              currentFilePath: selectedFile,
              projectId: project.projectId,
              sessionId: agentSession.id,
            }),
            submitAgentTurn: (targetProjectId, targetAgentSessionId, content, context) =>
              submitAgentTurnInput(targetProjectId, targetAgentSessionId, content, context),
          });
        if (didRegenerate) {
          setSelectionRefreshToken((previousState) => previousState + 1);
        }
      } finally {
        setIsSubmittingTurn(false);
      }
    }
  }, [
    currentProjectId,
    deleteAgentSessionItem,
    fileContent,
    isChatBusy,
    buildWorkbenchAgentSessionTurnContext,
    regenerateWorkbenchAgentSessionFromLastUserItem,
    resolveAgentSessionLocation,
    selectedFile,
    submitAgentTurnInput,
    setSelectionRefreshToken,
  ]);

  const handleRestoreMessage = useCallback(async (
    agentSessionId: string,
    messageId: string,
    fileChanges?: readonly FileChange[],
  ) => {
    const agentSession =
      resolveAgentSessionLocation(agentSessionId, currentProjectId)?.agentSession;
    const msg = agentSession?.items.find(m => m.id === messageId);
    try {
      const didRestore = await restoreWorkbenchAgentSessionItemFiles({
        fileChanges: fileChanges ?? msg?.fileChanges,
        loadFileContent,
        saveFileContent,
      });
      if (!didRestore) {
        addToast('This checkpoint cannot be safely restored.', 'error');
        return;
      }
      addToast(t('studio.restoredFiles'), 'success');
    } catch (error) {
      console.error('Failed to restore files from checkpoint', error);
      addToast('Failed to restore files from checkpoint', 'error');
    }
  }, [
    addToast,
    currentProjectId,
    resolveAgentSessionLocation,
    restoreWorkbenchAgentSessionItemFiles,
    loadFileContent,
    saveFileContent,
    t,
  ]);

  const handleSendMessage = useCallback(async (
    text?: string,
    composerSelection?: {
      accessModeId?: string | null;
      engineId?: string | null;
      modelId?: string | null;
    },
    submission?: UniversalChatComposerSubmission,
  ) => {
    const trimmedContent = typeof text === 'string' ? text.trim() : '';
    if (!trimmedContent) {
      return;
    }
    const queueExecution = submission?.queueExecution;
    if (isChatBusy && !queueExecution) {
      throw new Error(t('chat.sendMessageBusy'));
    }
    const requestedEngineId = composerSelection?.engineId?.trim() ?? '';
    const requestedModelId = composerSelection?.modelId?.trim() ?? '';
    const currentSessionEngineId = selectedSession?.engineId?.trim() ?? '';
    const currentSessionModelId = selectedSession?.modelId?.trim() ?? '';
    const currentAgentSessionId =
      (requestedEngineId &&
        requestedEngineId.toLowerCase() !== currentSessionEngineId.toLowerCase()) ||
      (requestedModelId &&
        requestedModelId.toLowerCase() !== currentSessionModelId.toLowerCase())
        ? null
        : sessionId;
    const bootstrappedSession = queueExecution
      ? (() => {
          if (
            !selectedSession
            || queueExecution.agentId !== selectedSession.agentId
            || queueExecution.sessionId !== selectedSession.id
            || queueExecution.sessionId !== sessionId
          ) {
            throw new Error(t('chat.sendMessageSessionUnavailable'));
          }
          return {
            agentSessionId: selectedSession.id,
            projectId: selectedSession.projectId,
          };
        })()
      : await ensureWorkbenchAgentSessionForTurnInput({
          createAgentSessionFromRequest,
          currentAgentSessionId,
          currentProjectId,
          turnInputContent: trimmedContent,
          requestedEngineId: composerSelection?.engineId,
          requestedModelId: composerSelection?.modelId,
          resolveProjectId: async () => {
            if (projects.length === 0) {
              const createdProjectId = await onRequestProjectCreation();
              if (!createdProjectId) {
                return null;
              }
              activateCreatedProjectSelection(createdProjectId);
              return createdProjectId;
            }

            return projects[0]?.projectId;
          },
        });
    if (!bootstrappedSession) {
      throw new Error(t('chat.sendMessageSessionUnavailable'));
    }

    setIsSubmittingTurn(true);
    try {
      const context = buildWorkbenchAgentSessionTurnContext({
        currentFileContent: fileContent,
        currentFileLanguage: selectedFile ? getLanguageFromPath(selectedFile) : null,
        currentFilePath: selectedFile,
        projectId: bootstrappedSession.projectId,
        sessionId: bootstrappedSession.agentSessionId,
      });
      const sentMessage = await submitAgentTurnInput(
        bootstrappedSession.projectId,
        bootstrappedSession.agentSessionId,
        trimmedContent,
        context,
        queueExecution
          ? {
              ...(submission?.driveRefs?.length ? { driveRefs: submission.driveRefs } : {}),
              queueExecution,
            }
          : submission?.driveRefs?.length || composerSelection?.accessModeId?.trim()
          ? {
              ...(composerSelection?.accessModeId?.trim()
                ? { accessModeId: composerSelection.accessModeId.trim() }
                : {}),
              ...(submission?.driveRefs?.length ? { driveRefs: submission.driveRefs } : {}),
            }
          : undefined,
      );
      if (
        sentMessage?.sessionId &&
        sentMessage.sessionId !== bootstrappedSession.agentSessionId
      ) {
        selectAgentSession(sentMessage.sessionId, { projectId: bootstrappedSession.projectId });
      }
      setSelectionRefreshToken((previousState) => previousState + 1);
    } finally {
      setIsSubmittingTurn(false);
    }
  }, [
    buildWorkbenchAgentSessionTurnContext,
    ensureWorkbenchAgentSessionForTurnInput,
    activateCreatedProjectSelection,
    createAgentSessionFromRequest,
    currentProjectId,
    fileContent,
    isChatBusy,
    onRequestProjectCreation,
    projects,
    selectAgentSession,
    selectedSession?.engineId,
    selectedSession?.agentId,
    selectedSession?.id,
    selectedSession?.modelId,
    selectedSession?.projectId,
    selectedFile,
    submitAgentTurnInput,
    setSelectionRefreshToken,
    t,
  ]);
  const handleStopTurn = useCallback(async () => {
    const targetAgentSessionId = sessionId.trim();
    const targetProjectId = selectedSession?.projectId.trim() || currentProjectId.trim();
    if (!targetAgentSessionId || !targetProjectId) {
      throw new Error(t('chat.sendMessageSessionUnavailable'));
    }
    const cancelledTurn = await cancelAgentTurn(targetProjectId, targetAgentSessionId);
    if (!cancelledTurn) {
      throw new Error(t('chat.noActiveTurnToStop'));
    }
    setSelectionRefreshToken((previousState) => previousState + 1);
  }, [
    cancelAgentTurn,
    currentProjectId,
    selectedSession?.projectId,
    sessionId,
    setSelectionRefreshToken,
    t,
  ]);

  const handlePreviewAppPlatformChange = useCallback((platform: 'ios' | 'android' | 'harmony') => {
    setPreviewAppPlatform(platform);
    if (platform === 'ios') {
      setPreviewDeviceModel('iphone-14-pro');
      return;
    }
    if (platform === 'android') {
      setPreviewDeviceModel('pixel-7');
      return;
    }
    setPreviewDeviceModel('mate-60');
  }, []);

  const memoizedDevicePreviewProps = useMemo(() => ({
    url: previewUrl,
    platform: previewPlatform,
    webDevice: previewWebDevice,
    mpPlatform: previewMpPlatform,
    appPlatform: previewAppPlatform,
    deviceModel: previewDeviceModel,
    isLandscape: previewIsLandscape,
    refreshKey: previewKey,
  }), [
    previewAppPlatform,
    previewDeviceModel,
    previewIsLandscape,
    previewKey,
    previewMpPlatform,
    previewPlatform,
    previewUrl,
    previewWebDevice,
  ]);
  const handleStudioSidebarResize = useCallback((delta: number) => {
    setChatWidth((previousState) => Math.max(300, Math.min(1280, previousState + delta)));
  }, []);
  const handleStudioCodeExplorerResize = useCallback((delta: number) => {
    setCodeExplorerWidth((previousState) => Math.max(220, Math.min(560, previousState + delta)));
  }, []);
  const handleStudioTerminalResize = useCallback((delta: number) => {
    setTerminalHeight((previousState) => Math.max(100, Math.min(800, previousState - delta)));
  }, []);

  const handleConfirmDelete = () => {
    if (deleteConfirmation?.type === 'message' && deleteConfirmation.parentId) {
      void executeDeleteMessage(
        deleteConfirmation.parentId,
        deleteConfirmation.ids?.length ? deleteConfirmation.ids : [deleteConfirmation.id],
      );
    }
    setDeleteConfirmation(null);
  };

  const handleSelectAgentSession = useCallback((nextProjectId: string, nextAgentSessionId: string) => {
    selectAgentSession(nextAgentSessionId, { projectId: nextProjectId });
  }, [selectAgentSession]);

  const handleCreateSidebarProject = useCallback(async () => {
    const createdProjectId = await onRequestProjectCreation();
    if (createdProjectId) {
      activateCreatedProjectSelection(createdProjectId);
    }
  }, [activateCreatedProjectSelection, onRequestProjectCreation]);

  const handleRetryMountRecovery = useCallback(async () => {
    if (!currentProjectId) {
      addToast('Select a project before reconnecting its local folder.', 'error');
      return;
    }

    setIsMountRecoveryActionPending(true);
    try {
      const recoveredMount = await restoreProjectMount();
      if (!recoveredMount || !isProjectMountReadyForSessionSynchronization(recoveredMount)) {
        addToast('Select the local folder again to restore file access on this device.', 'error');
        return;
      }
      const importedInventory = await importProjectProviderSessions(currentProjectId);
      const failedSessionCount = getProviderSessionImportFailureCount(importedInventory);
      addToast(
        failedSessionCount
          ? t('studio.providerSessionsPartiallyImported', {
              count: failedSessionCount,
              name: currentProject?.name ?? t('studio.localFolder'),
            })
          : t('studio.openedFolder', {
              name: currentProject?.name ?? t('studio.localFolder'),
            }),
        failedSessionCount ? 'info' : 'success',
      );
    } catch (error) {
      console.error('Failed to retry local project folder recovery', error);
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to reconnect the local project folder.',
        'error',
      );
    } finally {
      setIsMountRecoveryActionPending(false);
    }
  }, [
    addToast,
    currentProject?.name,
    currentProjectId,
    restoreProjectMount,
    importProjectProviderSessions,
    t,
  ]);

  const handleReimportProjectFolder = useCallback(async () => {
    if (!currentProjectId) {
      addToast(t('studio.pleaseSelectProject'), 'error');
      return;
    }

    setIsMountRecoveryActionPending(true);
    try {
      const selection = await selectProjectDirectory({
        pickSandboxDirectory: pickDirectory,
        sandboxPickerTitle: t('app.selectServerDirectory'),
      });
      if (!selection) {
        return;
      }

      const reboundProject = await rebindSelectedProjectDirectory({
        bindLocalProjectRuntimeLocation: (projectId, source) =>
          projectRuntimeLocationService.bindLocalProjectRuntimeLocation(projectId, source),
        compositionPort: projectService,
        projectId: currentProjectId,
        fallbackProjectName: currentProject?.name ?? t('studio.localFolder'),
        selection,
      });

      await restoreProjectMount();
      const importedInventory = await importProjectProviderSessions(currentProjectId);
      const failedSessionCount = getProviderSessionImportFailureCount(importedInventory);
      addToast(
        failedSessionCount
          ? t('studio.providerSessionsPartiallyImported', {
              count: failedSessionCount,
              name: reboundProject.projectName,
            })
          : t('studio.openedFolder', { name: reboundProject.projectName }),
        failedSessionCount ? 'info' : 'success',
      );
    } catch (error) {
      console.error('Failed to rebind local project folder', error);
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : t('studio.failedToOpenFolder'),
        'error',
      );
    } finally {
      setIsMountRecoveryActionPending(false);
    }
  }, [
    addToast,
    currentProject?.name,
    currentProjectId,
    pickDirectory,
    projectRuntimeLocationService,
    projectService,
    restoreProjectMount,
    importProjectProviderSessions,
    t,
  ]);

  const studioChatEmptyState = useMemo(
    () => hasSelectedAgentSessionItemsLoadError
      ? (
        <StudioSessionTranscriptErrorState
          description={t('studio.sessionMessagesLoadFailedDescription')}
          onRetry={handleRetrySelectedAgentSessionItems}
          retryLabel={t('studio.retrySessionMessages')}
          title={t('studio.sessionMessagesLoadFailedTitle')}
        />
      )
      : isSelectedAgentSessionHydrating
        ? <StudioSessionTranscriptLoadingState />
        : undefined,
    [
      handleRetrySelectedAgentSessionItems,
      hasSelectedAgentSessionItemsLoadError,
      isSelectedAgentSessionHydrating,
      t,
    ],
  );
  const handleStudioViewChanges = useCallback((file: FileChange) => {
    setViewingDiff(file);
    handleActiveTabChange('code');
  }, [handleActiveTabChange]);
  const handleStudioOpenUrl = useCallback((url: string) => {
    const safeUrl = resolveSafePreviewUrl(url);
    if (safeUrl === 'about:blank') {
      return;
    }
    setPreviewPlatform('web');
    setPreviewWebDevice('desktop');
    setPreviewUrl(safeUrl);
    setPreviewKey((previousKey) => previousKey + 1);
    handleActiveTabChange('preview');
  }, [handleActiveTabChange]);
  const handleStudioOpenMessageFile = useCallback((path: string) => {
    const activateFileEditor = () => {
      setViewingDiff(null);
      handleActiveTabChange('code');
    };
    const settleSelection = (selectionResult: 'opened' | 'rejected') => {
      if (selectionResult === 'rejected') {
        addToast(t('chat.fileOpenUnavailable', { path }), 'error');
        return;
      }
      activateFileEditor();
    };
    const selectionResult = selectMessageFile(path, settleSelection);
    if (selectionResult === 'pending') {
      activateFileEditor();
      return;
    }
    settleSelection(selectionResult);
  }, [addToast, handleActiveTabChange, selectMessageFile, t]);
  const handleStudioEditMessage = useCallback((messageId: string, content: string) => {
    if (sessionId) {
      return handleEditMessage(sessionId, messageId, content);
    }
    return Promise.resolve();
  }, [handleEditMessage, sessionId]);
  const handleStudioDeleteMessage = useCallback((sessionItemIds: string[]) => {
    if (sessionId) {
      void handleDeleteMessage(sessionId, sessionItemIds);
    }
  }, [handleDeleteMessage, sessionId]);
  const handleStudioRegenerateMessage = useCallback(() => {
    if (sessionId) {
      void handleRegenerateMessage(sessionId);
    }
  }, [handleRegenerateMessage, sessionId]);
  const handleStudioRateMessage = useCallback(async (
    messageId: string,
    rating: 'thumbs_up' | 'thumbs_down' | null,
  ) => {
    if (!selectedSession?.agentId || !selectedSession.id) {
      return;
    }
    await agentSessionService.updateSessionItemFeedback(
      { agentId: selectedSession.agentId, sessionId: selectedSession.id },
      messageId,
      rating === null ? null : rating === 'thumbs_up' ? 'up' : 'down',
    );
  }, [agentSessionService, selectedSession]);
  const handleStudioForkMessage = useCallback(async (messageId: string) => {
    if (!selectedSession || !currentProjectId) return;
    const sourceItem = selectedSession.items.find((item) => item.id === messageId);
    try {
      const forked = await forkAgentSession(
        currentProjectId,
        selectedSession.id,
        `${selectedSession.title} (continued)`,
        sourceItem?.turnId,
      );
      handleSelectAgentSession(currentProjectId, forked.id);
      addToast(t('chat.messageForked'), 'success');
    } catch (error) {
      console.error('Failed to continue assistant message in a new chat', error);
      addToast(t('chat.messageForkFailed'), 'error');
    }
  }, [addToast, currentProjectId, forkAgentSession, handleSelectAgentSession, selectedSession, t]);
  const handleStudioRestoreMessage = useCallback((
    messageId: string,
    fileChanges?: readonly FileChange[],
  ) => {
    if (sessionId) {
      void handleRestoreMessage(sessionId, messageId, fileChanges);
    }
  }, [handleRestoreMessage, sessionId]);
  const handleStudioOverlaySelectFile = useCallback((path: string) => {
    selectFile(path);
    setViewingDiff(null);
  }, [selectFile]);
  const handleStudioRetryMountRecovery = useCallback(() => {
    void handleRetryMountRecovery();
  }, [handleRetryMountRecovery]);
  const handleStudioReimportProjectFolder = useCallback(() => {
    void handleReimportProjectFolder();
  }, [handleReimportProjectFolder]);
  const handleStudioCloseFind = useCallback(() => {
    setIsFindVisible(false);
  }, []);
  const handleStudioCloseQuickOpen = useCallback(() => {
    setIsQuickOpenVisible(false);
  }, []);
  const handleStudioNotifyNoResults = useCallback(() => {
    addToast(t('studio.noResultsFound'), 'info');
  }, [addToast, t]);
  const handleStudioCodePanelSelectFile = useCallback((path: string) => {
    setViewingDiff(null);
    handleSelectFile(path);
  }, [handleSelectFile]);
  const handleStudioCloseViewingDiff = useCallback(() => {
    setViewingDiff(null);
  }, []);
  const handlePreviewLandscapeToggle = useCallback(() => {
    setPreviewIsLandscape((previousState) => !previousState);
  }, []);
  const handleRefreshPreview = useCallback(() => {
    void launchPreview();
  }, [launchPreview]);
  const handleOpenPreviewInNewTab = useCallback(() => {
    void launchPreview(true);
  }, [launchPreview]);
  const handleLaunchSimulatorFromHeader = useCallback(() => {
    handleActiveTabChange('simulator');
    void launchSimulator();
  }, [handleActiveTabChange, launchSimulator]);
  const handleToggleStudioTerminal = useCallback(() => {
    setIsTerminalOpen((previousState) => !previousState);
  }, []);
  return (
    <div
      className="flex h-full w-full bg-[#0e0e11] text-gray-300"
      data-studio-surface="true"
    >
      <StudioChatSidebar
        hasMoreProjects={hasMoreProjects}
        hasProjectsLoadError={Boolean(projectsLoadError && projects.length === 0)}
        isVisible={isVisible && isSidebarVisible}
        isLoadingProjects={isLoadingProjects}
        isLoadingMoreProjects={isLoadingMoreProjects}
        width={chatWidth}
        projects={filteredProjects}
        currentProjectId={currentProjectId}
        selectedAgentSessionId={sessionId}
        menuActiveProjectId={menuActiveProjectId}
        projectSearchQuery={projectSearchQuery}
        messages={selectedSessionMessages}
        hasMoreRemoteMessages={Boolean(
          selectedSession?.itemPageInfo?.hasMore
          && selectedSession.itemPageInfo.retentionLimitReached !== true
        )}
        isLoadingMoreRemoteMessages={isLoadingEarlierSelectedAgentSessionItems}
        remoteMessagesLoadError={earlierAgentSessionItemsError}
        pendingApprovals={pendingApprovals}
        pendingUserQuestions={pendingUserQuestions}
        hasPendingInteractionsLoadError={Boolean(pendingInteractionsError)}
        isLoadingPendingInteractions={arePendingInteractionsLoading}
        emptyState={studioChatEmptyState}
        isBusy={isChatBusy}
        isEngineBusy={isChatEngineBusy}
        selectedEngineId={selectedEngineId}
        selectedModelId={selectedModelId}
        disabled={!currentProjectId}
        onResize={handleStudioSidebarResize}
        onProjectSearchQueryChange={setProjectSearchQuery}
        onMenuActiveProjectIdChange={setMenuActiveProjectId}
        onSelectedEngineIdChange={handleSelectedEngineChange}
        onSelectedModelIdChange={handleSelectedModelChange}
        onSendMessage={handleSendMessage}
        onStopTurn={handleStopTurn}
        onSubmitApprovalDecision={handleSubmitApprovalDecision}
        onSubmitUserQuestionAnswer={handleSubmitUserQuestionAnswer}
        onRetryPendingInteractions={handleRetryPendingInteractions}
        onSelectAgentSession={handleSelectAgentSession}
        onCreateProject={handleCreateSidebarProject}
        onLoadMoreProjects={loadMoreProjects}
        onRetryProjects={refreshProjects}
        onLoadMoreProjectSessions={loadMoreProjectSessions}
        onLoadMoreRemoteMessages={handleLoadEarlierSelectedAgentSessionItems}
        onCreateAgentSession={createStudioAgentSessionInProject}
        onRefreshProjectSessions={handleRefreshProjectSessions}
        onRefreshAgentSessionItems={handleRefreshAgentSessionItems}
        refreshingProjectId={refreshingProjectId}
        refreshingAgentSessionId={refreshingAgentSessionId}
        onOpenFile={handleStudioOpenMessageFile}
        onOpenUrl={handleStudioOpenUrl}
        onViewChanges={handleStudioViewChanges}
        onEditMessage={handleStudioEditMessage}
        onDeleteMessage={handleStudioDeleteMessage}
        onRegenerateMessage={handleStudioRegenerateMessage}
        onRateMessage={handleStudioRateMessage}
        onForkMessage={handleStudioForkMessage}
        onRestoreMessage={handleStudioRestoreMessage}
      />

      <StudioMainContent
        model={{
          activeTab,
          codeExplorerWidth,
          currentProjectId,
          fileContent,
          files,
          projectRootPath: projectRoot?.virtualPath ?? '',
          fileTreeLoadError,
          getLanguageFromPath,
          handleActiveTabChange,
          handleAnalyzeCode,
          handleCloseProjectGitOverviewDrawer,
          handleLaunchSimulatorFromHeader,
          handleOpenPreviewInNewTab,
          handlePreviewUrlChange: handleStudioOpenUrl,
          handlePreviewAppPlatformChange,
          handlePreviewLandscapeToggle,
          handleRefreshPreview,
          handleStudioCloseFind,
          handleStudioCloseQuickOpen,
          handleStudioCodeExplorerResize,
          handleStudioCodePanelSelectFile,
          handleStudioNotifyNoResults,
          handleStudioOverlaySelectFile,
          handleStudioReimportProjectFolder,
          handleStudioCloseViewingDiff,
          handleStudioRetryMountRecovery,
          handleStudioTerminalResize,
          handleToggleProjectGitOverviewDrawer,
          handleToggleStudioTerminal,
          isFindVisible,
          isFileTreeLoading,
          isMountRecoveryActionPending,
          isProjectGitOverviewDrawerOpen,
          isQuickOpenVisible,
          isSearchingFiles,
          isSimulatorTabActive,
          isTerminalOpen,
          isVisible,
          loadingDirectoryPaths,
          memoizedDevicePreviewProps,
          mountRecoveryState,
          openFiles,
          previewAppPlatform,
          previewDeviceModel,
          previewIsLandscape,
          previewMpPlatform,
          previewPlatform,
          previewUrl,
          previewWebDevice,
          projectGitOverviewState,
          searchFiles,
          selectedFile,
          setPreviewDeviceModel,
          setPreviewMpPlatform,
          setPreviewPlatform,
          setPreviewWebDevice,
          terminalHeight,
          terminalRequest,
          terminalRuntimeLocationId: selectedSession?.runtimeLocationId,
          updateFileDraft,
          viewingDiff,
          closeFile,
          createFile,
          createFolder,
          deleteFile,
          deleteFolder,
          loadDirectory,
          renameNode,
          refreshFiles,
        }}
      />

      <StudioDialogSurface
        model={{
          analyzeReport,
          deleteConfirmation,
          handleConfirmDelete,
          handleRunTaskExecution,
          handleSaveDebugConfiguration,
          handleSubmitRunConfiguration,
          isAnalyzeModalVisible,
          isDebugConfigVisible,
          isRunConfigVisible,
          isRunTaskVisible,
          runConfigurationDraft,
          runConfigurations,
          setDeleteConfirmation,
          setIsAnalyzeModalVisible,
          setIsDebugConfigVisible,
          setIsRunConfigVisible,
          setIsRunTaskVisible,
          setRunConfigurationDraft,
        }}
      />
    </div>
  );
}

export const StudioPage = memo(StudioPageComponent);
StudioPage.displayName = 'StudioPage';
