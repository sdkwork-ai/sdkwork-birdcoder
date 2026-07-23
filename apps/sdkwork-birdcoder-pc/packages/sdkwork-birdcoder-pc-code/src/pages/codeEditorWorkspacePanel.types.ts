import type { ReactNode } from 'react';
import type {
  AgentApprovalDecisionInput,
  AgentQuestionAnswerInput,
  AgentSessionPendingApproval,
  AgentSessionPendingQuestion,
} from '@sdkwork/birdcoder-pc-workbench';
import type { AgentSessionItemView, FileChange } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { FileNode } from '@sdkwork/birdcoder-pc-ui/components/FileExplorer';
import type { UniversalChatComposerSelection } from '@sdkwork/birdcoder-pc-ui/components/UniversalChat';

export interface CodeEditorWorkspacePanelProps {
  isActive: boolean;
  currentProjectId?: string;
  files: FileNode[];
  loadingDirectoryPaths: Record<string, boolean>;
  openFiles: string[];
  selectedFile?: string | null;
  viewingDiff: FileChange | null;
  fileContent: string;
  explorerWidth: number;
  chatWidth: number;
  selectedAgentSessionId?: string | null;
  selectedAgentSessionScopeKey?: string | null;
  messages: AgentSessionItemView[];
  pendingApprovals?: AgentSessionPendingApproval[];
  pendingUserQuestions?: AgentSessionPendingQuestion[];
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
  onCloseDiff: () => void;
  onFileDraftChange: (value: string) => void;
  onExplorerResize: (delta: number) => void;
  onChatResize: (delta: number) => void;
  onSelectedEngineIdChange: (engineId: string) => void;
  onSelectedModelIdChange: (modelId: string, engineId?: string) => void;
  onSendMessage: (
    text?: string,
    composerSelection?: UniversalChatComposerSelection,
  ) => void | Promise<void>;
  onSubmitApprovalDecision: (
    interactionId: string,
    request: AgentApprovalDecisionInput,
  ) => void | Promise<void>;
  onSubmitUserQuestionAnswer: (
    interactionId: string,
    request: AgentQuestionAnswerInput,
  ) => void | Promise<void>;
  onViewChanges: (file: FileChange) => void;
  onRestoreMessage: (messageId: string) => void;
  onEditMessage: (messageId: string, content: string) => void | Promise<void>;
  onDeleteMessage: (messageIds: string[]) => void;
  onRegenerateMessage: () => void;
  onCreateRootFile: () => void;
  getLanguageFromPath: (path: string) => string;
}

export interface EditorChatProps {
  chatEmptyState?: ReactNode;
  isActive: boolean;
  isBusy: boolean;
  isEngineBusy: boolean;
  messages: AgentSessionItemView[];
  showComposerEngineSelector: boolean;
  selectedAgentSessionId?: string | null;
  selectedAgentSessionScopeKey?: string | null;
  selectedEngineId: string;
  selectedModelId: string;
  pendingApprovals?: AgentSessionPendingApproval[];
  pendingUserQuestions?: AgentSessionPendingQuestion[];
  onDeleteMessage: (messageIds: string[]) => void;
  onEditMessage: (messageId: string, content: string) => void | Promise<void>;
  onRegenerateMessage: () => void;
  onRestoreMessage: (messageId: string) => void;
  onSelectedEngineIdChange: (engineId: string) => void;
  onSelectedModelIdChange: (modelId: string, engineId?: string) => void;
  onSendMessage: (
    text?: string,
    composerSelection?: UniversalChatComposerSelection,
  ) => void | Promise<void>;
  onSubmitApprovalDecision: (
    interactionId: string,
    request: AgentApprovalDecisionInput,
  ) => void | Promise<void>;
  onSubmitUserQuestionAnswer: (
    interactionId: string,
    request: AgentQuestionAnswerInput,
  ) => void | Promise<void>;
  onViewChanges: (file: FileChange) => void;
  onOpenFile: (path: string) => void;
}

