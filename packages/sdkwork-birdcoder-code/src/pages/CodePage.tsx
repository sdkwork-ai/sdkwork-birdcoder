import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildProjectCodingSessionIndex,
  buildWorkbenchCodingSessionTurnContext,
  createIdleProjectMountRecoveryState,
  emitOpenTerminalRequest,
  emitProjectMountRecoveryState,
  getTerminalProfile,
  globalEventBus,
  hydrateImportedProjectFromAuthority,
  resolveLatestCodingSessionIdForProject,
  ensureWorkbenchCodingSessionForMessage,
  importLocalFolderProject,
  openLocalFolder,
  rebindLocalFolderProject,
  regenerateWorkbenchCodingSessionFromLastUserMessage,
  resolveProjectMountRecoverySource,
  restoreWorkbenchCodingSessionMessageFiles,
  setWorkbenchChatInputDraft,
  type TerminalCommandRequest,
  useCodingSessionActions,
  useCodingSessionEngineModelSelection,
  useFileSystem,
  useIDEServices,
  useProjectGitOverview,
  useProjects,
  useSelectedCodingSessionMessages,
  useSessionRefreshActions,
  useWorkbenchCodingSessionCreationActions,
  useWorkbenchChatSelection,
  useWorkbenchPreferences,
  useAuth,
  useToast,
} from '@sdkwork/birdcoder-commons';
import {
  isBirdCoderCodingSessionExecuting,
  type FileChange,
} from '@sdkwork/birdcoder-types';
import { useTranslation } from 'react-i18next';
import { CodeChatEmptyState } from './CodeChatEmptyState';
import { CodeSessionTranscriptLoadingState, getLanguageFromPath } from './CodePageShared';
import { CodePageSurface } from './CodePageSurface';
import { useCodeDeleteConfirmation } from './useCodeDeleteConfirmation';
import { useCodeEditorChatLayout } from './useCodeEditorChatLayout';
import { useCodePageSurfaceProps } from './useCodePageSurfaceProps';
import { useCodeRunEntryActions } from './useCodeRunEntryActions';
import { useCodeWorkbenchCommands } from './useCodeWorkbenchCommands';

