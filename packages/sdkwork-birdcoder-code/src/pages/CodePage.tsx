import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildFileChangeRestorePlan,
  buildProjectCodingSessionIndex,
  getTerminalProfile,
  globalEventBus,
  hydrateImportedProjectFromAuthority,
  resolveLatestCodingSessionIdForProject,
  resolveCodingSessionLocationInProjects,
  importLocalFolderProject,
  rebindLocalFolderProject,
  resolveProjectMountRecoverySource,
  useFileSystem,
  useIDEServices,
  useProjects,
  useSelectedCodingSessionMessages,
  useSessionRefreshActions,
  useCodingSessionActions,
  useAuth,
  useToast,
  useWorkbenchChatSelection,
  useWorkbenchPreferences,
} from '@sdkwork/birdcoder-commons/workbench';
import type { TerminalCommandRequest } from '@sdkwork/birdcoder-commons/workbench';
import type { FileChange } from '@sdkwork/birdcoder-types';
import { normalizeWorkbenchCodeModelId } from '@sdkwork/birdcoder-codeengine';
import { UniversalChat } from '@sdkwork/birdcoder-ui/chat';
import { useTranslation } from 'react-i18next';
import { CodeChatEmptyState } from './CodeChatEmptyState';
import { CodeEditorWorkspacePanel } from './CodeEditorWorkspacePanel';
import { CodePageDialogs, type CodeDeleteConfirmation } from './CodePageDialogs';
import { CodeSessionTranscriptLoadingState, getLanguageFromPath } from './CodePageShared';
import { CodePageSurface } from './CodePageSurface';
import { CodeTerminalIntegrationPanel } from './CodeTerminalIntegrationPanel';
import { CodeWorkspaceOverlays } from './CodeWorkspaceOverlays';
import { useCodeEditorChatLayout } from './useCodeEditorChatLayout';
import { useCodeRunEntryActions } from './useCodeRunEntryActions';
import { useCodeWorkbenchCommands } from './useCodeWorkbenchCommands';

interface CodePageProps {
  workspaceId?: string;
  projectId?: string;
  initialCodingSessionId?: string;
  onProjectChange?: (projectId: string) => void;
  onCodingSessionChange?: (codingSessionId: string) => void;
}

