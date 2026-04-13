import { FileExplorer, ResizeHandle, type FileNode } from '@sdkwork/birdcoder-ui';
import { UniversalChat } from '@sdkwork/birdcoder-ui/chat';
import type { BirdCoderChatMessage, FileChange } from '@sdkwork/birdcoder-types';
import { CodeEditorSurface } from './CodeEditorSurface';

interface CodeEditorWorkspacePanelProps {
  files: FileNode[];
  selectedFile?: string | null;
  currentProjectName?: string;
  viewingDiff: FileChange | null;
  fileContent: string;
  chatWidth: number;
  selectedCodingSessionId?: string | null;
  messages: BirdCoderChatMessage[];
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

export function CodeEditorWorkspacePanel({
  files,
  selectedFile,
  currentProjectName,
  viewingDiff,
  fileContent,
  chatWidth,
  selectedCodingSessionId,
  messages,
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
    <div className="flex-1 flex h-full overflow-hidden">
      <FileExplorer
        files={files}
        selectedFile={selectedFile || undefined}
        basePath={`/workspace/${currentProjectName || 'project'}`}
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
      <div className="flex flex-col shrink-0 bg-[#0e0e11]" style={{ width: chatWidth }}>
        <UniversalChat
          chatId={selectedCodingSessionId || undefined}
          messages={messages}
          inputValue={inputValue}
          setInputValue={onInputValueChange}
          onSendMessage={onSendMessage}
          isSending={isSending}
          selectedEngineId={selectedEngineId}
          selectedModelId={selectedModelId}
          setSelectedEngineId={onSelectedEngineIdChange}
          setSelectedModelId={onSelectedModelIdChange}
          layout="sidebar"
          onViewChanges={onViewChanges}
          onRestore={onRestoreMessage}
          onEditMessage={onEditMessage}
          onDeleteMessage={onDeleteMessage}
          onRegenerateMessage={onRegenerateMessage}
          onStop={onStopSending}
        />
      </div>
    </div>
  );
}
