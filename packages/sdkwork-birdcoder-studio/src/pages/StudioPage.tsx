import { memo, startTransition, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  buildCodingSessionProjectScopedKey,
  buildProjectCodingSessionIndex,
  buildWorkbenchCodingSessionTurnContext,
  buildWorkbenchCodingSessionTurnModelSelectionMetadata,
  createIdleProjectMountRecoveryState,
  deleteWorkbenchCodingSessionMessages,
  emitProjectMountRecoveryState,
  getDefaultRunConfigurations,
  globalEventBus,
  hydrateImportedProjectFromAuthority,
  importLocalFolderProject,
  openLocalFolder,
  rebindLocalFolderProject,
  resolveLatestCodingSessionIdForProject,
  resolveProjectMountRecoverySource,
  restoreWorkbenchCodingSessionMessageFiles,
  type RunConfigurationRecord,
  type TerminalCommandRequest,
  useCodingSessionActions,
  useCodingSessionEngineModelSelection,
  useCodingSessionPendingInteractionState,
  useFileSystem,
  useIDEServices,
  useProjects,
  useProjectGitOverview,
  useProjectRunConfigurations,
  useSelectedCodingSessionMessages,
  useSessionRefreshActions,
  useWorkbenchCodingSessionMessageEditAction,
  ensureWorkbenchCodingSessionForMessage,
  regenerateWorkbenchCodingSessionFromLastUserMessage,
  useWorkbenchCodingSessionCreationActions,
  useWorkbenchChatSelection,
  useWorkbenchPreferences,
  useAuth,
  useToast,
} from '@sdkwork/birdcoder-commons';
import {
  FileChange,
  isBirdCoderCodingSessionEngineBusy,
  isBirdCoderCodingSessionExecuting,
  type BirdCoderSubmitApprovalDecisionRequest,
  type BirdCoderSubmitUserQuestionAnswerRequest,
} from '@sdkwork/birdcoder-types';
import { useTranslation } from 'react-i18next';
import {
  type StudioAnalyzeReport,
  type StudioDeleteConfirmation,
} from './StudioPageDialogs';
import { StudioDialogSurface } from './StudioDialogSurface';
import { StudioChatSidebar } from './StudioChatSidebar';
import { StudioMainContent } from './StudioMainContent';
import { analyzeStudioCode } from './studioCodeAnalysis';
import { useStudioCodingSessionSync } from './useStudioCodingSessionSync';
import { StudioSessionTranscriptLoadingState } from './StudioSessionTranscriptLoadingState';
import { useStudioCollaboration } from './useStudioCollaboration';
import { useStudioExecutionActions } from './useStudioExecutionActions';
import { useStudioWorkbenchEventBindings } from './useStudioWorkbenchEventBindings';
import {
  EMPTY_STUDIO_CHAT_MESSAGES,
  getLanguageFromPath,
  type StudioPageProps,
} from './StudioPage.shared';