interface CodePageProps {
  isVisible?: boolean;
  workspaceId?: string;
  projectId?: string;
  initialCodingSessionId?: string;
  onProjectChange?: (projectId: string) => void;
  onCodingSessionChange?: (codingSessionId: string) => void;
}
function CodePageComponent({
  isVisible = true,
  workspaceId,
  projectId,
  initialCodingSessionId,
  onProjectChange,
  onCodingSessionChange,
}: CodePageProps) {
  const { t } = useTranslation();
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
    deleteCodingSessionMessage,
    sendMessage,
    forkCodingSession,
  } = useProjects(workspaceId, {
    isActive: isVisible,
  });
  const { coreReadService, projectService } = useIDEServices();
  const { user } = useAuth();

  const { addToast } = useToast();
  const { preferences, updatePreferences } = useWorkbenchPreferences();
  const [sessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectionRefreshToken, setSelectionRefreshToken] = useState(0);
  const pendingProjectChangeIdRef = useRef<string | null>(null);
  const lastNotifiedCodingSessionIdRef = useRef<string | null>(null);
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
  const resolveSession = useCallback(
    (id: string | null | undefined) => {
      const normalizedCodingSessionId = id?.trim() ?? '';
      return normalizedCodingSessionId
        ? sessionIndex.codingSessionLocationsById.get(normalizedCodingSessionId) ?? null
        : null;
    },
    [sessionIndex],
  );

  // Determine the current project ID based on the selected session, or the prop.
  const selectedCodingSessionLocation = resolveSession(sessionId);
  const sessionProjectId = selectedCodingSessionLocation?.project.id ?? '';
  const normalizedProjectId = projectId?.trim() ?? '';
  const normalizedSessionProjectId = sessionProjectId?.trim() ?? '';
  const currentProjectId = normalizedSessionProjectId || normalizedProjectId;
  const currentProject =
    selectedCodingSessionLocation?.project ??
    resolveProjectById(currentProjectId);
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
  const notifyProjectChange = useCallback((nextProjectId: string) => {
    if (!onProjectChange) {
      return;
    }

    const normalizedNextProjectId = nextProjectId.trim();
    if (normalizedNextProjectId === currentProjectId) {
      return;
    }

    pendingProjectChangeIdRef.current = normalizedNextProjectId;
    onProjectChange(normalizedNextProjectId);
  }, [currentProjectId, onProjectChange]);
  const isSelectedSessionExecuting = isBirdCoderCodingSessionExecuting(session);
  const isChatBusy = isSubmittingTurn || isSelectedSessionExecuting;
  const selectSession = useCallback((
    nextCodingSessionId: string,
    options?: { projectId?: string },
  ) => {
    const normalizedCodingSessionId = nextCodingSessionId.trim();
    if (!normalizedCodingSessionId) {
      return;
    }

    const nextProjectId =
      options?.projectId?.trim() ||
      resolveSession(normalizedCodingSessionId)?.project.id?.trim() ||
      '';

    if (
      normalizedCodingSessionId === (sessionId?.trim() || '') &&
      nextProjectId === currentProjectId
    ) {
      setSelectionRefreshToken((previousState) => previousState + 1);
      return;
    }

    if (nextProjectId) {
      notifyProjectChange(nextProjectId);
    }

    setSelectedSessionId(normalizedCodingSessionId);
  }, [currentProjectId, notifyProjectChange, resolveSession, sessionId]);
  const {
    createCodingSessionFromCurrentProject,
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
  const handleSidebarCodingSessionSelect = useCallback((nextCodingSessionId: string | null) => {
    if (!nextCodingSessionId) {
      setSelectedSessionId(null);
      return;
    }

    selectSession(nextCodingSessionId);
  }, [selectSession]);
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
  const restoreSelectionAfterRefresh = (
    targetProjectId: string,
    targetCodingSessionId: string | null,
  ) => {
    const normalizedTargetProjectId = targetProjectId.trim();
    const normalizedTargetCodingSessionId = targetCodingSessionId?.trim() ?? '';
    const normalizedSelectedCodingSessionId = sessionId?.trim() ?? '';

    if (
      normalizedTargetCodingSessionId &&
      normalizedTargetCodingSessionId === normalizedSelectedCodingSessionId &&
      normalizedTargetProjectId === currentProjectId
    ) {
      return;
    }

    if (targetCodingSessionId) {
      selectSession(targetCodingSessionId, {
        projectId: targetProjectId,
      });
      return;
    }
    if (targetProjectId) {
      notifyProjectChange(targetProjectId);
    }
  };

  useEffect(() => {
    if (
      !normalizedSessionProjectId ||
      !onProjectChange ||
      normalizedSessionProjectId === normalizedProjectId
    ) {
      return;
    }

    if (pendingProjectChangeIdRef.current === normalizedSessionProjectId) {
      pendingProjectChangeIdRef.current = null;
      return;
    }

    onProjectChange(normalizedSessionProjectId);
  }, [normalizedProjectId, normalizedSessionProjectId, onProjectChange]);

  useEffect(() => {
    const normalizedInitialCodingSessionId = initialCodingSessionId?.trim() || '';
    if (!normalizedInitialCodingSessionId) {
      return;
    }

    const hasSelectedCodingSession =
      !!sessionId &&
      !!resolveSession(sessionId);
    if (hasSelectedCodingSession) {
      return;
    }

    if (
      normalizedInitialCodingSessionId !== sessionId &&
      !!resolveSession(normalizedInitialCodingSessionId)
    ) {
      selectSession(normalizedInitialCodingSessionId);
    }
  }, [
    selectSession,
    initialCodingSessionId,
    resolveSession,
    sessionId,
  ]);

  useEffect(() => {
    const nextCodingSessionId = sessionId?.trim() ?? '';
    const normalizedInitialCodingSessionId = initialCodingSessionId?.trim() || '';
    if (nextCodingSessionId === normalizedInitialCodingSessionId) {
      lastNotifiedCodingSessionIdRef.current = nextCodingSessionId;
      return;
    }

    if (lastNotifiedCodingSessionIdRef.current === nextCodingSessionId) {
      return;
    }

    lastNotifiedCodingSessionIdRef.current = nextCodingSessionId;
    onCodingSessionChange?.(nextCodingSessionId);
  }, [initialCodingSessionId, onCodingSessionChange, sessionId]);

  // Clear the selected session if it's no longer in the current projects.
  useEffect(() => {
    if (!hasFetchedProjects) {
      return;
    }

    if (
      sessionId &&
      !resolveSession(sessionId)
    ) {
      setSelectedSessionId(null);
    }
  }, [hasFetchedProjects, resolveSession, sessionId]);

  useCodingSessionActions(
    currentProjectId,
    createCodingSessionWithSelection,
    selectSession,
    {
      isActive: isVisible,
    },
  );

  useCodeWorkbenchCommands({
    isActive: isVisible,
    projects,
    selectedCodingSessionId: sessionId,
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

  const resolveProjectPath = (projectPath?: string) => {
    const normalizedProjectPath = projectPath?.trim() ?? '';
    return normalizedProjectPath.length > 0 ? normalizedProjectPath : null;
  };

  const resolveProjectActionTarget = (project?: { name: string; path?: string } | null) => {
    if (!project) {
      addToast('Project not found', 'error');
      return null;
    }

    const projectPath = resolveProjectPath(project.path);
    if (!projectPath) {
      addToast(`Project folder path is unavailable: ${project.name}`, 'error');
      return null;
    }

    return {
      project,
      projectPath,
    };
  };

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

  const activateImportedProject = useCallback((projectId: string) => {
    const latestCodingSessionId = resolveLatestCodingSessionIdForProject(projects, projectId);
    if (latestCodingSessionId) {
      selectSession(latestCodingSessionId, { projectId });
      return;
    }

    setSelectedSessionId(null);
    notifyProjectChange(projectId);
  }, [notifyProjectChange, projects, selectSession]);

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
          selectSession(latestCodingSessionId, { projectId });
        }
      } catch (error) {
        console.error('Failed to refresh imported project sessions', error);
      }
    })();
  }, [projectService, projects, selectSession, user?.id, workspaceId]);
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
    resolveCodingSessionTitle: (codingSessionId: string) =>
      resolveSession(codingSessionId)?.codingSession.title ?? codingSessionId,
    resolveProjectName: (targetProjectId: string) =>
      resolveProjectById(targetProjectId)?.name ?? targetProjectId,
    restoreSelectionAfterRefresh,
    workspaceId,
  });

  const handleRenameSession = useCallback(async (codingSessionId: string, newName?: string) => {
    if (newName && newName.trim()) {
      const project = resolveSession(codingSessionId)?.project;
      if (project) {
        await renameCodingSession(project.id, codingSessionId, newName.trim());
      }
    }
  }, [renameCodingSession, resolveSession]);

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
    resolveSession,
    sessionId,
    setSelectedSessionId,
    sessionDeletedMessage: t('code.sessionDeleted'),
  });

  const handleDeleteSession = useCallback(async (codingSessionId: string) => {
    requestDeleteSession(codingSessionId);
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
      syncImportedProjectInBackground(importedProject.projectId);
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
        syncImportedProjectInBackground(importedProject.projectId);
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

      syncImportedProjectInBackground(currentProjectId);
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
    currentProjectId,
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

  const handleCopyWorkingDirectory = useCallback((projectId: string) => {
    const target = resolveProjectActionTarget(resolveProjectById(projectId));
    if (!target) {
      return;
    }

    navigator.clipboard.writeText(target.projectPath);
    addToast(`Copied workspace directory: ${target.projectPath}`, 'success');
  }, [addToast, resolveProjectById]);

  const handleCopyProjectPath = useCallback((projectId: string) => {
    const target = resolveProjectActionTarget(resolveProjectById(projectId));
    if (!target) {
      return;
    }

    navigator.clipboard.writeText(target.projectPath);
    addToast(`Copied path: ${target.projectPath}`, 'success');
  }, [addToast, resolveProjectById]);

  const handleOpenInTerminal = useCallback((projectId: string, profileId?: string) => {
    const target = resolveProjectActionTarget(resolveProjectById(projectId));
    if (!target) {
      return;
    }

    const request = {
      path: target.projectPath,
      profileId: profileId ? getTerminalProfile(profileId).id : undefined,
      timestamp: Date.now(),
    };
    emitOpenTerminalRequest(request);
    addToast(
      profileId
        ? `Opened ${getTerminalProfile(profileId).title} terminal: ${target.project.name}`
        : `Opened project in terminal: ${target.project.name}`,
      'info',
    );
  }, [addToast, resolveProjectById]);

  const handleOpenInFileExplorer = useCallback((projectId: string) => {
    const target = resolveProjectActionTarget(resolveProjectById(projectId));
    if (!target) {
      return;
    }

    globalEventBus.emit('revealInExplorer', target.projectPath);
  }, [resolveProjectById]);

  const handlePinSession = useCallback(async (codingSessionId: string) => {
    const resolvedSessionLocation = resolveSession(codingSessionId);
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
  }, [addToast, resolveSession, t, updateCodingSession]);

  const handleArchiveSession = useCallback(async (codingSessionId: string) => {
    const resolvedSessionLocation = resolveSession(codingSessionId);
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
  }, [addToast, resolveSession, t, updateCodingSession]);

  const handleMarkSessionUnread = useCallback(async (codingSessionId: string) => {
    const resolvedSessionLocation = resolveSession(codingSessionId);
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
  }, [addToast, resolveSession, t, updateCodingSession]);

  const handleCopySessionWorkingDirectory = useCallback((codingSessionId: string) => {
    const target = resolveProjectActionTarget(
      resolveSession(codingSessionId)?.project,
    );
    if (!target) {
      return;
    }

    navigator.clipboard.writeText(target.projectPath);
    addToast(t('code.copiedSessionWorkspaceDir', { path: target.projectPath }), 'success');
  }, [addToast, resolveSession, t]);

  const handleCopySessionId = useCallback((codingSessionId: string) => {
    navigator.clipboard.writeText(codingSessionId);
    addToast(t('code.copiedSessionId', { id: codingSessionId }), 'success');
  }, [addToast, t]);

  const handleCopySessionDeeplink = useCallback((codingSessionId: string) => {
    const link = `${window.location.origin}/session/${codingSessionId}`;
    navigator.clipboard.writeText(link);
    addToast(t('code.copiedDeeplink', { link }), 'success');
  }, [addToast, t]);

  const handleForkSessionLocal = useCallback(async (codingSessionId: string) => {
    const resolvedSessionLocation = resolveSession(codingSessionId);
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
  }, [addToast, forkCodingSession, resolveSession, selectSession, t]);

  const handleForkSessionNewTree = useCallback(async (codingSessionId: string) => {
    const resolvedSessionLocation = resolveSession(codingSessionId);
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
  }, [addToast, forkCodingSession, resolveSession, selectSession, t]);

  const handleEditMessage = useCallback((codingSessionId: string, messageId: string) => {
    const codingSession = resolveSession(codingSessionId)?.codingSession;
    const msg = codingSession?.messages?.find(m => m.id === messageId);
    if (msg) {
      setWorkbenchChatInputDraft(codingSessionId, msg.content);
    }
  }, [resolveSession]);

  const handleDeleteMessage = useCallback(async (codingSessionId: string, messageIds: string[]) => {
    requestDeleteMessage(codingSessionId, messageIds);
  }, [requestDeleteMessage]);

  const handleRegenerateMessage = useCallback(async (codingSessionId: string) => {
    if (isChatBusy) {
      return;
    }

    const resolvedSessionLocation = resolveSession(codingSessionId);
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
    resolveSession,
    selectedFile,
    sendMessage,
    setSelectionRefreshToken,
    workspaceId,
  ]);

  const handleRestoreMessage = useCallback(async (codingSessionId: string, messageId: string) => {
    const codingSession = resolveSession(codingSessionId)?.codingSession;
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
  }, [addToast, resolveSession, restoreWorkbenchCodingSessionMessageFiles, saveFileContent]);

  const handleSendMessage = useCallback(async (text?: string) => {
    const trimmedContent = typeof text === 'string' ? text.trim() : '';
    if (!trimmedContent || isChatBusy) return;
    const bootstrappedSession = await ensureWorkbenchCodingSessionForMessage({
      createCodingSessionWithSelection,
      currentCodingSessionId: sessionId,
      currentProjectId,
      messageContent: trimmedContent,
      resolveProjectId: async () => {
        if (projects.length === 0) {
          return handleNewProject();
        }
        return projects[0]?.id;
      },
      selectCodingSession: selectSession,
    });
    if (!bootstrappedSession) {
      return;
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
      await sendMessage(
        bootstrappedSession.projectId,
        bootstrappedSession.codingSessionId,
        trimmedContent,
        context,
      );
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
    sessionId,
    selectedFile,
    sendMessage,
    setSelectionRefreshToken,
    workspaceId,
  ]);
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
  const isSelectedCodingSessionTranscriptVisible =
    isVisible && (activeTab === 'ai' || activeTab === 'editor');
  const isSelectedCodingSessionMessagesLoading = useSelectedCodingSessionMessages({
    coreReadService,
    isActive: isSelectedCodingSessionTranscriptVisible,
    projectService,
    selectionRefreshToken,
    selectedCodingSession: session,
    selectedCodingSessionId: sessionId,
    selectedProject: selectedCodingSessionLocation?.project ?? null,
    workspaceId,
  });
  const selectedCodingSession = session;
  const selectedCodingSessionMessages = useMemo(
    () => selectedCodingSession?.messages ?? [],
    [selectedCodingSession?.messages],
  );
  const isSelectedCodingSessionHydrating = Boolean(
    sessionId &&
    isSelectedCodingSessionMessagesLoading &&
    selectedCodingSessionMessages.length === 0
  );
  const mainChatEmptyState = useMemo(
    () => (
      isSelectedCodingSessionHydrating
        ? <CodeSessionTranscriptLoadingState />
        : <CodeChatEmptyState />
    ),
    [isSelectedCodingSessionHydrating],
  );
  const editorChatEmptyState = useMemo(
    () => (
      isSelectedCodingSessionHydrating
        ? <CodeSessionTranscriptLoadingState />
        : undefined
    ),
    [isSelectedCodingSessionHydrating],
  );

  const handleProjectSelect = useCallback((id: string | null) => {
    if (id) {
      notifyProjectChange(id);
      const targetProject = resolveProjectById(id);
      const targetLatestCodingSessionId =
        sessionIndex.latestCodingSessionIdByProjectId.get(id) ??
        resolveLatestCodingSessionIdForProject(projects, id);
      const sessionBelongsToProject =
        !!sessionId &&
        !!targetProject?.codingSessions.some(
          (codingSession) => codingSession.id === sessionId,
        );

      if (sessionBelongsToProject) {
        return;
      }

      if (targetLatestCodingSessionId) {
        selectSession(targetLatestCodingSessionId, { projectId: id });
        return;
      }

      setSelectedSessionId(null);
    }
  }, [
    selectSession,
    notifyProjectChange,
    sessionIndex.latestCodingSessionIdByProjectId,
    projects,
    resolveProjectById,
    sessionId,
  ]);

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
  const handleEditSelectedCodingSessionMessage = useCallback((messageId: string) => {
    if (session) {
      handleEditMessage(session.id, messageId);
    }
  }, [handleEditMessage, session]);
  const handleDeleteSelectedCodingSessionMessage = useCallback((messageIds: string[]) => {
    if (session) {
      void handleDeleteMessage(session.id, messageIds);
    }
  }, [handleDeleteMessage, session]);
  const handleRegenerateSelectedCodingSessionMessage = useCallback(() => {
    if (session) {
      void handleRegenerateMessage(session.id);
    }
  }, [handleRegenerateMessage, session]);
  const handleRestoreSelectedCodingSessionMessage = useCallback((messageId: string) => {
    if (session) {
      void handleRestoreMessage(session.id, messageId);
    }
  }, [handleRestoreMessage, session]);

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
    isDebugConfigVisible,
    isFindVisible,
    isMountRecoveryActionPending,
    isQuickOpenVisible,
    isRunConfigVisible,
    isRunTaskVisible,
    isSearchingFiles,
    isSelectedSessionExecuting,
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
    selectedSessionTitle: session?.title,
    selectedSessionEngineId: session?.engineId,
    selectedSessionModelId: session?.modelId,
    sessionId,
    showComposerEngineSelector: !sessionId,
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
    onCopyCodingSessionSessionId: handleCopySessionId,
    onCopyCodingSessionWorkingDirectory: handleCopySessionWorkingDirectory,
    onCopyProjectPath: handleCopyProjectPath,
    onCopyWorkingDirectory: handleCopyWorkingDirectory,
    onCreateFile: createFile,
    onCreateFolder: createFolder,
    onCreateNewSession: createCodingSessionFromCurrentProject,
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
    onNewCodingSessionInProject: createCodingSessionInProject,
    onNewProject: handleNewProject,
    onNotifyNoResults: handleNotifyNoCodeResults,
    onOpenFolder: handleOpenFolder,
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

