import { useMemo, type ComponentProps, type ReactNode } from 'react';
import type {
  ProjectGitOverviewViewState,
  TerminalCommandRequest,
} from '@sdkwork/birdcoder-commons';
import type { BirdCoderChatMessage, BirdCoderProject, FileChange } from '@sdkwork/birdcoder-types';
import { ProjectGitOverviewDrawer, UniversalChat, type FileNode } from '@sdkwork/birdcoder-ui';
import type { ProjectExplorerProps } from '../components/ProjectExplorer.types';
import { TopBar } from '../components/TopBar';
import { CodeMobileProgrammingPanel } from './CodeMobileProgrammingPanel';
import { CodePageDialogs, type CodeDeleteConfirmation } from './CodePageDialogs';
import { CodeTerminalIntegrationPanel } from './CodeTerminalIntegrationPanel';
import { CodeWorkspaceOverlays } from './CodeWorkspaceOverlays';
import { getLanguageFromPath } from './CodePageShared';
import type { CodeEditorWorkspacePanelProps } from './codeEditorWorkspacePanel.types';
import { useCodePendingInteractions } from './useCodePendingInteractions';

type CodePageTab = 'ai' | 'editor' | 'mobile';

type UniversalChatComponentProps = ComponentProps<typeof UniversalChat>;
type TopBarComponentProps = ComponentProps<typeof TopBar>;
type CodePageDialogsComponentProps = ComponentProps<typeof CodePageDialogs>;
type CodeWorkspaceOverlaysComponentProps = ComponentProps<typeof CodeWorkspaceOverlays>;
type CodeTerminalIntegrationPanelComponentProps =
  ComponentProps<typeof CodeTerminalIntegrationPanel>;
type CodeMobileProgrammingPanelComponentProps =
  ComponentProps<typeof CodeMobileProgrammingPanel>;

