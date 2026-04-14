import React, { useState, useEffect, useCallback } from 'react';
import {
  buildTerminalProfileBlockedMessage,
  getDefaultRunConfigurations,
  globalEventBus,
  normalizeWorkbenchCodeEngineId,
  normalizeWorkbenchCodeModelId,
  resolveRunConfigurationTerminalLaunch,
  resolveWorkbenchChatSelection,
  useFileSystem,
  useIDEServices,
  useProjectRunConfigurations,
  useProjects,
  useCodingSessionActions,
  useToast,
  useWorkbenchPreferences,
} from '@sdkwork/birdcoder-commons';
import type { RunConfigurationRecord, TerminalCommandRequest } from '@sdkwork/birdcoder-commons';
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
import {
  resolveHostStudioPreviewSession,
  resolveHostStudioSimulatorSession,
} from '../../../sdkwork-birdcoder-host-studio/src/index.ts';
interface StudioPageProps {
  workspaceId?: string;
  projectId?: string;
  onProjectChange?: (projectId: string) => void;
}
export function StudioPage({ workspaceId, projectId, onProjectChange }: StudioPageProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'preview' | 'simulator' | 'code'>('preview');
  const [inputValue, setInputValue] = useState('');
  const { switchChatEngine } = useIDEServices();
  const { preferences, updatePreferences } = useWorkbenchPreferences();
  const selectedEngineId = preferences.codeEngineId;
  const selectedModelId = preferences.codeModelId;
  useEffect(() => {
    switchChatEngine(selectedEngineId);
  }, [selectedEngineId, switchChatEngine]);
  const setSelectedEngineId = (engineId: string) => {
    updatePreferences((previousState) =>
      resolveWorkbenchChatSelection({
        codeEngineId: normalizeWorkbenchCodeEngineId(engineId),
        codeModelId: previousState.codeModelId,
      }),
    );
  };
  const setSelectedModelId = (modelId: string) => {
    updatePreferences((previousState) => ({
      codeModelId: normalizeWorkbenchCodeModelId(previousState.codeEngineId, modelId),
    }));
  };
  const {
    projects: filteredProjects,
    searchQuery: projectSearchQuery,
    setSearchQuery: setProjectSearchQuery,
    sendMessage,
    createProject,
    createCodingSession,
    addCodingSessionMessage,
    editCodingSessionMessage,
    deleteCodingSessionMessage,
  } = useProjects(workspaceId);
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
  
  const [isAnalyzeModalVisible, setIsAnalyzeModalVisible] = useState(false);
  const [analyzeReport, setAnalyzeReport] = useState<StudioAnalyzeReport | null>(null);

  const [showShareModal, setShowShareModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [shareAccess, setShareAccess] = useState<'private' | 'public'>('private');

  const [previewPlatform, setPreviewPlatform] = useState<'web' | 'miniprogram' | 'app'>('web');
  const [previewWebDevice, setPreviewWebDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [previewMpPlatform, setPreviewMpPlatform] = useState<'wechat' | 'douyin' | 'alipay'>('wechat');
  const [previewAppPlatform, setPreviewAppPlatform] = useState<'ios' | 'android' | 'harmony'>('ios');
  const [previewDeviceModel, setPreviewDeviceModel] = useState<string>('iphone-14-pro');
  const [previewIsLandscape, setPreviewIsLandscape] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('about:blank');
  
  // Determine the current project ID based on selected thread, or the prop
  const threadProjectId = filteredProjects.find((project) =>
    project.codingSessions.some((codingSession) => codingSession.id === selectedCodingSessionId),
  )?.id;
  const currentProjectId = threadProjectId || projectId || '';
  const { runConfigurations, saveRunConfiguration } = useProjectRunConfigurations(currentProjectId || null);

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
          const newThread = await createCodingSession(currentProjectId, t('studio.newThread'));
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
      import('@sdkwork/birdcoder-commons').then(({ globalEventBus }) => {
        globalEventBus.emit('openTerminal');
        globalEventBus.emit('terminalRequest', { command: 'npm start', timestamp: Date.now() });
      });
      addToast(t('studio.startingApplication'), 'info');
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
    
    import('@sdkwork/birdcoder-commons').then(({ globalEventBus }) => {
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
    });
    
    return () => {
      import('@sdkwork/birdcoder-commons').then(({ globalEventBus }) => {
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
      });
    };
  }, [selectedCodingSessionId, filteredProjects, currentProjectId, createCodingSession, addToast]);
  
  const [chatWidth, setChatWidth] = useState(450);
  const [deleteConfirmation, setDeleteConfirmation] = useState<StudioDeleteConfirmation | null>(null);

  // Sync the current project ID up to the AppContent state if it changes due to thread selection
  useEffect(() => {
    if (threadProjectId && threadProjectId !== projectId && onProjectChange) {
      onProjectChange(threadProjectId);
    }
  }, [threadProjectId, projectId, onProjectChange]);

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

  const {
    files,
    selectedFile,
    fileContent,
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
  } = useFileSystem(currentProjectId);

  useCodingSessionActions(currentProjectId, createCodingSession, setSelectedThreadId);

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
    const currentProjectName = filteredProjects.find((project) => project.id === currentProjectId)?.name;
    const projectDirectory = currentProjectName ? `/workspace/${currentProjectName}` : preferences.defaultWorkingDirectory;
    const launch = await resolveRunConfigurationTerminalLaunch(configuration, {
      projectDirectory,
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
    const currentProjectName = filteredProjects.find((project) => project.id === currentProjectId)?.name;
    const projectDirectory = currentProjectName
      ? `/workspace/${currentProjectName}`
      : preferences.defaultWorkingDirectory;
    const buildProfile = resolveStudioBuildProfile({
      platform: previewPlatform,
      webDevice: previewWebDevice,
      miniProgramPlatform: previewMpPlatform,
      appPlatform: previewAppPlatform,
    });
    const launch = await resolveStudioBuildExecutionLaunch(buildProfile, configuration, {
      projectId: currentProjectId || null,
      runConfigurationId: configuration.id,
      projectDirectory,
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
    const currentProjectName = filteredProjects.find((project) => project.id === currentProjectId)?.name;
    const projectDirectory = currentProjectName
      ? `/workspace/${currentProjectName}`
      : preferences.defaultWorkingDirectory;
    const launch = await resolveStudioTestExecutionLaunch(configuration, {
      projectId: currentProjectId || null,
      runConfigurationId: configuration.id,
      projectDirectory,
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
    const currentProjectName = filteredProjects.find((project) => project.id === currentProjectId)?.name;
    const projectDirectory = currentProjectName
      ? `/workspace/${currentProjectName}`
      : preferences.defaultWorkingDirectory;
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
      projectDirectory,
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
    const currentProjectName = filteredProjects.find((project) => project.id === currentProjectId)?.name;
    const projectDirectory = currentProjectName
      ? `/workspace/${currentProjectName}`
      : preferences.defaultWorkingDirectory;
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
      projectDirectory,
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
    if (msg && msg.fileChanges) {
      for (const change of msg.fileChanges) {
        if (change.originalContent !== undefined) {
          await saveFileContent(change.path, change.originalContent);
        }
      }
      addToast(t('studio.restoredFiles'), 'success');
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending) return;
    
    let projectIdToUse = currentProjectId;
    let currentThreadId = selectedCodingSessionId;

    if (!projectIdToUse) {
      if (filteredProjects.length === 0) {
        const newProject = await createProject(t('studio.newProject'));
        projectIdToUse = newProject.id;
        setMenuActiveProjectId(newProject.id);
      } else {
        projectIdToUse = filteredProjects[0].id;
      }
    }

    if (!currentThreadId) {
      const newTitle = inputValue.slice(0, 20) + (inputValue.length > 20 ? '...' : '');
      const newThread = await createCodingSession(projectIdToUse, newTitle);
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

  const currentProject = filteredProjects.find((project) => project.id === currentProjectId);
  const currentProjectName = currentProject?.name;
  const publicShareUrl = `https://ide.sdkwork.com/p/${currentProjectId || 'demo'}`;
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

  const handleCopyPublicLink = () => {
    navigator.clipboard.writeText(publicShareUrl);
    addToast(t('studio.linkCopied'), 'success');
  };

  const handleInviteCollaborator = () => {
    addToast(t('studio.invitationSent'), 'success');
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
      const newProject = await createProject(t('studio.newProject'));
      if (onProjectChange) {
        onProjectChange(newProject.id);
      }
      setMenuActiveProjectId(newProject.id);
      addToast(t('studio.projectCreated'), 'success');
    } catch (error) {
      console.error('Failed to create project', error);
      addToast(t('studio.failedToCreateProject'), 'error');
    }
  };

  const handleOpenSidebarFolder = async () => {
    try {
      const { openLocalFolder } = await import('@sdkwork/birdcoder-commons');
      const folderInfo = await openLocalFolder();
      if (!folderInfo) {
        return;
      }

      let projectName = t('studio.localFolder');
      if (folderInfo.type === 'browser') {
        projectName = folderInfo.handle.name;
      } else {
        const parts = folderInfo.path.split(/[/\\]/);
        projectName = parts[parts.length - 1] || t('studio.localFolder');
      }

      const newProject = await createProject(projectName);
      await mountFolder(newProject.id, folderInfo);

      if (onProjectChange) {
        onProjectChange(newProject.id);
      }
      setMenuActiveProjectId(newProject.id);
      addToast(t('studio.openedFolder', { name: projectName }), 'success');
    } catch (error) {
      console.error('Failed to open folder', error);
      addToast(t('studio.failedToOpenFolder'), 'error');
    }
  };

  const handleCreateSidebarCodingSession = async (targetProjectId: string) => {
    if (!targetProjectId) {
      addToast(t('studio.pleaseSelectProject'), 'error');
      return;
    }

    try {
      const newThread = await createCodingSession(targetProjectId, t('studio.newThread'));
      if (onProjectChange) {
        onProjectChange(targetProjectId);
      }
      setSelectedThreadId(newThread.id);
      addToast(t('studio.newThreadCreated'), 'success');
      setTimeout(() => {
        import('@sdkwork/birdcoder-commons').then(({ globalEventBus }) => {
          globalEventBus.emit('focusChatInput');
        });
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
          isFindVisible={isFindVisible}
          isQuickOpenVisible={isQuickOpenVisible}
          searchFiles={searchFiles}
          onSelectFile={(path) => {
            selectFile(path);
            setViewingDiff(null);
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
                currentProjectName={currentProjectName}
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
        onShareAccessChange={setShareAccess}
        onCloseShare={() => setShowShareModal(false)}
        onCopyPublicLink={handleCopyPublicLink}
        onInviteCollaborator={handleInviteCollaborator}
        showPublishModal={showPublishModal}
        onClosePublish={() => setShowPublishModal(false)}
      />
    </div>
  );
}