function StudioPageComponent({
  isVisible = true,
  workspaceId,
  projectId,
  initialCodingSessionId,
  onProjectChange,
  onCodingSessionChange,
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
    hasFetched: hasFetchedProjects,
    projects,
    filteredProjects,
    searchQuery: projectSearchQuery,
    setSearchQuery: setProjectSearchQuery,
    sendMessage,
    createProject,
    createCodingSession,
    updateProject,
    editCodingSessionMessage,
    deleteCodingSessionMessage,
  } = useProjects(workspaceId, {
    isActive: isVisible,
  });
  const { collaborationService, coreReadService, projectService } = useIDEServices();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [sessionId, setSessionId] = useState<string>('');
  const [selectedSessionProjectId, setSelectedSessionProjectId] = useState<string | null>(null);
  const [selectionRefreshToken, setSelectionRefreshToken] = useState(0);
  const pendingProjectChangeIdRef = useRef<string | null>(null);
  const pendingLocalCodingSessionSelectionKeyRef = useRef<string | null>(null);
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
  const [showPublishModal, setShowPublishModal] = useState(false);
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
    () => buildProjectCodingSessionIndex(projects),
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
  const resolveCodingSessionLocation = useCallback(
    (id: string | null | undefined, scopedProjectId?: string | null) => {
      const normalizedCodingSessionId = id?.trim() ?? '';
      if (!normalizedCodingSessionId) {
        return null;
      }

      const normalizedScopedProjectId = scopedProjectId?.trim() ?? '';
      if (normalizedScopedProjectId) {
        return sessionIndex.codingSessionLocationsByProjectIdAndId.get(
          buildCodingSessionProjectScopedKey(
            normalizedScopedProjectId,
            normalizedCodingSessionId,
          ),
        ) ?? null;
      }

      return sessionIndex.codingSessionLocationsById.get(normalizedCodingSessionId) ?? null;
    },
    [sessionIndex],
  );
  const selectedCodingSessionLocation = resolveCodingSessionLocation(
    sessionId,
    selectedSessionProjectId ?? projectId,
  );
  const sessionProjectId = selectedCodingSessionLocation?.project.id ?? '';
  const normalizedProjectId = projectId?.trim() ?? '';
  const normalizedSelectedSessionProjectId = selectedSessionProjectId?.trim() ?? '';
  const normalizedSessionProjectId = sessionProjectId?.trim() ?? '';
  const normalizedInitialCodingSessionId = initialCodingSessionId?.trim() || '';
  const currentProjectId =
    normalizedSessionProjectId || normalizedSelectedSessionProjectId || normalizedProjectId;
  const projectGitOverviewState = useProjectGitOverview({
    isActive: activeTab === 'code',
    projectId: currentProjectId,
  });
  const { runConfigurations, saveRunConfiguration } = useProjectRunConfigurations(currentProjectId || null);
  const selectedSession = selectedCodingSessionLocation?.codingSession;
  const {
    createCodingSessionWithSelection,
    selectedEngineId,
    selectedModelId,
    setSelectedEngineId,
    setSelectedModelId,
  } = useWorkbenchChatSelection({
    createCodingSession,
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
  const selectCodingSession = useCallback((
    nextCodingSessionId: string,
    options?: { projectId?: string },
  ) => {
    const normalizedCodingSessionId = nextCodingSessionId.trim();
    if (!normalizedCodingSessionId) {
      return;
    }

    const nextProjectId =
      options?.projectId?.trim() ||
      (resolveCodingSessionLocation(normalizedCodingSessionId)?.project.id ?? '');

    if (
      normalizedCodingSessionId === sessionId &&
      nextProjectId === currentProjectId
    ) {
      setSelectionRefreshToken((previousState) => previousState + 1);
      return;
    }

    pendingLocalCodingSessionSelectionKeyRef.current = nextProjectId
      ? buildCodingSessionProjectScopedKey(nextProjectId, normalizedCodingSessionId)
      : normalizedCodingSessionId;
    if (nextProjectId) {
      setMenuActiveProjectId(nextProjectId);
    }
    setSessionId(normalizedCodingSessionId);
    setSelectedSessionProjectId(nextProjectId || null);
  }, [currentProjectId, resolveCodingSessionLocation, sessionId]);
  const { createCodingSessionInProject } = useWorkbenchCodingSessionCreationActions({
    addToast,
    createCodingSessionWithSelection,
    currentProjectId,
    selectCodingSession,
    labels: {
      creationFailed: t('studio.failedToCreateSession'),
      creationSucceeded: t('studio.newSessionCreated'),
      noProjectSelected: t('studio.pleaseSelectProject'),
    },
  });
  const createStudioCodingSessionInProject = useCallback(
    (projectId: string, engineId?: string, modelId?: string) =>
      createCodingSessionInProject(projectId, engineId, { modelId }),
    [createCodingSessionInProject],
  );
  const projectsRef = useRef(projects);
  const selectedCodingSessionIdRef = useRef(sessionId);
  const currentProjectIdRef = useRef(currentProjectId);
  const runConfigurationsRef = useRef(runConfigurations);
  const defaultWorkingDirectoryRef = useRef(preferences.defaultWorkingDirectory);
  const selectCodingSessionRef = useRef(selectCodingSession);

  useEffect(() => {
    projectsRef.current = projects;
    selectedCodingSessionIdRef.current = sessionId;
    currentProjectIdRef.current = currentProjectId;
    runConfigurationsRef.current = runConfigurations;
    defaultWorkingDirectoryRef.current = preferences.defaultWorkingDirectory;
    selectCodingSessionRef.current = selectCodingSession;
  }, [
    currentProjectId,
    preferences.defaultWorkingDirectory,
    projects,
    runConfigurations,
    selectCodingSession,
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
  useCodingSessionActions(
    currentProjectId,
    createCodingSessionWithSelection,
    (codingSessionId) => {
      selectCodingSession(codingSessionId, {
        projectId: currentProjectId,
      });
    },
    {
      isActive: isVisible,
      createCodingSessionInProject: createStudioCodingSessionInProject,
    },
  );
  useStudioWorkbenchEventBindings({
    addToast,
    isActive: isVisible,
    currentProjectIdRef,
    defaultWorkingDirectoryRef,
    projectsRef,
    runConfigurationsRef,
    selectedCodingSessionIdRef,
    selectCodingSessionRef,
    setIsDebugConfigVisible,
    setIsFindVisible,
    setIsQuickOpenVisible,
    setIsRunConfigVisible,
    setIsRunTaskVisible,
    setIsTerminalOpen,
    setTerminalRequest,
    setViewingDiff,
    t,
  });
  
  const [chatWidth, setChatWidth] = useState(720);
  const [deleteConfirmation, setDeleteConfirmation] = useState<StudioDeleteConfirmation | null>(null);

  useEffect(() => {
    if (
      !normalizedSessionProjectId ||
      !onProjectChange ||
      onCodingSessionChange ||
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
    onCodingSessionChange,
    onProjectChange,
  ]);

  useStudioCodingSessionSync({
    isActive: isVisible,
    projects,
    initialCodingSessionId: normalizedInitialCodingSessionId,
    initialProjectId: normalizedProjectId,
    onCodingSessionChange,
    pendingLocalCodingSessionSelectionKeyRef,
    selectedProjectId: currentProjectId,
    selectedCodingSessionId: sessionId,
    setSelectedCodingSessionId: setSessionId,
    setSelectedCodingSessionProjectId: setSelectedSessionProjectId,
  });

  useEffect(() => {
    if (!isVisible || !hasFetchedProjects) {
      return;
    }

    if (projects.length > 0) {
      if (!menuActiveProjectId || !resolveProjectById(menuActiveProjectId)) {
        setMenuActiveProjectId(projects[0].id);
      }
      if (currentProjectId && !resolveProjectById(currentProjectId)) {
        notifyProjectChange('');
        setSessionId('');
        setSelectedSessionProjectId(null);
      } else if (sessionId) {
        const retainedProjectId =
          selectedSessionProjectId?.trim() ||
          projectId?.trim() ||
          currentProjectId;
        if (
          !resolveCodingSessionLocation(sessionId, retainedProjectId) &&
          (!retainedProjectId || !resolveProjectById(retainedProjectId))
        ) {
          setSessionId('');
          setSelectedSessionProjectId(retainedProjectId || null);
        }
      }
    } else {
      setMenuActiveProjectId('');
      if (currentProjectId) {
        notifyProjectChange('');
      }
      setSessionId('');
      setSelectedSessionProjectId(null);
    }
  }, [
    currentProjectId,
    hasFetchedProjects,
    isVisible,
    menuActiveProjectId,
    notifyProjectChange,
    projectId,
    projects,
    resolveCodingSessionLocation,
    resolveProjectById,
    sessionId,
    selectedSessionProjectId,
  ]);

  const [isSubmittingTurn, setIsSubmittingTurn] = useState(false);

  const selectedSessionMessages = useMemo(
    () => selectedSession?.messages ?? EMPTY_STUDIO_CHAT_MESSAGES,
    [selectedSession?.messages],
  );
  const isSelectedSessionTurnActive = isBirdCoderCodingSessionExecuting(selectedSession);
  const isSelectedSessionEngineBusy = isBirdCoderCodingSessionEngineBusy(selectedSession);
  const isChatBusy = isSubmittingTurn || isSelectedSessionTurnActive;
  const isChatEngineBusy = isSubmittingTurn || isSelectedSessionEngineBusy;
  const currentProject =
    selectedCodingSessionLocation?.project ??
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
    currentProjectPath: currentProject?.path,
    defaultWorkingDirectory: preferences.defaultWorkingDirectory,
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
  } = useCodingSessionEngineModelSelection({
    preferences,
    selectedModelId,
    sessionId,
    setSelectedEngineId,
    setSelectedModelId,
  });
  const activateImportedProject = useCallback((projectId: string) => {
    const latestCodingSessionId = resolveLatestCodingSessionIdForProject(projects, projectId);
    if (latestCodingSessionId) {
      selectCodingSession(latestCodingSessionId, { projectId });
      return;
    }

    notifyProjectChange(projectId);
    setMenuActiveProjectId(projectId);
    setSessionId('');
    setSelectedSessionProjectId(projectId);
    pendingLocalCodingSessionSelectionKeyRef.current =
      buildCodingSessionProjectScopedKey(projectId, '');
  }, [notifyProjectChange, projects, selectCodingSession]);
  const syncImportedProjectInBackground = useCallback((projectId: string) => {
    void (async () => {
      try {
        const hydratedProject = await hydrateImportedProjectFromAuthority({
          knownProjects: projects,
          projectId,
          projectService,
          userScope: user?.id,
          workspaceId: workspaceId?.trim() || '',
        });
        if (!hydratedProject) {
          return;
        }

        const latestCodingSessionId = hydratedProject.latestCodingSessionId;
        if (latestCodingSessionId) {
          selectCodingSession(latestCodingSessionId, { projectId });
        } else {
          notifyProjectChange(projectId);
          setMenuActiveProjectId(projectId);
          setSessionId('');
          setSelectedSessionProjectId(projectId);
          pendingLocalCodingSessionSelectionKeyRef.current =
            buildCodingSessionProjectScopedKey(projectId, '');
        }
      } catch (error) {
        console.error('Failed to refresh imported project sessions', error);
      }
    })();
  }, [notifyProjectChange, projectService, projects, selectCodingSession, user?.id, workspaceId]);
  const {
    handleCopyPublicLink,
    handleInviteCollaborator,
    inviteEmail,
    isCollaboratorsLoading,
    isInvitePending,
    projectCollaborators,
    publicShareUrl,
    setInviteEmail,
    setShareAccess,
    setShowShareModal,
    shareAccess,
    showShareModal,
  } = useStudioCollaboration({
    addToast,
    collaborationService,
    currentProjectId,
    messages: {
      failedToInvite: 'Failed to invite collaborator.',
      failedToLoad: 'Failed to load project collaborators.',
      invitationSent: t('studio.invitationSent'),
      linkCopied: t('studio.linkCopied'),
      noProjectSelected: t('studio.pleaseSelectProject'),
    },
  });
  const restoreSelectionAfterRefresh = (
    targetProjectId: string,
    targetCodingSessionId: string | null,
  ) => {
    const normalizedTargetProjectId = targetProjectId.trim();
    const normalizedTargetCodingSessionId = targetCodingSessionId?.trim() ?? '';
    const normalizedSelectedCodingSessionId = sessionId.trim();

    if (
      normalizedTargetCodingSessionId &&
      normalizedTargetCodingSessionId === normalizedSelectedCodingSessionId &&
      normalizedTargetProjectId === currentProjectId
    ) {
      return;
    }

    if (targetCodingSessionId) {
      selectCodingSession(targetCodingSessionId, {
        projectId: targetProjectId,
      });
      return;
    }
    if (targetProjectId) {
      notifyProjectChange(targetProjectId);
      setMenuActiveProjectId(targetProjectId);
      setSessionId('');
      setSelectedSessionProjectId(targetProjectId);
      pendingLocalCodingSessionSelectionKeyRef.current =
        buildCodingSessionProjectScopedKey(targetProjectId, '');
    }
  };

  const {
    files,
    loadingDirectoryPaths,
    openFiles,
    selectedFile,
    fileContent,
    isSearchingFiles,
    mountRecoveryState,
    selectFile,
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
    mountFolder,
  } = useFileSystem(currentProjectId, currentProject?.path, {
    isActive: isVisible,
    loadActive: isVisible && activeTab === 'code',
    realtimeActive: isVisible && activeTab === 'code',
  });
  const previousMountRecoveryStatusRef = useRef(mountRecoveryState.status);

  const selectFolderAndImportProject = useCallback(async (fallbackProjectName: string) => {
    const folderInfo = await openLocalFolder();
    if (!folderInfo) {
      return null;
    }

    const normalizedWorkspaceId = workspaceId?.trim() ?? '';

    return importLocalFolderProject({
      createProject,
      fallbackProjectName,
      folderInfo,
      getProjectByPath: (projectPath) =>
        normalizedWorkspaceId
          ? projectService.getProjectByPath(normalizedWorkspaceId, projectPath)
          : Promise.resolve(null),
      mountFolder,
      updateProject,
    });
  }, [createProject, mountFolder, projectService, updateProject, workspaceId]);

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

  const isSelectedCodingSessionTranscriptVisible = isVisible && isSidebarVisible;
  const isSelectedCodingSessionMessagesLoading = useSelectedCodingSessionMessages({
    coreReadService,
    isActive: isSelectedCodingSessionTranscriptVisible,
    projectService,
    selectionRefreshToken,
    selectedCodingSession: selectedSession,
    selectedCodingSessionId: sessionId,
    selectedProject: selectedCodingSessionLocation?.project ?? currentProject ?? null,
    workspaceId,
  });
  const isSelectedCodingSessionHydrating = Boolean(
    sessionId &&
    isSelectedCodingSessionMessagesLoading &&
    selectedSessionMessages.length === 0
  );
  const {
    handleRefreshCodingSessionMessages,
    handleRefreshProjectSessions,
    refreshingCodingSessionId,
    refreshingProjectId,
  } = useSessionRefreshActions({
    addToast,
    coreReadService,
    getPreservedSelection: () => ({
      codingSessionId: sessionId,
      projectId: currentProjectId,
    }),
    messages: {
      failedToRefreshProjectSessions: t('studio.failedToRefreshProjectSessions'),
      failedToRefreshSessionMessages: t('studio.failedToRefreshSessionMessages'),
      projectSessionsRefreshed: (projectName: string) =>
        t('studio.projectSessionsRefreshed', { name: projectName }),
      sessionMessagesRefreshed: (codingSessionTitle: string) =>
        t('studio.sessionMessagesRefreshed', { name: codingSessionTitle }),
    },
    projectService,
    resolveCodingSessionLocation: (codingSessionId: string, targetProjectId?: string | null) =>
      resolveCodingSessionLocation(codingSessionId, targetProjectId),
    resolveCodingSessionTitle: (codingSessionId: string, targetProjectId?: string | null) =>
      resolveCodingSessionLocation(codingSessionId, targetProjectId)
        ?.codingSession.title ?? codingSessionId,
    resolveProjectName: (targetProjectId: string) =>
      resolveProjectById(targetProjectId)?.name ?? targetProjectId,
    restoreSelectionAfterRefresh,
    workspaceId,
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
      ? `${workspaceId ?? ''}\u0001${currentProjectId}\u0001${sessionId}`
      : sessionId || null;
  const {
    approvals: pendingApprovals,
    questions: pendingUserQuestions,
    submitApprovalDecision,
    submitUserQuestionAnswer,
  } = useCodingSessionPendingInteractionState(
    sessionId || null,
    pendingInteractionRefreshToken,
    pendingInteractionScopeKey,
    currentProjectId,
  );
  const handleSubmitApprovalDecision = useCallback(async (
    approvalId: string,
    request: BirdCoderSubmitApprovalDecisionRequest,
  ) => {
    await submitApprovalDecision(approvalId, request);
    if (sessionId) {
      await handleRefreshCodingSessionMessages(sessionId);
    }
  }, [handleRefreshCodingSessionMessages, sessionId, submitApprovalDecision]);
  const handleSubmitUserQuestionAnswer = useCallback(async (
    questionId: string,
    request: BirdCoderSubmitUserQuestionAnswerRequest,
  ) => {
    await submitUserQuestionAnswer(questionId, request);
    if (sessionId) {
      await handleRefreshCodingSessionMessages(sessionId);
    }
  }, [handleRefreshCodingSessionMessages, sessionId, submitUserQuestionAnswer]);

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

  const handleEditMessage = useWorkbenchCodingSessionMessageEditAction({
    editCodingSessionMessage,
    resolveCodingSessionLocation: (codingSessionId: string) =>
      resolveCodingSessionLocation(codingSessionId, currentProjectId),
    sessionUnavailableMessage: t('chat.sendMessageSessionUnavailable'),
    setSelectionRefreshToken,
  });

  const handleDeleteMessage = useCallback(async (codingSessionId: string, messageIds: string[]) => {
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
      parentId: codingSessionId,
    });
  }, []);

  const executeDeleteMessage = async (codingSessionId: string, messageIds: string[]) => {
    const project = resolveCodingSessionLocation(codingSessionId, currentProjectId)?.project;
    if (project) {
      try {
        const deletedMessageCount = await deleteWorkbenchCodingSessionMessages({
          codingSessionId,
          deleteCodingSessionMessage,
          messageIds,
          projectId: project.id,
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

  const handleRegenerateMessage = useCallback(async (codingSessionId: string) => {
    if (isChatBusy) {
      return;
    }

    const resolvedSessionLocation = resolveCodingSessionLocation(codingSessionId, currentProjectId);
    const project = resolvedSessionLocation?.project;
    if (project) {
      const codingSession = resolvedSessionLocation?.codingSession;
      if (!codingSession) return;

      setIsSubmittingTurn(true);
      try {
        const didRegenerate =
          await regenerateWorkbenchCodingSessionFromLastUserMessage({
            codingSession,
            deleteCodingSessionMessage,
            projectId: project.id,
            regenerateMessageContext: buildWorkbenchCodingSessionTurnContext({
              currentFileContent: fileContent,
              currentFileLanguage: selectedFile ? getLanguageFromPath(selectedFile) : null,
              currentFilePath: selectedFile,
              projectId: project.id,
              sessionId: codingSession.id,
              workspaceId,
            }),
            sendCodingSessionMessage: (targetProjectId, targetCodingSessionId, content, context) =>
              sendMessage(targetProjectId, targetCodingSessionId, content, context),
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
    deleteCodingSessionMessage,
    fileContent,
    isChatBusy,
    buildWorkbenchCodingSessionTurnContext,
    regenerateWorkbenchCodingSessionFromLastUserMessage,
    resolveCodingSessionLocation,
    selectedFile,
    sendMessage,
    setSelectionRefreshToken,
    workspaceId,
  ]);

  const handleRestoreMessage = useCallback(async (codingSessionId: string, messageId: string) => {
    const codingSession =
      resolveCodingSessionLocation(codingSessionId, currentProjectId)?.codingSession;
    const msg = codingSession?.messages?.find(m => m.id === messageId);
    try {
      const didRestore = await restoreWorkbenchCodingSessionMessageFiles({
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
    resolveCodingSessionLocation,
    restoreWorkbenchCodingSessionMessageFiles,
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
    const currentSessionEngineId = selectedSession?.engineId?.trim() ?? '';
    const currentCodingSessionId =
      currentSessionEngineId &&
      requestedEngineId &&
      requestedEngineId.toLowerCase() !== currentSessionEngineId.toLowerCase()
        ? null
        : sessionId;
    const bootstrappedSession = await ensureWorkbenchCodingSessionForMessage({
      createCodingSessionWithSelection,
      currentCodingSessionId,
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

        return projects[0]?.id;
      },
      selectCodingSession,
    });
    if (!bootstrappedSession) {
      throw new Error(t('chat.sendMessageSessionUnavailable'));
    }

    setIsSubmittingTurn(true);
    try {
      const context = buildWorkbenchCodingSessionTurnContext({
        currentFileContent: fileContent,
        currentFileLanguage: selectedFile ? getLanguageFromPath(selectedFile) : null,
        currentFilePath: selectedFile,
        projectId: bootstrappedSession.projectId,
        sessionId: bootstrappedSession.codingSessionId,
        workspaceId,
      });
      const turnModelSelectionMetadata =
        buildWorkbenchCodingSessionTurnModelSelectionMetadata(composerSelection);
      const sentMessage = await sendMessage(
        bootstrappedSession.projectId,
        bootstrappedSession.codingSessionId,
        trimmedContent,
        context,
        turnModelSelectionMetadata
          ? { metadata: turnModelSelectionMetadata }
          : undefined,
      );
      if (
        sentMessage?.codingSessionId &&
        sentMessage.codingSessionId !== bootstrappedSession.codingSessionId
      ) {
        selectCodingSession(sentMessage.codingSessionId, { projectId: bootstrappedSession.projectId });
      }
      setSelectionRefreshToken((previousState) => previousState + 1);
    } finally {
      setIsSubmittingTurn(false);
    }
  }, [
    buildWorkbenchCodingSessionTurnContext,
    ensureWorkbenchCodingSessionForMessage,
    createCodingSessionWithSelection,
    currentProjectId,
    fileContent,
    isChatBusy,
    notifyProjectChange,
    projects,
    selectCodingSession,
    selectFolderAndImportProject,
    selectedSession?.engineId,
    selectedFile,
    sendMessage,
    setSelectionRefreshToken,
    t,
    workspaceId,
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

  const handleAcceptViewingDiff = async () => {
    if (!viewingDiff) {
      return;
    }

    await saveFileContent(viewingDiff.path, viewingDiff.content || '');
    addToast(t('studio.appliedChanges', { path: viewingDiff.path }), 'success');
    setViewingDiff(null);
  };

  const handleSelectCodingSession = useCallback((nextProjectId: string, nextCodingSessionId: string) => {
    selectCodingSession(nextCodingSessionId, { projectId: nextProjectId });
  }, [selectCodingSession]);

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
    const recoveryMountSource = resolveProjectMountRecoverySource(currentProject?.path);
    if (!currentProjectId || !recoveryMountSource) {
      addToast('No persisted local folder is available to retry.', 'error');
      return;
    }

    setIsMountRecoveryActionPending(true);
    try {
      await mountFolder(currentProjectId, recoveryMountSource);
      addToast(t('studio.openedFolder', { name: currentProject?.name ?? recoveryMountSource.path }), 'success');
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
  }, [addToast, currentProject?.name, currentProject?.path, currentProjectId, mountFolder, t]);

  const handleReimportProjectFolder = useCallback(async () => {
    if (!currentProjectId) {
      addToast(t('studio.pleaseSelectProject'), 'error');
      return;
    }

    setIsMountRecoveryActionPending(true);
    try {
      const folderInfo = await openLocalFolder();
      if (!folderInfo) {
        return;
      }

      const reboundProject = await rebindLocalFolderProject({
        projectId: currentProjectId,
        fallbackProjectName: currentProject?.name ?? t('studio.localFolder'),
        folderInfo,
        mountFolder,
        updateProject,
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
  }, [addToast, currentProject?.name, currentProjectId, mountFolder, syncImportedProjectInBackground, t, updateProject]);

  const studioChatEmptyState = useMemo(
    () => (isSelectedCodingSessionHydrating ? <StudioSessionTranscriptLoadingState /> : undefined),
    [isSelectedCodingSessionHydrating],
  );
  const handleStudioViewChanges = useCallback((file: FileChange) => {
    setViewingDiff(file);
    handleActiveTabChange('code');
  }, [handleActiveTabChange]);
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
  const handleStudioAcceptViewingDiff = useCallback(() => {
    void handleAcceptViewingDiff();
  }, [handleAcceptViewingDiff]);
  const handleStudioRejectViewingDiff = useCallback(() => {
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
  const handleOpenStudioShare = useCallback(() => {
    setShowShareModal(true);
  }, []);
  const handleOpenStudioPublish = useCallback(() => {
    setShowPublishModal(true);
  }, []);

  return (
    <div className="flex h-full w-full bg-[#0e0e11] text-gray-300">
      <StudioChatSidebar
        isVisible={isVisible && isSidebarVisible}
        width={chatWidth}
        projects={filteredProjects}
        currentProjectId={currentProjectId}
        selectedCodingSessionId={sessionId}
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
        onSelectCodingSession={handleSelectCodingSession}
        onCreateProject={handleCreateSidebarProject}
        onOpenFolder={handleOpenSidebarFolder}
        onCreateCodingSession={createStudioCodingSessionInProject}
        onRefreshProjectSessions={handleRefreshProjectSessions}
        onRefreshCodingSessionMessages={handleRefreshCodingSessionMessages}
        refreshingProjectId={refreshingProjectId}
        refreshingCodingSessionId={refreshingCodingSessionId}
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
          currentProjectPath: currentProject?.path,
          fileContent,
          files,
          getLanguageFromPath,
          handleActiveTabChange,
          handleAnalyzeCode,
          handleCloseProjectGitOverviewDrawer,
          handleLaunchSimulatorFromHeader,
          handleOpenPreviewInNewTab,
          handleOpenStudioPublish,
          handleOpenStudioShare,
          handlePreviewAppPlatformChange,
          handlePreviewLandscapeToggle,
          handleRefreshPreview,
          handleStudioAcceptViewingDiff,
          handleStudioCloseFind,
          handleStudioCloseQuickOpen,
          handleStudioCodeExplorerResize,
          handleStudioCodePanelSelectFile,
          handleStudioNotifyNoResults,
          handleStudioOverlaySelectFile,
          handleStudioReimportProjectFolder,
          handleStudioRejectViewingDiff,
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
          workspaceId,
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
          collaborators: projectCollaborators,
          currentProjectId,
          currentProjectName: currentProject?.name,
          deleteConfirmation,
          handleConfirmDelete,
          handleCopyPublicLink,
          handleInviteCollaborator,
          handleRunTaskExecution,
          handleSaveDebugConfiguration,
          handleSubmitRunConfiguration,
          inviteEmail,
          isAnalyzeModalVisible,
          isCollaboratorsLoading,
          isDebugConfigVisible,
          isInvitePending,
          isRunConfigVisible,
          isRunTaskVisible,
          publicShareUrl,
          runConfigurationDraft,
          runConfigurations,
          setDeleteConfirmation,
          setInviteEmail,
          setIsAnalyzeModalVisible,
          setIsDebugConfigVisible,
          setIsRunConfigVisible,
          setIsRunTaskVisible,
          setRunConfigurationDraft,
          setShareAccess,
          setShowPublishModal,
          setShowShareModal,
          shareAccess,
          showPublishModal,
          showShareModal,
        }}
      />
    </div>
  );
}

export const StudioPage = memo(StudioPageComponent);
StudioPage.displayName = 'StudioPage';

