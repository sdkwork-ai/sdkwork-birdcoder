import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildProjectAgentSessionIndex } from '@sdkwork/birdcoder-pc-workbench/workbench/agentSessionSelection';
import {
  buildWorkbenchAgentSessionTurnContext,
  ensureWorkbenchAgentSessionForTurnInput,
  regenerateWorkbenchAgentSessionFromLastUserItem,
  restoreWorkbenchAgentSessionItemFiles,
  type CreateAgentSessionActionOptions,
  type CreateNewAgentSessionRequest,
} from '@sdkwork/birdcoder-pc-workbench/workbench/agentSessionCreation';
import { createIdleProjectMountRecoveryState } from '@sdkwork/birdcoder-pc-workbench/workbench/projectMountRecovery';
import { emitRevealProjectInFileManager } from '@sdkwork/birdcoder-pc-workbench/events/projectDeviceMountEvents';
import { emitProjectMountRecoveryState } from '@sdkwork/birdcoder-pc-workbench/events/projectMountRecoveryEvents';
import { subscribeRevealAgentSession } from '@sdkwork/birdcoder-pc-workbench/events/agentSessionRevealEvents';
import { globalEventBus } from '@sdkwork/birdcoder-pc-workbench/utils/EventBus';
import type { TerminalCommandRequest } from '@sdkwork/birdcoder-pc-workbench/terminal/runtime';
import { useAgentSessionActions } from '@sdkwork/birdcoder-pc-workbench/hooks/useAgentSessionActions';
import { useAgentSessionEngineModelSelection } from '@sdkwork/birdcoder-pc-workbench/hooks/useAgentSessionEngineModelSelection';
import { useFileSystem } from '@sdkwork/birdcoder-pc-workbench/hooks/useFileSystem';
import { useImportedProjectSessionSynchronization } from '@sdkwork/birdcoder-pc-workbench/hooks/useImportedProjectSessionSynchronization';
import { useIDEServices } from '@sdkwork/birdcoder-pc-workbench/context/IDEContext';
import { buildBirdCoderAuthSessionInventoryScope } from '@sdkwork/birdcoder-pc-workbench/context/authSessionScope';
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
import type { UniversalChatComposerSubmission } from '@sdkwork/birdcoder-pc-ui/components/UniversalChat';
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
import { useCodeServerDirectoryProjectImport } from './useCodeServerDirectoryProjectImport';
import { useCodeNewAgentSessionRequestState } from './useCodeNewAgentSessionRequestState';
import { useCodePageSessionSelection } from './useCodePageSessionSelection';
import { useCodeProjectMountRecoveryActions } from './useCodeProjectMountRecoveryActions';
import { useCodePageSurfaceProps } from './useCodePageSurfaceProps';
import { useCodeRunEntryActions } from './useCodeRunEntryActions';
import { useCodePageTerminalActions } from './useCodePageTerminalActions';
import { useCodeWorkbenchCommands } from './useCodeWorkbenchCommands';

const PROJECT_SIDEBAR_ADAPTIVE_MIN_WIDTH = 288;
const PROJECT_SIDEBAR_ADAPTIVE_MAX_WIDTH = 420;
const PROJECT_SIDEBAR_VIEWPORT_RATIO = 0.24;
const PROJECT_SIDEBAR_MANUAL_MIN_WIDTH = 200;
const PROJECT_SIDEBAR_MANUAL_MAX_WIDTH = 600;
const PROJECT_SIDEBAR_MAX_VIEWPORT_RATIO = 0.45;
const FALLBACK_VIEWPORT_WIDTH = 1_440;

function constrainProjectSidebarWidth(width: number, viewportWidth: number): number {
  const viewportMaximum = Math.max(
    PROJECT_SIDEBAR_MANUAL_MIN_WIDTH,
    Math.min(
      PROJECT_SIDEBAR_MANUAL_MAX_WIDTH,
      Math.floor(viewportWidth * PROJECT_SIDEBAR_MAX_VIEWPORT_RATIO),
    ),
  );

  return Math.max(
    PROJECT_SIDEBAR_MANUAL_MIN_WIDTH,
    Math.min(viewportMaximum, width),
  );
}

