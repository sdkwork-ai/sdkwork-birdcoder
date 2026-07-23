import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildProjectAgentSessionIndex } from '@sdkwork/birdcoder-pc-workbench/workbench/agentSessionSelection';
import {
  buildWorkbenchAgentSessionTurnContext,
  ensureWorkbenchAgentSessionForMessage,
  regenerateWorkbenchAgentSessionFromLastUserMessage,
  restoreWorkbenchAgentSessionItemFiles,
  type CreateAgentSessionActionOptions,
  type CreateNewAgentSessionRequest,
} from '@sdkwork/birdcoder-pc-workbench/workbench/agentSessionCreation';
import { createIdleProjectMountRecoveryState } from '@sdkwork/birdcoder-pc-workbench/workbench/projectMountRecovery';
import { hydrateImportedProjectFromAuthority } from '@sdkwork/birdcoder-pc-workbench/workbench/importedProjectHydration';
import { rebindLocalFolderProject } from '@sdkwork/birdcoder-pc-workbench/workbench/localFolderProjectImport';
import { openLocalFolder } from '@sdkwork/birdcoder-pc-workbench/utils/fileSystem';
import { emitRevealProjectInFileManager } from '@sdkwork/birdcoder-pc-workbench/events/projectDeviceMountEvents';
import { emitProjectMountRecoveryState } from '@sdkwork/birdcoder-pc-workbench/events/projectMountRecoveryEvents';
import { globalEventBus } from '@sdkwork/birdcoder-pc-workbench/utils/EventBus';
import type { TerminalCommandRequest } from '@sdkwork/birdcoder-pc-workbench/terminal/runtime';
import { useAgentSessionActions } from '@sdkwork/birdcoder-pc-workbench/hooks/useAgentSessionActions';
import { useAgentSessionEngineModelSelection } from '@sdkwork/birdcoder-pc-workbench/hooks/useAgentSessionEngineModelSelection';
import { useFileSystem } from '@sdkwork/birdcoder-pc-workbench/hooks/useFileSystem';
import { useIDEServices } from '@sdkwork/birdcoder-pc-workbench/context/IDEContext';
import { useProjectLocalWorkingDirectory } from '@sdkwork/birdcoder-pc-workbench/hooks/useProjectLocalWorkingDirectory';
import { useProjectRuntimeLocation } from '@sdkwork/birdcoder-pc-workbench/hooks/useProjectRuntimeLocation';
import { useProjectGitOverview } from '@sdkwork/birdcoder-pc-workbench/hooks/useProjectGitOverview';
import { useProjects } from '@sdkwork/birdcoder-pc-workbench/hooks/useProjects';
import { useSelectedAgentSessionItems } from '@sdkwork/birdcoder-pc-workbench/hooks/useSelectedAgentSessionItems';
import { useSessionRefreshActions } from '@sdkwork/birdcoder-pc-workbench/hooks/useSessionRefreshActions';
import { useWorkbenchAgentSessionItemEditAction } from '@sdkwork/birdcoder-pc-workbench/hooks/useWorkbenchAgentSessionItemEditAction';
import { useWorkbenchAgentSessionCreationActions } from '@sdkwork/birdcoder-pc-workbench/hooks/useWorkbenchAgentSessionCreationActions';
import { useWorkbenchChatSelection } from '@sdkwork/birdcoder-pc-workbench/hooks/useWorkbenchChatSelection';
import { useWorkbenchPreferences } from '@sdkwork/birdcoder-pc-workbench/hooks/useWorkbenchPreferences';
import { useAuth } from '@sdkwork/birdcoder-pc-workbench/context/AuthContext';
import { useToast } from '@sdkwork/birdcoder-pc-workbench/contexts/ToastProvider';
import {
  isAgentSessionViewEngineBusy,
  isAgentSessionViewExecuting,
  type FileChange,
} from '@sdkwork/birdcoder-pc-contracts-commons';
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
import { useCodeEffectiveWorkspaceId } from './useCodeEffectiveWorkspaceId';
import { useCodeServerDirectoryProjectImport } from './useCodeServerDirectoryProjectImport';
import { useCodeNewAgentSessionRequestState } from './useCodeNewAgentSessionRequestState';
import { useCodePageSessionSelection } from './useCodePageSessionSelection';
import { useCodePageSurfaceProps } from './useCodePageSurfaceProps';
import { useCodeRunEntryActions } from './useCodeRunEntryActions';
import { useCodePageTerminalActions } from './useCodePageTerminalActions';
import { useCodeWorkbenchCommands } from './useCodeWorkbenchCommands';