const EMPTY_CHAT_MESSAGES: BirdCoderChatMessage[] = [];

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
  projectPath?: string;
  deleteConfirmation: CodeDeleteConfirmation | null;
  editorChatEmptyState?: ReactNode;
  editorExplorerWidth: number;
  chatWidth: number;
  fileContent: string;
  files: FileNode[];
  filteredProjects: BirdCoderProject[];
  isChatBusy: boolean;
  isChatEngineBusy: boolean;
  isDebugConfigVisible: boolean;
  isFindVisible: boolean;
  isMountRecoveryActionPending: boolean;
  isQuickOpenVisible: boolean;
  isRunConfigVisible: boolean;
  isRunTaskVisible: boolean;
  isSearchingFiles: boolean;
  isSelectedSessionEngineBusy: boolean;
  isSidebarVisible: boolean;
  isTerminalOpen: boolean;
  isVisible: boolean;
  loadingDirectoryPaths: Record<string, boolean>;
  mainChatEmptyState?: ReactNode;
  mountRecoveryState: CodeWorkspaceOverlaysComponentProps['mountRecoveryState'];
  openFiles: string[];
  refreshingCodingSessionId: string | null;
  refreshingProjectId: string | null;
  runConfigurationDraft: CodePageDialogsComponentProps['runConfigurationDraft'];
  runConfigurations: CodePageDialogsComponentProps['runConfigurations'];
  searchQuery: string;
  selectedCodingSessionMessages: BirdCoderChatMessage[];
  selectedEngineId: string;
  selectedFile?: string | null;
  selectedModelId: string;
  selectedSessionTitle?: string;
  selectedSessionEngineId?: string;
  selectedSessionModelId?: string;
  sessionId: string | null;
  showComposerEngineSelector: boolean;
  sidebarWidth: number;
  terminalHeight: number;
  terminalRequest?: TerminalCommandRequest;
  viewingDiff: FileChange | null;
  workspaceId?: string;
  onAcceptDiff: CodeEditorWorkspacePanelProps['onAcceptDiff'];
  onArchiveCodingSession: NonNullable<ProjectExplorerProps['onArchiveCodingSession']>;
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
  onCopyCodingSessionDeeplink: NonNullable<ProjectExplorerProps['onCopyCodingSessionDeeplink']>;
  onCopyCodingSessionSessionId: NonNullable<ProjectExplorerProps['onCopyCodingSessionSessionId']>;
  onCopyCodingSessionWorkingDirectory:
    NonNullable<ProjectExplorerProps['onCopyCodingSessionWorkingDirectory']>;
  onCopyProjectPath: NonNullable<ProjectExplorerProps['onCopyProjectPath']>;
  onCopyWorkingDirectory: NonNullable<ProjectExplorerProps['onCopyWorkingDirectory']>;
  onCreateFile: CodeEditorWorkspacePanelProps['onCreateFile'];
  onCreateFolder: CodeEditorWorkspacePanelProps['onCreateFolder'];
  onCreateNewSession: TopBarComponentProps['onCreateNewSession'];
  onCreateRootFile: CodeEditorWorkspacePanelProps['onCreateRootFile'];
  onCloseProjectGitOverviewDrawer: () => void;
  onDeleteCodingSession: NonNullable<ProjectExplorerProps['onDeleteCodingSession']>;
  onDeleteFile: CodeEditorWorkspacePanelProps['onDeleteFile'];
  onDeleteFolder: CodeEditorWorkspacePanelProps['onDeleteFolder'];
  onDeleteMessage: NonNullable<UniversalChatComponentProps['onDeleteMessage']>;
  onDeleteProject: NonNullable<ProjectExplorerProps['onDeleteProject']>;
  onEditMessage: NonNullable<UniversalChatComponentProps['onEditMessage']>;
  onExpandDirectory: CodeEditorWorkspacePanelProps['onExpandDirectory'];
  onExplorerResize: CodeEditorWorkspacePanelProps['onExplorerResize'];
  onFileDraftChange: CodeEditorWorkspacePanelProps['onFileDraftChange'];
  onForkCodingSessionLocal: NonNullable<ProjectExplorerProps['onForkCodingSessionLocal']>;
  onForkCodingSessionNewTree: NonNullable<ProjectExplorerProps['onForkCodingSessionNewTree']>;
  onMarkCodingSessionUnread: NonNullable<ProjectExplorerProps['onMarkCodingSessionUnread']>;
  onNewCodingSessionInProject: NonNullable<ProjectExplorerProps['onNewCodingSessionInProject']>;
  onNewProject: NonNullable<ProjectExplorerProps['onNewProject']>;
  onNotifyNoResults: NonNullable<CodeWorkspaceOverlaysComponentProps['onNotifyNoResults']>;
  onOpenFolder: NonNullable<ProjectExplorerProps['onOpenFolder']>;
  onOpenInFileExplorer: NonNullable<ProjectExplorerProps['onOpenInFileExplorer']>;
  onOpenInTerminal: NonNullable<ProjectExplorerProps['onOpenInTerminal']>;
  onOpenCodingSessionInTerminal:
    NonNullable<ProjectExplorerProps['onOpenCodingSessionInTerminal']>;
  onPinCodingSession: NonNullable<ProjectExplorerProps['onPinCodingSession']>;
  onProjectSelect: NonNullable<ProjectExplorerProps['onSelectProject']>;
  onRefreshCodingSessionMessages:
    NonNullable<ProjectExplorerProps['onRefreshCodingSessionMessages']>;
  onRefreshProjectSessions: NonNullable<ProjectExplorerProps['onRefreshProjectSessions']>;
  onRegenerateMessage: NonNullable<UniversalChatComponentProps['onRegenerateMessage']>;
  onRejectDiff: CodeEditorWorkspacePanelProps['onRejectDiff'];
  onReimportProjectFolder:
    NonNullable<CodeWorkspaceOverlaysComponentProps['onReimportProjectFolder']>;
  onRenameCodingSession: NonNullable<ProjectExplorerProps['onRenameCodingSession']>;
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
  onSelectCodingSession: NonNullable<ProjectExplorerProps['onSelectCodingSession']>;
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
  projectPath,
  deleteConfirmation,
  editorChatEmptyState,
  editorExplorerWidth,
  chatWidth,
  fileContent,
  files,
  filteredProjects,
  isChatBusy,
  isChatEngineBusy,
  isDebugConfigVisible,
  isFindVisible,
  isMountRecoveryActionPending,
  isQuickOpenVisible,
  isRunConfigVisible,
  isRunTaskVisible,
  isSearchingFiles,
  isSelectedSessionEngineBusy,
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
  selectedEngineId,
  selectedFile,
  selectedModelId,
  selectedSessionTitle,
  selectedSessionEngineId,
  selectedSessionModelId,
  sessionId,
  showComposerEngineSelector,
  sidebarWidth,
  terminalHeight,
  terminalRequest,
  viewingDiff,
  workspaceId,
  onAcceptDiff,
  onArchiveCodingSession,
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
  onCopyCodingSessionDeeplink,
  onCopyCodingSessionSessionId,
  onCopyCodingSessionWorkingDirectory,
  onCopyProjectPath,
  onCopyWorkingDirectory,
  onCreateFile,
  onCreateFolder,
  onCreateNewSession,
  onCreateRootFile,
  onCloseProjectGitOverviewDrawer,
  onDeleteCodingSession,
  onDeleteFile,
  onDeleteFolder,
  onDeleteMessage,
  onDeleteProject,
  onEditMessage,
  onExpandDirectory,
  onExplorerResize,
  onFileDraftChange,
  onForkCodingSessionLocal,
  onForkCodingSessionNewTree,
  onMarkCodingSessionUnread,
  onNewCodingSessionInProject,
  onNewProject,
  onNotifyNoResults,
  onOpenFolder,
  onOpenInFileExplorer,
  onOpenInTerminal,
  onOpenCodingSessionInTerminal,
  onPinCodingSession,
  onProjectSelect,
  onRefreshCodingSessionMessages,
  onRefreshProjectSessions,
  onRegenerateMessage,
  onRejectDiff,
  onReimportProjectFolder,
  onRenameCodingSession,
  onRenameNode,
  onRenameProject,
  onRestoreMessage,
  onRetryMountRecovery,
  onRunConfigurationDraftChange,
  onRunTask,
  onSaveDebugConfig,
  onSearchFiles,
  onSelectCodingSession,
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
  const mainChatMessages =
    activeTab === 'ai' ? selectedCodingSessionMessages : EMPTY_CHAT_MESSAGES;
  const editorChatMessages =
    activeTab === 'editor' ? selectedCodingSessionMessages : EMPTY_CHAT_MESSAGES;
  const transcriptSessionScopeKey =
    workspaceId && currentProjectId && sessionId
      ? `${workspaceId}\u0001${currentProjectId}\u0001${sessionId}`
      : sessionId || undefined;
  const pendingInteractionRefreshToken = useMemo(() => {
    const lastMessage = selectedCodingSessionMessages[selectedCodingSessionMessages.length - 1];
    return [
      sessionId ?? '',
      isChatBusy ? 'busy' : 'idle',
      selectedCodingSessionMessages.length,
      lastMessage?.id ?? '',
      lastMessage?.content.length ?? 0,
      lastMessage?.commands?.length ?? 0,
    ].join('\u0001');
  }, [isChatBusy, selectedCodingSessionMessages, sessionId]);
  const {
    onSubmitApprovalDecision,
    onSubmitUserQuestionAnswer,
    pendingApprovals,
    pendingUserQuestions,
  } = useCodePendingInteractions({
    onRefreshCodingSessionMessages,
    refreshToken: pendingInteractionRefreshToken,
    sessionId,
  });

  const projectExplorerProps = useMemo<ProjectExplorerProps>(() => ({
    isVisible: isVisible && isSidebarVisible,
    width: sidebarWidth,
    projects: filteredProjects,
    selectedProjectId: currentProjectId,
    selectedCodingSessionId: sessionId,
    onSelectProject: onProjectSelect,
    onSelectCodingSession,
    onRenameCodingSession,
    onDeleteCodingSession,
    onRenameProject,
    onDeleteProject,
    onNewProject,
    onOpenFolder,
    onNewCodingSessionInProject,
    onRefreshProjectSessions,
    onRefreshCodingSessionMessages,
    onArchiveProject,
    onCopyWorkingDirectory,
    onCopyProjectPath,
    onOpenInTerminal,
    onOpenInFileExplorer,
    onOpenCodingSessionInTerminal,
    onPinCodingSession,
    onArchiveCodingSession,
    onMarkCodingSessionUnread,
    onCopyCodingSessionWorkingDirectory,
    onCopyCodingSessionSessionId,
    onCopyCodingSessionDeeplink,
    onForkCodingSessionLocal,
    onForkCodingSessionNewTree,
    refreshingProjectId,
    refreshingCodingSessionId,
    searchQuery,
    setSearchQuery,
  }), [
    currentProjectId,
    filteredProjects,
    isSidebarVisible,
    isVisible,
    onArchiveCodingSession,
    onArchiveProject,
    onCopyCodingSessionDeeplink,
    onCopyCodingSessionSessionId,
    onCopyCodingSessionWorkingDirectory,
    onCopyProjectPath,
    onCopyWorkingDirectory,
    onDeleteCodingSession,
    onDeleteProject,
    onForkCodingSessionLocal,
    onForkCodingSessionNewTree,
    onMarkCodingSessionUnread,
    onNewCodingSessionInProject,
    onNewProject,
    onOpenFolder,
    onOpenCodingSessionInTerminal,
    onOpenInFileExplorer,
    onOpenInTerminal,
    onPinCodingSession,
    onProjectSelect,
    onRefreshCodingSessionMessages,
    onRefreshProjectSessions,
    onRenameCodingSession,
    onRenameProject,
    onSelectCodingSession,
    refreshingCodingSessionId,
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
    onCreateNewSession,
    onToggleProjectGitOverviewDrawer,
    selectedSessionTitle,
    selectedSessionEngineId,
    selectedSessionModelId,
    isSelectedSessionEngineBusy,
    selectedEngineId,
    selectedModelId,
    activeTab,
    setActiveTab: onSetActiveTab,
    isTerminalOpen,
    setIsTerminalOpen: onSetIsTerminalOpen,
  }), [
    activeTab,
    isSelectedSessionEngineBusy,
    isTerminalOpen,
    onCreateNewSession,
    onToggleProjectGitOverviewDrawer,
    onSetActiveTab,
    onSetIsTerminalOpen,
    isProjectGitOverviewDrawerOpen,
    projectId,
    projectGitOverviewState,
    projectName,
    selectedEngineId,
    selectedModelId,
    selectedSessionEngineId,
    selectedSessionModelId,
    selectedSessionTitle,
  ]);

  const mainChatProps = useMemo<UniversalChatComponentProps>(() => ({
    sessionId: activeTab === 'ai' ? (sessionId || undefined) : undefined,
    sessionScopeKey: activeTab === 'ai' ? transcriptSessionScopeKey : undefined,
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
    showComposerEngineSelector,
    setSelectedEngineId: onSelectedEngineIdChange,
    setSelectedModelId: onSelectedModelIdChange,
    layout: 'main',
    onEditMessage,
    onDeleteMessage,
    onRegenerateMessage,
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
    showComposerEngineSelector,
    transcriptSessionScopeKey,
  ]);

  const workspaceProps = useMemo<Omit<CodeEditorWorkspacePanelProps, 'isActive'>>(() => ({
    currentProjectId: currentProjectId || undefined,
    files,
    loadingDirectoryPaths,
    openFiles,
    selectedFile,
    currentProjectPath: projectPath,
    viewingDiff,
    fileContent,
    explorerWidth: editorExplorerWidth,
    chatWidth,
    selectedCodingSessionId: activeTab === 'editor' ? sessionId : undefined,
    selectedCodingSessionScopeKey: activeTab === 'editor' ? transcriptSessionScopeKey : undefined,
    messages: editorChatMessages,
    pendingApprovals: activeTab === 'editor' ? pendingApprovals : [],
    pendingUserQuestions: activeTab === 'editor' ? pendingUserQuestions : [],
    chatEmptyState: editorChatEmptyState,
    isBusy: isChatBusy,
    isEngineBusy: isChatEngineBusy,
    showComposerEngineSelector,
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
    onAcceptDiff,
    onRejectDiff,
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
    onAcceptDiff,
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
    onRejectDiff,
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
    projectPath,
    selectedEngineId,
    selectedFile,
    selectedModelId,
    selectedSessionEngineId,
    selectedSessionModelId,
    sessionId,
    showComposerEngineSelector,
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
    workspaceId,
    projectId: currentProjectId || undefined,
    projectName,
    sessionId: sessionId || undefined,
    sessionTitle: selectedSessionTitle,
  }), [
    currentProjectId,
    projectName,
    selectedSessionTitle,
    sessionId,
    workspaceId,
  ]);

  const terminalProps = useMemo<CodeTerminalIntegrationPanelComponentProps>(() => ({
    isOpen: isTerminalOpen,
    height: terminalHeight,
    terminalRequest,
    workspaceId,
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
    workspaceId,
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
