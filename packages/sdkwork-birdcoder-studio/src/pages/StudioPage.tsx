import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  buildFileChangeRestorePlan,
  buildTerminalProfileBlockedMessage,
  getDefaultRunConfigurations,
  globalEventBus,
  hydrateImportedProjectFromAuthority,
  importLocalFolderProject,
  rebindLocalFolderProject,
  resolveLatestCodingSessionIdForProject,
  resolveCodingSessionLocationInProjects,
  resolveProjectIdByCodingSessionId,
  resolveProjectMountRecoverySource,
  resolveRunConfigurationTerminalLaunch,
  useFileSystem,
  useIDEServices,
  useProjectRunConfigurations,
  useProjects,
  useSelectedCodingSessionMessages,
  useSessionRefreshActions,
  useCodingSessionActions,
  useAuth,
  useToast,
  useWorkbenchChatSelection,
  useWorkbenchPreferences,
} from '@sdkwork/birdcoder-commons/workbench';
import type {
  RunConfigurationRecord,
  TerminalCommandRequest,
} from '@sdkwork/birdcoder-commons/workbench';
import { FileChange } from '@sdkwork/birdcoder-types';
import { SessionTranscriptLoadingState } from '@sdkwork/birdcoder-ui/chat';
import { useTranslation } from 'react-i18next';
import { normalizeWorkbenchCodeModelId } from '@sdkwork/birdcoder-codeengine';
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
import { useStudioCodingSessionSync } from './useStudioCodingSessionSync';
import { StudioTerminalIntegrationPanel } from './StudioTerminalIntegrationPanel';
import { StudioWorkspaceOverlays } from './StudioWorkspaceOverlays';
import { useStudioCollaboration } from './useStudioCollaboration';
import { useStudioWorkbenchEventBindings } from './useStudioWorkbenchEventBindings';
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
}

function StudioSessionTranscriptLoadingState() {
  return (
    <SessionTranscriptLoadingState
      title="Loading conversation"
      description="Fetching the selected session transcript."
    />
  );
}

