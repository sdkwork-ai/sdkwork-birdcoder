import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import {
  buildFileChangeRestorePlan,
  getTerminalProfile,
  globalEventBus,
  hydrateImportedProjectFromAuthority,
  resolveLatestCodingSessionIdForProject,
  resolveCodingSessionLocationInProjects,
  resolveProjectIdByCodingSessionId,
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
import { ResizeHandle } from '@sdkwork/birdcoder-ui';
import { UniversalChat } from '@sdkwork/birdcoder-ui/chat';
import type { FileChange } from '@sdkwork/birdcoder-types';
import { normalizeWorkbenchCodeModelId } from '@sdkwork/birdcoder-codeengine';
import { useTranslation } from 'react-i18next';
import { CodeChatEmptyState } from './CodeChatEmptyState';
import { CodeEditorWorkspacePanel } from './CodeEditorWorkspacePanel';
import { CodePageDialogs, type CodeDeleteConfirmation } from './CodePageDialogs';
import { CodeSessionTranscriptLoadingState, getLanguageFromPath } from './CodePageShared';
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

export function CodePage({
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

  // Determine the current project ID based on selected thread, or the prop
  const selectedCodingSessionLocation = resolveCodingSessionLocationInProjects(
    projects,
    selectedCodingSessionId,
  );
  const threadProjectId =
    selectedCodingSessionLocation?.project.id ??
    resolveProjectIdByCodingSessionId(projects, selectedCodingSessionId);
  const normalizedProjectId = projectId?.trim() ?? '';
  const normalizedThreadProjectId = threadProjectId?.trim() ?? '';
  const currentProjectId = normalizedThreadProjectId || normalizedProjectId;
  const currentProject =
    selectedCodingSessionLocation?.project ??
    projects.find((project) => project.id === currentProjectId);
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
      projects.find((project) =>
        project.codingSessions.some(
          (codingSession) => codingSession.id === normalizedCodingSessionId,
        ),
      )?.id?.trim() ||
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
  }, [currentProjectId, notifyProjectChange, projects, selectedCodingSessionId]);
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
      projects.some((project) =>
        project.codingSessions.some((codingSession) => codingSession.id === selectedCodingSessionId),
      );
    if (hasSelectedCodingSession) {
      return;
    }

    if (
      normalizedInitialCodingSessionId !== selectedCodingSessionId &&
      projects.some((project) =>
        project.codingSessions.some(
          (codingSession) => codingSession.id === normalizedInitialCodingSessionId,
        ),
      )
    ) {
      handleSelectCodingSession(normalizedInitialCodingSessionId);
    }
  }, [handleSelectCodingSession, initialCodingSessionId, projects, selectedCodingSessionId]);

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
      !projects.some((project) =>
        project.codingSessions.some((codingSession) => codingSession.id === selectedCodingSessionId),
      )
    ) {
      setSelectedThreadId(null);
    }
  }, [hasFetchedProjects, projects, selectedCodingSessionId]);

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

  const selectFolderAndImportProject = async (fallbackProjectName: string) => {
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
  };

  const activateImportedProject = (projectId: string) => {
    const latestCodingSessionId = resolveLatestCodingSessionIdForProject(projects, projectId);
    if (latestCodingSessionId) {
      handleSelectCodingSession(latestCodingSessionId, { projectId });
      return;
    }

    setSelectedThreadId(null);
    notifyProjectChange(projectId);
  };

  const syncImportedProjectInBackground = (projectId: string) => {
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
  };
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
      projects
        .flatMap((project) => project.codingSessions)
        .find((codingSession) => codingSession.id === codingSessionId)?.title ?? codingSessionId,
    resolveProjectName: (targetProjectId: string) =>
      projects.find((project) => project.id === targetProjectId)?.name ?? targetProjectId,
    restoreSelectionAfterRefresh,
    workspaceId,
  });

  const handleRenameThread = async (threadId: string, newName?: string) => {
    if (newName && newName.trim()) {
      const project = projects.find((candidate) =>
        candidate.codingSessions.some((codingSession) => codingSession.id === threadId),
      );
      if (project) {
        await renameCodingSession(project.id, threadId, newName.trim());
      }
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    setDeleteConfirmation({ type: 'thread', id: threadId });
  };

  const executeDeleteThread = async (threadId: string) => {
    const project = projects.find((candidate) =>
      candidate.codingSessions.some((codingSession) => codingSession.id === threadId),
    );
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
    const project = projects.find(p => p.id === projectId);
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

  const handleNewProject = async () => {
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
  };

  const handleOpenFolder = async () => {
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
  };

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
    const project = projects.find(p => p.id === projectId);
    if (project) {
      await updateProject(projectId, { archived: !project.archived });
      addToast(`${!project.archived ? 'Archived' : 'Unarchived'} project: ${project.name}`, 'info');
    }
  };

  const handleCopyWorkingDirectory = (projectId: string) => {
    const target = resolveProjectActionTarget(projects.find((project) => project.id === projectId));
    if (!target) {
      return;
    }

    navigator.clipboard.writeText(target.projectPath);
    addToast(`Copied workspace directory: ${target.projectPath}`, 'success');
  };

  const handleCopyProjectPath = (projectId: string) => {
    const target = resolveProjectActionTarget(projects.find((project) => project.id === projectId));
    if (!target) {
      return;
    }

    navigator.clipboard.writeText(target.projectPath);
    addToast(`Copied path: ${target.projectPath}`, 'success');
  };

  const handleOpenInTerminal = (projectId: string, profileId?: string) => {
    const target = resolveProjectActionTarget(projects.find((project) => project.id === projectId));
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
    const target = resolveProjectActionTarget(projects.find((project) => project.id === projectId));
    if (!target) {
      return;
    }

    globalEventBus.emit('revealInExplorer', target.projectPath);
  };

  const handlePinThread = async (threadId: string) => {
    const project = projects.find((candidate) =>
      candidate.codingSessions.some((codingSession) => codingSession.id === threadId),
    );
    if (project) {
      const thread = project.codingSessions.find((codingSession) => codingSession.id === threadId);
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
    const project = projects.find((candidate) =>
      candidate.codingSessions.some((codingSession) => codingSession.id === threadId),
    );
    if (project) {
      const thread = project.codingSessions.find((codingSession) => codingSession.id === threadId);
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
    const project = projects.find((candidate) =>
      candidate.codingSessions.some((codingSession) => codingSession.id === threadId),
    );
    if (project) {
      const thread = project.codingSessions.find((codingSession) => codingSession.id === threadId);
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
      projects.find((project) =>
        project.codingSessions.some((codingSession) => codingSession.id === threadId),
      ),
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
    const project = projects.find((candidate) =>
      candidate.codingSessions.some((codingSession) => codingSession.id === threadId),
    );
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
    const project = projects.find((candidate) =>
      candidate.codingSessions.some((codingSession) => codingSession.id === threadId),
    );
    if (project) {
      try {
        const newThread = await forkCodingSession(
          project.id,
          threadId,
          `${project.codingSessions.find((codingSession) => codingSession.id === threadId)?.title} (New Tree)`,
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

  const handleEditMessage = (threadId: string, messageId: string) => {
    const thread = projects
      .flatMap((project) => project.codingSessions)
      .find((codingSession) => codingSession.id === threadId);
    const msg = thread?.messages?.find(m => m.id === messageId);
    if (msg) {
      setInputValue(msg.content);
    }
  };

  const handleDeleteMessage = async (threadId: string, messageId: string) => {
    setDeleteConfirmation({ type: 'message', id: messageId, parentId: threadId });
  };

  const executeDeleteMessage = async (threadId: string, messageId: string) => {
    const project = projects.find((candidate) =>
      candidate.codingSessions.some((codingSession) => codingSession.id === threadId),
    );
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

  const handleRegenerateMessage = async (threadId: string) => {
    const project = projects.find((candidate) =>
      candidate.codingSessions.some((codingSession) => codingSession.id === threadId),
    );
    if (project) {
      const thread = project.codingSessions.find((codingSession) => codingSession.id === threadId);
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
  };

  const handleRestoreMessage = async (threadId: string, messageId: string) => {
    const thread = projects
      .flatMap((project) => project.codingSessions)
      .find((codingSession) => codingSession.id === threadId);
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
  };

  const handleSendMessage = async (text?: string) => {
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
  };
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

  const handleProjectSelect = (id: string | null) => {
    if (id) {
      notifyProjectChange(id);
      const targetProject = projects.find((project) => project.id === id);
      const targetLatestCodingSessionId = resolveLatestCodingSessionIdForProject(projects, id);
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
  };

  const handleCreateRootFile = () => {
    globalEventBus.emit('createRootFile');
  };

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

  return (
    <div className="flex h-full w-full bg-[#0e0e11] text-gray-100 font-sans selection:bg-white/10 selection:text-white">
      {isSidebarVisible && (
        <>
          <Sidebar 
            width={sidebarWidth}
            projects={filteredProjects}
            selectedProjectId={currentProjectId}
            selectedCodingSessionId={selectedCodingSessionId}
            onSelectProject={handleProjectSelect}
            onSelectCodingSession={handleSelectCodingSession}
            onRenameCodingSession={handleRenameThread}
            onDeleteCodingSession={handleDeleteThread}
            onRenameProject={handleRenameProject}
            onDeleteProject={handleDeleteProject}
            onNewProject={handleNewProject}
            onOpenFolder={handleOpenFolder}
            onNewCodingSessionInProject={handleNewThreadInProject}
            onRefreshProjectSessions={handleRefreshProjectSessions}
            onRefreshCodingSessionMessages={handleRefreshCodingSessionMessages}
            onArchiveProject={handleArchiveProject}
            onCopyWorkingDirectory={handleCopyWorkingDirectory}
            onCopyProjectPath={handleCopyProjectPath}
            onOpenInTerminal={handleOpenInTerminal}
            onOpenInFileExplorer={handleOpenInFileExplorer}
            onPinCodingSession={handlePinThread}
            onArchiveCodingSession={handleArchiveThread}
            onMarkCodingSessionUnread={handleMarkThreadUnread}
            onCopyCodingSessionWorkingDirectory={handleCopyThreadWorkingDirectory}
            onCopyCodingSessionSessionId={handleCopyThreadSessionId}
            onCopyCodingSessionDeeplink={handleCopyThreadDeeplink}
            onForkCodingSessionLocal={handleForkThreadLocal}
            onForkCodingSessionNewTree={handleForkThreadNewTree}
            refreshingProjectId={refreshingProjectId}
            refreshingCodingSessionId={refreshingCodingSessionId}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />

          <ResizeHandle 
            direction="horizontal" 
            onResize={handleSidebarResize} 
          />
        </>
      )}

      <div className="flex-1 flex flex-col relative bg-[#0e0e11] shadow-[-4px_0_24px_-4px_rgba(0,0,0,0.5)] overflow-hidden">
        <CodeWorkspaceOverlays
          files={files}
          mountRecoveryState={mountRecoveryState}
          isMountRecoveryActionPending={isMountRecoveryActionPending}
          isFindVisible={isFindVisible}
          isSearchingFiles={isSearchingFiles}
          isQuickOpenVisible={isQuickOpenVisible}
          searchFiles={searchFiles}
          onSelectFile={(path) => {
            setViewingDiff(null);
            selectFile(path);
          }}
          onRetryMountRecovery={() => {
            void handleRetryMountRecovery();
          }}
          onReimportProjectFolder={() => {
            void handleReimportProjectFolder();
          }}
          onCloseFind={() => setIsFindVisible(false)}
          onCloseQuickOpen={() => setIsQuickOpenVisible(false)}
          onNotifyNoResults={() => addToast(t('code.noResultsFound'), 'info')}
        />

        <CodePageDialogs
          isRunConfigVisible={isRunConfigVisible}
          runConfigurationDraft={runConfigurationDraft}
          onRunConfigurationDraftChange={setRunConfigurationDraft}
          onCloseRunConfig={() => setIsRunConfigVisible(false)}
          onSubmitRunConfig={() => {
            void handleSubmitRunConfiguration();
          }}
          isDebugConfigVisible={isDebugConfigVisible}
          onCloseDebugConfig={() => setIsDebugConfigVisible(false)}
          onSaveDebugConfig={handleSaveDebugConfiguration}
          isRunTaskVisible={isRunTaskVisible}
          runConfigurations={runConfigurations}
          onCloseRunTask={() => setIsRunTaskVisible(false)}
          onRunTask={handleRunTaskExecution}
          deleteConfirmation={deleteConfirmation}
          onCancelDelete={() => setDeleteConfirmation(null)}
          onConfirmDelete={handleConfirmDelete}
        />

        <TopBar
          currentProject={currentProject}
          selectedCodingSession={selectedCodingSession}
          selectedEngineId={effectiveSelectedEngineId}
          selectedModelId={effectiveSelectedModelId}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isTerminalOpen={isTerminalOpen}
          setIsTerminalOpen={setIsTerminalOpen}
        />
        
        <div ref={editorWorkspaceHostRef} className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'ai' ? (
            <UniversalChat 
              chatId={selectedCodingSessionId || undefined}
              messages={selectedCodingSession?.messages || []}
              inputValue={inputValue}
              setInputValue={setInputValue}
              onSendMessage={handleSendMessage}
              isSending={isSending}
              selectedEngineId={effectiveSelectedEngineId}
              selectedModelId={effectiveSelectedModelId}
              showEngineHeader={false}
              setSelectedEngineId={handleSelectedEngineChange}
              setSelectedModelId={handleSelectedModelChange}
              layout="main"
              onEditMessage={(msgId) => selectedCodingSession && handleEditMessage(selectedCodingSession.id, msgId)}
              onDeleteMessage={(msgId) => selectedCodingSession && handleDeleteMessage(selectedCodingSession.id, msgId)}
              onRegenerateMessage={() => selectedCodingSession && handleRegenerateMessage(selectedCodingSession.id)}
              onStop={() => setIsSending(false)}
              onViewChanges={(file) => {
                setViewingDiff(file);
                setActiveTab('editor');
              }}
              onRestore={(msgId) => selectedCodingSession && handleRestoreMessage(selectedCodingSession.id, msgId)}
              emptyState={
                isSelectedCodingSessionHydrating
                  ? <CodeSessionTranscriptLoadingState />
                  : <CodeChatEmptyState />
              }
            />
          ) : (
            <CodeEditorWorkspacePanel
              files={files}
              selectedFile={selectedFile}
              currentProjectPath={currentProject?.path}
              viewingDiff={viewingDiff}
              fileContent={fileContent}
              chatWidth={effectiveEditorChatWidth}
              selectedCodingSessionId={selectedCodingSessionId}
              messages={selectedCodingSession?.messages || []}
              chatEmptyState={
                isSelectedCodingSessionHydrating
                  ? <CodeSessionTranscriptLoadingState />
                  : undefined
              }
              inputValue={inputValue}
              isSending={isSending}
              selectedEngineId={effectiveSelectedEngineId}
              selectedModelId={effectiveSelectedModelId}
              onSelectFile={(path) => {
                setViewingDiff(null);
                selectFile(path);
              }}
              onClearSelectedFile={() => selectFile('')}
              onCreateFile={createFile}
              onCreateFolder={createFolder}
              onDeleteFile={deleteFile}
              onDeleteFolder={deleteFolder}
              onRenameNode={renameNode}
              onAcceptDiff={async () => {
                if (!viewingDiff) {
                  return;
                }
                await saveFileContent(viewingDiff.path, viewingDiff.content || '');
                addToast(t('code.appliedChanges', { path: viewingDiff.path }), 'success');
                setViewingDiff(null);
              }}
              onRejectDiff={() => setViewingDiff(null)}
              onFileContentChange={saveFile}
              onChatResize={handleEditorChatResize}
              onInputValueChange={setInputValue}
              onSelectedEngineIdChange={handleSelectedEngineChange}
              onSelectedModelIdChange={handleSelectedModelChange}
              onSendMessage={handleSendMessage}
              onViewChanges={(file) => setViewingDiff(file)}
              onRestoreMessage={(messageId) => {
                if (selectedCodingSession) {
                  void handleRestoreMessage(selectedCodingSession.id, messageId);
                }
              }}
              onEditMessage={(messageId) => {
                if (selectedCodingSession) {
                  handleEditMessage(selectedCodingSession.id, messageId);
                }
              }}
              onDeleteMessage={(messageId) => {
                if (selectedCodingSession) {
                  void handleDeleteMessage(selectedCodingSession.id, messageId);
                }
              }}
              onRegenerateMessage={() => {
                if (selectedCodingSession) {
                  void handleRegenerateMessage(selectedCodingSession.id);
                }
              }}
              onStopSending={() => setIsSending(false)}
              onCreateRootFile={handleCreateRootFile}
              getLanguageFromPath={getLanguageFromPath}
            />
          )}
        </div>

        <CodeTerminalIntegrationPanel
          isOpen={isTerminalOpen}
          height={terminalHeight}
          terminalRequest={terminalRequest}
          workspaceId={workspaceId}
          projectId={currentProjectId}
          onResize={handleTerminalResize}
        />
      </div>
    </div>
  );
}

