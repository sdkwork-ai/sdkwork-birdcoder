import type { ReactNode } from 'react';
import type { BirdCoderChatMessage, FileChange } from '@sdkwork/birdcoder-types';
import type { FileNode } from '@sdkwork/birdcoder-ui';

export interface CodeEditorWorkspacePanelProps {
  isActive: boolean;
  currentProjectId?: string;
  files: FileNode[];
  loadingDirectoryPaths: Record<string, boolean>;
  openFiles: string[];
  selectedFile?: string | null;
  currentProjectPath?: string;
  viewingDiff: FileChange | null;
  fileContent: string;
  explorerWidth: number;
  chatWidth: number;
  selectedCodingSessionId?: string | null;
  selectedCodingSessionScopeKey?: string | null;
  messages: BirdCoderChatMessage[];
  chatEmptyState?: ReactNode;
  isBusy: boolean;
  showComposerEngineSelector: boolean;
  selectedEngineId: string;
  selectedModelId: string;
  onSelectFile: (path: string) => void;
  onExpandDirectory: (path: string) => void | Promise<void>;
  onCloseFile: (path: string) => void;
  onCreateFile: (path: string) => void;
  onCreateFolder: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onDeleteFolder: (path: string) => void;
  onRenameNode: (path: string, nextPath: string) => void;
  onAcceptDiff: () => void | Promise<void>;
  onRejectDiff: () => void;
  onFileDraftChange: (value: string) => void;
  onExplorerResize: (delta: number) => void;
  onChatResize: (delta: number) => void;
  onSelectedEngineIdChange: (engineId: string) => void;
  onSelectedModelIdChange: (modelId: string, engineId?: string) => void;
  onSendMessage: (text?: string) => void | Promise<void>;
  onViewChanges: (file: FileChange) => void;
  onRestoreMessage: (messageId: string) => void;
  onEditMessage: (messageId: string) => void;
  onDeleteMessage: (messageIds: string[]) => void;
  onRegenerateMessage: () => void;
  onCreateRootFile: () => void;
  getLanguageFromPath: (path: string) => string;
}

export interface WorkspaceChatProps {
  chatEmptyState?: ReactNode;
  isActive: boolean;
  isBusy: boolean;
  messages: BirdCoderChatMessage[];
  showComposerEngineSelector: boolean;
  selectedCodingSessionId?: string | null;
  selectedCodingSessionScopeKey?: string | null;
  selectedEngineId: string;
  selectedModelId: string;
  onDeleteMessage: (messageIds: string[]) => void;
  onEditMessage: (messageId: string) => void;
  onRegenerateMessage: () => void;
  onRestoreMessage: (messageId: string) => void;
  onSelectedEngineIdChange: (engineId: string) => void;
  onSelectedModelIdChange: (modelId: string, engineId?: string) => void;
  onSendMessage: (text?: string) => void | Promise<void>;
  onViewChanges: (file: FileChange) => void;
}
