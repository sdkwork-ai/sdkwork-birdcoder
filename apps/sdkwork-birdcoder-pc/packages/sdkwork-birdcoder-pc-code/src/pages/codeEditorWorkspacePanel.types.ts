import type { ReactNode } from 'react';
import type {
  AgentApprovalDecisionInput,
  AgentQuestionAnswerInput,
  AgentSessionPendingApproval,
  AgentSessionPendingQuestion,
} from '@sdkwork/birdcoder-pc-workbench';
import type { AgentSessionItemView, FileChange } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { FileNode } from '@sdkwork/birdcoder-pc-ui/components/FileExplorer';
import type {
  UniversalChatComposerSelection,
  UniversalChatComposerSubmission,
  UniversalChatProps,
} from '@sdkwork/birdcoder-pc-ui/components/UniversalChat';

export interface CodeEditorWorkspacePanelProps {
  isActive: boolean;
  currentProjectId?: string;
  files: FileNode[];
  projectRootPath: string;
  fileTreeLoadError: boolean;
  isFileTreeLoading: boolean;
  loadingDirectoryPaths: Record<string, boolean>;
  openFiles: string[];
  selectedFile?: string | null;
  viewingDiff: FileChange | null;
  fileContent: string;
  explorerWidth: number;
  chatWidth: number;
  selectedAgentSessionId?: string | null;
  selectedAgentSessionAgentId?: string | null;
  selectedAgentSessionRuntimeBindingId?: string | null;
  selectedAgentSessionScopeKey?: string | null;
  messages: AgentSessionItemView[];
  hasMoreRemoteMessages: boolean;
  isLoadingMoreRemoteMessages: boolean;
  remoteMessagesLoadError: string | null;
  isNewSession: boolean;
  pendingApprovals?: AgentSessionPendingApproval[];
  pendingUserQuestions?: AgentSessionPendingQuestion[];
  hasPendingInteractionsLoadError?: boolean;
  isLoadingPendingInteractions?: boolean;
  chatEmptyState?: ReactNode;
  isBusy: boolean;
  isEngineBusy: boolean;
  showComposerEngineSelector: boolean;
  selectedEngineId: string;
  selectedModelId: string;
  onSelectFile: (path: string) => void;
  onExpandDirectory: (path: string) => void | Promise<void>;
  onCloseFile: (path: string) => void;
  onCreateFile: (path: string) => void | Promise<void>;
  onCreateFolder: (path: string) => void | Promise<void>;
  onDeleteFile: (path: string) => void;
  onDeleteFolder: (path: string) => void;
  onRenameNode: (path: string, nextPath: string) => void | Promise<void>;
  onRetryFileTreeLoad: () => void | Promise<void>;
  onCloseDiff: () => void;
  onFileDraftChange: (value: string) => void;
  onExplorerResize: (delta: number) => void;
  onChatResize: (delta: number) => void;
  onSelectedEngineIdChange: (engineId: string) => void;
  onSelectedModelIdChange: (modelId: string, engineId?: string) => void;
  onSendMessage: (
    text?: string,
    composerSelection?: UniversalChatComposerSelection,
    submission?: UniversalChatComposerSubmission,
  ) => void | Promise<void>;
  onSubmitApprovalDecision: (
    interactionId: string,
    request: AgentApprovalDecisionInput,
  ) => void | Promise<void>;
  onStopTurn: () => void | Promise<void>;
  onLoadMoreRemoteMessages: () => void | Promise<void>;
  onSubmitUserQuestionAnswer: (
    interactionId: string,
    request: AgentQuestionAnswerInput,
  ) => void | Promise<void>;
  onRetryPendingInteractions: () => void | Promise<void>;
  onViewChanges: (file: FileChange) => void;
  onRestoreMessage: (messageId: string, fileChanges?: readonly FileChange[]) => void;
  onEditMessage: (messageId: string, content: string) => void | Promise<void>;
  onDeleteMessage: (messageIds: string[]) => void;
  onRegenerateMessage: () => void;
  onRateMessage: NonNullable<UniversalChatProps['onRateMessage']>;
  onForkMessage: NonNullable<UniversalChatProps['onForkMessage']>;
  resolveLocalImagePreviewUrl:
    NonNullable<UniversalChatProps['resolveLocalImagePreviewUrl']>;
  onCreateRootFile: () => void;
  getLanguageFromPath: (path: string) => string;
}

export interface EditorChatProps {
  chatEmptyState?: ReactNode;
  isActive: boolean;
  isBusy: boolean;
  isEngineBusy: boolean;
  messages: AgentSessionItemView[];
  hasMoreRemoteMessages: boolean;
  isLoadingMoreRemoteMessages: boolean;
  remoteMessagesLoadError: string | null;
  isNewSession: boolean;
  showComposerEngineSelector: boolean;
  selectedAgentSessionId?: string | null;
  selectedAgentSessionAgentId?: string | null;
  selectedAgentSessionRuntimeBindingId?: string | null;
  selectedAgentSessionScopeKey?: string | null;
  selectedEngineId: string;
  selectedModelId: string;
  pendingApprovals?: AgentSessionPendingApproval[];
  pendingUserQuestions?: AgentSessionPendingQuestion[];
  hasPendingInteractionsLoadError?: boolean;
  isLoadingPendingInteractions?: boolean;
  onDeleteMessage: (messageIds: string[]) => void;
  onEditMessage: (messageId: string, content: string) => void | Promise<void>;
  onRegenerateMessage: () => void;
  onRateMessage: NonNullable<UniversalChatProps['onRateMessage']>;
  onForkMessage: NonNullable<UniversalChatProps['onForkMessage']>;
  resolveLocalImagePreviewUrl:
    NonNullable<UniversalChatProps['resolveLocalImagePreviewUrl']>;
  onRestoreMessage: (messageId: string, fileChanges?: readonly FileChange[]) => void;
  onSelectedEngineIdChange: (engineId: string) => void;
  onSelectedModelIdChange: (modelId: string, engineId?: string) => void;
  onSendMessage: (
    text?: string,
    composerSelection?: UniversalChatComposerSelection,
    submission?: UniversalChatComposerSubmission,
  ) => void | Promise<void>;
  onSubmitApprovalDecision: (
    interactionId: string,
    request: AgentApprovalDecisionInput,
  ) => void | Promise<void>;
  onStopTurn: () => void | Promise<void>;
  onLoadMoreRemoteMessages: () => void | Promise<void>;
  onSubmitUserQuestionAnswer: (
    interactionId: string,
    request: AgentQuestionAnswerInput,
  ) => void | Promise<void>;
  onRetryPendingInteractions: () => void | Promise<void>;
  onViewChanges: (file: FileChange) => void;
  onOpenFile: (path: string) => void;
}

