import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildProjectCodingSessionIndex,
  buildWorkbenchCodingSessionTurnContext,
  buildWorkbenchCodingSessionTurnModelSelectionMetadata,
  createIdleProjectMountRecoveryState,
  emitProjectMountRecoveryState,
  globalEventBus,
  hydrateImportedProjectFromAuthority,
  ensureWorkbenchCodingSessionForMessage,
  openLocalFolder,
  rebindLocalFolderProject,
  regenerateWorkbenchCodingSessionFromLastUserMessage,
  resolveProjectMountRecoverySource,
  restoreWorkbenchCodingSessionMessageFiles,
  type TerminalCommandRequest,
  useCodingSessionActions,
  useCodingSessionEngineModelSelection,
  useFileSystem,
  useIDEServices,
  useProjectGitOverview,
  useProjects,
  useSelectedCodingSessionMessages,
  useSessionRefreshActions,
  useWorkbenchCodingSessionMessageEditAction,
  useWorkbenchCodingSessionCreationActions,
  useWorkbenchChatSelection,
  useWorkbenchPreferences,
  useAuth,
  useToast,
} from '@sdkwork/birdcoder-commons';
import {
  isBirdCoderCodingSessionEngineBusy,
  isBirdCoderCodingSessionExecuting,
  type FileChange,
} from '@sdkwork/birdcoder-types';
import { useTranslation } from 'react-i18next';
import {
  createCodeChatEmptyStates,
  getLanguageFromPath,
  resolveCodeProjectActionTarget,
  type CodePageProps,
} from './CodePageShared';
import { CodePageSurface } from './CodePageSurface';
import { useCodePageClipboardActions } from './useCodePageClipboardActions';
import { useCodeDeleteConfirmation } from './useCodeDeleteConfirmation';
import { useCodeEditorChatLayout } from './useCodeEditorChatLayout';
import {
  useCodeEffectiveWorkspaceId,
  useCodeLocalFolderProjectImport,
} from './useCodeLocalFolderProjectImport';
import { useCodeNewCodingSessionRequestState } from './useCodeNewCodingSessionRequestState';
import { useCodePageSessionSelection } from './useCodePageSessionSelection';
import { useCodePageSurfaceProps } from './useCodePageSurfaceProps';
import { useCodeRunEntryActions } from './useCodeRunEntryActions';
import { useCodePageTerminalActions } from './useCodePageTerminalActions';
import { useCodeWorkbenchCommands } from './useCodeWorkbenchCommands';

