import { useMemo, type ComponentProps, type ReactNode } from 'react';
import type {
  ProjectGitOverviewViewState,
  TerminalCommandRequest,
} from '@sdkwork/birdcoder-pc-workbench';
import type { AgentSessionItemView, AgentProjectView, FileChange } from '@sdkwork/birdcoder-pc-contracts-commons';
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
import { getLanguageFromPath } from './CodePageShared';
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
  filteredProjects: AgentProjectView[];
  hasMoreProjects: boolean;
  isChatBusy: boolean;
  isChatEngineBusy: boolean;
  isEngineBusyCurrentSession: boolean;
  isDebugConfigVisible: boolean;
  isFindVisible: boolean;
  isMountRecoveryActionPending: boolean;
  isLoadingMoreProjects: boolean;
  isQuickOpenVisible: boolean;
  isRunConfigVisible: boolean;
  isRunTaskVisible: boolean;
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
  selectedFile?: string | null;
  selectedModelId: string;
  selectedSessionLastTurnAt?: string | null;
  selectedSessionTitle?: string;
  selectedSessionEngineId?: string;
  selectedSessionModelId?: string;
  selectedSessionRuntimeStatus?: string;
  selectedSessionTranscriptUpdatedAt?: string | null;
  selectedSessionUpdatedAt?: string;
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
  onCopyAgentSessionSessionId: NonNullable<ProjectExplorerProps['onCopyAgentSessionSessionId']>;
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
  onNewProject: NonNullable<ProjectExplorerProps['onNewProject']>;
  onLoadMoreProjects: NonNullable<ProjectExplorerProps['onLoadMoreProjects']>;
  onLoadMoreProjectSessions: NonNullable<ProjectExplorerProps['onLoadMoreProjectSessions']>;
  onNotifyNoResults: NonNullable<CodeWorkspaceOverlaysComponentProps['onNotifyNoResults']>;
  onOpenFolder: NonNullable<ProjectExplorerProps['onOpenFolder']>;
  onOpenInFileExplorer: NonNullable<ProjectExplorerProps['onOpenInFileExplorer']>;
  onOpenInTerminal: NonNullable<ProjectExplorerProps['onOpenInTerminal']>;
  onOpenMessageFile: NonNullable<UniversalChatComponentProps['onOpenFile']>;
  onPinAgentSession: NonNullable<ProjectExplorerProps['onPinAgentSession']>;
  onProjectSelect: NonNullable<ProjectExplorerProps['onSelectProject']>;
  onRefreshAgentSessionItems:
    NonNullable<ProjectExplorerProps['onRefreshAgentSessionItems']>;
  onRefreshProjectSessions: NonNullable<ProjectExplorerProps['onRefreshProjectSessions']>;
  onRegenerateMessage: NonNullable<UniversalChatComponentProps['onRegenerateMessage']>;
  onCloseDiff: CodeEditorWorkspacePanelProps['onCloseDiff'];
  onReimportProjectFolder:
    NonNullable<CodeWorkspaceOverlaysComponentProps['onReimportProjectFolder']>;
  onRenameAgentSession: NonNullable<ProjectExplorerProps['onRenameAgentSession']>;
  onRenameNode: CodeEditorWorkspacePanelProps['onRenameNode'];
  onRenameProject: NonNullable<ProjectExplorerProps['onRenameProject']>;
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
  filteredProjects,
  hasMoreProjects,
  isChatBusy,
  isChatEngineBusy,
  isEngineBusyCurrentSession,
  isDebugConfigVisible,
  isFindVisible,
  isMountRecoveryActionPending,
  isLoadingMoreProjects,
  isQuickOpenVisible,
  isRunConfigVisible,
  isRunTaskVisible,
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
  selectedFile,
  selectedModelId,
  selectedSessionLastTurnAt,
  selectedSessionTitle,
  selectedSessionEngineId,
  selectedSessionModelId,
  selectedSessionRuntimeStatus,
  selectedSessionTranscriptUpdatedAt,
  selectedSessionUpdatedAt,
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
  onCopyAgentSessionSessionId,
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
  onNewProject,
  onLoadMoreProjects,
  onLoadMoreProjectSessions,
  onNotifyNoResults,
  onOpenFolder,
  onOpenInFileExplorer,
  onOpenInTerminal,
  onOpenMessageFile,
  onPinAgentSession,
  onProjectSelect,
  onRefreshAgentSessionItems,
  onRefreshProjectSessions,
  onRegenerateMessage,
  onCloseDiff,
  onReimportProjectFolder,
  onRenameAgentSession,
  onRenameNode,
  onRenameProject,
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
  const transcriptSessionScopeKey =
    currentProjectId && sessionId
      ? `${currentProjectId}\u0001${sessionId}`
      : sessionId || undefined;
  const pendingInteractionRefreshToken = useMemo(() => {
    return [
      sessionId ?? '',
      selectedSessionRuntimeStatus ?? '',
      selectedSessionUpdatedAt ?? '',
      selectedSessionLastTurnAt ?? '',
      selectedSessionTranscriptUpdatedAt ?? '',
      isChatBusy ? 'busy' : 'idle',
    ].join('\u0001');
  }, [
    isChatBusy,
    selectedSessionLastTurnAt,
    selectedSessionRuntimeStatus,
    selectedSessionTranscriptUpdatedAt,
    selectedSessionUpdatedAt,
    sessionId,
  ]);
  const {
    onSubmitApprovalDecision,
    onSubmitUserQuestionAnswer,
    pendingApprovals,
    pendingUserQuestions,
  } = useCodePendingInteractions({
    onRefreshAgentSessionItems,
    projectId: currentProjectId,
    refreshToken: pendingInteractionRefreshToken,
    sessionId,
    sessionScopeKey: transcriptSessionScopeKey,
  });

  const projectExplorerProps = useMemo<ProjectExplorerProps>(() => ({
    hasMoreProjects,
    isLoadingMoreProjects,
    isVisible: isVisible && isSidebarVisible,
    width: sidebarWidth,
    projects: filteredProjects,
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
    onCopyAgentSessionSessionId,
    onCopyAgentSessionDeeplink,
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
    isLoadingMoreProjects,
    isSidebarVisible,
    isVisible,
    onArchiveAgentSession,
    onArchiveProject,
    onCopyAgentSessionDeeplink,
    onCopyAgentSessionSessionId,
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
    onLoadMoreProjectSessions,
    onOpenFolder,
    onOpenInFileExplorer,
    onOpenInTerminal,
    onPinAgentSession,
    onProjectSelect,
    onRefreshAgentSessionItems,
    onRefreshProjectSessions,
    onRenameAgentSession,
    onRenameProject,
    onSelectAgentSession,
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
    sessionId: sessionId || undefined,
    sessionScopeKey: transcriptSessionScopeKey,
    messages: mainChatMessages,
    pendingApprovals: activeTab === 'ai' ? pendingApprovals : [],
    pendingUserQuestions: activeTab === 'ai' ? pendingUserQuestions : [],
    onSendMessage,
    onSubmitApprovalDecision,
    onSubmitUserQuestionAnswer,
    isBusy: isChatBusy,
    isEngineBusy: isChatEngineBusy,
    selectedEngineId: selectedSessionEngineId ?? selectedEngineId,
    selectedModelId: selectedSessionModelId ?? selectedModelId,
    showEngineHeader: false,
    showComposerEngineSelector: shouldShowCodeComposerModelSelector,
    setSelectedEngineId: onSelectedEngineIdChange,
    setSelectedModelId: onSelectedModelIdChange,
    layout: 'main',
    onEditMessage,
    onDeleteMessage,
    onRegenerateMessage,
    onOpenFile: onOpenMessageFile,
    onViewChanges: onViewChangesAndOpenEditor,
    onRestore: onRestoreMessage,
    emptyState: mainChatEmptyState,
  }), [
    activeTab,
    isChatEngineBusy,
    isChatBusy,
    mainChatEmptyState,
    mainChatMessages,
    onSubmitApprovalDecision,
    onSubmitUserQuestionAnswer,
    onDeleteMessage,
    onEditMessage,
    onRegenerateMessage,
    onOpenMessageFile,
    onRestoreMessage,
    onSelectedEngineIdChange,
    onSelectedModelIdChange,
    onSendMessage,
    onViewChangesAndOpenEditor,
    pendingApprovals,
    pendingUserQuestions,
    selectedEngineId,
    selectedModelId,
    selectedSessionEngineId,
    selectedSessionModelId,
    sessionId,
    shouldShowCodeComposerModelSelector,
    transcriptSessionScopeKey,
  ]);

  const workspaceProps = useMemo<Omit<CodeEditorWorkspacePanelProps, 'isActive'>>(() => ({
    currentProjectId: currentProjectId || undefined,
    files,
    loadingDirectoryPaths,
    openFiles,
    selectedFile,
    viewingDiff,
    fileContent,
    explorerWidth: editorExplorerWidth,
    chatWidth,
    selectedAgentSessionId: sessionId,
    selectedAgentSessionScopeKey: transcriptSessionScopeKey,
    messages: editorChatMessages,
    pendingApprovals: activeTab === 'editor' ? pendingApprovals : [],
    pendingUserQuestions: activeTab === 'editor' ? pendingUserQuestions : [],
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
    onCloseDiff,
    onFileDraftChange,
    onExplorerResize,
    onChatResize,
    onSelectedEngineIdChange,
    onSelectedModelIdChange,
    onSendMessage,
    onSubmitApprovalDecision,
    onSubmitUserQuestionAnswer,
    onViewChanges,
    onRestoreMessage,
    onEditMessage,
    onDeleteMessage,
    onRegenerateMessage,
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
    files,
    isChatEngineBusy,
    isChatBusy,
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
    onCloseDiff,
    onRenameNode,
    onRestoreMessage,
    onSelectFile,
    onSelectedEngineIdChange,
    onSelectedModelIdChange,
    onSendMessage,
    onSubmitApprovalDecision,
    onSubmitUserQuestionAnswer,
    onViewChanges,
    openFiles,
    pendingApprovals,
    pendingUserQuestions,
    selectedEngineId,
    selectedFile,
    selectedModelId,
    selectedSessionEngineId,
    selectedSessionModelId,
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
    onResize: onTerminalResize,
    onClose: onCloseTerminal,
  }), [
    currentProjectId,
    isTerminalOpen,
    onCloseTerminal,
    onTerminalResize,
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