function CodePageComponent({
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
  } = useProjects(workspaceId);
  const { coreReadService, projectService } = useIDEServices();
  const { user } = useAuth();

  const { addToast } = useToast();
  const { preferences, updatePreferences } = useWorkbenchPreferences();
  const [selectedCodingSessionId, setSelectedThreadId] = useState<string | null>(null);
  const [selectionRefreshToken, setSelectionRefreshToken] = useState(0);
  const pendingProjectChangeIdRef = useRef<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'ai' | 'editor'>('ai');
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
  });

  const [viewingDiff, setViewingDiff] = useState<FileChange | null>(null);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalRequest, setTerminalRequest] = useState<TerminalCommandRequest>();
  const [terminalHeight, setTerminalHeight] = useState(256);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isFindVisible, setIsFindVisible] = useState(false);
  const [isQuickOpenVisible, setIsQuickOpenVisible] = useState(false);
  const [isRunConfigVisible, setIsRunConfigVisible] = useState(false);
  const [isDebugConfigVisible, setIsDebugConfigVisible] = useState(false);
  const [isRunTaskVisible, setIsRunTaskVisible] = useState(false);
  const [isMountRecoveryActionPending, setIsMountRecoveryActionPending] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<CodeDeleteConfirmation | null>(null);
  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((previousState) => Math.max(200, Math.min(600, previousState + delta)));
  }, []);
  const handleTerminalResize = useCallback((delta: number) => {
    setTerminalHeight((previousState) => Math.max(100, Math.min(800, previousState - delta)));
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
  const resolveProjectById = useCallback(
    (id: string | null | undefined) => {
      const normalizedProjectId = id?.trim() ?? '';
      return normalizedProjectId
        ? projectCodingSessionIndex.projectsById.get(normalizedProjectId) ?? null
        : null;
    },
    [projectCodingSessionIndex],
  );
  const resolveCodingSessionLocation = useCallback(
    (id: string | null | undefined) => {
      const normalizedCodingSessionId = id?.trim() ?? '';
      return normalizedCodingSessionId
        ? projectCodingSessionIndex.codingSessionLocationsById.get(normalizedCodingSessionId) ?? null
        : null;
    },
    [projectCodingSessionIndex],
  );

  // Determine the current project ID based on selected thread, or the prop
  const selectedCodingSessionLocation =
    resolveCodingSessionLocation(selectedCodingSessionId) ??
    resolveCodingSessionLocationInProjects(projects, selectedCodingSessionId);
  const threadProjectId = selectedCodingSessionLocation?.project.id ?? '';
  const normalizedProjectId = projectId?.trim() ?? '';
  const normalizedThreadProjectId = threadProjectId?.trim() ?? '';
  const currentProjectId = normalizedThreadProjectId || normalizedProjectId;
  const currentProject =
    selectedCodingSessionLocation?.project ??
    resolveProjectById(currentProjectId);
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
  const selectedCodingSession = selectedCodingSessionLocation?.codingSession;
  const handleSelectCodingSession = useCallback((
    nextCodingSessionId: string,
    options?: { projectId?: string },
  ) => {
    const normalizedCodingSessionId = nextCodingSessionId.trim();
    if (!normalizedCodingSessionId) {
      return;
    }

    const nextProjectId =
      options?.projectId?.trim() ||
      resolveCodingSessionLocation(normalizedCodingSessionId)?.project.id?.trim() ||
      '';

    if (
      normalizedCodingSessionId === (selectedCodingSessionId?.trim() || '') &&
      nextProjectId === currentProjectId
    ) {
      setSelectionRefreshToken((previousState) => previousState + 1);
      return;
    }

    if (nextProjectId) {
      notifyProjectChange(nextProjectId);
    }

    setSelectedThreadId(normalizedCodingSessionId);
  }, [currentProjectId, notifyProjectChange, resolveCodingSessionLocation, selectedCodingSessionId]);
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
    const normalizedSelectedCodingSessionId = selectedCodingSessionId?.trim() ?? '';

    if (
      normalizedTargetCodingSessionId &&
      normalizedTargetCodingSessionId === normalizedSelectedCodingSessionId &&
      normalizedTargetProjectId === currentProjectId
    ) {
      return;
    }

    if (targetCodingSessionId) {
      handleSelectCodingSession(targetCodingSessionId, {
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
      !normalizedThreadProjectId ||
      !onProjectChange ||
      normalizedThreadProjectId === normalizedProjectId
    ) {
      return;
    }

    if (pendingProjectChangeIdRef.current === normalizedThreadProjectId) {
      pendingProjectChangeIdRef.current = null;
      return;
    }

    onProjectChange(normalizedThreadProjectId);
  }, [normalizedProjectId, normalizedThreadProjectId, onProjectChange]);

  useEffect(() => {
    const normalizedInitialCodingSessionId = initialCodingSessionId?.trim() || '';
    if (!normalizedInitialCodingSessionId) {
      return;
    }

    const hasSelectedCodingSession =
      !!selectedCodingSessionId &&
      !!resolveCodingSessionLocation(selectedCodingSessionId);
    if (hasSelectedCodingSession) {
      return;
    }

    if (
      normalizedInitialCodingSessionId !== selectedCodingSessionId &&
      !!resolveCodingSessionLocation(normalizedInitialCodingSessionId)
    ) {
      handleSelectCodingSession(normalizedInitialCodingSessionId);
    }
  }, [
    handleSelectCodingSession,
    initialCodingSessionId,
    resolveCodingSessionLocation,
    selectedCodingSessionId,
  ]);

  useEffect(() => {
    const nextCodingSessionId = selectedCodingSessionId ?? '';
    const normalizedInitialCodingSessionId = initialCodingSessionId?.trim() || '';
    if (nextCodingSessionId === normalizedInitialCodingSessionId) {
      return;
    }

    onCodingSessionChange?.(nextCodingSessionId);
  }, [initialCodingSessionId, onCodingSessionChange, selectedCodingSessionId]);

  // Clear selectedCodingSessionId if it's no longer in the current projects (e.g., workspace changed)
  useEffect(() => {
    if (!hasFetchedProjects) {
      return;
    }

    if (
      selectedCodingSessionId &&
      !resolveCodingSessionLocation(selectedCodingSessionId)
    ) {
      setSelectedThreadId(null);
    }
  }, [hasFetchedProjects, resolveCodingSessionLocation, selectedCodingSessionId]);

  useCodeWorkbenchCommands({
    projects,
    selectedCodingSessionId,
    currentProjectId,
    currentProjectPath: currentProject?.path,
    defaultWorkingDirectory: preferences.defaultWorkingDirectory,
    createCodingSession: createCodingSessionWithSelection,
    selectCodingSession: handleSelectCodingSession,
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
    selectedFile,
    fileContent,
    isSearchingFiles,
    mountRecoveryState,
    selectFile,
    saveFile,
    saveFileContent,
    createFile,
    createFolder,
    deleteFile,
    deleteFolder,
    renameNode,
    searchFiles,
    mountFolder,
  } = useFileSystem(currentProjectId, currentProject?.path);
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

  useCodingSessionActions(
    currentProjectId,
    createCodingSessionWithSelection,
    handleSelectCodingSession,
  );

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
    const { openLocalFolder } = await import('@sdkwork/birdcoder-commons/platform/fileSystem');
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
      handleSelectCodingSession(latestCodingSessionId, { projectId });
      return;
    }

    setSelectedThreadId(null);
    notifyProjectChange(projectId);
  }, [handleSelectCodingSession, notifyProjectChange, projects]);

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
          handleSelectCodingSession(latestCodingSessionId, { projectId });
        }
      } catch (error) {
        console.error('Failed to refresh imported project sessions', error);
      }
    })();
  }, [handleSelectCodingSession, projectService, projects, user?.id, workspaceId]);
  const {
    handleRefreshCodingSessionMessages,
    handleRefreshProjectSessions,
    refreshingCodingSessionId,
    refreshingProjectId,
  } = useSessionRefreshActions({
    addToast,
    coreReadService,
    getPreservedSelection: () => ({
      codingSessionId: selectedCodingSessionId,
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
      resolveCodingSessionLocation(codingSessionId)?.codingSession.title ?? codingSessionId,
    resolveProjectName: (targetProjectId: string) =>
      resolveProjectById(targetProjectId)?.name ?? targetProjectId,
    restoreSelectionAfterRefresh,
    workspaceId,
  });

  const handleRenameThread = async (threadId: string, newName?: string) => {
    if (newName && newName.trim()) {
      const project = resolveCodingSessionLocation(threadId)?.project;
      if (project) {
        await renameCodingSession(project.id, threadId, newName.trim());
      }
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    setDeleteConfirmation({ type: 'thread', id: threadId });
  };

  const executeDeleteThread = async (threadId: string) => {
    const project = resolveCodingSessionLocation(threadId)?.project;
    if (project) {
      await deleteCodingSession(project.id, threadId);
      if (selectedCodingSessionId === threadId) {
        setSelectedThreadId(null);
      }
      addToast(t('code.threadDeleted'), 'success');
    }
  };

  const handleRenameProject = async (projectId: string, newName?: string) => {
    if (newName && newName.trim()) {
      await renameProject(projectId, newName.trim());
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    setDeleteConfirmation({ type: 'project', id: projectId });
  };

  const executeDeleteProject = async (projectId: string) => {
    await deleteProject(projectId);
    const project = resolveProjectById(projectId);
    if (
      project &&
      project.codingSessions.some((codingSession) => codingSession.id === selectedCodingSessionId)
    ) {
      setSelectedThreadId(null);
    }
    if (currentProjectId === projectId) {
      onProjectChange?.('');
    }
    addToast(t('code.projectRemoved'), 'success');
  };

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

  const handleRetryMountRecovery = async () => {
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
  };

  const handleReimportProjectFolder = async () => {
    if (!currentProjectId) {
      addToast('Select a project before choosing a folder.', 'error');
      return;
    }

    setIsMountRecoveryActionPending(true);
    try {
      const { openLocalFolder } = await import('@sdkwork/birdcoder-commons/platform/fileSystem');
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
  };

  const handleNewThreadInProject = async (projectId: string) => {
    try {
      const newThread = await createCodingSessionWithSelection(projectId, t('app.menu.newThread'));
      handleSelectCodingSession(newThread.id, { projectId });
      addToast(t('code.newThreadCreated'), 'success');
      setTimeout(() => {
        globalEventBus.emit('focusChatInput');
      }, 100);
    } catch (error) {
      console.error("Failed to create thread", error);
      addToast(t('code.failedToCreateThread'), 'error');
    }
  };

  const handleArchiveProject = async (projectId: string) => {
    const project = resolveProjectById(projectId);
    if (project) {
      await updateProject(projectId, { archived: !project.archived });
      addToast(`${!project.archived ? 'Archived' : 'Unarchived'} project: ${project.name}`, 'info');
    }
  };

  const handleCopyWorkingDirectory = (projectId: string) => {
    const target = resolveProjectActionTarget(resolveProjectById(projectId));
    if (!target) {
      return;
    }

    navigator.clipboard.writeText(target.projectPath);
    addToast(`Copied workspace directory: ${target.projectPath}`, 'success');
  };

  const handleCopyProjectPath = (projectId: string) => {
    const target = resolveProjectActionTarget(resolveProjectById(projectId));
    if (!target) {
      return;
    }

    navigator.clipboard.writeText(target.projectPath);
    addToast(`Copied path: ${target.projectPath}`, 'success');
  };

  const handleOpenInTerminal = (projectId: string, profileId?: string) => {
    const target = resolveProjectActionTarget(resolveProjectById(projectId));
    if (!target) {
      return;
    }

    const request = {
      path: target.projectPath,
      profileId: profileId ? getTerminalProfile(profileId).id : undefined,
      timestamp: Date.now(),
    };
    globalEventBus.emit('openTerminal');
    globalEventBus.emit('terminalRequest', request);
    addToast(
      profileId
        ? `Opened ${getTerminalProfile(profileId).title} terminal: ${target.project.name}`
        : `Opened project in terminal: ${target.project.name}`,
      'info',
    );
  };

  const handleOpenInFileExplorer = (projectId: string) => {
    const target = resolveProjectActionTarget(resolveProjectById(projectId));
    if (!target) {
      return;
    }

    globalEventBus.emit('revealInExplorer', target.projectPath);
  };

  const handlePinThread = async (threadId: string) => {
    const resolvedThreadLocation = resolveCodingSessionLocation(threadId);
    const project = resolvedThreadLocation?.project;
    if (project) {
      const thread = resolvedThreadLocation?.codingSession;
      if (thread) {
        await updateCodingSession(project.id, threadId, { pinned: !thread.pinned });
        addToast(
          t(thread.pinned ? 'code.unpinnedThread' : 'code.pinnedThread', {
            name: thread.title,
          }),
          'success',
        );
      }
    }
  };

  const handleArchiveThread = async (threadId: string) => {
    const resolvedThreadLocation = resolveCodingSessionLocation(threadId);
    const project = resolvedThreadLocation?.project;
    if (project) {
      const thread = resolvedThreadLocation?.codingSession;
      if (!thread) {
        return;
      }

      await updateCodingSession(project.id, threadId, { archived: !thread.archived });
      addToast(
        t(thread.archived ? 'code.unarchivedThread' : 'code.archivedThread', { id: threadId }),
        'info',
      );
    }
  };

  const handleMarkThreadUnread = async (threadId: string) => {
    const resolvedThreadLocation = resolveCodingSessionLocation(threadId);
    const project = resolvedThreadLocation?.project;
    if (project) {
      const thread = resolvedThreadLocation?.codingSession;
      if (thread) {
        await updateCodingSession(project.id, threadId, { unread: !thread.unread });
        addToast(
          t(thread.unread ? 'code.markedAsRead' : 'code.markedAsUnread', {
            name: thread.title,
          }),
          'info',
        );
      }
    }
  };

  const handleCopyThreadWorkingDirectory = (threadId: string) => {
    const target = resolveProjectActionTarget(
      resolveCodingSessionLocation(threadId)?.project,
    );
    if (!target) {
      return;
    }

    navigator.clipboard.writeText(target.projectPath);
    addToast(t('code.copiedThreadWorkspaceDir', { path: target.projectPath }), 'success');
  };

  const handleCopyThreadSessionId = (threadId: string) => {
    navigator.clipboard.writeText(threadId);
    addToast(t('code.copiedSessionId', { id: threadId }), 'success');
  };

  const handleCopyThreadDeeplink = (threadId: string) => {
    const link = `${window.location.origin}/thread/${threadId}`;
    navigator.clipboard.writeText(link);
    addToast(t('code.copiedDeeplink', { link }), 'success');
  };

  const handleForkThreadLocal = async (threadId: string) => {
    const resolvedThreadLocation = resolveCodingSessionLocation(threadId);
    const project = resolvedThreadLocation?.project;
    if (project) {
      try {
        const newThread = await forkCodingSession(project.id, threadId);
        handleSelectCodingSession(newThread.id, { projectId: project.id });
        addToast(
          t('code.forkedToLocal', {
            name: newThread.title ?? newThread.id,
          }),
          'success',
        );
      } catch (err) {
        addToast(t('code.failedToForkThread'), 'error');
      }
    }
  };

  const handleForkThreadNewTree = async (threadId: string) => {
    const resolvedThreadLocation = resolveCodingSessionLocation(threadId);
    const project = resolvedThreadLocation?.project;
    if (project) {
      try {
        const newThread = await forkCodingSession(
          project.id,
          threadId,
          `${resolvedThreadLocation?.codingSession.title} (New Tree)`,
        );
        handleSelectCodingSession(newThread.id, { projectId: project.id });
        addToast(
          t('code.forkedToNewWorktree', {
            name: newThread.title ?? newThread.id,
          }),
          'success',
        );
      } catch (err) {
        addToast(t('code.failedToForkThread'), 'error');
      }
    }
  };

  const handleEditMessage = useCallback((threadId: string, messageId: string) => {
    const thread = resolveCodingSessionLocation(threadId)?.codingSession;
    const msg = thread?.messages?.find(m => m.id === messageId);
    if (msg) {
      setInputValue(msg.content);
    }
  }, [resolveCodingSessionLocation]);

  const handleDeleteMessage = useCallback(async (threadId: string, messageId: string) => {
    setDeleteConfirmation({ type: 'message', id: messageId, parentId: threadId });
  }, []);

  const executeDeleteMessage = async (threadId: string, messageId: string) => {
    const project = resolveCodingSessionLocation(threadId)?.project;
    if (project) {
      try {
        await deleteCodingSessionMessage(project.id, threadId, messageId);
        addToast('Message deleted successfully', 'success');
      } catch (error) {
        console.error('Failed to delete coding session message', error);
        addToast('Failed to delete message', 'error');
      }
    }
  };

  const handleRegenerateMessage = useCallback(async (threadId: string) => {
    const resolvedThreadLocation = resolveCodingSessionLocation(threadId);
    const project = resolvedThreadLocation?.project;
    if (project) {
      const thread = resolvedThreadLocation?.codingSession;
      if (thread && thread.messages && thread.messages.length > 0) {
        // Find the last user message
        const lastUserMsgIndex = [...thread.messages].reverse().findIndex(m => m.role === 'user');
        if (lastUserMsgIndex !== -1) {
          const actualIndex = thread.messages.length - 1 - lastUserMsgIndex;
          const lastUserMsg = thread.messages[actualIndex];
          
          // Delete all messages including the last user message
          for (let i = thread.messages.length - 1; i >= actualIndex; i--) {
            await deleteCodingSessionMessage(project.id, threadId, thread.messages[i].id);
          }
          
          // Resend the last user message content
          setIsSending(true);
          try {
            const context = {
              workspaceId,
              projectId: project.id,
              threadId: thread.id,
              currentFile: selectedFile ? {
                path: selectedFile,
                content: fileContent,
                language: getLanguageFromPath(selectedFile)
              } : undefined
            };
            await sendMessage(project.id, threadId, lastUserMsg.content, context);
          } finally {
            setIsSending(false);
          }
        }
      }
    }
  }, [
    deleteCodingSessionMessage,
    fileContent,
    resolveCodingSessionLocation,
    selectedFile,
    sendMessage,
    workspaceId,
  ]);

  const handleRestoreMessage = useCallback(async (threadId: string, messageId: string) => {
    const thread = resolveCodingSessionLocation(threadId)?.codingSession;
    const msg = thread?.messages?.find(m => m.id === messageId);
    const restorePlan = buildFileChangeRestorePlan(msg?.fileChanges);
    if (!restorePlan.restorable) {
      addToast('This checkpoint cannot be safely restored.', 'error');
      return;
    }

    try {
      for (const operation of restorePlan.operations) {
        await saveFileContent(operation.path, operation.content);
      }
      addToast('Restored files to previous state', 'success');
    } catch (error) {
      console.error('Failed to restore files from checkpoint', error);
      addToast('Failed to restore files from checkpoint', 'error');
    }
  }, [addToast, resolveCodingSessionLocation, saveFileContent]);

  const handleSendMessage = useCallback(async (text?: string) => {
    const content = typeof text === 'string' ? text : inputValue;
    const trimmedContent = content.trim();
    if (!trimmedContent || isSending) return;

    let currentThreadId = selectedCodingSessionId;
    let projectIdToUse = currentProjectId;

    if (!currentThreadId) {
      if (!projectIdToUse) {
        if (projects.length === 0) {
          projectIdToUse = await handleNewProject();
          if (!projectIdToUse) {
            return;
          }
        } else {
          projectIdToUse = projects[0].id;
        }
      }
      const newTitle =
        trimmedContent.slice(0, 20) + (trimmedContent.length > 20 ? '...' : '');
      const newThread = await createCodingSessionWithSelection(projectIdToUse, newTitle);
      currentThreadId = newThread.id;
      handleSelectCodingSession(currentThreadId, { projectId: projectIdToUse });
    }

    if (projectIdToUse && currentThreadId) {
      setInputValue('');
      setIsSending(true);
      try {
        const context = {
          workspaceId,
          projectId: projectIdToUse,
          threadId: currentThreadId,
          currentFile: selectedFile ? {
            path: selectedFile,
            content: fileContent,
            language: getLanguageFromPath(selectedFile)
          } : undefined
        };
        await sendMessage(projectIdToUse, currentThreadId, trimmedContent, context);
      } finally {
        setIsSending(false);
      }
    }
  }, [
    createCodingSessionWithSelection,
    currentProjectId,
    fileContent,
    handleNewProject,
    handleSelectCodingSession,
    inputValue,
    isSending,
    projects,
    selectedCodingSessionId,
    selectedFile,
    sendMessage,
    workspaceId,
  ]);
  const effectiveSelectedEngineId =
    selectedCodingSession?.engineId ?? selectedEngineId;
  const effectiveSelectedModelId =
    selectedCodingSession?.modelId ?? selectedModelId;
  const handleSelectedEngineChange = useCallback(
    async (engineId: string) => {
      setSelectedEngineId(engineId);

      if (!currentProjectId || !selectedCodingSessionId) {
        return;
      }

      const nextModelId = normalizeWorkbenchCodeModelId(
        engineId,
        selectedCodingSession?.modelId ?? selectedModelId,
        preferences,
      );
      await updateCodingSession(currentProjectId, selectedCodingSessionId, {
        engineId,
        modelId: nextModelId,
      });
    },
    [
      currentProjectId,
      preferences,
      selectedCodingSession?.modelId,
      selectedCodingSessionId,
      selectedModelId,
      setSelectedEngineId,
      updateCodingSession,
    ],
  );
  const handleSelectedModelChange = useCallback(
    async (modelId: string, engineId?: string) => {
      setSelectedModelId(modelId);

      if (!currentProjectId || !selectedCodingSessionId) {
        return;
      }

      const nextEngineId =
        engineId ?? selectedCodingSession?.engineId ?? selectedEngineId;
      await updateCodingSession(currentProjectId, selectedCodingSessionId, {
        engineId: nextEngineId,
        modelId,
      });
    },
    [
      currentProjectId,
      selectedCodingSession?.engineId,
      selectedCodingSessionId,
      selectedEngineId,
      setSelectedModelId,
      updateCodingSession,
    ],
  );

  const isSelectedCodingSessionMessagesLoading = useSelectedCodingSessionMessages({
    coreReadService,
    projectService,
    selectionRefreshToken,
    selectedCodingSession,
    selectedCodingSessionId,
    selectedProject: selectedCodingSessionLocation?.project ?? null,
    workspaceId,
  });
  const isSelectedCodingSessionHydrating = Boolean(
    selectedCodingSessionId &&
    isSelectedCodingSessionMessagesLoading &&
    selectedCodingSession?.messages.length === 0
  );
  const selectedCodingSessionMessages = useMemo(
    () => selectedCodingSession?.messages ?? [],
    [selectedCodingSession?.messages],
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
        projectCodingSessionIndex.latestCodingSessionIdByProjectId.get(id) ??
        resolveLatestCodingSessionIdForProject(projects, id);
      const threadBelongsToProject =
        !!selectedCodingSessionId &&
        !!targetProject?.codingSessions.some(
          (codingSession) => codingSession.id === selectedCodingSessionId,
        );

      if (threadBelongsToProject) {
        return;
      }

      if (targetLatestCodingSessionId) {
        handleSelectCodingSession(targetLatestCodingSessionId, { projectId: id });
        return;
      }

      setSelectedThreadId(null);
    }
  }, [
    handleSelectCodingSession,
    notifyProjectChange,
    projectCodingSessionIndex.latestCodingSessionIdByProjectId,
    projects,
    resolveProjectById,
    selectedCodingSessionId,
  ]);

  const handleCreateRootFile = useCallback(() => {
    globalEventBus.emit('createRootFile');
  }, []);
  const handleStopSending = useCallback(() => {
    setIsSending(false);
  }, []);
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
  const handleClearSelectedWorkspaceFile = useCallback(() => {
    selectFile('');
  }, [selectFile]);
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
    if (selectedCodingSession) {
      handleEditMessage(selectedCodingSession.id, messageId);
    }
  }, [handleEditMessage, selectedCodingSession]);
  const handleDeleteSelectedCodingSessionMessage = useCallback((messageId: string) => {
    if (selectedCodingSession) {
      void handleDeleteMessage(selectedCodingSession.id, messageId);
    }
  }, [handleDeleteMessage, selectedCodingSession]);
  const handleRegenerateSelectedCodingSessionMessage = useCallback(() => {
    if (selectedCodingSession) {
      void handleRegenerateMessage(selectedCodingSession.id);
    }
  }, [handleRegenerateMessage, selectedCodingSession]);
  const handleRestoreSelectedCodingSessionMessage = useCallback((messageId: string) => {
    if (selectedCodingSession) {
      void handleRestoreMessage(selectedCodingSession.id, messageId);
    }
  }, [handleRestoreMessage, selectedCodingSession]);

  const handleConfirmDelete = () => {
    if (deleteConfirmation?.type === 'thread') {
      void executeDeleteThread(deleteConfirmation.id);
    } else if (deleteConfirmation?.type === 'project') {
      void executeDeleteProject(deleteConfirmation.id);
    } else if (deleteConfirmation?.type === 'message' && deleteConfirmation.parentId) {
      void executeDeleteMessage(deleteConfirmation.parentId, deleteConfirmation.id);
    }
    setDeleteConfirmation(null);
  };

  const sidebarProps = {
    width: sidebarWidth,
    projects: filteredProjects,
    selectedProjectId: currentProjectId,
    selectedCodingSessionId,
    onSelectProject: handleProjectSelect,
    onSelectCodingSession: handleSelectCodingSession,
    onRenameCodingSession: handleRenameThread,
    onDeleteCodingSession: handleDeleteThread,
    onRenameProject: handleRenameProject,
    onDeleteProject: handleDeleteProject,
    onNewProject: handleNewProject,
    onOpenFolder: handleOpenFolder,
    onNewCodingSessionInProject: handleNewThreadInProject,
    onRefreshProjectSessions: handleRefreshProjectSessions,
    onRefreshCodingSessionMessages: handleRefreshCodingSessionMessages,
    onArchiveProject: handleArchiveProject,
    onCopyWorkingDirectory: handleCopyWorkingDirectory,
    onCopyProjectPath: handleCopyProjectPath,
    onOpenInTerminal: handleOpenInTerminal,
    onOpenInFileExplorer: handleOpenInFileExplorer,
    onPinCodingSession: handlePinThread,
    onArchiveCodingSession: handleArchiveThread,
    onMarkCodingSessionUnread: handleMarkThreadUnread,
    onCopyCodingSessionWorkingDirectory: handleCopyThreadWorkingDirectory,
    onCopyCodingSessionSessionId: handleCopyThreadSessionId,
    onCopyCodingSessionDeeplink: handleCopyThreadDeeplink,
    onForkCodingSessionLocal: handleForkThreadLocal,
    onForkCodingSessionNewTree: handleForkThreadNewTree,
    refreshingProjectId,
    refreshingCodingSessionId,
    searchQuery,
    setSearchQuery,
  };
  const overlayProps = {
    files,
    mountRecoveryState,
    isMountRecoveryActionPending,
    isFindVisible,
    isSearchingFiles,
    isQuickOpenVisible,
    searchFiles,
    onSelectFile: handleSelectWorkspaceFile,
    onRetryMountRecovery: () => {
      void handleRetryMountRecovery();
    },
    onReimportProjectFolder: () => {
      void handleReimportProjectFolder();
    },
    onCloseFind: () => setIsFindVisible(false),
    onCloseQuickOpen: () => setIsQuickOpenVisible(false),
    onNotifyNoResults: () => addToast(t('code.noResultsFound'), 'info'),
  };
  const dialogProps = {
    isRunConfigVisible,
    runConfigurationDraft,
    onRunConfigurationDraftChange: setRunConfigurationDraft,
    onCloseRunConfig: () => setIsRunConfigVisible(false),
    onSubmitRunConfig: () => {
      void handleSubmitRunConfiguration();
    },
    isDebugConfigVisible,
    onCloseDebugConfig: () => setIsDebugConfigVisible(false),
    onSaveDebugConfig: handleSaveDebugConfiguration,
    isRunTaskVisible,
    runConfigurations,
    onCloseRunTask: () => setIsRunTaskVisible(false),
    onRunTask: handleRunTaskExecution,
    deleteConfirmation,
    onCancelDelete: () => setDeleteConfirmation(null),
    onConfirmDelete: handleConfirmDelete,
  };
  const topBarProps = {
    currentProject,
    selectedCodingSession,
    selectedEngineId: effectiveSelectedEngineId,
    selectedModelId: effectiveSelectedModelId,
    activeTab,
    setActiveTab,
    isTerminalOpen,
    setIsTerminalOpen,
  };
  const mainChatProps = {
    chatId: selectedCodingSessionId || undefined,
    messages: selectedCodingSessionMessages,
    inputValue,
    setInputValue,
    onSendMessage: handleSendMessage,
    isSending,
    selectedEngineId: effectiveSelectedEngineId,
    selectedModelId: effectiveSelectedModelId,
    showEngineHeader: false,
    setSelectedEngineId: handleSelectedEngineChange,
    setSelectedModelId: handleSelectedModelChange,
    layout: 'main' as const,
    onEditMessage: handleEditSelectedCodingSessionMessage,
    onDeleteMessage: handleDeleteSelectedCodingSessionMessage,
    onRegenerateMessage: handleRegenerateSelectedCodingSessionMessage,
    onStop: handleStopSending,
    onViewChanges: handleViewChangesAndOpenEditor,
    onRestore: handleRestoreSelectedCodingSessionMessage,
    emptyState: mainChatEmptyState,
  };
  const workspaceProps = {
    files,
    selectedFile,
    currentProjectPath: currentProject?.path,
    viewingDiff,
    fileContent,
    chatWidth: effectiveEditorChatWidth,
    selectedCodingSessionId,
    messages: selectedCodingSessionMessages,
    chatEmptyState: editorChatEmptyState,
    inputValue,
    isSending,
    selectedEngineId: effectiveSelectedEngineId,
    selectedModelId: effectiveSelectedModelId,
    onSelectFile: handleSelectWorkspaceFile,
    onClearSelectedFile: handleClearSelectedWorkspaceFile,
    onCreateFile: createFile,
    onCreateFolder: createFolder,
    onDeleteFile: deleteFile,
    onDeleteFolder: deleteFolder,
    onRenameNode: renameNode,
    onAcceptDiff: handleAcceptViewingDiff,
    onRejectDiff: handleRejectViewingDiff,
    onFileContentChange: saveFile,
    onChatResize: handleEditorChatResize,
    onInputValueChange: setInputValue,
    onSelectedEngineIdChange: handleSelectedEngineChange,
    onSelectedModelIdChange: handleSelectedModelChange,
    onSendMessage: handleSendMessage,
    onViewChanges: handleViewChanges,
    onRestoreMessage: handleRestoreSelectedCodingSessionMessage,
    onEditMessage: handleEditSelectedCodingSessionMessage,
    onDeleteMessage: handleDeleteSelectedCodingSessionMessage,
    onRegenerateMessage: handleRegenerateSelectedCodingSessionMessage,
    onStopSending: handleStopSending,
    onCreateRootFile: handleCreateRootFile,
    getLanguageFromPath,
  };
  const terminalProps = {
    isOpen: isTerminalOpen,
    height: terminalHeight,
    terminalRequest,
    workspaceId,
    projectId: currentProjectId,
    onResize: handleTerminalResize,
  };

  return (
    <CodePageSurface
      activeTab={activeTab}
      dialogProps={dialogProps}
      editorWorkspaceHostRef={editorWorkspaceHostRef}
      isSidebarVisible={isSidebarVisible}
      mainChatProps={mainChatProps}
      onSidebarResize={handleSidebarResize}
      overlayProps={overlayProps}
      sidebarProps={sidebarProps}
      terminalProps={terminalProps}
      topBarProps={topBarProps}
      workspaceProps={workspaceProps}
    />
  );
}

export const CodePage = memo(CodePageComponent);
CodePage.displayName = 'CodePage';

