import {
  createElement,
  useEffect,
  useMemo,
  useRef,
  type ComponentProps,
  type ReactNode,
} from 'react';
import type {
  ProjectGitOverviewViewState,
  TerminalCommandRequest,
} from '@sdkwork/birdcoder-pc-workbench';
import type {
  AgentSessionItemView,
  AgentSessionRuntimeDisplayStatus,
  AgentProjectView,
  FileChange,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type { FileNode } from '@sdkwork/birdcoder-pc-ui/components/FileExplorer';
import { ProjectGitOverviewDrawer } from '@sdkwork/birdcoder-pc-ui/components/ProjectGitOverviewDrawer';
import type { UniversalChatProps } from '@sdkwork/birdcoder-pc-ui/components/UniversalChat';
import type { ProjectExplorerProps } from '../components/ProjectExplorer.types';
import type { TopBarProps } from '../components/TopBar';
import type { CodeMobileProgrammingPanelProps } from './CodeMobileProgrammingPanel';
import type {
  CodeDeleteConfirmation,
  CodePageDialogsProps,
} from './CodePageDialogs';
import { CodeTerminalIntegrationPanel } from './CodeTerminalIntegrationPanel';
import type { CodeWorkspaceOverlaysProps } from './CodeWorkspaceOverlays';
import { CodeNewSessionContext } from './CodeNewSessionContext';
import type { NewTaskExecutionTarget } from './NewTaskRunModeSelector';
import { getLanguageFromPath } from './CodePageShared';
import { resolveCodeTranscriptSessionScopeKey } from './codeTranscriptSessionScope';
import type { CodeEditorWorkspacePanelProps } from './codeEditorWorkspacePanel.types';
import { useCodePendingInteractions } from './useCodePendingInteractions';

type CodePageTab = 'ai' | 'editor' | 'mobile';

type UniversalChatComponentProps = UniversalChatProps;
type TopBarComponentProps = TopBarProps;
type CodePageDialogsComponentProps = CodePageDialogsProps;
type CodeWorkspaceOverlaysComponentProps = CodeWorkspaceOverlaysProps;
type CodeTerminalIntegrationPanelComponentProps =
  ComponentProps<typeof CodeTerminalIntegrationPanel>;
type CodeMobileProgrammingPanelComponentProps = CodeMobileProgrammingPanelProps;

const EMPTY_CHAT_MESSAGES: AgentSessionItemView[] = [];

export interface CodePageSurfacePropsBundle {
  dialogProps: CodePageDialogsComponentProps;
  gitOverviewDrawerProps: ComponentProps<typeof ProjectGitOverviewDrawer>;
  mainChatProps: UniversalChatComponentProps;
  mobileProgrammingProps: Omit<CodeMobileProgrammingPanelComponentProps, 'isActive'>;
  overlayProps: CodeWorkspaceOverlaysComponentProps;
  projectExplorerProps: ProjectExplorerProps;
  terminalProps: CodeTerminalIntegrationPanelComponentProps;
  topBarProps: TopBarComponentProps;
  workspaceProps: Omit<CodeEditorWorkspacePanelProps, 'isActive'>;
}

interface UseCodePageSurfacePropsOptions {
  activeTab: CodePageTab;
  currentProjectId: string;
  isProjectGitOverviewDrawerOpen: boolean;
  projectId?: string;
  projectGitOverviewState?: ProjectGitOverviewViewState;
  projectName?: string;
  deleteConfirmation: CodeDeleteConfirmation | null;
  editorChatEmptyState?: ReactNode;
  editorExplorerWidth: number;
  chatWidth: number;
  fileContent: string;
  files: FileNode[];
  projectRootPath: string;
  fileTreeLoadError: boolean;
  filteredProjects: AgentProjectView[];
  projects: AgentProjectView[];
  hasMoreProjects: boolean;
  hasProjectsLoadError: boolean;
  hasMoreRemoteMessages: boolean;
  remoteMessagesLoadError: string | null;
  isChatBusy: boolean;
  isChatEngineBusy: boolean;
  isEngineBusyCurrentSession: boolean;
  isDebugConfigVisible: boolean;
  isFindVisible: boolean;
  isMountRecoveryActionPending: boolean;
  isLoadingProjects: boolean;
  isLoadingMoreProjects: boolean;
  isLoadingMoreRemoteMessages: boolean;
  isNewSession: boolean;
  cloudTaskExecutionAvailable: boolean;
  localTaskExecutionAvailable: boolean;
  isQuickOpenVisible: boolean;
  isRunConfigVisible: boolean;
  isRunTaskVisible: boolean;
  isFileTreeLoading: boolean;
  isSearchingFiles: boolean;
  isSidebarVisible: boolean;
  isTerminalOpen: boolean;
  isVisible: boolean;
  loadingDirectoryPaths: Record<string, boolean>;
  mainChatEmptyState?: ReactNode;
  mountRecoveryState: CodeWorkspaceOverlaysComponentProps['mountRecoveryState'];
  openFiles: string[];
  refreshingAgentSessionId: string | null;
  refreshingProjectId: string | null;
  runConfigurationDraft: CodePageDialogsComponentProps['runConfigurationDraft'];
  runConfigurations: CodePageDialogsComponentProps['runConfigurations'];
  searchQuery: string;
  selectedAgentSessionItems: AgentSessionItemView[];
  selectedEngineId: string;
  newTaskExecutionTarget: NewTaskExecutionTarget;
  selectedFile?: string | null;
  selectedModelId: string;
  selectedSessionLastTurnAt?: string | null;
  selectedSessionAgentId: string | null;
  selectedSessionRuntimeBindingId?: string;
  selectedSessionTitle?: string;
  selectedSessionEngineId?: string;
  selectedSessionModelId?: string;
  selectedSessionRuntimeLocationId?: string;
  selectedSessionRuntimeStatus?: string;
  selectedSessionTranscriptUpdatedAt?: string | null;
  selectedSessionUpdatedAt?: string;
  onSelectedSessionRuntimeStatusChange?: (
    runtimeStatus: AgentSessionRuntimeDisplayStatus,
  ) => void;
  sessionId: string | null;
  showComposerEngineSelector: boolean;
  sidebarWidth: number;
  terminalHeight: number;
  terminalRequest?: TerminalCommandRequest;
  viewingDiff: FileChange | null;
  onArchiveAgentSession: NonNullable<ProjectExplorerProps['onArchiveAgentSession']>;
  onArchiveProject: NonNullable<ProjectExplorerProps['onArchiveProject']>;
  onCancelDelete: NonNullable<CodePageDialogsComponentProps['onCancelDelete']>;
  onChatResize: CodeEditorWorkspacePanelProps['onChatResize'];
  onCloseDebugConfig: NonNullable<CodePageDialogsComponentProps['onCloseDebugConfig']>;
  onCloseFile: CodeEditorWorkspacePanelProps['onCloseFile'];
  onCloseFind: NonNullable<CodeWorkspaceOverlaysComponentProps['onCloseFind']>;
  onCloseQuickOpen: NonNullable<CodeWorkspaceOverlaysComponentProps['onCloseQuickOpen']>;
  onCloseRunConfig: NonNullable<CodePageDialogsComponentProps['onCloseRunConfig']>;
  onCloseRunTask: NonNullable<CodePageDialogsComponentProps['onCloseRunTask']>;
  onCloseTerminal: NonNullable<CodeTerminalIntegrationPanelComponentProps['onClose']>;
  onConfirmDelete: NonNullable<CodePageDialogsComponentProps['onConfirmDelete']>;
  onCopyAgentSessionDeeplink: NonNullable<ProjectExplorerProps['onCopyAgentSessionDeeplink']>;
  onCopyAgentSessionProviderSessionId:
    NonNullable<ProjectExplorerProps['onCopyAgentSessionProviderSessionId']>;
  onCopyAgentSessionWorkingDirectory:
    NonNullable<ProjectExplorerProps['onCopyAgentSessionWorkingDirectory']>;
  onCopyProjectPath: NonNullable<ProjectExplorerProps['onCopyProjectPath']>;
  onCopyWorkingDirectory: NonNullable<ProjectExplorerProps['onCopyWorkingDirectory']>;
  onCreateFile: CodeEditorWorkspacePanelProps['onCreateFile'];
  onCreateFolder: CodeEditorWorkspacePanelProps['onCreateFolder'];
  onCreateRootFile: CodeEditorWorkspacePanelProps['onCreateRootFile'];
  onCloseProjectGitOverviewDrawer: () => void;
  onDeleteAgentSession: NonNullable<ProjectExplorerProps['onDeleteAgentSession']>;
  onDeleteFile: CodeEditorWorkspacePanelProps['onDeleteFile'];
  onDeleteFolder: CodeEditorWorkspacePanelProps['onDeleteFolder'];
  onDeleteMessage: NonNullable<UniversalChatComponentProps['onDeleteMessage']>;
  onDeleteProject: NonNullable<ProjectExplorerProps['onDeleteProject']>;
  onEditMessage: NonNullable<UniversalChatComponentProps['onEditMessage']>;
  onExpandDirectory: CodeEditorWorkspacePanelProps['onExpandDirectory'];
  onExplorerResize: CodeEditorWorkspacePanelProps['onExplorerResize'];
  onFileDraftChange: CodeEditorWorkspacePanelProps['onFileDraftChange'];
  onForkAgentSessionLocal: NonNullable<ProjectExplorerProps['onForkAgentSessionLocal']>;
  onForkAgentSessionNewTree: NonNullable<ProjectExplorerProps['onForkAgentSessionNewTree']>;
  onMarkAgentSessionUnread: NonNullable<ProjectExplorerProps['onMarkAgentSessionUnread']>;
  onNewAgentSessionInProject: NonNullable<ProjectExplorerProps['onNewAgentSessionInProject']>;
  onNewTaskExecutionTargetChange: (
    executionTarget: NewTaskExecutionTarget,
  ) => void;
  onNewSessionProjectSelect: (projectId: string) => void;
  onNewProject: NonNullable<ProjectExplorerProps['onNewProject']>;
  onLoadMoreProjects: NonNullable<ProjectExplorerProps['onLoadMoreProjects']>;
  onRetryProjects: NonNullable<ProjectExplorerProps['onRetryProjects']>;
  onLoadMoreProjectSessions: NonNullable<ProjectExplorerProps['onLoadMoreProjectSessions']>;
  onLoadMoreRemoteMessages: NonNullable<UniversalChatComponentProps['onLoadMoreRemoteMessages']>;
  onNotifyNoResults: NonNullable<CodeWorkspaceOverlaysComponentProps['onNotifyNoResults']>;
  onOpenFolder: NonNullable<ProjectExplorerProps['onOpenFolder']>;
  onOpenAgentSessionInTerminal:
    NonNullable<ProjectExplorerProps['onOpenAgentSessionInTerminal']>;
  onOpenInFileExplorer: NonNullable<ProjectExplorerProps['onOpenInFileExplorer']>;
  onOpenInTerminal: NonNullable<ProjectExplorerProps['onOpenInTerminal']>;
  onOpenMessageFile: NonNullable<UniversalChatComponentProps['onOpenFile']>;
  onPinAgentSession: NonNullable<ProjectExplorerProps['onPinAgentSession']>;
  onProjectSelect: NonNullable<ProjectExplorerProps['onSelectProject']>;
  onRefreshAgentSessionItems:
    NonNullable<ProjectExplorerProps['onRefreshAgentSessionItems']>;
  onRefreshProjectSessions: NonNullable<ProjectExplorerProps['onRefreshProjectSessions']>;
  onRegenerateMessage: NonNullable<UniversalChatComponentProps['onRegenerateMessage']>;
  onRateMessage: NonNullable<UniversalChatComponentProps['onRateMessage']>;
  onForkMessage: NonNullable<UniversalChatComponentProps['onForkMessage']>;
  resolveLocalImagePreviewUrl:
    NonNullable<UniversalChatComponentProps['resolveLocalImagePreviewUrl']>;
  onCloseDiff: CodeEditorWorkspacePanelProps['onCloseDiff'];
  onReimportProjectFolder:
    NonNullable<CodeWorkspaceOverlaysComponentProps['onReimportProjectFolder']>;
  onRenameAgentSession: NonNullable<ProjectExplorerProps['onRenameAgentSession']>;
  onRenameNode: CodeEditorWorkspacePanelProps['onRenameNode'];
  onRenameProject: NonNullable<ProjectExplorerProps['onRenameProject']>;
  onRetryFileTreeLoad: CodeEditorWorkspacePanelProps['onRetryFileTreeLoad'];
  onRestoreMessage: NonNullable<UniversalChatComponentProps['onRestore']>;
  onRetryMountRecovery:
    NonNullable<CodeWorkspaceOverlaysComponentProps['onRetryMountRecovery']>;
  onRunConfigurationDraftChange:
    NonNullable<CodePageDialogsComponentProps['onRunConfigurationDraftChange']>;
  onRunTask: NonNullable<CodePageDialogsComponentProps['onRunTask']>;
  onSaveDebugConfig: NonNullable<CodePageDialogsComponentProps['onSaveDebugConfig']>;
  onSearchFiles: NonNullable<CodeWorkspaceOverlaysComponentProps['searchFiles']>;
  onSelectAgentSession: NonNullable<ProjectExplorerProps['onSelectAgentSession']>;
  onSelectFile: CodeEditorWorkspacePanelProps['onSelectFile'];
  onSelectedEngineIdChange: NonNullable<UniversalChatComponentProps['setSelectedEngineId']>;
  onSelectedModelIdChange: NonNullable<UniversalChatComponentProps['setSelectedModelId']>;
  onSendMessage: NonNullable<UniversalChatComponentProps['onSendMessage']>;
  onStopTurn: NonNullable<UniversalChatComponentProps['onStopTurn']>;
  onSetActiveTab: TopBarComponentProps['setActiveTab'];
  onSetIsTerminalOpen: TopBarComponentProps['setIsTerminalOpen'];
  onToggleProjectGitOverviewDrawer: () => void;
  onSubmitRunConfig: NonNullable<CodePageDialogsComponentProps['onSubmitRunConfig']>;
  onTerminalResize: NonNullable<CodeTerminalIntegrationPanelComponentProps['onResize']>;
  onViewChanges: CodeEditorWorkspacePanelProps['onViewChanges'];
  onViewChangesAndOpenEditor: NonNullable<UniversalChatComponentProps['onViewChanges']>;
  setSearchQuery: NonNullable<ProjectExplorerProps['setSearchQuery']>;
}

export function useCodePageSurfaceProps({
  activeTab,
  currentProjectId,
  isProjectGitOverviewDrawerOpen,
  projectId,
  projectGitOverviewState,
  projectName,
  deleteConfirmation,
  editorChatEmptyState,
  editorExplorerWidth,
  chatWidth,
  fileContent,
  files,
  projectRootPath,
  fileTreeLoadError,
  filteredProjects,
  projects,
  hasMoreProjects,
  hasProjectsLoadError,
  hasMoreRemoteMessages,
  remoteMessagesLoadError,
  isChatBusy,
  isChatEngineBusy,
  isEngineBusyCurrentSession,
  isDebugConfigVisible,
  isFindVisible,
  isMountRecoveryActionPending,
  isLoadingProjects,
  isLoadingMoreProjects,
  isLoadingMoreRemoteMessages,
  isNewSession,
  cloudTaskExecutionAvailable,
  localTaskExecutionAvailable,
  isQuickOpenVisible,
  isRunConfigVisible,
  isRunTaskVisible,
  isFileTreeLoading,
  isSearchingFiles,
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
  selectedEngineId,
  newTaskExecutionTarget,
  selectedFile,
  selectedModelId,
  selectedSessionLastTurnAt,
  selectedSessionTitle,
  selectedSessionEngineId,
  selectedSessionAgentId,
  selectedSessionRuntimeBindingId,
  selectedSessionModelId,
  selectedSessionRuntimeLocationId,
  selectedSessionRuntimeStatus,
  selectedSessionTranscriptUpdatedAt,
  selectedSessionUpdatedAt,
  onSelectedSessionRuntimeStatusChange,
  sessionId,
  showComposerEngineSelector,
  sidebarWidth,
  terminalHeight,
  terminalRequest,
  viewingDiff,
  onArchiveAgentSession,
  onArchiveProject,
  onCancelDelete,
  onChatResize,
  onCloseDebugConfig,
  onCloseFile,
  onCloseFind,
  onCloseQuickOpen,
  onCloseRunConfig,
  onCloseRunTask,
  onCloseTerminal,
  onConfirmDelete,
  onCopyAgentSessionDeeplink,
  onCopyAgentSessionProviderSessionId,
  onCopyAgentSessionWorkingDirectory,
  onCopyProjectPath,
  onCopyWorkingDirectory,
  onCreateFile,
  onCreateFolder,
  onCreateRootFile,
  onCloseProjectGitOverviewDrawer,
  onDeleteAgentSession,
  onDeleteFile,
  onDeleteFolder,
  onDeleteMessage,
  onDeleteProject,
  onEditMessage,
  onExpandDirectory,
  onExplorerResize,
  onFileDraftChange,
  onForkAgentSessionLocal,
  onForkAgentSessionNewTree,
  onMarkAgentSessionUnread,
  onNewAgentSessionInProject,
  onNewTaskExecutionTargetChange,
  onNewSessionProjectSelect,
  onNewProject,
  onLoadMoreProjects,
  onRetryProjects,
  onLoadMoreProjectSessions,
  onLoadMoreRemoteMessages,
  onNotifyNoResults,
  onOpenFolder,
  onOpenAgentSessionInTerminal,
  onOpenInFileExplorer,
  onOpenInTerminal,
  onOpenMessageFile,
  onPinAgentSession,
  onProjectSelect,
  onRefreshAgentSessionItems,
  onRefreshProjectSessions,
  onRegenerateMessage,
  onRateMessage,
  onForkMessage,
  resolveLocalImagePreviewUrl,
  onCloseDiff,
  onReimportProjectFolder,
  onRenameAgentSession,
  onRenameNode,
  onRenameProject,
  onRetryFileTreeLoad,
  onRestoreMessage,
  onRetryMountRecovery,
  onRunConfigurationDraftChange,
  onRunTask,
  onSaveDebugConfig,
  onSearchFiles,
  onSelectAgentSession,
  onSelectFile,
  onSelectedEngineIdChange,
  onSelectedModelIdChange,
  onSendMessage,
  onStopTurn,
  onSetActiveTab,
  onSetIsTerminalOpen,
  onToggleProjectGitOverviewDrawer,
  onSubmitRunConfig,
  onTerminalResize,
  onViewChanges,
  onViewChangesAndOpenEditor,
  setSearchQuery,
}: UseCodePageSurfacePropsOptions): CodePageSurfacePropsBundle {
  const shouldShowCodeComposerModelSelector = showComposerEngineSelector;
  const mainChatMessages =
    activeTab === 'ai' ? selectedAgentSessionItems : EMPTY_CHAT_MESSAGES;
  const editorChatMessages =
    activeTab === 'editor' ? selectedAgentSessionItems : EMPTY_CHAT_MESSAGES;
  const transcriptSessionScopeKey = resolveCodeTranscriptSessionScopeKey(
    currentProjectId,
    sessionId,
  );
  const pendingInteractionRefreshToken = useMemo(() => {
    return [
      selectedSessionAgentId ?? '',
      sessionId ?? '',
      selectedSessionRuntimeStatus ?? '',
      selectedSessionUpdatedAt ?? '',
      selectedSessionLastTurnAt ?? '',
      selectedSessionTranscriptUpdatedAt ?? '',
      isChatBusy ? 'busy' : 'idle',
    ].join('\u0001');
  }, [
    isChatBusy,
    selectedSessionAgentId,
    selectedSessionLastTurnAt,
    selectedSessionRuntimeStatus,
    selectedSessionTranscriptUpdatedAt,
    selectedSessionUpdatedAt,
    sessionId,
  ]);
  const {
    arePendingInteractionsLoading,
    onSubmitApprovalDecision,
    onSubmitUserQuestionAnswer,
    onRetryPendingInteractions,
    pendingApprovals,
    pendingInteractionsError,
    pendingUserQuestions,
  } = useCodePendingInteractions({
    agentId: selectedSessionAgentId,
    onRefreshAgentSessionItems,
    projectId: currentProjectId,
    refreshToken: pendingInteractionRefreshToken,
    sessionId,
    sessionScopeKey: transcriptSessionScopeKey,
  });
  const lastInteractionRuntimeStatusRef = useRef('');
  useEffect(() => {
    if (!sessionId || !onSelectedSessionRuntimeStatusChange) {
      lastInteractionRuntimeStatusRef.current = '';
      return;
    }
    if (arePendingInteractionsLoading || pendingInteractionsError) {
      return;
    }
    const nextRuntimeStatus: AgentSessionRuntimeDisplayStatus = pendingApprovals.length > 0
      ? 'awaiting_approval'
      : pendingUserQuestions.length > 0
        ? 'awaiting_user'
        : selectedSessionRuntimeStatus === 'awaiting_approval'
          || selectedSessionRuntimeStatus === 'awaiting_user'
          ? 'ready'
          : (selectedSessionRuntimeStatus as AgentSessionRuntimeDisplayStatus) || 'ready';
    const statusKey = `${sessionId}\u0001${nextRuntimeStatus}`;
    if (lastInteractionRuntimeStatusRef.current === statusKey) {
      return;
    }
    lastInteractionRuntimeStatusRef.current = statusKey;
    onSelectedSessionRuntimeStatusChange(nextRuntimeStatus);
  }, [
    onSelectedSessionRuntimeStatusChange,
    arePendingInteractionsLoading,
    pendingApprovals.length,
    pendingInteractionsError,
    pendingUserQuestions.length,
    selectedSessionRuntimeStatus,
    sessionId,
  ]);

  const projectExplorerProps = useMemo<ProjectExplorerProps>(() => ({
    hasMoreProjects,
    hasProjectsLoadError,
    isLoadingProjects,
    isLoadingMoreProjects,
    isVisible: isVisible && isSidebarVisible,
    width: sidebarWidth,
    projects: filteredProjects,
    taskSearchProjects: projects,
    selectedProjectId: currentProjectId,
    selectedAgentSessionId: sessionId,
    onSelectProject: onProjectSelect,
    onSelectAgentSession,
    onRenameAgentSession,
    onDeleteAgentSession,
    onRenameProject,
    onDeleteProject,
    onNewProject,
    onLoadMoreProjects,
    onRetryProjects,
    onLoadMoreProjectSessions,
    onOpenFolder,
    onNewAgentSessionInProject,
    onRefreshProjectSessions,
    onRefreshAgentSessionItems,
    onArchiveProject,
    onCopyWorkingDirectory,
    onCopyProjectPath,
    onOpenInTerminal,
    onOpenInFileExplorer,
    onPinAgentSession,
    onArchiveAgentSession,
    onMarkAgentSessionUnread,
    onCopyAgentSessionWorkingDirectory,
    onCopyAgentSessionProviderSessionId,
    onCopyAgentSessionDeeplink,
    onOpenAgentSessionInTerminal,
    onForkAgentSessionLocal,
    onForkAgentSessionNewTree,
    refreshingProjectId,
    refreshingAgentSessionId,
    searchQuery,
    setSearchQuery,
  }), [
    currentProjectId,
    filteredProjects,
    hasMoreProjects,
    hasProjectsLoadError,
    isLoadingProjects,
    isLoadingMoreProjects,
    isSidebarVisible,
    isVisible,
    onArchiveAgentSession,
    onArchiveProject,
    onCopyAgentSessionDeeplink,
    onCopyAgentSessionProviderSessionId,
    onCopyAgentSessionWorkingDirectory,
    onCopyProjectPath,
    onCopyWorkingDirectory,
    onDeleteAgentSession,
    onDeleteProject,
    onForkAgentSessionLocal,
    onForkAgentSessionNewTree,
    onMarkAgentSessionUnread,
    onNewAgentSessionInProject,
    onNewProject,
    onLoadMoreProjects,
    onRetryProjects,
    onLoadMoreProjectSessions,
    onOpenFolder,
    onOpenAgentSessionInTerminal,
    onOpenInFileExplorer,
    onOpenInTerminal,
    onPinAgentSession,
    onProjectSelect,
    onRefreshAgentSessionItems,
    onRefreshProjectSessions,
    onRenameAgentSession,
    onRenameProject,
    onSelectAgentSession,
    projects,
    refreshingAgentSessionId,
    refreshingProjectId,
    searchQuery,
    sessionId,
    setSearchQuery,
    sidebarWidth,
  ]);

  const overlayProps = useMemo<CodeWorkspaceOverlaysComponentProps>(() => ({
    currentProjectId: currentProjectId || undefined,
    files,
    mountRecoveryState,
    isMountRecoveryActionPending,
    isFindVisible,
    isSearchingFiles,
    isQuickOpenVisible,
    searchFiles: onSearchFiles,
    onSelectFile,
    onRetryMountRecovery,
    onReimportProjectFolder,
    onCloseFind,
    onCloseQuickOpen,
    onNotifyNoResults,
  }), [
    currentProjectId,
    files,
    isFindVisible,
    isMountRecoveryActionPending,
    isQuickOpenVisible,
    isSearchingFiles,
    mountRecoveryState,
    onCloseFind,
    onCloseQuickOpen,
    onNotifyNoResults,
    onReimportProjectFolder,
    onRetryMountRecovery,
    onSearchFiles,
    onSelectFile,
  ]);

  const dialogProps = useMemo<CodePageDialogsComponentProps>(() => ({
    isRunConfigVisible,
    runConfigurationDraft,
    onRunConfigurationDraftChange,
    onCloseRunConfig,
    onSubmitRunConfig,
    isDebugConfigVisible,
    onCloseDebugConfig,
    onSaveDebugConfig,
    isRunTaskVisible,
    runConfigurations,
    onCloseRunTask,
    onRunTask,
    deleteConfirmation,
    onCancelDelete,
    onConfirmDelete,
  }), [
    deleteConfirmation,
    isDebugConfigVisible,
    isRunConfigVisible,
    isRunTaskVisible,
    onCancelDelete,
    onCloseDebugConfig,
    onCloseRunConfig,
    onCloseRunTask,
    onConfirmDelete,
    onRunConfigurationDraftChange,
    onRunTask,
    onSaveDebugConfig,
    onSubmitRunConfig,
    runConfigurationDraft,
    runConfigurations,
  ]);

  const topBarProps = useMemo<TopBarComponentProps>(() => ({
    projectId,
    projectName,
    projectGitOverviewState,
    isProjectGitOverviewDrawerOpen,
    onToggleProjectGitOverviewDrawer,
    isEngineBusyCurrentSession,
    selectedSessionTitle,
    activeTab,
    setActiveTab: onSetActiveTab,
    isTerminalOpen,
    setIsTerminalOpen: onSetIsTerminalOpen,
  }), [
    activeTab,
    isEngineBusyCurrentSession,
    isTerminalOpen,
    onToggleProjectGitOverviewDrawer,
    onSetActiveTab,
    onSetIsTerminalOpen,
    isProjectGitOverviewDrawerOpen,
    projectId,
    projectGitOverviewState,
    projectName,
    selectedSessionTitle,
  ]);

  const mainChatProps = useMemo<UniversalChatComponentProps>(() => ({
    agentId: selectedSessionAgentId || undefined,
    runtimeBindingId: selectedSessionRuntimeBindingId,
    sessionId: sessionId || undefined,
    sessionScopeKey: transcriptSessionScopeKey,
    messages: mainChatMessages,
    hasMoreRemoteMessages,
    isLoadingMoreRemoteMessages,
    remoteMessagesLoadError,
    onLoadMoreRemoteMessages,
    pendingApprovals: activeTab === 'ai' ? pendingApprovals : [],
    pendingUserQuestions: activeTab === 'ai' ? pendingUserQuestions : [],
    hasPendingInteractionsLoadError: activeTab === 'ai' && Boolean(pendingInteractionsError),
    isLoadingPendingInteractions: activeTab === 'ai' && arePendingInteractionsLoading,
    onSendMessage,
    onStopTurn,
    onSubmitApprovalDecision,
    onSubmitUserQuestionAnswer,
    onRetryPendingInteractions,
    isBusy: isChatBusy,
    isEngineBusy: isChatEngineBusy,
    isNewSession,
    selectedEngineId: selectedSessionEngineId ?? selectedEngineId,
    selectedModelId: selectedSessionModelId ?? selectedModelId,
    showEngineHeader: false,
    showComposerEngineSelector: shouldShowCodeComposerModelSelector,
    setSelectedEngineId: onSelectedEngineIdChange,
    setSelectedModelId: onSelectedModelIdChange,
    layout: 'main',
    onOpenFile: onOpenMessageFile,
    resolveLocalImagePreviewUrl,
    onViewChanges: onViewChangesAndOpenEditor,
    onRestore: onRestoreMessage,
    onRateMessage,
    onForkMessage,
    emptyState: mainChatEmptyState,
    newSessionContext: createElement(CodeNewSessionContext, {
      cloudExecutionAvailable: cloudTaskExecutionAvailable,
      executionTarget: newTaskExecutionTarget,
      hasMoreProjects,
      isLoadingMoreProjects,
      localExecutionAvailable: localTaskExecutionAvailable,
      onLoadMoreProjects,
      onExecutionTargetChange: onNewTaskExecutionTargetChange,
      onNewProject,
      onProjectSelect: onNewSessionProjectSelect,
      projectGitOverviewState,
      projectId: currentProjectId || projectId,
      projectName,
      projects,
    }),
  }), [
    activeTab,
    currentProjectId,
    hasMoreProjects,
    hasMoreRemoteMessages,
    remoteMessagesLoadError,
    isLoadingMoreProjects,
    cloudTaskExecutionAvailable,
    localTaskExecutionAvailable,
    isLoadingMoreRemoteMessages,
    isChatEngineBusy,
    isChatBusy,
    isNewSession,
    mainChatEmptyState,
    mainChatMessages,
    onSubmitApprovalDecision,
    onSubmitUserQuestionAnswer,
    onOpenMessageFile,
    onLoadMoreRemoteMessages,
    onLoadMoreProjects,
    onNewTaskExecutionTargetChange,
    onNewProject,
    onNewSessionProjectSelect,
    onRestoreMessage,
    onRateMessage,
    onForkMessage,
    resolveLocalImagePreviewUrl,
    onSelectedEngineIdChange,
    onSelectedModelIdChange,
    onSendMessage,
    onStopTurn,
    onViewChangesAndOpenEditor,
    pendingApprovals,
    pendingInteractionsError,
    pendingUserQuestions,
    arePendingInteractionsLoading,
    projectGitOverviewState,
    projectId,
    projectName,
    projects,
    newTaskExecutionTarget,
    selectedEngineId,
    selectedModelId,
    selectedSessionEngineId,
    selectedSessionModelId,
    selectedSessionAgentId,
    selectedSessionRuntimeBindingId,
    sessionId,
    shouldShowCodeComposerModelSelector,
    transcriptSessionScopeKey,
  ]);

  const workspaceProps = useMemo<Omit<CodeEditorWorkspacePanelProps, 'isActive'>>(() => ({
    currentProjectId: currentProjectId || undefined,
    files,
    projectRootPath,
    fileTreeLoadError,
    isFileTreeLoading,
    loadingDirectoryPaths,
    openFiles,
    selectedFile,
    viewingDiff,
    fileContent,
    explorerWidth: editorExplorerWidth,
    chatWidth,
    selectedAgentSessionId: sessionId,
    selectedAgentSessionAgentId: selectedSessionAgentId,
    selectedAgentSessionRuntimeBindingId: selectedSessionRuntimeBindingId,
    selectedAgentSessionScopeKey: transcriptSessionScopeKey,
    messages: editorChatMessages,
    hasMoreRemoteMessages,
    isLoadingMoreRemoteMessages,
    remoteMessagesLoadError,
    isNewSession,
    pendingApprovals: activeTab === 'editor' ? pendingApprovals : [],
    pendingUserQuestions: activeTab === 'editor' ? pendingUserQuestions : [],
    hasPendingInteractionsLoadError: activeTab === 'editor' && Boolean(pendingInteractionsError),
    isLoadingPendingInteractions: activeTab === 'editor' && arePendingInteractionsLoading,
    chatEmptyState: editorChatEmptyState,
    isBusy: isChatBusy,
    isEngineBusy: isChatEngineBusy,
    showComposerEngineSelector: shouldShowCodeComposerModelSelector,
    selectedEngineId: selectedSessionEngineId ?? selectedEngineId,
    selectedModelId: selectedSessionModelId ?? selectedModelId,
    onSelectFile,
    onExpandDirectory,
    onCloseFile,
    onCreateFile,
    onCreateFolder,
    onDeleteFile,
    onDeleteFolder,
    onRenameNode,
    onRetryFileTreeLoad,
    onCloseDiff,
    onFileDraftChange,
    onExplorerResize,
    onChatResize,
    onSelectedEngineIdChange,
    onSelectedModelIdChange,
    onSendMessage,
    onStopTurn,
    onLoadMoreRemoteMessages,
    onSubmitApprovalDecision,
    onSubmitUserQuestionAnswer,
    onRetryPendingInteractions,
    onViewChanges,
    onRestoreMessage,
    onEditMessage,
    onDeleteMessage,
    onRegenerateMessage,
    onRateMessage,
    onForkMessage,
    resolveLocalImagePreviewUrl,
    onCreateRootFile,
    getLanguageFromPath,
  }), [
    activeTab,
    currentProjectId,
    editorChatEmptyState,
    editorChatMessages,
    editorExplorerWidth,
    chatWidth,
    fileContent,
    fileTreeLoadError,
    files,
    projectRootPath,
    hasMoreRemoteMessages,
    remoteMessagesLoadError,
    isChatEngineBusy,
    isChatBusy,
    isLoadingMoreRemoteMessages,
    isNewSession,
    isFileTreeLoading,
    loadingDirectoryPaths,
    onChatResize,
    onCloseFile,
    onCreateFile,
    onCreateFolder,
    onCreateRootFile,
    onDeleteFile,
    onDeleteFolder,
    onDeleteMessage,
    onEditMessage,
    onExpandDirectory,
    onExplorerResize,
    onFileDraftChange,
    onRegenerateMessage,
    onRateMessage,
    onForkMessage,
    resolveLocalImagePreviewUrl,
    onCloseDiff,
    onRenameNode,
    onRetryFileTreeLoad,
    onRestoreMessage,
    onSelectFile,
    onSelectedEngineIdChange,
    onSelectedModelIdChange,
    onSendMessage,
    onStopTurn,
    onLoadMoreRemoteMessages,
    onSubmitApprovalDecision,
    onSubmitUserQuestionAnswer,
    onViewChanges,
    openFiles,
    pendingApprovals,
    pendingInteractionsError,
    pendingUserQuestions,
    arePendingInteractionsLoading,
    selectedEngineId,
    selectedFile,
    selectedModelId,
    selectedSessionEngineId,
    selectedSessionModelId,
    selectedSessionAgentId,
    selectedSessionRuntimeBindingId,
    sessionId,
    shouldShowCodeComposerModelSelector,
    transcriptSessionScopeKey,
    viewingDiff,
  ]);

  const gitOverviewDrawerProps = useMemo<ComponentProps<typeof ProjectGitOverviewDrawer>>(() => ({
    isOpen: isProjectGitOverviewDrawerOpen,
    onClose: onCloseProjectGitOverviewDrawer,
    projectId: currentProjectId || undefined,
    projectGitOverviewState,
  }), [
    currentProjectId,
    isProjectGitOverviewDrawerOpen,
    onCloseProjectGitOverviewDrawer,
    projectGitOverviewState,
  ]);

  const mobileProgrammingProps = useMemo<
    Omit<CodeMobileProgrammingPanelComponentProps, 'isActive'>
  >(() => ({
    projectId: currentProjectId || undefined,
    projectName,
    sessionId: sessionId || undefined,
    sessionTitle: selectedSessionTitle,
  }), [
    currentProjectId,
    projectName,
    selectedSessionTitle,
    sessionId,
  ]);

  const terminalProps = useMemo<CodeTerminalIntegrationPanelComponentProps>(() => ({
    isOpen: isTerminalOpen,
    height: terminalHeight,
    terminalRequest,
    projectId: currentProjectId,
    runtimeLocationId: selectedSessionRuntimeLocationId,
    onResize: onTerminalResize,
    onClose: onCloseTerminal,
  }), [
    currentProjectId,
    isTerminalOpen,
    onCloseTerminal,
    onTerminalResize,
    selectedSessionRuntimeLocationId,
    terminalHeight,
    terminalRequest,
  ]);

  return {
    dialogProps,
    gitOverviewDrawerProps,
    mainChatProps,
    mobileProgrammingProps,
    overlayProps,
    projectExplorerProps,
    terminalProps,
    topBarProps,
    workspaceProps,
  };
}

