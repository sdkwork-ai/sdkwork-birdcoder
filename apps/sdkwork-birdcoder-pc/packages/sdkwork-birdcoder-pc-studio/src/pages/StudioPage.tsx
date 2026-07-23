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
  hydrateImportedProjectFromAuthority,
  importLocalFolderProject,
  openLocalFolder,
  rebindLocalFolderProject,
  resolveLatestAgentSessionIdForProject,
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
  ensureWorkbenchAgentSessionForMessage,
  regenerateWorkbenchAgentSessionFromLastUserMessage,
  useWorkbenchAgentSessionCreationActions,
  useWorkbenchChatSelection,
  useWorkbenchPreferences,
  useAuth,
  useToast,
} from '@sdkwork/birdcoder-pc-workbench';
import {
  FileChange,
  isAgentSessionViewEngineBusy,
  isAgentSessionViewExecuting,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { useTranslation } from 'react-i18next';
import {
  type StudioAnalyzeReport,
  type StudioDeleteConfirmation,
} from './StudioPageDialogs';
import { StudioDialogSurface } from './StudioDialogSurface';
import { StudioChatSidebar } from './StudioChatSidebar';
import { StudioMainContent } from './StudioMainContent';
import { analyzeStudioCode } from './studioCodeAnalysis';
import { useStudioAgentSessionSync } from './useStudioAgentSessionSync';
import { StudioSessionTranscriptLoadingState } from './StudioSessionTranscriptLoadingState';
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
  projectId,
  initialAgentSessionId,
  onProjectChange,
  onAgentSessionChange,
}: StudioPageProps) {
  const { t } = useTranslation();
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
    isLoadingMore: isLoadingMoreProjects,
    projects,
    filteredProjects,
    searchQuery: projectSearchQuery,
    setSearchQuery: setProjectSearchQuery,
    sendMessage,
    createProject,
    createAgentSession,
    deleteProject,
    editAgentSessionItem,
    deleteAgentSessionItem,
    loadMoreProjects,
    loadMoreProjectSessions,
  } = useProjects({
    isActive: isVisible,
    targetProjectId: projectId,
  });
  const {
    agentSessionService,
    projectRuntimeLocationService,
    projectService,
  } = useIDEServices();
  const resolveProjectLocalWorkingDirectory = useProjectLocalWorkingDirectory();
  const resolveProjectRuntimeLocation = useProjectRuntimeLocation();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [sessionId, setSessionId] = useState<string>('');
  const [selectedSessionProjectId, setSelectedSessionProjectId] = useState<string | null>(null);
  const [selectionRefreshToken, setSelectionRefreshToken] = useState(0);
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
  const projectGitOverviewState = useProjectGitOverview({
    isActive: activeTab === 'code',
    projectId: currentProjectId,
  });
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
  const activateImportedProject = useCallback((projectId: string) => {
    const latestAgentSessionId = resolveLatestAgentSessionIdForProject(projects, projectId);
    if (latestAgentSessionId) {
      selectAgentSession(latestAgentSessionId, { projectId });
      return;
    }

    notifyProjectChange(projectId);
    setMenuActiveProjectId(projectId);
    setSessionId('');
    setSelectedSessionProjectId(projectId);
    pendingLocalAgentSessionSelectionKeyRef.current =
      buildAgentSessionProjectScopedKey(projectId, '');
  }, [notifyProjectChange, projects, selectAgentSession]);
  const syncImportedProjectInBackground = useCallback((projectId: string) => {
    void (async () => {
      try {
        const hydratedProject = await hydrateImportedProjectFromAuthority({
          agentSessionService,
          knownProjects: projects,
          projectId,
          projectService,
          userScope: user?.id,
        });
        if (!hydratedProject) {
          return;
        }

        const latestAgentSessionId = hydratedProject.latestAgentSessionId;
        if (latestAgentSessionId) {
          selectAgentSession(latestAgentSessionId, { projectId });
        } else {
          notifyProjectChange(projectId);
          setMenuActiveProjectId(projectId);
          setSessionId('');
          setSelectedSessionProjectId(projectId);
          pendingLocalAgentSessionSelectionKeyRef.current =
            buildAgentSessionProjectScopedKey(projectId, '');
        }
      } catch (error) {
        console.error('Failed to refresh imported project sessions', error);
      }
    })();
  }, [
    agentSessionService,
    notifyProjectChange,
    projectService,
    projects,
    selectAgentSession,
    user?.id,
  ]);
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
    saveFileContent,
    createFile,
    createFolder,
    deleteFile,
    deleteFolder,
    renameNode,
    searchFiles,
    restoreProjectMount,
    flushPendingAutosave,
  } = useFileSystem(currentProjectId, {
    isActive: isVisible,
    loadActive: isVisible && activeTab === 'code',
    realtimeActive: isVisible && activeTab === 'code',
  });

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

  const selectFolderAndImportProject = useCallback(async (fallbackProjectName: string) => {
    const pickerResult = await openLocalFolder();
    if (pickerResult.status === 'cancelled') {
      return null;
    }
    if (pickerResult.status === 'unsupported') {
      addToast(pickerResult.message, 'error');
      return null;
    }

    return importLocalFolderProject({
      bindLocalProjectRuntimeLocation: (projectId, source) =>
        projectRuntimeLocationService.bindLocalProjectRuntimeLocation(projectId, source),
      createProject,
      deleteCreatedProject: deleteProject,
      fallbackProjectName,
      folderInfo: pickerResult.source,
    });
  }, [addToast, createProject, deleteProject, projectRuntimeLocationService]);

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
  const isSelectedAgentSessionItemsLoading = useSelectedAgentSessionItems({
    agentSessionService,
    isActive: isSelectedAgentSessionTranscriptVisible,
    projectService,
    selectionRefreshToken,
    selectedAgentSession: selectedSession,
    selectedAgentSessionId: sessionId,
    selectedProject: selectedAgentSessionLocation?.project ?? currentProject ?? null,
  });
  const isSelectedAgentSessionHydrating = Boolean(
    sessionId &&
    isSelectedAgentSessionItemsLoading &&
    selectedSessionMessages.length === 0
  );
  const {
    handleRefreshAgentSessionItems,
    handleRefreshProjectSessions,
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
  });
  const pendingInteractionRefreshToken = useMemo(() => [
    currentProjectId,
    selectedSession?.id ?? '',
    selectedSession?.runtimeStatus ?? '',
    selectedSession?.updatedAt ?? '',
    selectedSession?.lastTurnAt ?? '',
    selectedSession?.transcriptUpdatedAt ?? '',
  ].join('\u0001'), [currentProjectId, selectedSession]);
  const pendingInteractionScopeKey =
    currentProjectId && sessionId
      ? `${currentProjectId}\u0001${sessionId}`
      : sessionId || null;
  const {
    approvals: pendingApprovals,
    questions: pendingUserQuestions,
    submitApprovalDecision,
    submitQuestionAnswer,
  } = useAgentSessionPendingInteractions(
    sessionId || null,
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
      await handleRefreshAgentSessionItems(sessionId);
    }
  }, [handleRefreshAgentSessionItems, sessionId, submitApprovalDecision]);
  const handleSubmitUserQuestionAnswer = useCallback(async (
    questionId: string,
    request: AgentQuestionAnswerInput,
  ) => {
    await submitQuestionAnswer(questionId, request);
    if (sessionId) {
      await handleRefreshAgentSessionItems(sessionId);
    }
  }, [handleRefreshAgentSessionItems, sessionId, submitQuestionAnswer]);

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

  const handleDeleteMessage = useCallback(async (agentSessionId: string, messageIds: string[]) => {
    const normalizedMessageIds = messageIds
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

  const executeDeleteMessage = async (agentSessionId: string, messageIds: string[]) => {
    const project = resolveAgentSessionLocation(agentSessionId, currentProjectId)?.project;
    if (project) {
      try {
        const deletedMessageCount = await deleteWorkbenchAgentSessionItems({
          agentSessionId,
          deleteAgentSessionItem,
          messageIds,
          projectId: project.projectId,
        });
        addToast(
          deletedMessageCount > 1 ? 'Reply deleted successfully' : t('studio.messageDeleted'),
          'success',
        );
      } catch (error) {
        console.error('Failed to delete coding session message', error);
        addToast(messageIds.length > 1 ? 'Failed to delete reply' : t('studio.failedToDeleteMessage'), 'error');
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
          await regenerateWorkbenchAgentSessionFromLastUserMessage({
            agentSession,
            deleteAgentSessionItem,
            projectId: project.projectId,
            regenerateMessageContext: buildWorkbenchAgentSessionTurnContext({
              currentFileContent: fileContent,
              currentFileLanguage: selectedFile ? getLanguageFromPath(selectedFile) : null,
              currentFilePath: selectedFile,
              projectId: project.projectId,
              sessionId: agentSession.id,
            }),
            submitAgentTurn: (targetProjectId, targetAgentSessionId, content, context) =>
              sendMessage(targetProjectId, targetAgentSessionId, content, context),
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
    regenerateWorkbenchAgentSessionFromLastUserMessage,
    resolveAgentSessionLocation,
    selectedFile,
    sendMessage,
    setSelectionRefreshToken,
  ]);

  const handleRestoreMessage = useCallback(async (agentSessionId: string, messageId: string) => {
    const agentSession =
      resolveAgentSessionLocation(agentSessionId, currentProjectId)?.agentSession;
    const msg = agentSession?.items.find(m => m.id === messageId);
    try {
      const didRestore = await restoreWorkbenchAgentSessionItemFiles({
        fileChanges: msg?.fileChanges,
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
    saveFileContent,
    t,
  ]);

  const handleSendMessage = useCallback(async (
    text?: string,
    composerSelection?: {
      engineId?: string | null;
      modelId?: string | null;
    },
  ) => {
    const trimmedContent = typeof text === 'string' ? text.trim() : '';
    if (!trimmedContent) {
      return;
    }
    if (isChatBusy) {
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
    const bootstrappedSession = await ensureWorkbenchAgentSessionForMessage({
      createAgentSessionFromRequest,
      currentAgentSessionId,
      currentProjectId,
      messageContent: trimmedContent,
      requestedEngineId: composerSelection?.engineId,
      requestedModelId: composerSelection?.modelId,
      resolveProjectId: async () => {
        if (projects.length === 0) {
          const importedProject = await selectFolderAndImportProject(t('studio.newProject'));
          if (!importedProject) {
            return null;
          }
          notifyProjectChange(importedProject.projectId);
          setMenuActiveProjectId(importedProject.projectId);
          return importedProject.projectId;
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
      const sentMessage = await sendMessage(
        bootstrappedSession.projectId,
        bootstrappedSession.agentSessionId,
        trimmedContent,
        context,
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
    ensureWorkbenchAgentSessionForMessage,
    createAgentSessionFromRequest,
    currentProjectId,
    fileContent,
    isChatBusy,
    notifyProjectChange,
    projects,
    selectAgentSession,
    selectFolderAndImportProject,
    selectedSession?.engineId,
    selectedSession?.modelId,
    selectedFile,
    sendMessage,
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
    try {
      const newProject = await selectFolderAndImportProject(t('studio.newProject'));
      if (!newProject) {
        return;
      }
      activateImportedProject(newProject.projectId);
      syncImportedProjectInBackground(newProject.projectId);
      addToast(t('studio.projectCreated'), 'success');
    } catch (error) {
      console.error('Failed to create project', error);
      addToast(t('studio.failedToCreateProject'), 'error');
    }
  }, [activateImportedProject, addToast, selectFolderAndImportProject, syncImportedProjectInBackground, t]);

  const handleOpenSidebarFolder = useCallback(async () => {
    try {
      const importedProject = await selectFolderAndImportProject(t('studio.localFolder'));
      if (!importedProject) {
        return;
      }

      activateImportedProject(importedProject.projectId);
      syncImportedProjectInBackground(importedProject.projectId);
      addToast(t('studio.openedFolder', { name: importedProject.projectName }), 'success');
    } catch (error) {
      console.error('Failed to open folder', error);
      addToast(t('studio.failedToOpenFolder'), 'error');
    }
  }, [activateImportedProject, addToast, selectFolderAndImportProject, syncImportedProjectInBackground, t]);

  const handleRetryMountRecovery = useCallback(async () => {
    if (!currentProjectId) {
      addToast('Select a project before reconnecting its local folder.', 'error');
      return;
    }

    setIsMountRecoveryActionPending(true);
    try {
      const recoveredFiles = await restoreProjectMount();
      if (recoveredFiles.length === 0) {
        addToast('Select the local folder again to restore file access on this device.', 'error');
        return;
      }
      addToast(t('studio.openedFolder', { name: currentProject?.name ?? 'Local folder' }), 'success');
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
  }, [addToast, currentProject?.name, currentProjectId, restoreProjectMount, t]);

  const handleReimportProjectFolder = useCallback(async () => {
    if (!currentProjectId) {
      addToast(t('studio.pleaseSelectProject'), 'error');
      return;
    }

    setIsMountRecoveryActionPending(true);
    try {
      const pickerResult = await openLocalFolder();
      if (pickerResult.status === 'cancelled') {
        return;
      }
      if (pickerResult.status === 'unsupported') {
        addToast(pickerResult.message, 'error');
        return;
      }

      const reboundProject = await rebindLocalFolderProject({
        bindLocalProjectRuntimeLocation: (projectId, source) =>
          projectRuntimeLocationService.bindLocalProjectRuntimeLocation(projectId, source),
        projectId: currentProjectId,
        fallbackProjectName: currentProject?.name ?? t('studio.localFolder'),
        folderInfo: pickerResult.source,
      });

      syncImportedProjectInBackground(currentProjectId);
      addToast(t('studio.openedFolder', { name: reboundProject.projectName }), 'success');
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
    projectRuntimeLocationService,
    syncImportedProjectInBackground,
    t,
  ]);

  const studioChatEmptyState = useMemo(
    () => (isSelectedAgentSessionHydrating ? <StudioSessionTranscriptLoadingState /> : undefined),
    [isSelectedAgentSessionHydrating],
  );
  const handleStudioViewChanges = useCallback((file: FileChange) => {
    setViewingDiff(file);
    handleActiveTabChange('code');
  }, [handleActiveTabChange]);
  const handleStudioOpenMessageFile = useCallback((path: string) => {
    const settleSelection = (selectionResult: 'opened' | 'rejected') => {
      if (selectionResult === 'rejected') {
        addToast(t('chat.fileOpenUnavailable', { path }), 'error');
        return;
      }
      setViewingDiff(null);
      handleActiveTabChange('code');
    };
    const selectionResult = selectMessageFile(path, settleSelection);
    if (selectionResult !== 'pending') {
      settleSelection(selectionResult);
    }
  }, [addToast, handleActiveTabChange, selectMessageFile, t]);
  const handleStudioEditMessage = useCallback((messageId: string, content: string) => {
    if (sessionId) {
      return handleEditMessage(sessionId, messageId, content);
    }
    return Promise.resolve();
  }, [handleEditMessage, sessionId]);
  const handleStudioDeleteMessage = useCallback((messageIds: string[]) => {
    if (sessionId) {
      void handleDeleteMessage(sessionId, messageIds);
    }
  }, [handleDeleteMessage, sessionId]);
  const handleStudioRegenerateMessage = useCallback(() => {
    if (sessionId) {
      void handleRegenerateMessage(sessionId);
    }
  }, [handleRegenerateMessage, sessionId]);
  const handleStudioRestoreMessage = useCallback((messageId: string) => {
    if (sessionId) {
      void handleRestoreMessage(sessionId, messageId);
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
    <div className="flex h-full w-full bg-[#0e0e11] text-gray-300">
      <StudioChatSidebar
        hasMoreProjects={hasMoreProjects}
        isVisible={isVisible && isSidebarVisible}
        isLoadingMoreProjects={isLoadingMoreProjects}
        width={chatWidth}
        projects={filteredProjects}
        currentProjectId={currentProjectId}
        selectedAgentSessionId={sessionId}
        menuActiveProjectId={menuActiveProjectId}
        projectSearchQuery={projectSearchQuery}
        messages={selectedSessionMessages}
        pendingApprovals={pendingApprovals}
        pendingUserQuestions={pendingUserQuestions}
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
        onSubmitApprovalDecision={handleSubmitApprovalDecision}
        onSubmitUserQuestionAnswer={handleSubmitUserQuestionAnswer}
        onSelectAgentSession={handleSelectAgentSession}
        onCreateProject={handleCreateSidebarProject}
        onLoadMoreProjects={loadMoreProjects}
        onLoadMoreProjectSessions={loadMoreProjectSessions}
        onOpenFolder={handleOpenSidebarFolder}
        onCreateAgentSession={createStudioAgentSessionInProject}
        onRefreshProjectSessions={handleRefreshProjectSessions}
        onRefreshAgentSessionItems={handleRefreshAgentSessionItems}
        refreshingProjectId={refreshingProjectId}
        refreshingAgentSessionId={refreshingAgentSessionId}
        onOpenFile={handleStudioOpenMessageFile}
        onViewChanges={handleStudioViewChanges}
        onEditMessage={handleStudioEditMessage}
        onDeleteMessage={handleStudioDeleteMessage}
        onRegenerateMessage={handleStudioRegenerateMessage}
        onRestoreMessage={handleStudioRestoreMessage}
      />

      <StudioMainContent
        model={{
          activeTab,
          codeExplorerWidth,
          currentProjectId,
          fileContent,
          files,
          getLanguageFromPath,
          handleActiveTabChange,
          handleAnalyzeCode,
          handleCloseProjectGitOverviewDrawer,
          handleLaunchSimulatorFromHeader,
          handleOpenPreviewInNewTab,
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
          updateFileDraft,
          viewingDiff,
          closeFile,
          createFile,
          createFolder,
          deleteFile,
          deleteFolder,
          loadDirectory,
          renameNode,
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