function CodePageComponent({
  isVisible = true,
  workspaceId,
  projectId,
  initialAgentSessionId,
  onProjectChange,
  onAgentSessionChange,
}: CodePageProps) {
  const { t } = useTranslation();
  const { createWorkspace, effectiveWorkspaceId, refreshWorkspaces } = useCodeEffectiveWorkspaceId({
    isVisible,
    workspaceId,
  });
  const {
    hasMore: hasMoreProjects,
    hasFetched: hasFetchedProjects,
    isLoadingMore: isLoadingMoreProjects,
    projects,
    filteredProjects,
    searchQuery,
    setSearchQuery,
    createProject,
    createAgentSession,
    renameProject,
    updateProject,
    deleteProject,
    renameAgentSession,
    updateAgentSession,
    deleteAgentSession,
    editAgentSessionItem,
    deleteAgentSessionItem,
    sendMessage,
    forkAgentSession,
    loadMoreProjects,
    loadMoreProjectSessions,
  } = useProjects(effectiveWorkspaceId, {
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
  const { preferences, updatePreferences } = useWorkbenchPreferences();
  const {
    beginPendingNewAgentSessionRequest,
    clearPendingNewAgentSessionRequest,
    isNewAgentSessionCreating,
    pendingNewAgentSessionRequestRef,
  } = useCodeNewAgentSessionRequestState();
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
  const projectAgentSessionIndex = useMemo(
    () => buildProjectAgentSessionIndex(projects),
    [projects],
  );
  const {
    currentProject,
    currentProjectId,
    handleProjectSelect,
    handleSidebarAgentSessionSelect,
    latestAgentSessionIdByProjectId,
    resolveProjectById,
    resolveSession,
    resolveSessionInProject,
    restoreSelectionAfterRefresh,
    selectedAgentSessionLocation,
    selectProjectWithoutAgentSession,
    selectSession,
    selectionRefreshToken,
    sessionId,
    setSelectedSessionId,
    setSelectedSessionProjectId,
    setSelectionRefreshToken,
  } = useCodePageSessionSelection({
    clearPendingNewAgentSessionRequest,
    hasFetchedProjects,
    initialAgentSessionId,
    isVisible,
    onAgentSessionChange,
    onProjectChange,
    projectAgentSessionIndex,
    projectId,
  });
  const resolveSessionActionLocation = useCallback((
    agentSessionId: string,
    projectId?: string | null,
  ) => {
    const scopedProjectId = projectId?.trim() || currentProjectId;
    return scopedProjectId
      ? resolveSessionInProject(agentSessionId, scopedProjectId)
      : resolveSession(agentSessionId);
  }, [currentProjectId, resolveSession, resolveSessionInProject]);
  const projectGitOverviewState = useProjectGitOverview({
    projectId: currentProject?.id,
  });
  const session = selectedAgentSessionLocation?.agentSession;
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
    currentSessionEngineId: session?.engineId,
    currentSessionModelId: session?.modelId,
  });
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
  const isSelectedSessionTurnActive = isAgentSessionViewExecuting(session);
  const isSelectedSessionEngineBusy = isAgentSessionViewEngineBusy(session);
  const isChatBusy = isSubmittingTurn || isSelectedSessionTurnActive || isNewAgentSessionCreating;
  const isChatEngineBusy = isSubmittingTurn || isSelectedSessionEngineBusy || isNewAgentSessionCreating;
  const {
    createAgentSessionFromRequest,
  } = useWorkbenchAgentSessionCreationActions({
    addToast,
    createAgentSessionWithSelection,
    currentProjectId,
    selectAgentSession: selectSession,
    labels: {
      creationFailed: t('code.failedToCreateSession'),
      creationSucceeded: t('code.newSessionCreated'),
      noProjectSelected: t('code.selectProjectFirst'),
    },
  });
  const createAgentSessionWithTranscriptReset = useCallback(async (
    request: CreateNewAgentSessionRequest,
    actionOptions?: CreateAgentSessionActionOptions,
  ) => {
    const normalizedProjectId = request.projectId?.trim() || currentProjectId.trim();
    if (!normalizedProjectId) {
      return createAgentSessionFromRequest(request);
    }

    const pendingRequest = beginPendingNewAgentSessionRequest(normalizedProjectId);

    try {
      return await createAgentSessionFromRequest({
        ...request,
        projectId: normalizedProjectId,
      }, {
        ...actionOptions,
        shouldSelectCreatedSession: (newSession, selectionContext) => {
          const activePendingRequest = pendingNewAgentSessionRequestRef.current;
          const isPendingRequestActive = (
            activePendingRequest?.requestId === pendingRequest.requestId &&
            activePendingRequest.projectId === selectionContext.projectId
          );
          return isPendingRequestActive && (
            actionOptions?.shouldSelectCreatedSession?.(newSession, selectionContext) !== false
          );
        },
      });
    } finally {
      clearPendingNewAgentSessionRequest(pendingRequest.requestId);
    }
  }, [
    beginPendingNewAgentSessionRequest,
    clearPendingNewAgentSessionRequest,
    createAgentSessionFromRequest,
    currentProjectId,
    pendingNewAgentSessionRequestRef,
  ]);
  const createAgentSessionInProjectWithTranscriptReset = useCallback(async (
    projectId: string,
    requestedEngineId?: string,
    requestedModelId?: string,
  ) => {
    await createAgentSessionWithTranscriptReset({
      engineId: requestedEngineId,
      modelId: requestedModelId,
      projectId,
      source: 'code-sidebar',
    });
  }, [createAgentSessionWithTranscriptReset]);
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
    resolveProjectRuntimeLocation,
    isRunConfigVisible,
    setIsRunConfigVisible,
    setIsDebugConfigVisible,
    setIsRunTaskVisible,
    addToast,
  });
  useAgentSessionActions(
    currentProjectId,
    createAgentSessionWithSelection,
    selectSession,
    {
      isActive: isVisible,
      createAgentSessionFromRequest: createAgentSessionWithTranscriptReset,
    },
  );

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
    loadActive: isVisible && activeTab === 'editor',
    realtimeActive: isVisible && activeTab === 'editor',
  });

  useCodeWorkbenchCommands({
    isActive: isVisible,
    projects,
    selectedAgentSessionId: sessionId,
    selectedProjectId: currentProjectId || null,
    resolveProjectRuntimeLocation,
    selectAgentSession: selectSession,
    setIsTerminalOpen,
    setTerminalRequest,
    setIsSidebarVisible,
    setIsFindVisible,
    setIsQuickOpenVisible,
    setIsRunConfigVisible,
    setIsDebugConfigVisible,
    setIsRunTaskVisible,
    onRunWithoutDebugging: handleRunWithoutDebugging,
    flushPendingAutosave,
    addToast,
  });

  useEffect(() => {
    if (saveError) {
      addToast(saveError, 'error');
    }
  }, [addToast, saveError]);
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

  const resolveProjectActionTarget = useCallback((project?: { id: string; name: string } | null) => {
    return resolveCodeProjectActionTarget(project, addToast);
  }, [addToast]);

  const { selectFolderAndImportProject } = useCodeServerDirectoryProjectImport({
    createProject,
    createWorkspace,
    deleteProject,
    effectiveWorkspaceId,
    projectService,
    refreshWorkspaces,
  });

  const activateImportedProject = useCallback((projectId: string) => {
    const latestAgentSessionId = latestAgentSessionIdByProjectId.get(projectId) ?? null;
    if (latestAgentSessionId) {
      selectSession(latestAgentSessionId, { projectId });
      return;
    }

    selectProjectWithoutAgentSession(projectId);
  }, [latestAgentSessionIdByProjectId, selectProjectWithoutAgentSession, selectSession]);

  const syncImportedProjectInBackground = useCallback((projectId: string, workspaceId: string) => {
    const normalizedWorkspaceId = workspaceId.trim();
    if (!normalizedWorkspaceId) {
      return;
    }

    void (async () => {
      try {
        const hydratedProject = await hydrateImportedProjectFromAuthority({
          agentSessionService,
          knownProjects: projects,
          projectId,
          projectService,
          userScope: user?.id,
          workspaceId: normalizedWorkspaceId,
        });
        if (!hydratedProject) {
          return;
        }

        const latestAgentSessionId = hydratedProject.latestAgentSessionId;
        if (latestAgentSessionId) {
          selectSession(latestAgentSessionId, { projectId });
        }
      } catch (error) {
        console.error('Failed to refresh imported project sessions', error);
      }
    })();
  }, [agentSessionService, projectService, projects, selectSession, user?.id]);
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
      failedToRefreshProjectSessions: t('code.failedToRefreshProjectSessions'),
      failedToRefreshSessionMessages: t('code.failedToRefreshSessionMessages'),
      projectSessionsRefreshed: (projectName: string) =>
        t('code.projectSessionsRefreshed', { name: projectName }),
      sessionMessagesRefreshed: (agentSessionTitle: string) =>
        t('code.sessionMessagesRefreshed', { name: agentSessionTitle }),
    },
    projectService,
    resolveAgentSessionLocation: (agentSessionId: string, targetProjectId?: string | null) =>
      resolveSessionActionLocation(agentSessionId, targetProjectId),
    resolveAgentSessionTitle: (agentSessionId: string, targetProjectId?: string | null) =>
      resolveSessionActionLocation(agentSessionId, targetProjectId)
        ?.agentSession.title ?? agentSessionId,
    resolveProjectName: (targetProjectId: string) =>
      resolveProjectById(targetProjectId)?.name ?? targetProjectId,
    restoreSelectionAfterRefresh,
    workspaceId,
  });

  const handleRenameSession = useCallback(async (
    agentSessionId: string,
    projectId: string,
    newName?: string,
  ) => {
    if (newName && newName.trim()) {
      const project = resolveSessionActionLocation(agentSessionId, projectId)?.project;
      if (project) {
        await renameAgentSession(project.id, agentSessionId, newName.trim());
      }
    }
  }, [renameAgentSession, resolveSessionActionLocation]);

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
    deleteAgentSession,
    deleteAgentSessionItem,
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
    agentSessionId: string,
    projectId: string,
  ) => {
    requestDeleteSession(agentSessionId, projectId);
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
      const importedProject = await selectFolderAndImportProject(t('app.serverDirectory'));
      if (importedProject) {
        activateImportedProject(importedProject.projectId);
        syncImportedProjectInBackground(importedProject.projectId, importedProject.workspaceId);
        addToast(`Opened folder: ${importedProject.projectName}`, 'success');
      }
    } catch (error) {
      console.error("Failed to open folder", error);
      addToast('Failed to open folder', 'error');
    }
  }, [addToast, activateImportedProject, selectFolderAndImportProject, syncImportedProjectInBackground, t]);

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
      addToast(`Reconnected folder: ${currentProject?.name ?? 'Local folder'}`, 'success');
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
  }, [addToast, currentProject?.name, currentProjectId, restoreProjectMount]);

  const handleReimportProjectFolder = useCallback(async () => {
    if (!currentProjectId) {
      addToast('Select a project before choosing a folder.', 'error');
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
        fallbackProjectName: currentProject?.name ?? 'Local Folder',
        folderInfo: pickerResult.source,
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
    projectRuntimeLocationService,
    syncImportedProjectInBackground,
  ]);

  const handleArchiveProject = useCallback(async (projectId: string) => {
    const project = resolveProjectById(projectId);
    if (project) {
      await updateProject(projectId, {
        status: project.archived ? 'active' : 'archived',
      });
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
    resolveLocalWorkingDirectory: resolveProjectLocalWorkingDirectory,
    resolveProjectById,
    resolveSession: resolveSessionActionLocation,
    t,
  });

  const {
    handleCopySessionId,
    handleOpenInTerminal,
    handleTopBarTerminalVisibilityChange,
  } = useCodePageTerminalActions({
    addToast,
    currentProjectId,
    resolveProjectActionTarget,
    resolveProjectRuntimeLocation,
    resolveProjectById,
    setIsTerminalOpen,
    setTerminalRequest,
    t,
  });

  const handleOpenInFileExplorer = useCallback((projectId: string) => {
    const project = resolveProjectActionTarget(resolveProjectById(projectId));
    if (!project) {
      return;
    }

    emitRevealProjectInFileManager({ projectId: project.id });
  }, [resolveProjectById]);

  const handlePinSession = useCallback(async (
    agentSessionId: string,
    projectId: string,
  ) => {
    const resolvedSessionLocation = resolveSessionActionLocation(agentSessionId, projectId);
    const project = resolvedSessionLocation?.project;
    if (project) {
      const agentSession = resolvedSessionLocation?.agentSession;
      if (agentSession) {
        await updateAgentSession(project.id, agentSessionId, { pinned: !agentSession.pinned });
        addToast(
          t(agentSession.pinned ? 'code.unpinnedSession' : 'code.pinnedSession', {
            name: agentSession.title,
          }),
          'success',
        );
      }
    }
  }, [addToast, resolveSessionActionLocation, t, updateAgentSession]);

  const handleArchiveSession = useCallback(async (
    agentSessionId: string,
    projectId: string,
  ) => {
    const resolvedSessionLocation = resolveSessionActionLocation(agentSessionId, projectId);
    const project = resolvedSessionLocation?.project;
    if (project) {
      const agentSession = resolvedSessionLocation?.agentSession;
      if (!agentSession) {
        return;
      }

      await updateAgentSession(project.id, agentSessionId, { archived: !agentSession.archived });
      addToast(
        t(agentSession.archived ? 'code.unarchivedSession' : 'code.archivedSession', {
          id: agentSessionId,
        }),
        'info',
      );
    }
  }, [addToast, resolveSessionActionLocation, t, updateAgentSession]);

  const handleMarkSessionUnread = useCallback(async (
    agentSessionId: string,
    projectId: string,
  ) => {
    const resolvedSessionLocation = resolveSessionActionLocation(agentSessionId, projectId);
    const project = resolvedSessionLocation?.project;
    if (project) {
      const agentSession = resolvedSessionLocation?.agentSession;
      if (agentSession) {
        await updateAgentSession(project.id, agentSessionId, { unread: !agentSession.unread });
        addToast(
          t(agentSession.unread ? 'code.markedAsRead' : 'code.markedAsUnread', {
            name: agentSession.title,
          }),
          'info',
        );
      }
    }
  }, [addToast, resolveSessionActionLocation, t, updateAgentSession]);

  const handleForkSessionLocal = useCallback(async (
    agentSessionId: string,
    projectId: string,
  ) => {
    const resolvedSessionLocation = resolveSessionActionLocation(agentSessionId, projectId);
    const project = resolvedSessionLocation?.project;
    if (project) {
      try {
        const newSession = await forkAgentSession(project.id, agentSessionId);
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
  }, [addToast, forkAgentSession, resolveSessionActionLocation, selectSession, t]);

  const handleForkSessionNewTree = useCallback(async (
    agentSessionId: string,
    projectId: string,
  ) => {
    const resolvedSessionLocation = resolveSessionActionLocation(agentSessionId, projectId);
    const project = resolvedSessionLocation?.project;
    if (project) {
      try {
        const newSession = await forkAgentSession(
          project.id,
          agentSessionId,
          `${resolvedSessionLocation?.agentSession.title} (New Tree)`,
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
  }, [addToast, forkAgentSession, resolveSessionActionLocation, selectSession, t]);

  const handleEditMessage = useWorkbenchAgentSessionItemEditAction({
    editAgentSessionItem,
    resolveAgentSessionLocation: (agentSessionId: string) =>
      resolveSessionActionLocation(agentSessionId, currentProjectId),
    sessionUnavailableMessage: t('chat.sendMessageSessionUnavailable'),
    setSelectionRefreshToken,
  });

  const handleDeleteMessage = useCallback(async (
    agentSessionId: string,
    projectId: string,
    messageIds: string[],
  ) => {
    requestDeleteMessage(agentSessionId, projectId, messageIds);
  }, [requestDeleteMessage]);

  const handleRegenerateMessage = useCallback(async (
    agentSessionId: string,
    projectId: string,
  ) => {
    if (isChatBusy) {
      return;
    }

    const resolvedSessionLocation = resolveSessionActionLocation(agentSessionId, projectId);
    const project = resolvedSessionLocation?.project;
    if (project) {
      const agentSession = resolvedSessionLocation?.agentSession;
      if (agentSession && agentSession.items.length > 0) {
        setIsSubmittingTurn(true);
        try {
          const didRegenerate =
            await regenerateWorkbenchAgentSessionFromLastUserMessage({
              agentSession,
              deleteAgentSessionItem,
              projectId: project.id,
              regenerateMessageContext: buildWorkbenchAgentSessionTurnContext({
                currentFileContent: fileContent,
                currentFileLanguage: selectedFile ? getLanguageFromPath(selectedFile) : null,
                currentFilePath: selectedFile,
                projectId: project.id,
                sessionId: agentSession.id,
                workspaceId,
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
    }
  }, [
    deleteAgentSessionItem,
    fileContent,
    getLanguageFromPath,
    isChatBusy,
    buildWorkbenchAgentSessionTurnContext,
    regenerateWorkbenchAgentSessionFromLastUserMessage,
    resolveSessionActionLocation,
    selectedFile,
    sendMessage,
    setSelectionRefreshToken,
    workspaceId,
  ]);

  const handleRestoreMessage = useCallback(async (
    agentSessionId: string,
    projectId: string,
    messageId: string,
  ) => {
    const agentSession =
      resolveSessionActionLocation(agentSessionId, projectId)?.agentSession;
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
      addToast('Restored files to previous state', 'success');
    } catch (error) {
      console.error('Failed to restore files from checkpoint', error);
      addToast('Failed to restore files from checkpoint', 'error');
    }
  }, [
    addToast,
    resolveSessionActionLocation,
    restoreWorkbenchAgentSessionItemFiles,
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
    const requestedModelId = composerSelection?.modelId?.trim() ?? '';
    const currentSessionEngineId = session?.engineId?.trim() ?? '';
    const currentSessionModelId = session?.modelId?.trim() ?? '';
    const currentAgentSessionId =
      (requestedEngineId &&
        requestedEngineId.toLowerCase() !== currentSessionEngineId.toLowerCase()) ||
      (requestedModelId &&
        requestedModelId.toLowerCase() !== currentSessionModelId.toLowerCase())
        ? null
        : sessionId;
    const bootstrappedSession = await ensureWorkbenchAgentSessionForMessage({
      createAgentSessionFromRequest: createAgentSessionWithTranscriptReset,
      currentAgentSessionId,
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
        workspaceId,
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
        selectSession(sentMessage.sessionId, { projectId: bootstrappedSession.projectId });
      }
      setSelectionRefreshToken((previousState) => previousState + 1);
    } finally {
      setIsSubmittingTurn(false);
    }
  }, [
    buildWorkbenchAgentSessionTurnContext,
    ensureWorkbenchAgentSessionForMessage,
    createAgentSessionWithTranscriptReset,
    currentProjectId,
    fileContent,
    handleNewProject,
    getLanguageFromPath,
    isChatBusy,
    selectSession,
    projects,
    session?.engineId,
    session?.modelId,
    sessionId,
    selectedFile,
    sendMessage,
    setSelectionRefreshToken,
    t,
    workspaceId,
  ]);
  const visibleSessionId = isNewAgentSessionCreating ? null : sessionId;
  const selectedAgentSession = isNewAgentSessionCreating ? null : session;
  const {
    handleSelectedEngineChange,
    handleSelectedModelChange,
  } = useAgentSessionEngineModelSelection({
    preferences,
    selectedModelId,
    sessionId: visibleSessionId,
    setSelectedEngineId,
    setSelectedModelId,
  });
  const isSelectedAgentSessionTranscriptVisible =
    isVisible && (activeTab === 'ai' || activeTab === 'editor');
  const isSelectedAgentSessionItemsLoading = useSelectedAgentSessionItems({
    agentSessionService,
    isActive: isSelectedAgentSessionTranscriptVisible,
    projectService,
    selectionRefreshToken,
    selectedAgentSession,
    selectedAgentSessionId: visibleSessionId,
    selectedProject: selectedAgentSessionLocation?.project ?? currentProject ?? null,
    workspaceId,
  });
  const selectedAgentSessionItems = useMemo(
    () => (isNewAgentSessionCreating ? [] : selectedAgentSession?.items ?? []),
    [isNewAgentSessionCreating, selectedAgentSession?.items],
  );
  const isSelectedAgentSessionHydrating = Boolean(
    isNewAgentSessionCreating ||
    (
      visibleSessionId &&
      isSelectedAgentSessionItemsLoading &&
      selectedAgentSessionItems.length === 0
    )
  );
  const {
    mainChatEmptyState,
    editorChatEmptyState,
  } = useMemo(
    () => createCodeChatEmptyStates(isSelectedAgentSessionHydrating),
    [isSelectedAgentSessionHydrating],
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
  const handleOpenMessageFile = useCallback((path: string) => {
    const settleSelection = (selectionResult: 'opened' | 'rejected') => {
      if (selectionResult === 'rejected') {
        addToast(t('chat.fileOpenUnavailable', { path }), 'error');
        return;
      }
      setViewingDiff(null);
      setActiveTab('editor');
    };
    const selectionResult = selectMessageFile(path, settleSelection);
    if (selectionResult !== 'pending') {
      settleSelection(selectionResult);
    }
  }, [addToast, selectMessageFile, t]);
  const handleSelectWorkspaceFile = useCallback((path: string) => {
    setViewingDiff(null);
    selectFile(path);
  }, [selectFile]);
  const handleCloseWorkspaceFile = useCallback((path: string) => {
    closeFile(path);
  }, [closeFile]);
  const handleCloseViewingDiff = useCallback(() => {
    setViewingDiff(null);
  }, []);
  const handleEditSelectedAgentSessionItem = useCallback((messageId: string, content: string) => {
    if (session) {
      return handleEditMessage(session.id, messageId, content);
    }
    return Promise.resolve();
  }, [handleEditMessage, session]);
  const handleDeleteSelectedAgentSessionItem = useCallback((messageIds: string[]) => {
    if (session) {
      void handleDeleteMessage(session.id, currentProjectId, messageIds);
    }
  }, [currentProjectId, handleDeleteMessage, session]);
  const handleRegenerateSelectedAgentSessionItem = useCallback(() => {
    if (session) {
      void handleRegenerateMessage(session.id, currentProjectId);
    }
  }, [currentProjectId, handleRegenerateMessage, session]);
  const handleRestoreSelectedAgentSessionItem = useCallback((messageId: string) => {
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
    deleteConfirmation,
    editorChatEmptyState,
    editorExplorerWidth,
    chatWidth: effectiveEditorChatWidth,
    fileContent,
    files,
    filteredProjects,
    hasMoreProjects,
    isChatBusy,
    isChatEngineBusy,
    isEngineBusyCurrentSession: isSelectedSessionEngineBusy,
    isDebugConfigVisible,
    isFindVisible,
    isMountRecoveryActionPending,
    isLoadingMoreProjects,
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
    refreshingAgentSessionId,
    refreshingProjectId,
    runConfigurationDraft,
    runConfigurations,
    searchQuery,
    selectedAgentSessionItems,
    selectedFile,
    selectedSessionLastTurnAt: selectedAgentSession?.lastTurnAt,
    selectedSessionTitle: selectedAgentSession?.title,
    selectedSessionEngineId: selectedAgentSession?.engineId,
    selectedSessionModelId: selectedAgentSession?.modelId,
    selectedSessionRuntimeStatus: selectedAgentSession?.runtimeStatus,
    selectedSessionTranscriptUpdatedAt: selectedAgentSession?.transcriptUpdatedAt,
    selectedSessionUpdatedAt: selectedAgentSession?.updatedAt,
    sessionId: visibleSessionId,
    showComposerEngineSelector: true,
    sidebarWidth,
    terminalHeight,
    terminalRequest,
    viewingDiff,
    workspaceId,
    onArchiveAgentSession: handleArchiveSession,
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
    onCopyAgentSessionDeeplink: handleCopySessionDeeplink,
    onCopyAgentSessionSessionId: handleCopySessionId,
    onCopyAgentSessionWorkingDirectory: handleCopySessionWorkingDirectory,
    onCopyProjectPath: handleCopyProjectPath,
    onCopyWorkingDirectory: handleCopyWorkingDirectory,
    onCreateFile: createFile,
    onCreateFolder: createFolder,
    onCreateRootFile: handleCreateRootFile,
    onCloseProjectGitOverviewDrawer: handleCloseProjectGitOverviewDrawer,
    onDeleteAgentSession: handleDeleteSession,
    onDeleteFile: deleteFile,
    onDeleteFolder: deleteFolder,
    onDeleteMessage: handleDeleteSelectedAgentSessionItem,
    onDeleteProject: handleDeleteProject,
    onEditMessage: handleEditSelectedAgentSessionItem,
    onExpandDirectory: loadDirectory,
    onExplorerResize: handleEditorExplorerResize,
    onFileDraftChange: updateFileDraft,
    onForkAgentSessionLocal: handleForkSessionLocal,
    onForkAgentSessionNewTree: handleForkSessionNewTree,
    onMarkAgentSessionUnread: handleMarkSessionUnread,
    onNewAgentSessionInProject: createAgentSessionInProjectWithTranscriptReset,
    onNewProject: handleNewProject,
    onLoadMoreProjects: loadMoreProjects,
    onLoadMoreProjectSessions: loadMoreProjectSessions,
    onNotifyNoResults: handleNotifyNoCodeResults,
    onOpenFolder: handleOpenFolder,
    onOpenInFileExplorer: handleOpenInFileExplorer,
    onOpenInTerminal: handleOpenInTerminal,
    onOpenMessageFile: handleOpenMessageFile,
    onPinAgentSession: handlePinSession,
    onProjectSelect: handleProjectSelect,
    onRefreshAgentSessionItems: handleRefreshAgentSessionItems,
    onRefreshProjectSessions: handleRefreshProjectSessions,
    onRegenerateMessage: handleRegenerateSelectedAgentSessionItem,
    onCloseDiff: handleCloseViewingDiff,
    onReimportProjectFolder: handleReimportProjectFolderAction,
    onRenameAgentSession: handleRenameSession,
    onRenameNode: renameNode,
    onRenameProject: handleRenameProject,
    onRestoreMessage: handleRestoreSelectedAgentSessionItem,
    onRetryMountRecovery: handleRetryMountRecoveryAction,
    onRunConfigurationDraftChange: setRunConfigurationDraft,
    onRunTask: handleRunTaskExecution,
    onSaveDebugConfig: handleSaveDebugConfiguration,
    onSearchFiles: searchFiles,
    onSelectAgentSession: handleSidebarAgentSessionSelect,
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
