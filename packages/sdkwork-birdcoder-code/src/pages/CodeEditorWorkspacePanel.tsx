import { FileExplorer, ResizeHandle, type FileNode } from '@sdkwork/birdcoder-ui';
import { UniversalChat } from '@sdkwork/birdcoder-ui/chat';
import type { BirdCoderChatMessage, FileChange } from '@sdkwork/birdcoder-types';
import { memo, type ReactNode } from 'react';
import { CodeEditorSurface } from './CodeEditorSurface';

interface CodeEditorWorkspacePanelProps {
  files: FileNode[];
  selectedFile?: string | null;
  currentProjectPath?: string;
  viewingDiff: FileChange | null;
  fileContent: string;
  chatWidth: number;
  selectedCodingSessionId?: string | null;
  messages: BirdCoderChatMessage[];
  chatEmptyState?: ReactNode;
  inputValue: string;
  isSending: boolean;
  selectedEngineId: string;
  selectedModelId: string;
  onSelectFile: (path: string) => void;
  onClearSelectedFile: () => void;
  onCreateFile: (path: string) => void;
  onCreateFolder: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onDeleteFolder: (path: string) => void;
  onRenameNode: (path: string, nextPath: string) => void;
  onAcceptDiff: () => void | Promise<void>;
  onRejectDiff: () => void;
  onFileContentChange: (value: string) => void;
  onChatResize: (delta: number) => void;
  onInputValueChange: (value: string) => void;
  onSelectedEngineIdChange: (engineId: string) => void;
  onSelectedModelIdChange: (modelId: string) => void;
  onSendMessage: () => void | Promise<void>;
  onViewChanges: (file: FileChange) => void;
  onRestoreMessage: (messageId: string) => void;
  onEditMessage: (messageId: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onRegenerateMessage: () => void;
  onStopSending: () => void;
  onCreateRootFile: () => void;
  getLanguageFromPath: (path: string) => string;
}

interface WorkspaceChatProps {
  chatEmptyState?: ReactNode;
  inputValue: string;
  isSending: boolean;
  messages: BirdCoderChatMessage[];
  selectedCodingSessionId?: string | null;
  selectedEngineId: string;
  selectedModelId: string;
  onDeleteMessage: (messageId: string) => void;
  onEditMessage: (messageId: string) => void;
  onInputValueChange: (value: string) => void;
  onRegenerateMessage: () => void;
  onRestoreMessage: (messageId: string) => void;
  onSelectedEngineIdChange: (engineId: string) => void;
  onSelectedModelIdChange: (modelId: string) => void;
  onSendMessage: () => void | Promise<void>;
  onStopSending: () => void;
  onViewChanges: (file: FileChange) => void;
}

const CodeEditorWorkspaceChatPanel = memo(function CodeEditorWorkspaceChatPanel({
  chatEmptyState,
  inputValue,
  isSending,
  messages,
  selectedCodingSessionId,
  selectedEngineId,
  selectedModelId,
  onDeleteMessage,
  onEditMessage,
  onInputValueChange,
  onRegenerateMessage,
  onRestoreMessage,
  onSelectedEngineIdChange,
  onSelectedModelIdChange,
  onSendMessage,
  onStopSending,
  onViewChanges,
}: WorkspaceChatProps) {
  return (
    <UniversalChat
      chatId={selectedCodingSessionId || undefined}
      messages={messages}
      inputValue={inputValue}
      setInputValue={onInputValueChange}
      onSendMessage={onSendMessage}
      isSending={isSending}
      selectedEngineId={selectedEngineId}
      selectedModelId={selectedModelId}
      showEngineHeader={false}
      setSelectedEngineId={onSelectedEngineIdChange}
      setSelectedModelId={onSelectedModelIdChange}
      layout="sidebar"
      onViewChanges={onViewChanges}
      onRestore={onRestoreMessage}
      onEditMessage={onEditMessage}
      onDeleteMessage={onDeleteMessage}
      onRegenerateMessage={onRegenerateMessage}
      onStop={onStopSending}
      emptyState={chatEmptyState}
    />
  );
});

CodeEditorWorkspaceChatPanel.displayName = 'CodeEditorWorkspaceChatPanel';

export function CodeEditorWorkspacePanel({
  files,
  selectedFile,
  currentProjectPath,
  viewingDiff,
  fileContent,
  chatWidth,
  selectedCodingSessionId,
  messages,
  chatEmptyState,
  inputValue,
  isSending,
  selectedEngineId,
  selectedModelId,
  onSelectFile,
  onClearSelectedFile,
  onCreateFile,
  onCreateFolder,
  onDeleteFile,
  onDeleteFolder,
  onRenameNode,
  onAcceptDiff,
  onRejectDiff,
  onFileContentChange,
  onChatResize,
  onInputValueChange,
  onSelectedEngineIdChange,
  onSelectedModelIdChange,
  onSendMessage,
  onViewChanges,
  onRestoreMessage,
  onEditMessage,
  onDeleteMessage,
  onRegenerateMessage,
  onStopSending,
  onCreateRootFile,
  getLanguageFromPath,
}: CodeEditorWorkspacePanelProps) {
  return (
    <div className="flex-1 flex h-full min-w-0 overflow-hidden">
      <FileExplorer
        files={files}
        selectedFile={selectedFile || undefined}
        basePath={currentProjectPath}
        onSelectFile={onSelectFile}
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
        onDeleteFile={onDeleteFile}
        onDeleteFolder={onDeleteFolder}
        onRenameNode={onRenameNode}
      />
      <CodeEditorSurface
        fileCount={files.length}
        selectedFile={selectedFile}
        viewingDiff={viewingDiff}
        fileContent={fileContent}
        onClearSelectedFile={onClearSelectedFile}
        onAcceptDiff={onAcceptDiff}
        onRejectDiff={onRejectDiff}
        onFileContentChange={onFileContentChange}
        onCreateRootFile={onCreateRootFile}
        getLanguageFromPath={getLanguageFromPath}
      />
      <ResizeHandle direction="horizontal" onResize={onChatResize} />
      <div className="flex min-w-0 max-w-full flex-col shrink-0 overflow-hidden bg-[#0e0e11]" style={{ width: chatWidth }}>
        <CodeEditorWorkspaceChatPanel
          selectedCodingSessionId={selectedCodingSessionId}
          messages={messages}
          chatEmptyState={chatEmptyState}
          inputValue={inputValue}
          isSending={isSending}
          selectedEngineId={selectedEngineId}
          selectedModelId={selectedModelId}
          onInputValueChange={onInputValueChange}
          onSendMessage={onSendMessage}
          onSelectedEngineIdChange={onSelectedEngineIdChange}
          onSelectedModelIdChange={onSelectedModelIdChange}
          onViewChanges={onViewChanges}
          onRestoreMessage={onRestoreMessage}
          onEditMessage={onEditMessage}
          onDeleteMessage={onDeleteMessage}
          onRegenerateMessage={onRegenerateMessage}
          onStopSending={onStopSending}
        />
      </div>
    </div>
  );
}