function resolveAdaptiveProjectSidebarWidth(viewportWidth: number): number {
  const preferredWidth = Math.round(viewportWidth * PROJECT_SIDEBAR_VIEWPORT_RATIO);
  const adaptiveWidth = Math.max(
    PROJECT_SIDEBAR_ADAPTIVE_MIN_WIDTH,
    Math.min(PROJECT_SIDEBAR_ADAPTIVE_MAX_WIDTH, preferredWidth),
  );

  return constrainProjectSidebarWidth(adaptiveWidth, viewportWidth);
}

function readViewportWidth(): number {
  return typeof window === 'undefined' ? FALLBACK_VIEWPORT_WIDTH : window.innerWidth;
}

function CodePageComponent({
  isVisible = true,
  workspaceId,
  projectId,
  initialAgentSessionId,
  onRequestProjectCreation,
  onProjectChange,
  onAgentSessionChange,
}: CodePageProps) {
  const { t } = useTranslation();
  const {
    hasMore: hasMoreProjects,
    hasFetched: hasFetchedProjects,
    isLoadingMore: isLoadingMoreProjects,
    projects,
    filteredProjects,
    searchQuery,
    setSearchQuery,
    ensureProject,
    importProject,
    createAgentSession,
    renameProject,
    archiveProject,
    deleteProject,
    renameAgentSession,
    updateAgentSession,
    updateAgentSessionRuntimeStatus,
    deleteAgentSession,
    editAgentSessionItem,
    deleteAgentSessionItem,
    submitAgentTurnInput,
    forkAgentSession,
    loadMoreProjects,
    loadMoreProjectSessions,
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
  const manualSidebarWidthRef = useRef<number | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    resolveAdaptiveProjectSidebarWidth(readViewportWidth()),
  );
  const [editorExplorerWidth, setEditorExplorerWidth] = useState(256);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  useEffect(() => subscribeRevealAgentSession(() => {
    startTransition(() => {
      setActiveTab('ai');
    });
    setIsSidebarVisible(true);
  }), []);
  const [isFindVisible, setIsFindVisible] = useState(false);
  const [isQuickOpenVisible, setIsQuickOpenVisible] = useState(false);
  const [isRunConfigVisible, setIsRunConfigVisible] = useState(false);
  const [isDebugConfigVisible, setIsDebugConfigVisible] = useState(false);
  const [isRunTaskVisible, setIsRunTaskVisible] = useState(false);
  const [isProjectGitOverviewDrawerOpen, setIsProjectGitOverviewDrawerOpen] = useState(false);
  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((previousState) => {
      const preferredWidth = Math.max(
        PROJECT_SIDEBAR_MANUAL_MIN_WIDTH,
        Math.min(PROJECT_SIDEBAR_MANUAL_MAX_WIDTH, previousState + delta),
      );
      manualSidebarWidthRef.current = preferredWidth;
      return constrainProjectSidebarWidth(preferredWidth, readViewportWidth());
    });
  }, []);
  useEffect(() => {
    const handleViewportResize = () => {
      const viewportWidth = readViewportWidth();
      setSidebarWidth(
        manualSidebarWidthRef.current === null
          ? resolveAdaptiveProjectSidebarWidth(viewportWidth)
          : constrainProjectSidebarWidth(manualSidebarWidthRef.current, viewportWidth),
      );
    };

    window.addEventListener('resize', handleViewportResize);
    return () => window.removeEventListener('resize', handleViewportResize);
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
    loadActive: isVisible && activeTab === 'editor',
    mountRecoveryActive: isVisible,
    realtimeActive: isVisible && activeTab === 'editor',
  });
  const projectGitOverviewState = useProjectGitOverview({
    isActive: isVisible,
    projectId: currentProjectId,
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

  const resolveProjectActionTarget = useCallback((
    project?: { name: string; projectId: string } | null,
  ) => {
    return resolveCodeProjectActionTarget(project, addToast);
  }, [addToast]);

  const {
    selectFolderAndImportProject,
    selectProjectFolder,
  } = useCodeServerDirectoryProjectImport({
    bindLocalProjectRuntimeLocation: (projectId, source) =>
      projectRuntimeLocationService.bindLocalProjectRuntimeLocation(projectId, source),
    ensureProject,
    importProject,
    workspaceId,
  });

  const activateImportedProject = useCallback((projectId: string) => {
    const latestAgentSessionId = latestAgentSessionIdByProjectId.get(projectId) ?? null;
    if (latestAgentSessionId) {
      selectSession(latestAgentSessionId, { projectId });
      return;
    }

    selectProjectWithoutAgentSession(projectId);
  }, [latestAgentSessionIdByProjectId, selectProjectWithoutAgentSession, selectSession]);

  const handleImportedProjectSessionsSynchronized = useCallback((result: {
    latestAgentSessionId: string | null;
    project: { projectId: string };
  }) => {
    const synchronizedProjectId = result.project.projectId;
    if (currentProjectId !== synchronizedProjectId) {
      return;
    }
    if (sessionId?.trim() || initialAgentSessionId?.trim()) {
      return;
    }
    if (result.latestAgentSessionId) {
      selectSession(result.latestAgentSessionId, { projectId: synchronizedProjectId });
    }
  }, [currentProjectId, initialAgentSessionId, selectSession, sessionId]);
  const {
    invalidateImportedProjectSessionSynchronization,
    synchronizeImportedProject,
  } = useImportedProjectSessionSynchronization({
    agentSessionService,
    knownProjects: projects,
    onSynchronized: handleImportedProjectSessionsSynchronized,
    projectService,
    userScope,
    workspaceId,
  });

  useEffect(() => {
    if (!isVisible) {
      return;
    }
    if (!currentProjectId) {
      return;
    }
    if (mountRecoveryState.status !== 'recovered') {
      invalidateImportedProjectSessionSynchronization(currentProjectId);
      return;
    }

    void synchronizeImportedProject(currentProjectId).catch((error) => {
      console.error('Failed to refresh mounted project sessions', error);
    });
  }, [
    currentProjectId,
    invalidateImportedProjectSessionSynchronization,
    isVisible,
    mountRecoveryState.status,
    synchronizeImportedProject,
  ]);
  const {
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
    synchronizeProjectSessions: synchronizeImportedProject,
  });
  const handleRenameSession = useCallback(async (
    agentSessionId: string,
    projectId: string,
    newName?: string,
  ) => {
    if (newName && newName.trim()) {
      const project = resolveSessionActionLocation(agentSessionId, projectId)?.project;
      if (project) {
        await renameAgentSession(project.projectId, agentSessionId, newName.trim());
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
    projectRemoveFailedMessage: t('app.failedToRemoveProject'),
    projectRemovedMessage: t('app.projectRemoved'),
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

  const handleNewProject = useCallback(
    () => onRequestProjectCreation(),
    [onRequestProjectCreation],
  );
  const handleNewSessionProjectSelect = useCallback((nextProjectId: string) => {
    clearPendingNewAgentSessionRequest();
    selectProjectWithoutAgentSession(nextProjectId);
  }, [clearPendingNewAgentSessionRequest, selectProjectWithoutAgentSession]);

  const handleOpenFolder = useCallback(async () => {
    try {
      const importedProject = await selectFolderAndImportProject(t('app.serverDirectory'));
      if (importedProject) {
        activateImportedProject(importedProject.projectId);
        await synchronizeImportedProject(importedProject.projectId, true);
        addToast(`Opened folder: ${importedProject.projectName}`, 'success');
      }
    } catch (error) {
      console.error("Failed to open folder", error);
      addToast('Failed to open folder', 'error');
    }
  }, [
    addToast,
    activateImportedProject,
    selectFolderAndImportProject,
    synchronizeImportedProject,
    t,
  ]);

  const {
    handleReimportProjectFolder,
    handleRetryMountRecovery,
    isMountRecoveryActionPending,
  } = useCodeProjectMountRecoveryActions({
    currentProject,
    currentProjectId,
    restoreProjectMount,
    selectProjectFolder,
    synchronizeImportedProject,
  });

  const handleArchiveProject = useCallback(async (projectId: string) => {
    const project = resolveProjectById(projectId);
    if (!project || project.status === 'archived') {
      return;
    }
    await archiveProject(projectId);
    addToast(`Archived project: ${project.name}`, 'info');
  }, [addToast, archiveProject, resolveProjectById]);

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
    handleCopyProviderSessionId,
    handleOpenAgentSessionInTerminal,
    handleOpenInTerminal,
    handleTopBarTerminalVisibilityChange,
  } = useCodePageTerminalActions({
    addToast,
    currentProject,
    resolveProjectActionTarget,
    resolveProjectRuntimeLocation,
    resolveProjectById,
    resolveSessionActionLocation,
    setIsTerminalOpen,
    setTerminalRequest,
    t,
  });

  const handleOpenInFileExplorer = useCallback((projectId: string) => {
    const project = resolveProjectActionTarget(resolveProjectById(projectId));
    if (!project) {
      return;
    }

    emitRevealProjectInFileManager(project);
  }, [resolveProjectActionTarget, resolveProjectById]);

  const handlePinSession = useCallback(async (
    agentSessionId: string,
    projectId: string,
  ) => {
    const resolvedSessionLocation = resolveSessionActionLocation(agentSessionId, projectId);
    const project = resolvedSessionLocation?.project;
    if (project) {
      const agentSession = resolvedSessionLocation?.agentSession;
      if (agentSession) {
        const didUpdate = await updateAgentSession(project.projectId, agentSessionId, {
          pinned: !agentSession.pinned,
        });
        if (!didUpdate) {
          return;
        }
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

      await updateAgentSession(project.projectId, agentSessionId, { archived: !agentSession.archived });
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
        await updateAgentSession(project.projectId, agentSessionId, { unread: !agentSession.unread });
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
        const newSession = await forkAgentSession(project.projectId, agentSessionId);
        selectSession(newSession.id, { projectId: project.projectId });
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
          project.projectId,
          agentSessionId,
          `${resolvedSessionLocation?.agentSession.title} (New Tree)`,
        );
        selectSession(newSession.id, { projectId: project.projectId });
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
    sessionItemIds: string[],
  ) => {
    requestDeleteMessage(agentSessionId, projectId, sessionItemIds);
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
    }
  }, [
    deleteAgentSessionItem,
    fileContent,
    getLanguageFromPath,
    isChatBusy,
    buildWorkbenchAgentSessionTurnContext,
    regenerateWorkbenchAgentSessionFromLastUserItem,
    resolveSessionActionLocation,
    selectedFile,
    submitAgentTurnInput,
    setSelectionRefreshToken,
  ]);

  const handleRestoreMessage = useCallback(async (
    agentSessionId: string,
    projectId: string,
    messageId: string,
    fileChanges?: readonly FileChange[],
  ) => {
    const agentSession =
      resolveSessionActionLocation(agentSessionId, projectId)?.agentSession;
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
      addToast('Restored files to previous state', 'success');
    } catch (error) {
      console.error('Failed to restore files from checkpoint', error);
      addToast('Failed to restore files from checkpoint', 'error');
    }
  }, [
    addToast,
    resolveSessionActionLocation,
    restoreWorkbenchAgentSessionItemFiles,
    loadFileContent,
    saveFileContent,
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
    const bootstrappedSession = await ensureWorkbenchAgentSessionForTurnInput({
      createAgentSessionFromRequest: createAgentSessionWithTranscriptReset,
      currentAgentSessionId,
      currentProjectId,
      turnInputContent: trimmedContent,
      requestedEngineId: composerSelection?.engineId,
      requestedModelId: composerSelection?.modelId,
      resolveProjectId: async () => {
        if (!projects.length) {
          return handleNewProject();
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
        submission?.driveRefs?.length || composerSelection?.accessModeId?.trim()
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
        selectSession(sentMessage.sessionId, { projectId: bootstrappedSession.projectId });
      }
      setSelectionRefreshToken((previousState) => previousState + 1);
    } finally {
      setIsSubmittingTurn(false);
    }
  }, [
    buildWorkbenchAgentSessionTurnContext,
    ensureWorkbenchAgentSessionForTurnInput,
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
    submitAgentTurnInput,
    setSelectionRefreshToken,
    t,
  ]);
  const visibleSessionId = isNewAgentSessionCreating ? null : sessionId;
  const selectedAgentSession = isNewAgentSessionCreating ? null : session;
  const handleLoadEarlierSelectedAgentSessionItems = useCallback(() => {
    const targetAgentSessionId = visibleSessionId?.trim() ?? '';
    const targetProjectId = selectedAgentSession?.projectId.trim() || currentProjectId.trim();
    if (!targetAgentSessionId || !targetProjectId) {
      return Promise.resolve();
    }
    return handleLoadEarlierAgentSessionItems(targetAgentSessionId, targetProjectId);
  }, [
    currentProjectId,
    handleLoadEarlierAgentSessionItems,
    selectedAgentSession?.projectId,
    visibleSessionId,
  ]);
  const isLoadingEarlierSelectedAgentSessionItems = Boolean(
    visibleSessionId &&
    loadingEarlierAgentSessionId === visibleSessionId &&
    loadingEarlierAgentSessionProjectId === selectedAgentSession?.projectId,
  );
  const lastAutoReadSessionVersionRef = useRef('');
  useEffect(() => {
    if (
      !isVisible
      || !selectedAgentSession?.unread
      || !visibleSessionId
      || !selectedAgentSession.projectId
    ) {
      return;
    }
    const readVersion = [
      selectedAgentSession.projectId,
      visibleSessionId,
      selectedAgentSession.lastItemSequence ?? selectedAgentSession.transcriptUpdatedAt ?? '',
    ].join('\u0001');
    if (lastAutoReadSessionVersionRef.current === readVersion) {
      return;
    }
    lastAutoReadSessionVersionRef.current = readVersion;
    void updateAgentSession(
      selectedAgentSession.projectId,
      visibleSessionId,
      { unread: false },
    );
  }, [
    isVisible,
    selectedAgentSession?.lastItemSequence,
    selectedAgentSession?.projectId,
    selectedAgentSession?.transcriptUpdatedAt,
    selectedAgentSession?.unread,
    updateAgentSession,
    visibleSessionId,
  ]);
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
  const [failedAgentSessionItemsLoadId, setFailedAgentSessionItemsLoadId] =
    useState<string | null>(null);
  const handleSelectedAgentSessionItemsLoadFailed = useCallback((agentSessionId: string) => {
    if (agentSessionId === visibleSessionId) {
      setFailedAgentSessionItemsLoadId(agentSessionId);
    }
  }, [visibleSessionId]);
  const handleSelectedAgentSessionItemsLoaded = useCallback((agentSessionId: string) => {
    setFailedAgentSessionItemsLoadId((failedSessionId) =>
      failedSessionId === agentSessionId ? null : failedSessionId,
    );
  }, []);
  const handleRetrySelectedAgentSessionItems = useCallback(() => {
    setSelectionRefreshToken((previousState) => previousState + 1);
  }, [setSelectionRefreshToken]);
  const handleSelectedAgentSessionUnavailable = useCallback((
    unavailableAgentSessionId: string,
    unavailableProjectId: string,
  ) => {
    if (unavailableAgentSessionId !== visibleSessionId) {
      return;
    }
    const fallbackProjectId = unavailableProjectId.trim() || currentProjectId;
    selectProjectWithoutAgentSession(fallbackProjectId || null);
  }, [
    currentProjectId,
    selectProjectWithoutAgentSession,
    visibleSessionId,
  ]);
  const isSelectedAgentSessionItemsLoading = useSelectedAgentSessionItems({
    agentSessionService,
    isActive: isSelectedAgentSessionTranscriptVisible,
    onAgentSessionItemsLoadFailed: handleSelectedAgentSessionItemsLoadFailed,
    onAgentSessionItemsLoaded: handleSelectedAgentSessionItemsLoaded,
    onAgentSessionUnavailable: handleSelectedAgentSessionUnavailable,
    projectService,
    selectionRefreshToken,
    selectedAgentSession,
    selectedAgentSessionId: visibleSessionId,
    selectedProject: selectedAgentSessionLocation?.project ?? currentProject ?? null,
    synchronizeProjectSessions: synchronizeImportedProject,
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
  const hasSelectedAgentSessionItemsLoadError = Boolean(
    visibleSessionId
    && failedAgentSessionItemsLoadId === visibleSessionId
    && selectedAgentSessionItems.length === 0
    && !isSelectedAgentSessionItemsLoading
    && !isNewAgentSessionCreating
  );
  const isSelectedAgentSessionNew =
    !isSelectedAgentSessionHydrating
    && !hasSelectedAgentSessionItemsLoadError
    && selectedAgentSessionItems.length === 0;
  const {
    mainChatEmptyState,
    editorChatEmptyState,
  } = useMemo(
    () => createCodeChatEmptyStates(
      isSelectedAgentSessionHydrating,
      hasSelectedAgentSessionItemsLoadError
        ? {
          description: t('code.sessionMessagesLoadFailedDescription'),
          onRetry: handleRetrySelectedAgentSessionItems,
          retryLabel: t('code.retrySessionMessages'),
          title: t('code.sessionMessagesLoadFailedTitle'),
        }
        : undefined,
    ),
    [
      handleRetrySelectedAgentSessionItems,
      hasSelectedAgentSessionItemsLoadError,
      isSelectedAgentSessionHydrating,
      t,
    ],
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
  const handleDeleteSelectedAgentSessionItem = useCallback((sessionItemIds: string[]) => {
    if (session) {
      void handleDeleteMessage(session.id, currentProjectId, sessionItemIds);
    }
  }, [currentProjectId, handleDeleteMessage, session]);
  const handleRegenerateSelectedAgentSessionItem = useCallback(() => {
    if (session) {
      void handleRegenerateMessage(session.id, currentProjectId);
    }
  }, [currentProjectId, handleRegenerateMessage, session]);
  const handleRestoreSelectedAgentSessionItem = useCallback((
    messageId: string,
    fileChanges?: readonly FileChange[],
  ) => {
    if (session) {
      void handleRestoreMessage(session.id, currentProjectId, messageId, fileChanges);
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
    projectId: currentProject?.projectId,
    projectGitOverviewState,
    projectName: currentProject?.name,
    deleteConfirmation,
    editorChatEmptyState,
    editorExplorerWidth,
    chatWidth: effectiveEditorChatWidth,
    fileContent,
    files,
    projectRootPath: projectRoot?.virtualPath ?? '',
    fileTreeLoadError,
    filteredProjects,
    projects,
    hasMoreProjects,
    hasMoreRemoteMessages: Boolean(selectedAgentSession?.itemPageInfo?.hasMore),
    isChatBusy,
    isChatEngineBusy,
    isEngineBusyCurrentSession: isSelectedSessionEngineBusy,
    isDebugConfigVisible,
    isFindVisible,
    isMountRecoveryActionPending,
    isLoadingMoreProjects,
    isLoadingMoreRemoteMessages: isLoadingEarlierSelectedAgentSessionItems,
    isNewSession: isSelectedAgentSessionNew,
    isQuickOpenVisible,
    isRunConfigVisible,
    isRunTaskVisible,
    isFileTreeLoading,
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
    selectedSessionAgentId: selectedAgentSession?.agentId ?? null,
    selectedSessionTitle: selectedAgentSession?.title,
    selectedSessionEngineId: selectedAgentSession?.engineId,
    selectedSessionModelId: selectedAgentSession?.modelId,
    selectedSessionRuntimeLocationId: selectedAgentSession?.runtimeLocationId,
    selectedSessionRuntimeStatus: selectedAgentSession?.runtimeStatus,
    selectedSessionTranscriptUpdatedAt: selectedAgentSession?.transcriptUpdatedAt,
    selectedSessionUpdatedAt: selectedAgentSession?.updatedAt,
    onSelectedSessionRuntimeStatusChange: (runtimeStatus) => {
      if (selectedAgentSession?.projectId && visibleSessionId) {
        updateAgentSessionRuntimeStatus(
          selectedAgentSession.projectId,
          visibleSessionId,
          runtimeStatus,
        );
      }
    },
    sessionId: visibleSessionId,
    showComposerEngineSelector: true,
    sidebarWidth,
    terminalHeight,
    terminalRequest,
    viewingDiff,
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
    onCopyAgentSessionProviderSessionId: handleCopyProviderSessionId,
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
    onNewSessionProjectSelect: handleNewSessionProjectSelect,
    onNewProject: handleNewProject,
    onLoadMoreProjects: loadMoreProjects,
    onLoadMoreProjectSessions: loadMoreProjectSessions,
    onLoadMoreRemoteMessages: handleLoadEarlierSelectedAgentSessionItems,
    onNotifyNoResults: handleNotifyNoCodeResults,
    onOpenFolder: handleOpenFolder,
    onOpenAgentSessionInTerminal: handleOpenAgentSessionInTerminal,
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
    onRetryFileTreeLoad: refreshFiles,
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