export function StudioPage({
  workspaceId,
  projectId,
  initialCodingSessionId,
  onProjectChange,
  onCodingSessionChange,
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
      getProjectByPath: (projectPath) =>
        normalizedWorkspaceId
          ? projectService.getProjectByPath(normalizedWorkspaceId, projectPath)
          : Promise.resolve(null),
      mountFolder,
      updateProject,
    });
  };
  const {
    hasFetched: hasFetchedProjects,
    projects,
    filteredProjects,
    searchQuery: projectSearchQuery,
    setSearchQuery: setProjectSearchQuery,
    sendMessage,
    createProject,
    createCodingSession,
    updateCodingSession,
    updateProject,
    addCodingSessionMessage,
    editCodingSessionMessage,
    deleteCodingSessionMessage,
  } = useProjects(workspaceId);
  const { collaborationService, coreReadService, projectService } = useIDEServices();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [selectedCodingSessionId, setSelectedThreadId] = useState<string>('');
  const [selectionRefreshToken, setSelectionRefreshToken] = useState(0);
  const pendingProjectChangeIdRef = useRef<string | null>(null);
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
  const { runConfigurations, saveRunConfiguration } = useProjectRunConfigurations(currentProjectId || null);
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
      resolveProjectIdByCodingSessionId(projects, normalizedCodingSessionId);

    if (
      normalizedCodingSessionId === selectedCodingSessionId &&
      nextProjectId === currentProjectId
    ) {
      setSelectionRefreshToken((previousState) => previousState + 1);
      return;
    }

    if (nextProjectId) {
      notifyProjectChange(nextProjectId);
      setMenuActiveProjectId(nextProjectId);
    }

    setSelectedThreadId(normalizedCodingSessionId);
  }, [currentProjectId, notifyProjectChange, projects, selectedCodingSessionId]);
  const projectsRef = useRef(projects);
  const selectedCodingSessionIdRef = useRef(selectedCodingSessionId);
  const currentProjectIdRef = useRef(currentProjectId);
  const runConfigurationsRef = useRef(runConfigurations);
  const defaultWorkingDirectoryRef = useRef(preferences.defaultWorkingDirectory);
  const createCodingSessionWithSelectionRef = useRef(createCodingSessionWithSelection);
  const selectCodingSessionRef = useRef(selectCodingSession);

  useEffect(() => {
    projectsRef.current = projects;
    selectedCodingSessionIdRef.current = selectedCodingSessionId;
    currentProjectIdRef.current = currentProjectId;
    runConfigurationsRef.current = runConfigurations;
    defaultWorkingDirectoryRef.current = preferences.defaultWorkingDirectory;
    createCodingSessionWithSelectionRef.current = createCodingSessionWithSelection;
    selectCodingSessionRef.current = selectCodingSession;
  }, [
    createCodingSessionWithSelection,
    currentProjectId,
    preferences.defaultWorkingDirectory,
    projects,
    runConfigurations,
    selectCodingSession,
    selectedCodingSessionId,
  ]);

  useEffect(() => {
    const unsubscribe = globalEventBus.on('toggleSidebar', handleToggleSidebar);
    return () => {
      unsubscribe();
    };
  }, [handleToggleSidebar]);
  useStudioWorkbenchEventBindings({
    addToast,
    createCodingSessionWithSelectionRef,
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
    setMenuActiveProjectId((previousProjectId) =>
      previousProjectId === normalizedThreadProjectId
        ? previousProjectId
        : normalizedThreadProjectId,
    );
  }, [normalizedProjectId, normalizedThreadProjectId, onProjectChange]);

  useStudioCodingSessionSync({
    projects,
    initialCodingSessionId,
    onCodingSessionChange,
    selectedCodingSessionId,
    selectCodingSession,
  });

  useEffect(() => {
    if (!hasFetchedProjects) {
      return;
    }

    if (projects.length > 0) {
      if (!menuActiveProjectId || !projects.find(p => p.id === menuActiveProjectId)) {
        setMenuActiveProjectId(projects[0].id);
      }
      if (currentProjectId && !projects.find(p => p.id === currentProjectId)) {
        notifyProjectChange('');
        setSelectedThreadId('');
      } else if (
        selectedCodingSessionId &&
        !projects.some((project) =>
          project.codingSessions.some((codingSession) => codingSession.id === selectedCodingSessionId),
        )
      ) {
        setSelectedThreadId('');
      }
    } else {
      setMenuActiveProjectId('');
      if (currentProjectId) {
        notifyProjectChange('');
      }
      setSelectedThreadId('');
    }
  }, [
    currentProjectId,
    hasFetchedProjects,
    menuActiveProjectId,
    notifyProjectChange,
    projects,
    selectedCodingSessionId,
  ]);

  const [isSending, setIsSending] = useState(false);

  const currentThread = selectedCodingSessionLocation?.codingSession;
  const messages = currentThread?.messages || [];
  const effectiveSelectedEngineId = currentThread?.engineId ?? selectedEngineId;
  const effectiveSelectedModelId = currentThread?.modelId ?? selectedModelId;
  const currentProject =
    selectedCodingSessionLocation?.project ??
    projects.find((project) => project.id === currentProjectId);
  const handleSelectedEngineChange = useCallback(
    async (engineId: string) => {
      setSelectedEngineId(engineId);

      if (!currentProjectId || !selectedCodingSessionId) {
        return;
      }

      const nextModelId = normalizeWorkbenchCodeModelId(
        engineId,
        currentThread?.modelId ?? selectedModelId,
        preferences,
      );
      await updateCodingSession(currentProjectId, selectedCodingSessionId, {
        engineId,
        modelId: nextModelId,
      });
    },
    [
      currentProjectId,
      currentThread?.modelId,
      preferences,
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

      const nextEngineId = engineId ?? currentThread?.engineId ?? selectedEngineId;
      await updateCodingSession(currentProjectId, selectedCodingSessionId, {
        engineId: nextEngineId,
        modelId,
      });
    },
    [
      currentProjectId,
      currentThread?.engineId,
      selectedCodingSessionId,
      selectedEngineId,
      setSelectedModelId,
      updateCodingSession,
    ],
  );
  const activateImportedProject = (projectId: string) => {
    const latestCodingSessionId = resolveLatestCodingSessionIdForProject(projects, projectId);
    if (latestCodingSessionId) {
      selectCodingSession(latestCodingSessionId, { projectId });
      return;
    }

    notifyProjectChange(projectId);
    setMenuActiveProjectId(projectId);
    setSelectedThreadId('');
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
          selectCodingSession(latestCodingSessionId, { projectId });
        } else {
          notifyProjectChange(projectId);
          setMenuActiveProjectId(projectId);
          setSelectedThreadId('');
        }
      } catch (error) {
        console.error('Failed to refresh imported project sessions', error);
      }
    })();
  };
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
    const normalizedTargetProjectId = targetProjectId.trim();
    const normalizedTargetCodingSessionId = targetCodingSessionId.trim();
    const normalizedSelectedCodingSessionId = selectedCodingSessionId.trim();

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
    (codingSessionId) => {
      selectCodingSession(codingSessionId, { projectId: currentProjectId });
    },
  );

  const isSelectedCodingSessionMessagesLoading = useSelectedCodingSessionMessages({
    coreReadService,
    projectService,
    selectionRefreshToken,
    selectedCodingSession: currentThread,
    selectedCodingSessionId,
    selectedProject: selectedCodingSessionLocation?.project ?? null,
    workspaceId,
  });
  const isSelectedCodingSessionHydrating = Boolean(
    selectedCodingSessionId &&
    isSelectedCodingSessionMessagesLoading &&
    currentThread &&
    messages.length === 0
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
        addToast(t('studio.messageDeleted'), 'success');
      } catch (error) {
        console.error('Failed to delete coding session message', error);
        addToast(t('studio.failedToDeleteMessage'), 'error');
      }
    }
  };

  const handleRegenerateMessage = async (threadId: string) => {
    const project = projects.find((candidate) =>
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
      addToast(t('studio.restoredFiles'), 'success');
    } catch (error) {
      console.error('Failed to restore files from checkpoint', error);
      addToast('Failed to restore files from checkpoint', 'error');
    }
  };

  const handleSendMessage = async (text?: string) => {
    const content = typeof text === 'string' ? text : inputValue;
    const trimmedContent = content.trim();
    if (!trimmedContent || isSending) return;
    
    let projectIdToUse = currentProjectId;
    let currentThreadId = selectedCodingSessionId;

    if (!projectIdToUse) {
      if (projects.length === 0) {
        const importedProject = await selectFolderAndImportProject(t('studio.newProject'));
        if (!importedProject) {
          return;
        }
        projectIdToUse = importedProject.projectId;
        onProjectChange?.(importedProject.projectId);
        setMenuActiveProjectId(importedProject.projectId);
      } else {
        projectIdToUse = projects[0].id;
      }
    }

    if (!currentThreadId) {
      const newTitle =
        trimmedContent.slice(0, 20) + (trimmedContent.length > 20 ? '...' : '');
      const newThread = await createCodingSessionWithSelection(projectIdToUse, newTitle);
      currentThreadId = newThread.id;
      selectCodingSession(currentThreadId, { projectId: projectIdToUse });
    }

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
    selectCodingSession(nextCodingSessionId, { projectId: nextProjectId });
  };

  const handleCreateSidebarProject = async () => {
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
  };

  const handleOpenSidebarFolder = async () => {
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
      selectCodingSession(newThread.id, { projectId: targetProjectId });
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
        emptyState={
          isSelectedCodingSessionHydrating
            ? <StudioSessionTranscriptLoadingState />
            : undefined
        }
        inputValue={inputValue}
        isSending={isSending}
        selectedEngineId={effectiveSelectedEngineId}
        selectedModelId={effectiveSelectedModelId}
        disabled={!currentProjectId}
        onResize={(delta) => setChatWidth((previousState) => Math.max(300, Math.min(1280, previousState + delta)))}
        onProjectSearchQueryChange={setProjectSearchQuery}
        onMenuActiveProjectIdChange={setMenuActiveProjectId}
        onInputValueChange={setInputValue}
        onSelectedEngineIdChange={handleSelectedEngineChange}
        onSelectedModelIdChange={handleSelectedModelChange}
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