function CodePageComponent({
  isVisible = true,
  workspaceId,
  projectId,
  initialCodingSessionId,
  onProjectChange,
  onCodingSessionChange,
}: CodePageProps) {
  const { t } = useTranslation();
  const { createWorkspace, effectiveWorkspaceId, refreshWorkspaces } = useCodeEffectiveWorkspaceId({
    isVisible,
    workspaceId,
  });
  const {
    hasFetched: hasFetchedProjects,
    projects,
    filteredProjects,
    searchQuery,
    setSearchQuery,
    createProject,
    createCodingSession,
    renameProject,
    updateProject,
    deleteProject,
    renameCodingSession,
    updateCodingSession,
    deleteCodingSession,
    editCodingSessionMessage,
    deleteCodingSessionMessage,
    sendMessage,
    forkCodingSession,
  } = useProjects(effectiveWorkspaceId, {
    isActive: isVisible,
  });
  const { coreReadService, projectService } = useIDEServices();
  const { user } = useAuth();

  const { addToast } = useToast();
  const { preferences, updatePreferences } = useWorkbenchPreferences();
  const {
    beginPendingNewCodingSessionRequest,
    clearPendingNewCodingSessionRequest,
    isNewCodingSessionCreating,
    pendingNewCodingSessionRequestRef,
  } = useCodeNewCodingSessionRequestState();
  const [isSubmittingTurn, setIsSubmittingTurn] = useState(false);
  const [activeTab, setActiveTab] = useState<'ai' | 'editor' | 'mobile'>('ai');
  const handleActiveTabChange = useCallback((tab: 'ai' | 'editor' | 'mobile') => {
    startTransition(() => {
      setActiveTab((previousTab) => (previousTab === tab ? previousTab : tab));
    });
  }, []);
  const [viewingDiff, setViewingDiff] = useState<FileChange | null>(null);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalRequest, setTerminalRequest] = useState<TerminalCommandRequest>();
  const [terminalHeight, setTerminalHeight] = useState(256);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [editorExplorerWidth, setEditorExplorerWidth] = useState(256);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isFindVisible, setIsFindVisible] = useState(false);
  const [isQuickOpenVisible, setIsQuickOpenVisible] = useState(false);
  const [isRunConfigVisible, setIsRunConfigVisible] = useState(false);
  const [isDebugConfigVisible, setIsDebugConfigVisible] = useState(false);
  const [isRunTaskVisible, setIsRunTaskVisible] = useState(false);
  const [isProjectGitOverviewDrawerOpen, setIsProjectGitOverviewDrawerOpen] = useState(false);
  const [isMountRecoveryActionPending, setIsMountRecoveryActionPending] = useState(false);
  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((previousState) => Math.max(200, Math.min(600, previousState + delta)));
  }, []);
  const handleTerminalResize = useCallback((delta: number) => {
    setTerminalHeight((previousState) => Math.max(100, Math.min(800, previousState - delta)));
  }, []);
  const handleCloseTerminal = useCallback(() => {
    setIsTerminalOpen(false);
  }, []);
  const handleEditorExplorerResize = useCallback((delta: number) => {
    setEditorExplorerWidth((previousState) => Math.max(220, Math.min(560, previousState + delta)));
  }, []);
  const {
    editorWorkspaceHostRef,
    effectiveEditorChatWidth,
    handleEditorChatResize,
  } = useCodeEditorChatLayout({
    activeTab,
    initialChatWidth: preferences.codeEditorChatWidth,
    updatePreferences,
  });
  const projectCodingSessionIndex = useMemo(
    () => buildProjectCodingSessionIndex(projects),
    [projects],
  );
  const {
    currentProject,
    currentProjectId,
    handleProjectSelect,
    handleSidebarCodingSessionSelect,
    latestCodingSessionIdByProjectId,
    resolveProjectById,
    resolveSession,
    resolveSessionInProject,
    restoreSelectionAfterRefresh,
    selectedCodingSessionLocation,
    selectProjectWithoutCodingSession,
    selectSession,
    selectionRefreshToken,
    sessionId,
    setSelectedSessionId,
    setSelectedSessionProjectId,
    setSelectionRefreshToken,
  } = useCodePageSessionSelection({
    clearPendingNewCodingSessionRequest,
    hasFetchedProjects,
    initialCodingSessionId,
    isVisible,
    onCodingSessionChange,
    onProjectChange,
    projectCodingSessionIndex,
    projectId,
  });
  const resolveSessionActionLocation = useCallback((
    codingSessionId: string,
    projectId?: string | null,
  ) => {
    const scopedProjectId = projectId?.trim() || currentProjectId;
    return scopedProjectId
      ? resolveSessionInProject(codingSessionId, scopedProjectId)
      : resolveSession(codingSessionId);
  }, [currentProjectId, resolveSession, resolveSessionInProject]);
  const resolveCodingSessionNativeSessionId = useCallback(async (codingSessionId: string) => {
    const local = resolveSession(codingSessionId)?.codingSession.nativeSessionId?.trim();
    if (local) {
      return local;
    }

    return coreReadService.getCodingSession(codingSessionId)
      .then((session) => session.nativeSessionId?.trim() || null)
      .catch(() => null);
  }, [
    coreReadService,
    resolveSession,
  ]);
  const projectGitOverviewState = useProjectGitOverview({
    projectId: currentProject?.id,
  });
  const session = selectedCodingSessionLocation?.codingSession;
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
    currentSessionEngineId: session?.engineId,
    currentSessionModelId: session?.modelId,
  });
  const handleTopBarTerminalVisibilityChange = useCallback((nextIsOpen: boolean) => {
    if (nextIsOpen) {
      const normalizedProjectPath = currentProject?.path?.trim() ?? '';
      setTerminalRequest({
        surface: 'embedded',
        path: normalizedProjectPath || undefined,
        timestamp: Date.now(),
      });
    }

    setIsTerminalOpen(nextIsOpen);
  }, [currentProject?.path]);
  const handleToggleProjectGitOverviewDrawer = useCallback(() => {
    setIsProjectGitOverviewDrawerOpen((previousState) => !previousState);
  }, []);
  const handleCloseProjectGitOverviewDrawer = useCallback(() => {
    setIsProjectGitOverviewDrawerOpen(false);
  }, []);
  useEffect(() => {
    setViewingDiff(null);
  }, [currentProjectId, sessionId]);
  useEffect(() => {
    if (activeTab !== 'editor' || !currentProjectId) {
      setIsProjectGitOverviewDrawerOpen(false);
    }
  }, [activeTab, currentProjectId]);
  const isSelectedSessionTurnActive = isBirdCoderCodingSessionExecuting(session);
  const isSelectedSessionEngineBusy = isBirdCoderCodingSessionEngineBusy(session);
  const isChatBusy = isSubmittingTurn || isSelectedSessionTurnActive || isNewCodingSessionCreating;
  const isChatEngineBusy = isSubmittingTurn || isSelectedSessionEngineBusy || isNewCodingSessionCreating;
  const {
    createCodingSessionInProject,
  } = useWorkbenchCodingSessionCreationActions({
    addToast,
    createCodingSessionWithSelection,
    currentProjectId,
    selectCodingSession: selectSession,
    labels: {
      creationFailed: t('code.failedToCreateSession'),
      creationSucceeded: t('code.newSessionCreated'),
      noProjectSelected: t('code.selectProjectFirst'),
    },
  });
  const createCodingSessionWithTranscriptReset = useCallback(async (
    projectId: string,
    requestedEngineId?: string,
    requestedModelId?: string,
  ) => {
    const normalizedProjectId = projectId.trim();
    if (!normalizedProjectId) {
      return createCodingSessionInProject(projectId, requestedEngineId, {
        modelId: requestedModelId,
      });
    }

    const pendingRequest = beginPendingNewCodingSessionRequest(normalizedProjectId);

    try {
      return await createCodingSessionInProject(normalizedProjectId, requestedEngineId, {
        modelId: requestedModelId,
        shouldSelectCreatedSession: (_newSession, selectionContext) => {
          const activePendingRequest = pendingNewCodingSessionRequestRef.current;
          return (
            activePendingRequest?.requestId === pendingRequest.requestId &&
            activePendingRequest.projectId === selectionContext.projectId
          );
        },
      });
    } finally {
      clearPendingNewCodingSessionRequest(pendingRequest.requestId);
    }
  }, [
    beginPendingNewCodingSessionRequest,
    clearPendingNewCodingSessionRequest,
    createCodingSessionInProject,
    pendingNewCodingSessionRequestRef,
  ]);
  const createCodingSessionInProjectWithTranscriptReset = useCallback(async (
    projectId: string,
    requestedEngineId?: string,
    requestedModelId?: string,
  ) => {
    await createCodingSessionWithTranscriptReset(
      projectId,
      requestedEngineId,
      requestedModelId,
    );
  }, [createCodingSessionWithTranscriptReset]);
  const createCodingSessionFromCurrentProjectWithTranscriptReset = useCallback(async (
    requestedEngineId?: string,
    requestedModelId?: string,
  ) => {
    await createCodingSessionWithTranscriptReset(
      currentProjectId,
      requestedEngineId,
      requestedModelId,
    );
  }, [createCodingSessionWithTranscriptReset, currentProjectId]);
  const {
    runConfigurations,
    runConfigurationDraft,
    setRunConfigurationDraft,
    handleSubmitRunConfiguration,
    handleRunTaskExecution,
    handleRunWithoutDebugging,
    handleSaveDebugConfiguration,
  } = useCodeRunEntryActions({
    currentProjectId,
    currentProjectPath: currentProject?.path,
    defaultWorkingDirectory: preferences.defaultWorkingDirectory,
    isRunConfigVisible,
    setIsRunConfigVisible,
    setIsDebugConfigVisible,
    setIsRunTaskVisible,
    addToast,
  });
  useCodingSessionActions(
    currentProjectId,
    createCodingSessionWithSelection,
    selectSession,
    {
      isActive: isVisible,
      createCodingSessionInProject: createCodingSessionInProjectWithTranscriptReset,
    },
  );

  useCodeWorkbenchCommands({
    isActive: isVisible,
    projects,
    selectedCodingSessionId: sessionId,
    selectedProjectId: currentProjectId || null,
    currentProjectPath: currentProject?.path,
    defaultWorkingDirectory: preferences.defaultWorkingDirectory,
    selectCodingSession: selectSession,
    setViewingDiff,
    setIsTerminalOpen,
    setTerminalRequest,
    setIsSidebarVisible,
    setIsFindVisible,
    setIsQuickOpenVisible,
    setIsRunConfigVisible,
    setIsDebugConfigVisible,
    setIsRunTaskVisible,
    onRunWithoutDebugging: handleRunWithoutDebugging,
    addToast,
  });

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
    loadActive: isVisible && activeTab === 'editor',
    realtimeActive: isVisible && activeTab === 'editor',
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
        surface: 'code',
        projectId: null,
        projectName: null,
        state: createIdleProjectMountRecoveryState(),
      });
      return;
    }

    emitProjectMountRecoveryState({
      surface: 'code',
      projectId: currentProjectId ?? null,
      projectName: currentProject?.name ?? null,
      state: mountRecoveryState,
    });

    return () => {
      emitProjectMountRecoveryState({
        surface: 'code',
        projectId: null,
        projectName: null,
        state: createIdleProjectMountRecoveryState(),
      });
    };
  }, [currentProject?.name, currentProjectId, isVisible, mountRecoveryState]);

  const resolveProjectActionTarget = useCallback((project?: { name: string; path?: string } | null) => {
    return resolveCodeProjectActionTarget(project, addToast);
  }, [addToast]);

  const { selectFolderAndImportProject } = useCodeLocalFolderProjectImport({
    createProject,
    createWorkspace,
    effectiveWorkspaceId,
    mountFolder,
    projectService,
    refreshWorkspaces,
    updateProject,
  });

  const activateImportedProject = useCallback((projectId: string) => {
    const latestCodingSessionId = latestCodingSessionIdByProjectId.get(projectId) ?? null;
    if (latestCodingSessionId) {
      selectSession(latestCodingSessionId, { projectId });
      return;
    }

    selectProjectWithoutCodingSession(projectId);
  }, [latestCodingSessionIdByProjectId, selectProjectWithoutCodingSession, selectSession]);

  const syncImportedProjectInBackground = useCallback((projectId: string, workspaceId: string) => {
    const normalizedWorkspaceId = workspaceId.trim();
    if (!normalizedWorkspaceId) {
      return;
    }

    void (async () => {
      try {
        const hydratedProject = await hydrateImportedProjectFromAuthority({
          knownProjects: projects,
          projectId,
          projectService,
          userScope: user?.id,
          workspaceId: normalizedWorkspaceId,
        });
        if (!hydratedProject) {
          return;
        }

        const latestCodingSessionId = hydratedProject.latestCodingSessionId;
        if (latestCodingSessionId) {
          selectSession(latestCodingSessionId, { projectId });
        }
      } catch (error) {
        console.error('Failed to refresh imported project sessions', error);
      }
    })();
  }, [projectService, projects, selectSession, user?.id]);
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
      failedToRefreshProjectSessions: t('code.failedToRefreshProjectSessions'),
      failedToRefreshSessionMessages: t('code.failedToRefreshSessionMessages'),
      projectSessionsRefreshed: (projectName: string) =>
        t('code.projectSessionsRefreshed', { name: projectName }),
      sessionMessagesRefreshed: (codingSessionTitle: string) =>
        t('code.sessionMessagesRefreshed', { name: codingSessionTitle }),
    },
    projectService,
    resolveCodingSessionLocation: (codingSessionId: string, targetProjectId?: string | null) =>
      resolveSessionActionLocation(codingSessionId, targetProjectId),
    resolveCodingSessionTitle: (codingSessionId: string, targetProjectId?: string | null) =>
      resolveSessionActionLocation(codingSessionId, targetProjectId)
        ?.codingSession.title ?? codingSessionId,
    resolveProjectName: (targetProjectId: string) =>
      resolveProjectById(targetProjectId)?.name ?? targetProjectId,
    restoreSelectionAfterRefresh,
    workspaceId,
  });

  const handleRenameSession = useCallback(async (
    codingSessionId: string,
    projectId: string,
    newName?: string,
  ) => {
    if (newName && newName.trim()) {
      const project = resolveSessionActionLocation(codingSessionId, projectId)?.project;
      if (project) {
        await renameCodingSession(project.id, codingSessionId, newName.trim());
      }
    }
  }, [renameCodingSession, resolveSessionActionLocation]);

  const handleRenameProject = useCallback(async (projectId: string, newName?: string) => {
    if (newName && newName.trim()) {
      await renameProject(projectId, newName.trim());
    }
  }, [renameProject]);

  const {
    cancelDeleteConfirmation,
    confirmDeleteConfirmation,
    deleteConfirmation,
    requestDeleteMessage,
    requestDeleteProject,
    requestDeleteSession,
  } = useCodeDeleteConfirmation({
    addToast,
    currentProjectId,
    deleteCodingSession,
    deleteCodingSessionMessage,
    deleteProject,
    onProjectChange,
    projectRemovedMessage: t('code.projectRemoved'),
    resolveProjectById,
    resolveSession: resolveSessionActionLocation,
    sessionId,
    setSelectedSessionId,
    setSelectedSessionProjectId,
    sessionDeletedMessage: t('code.sessionDeleted'),
  });

  const handleDeleteSession = useCallback(async (
    codingSessionId: string,
    projectId: string,
  ) => {
    requestDeleteSession(codingSessionId, projectId);
  }, [requestDeleteSession]);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    requestDeleteProject(projectId);
  }, [requestDeleteProject]);

  const handleNewProject = useCallback(async () => {
    try {
      const importedProject = await selectFolderAndImportProject('New Project');
      if (!importedProject) {
        return undefined;
      }

      activateImportedProject(importedProject.projectId);
      syncImportedProjectInBackground(importedProject.projectId, importedProject.workspaceId);
      addToast(`Project created successfully: ${importedProject.projectName}`, 'success');
      return importedProject.projectId;
    } catch (error) {
      console.error("Failed to create project", error);
      addToast('Failed to create project', 'error');
      return undefined;
    }
  }, [
    activateImportedProject,
    addToast,
    selectFolderAndImportProject,
    syncImportedProjectInBackground,
  ]);

  const handleOpenFolder = useCallback(async () => {
    try {
      const importedProject = await selectFolderAndImportProject('Local Folder');
      if (importedProject) {
        activateImportedProject(importedProject.projectId);
        syncImportedProjectInBackground(importedProject.projectId, importedProject.workspaceId);
        addToast(`Opened folder: ${importedProject.projectName}`, 'success');
      }
    } catch (error) {
      console.error("Failed to open folder", error);
      addToast('Failed to open folder', 'error');
    }
  }, [addToast, activateImportedProject, selectFolderAndImportProject, syncImportedProjectInBackground]);

  const handleRetryMountRecovery = useCallback(async () => {
    const recoveryMountSource = resolveProjectMountRecoverySource(currentProject?.path);
    if (!currentProjectId || !recoveryMountSource) {
      addToast('No persisted local folder is available to retry.', 'error');
      return;
    }

    setIsMountRecoveryActionPending(true);
    try {
      await mountFolder(currentProjectId, recoveryMountSource);
      addToast(`Reconnected folder: ${currentProject?.name ?? recoveryMountSource.path}`, 'success');
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
  }, [addToast, currentProject?.name, currentProject?.path, currentProjectId, mountFolder]);

  const handleReimportProjectFolder = useCallback(async () => {
    if (!currentProjectId) {
      addToast('Select a project before choosing a folder.', 'error');
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
        fallbackProjectName: currentProject?.name ?? 'Local Folder',
        folderInfo,
        mountFolder,
        updateProject,
      });

      syncImportedProjectInBackground(
        currentProjectId,
        currentProject?.workspaceId?.trim() || effectiveWorkspaceId,
      );
      addToast(`Opened folder: ${reboundProject.projectName}`, 'success');
    } catch (error) {
      console.error('Failed to rebind local project folder', error);
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to open folder',
        'error',
      );
    } finally {
      setIsMountRecoveryActionPending(false);
    }
  }, [
    addToast,
    currentProject?.name,
    currentProject?.workspaceId,
    currentProjectId,
    effectiveWorkspaceId,
    mountFolder,
    syncImportedProjectInBackground,
    updateProject,
  ]);

  const handleArchiveProject = useCallback(async (projectId: string) => {
    const project = resolveProjectById(projectId);
    if (project) {
      await updateProject(projectId, { archived: !project.archived });
      addToast(`${!project.archived ? 'Archived' : 'Unarchived'} project: ${project.name}`, 'info');
    }
  }, [addToast, resolveProjectById, updateProject]);

  const {
    handleCopyProjectPath,
    handleCopySessionDeeplink,
    handleCopySessionWorkingDirectory,
    handleCopyWorkingDirectory,
  } = useCodePageClipboardActions({
    addToast,
    resolveProjectActionTarget,
    resolveProjectById,
    resolveSession: resolveSessionActionLocation,
    t,
  });

  const {
    handleCopySessionId,
    handleOpenCodingSessionInTerminal,
    handleOpenInTerminal,
    handleCopySessionResumeCommand,
  } = useCodePageTerminalActions({
    addToast,
    resolveCodingSessionNativeSessionId,
    resolveProjectActionTarget,
    resolveProjectById,
    resolveSession,
    t,
  });

  const handleOpenInFileExplorer = useCallback((projectId: string) => {
    const target = resolveProjectActionTarget(resolveProjectById(projectId));
    if (!target) {
      return;
    }

    globalEventBus.emit('revealInExplorer', target.projectPath);
  }, [resolveProjectById]);

  const handlePinSession = useCallback(async (
    codingSessionId: string,
    projectId: string,
  ) => {
    const resolvedSessionLocation = resolveSessionActionLocation(codingSessionId, projectId);
    const project = resolvedSessionLocation?.project;
    if (project) {
      const codingSession = resolvedSessionLocation?.codingSession;
      if (codingSession) {
        await updateCodingSession(project.id, codingSessionId, { pinned: !codingSession.pinned });
        addToast(
          t(codingSession.pinned ? 'code.unpinnedSession' : 'code.pinnedSession', {
            name: codingSession.title,
          }),
          'success',
        );
      }
    }
  }, [addToast, resolveSessionActionLocation, t, updateCodingSession]);

  const handleArchiveSession = useCallback(async (
    codingSessionId: string,
    projectId: string,
  ) => {
    const resolvedSessionLocation = resolveSessionActionLocation(codingSessionId, projectId);
    const project = resolvedSessionLocation?.project;
    if (project) {
      const codingSession = resolvedSessionLocation?.codingSession;
      if (!codingSession) {
        return;
      }

      await updateCodingSession(project.id, codingSessionId, { archived: !codingSession.archived });
      addToast(
        t(codingSession.archived ? 'code.unarchivedSession' : 'code.archivedSession', {
          id: codingSessionId,
        }),
        'info',
      );
    }
  }, [addToast, resolveSessionActionLocation, t, updateCodingSession]);

  const handleMarkSessionUnread = useCallback(async (
    codingSessionId: string,
    projectId: string,
  ) => {
    const resolvedSessionLocation = resolveSessionActionLocation(codingSessionId, projectId);
    const project = resolvedSessionLocation?.project;
    if (project) {
      const codingSession = resolvedSessionLocation?.codingSession;
      if (codingSession) {
        await updateCodingSession(project.id, codingSessionId, { unread: !codingSession.unread });
        addToast(
          t(codingSession.unread ? 'code.markedAsRead' : 'code.markedAsUnread', {
            name: codingSession.title,
          }),
          'info',
        );
      }
    }
  }, [addToast, resolveSessionActionLocation, t, updateCodingSession]);

  const handleForkSessionLocal = useCallback(async (
    codingSessionId: string,
    projectId: string,
  ) => {
    const resolvedSessionLocation = resolveSessionActionLocation(codingSessionId, projectId);
    const project = resolvedSessionLocation?.project;
    if (project) {
      try {
        const newSession = await forkCodingSession(project.id, codingSessionId);
        selectSession(newSession.id, { projectId: project.id });
        addToast(
          t('code.forkedToLocal', {
            name: newSession.title ?? newSession.id,
          }),
          'success',
        );
      } catch (err) {
        addToast(t('code.failedToForkSession'), 'error');
      }
    }
  }, [addToast, forkCodingSession, resolveSessionActionLocation, selectSession, t]);

  const handleForkSessionNewTree = useCallback(async (
    codingSessionId: string,
    projectId: string,
  ) => {
    const resolvedSessionLocation = resolveSessionActionLocation(codingSessionId, projectId);
    const project = resolvedSessionLocation?.project;
    if (project) {
      try {
        const newSession = await forkCodingSession(
          project.id,
          codingSessionId,
          `${resolvedSessionLocation?.codingSession.title} (New Tree)`,
        );
        selectSession(newSession.id, { projectId: project.id });
        addToast(
          t('code.forkedToNewWorktree', {
            name: newSession.title ?? newSession.id,
          }),
          'success',
        );
      } catch (err) {
        addToast(t('code.failedToForkSession'), 'error');
      }
    }
  }, [addToast, forkCodingSession, resolveSessionActionLocation, selectSession, t]);

  const handleEditMessage = useWorkbenchCodingSessionMessageEditAction({
    editCodingSessionMessage,
    resolveCodingSessionLocation: (codingSessionId: string) =>
      resolveSessionActionLocation(codingSessionId, currentProjectId),
    sessionUnavailableMessage: t('chat.sendMessageSessionUnavailable'),
    setSelectionRefreshToken,
  });

  const handleDeleteMessage = useCallback(async (
    codingSessionId: string,
    projectId: string,
    messageIds: string[],
  ) => {
    requestDeleteMessage(codingSessionId, projectId, messageIds);
  }, [requestDeleteMessage]);

  const handleRegenerateMessage = useCallback(async (
    codingSessionId: string,
    projectId: string,
  ) => {
    if (isChatBusy) {
      return;
    }

    const resolvedSessionLocation = resolveSessionActionLocation(codingSessionId, projectId);
    const project = resolvedSessionLocation?.project;
    if (project) {
      const codingSession = resolvedSessionLocation?.codingSession;
      if (codingSession && codingSession.messages && codingSession.messages.length > 0) {
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
    }
  }, [
    deleteCodingSessionMessage,
    fileContent,
    getLanguageFromPath,
    isChatBusy,
    buildWorkbenchCodingSessionTurnContext,
    regenerateWorkbenchCodingSessionFromLastUserMessage,
    resolveSessionActionLocation,
    selectedFile,
    sendMessage,
    setSelectionRefreshToken,
    workspaceId,
  ]);

  const handleRestoreMessage = useCallback(async (
    codingSessionId: string,
    projectId: string,
    messageId: string,
  ) => {
    const codingSession =
      resolveSessionActionLocation(codingSessionId, projectId)?.codingSession;
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
      addToast('Restored files to previous state', 'success');
    } catch (error) {
      console.error('Failed to restore files from checkpoint', error);
      addToast('Failed to restore files from checkpoint', 'error');
    }
  }, [
    addToast,
    resolveSessionActionLocation,
    restoreWorkbenchCodingSessionMessageFiles,
    saveFileContent,
  ]);

  const handleSendMessage = useCallback(async (
    text?: string,
    composerSelection?: {
      engineId?: string | null;
      modelId?: string | null;
    },
  ) => {
    const trimmedContent = text?.trim() ?? '';
    if (!trimmedContent) {
      return;
    }
    if (isChatBusy) {
      throw new Error(t('chat.sendMessageBusy'));
    }
    const requestedEngineId = composerSelection?.engineId?.trim() ?? '';
    const currentSessionEngineId = session?.engineId?.trim() ?? '';
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
        if (!projects.length) {
          return handleNewProject();
        }
        return projects[0]?.id;
      },
      selectCodingSession: selectSession,
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
        selectSession(sentMessage.codingSessionId, { projectId: bootstrappedSession.projectId });
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
    handleNewProject,
    getLanguageFromPath,
    isChatBusy,
    selectSession,
    projects,
    session?.engineId,
    sessionId,
    selectedFile,
    sendMessage,
    setSelectionRefreshToken,
    t,
    workspaceId,
  ]);
  const visibleSessionId = isNewCodingSessionCreating ? null : sessionId;
  const selectedCodingSession = isNewCodingSessionCreating ? null : session;
  const {
    handleSelectedEngineChange,
    handleSelectedModelChange,
  } = useCodingSessionEngineModelSelection({
    preferences,
    selectedModelId,
    sessionId: visibleSessionId,
    setSelectedEngineId,
    setSelectedModelId,
  });
  const isSelectedCodingSessionTranscriptVisible =
    isVisible && (activeTab === 'ai' || activeTab === 'editor');
  const isSelectedCodingSessionMessagesLoading = useSelectedCodingSessionMessages({
    coreReadService,
    isActive: isSelectedCodingSessionTranscriptVisible,
    projectService,
    selectionRefreshToken,
    selectedCodingSession,
    selectedCodingSessionId: visibleSessionId,
    selectedProject: selectedCodingSessionLocation?.project ?? currentProject ?? null,
    workspaceId,
  });
  const selectedCodingSessionMessages = useMemo(
    () => (isNewCodingSessionCreating ? [] : selectedCodingSession?.messages ?? []),
    [isNewCodingSessionCreating, selectedCodingSession?.messages],
  );
  const isSelectedCodingSessionHydrating = Boolean(
    isNewCodingSessionCreating ||
    (
      visibleSessionId &&
      isSelectedCodingSessionMessagesLoading &&
      selectedCodingSessionMessages.length === 0
    )
  );
  const {
    mainChatEmptyState,
    editorChatEmptyState,
  } = useMemo(
    () => createCodeChatEmptyStates(isSelectedCodingSessionHydrating),
    [isSelectedCodingSessionHydrating],
  );

  const handleCreateRootFile = useCallback(() => {
    globalEventBus.emit('createRootFile');
  }, []);
  const handleRetryMountRecoveryAction = useCallback(() => {
    void handleRetryMountRecovery();
  }, [handleRetryMountRecovery]);
  const handleReimportProjectFolderAction = useCallback(() => {
    void handleReimportProjectFolder();
  }, [handleReimportProjectFolder]);
  const handleCloseFind = useCallback(() => {
    setIsFindVisible(false);
  }, []);
  const handleCloseQuickOpen = useCallback(() => {
    setIsQuickOpenVisible(false);
  }, []);
  const handleNotifyNoCodeResults = useCallback(() => {
    addToast(t('code.noResultsFound'), 'info');
  }, [addToast, t]);
  const handleViewChanges = useCallback((file: FileChange) => {
    setViewingDiff(file);
  }, []);
  const handleViewChangesAndOpenEditor = useCallback((file: FileChange) => {
    setViewingDiff(file);
    setActiveTab('editor');
  }, []);
  const handleSelectWorkspaceFile = useCallback((path: string) => {
    setViewingDiff(null);
    selectFile(path);
  }, [selectFile]);
  const handleCloseWorkspaceFile = useCallback((path: string) => {
    closeFile(path);
  }, [closeFile]);
  const handleAcceptViewingDiff = useCallback(async () => {
    if (!viewingDiff) {
      return;
    }
    await saveFileContent(viewingDiff.path, viewingDiff.content || '');
    addToast(t('code.appliedChanges', { path: viewingDiff.path }), 'success');
    setViewingDiff(null);
  }, [addToast, saveFileContent, t, viewingDiff]);
  const handleRejectViewingDiff = useCallback(() => {
    setViewingDiff(null);
  }, []);
  const handleEditSelectedCodingSessionMessage = useCallback((messageId: string, content: string) => {
    if (session) {
      return handleEditMessage(session.id, messageId, content);
    }
    return Promise.resolve();
  }, [handleEditMessage, session]);
  const handleDeleteSelectedCodingSessionMessage = useCallback((messageIds: string[]) => {
    if (session) {
      void handleDeleteMessage(session.id, currentProjectId, messageIds);
    }
  }, [currentProjectId, handleDeleteMessage, session]);
  const handleRegenerateSelectedCodingSessionMessage = useCallback(() => {
    if (session) {
      void handleRegenerateMessage(session.id, currentProjectId);
    }
  }, [currentProjectId, handleRegenerateMessage, session]);
  const handleRestoreSelectedCodingSessionMessage = useCallback((messageId: string) => {
    if (session) {
      void handleRestoreMessage(session.id, currentProjectId, messageId);
    }
  }, [currentProjectId, handleRestoreMessage, session]);

  const handleCloseRunConfig = useCallback(() => {
    setIsRunConfigVisible(false);
  }, []);
  const handleSubmitRunConfigurationAction = useCallback(() => {
    void handleSubmitRunConfiguration();
  }, [handleSubmitRunConfiguration]);
  const handleCloseDebugConfig = useCallback(() => {
    setIsDebugConfigVisible(false);
  }, []);
  const handleCloseRunTask = useCallback(() => {
    setIsRunTaskVisible(false);
  }, []);
  const handleCancelDelete = useCallback(() => {
    cancelDeleteConfirmation();
  }, [cancelDeleteConfirmation]);
  const handleConfirmDelete = useCallback(() => {
    void confirmDeleteConfirmation();
  }, [confirmDeleteConfirmation]);
  const {
    dialogProps,
    gitOverviewDrawerProps,
    mainChatProps,
    mobileProgrammingProps,
    overlayProps,
    projectExplorerProps,
    terminalProps,
    topBarProps,
    workspaceProps,
  } = useCodePageSurfaceProps({
    activeTab,
    currentProjectId,
    isProjectGitOverviewDrawerOpen,
    projectId: currentProject?.id,
    projectGitOverviewState,
    projectName: currentProject?.name,
    projectPath: currentProject?.path,
    deleteConfirmation,
    editorChatEmptyState,
    editorExplorerWidth,
    chatWidth: effectiveEditorChatWidth,
    fileContent,
    files,
    filteredProjects,
    isChatBusy,
    isChatEngineBusy,
    isEngineBusyCurrentSession: isSelectedSessionEngineBusy,
    isDebugConfigVisible,
    isFindVisible,
    isMountRecoveryActionPending,
    isQuickOpenVisible,
    isRunConfigVisible,
    isRunTaskVisible,
    isSearchingFiles,
    selectedEngineId,
    selectedModelId,
    isSidebarVisible,
    isTerminalOpen,
    isVisible,
    loadingDirectoryPaths,
    mainChatEmptyState,
    mountRecoveryState,
    openFiles,
    refreshingCodingSessionId,
    refreshingProjectId,
    runConfigurationDraft,
    runConfigurations,
    searchQuery,
    selectedCodingSessionMessages,
    selectedFile,
    selectedSessionLastTurnAt: selectedCodingSession?.lastTurnAt,
    selectedSessionTitle: selectedCodingSession?.title,
    selectedSessionEngineId: selectedCodingSession?.engineId,
    selectedSessionModelId: selectedCodingSession?.modelId,
    selectedSessionRuntimeStatus: selectedCodingSession?.runtimeStatus,
    selectedSessionTranscriptUpdatedAt: selectedCodingSession?.transcriptUpdatedAt,
    selectedSessionUpdatedAt: selectedCodingSession?.updatedAt,
    sessionId: visibleSessionId,
    showComposerEngineSelector: !visibleSessionId,
    sidebarWidth,
    terminalHeight,
    terminalRequest,
    viewingDiff,
    workspaceId,
    onAcceptDiff: handleAcceptViewingDiff,
    onArchiveCodingSession: handleArchiveSession,
    onArchiveProject: handleArchiveProject,
    onCancelDelete: handleCancelDelete,
    onChatResize: handleEditorChatResize,
    onCloseDebugConfig: handleCloseDebugConfig,
    onCloseFile: handleCloseWorkspaceFile,
    onCloseFind: handleCloseFind,
    onCloseQuickOpen: handleCloseQuickOpen,
    onCloseRunConfig: handleCloseRunConfig,
    onCloseRunTask: handleCloseRunTask,
    onCloseTerminal: handleCloseTerminal,
    onConfirmDelete: handleConfirmDelete,
    onCopyCodingSessionDeeplink: handleCopySessionDeeplink,
    onCopyCodingSessionResumeCommand: handleCopySessionResumeCommand,
    onCopyCodingSessionSessionId: handleCopySessionId,
    onCopyCodingSessionWorkingDirectory: handleCopySessionWorkingDirectory,
    onCopyProjectPath: handleCopyProjectPath,
    onCopyWorkingDirectory: handleCopyWorkingDirectory,
    onCreateCodingSession: createCodingSessionFromCurrentProjectWithTranscriptReset,
    onCreateFile: createFile,
    onCreateFolder: createFolder,
    onCreateRootFile: handleCreateRootFile,
    onCloseProjectGitOverviewDrawer: handleCloseProjectGitOverviewDrawer,
    onDeleteCodingSession: handleDeleteSession,
    onDeleteFile: deleteFile,
    onDeleteFolder: deleteFolder,
    onDeleteMessage: handleDeleteSelectedCodingSessionMessage,
    onDeleteProject: handleDeleteProject,
    onEditMessage: handleEditSelectedCodingSessionMessage,
    onExpandDirectory: loadDirectory,
    onExplorerResize: handleEditorExplorerResize,
    onFileDraftChange: updateFileDraft,
    onForkCodingSessionLocal: handleForkSessionLocal,
    onForkCodingSessionNewTree: handleForkSessionNewTree,
    onMarkCodingSessionUnread: handleMarkSessionUnread,
    onNewCodingSessionInProject: createCodingSessionInProjectWithTranscriptReset,
    onNewProject: handleNewProject,
    onNotifyNoResults: handleNotifyNoCodeResults,
    onOpenFolder: handleOpenFolder,
    onOpenCodingSessionInTerminal: handleOpenCodingSessionInTerminal,
    onOpenInFileExplorer: handleOpenInFileExplorer,
    onOpenInTerminal: handleOpenInTerminal,
    onPinCodingSession: handlePinSession,
    onProjectSelect: handleProjectSelect,
    onRefreshCodingSessionMessages: handleRefreshCodingSessionMessages,
    onRefreshProjectSessions: handleRefreshProjectSessions,
    onRegenerateMessage: handleRegenerateSelectedCodingSessionMessage,
    onRejectDiff: handleRejectViewingDiff,
    onReimportProjectFolder: handleReimportProjectFolderAction,
    onRenameCodingSession: handleRenameSession,
    onRenameNode: renameNode,
    onRenameProject: handleRenameProject,
    onRestoreMessage: handleRestoreSelectedCodingSessionMessage,
    onRetryMountRecovery: handleRetryMountRecoveryAction,
    onRunConfigurationDraftChange: setRunConfigurationDraft,
    onRunTask: handleRunTaskExecution,
    onSaveDebugConfig: handleSaveDebugConfiguration,
    onSearchFiles: searchFiles,
    onSelectCodingSession: handleSidebarCodingSessionSelect,
    onSelectFile: handleSelectWorkspaceFile,
    onSelectedEngineIdChange: handleSelectedEngineChange,
    onSelectedModelIdChange: handleSelectedModelChange,
    onSendMessage: handleSendMessage,
    onSetActiveTab: handleActiveTabChange,
    onSetIsTerminalOpen: handleTopBarTerminalVisibilityChange,
    onToggleProjectGitOverviewDrawer: handleToggleProjectGitOverviewDrawer,
    onSubmitRunConfig: handleSubmitRunConfigurationAction,
    onTerminalResize: handleTerminalResize,
    onViewChanges: handleViewChanges,
    onViewChangesAndOpenEditor: handleViewChangesAndOpenEditor,
    setSearchQuery,
  });

  return (
    <CodePageSurface
      activeTab={activeTab}
      dialogProps={dialogProps}
      editorWorkspaceHostRef={editorWorkspaceHostRef}
      gitOverviewDrawerProps={gitOverviewDrawerProps}
      isSidebarVisible={isSidebarVisible}
      mainChatProps={mainChatProps}
      mobileProgrammingProps={mobileProgrammingProps}
      onSidebarResize={handleSidebarResize}
      overlayProps={overlayProps}
      projectExplorerProps={projectExplorerProps}
      terminalProps={terminalProps}
      topBarProps={topBarProps}
      workspaceProps={workspaceProps}
    />
  );
}

export const CodePage = memo(CodePageComponent);
CodePage.displayName = 'CodePage';

