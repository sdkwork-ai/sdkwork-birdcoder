import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  buildFileChangeRestorePlan,
  buildTerminalProfileBlockedMessage,
  getDefaultRunConfigurations,
  globalEventBus,
  importLocalFolderProject,
  rebindLocalFolderProject,
  resolveProjectMountRecoverySource,
  resolveRunConfigurationTerminalLaunch,
  useFileSystem,
  useIDEServices,
  useProjectRunConfigurations,
  useProjects,
  useSessionRefreshActions,
  useCodingSessionActions,
  useToast,
  useWorkbenchPreferences,
  ensureStoredNativeSessionMirror,
} from '@sdkwork/birdcoder-commons/workbench';
import type {
  RunConfigurationRecord,
  TerminalCommandRequest,
} from '@sdkwork/birdcoder-commons/workbench';
import { FileChange } from '@sdkwork/birdcoder-types';
import { useTranslation } from 'react-i18next';
import {
  resolveStudioBuildExecutionLaunch,
} from '../build/runtime';
import {
  resolveStudioBuildProfile,
} from '../build/profiles';
import {
  saveStoredStudioBuildExecutionEvidence,
} from '../build/evidenceStore';
import {
  resolveStudioPreviewExecutionLaunch,
  resolveStudioPreviewUrl,
} from '../preview/runtime';
import { saveStoredStudioPreviewExecutionEvidence } from '../preview/evidenceStore';
import { StudioPreviewPanel } from '../preview/StudioPreviewPanel';
import { StudioStageHeader } from '../preview/StudioStageHeader';
import {
  resolveStudioSimulatorExecutionLaunch,
} from '../simulator/runtime';
import { saveStoredStudioSimulatorExecutionEvidence } from '../simulator/evidenceStore';
import { StudioSimulatorPanel } from '../simulator/StudioSimulatorPanel';
import {
  resolveStudioTestExecutionLaunch,
} from '../test/runtime';
import { saveStoredStudioTestExecutionEvidence } from '../test/evidenceStore';
import { StudioCodeWorkspacePanel } from './StudioCodeWorkspacePanel';
import {
  StudioPageDialogs,
  type StudioAnalyzeReport,
  type StudioDeleteConfirmation,
} from './StudioPageDialogs';
import { StudioChatSidebar } from './StudioChatSidebar';
import { StudioTerminalIntegrationPanel } from './StudioTerminalIntegrationPanel';
import { StudioWorkspaceOverlays } from './StudioWorkspaceOverlays';
import { useStudioChatSelection } from './useStudioChatSelection';
import { useStudioCollaboration } from './useStudioCollaboration';
import {
  resolveHostStudioPreviewSession,
  resolveHostStudioSimulatorSession,
} from '../../../sdkwork-birdcoder-host-studio/src/index.ts';
interface StudioPageProps {
  workspaceId?: string;
  projectId?: string;
  initialCodingSessionId?: string;
  onProjectChange?: (projectId: string) => void;
  onCodingSessionChange?: (codingSessionId: string) => void;
  onSessionInventoryRefresh?: () => Promise<void>;
}
export function StudioPage({
  workspaceId,
  projectId,
  initialCodingSessionId,
  onProjectChange,
  onCodingSessionChange,
  onSessionInventoryRefresh,
}: StudioPageProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'preview' | 'simulator' | 'code'>('preview');
  const [inputValue, setInputValue] = useState('');
  const { preferences, updatePreferences } = useWorkbenchPreferences();
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
      getProjects: () =>
        normalizedWorkspaceId
          ? projectService.getProjects(normalizedWorkspaceId)
          : Promise.resolve([]),
      mountFolder,
      updateProject,
    });
  };
  const {
    projects: filteredProjects,
    searchQuery: projectSearchQuery,
    setSearchQuery: setProjectSearchQuery,
    sendMessage,
    createProject,
    createCodingSession,
    updateProject,
    addCodingSessionMessage,
    editCodingSessionMessage,
    deleteCodingSessionMessage,
    refreshProjects,
  } = useProjects(workspaceId);
  const { collaborationService, coreReadService, projectService } = useIDEServices();
  const { addToast } = useToast();
  const [selectedCodingSessionId, setSelectedThreadId] = useState<string>('');
  const [menuActiveProjectId, setMenuActiveProjectId] = useState<string>('');
  const [viewingDiff, setViewingDiff] = useState<FileChange | null>(null);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(256);
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
  const [previewKey, setPreviewKey] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('about:blank');
  const threadProjectId = filteredProjects.find((project) =>
    project.codingSessions.some((codingSession) => codingSession.id === selectedCodingSessionId),
  )?.id;
  const normalizedProjectId = projectId?.trim() ?? '';
  const normalizedThreadProjectId = threadProjectId?.trim() ?? '';
  const currentProjectId = normalizedProjectId || normalizedThreadProjectId;
  const { runConfigurations, saveRunConfiguration } = useProjectRunConfigurations(currentProjectId || null);
  const {
    createCodingSessionWithSelection,
    selectedEngineId,
    selectedModelId,
    setSelectedEngineId,
    setSelectedModelId,
  } = useStudioChatSelection({
    addToast,
    createCodingSession,
    preferences,
    updatePreferences,
  });

  useEffect(() => {
    const unsubscribe = globalEventBus.on('toggleSidebar', handleToggleSidebar);
    return () => {
      unsubscribe();
    };
  }, [handleToggleSidebar]);

  useEffect(() => {
    const handleOpenTerminal = (path?: string, command?: string) => {
      setIsTerminalOpen(true);
      setTerminalRequest({ path, command, timestamp: Date.now() });
    };
    const handleCloseTerminal = () => {
      setIsTerminalOpen(false);
    };
    const handleToggleTerminal = () => {
      setIsTerminalOpen(prev => !prev);
    };
    const handleSplitTerminal = () => {
      addToast(t('terminal.splitTerminalNotSupported'), 'info');
    };
    const handleTerminalRequest = (req: TerminalCommandRequest) => {
      setTerminalRequest(req);
      setIsTerminalOpen(true);
    };
    const handleSaveActiveFile = () => {
      // The file is auto-saved on change, but we can show a toast
      addToast(t('studio.fileSaved'), 'success');
    };
    const handleSaveAllFiles = () => {
      addToast(t('studio.allFilesSaved'), 'success');
    };
    const handlePreviousCodingSession = () => {
      if (!selectedCodingSessionId) return;
      const allThreads = filteredProjects.flatMap((project) => project.codingSessions);
      const currentIndex = allThreads.findIndex(t => t.id === selectedCodingSessionId);
      if (currentIndex > 0) {
        setSelectedThreadId(allThreads[currentIndex - 1].id);
      }
    };
    const handleNextCodingSession = () => {
      if (!selectedCodingSessionId) return;
      const allThreads = filteredProjects.flatMap((project) => project.codingSessions);
      const currentIndex = allThreads.findIndex(t => t.id === selectedCodingSessionId);
      if (currentIndex !== -1 && currentIndex < allThreads.length - 1) {
        setSelectedThreadId(allThreads[currentIndex + 1].id);
      }
    };
    const handleRevealInExplorer = async (path: string) => {
      try {
        if (window.__TAURI__) {
          const { open } = await import('@tauri-apps/plugin-shell');
          await open(path);
        } else {
          addToast(t('studio.revealedInExplorer', { path }), 'info');
        }
      } catch (e) {
        console.error('Failed to reveal in explorer', e);
        addToast(t('studio.revealedInExplorer', { path }), 'info');
      }
    };
    const handleCreateNewCodingSession = async () => {
      if (currentProjectId) {
        try {
          const newThread = await createCodingSessionWithSelection(
            currentProjectId,
            t('studio.newThread'),
          );
          setSelectedThreadId(newThread.id);
          addToast(t('studio.newThreadCreated'), 'success');
        } catch (error) {
          console.error("Failed to create thread", error);
          addToast(t('studio.failedToCreateThread'), 'error');
        }
      } else {
        addToast(t('studio.pleaseSelectProject'), 'error');
      }
    };
    const handleRunTask = () => {
      setIsRunTaskVisible(true);
    };
    const handleStartDebugging = () => {
      setIsDebugConfigVisible(true);
    };
    const handleRunWithoutDebugging = () => {
      const configuration =
        runConfigurations.find((entry) => entry.group === 'dev') ??
        runConfigurations[0] ??
        getDefaultRunConfigurations()[0];
      void (async () => {
        const launch = await resolveRunConfigurationTerminalLaunch(configuration, {
          projectDirectory: resolveCurrentProjectDirectory(),
          workspaceDirectory: preferences.defaultWorkingDirectory,
        });

        if (!launch.request) {
          addToast(
            buildTerminalProfileBlockedMessage(configuration.profileId, {
              launchState: launch.launchPresentation,
              blockedAction: launch.blockedAction,
            }) ?? 'Blocked terminal profile.',
            'error',
          );
          if (launch.blockedAction.actionId === 'open-settings') {
            globalEventBus.emit('openSettings');
          }
          return;
        }

        globalEventBus.emit('openTerminal');
        globalEventBus.emit('terminalRequest', launch.request);
        addToast(t('studio.startingApplication'), 'info');
      })();
    };
    const handleAddRunConfiguration = () => {
      setIsRunConfigVisible(true);
    };
    const handleToggleDiffPanel = () => {
      setViewingDiff(prev => {
        if (prev) return null;
        addToast(t('studio.noActiveDiff'), 'info');
        return null;
      });
    };
    const handleFindInFiles = () => {
      setIsFindVisible(true);
    };
    const handleOpenQuickOpen = () => {
      setIsQuickOpenVisible(true);
    };
    
    globalEventBus.on('openTerminal', handleOpenTerminal);
    globalEventBus.on('closeTerminal', handleCloseTerminal);
    globalEventBus.on('toggleTerminal', handleToggleTerminal);
    globalEventBus.on('splitTerminal', handleSplitTerminal);
    globalEventBus.on('terminalRequest', handleTerminalRequest);
    globalEventBus.on('saveActiveFile', handleSaveActiveFile);
    globalEventBus.on('saveAllFiles', handleSaveAllFiles);
    globalEventBus.on('previousCodingSession', handlePreviousCodingSession);
    globalEventBus.on('nextCodingSession', handleNextCodingSession);
    globalEventBus.on('revealInExplorer', handleRevealInExplorer);
    globalEventBus.on('createNewCodingSession', handleCreateNewCodingSession);
    globalEventBus.on('runTask', handleRunTask);
    globalEventBus.on('startDebugging', handleStartDebugging);
    globalEventBus.on('runWithoutDebugging', handleRunWithoutDebugging);
    globalEventBus.on('addRunConfiguration', handleAddRunConfiguration);
    globalEventBus.on('toggleDiffPanel', handleToggleDiffPanel);
    globalEventBus.on('findInFiles', handleFindInFiles);
    globalEventBus.on('openQuickOpen', handleOpenQuickOpen);
    
    return () => {
      globalEventBus.off('openTerminal', handleOpenTerminal);
      globalEventBus.off('closeTerminal', handleCloseTerminal);
      globalEventBus.off('toggleTerminal', handleToggleTerminal);
      globalEventBus.off('splitTerminal', handleSplitTerminal);
      globalEventBus.off('terminalRequest', handleTerminalRequest);
      globalEventBus.off('saveActiveFile', handleSaveActiveFile);
      globalEventBus.off('saveAllFiles', handleSaveAllFiles);
      globalEventBus.off('previousCodingSession', handlePreviousCodingSession);
      globalEventBus.off('nextCodingSession', handleNextCodingSession);
      globalEventBus.off('revealInExplorer', handleRevealInExplorer);
      globalEventBus.off('createNewCodingSession', handleCreateNewCodingSession);
      globalEventBus.off('runTask', handleRunTask);
      globalEventBus.off('startDebugging', handleStartDebugging);
      globalEventBus.off('runWithoutDebugging', handleRunWithoutDebugging);
      globalEventBus.off('addRunConfiguration', handleAddRunConfiguration);
      globalEventBus.off('toggleDiffPanel', handleToggleDiffPanel);
      globalEventBus.off('findInFiles', handleFindInFiles);
      globalEventBus.off('openQuickOpen', handleOpenQuickOpen);
    };
  }, [
    selectedCodingSessionId,
    filteredProjects,
    currentProjectId,
    createCodingSessionWithSelection,
    addToast,
    preferences.defaultWorkingDirectory,
    runConfigurations,
  ]);
  
  const [chatWidth, setChatWidth] = useState(450);
  const [deleteConfirmation, setDeleteConfirmation] = useState<StudioDeleteConfirmation | null>(null);

  useEffect(() => {
    if (!normalizedThreadProjectId || normalizedProjectId || !onProjectChange) {
      return;
    }

    onProjectChange(normalizedThreadProjectId);
  }, [normalizedProjectId, normalizedThreadProjectId, onProjectChange]);

  useEffect(() => {
    const normalizedInitialCodingSessionId = initialCodingSessionId?.trim() || '';
    if (!normalizedInitialCodingSessionId) {
      return;
    }

    if (
      normalizedInitialCodingSessionId !== selectedCodingSessionId &&
      filteredProjects.some((project) =>
        project.codingSessions.some(
          (codingSession) => codingSession.id === normalizedInitialCodingSessionId,
        ),
      )
    ) {
      setSelectedThreadId(normalizedInitialCodingSessionId);
    }
  }, [filteredProjects, initialCodingSessionId, selectedCodingSessionId]);

  useEffect(() => {
    onCodingSessionChange?.(selectedCodingSessionId);
  }, [onCodingSessionChange, selectedCodingSessionId]);

  useEffect(() => {
    if (filteredProjects.length > 0) {
      if (!menuActiveProjectId || !filteredProjects.find(p => p.id === menuActiveProjectId)) {
        setMenuActiveProjectId(filteredProjects[0].id);
      }
      if (currentProjectId && !filteredProjects.find(p => p.id === currentProjectId)) {
        if (onProjectChange) {
          onProjectChange('');
        }
        setSelectedThreadId('');
      } else if (
        selectedCodingSessionId &&
        !filteredProjects.some((project) =>
          project.codingSessions.some((codingSession) => codingSession.id === selectedCodingSessionId),
        )
      ) {
        setSelectedThreadId('');
      }
    } else {
      setMenuActiveProjectId('');
      if (currentProjectId && onProjectChange) {
        onProjectChange('');
      }
      setSelectedThreadId('');
    }
  }, [filteredProjects, menuActiveProjectId, currentProjectId, selectedCodingSessionId, onProjectChange]);

  const [isSending, setIsSending] = useState(false);

  const currentThread = filteredProjects
    .find((project) => project.id === currentProjectId)
    ?.codingSessions.find((codingSession) => codingSession.id === selectedCodingSessionId);
  const messages = currentThread?.messages || [];
  const currentProject = filteredProjects.find((project) => project.id === currentProjectId);
  const resolveCurrentProjectDirectory = () => {
    const normalizedProjectPath = currentProject?.path?.trim() ?? '';
    return normalizedProjectPath.length > 0
      ? normalizedProjectPath
      : preferences.defaultWorkingDirectory;
  };
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
    targetCodingSessionId: string,
  ) => {
    if (targetProjectId) {
      onProjectChange?.(targetProjectId);
      setMenuActiveProjectId(targetProjectId);
    }
    if (targetCodingSessionId) {
      setSelectedThreadId(targetCodingSessionId);
    }
  };

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
    setSelectedThreadId,
  );

  const syncNativeSessionsForWorkspace = async () => {
    const normalizedWorkspaceId = workspaceId?.trim() ?? '';
    if (!normalizedWorkspaceId) {
      return;
    }

    try {
      await ensureStoredNativeSessionMirror({
        coreReadService,
        projectService,
        workspaceId: normalizedWorkspaceId,
      });
      await Promise.all([refreshProjects(), onSessionInventoryRefresh?.()]);
    } catch (error) {
      console.error('Failed to synchronize imported native engine sessions', error);
    }
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
      failedToRefreshProjectSessions: t('studio.failedToRefreshProjectSessions'),
      failedToRefreshSessionMessages: t('studio.failedToRefreshSessionMessages'),
      projectSessionsRefreshed: (projectName: string) =>
        t('studio.projectSessionsRefreshed', { name: projectName }),
      sessionMessagesRefreshed: (codingSessionTitle: string) =>
        t('studio.sessionMessagesRefreshed', { name: codingSessionTitle }),
    },
    onSessionInventoryRefresh,
    projectService,
    refreshProjects,
    resolveCodingSessionTitle: (codingSessionId: string) =>
      filteredProjects
        .flatMap((project) => project.codingSessions)
        .find((codingSession) => codingSession.id === codingSessionId)?.title ?? codingSessionId,
    resolveProjectName: (targetProjectId: string) =>
      filteredProjects.find((project) => project.id === targetProjectId)?.name ?? targetProjectId,
    restoreSelectionAfterRefresh,
    workspaceId,
  });

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

  const dispatchRunConfiguration = async (configuration: RunConfigurationRecord) => {
    const launch = await resolveRunConfigurationTerminalLaunch(configuration, {
      projectDirectory: resolveCurrentProjectDirectory(),
      workspaceDirectory: preferences.defaultWorkingDirectory,
    });

    if (!launch.request) {
      addToast(
        buildTerminalProfileBlockedMessage(configuration.profileId, {
          launchState: launch.launchPresentation,
          blockedAction: launch.blockedAction,
        }) ?? 'Blocked terminal profile.',
        'error',
      );
      if (launch.blockedAction.actionId === 'open-settings') {
        globalEventBus.emit('openSettings');
      }
      return;
    }

    globalEventBus.emit('openTerminal');
    globalEventBus.emit('terminalRequest', launch.request);
  };

  const dispatchBuildRunConfiguration = async (configuration: RunConfigurationRecord) => {
    const buildProfile = resolveStudioBuildProfile({
      platform: previewPlatform,
      webDevice: previewWebDevice,
      miniProgramPlatform: previewMpPlatform,
      appPlatform: previewAppPlatform,
    });
    const launch = await resolveStudioBuildExecutionLaunch(buildProfile, configuration, {
      projectId: currentProjectId || null,
      runConfigurationId: configuration.id,
      projectDirectory: resolveCurrentProjectDirectory(),
      workspaceDirectory: preferences.defaultWorkingDirectory,
      timestamp: Date.now(),
    });

    if (!launch.request) {
      addToast(
        buildTerminalProfileBlockedMessage(configuration.profileId, {
          launchState: launch.launchPresentation,
          blockedAction: launch.blockedAction,
        }) ?? 'Blocked terminal profile.',
        'error',
      );
      if (launch.blockedAction.actionId === 'open-settings') {
        globalEventBus.emit('openSettings');
      }
      return;
    }

    globalEventBus.emit('openTerminal');
    globalEventBus.emit('terminalRequest', launch.request.terminalRequest);

    try {
      await saveStoredStudioBuildExecutionEvidence(launch.request.evidence);
    } catch (error) {
      console.error('Failed to persist build execution evidence', error);
    }

    addToast(t('studio.runningBuildTask'), 'info');
  };

  const dispatchTestRunConfiguration = async (configuration: RunConfigurationRecord) => {
    const launch = await resolveStudioTestExecutionLaunch(configuration, {
      projectId: currentProjectId || null,
      runConfigurationId: configuration.id,
      projectDirectory: resolveCurrentProjectDirectory(),
      workspaceDirectory: preferences.defaultWorkingDirectory,
      timestamp: Date.now(),
    });

    if (!launch.request) {
      addToast(
        buildTerminalProfileBlockedMessage(configuration.profileId, {
          launchState: launch.launchPresentation,
          blockedAction: launch.blockedAction,
        }) ?? 'Blocked terminal profile.',
        'error',
      );
      if (launch.blockedAction.actionId === 'open-settings') {
        globalEventBus.emit('openSettings');
      }
      return;
    }

    globalEventBus.emit('openTerminal');
    globalEventBus.emit('terminalRequest', launch.request.terminalRequest);

    try {
      await saveStoredStudioTestExecutionEvidence(launch.request.evidence);
    } catch (error) {
      console.error('Failed to persist test execution evidence', error);
    }

    addToast(t('studio.runningTestTask'), 'info');
  };

  const launchPreview = async (
    openExternal = false,
    configuration: RunConfigurationRecord =
      runConfigurations.find((entry) => entry.group === 'dev') ??
      runConfigurations[0] ??
      getDefaultRunConfigurations()[0],
  ) => {
    const previewSession = resolveHostStudioPreviewSession({
      url: resolveStudioPreviewUrl(previewUrl),
      platform: previewPlatform,
      webDevice: previewWebDevice,
      miniProgramPlatform: previewMpPlatform,
      appPlatform: previewAppPlatform,
      deviceModel: previewPlatform === 'web' ? undefined : previewDeviceModel,
      isLandscape: previewIsLandscape,
    });
    const launch = await resolveStudioPreviewExecutionLaunch(previewSession, configuration, {
      projectId: currentProjectId || null,
      runConfigurationId: configuration.id,
      projectDirectory: resolveCurrentProjectDirectory(),
      workspaceDirectory: preferences.defaultWorkingDirectory,
      timestamp: Date.now(),
    });

    if (!launch.request) {
      addToast(
        buildTerminalProfileBlockedMessage(configuration.profileId, {
          launchState: launch.launchPresentation,
          blockedAction: launch.blockedAction,
        }) ?? 'Blocked terminal profile.',
        'error',
      );
      if (launch.blockedAction.actionId === 'open-settings') {
        globalEventBus.emit('openSettings');
      }
      return;
    }

    globalEventBus.emit('openTerminal');
    globalEventBus.emit('terminalRequest', launch.request.terminalRequest);
    setPreviewUrl(launch.request.session.target.url);
    setPreviewKey((value) => value + 1);

    try {
      await saveStoredStudioPreviewExecutionEvidence(launch.request.evidence);
    } catch (error) {
      console.error('Failed to persist preview execution evidence', error);
    }

    addToast(t('studio.startingApplication'), 'info');

    if (openExternal && typeof window !== 'undefined') {
      window.open(launch.request.session.target.url, '_blank', 'noopener,noreferrer');
    }
  };

  const launchSimulator = async (
    configuration: RunConfigurationRecord =
      runConfigurations.find((entry) => entry.group === 'dev') ??
      runConfigurations[0] ??
      getDefaultRunConfigurations()[0],
  ) => {
    const simulatorSession = resolveHostStudioSimulatorSession({
      platform: previewPlatform,
      webDevice: previewWebDevice,
      miniProgramPlatform: previewMpPlatform,
      appPlatform: previewAppPlatform,
      deviceModel: previewPlatform === 'web' ? undefined : previewDeviceModel,
      isLandscape: previewIsLandscape,
    });
    const launch = await resolveStudioSimulatorExecutionLaunch(simulatorSession, configuration, {
      projectId: currentProjectId || null,
      runConfigurationId: configuration.id,
      projectDirectory: resolveCurrentProjectDirectory(),
      workspaceDirectory: preferences.defaultWorkingDirectory,
      timestamp: Date.now(),
    });

    if (!launch.request) {
      addToast(
        buildTerminalProfileBlockedMessage(configuration.profileId, {
          launchState: launch.launchPresentation,
          blockedAction: launch.blockedAction,
        }) ?? 'Blocked terminal profile.',
        'error',
      );
      if (launch.blockedAction.actionId === 'open-settings') {
        globalEventBus.emit('openSettings');
      }
      return;
    }

    globalEventBus.emit('openTerminal');
    globalEventBus.emit('terminalRequest', launch.request.terminalRequest);
    setPreviewKey((value) => value + 1);

    try {
      await saveStoredStudioSimulatorExecutionEvidence(launch.request.evidence);
    } catch (error) {
      console.error('Failed to persist simulator execution evidence', error);
    }

    addToast(t('studio.runningSimulator'), 'info');
  };

  const handleSelectFile = (path: string) => {
    selectFile(path);
  };

  const handleAnalyzeCode = () => {
    if (!selectedFile || !fileContent) return;
    
    const lines = fileContent.split('\n');
    const loc = lines.length;
    const emptyLines = lines.filter(l => l.trim() === '').length;
    const imports = lines.filter(l => l.trim().startsWith('import ')).length;
    const functions = (fileContent.match(/function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?(?:\([^)]*\)|[^=]+)\s*=>/g) || []).length;
    const classes = (fileContent.match(/class\s+\w+/g) || []).length;
    
    // Simple cyclomatic complexity estimation (very naive)
    const complexityKeywords = (fileContent.match(/\b(if|while|for|case|catch|&&|\|\||\?)\b/g) || []).length;
    const estimatedComplexity = complexityKeywords + 1;
    
    let maintainability = 100;
    if (loc > 300) maintainability -= 10;
    if (estimatedComplexity > 20) maintainability -= 15;
    if (functions > 10) maintainability -= 5;
    
    setAnalyzeReport({
      loc,
      emptyLines,
      imports,
      functions,
      classes,
      complexity: estimatedComplexity,
      maintainability: Math.max(0, maintainability)
    });
    setIsAnalyzeModalVisible(true);
  };

  const getLanguageFromPath = (path: string) => {
    if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
    if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.html')) return 'html';
    if (path.endsWith('.css')) return 'css';
    return 'plaintext';
  };

  const handleEditMessage = (threadId: string, messageId: string) => {
    const thread = filteredProjects
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
    const project = filteredProjects.find((candidate) =>
      candidate.codingSessions.some((codingSession) => codingSession.id === threadId),
    );
    if (project) {
      await deleteCodingSessionMessage(project.id, threadId, messageId);
      addToast(t('studio.messageDeleted'), 'success');
    }
  };

  const handleRegenerateMessage = async (threadId: string) => {
    const project = filteredProjects.find((candidate) =>
      candidate.codingSessions.some((codingSession) => codingSession.id === threadId),
    );
    if (project) {
      const thread = project.codingSessions.find((codingSession) => codingSession.id === threadId);
      if (!thread) return;
      
      const userMessages = thread.messages.filter(m => m.role === 'user');
      if (userMessages.length === 0) return;
      
      const lastUserMsg = userMessages[userMessages.length - 1];
      
      setIsSending(true);
      try {
        const context = {
          workspaceId,
          projectId: project.id,
          threadId: thread.id
        };
        await sendMessage(project.id, threadId, lastUserMsg.content, context);
      } finally {
        setIsSending(false);
      }
    }
  };

  const handleRestoreMessage = async (threadId: string, messageId: string) => {
    const thread = filteredProjects
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
      addToast(t('studio.restoredFiles'), 'success');
    } catch (error) {
      console.error('Failed to restore files from checkpoint', error);
      addToast('Failed to restore files from checkpoint', 'error');
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending) return;
    
    let projectIdToUse = currentProjectId;
    let currentThreadId = selectedCodingSessionId;

    if (!projectIdToUse) {
      if (filteredProjects.length === 0) {
        const importedProject = await selectFolderAndImportProject(t('studio.newProject'));
        if (!importedProject) {
          return;
        }
        await syncNativeSessionsForWorkspace();
        projectIdToUse = importedProject.projectId;
        setMenuActiveProjectId(importedProject.projectId);
      } else {
        projectIdToUse = filteredProjects[0].id;
      }
    }

    if (!currentThreadId) {
      const newTitle = inputValue.slice(0, 20) + (inputValue.length > 20 ? '...' : '');
      const newThread = await createCodingSessionWithSelection(projectIdToUse, newTitle);
      currentThreadId = newThread.id;
      if (onProjectChange) onProjectChange(projectIdToUse);
      setSelectedThreadId(currentThreadId);
    }

    const content = inputValue;
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
      await sendMessage(projectIdToUse, currentThreadId, content, context);
    } finally {
      setIsSending(false);
    }
  };

  const handlePreviewAppPlatformChange = (platform: 'ios' | 'android' | 'harmony') => {
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
  };

  const devicePreviewProps = {
    url: previewUrl,
    platform: previewPlatform,
    webDevice: previewWebDevice,
    mpPlatform: previewMpPlatform,
    appPlatform: previewAppPlatform,
    deviceModel: previewDeviceModel,
    isLandscape: previewIsLandscape,
    refreshKey: previewKey,
  };

  const handleRunTaskExecution = (configuration: RunConfigurationRecord) => {
    setIsRunTaskVisible(false);
    if (configuration.group === 'build') {
      void dispatchBuildRunConfiguration(configuration);
      return;
    }
    if (configuration.group === 'test') {
      void dispatchTestRunConfiguration(configuration);
      return;
    }
    if (configuration.group === 'dev' && activeTab === 'simulator') {
      void launchSimulator(configuration);
      return;
    }
    dispatchRunConfiguration(configuration);
    if (configuration.group === 'dev') {
      addToast(t('studio.runningDevTask'), 'info');
      return;
    }
    addToast(`Running ${configuration.name}`, 'info');
  };

  const handleSubmitRunConfiguration = async () => {
    await saveRunConfiguration(runConfigurationDraft);
    addToast(t('studio.configurationSaved'), 'success');
    setIsRunConfigVisible(false);
  };

  const handleSaveDebugConfiguration = () => {
    addToast(t('studio.debugConfigurationUnavailable'), 'error');
    setIsDebugConfigVisible(false);
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmation?.type === 'message' && deleteConfirmation.parentId) {
      void executeDeleteMessage(deleteConfirmation.parentId, deleteConfirmation.id);
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

  const handleSelectCodingSession = (nextProjectId: string, nextCodingSessionId: string) => {
    if (onProjectChange) {
      onProjectChange(nextProjectId);
    }
    setSelectedThreadId(nextCodingSessionId);
  };

  const handleCreateSidebarProject = async () => {
    try {
      const newProject = await selectFolderAndImportProject(t('studio.newProject'));
      if (!newProject) {
        return;
      }
      await syncNativeSessionsForWorkspace();
      if (onProjectChange) {
        onProjectChange(newProject.projectId);
      }
      setMenuActiveProjectId(newProject.projectId);
      addToast(t('studio.projectCreated'), 'success');
    } catch (error) {
      console.error('Failed to create project', error);
      addToast(t('studio.failedToCreateProject'), 'error');
    }
  };

  const handleOpenSidebarFolder = async () => {
    try {
      const importedProject = await selectFolderAndImportProject(t('studio.localFolder'));
      if (!importedProject) {
        return;
      }

      await syncNativeSessionsForWorkspace();
      if (onProjectChange) {
        onProjectChange(importedProject.projectId);
      }
      setMenuActiveProjectId(importedProject.projectId);
      addToast(t('studio.openedFolder', { name: importedProject.projectName }), 'success');
    } catch (error) {
      console.error('Failed to open folder', error);
      addToast(t('studio.failedToOpenFolder'), 'error');
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
  };

  const handleReimportProjectFolder = async () => {
    if (!currentProjectId) {
      addToast(t('studio.pleaseSelectProject'), 'error');
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
        fallbackProjectName: currentProject?.name ?? t('studio.localFolder'),
        folderInfo,
        mountFolder,
        updateProject,
      });

      await syncNativeSessionsForWorkspace();
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
  };

  const handleCreateSidebarCodingSession = async (targetProjectId: string) => {
    if (!targetProjectId) {
      addToast(t('studio.pleaseSelectProject'), 'error');
      return;
    }

    try {
      const newThread = await createCodingSessionWithSelection(
        targetProjectId,
        t('studio.newThread'),
      );
      if (onProjectChange) {
        onProjectChange(targetProjectId);
      }
      setSelectedThreadId(newThread.id);
      addToast(t('studio.newThreadCreated'), 'success');
      setTimeout(() => {
        globalEventBus.emit('focusChatInput');
      }, 100);
    } catch (error) {
      console.error('Failed to create thread', error);
      addToast(t('studio.failedToCreateThread'), 'error');
    }
  };

  return (
    <div className="flex h-full w-full bg-[#0e0e11] text-gray-300">
      <StudioChatSidebar
        isVisible={isSidebarVisible}
        width={chatWidth}
        projects={filteredProjects}
        currentProjectId={currentProjectId}
        selectedCodingSessionId={selectedCodingSessionId}
        menuActiveProjectId={menuActiveProjectId}
        projectSearchQuery={projectSearchQuery}
        messages={messages}
        inputValue={inputValue}
        isSending={isSending}
        selectedEngineId={selectedEngineId}
        selectedModelId={selectedModelId}
        disabled={!currentProjectId}
        onResize={(delta) => setChatWidth((previousState) => Math.max(300, Math.min(800, previousState + delta)))}
        onProjectSearchQueryChange={setProjectSearchQuery}
        onMenuActiveProjectIdChange={setMenuActiveProjectId}
        onInputValueChange={setInputValue}
        onSelectedEngineIdChange={setSelectedEngineId}
        onSelectedModelIdChange={setSelectedModelId}
        onSendMessage={handleSendMessage}
        onSelectCodingSession={handleSelectCodingSession}
        onCreateProject={handleCreateSidebarProject}
        onOpenFolder={handleOpenSidebarFolder}
        onCreateCodingSession={handleCreateSidebarCodingSession}
        onRefreshProjectSessions={handleRefreshProjectSessions}
        onRefreshCodingSessionMessages={handleRefreshCodingSessionMessages}
        refreshingProjectId={refreshingProjectId}
        refreshingCodingSessionId={refreshingCodingSessionId}
        onViewChanges={(file) => {
          setViewingDiff(file);
          setActiveTab('code');
        }}
        onEditMessage={(messageId) => {
          if (selectedCodingSessionId) {
            handleEditMessage(selectedCodingSessionId, messageId);
          }
        }}
        onDeleteMessage={(messageId) => {
          if (selectedCodingSessionId) {
            void handleDeleteMessage(selectedCodingSessionId, messageId);
          }
        }}
        onRegenerateMessage={() => {
          if (selectedCodingSessionId) {
            void handleRegenerateMessage(selectedCodingSessionId);
          }
        }}
        onRestoreMessage={(messageId) => {
          if (selectedCodingSessionId) {
            void handleRestoreMessage(selectedCodingSessionId, messageId);
          }
        }}
        onStopSending={() => setIsSending(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative bg-[#0e0e11] overflow-hidden">
        <StudioWorkspaceOverlays
          files={files}
          mountRecoveryState={mountRecoveryState}
          isMountRecoveryActionPending={isMountRecoveryActionPending}
          isFindVisible={isFindVisible}
          isSearchingFiles={isSearchingFiles}
          isQuickOpenVisible={isQuickOpenVisible}
          searchFiles={searchFiles}
          onSelectFile={(path) => {
            selectFile(path);
            setViewingDiff(null);
          }}
          onRetryMountRecovery={() => {
            void handleRetryMountRecovery();
          }}
          onReimportProjectFolder={() => {
            void handleReimportProjectFolder();
          }}
          onCloseFind={() => setIsFindVisible(false)}
          onCloseQuickOpen={() => setIsQuickOpenVisible(false)}
          onNotifyNoResults={() => addToast(t('studio.noResultsFound'), 'info')}
        />

        {/* Tabs */}
        <StudioStageHeader
          activeTab={activeTab}
          previewUrl={previewUrl}
          previewPlatform={previewPlatform}
          previewWebDevice={previewWebDevice}
          previewMpPlatform={previewMpPlatform}
          previewAppPlatform={previewAppPlatform}
          previewDeviceModel={previewDeviceModel}
          previewIsLandscape={previewIsLandscape}
          selectedFile={selectedFile}
          viewingDiffPath={viewingDiff?.path}
          isTerminalOpen={isTerminalOpen}
          onTabChange={setActiveTab}
          onPreviewPlatformChange={setPreviewPlatform}
          onPreviewWebDeviceChange={setPreviewWebDevice}
          onPreviewMpPlatformChange={setPreviewMpPlatform}
          onPreviewAppPlatformChange={handlePreviewAppPlatformChange}
          onPreviewDeviceModelChange={setPreviewDeviceModel}
          onPreviewLandscapeToggle={() => setPreviewIsLandscape((previousState) => !previousState)}
          onRefreshPreview={() => {
            void launchPreview();
          }}
          onOpenPreviewInNewTab={() => {
            void launchPreview(true);
          }}
          onLaunchSimulator={() => {
            setActiveTab('simulator');
            void launchSimulator();
          }}
          onAnalyzeCode={handleAnalyzeCode}
          onToggleTerminal={() => setIsTerminalOpen((previousState) => !previousState)}
          onOpenShare={() => setShowShareModal(true)}
          onOpenPublish={() => setShowPublishModal(true)}
        />

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            {activeTab === 'preview' ? (
              <StudioPreviewPanel
                devicePreviewProps={devicePreviewProps}
              />
            ) : activeTab === 'simulator' ? (
              <StudioSimulatorPanel
                devicePreviewProps={devicePreviewProps}
              />
            ) : (
              <StudioCodeWorkspacePanel
                files={files}
                selectedFile={selectedFile}
                currentProjectPath={currentProject?.path}
                viewingDiff={viewingDiff}
                fileContent={fileContent}
                onSelectFile={(path) => {
                  setViewingDiff(null);
                  handleSelectFile(path);
                }}
                onCreateFile={createFile}
                onCreateFolder={createFolder}
                onDeleteFile={deleteFile}
                onDeleteFolder={deleteFolder}
                onRenameNode={renameNode}
                onAcceptDiff={() => {
                  void handleAcceptViewingDiff();
                }}
                onRejectDiff={() => setViewingDiff(null)}
                onFileContentChange={saveFile}
                getLanguageFromPath={getLanguageFromPath}
              />
            )}
          </div>

          <StudioTerminalIntegrationPanel
            isOpen={isTerminalOpen}
            height={terminalHeight}
            terminalRequest={terminalRequest}
            workspaceId={workspaceId}
            projectId={currentProjectId}
            onResize={(delta) =>
              setTerminalHeight((previousState) => Math.max(100, Math.min(800, previousState - delta)))
            }
          />
        </div>
      </div>

      <StudioPageDialogs
        isAnalyzeModalVisible={isAnalyzeModalVisible}
        analyzeReport={analyzeReport}
        onCloseAnalyze={() => setIsAnalyzeModalVisible(false)}
        isRunTaskVisible={isRunTaskVisible}
        runConfigurations={runConfigurations}
        onCloseRunTask={() => setIsRunTaskVisible(false)}
        onRunTask={handleRunTaskExecution}
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
        deleteConfirmation={deleteConfirmation}
        onCancelDelete={() => setDeleteConfirmation(null)}
        onConfirmDelete={handleConfirmDelete}
        showShareModal={showShareModal}
        shareAccess={shareAccess}
        publicShareUrl={publicShareUrl}
        collaborators={projectCollaborators}
        inviteEmail={inviteEmail}
        isCollaboratorsLoading={isCollaboratorsLoading}
        isInvitePending={isInvitePending}
        onShareAccessChange={setShareAccess}
        onCloseShare={() => setShowShareModal(false)}
        onCopyPublicLink={handleCopyPublicLink}
        onInviteEmailChange={setInviteEmail}
        onInviteCollaborator={handleInviteCollaborator}
        showPublishModal={showPublishModal}
        publishProjectId={currentProjectId}
        publishProjectName={currentProject?.name}
        onClosePublish={() => setShowPublishModal(false)}
      />
    </div>
  );
}

