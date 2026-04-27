import { FileExplorer, UniversalChat } from '@sdkwork/birdcoder-ui';
import { ResizeHandle } from '@sdkwork/birdcoder-ui-shell';
import { memo } from 'react';
import { areCodeEditorWorkspacePanelRenderInputsEqual } from './codeEditorWorkspacePanelEquality';
import type {
  CodeEditorWorkspacePanelProps,
  WorkspaceChatProps,
} from './codeEditorWorkspacePanel.types';
import { CodeEditorSurface } from './CodeEditorSurface';

const CodeEditorWorkspaceChatPanel = memo(function CodeEditorWorkspaceChatPanel({
  chatEmptyState,
  isActive,
  isBusy,
  messages,
  showComposerEngineSelector,
  selectedCodingSessionId,
  selectedCodingSessionScopeKey,
  selectedEngineId,
  selectedModelId,
  onDeleteMessage,
  onEditMessage,
  onRegenerateMessage,
  onRestoreMessage,
  onSelectedEngineIdChange,
  onSelectedModelIdChange,
  onSendMessage,
  onViewChanges,
}: WorkspaceChatProps) {
  return (
    <UniversalChat
      sessionId={selectedCodingSessionId || undefined}
      sessionScopeKey={selectedCodingSessionScopeKey || undefined}
      isActive={isActive}
      messages={messages}
      onSendMessage={onSendMessage}
      isBusy={isBusy}
      selectedEngineId={selectedEngineId}
      selectedModelId={selectedModelId}
      showEngineHeader={false}
      showComposerEngineSelector={showComposerEngineSelector}
      setSelectedEngineId={onSelectedEngineIdChange}
      setSelectedModelId={onSelectedModelIdChange}
      layout="sidebar"
      onViewChanges={onViewChanges}
      onRestore={onRestoreMessage}
      onEditMessage={onEditMessage}
      onDeleteMessage={onDeleteMessage}
      onRegenerateMessage={onRegenerateMessage}
      emptyState={chatEmptyState}
    />
  );
});

function areCodeEditorWorkspacePanelPropsEqual(
  left: CodeEditorWorkspacePanelProps,
  right: CodeEditorWorkspacePanelProps,
) {
  if (left.isActive !== right.isActive) {
    return false;
  }

  if (!left.isActive && !right.isActive) {
    return true;
  }

  return areCodeEditorWorkspacePanelRenderInputsEqual(left, right);
}

export const CodeEditorWorkspacePanel = memo(function CodeEditorWorkspacePanel({
  isActive,
  currentProjectId,
  files,
  loadingDirectoryPaths,
  openFiles,
  selectedFile,
  currentProjectPath,
  viewingDiff,
  fileContent,
  explorerWidth,
  chatWidth,
  selectedCodingSessionId,
  selectedCodingSessionScopeKey,
  messages,
  chatEmptyState,
  isBusy,
  showComposerEngineSelector,
  selectedEngineId,
  selectedModelId,
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
  onViewChanges,
  onRestoreMessage,
  onEditMessage,
  onDeleteMessage,
  onRegenerateMessage,
  onCreateRootFile,
  getLanguageFromPath,
}: CodeEditorWorkspacePanelProps) {
  return (
    <div className={isActive ? 'flex flex-1 min-h-0 overflow-hidden' : 'hidden'}>
      <div className="flex-1 flex h-full min-w-0 overflow-hidden">
        <FileExplorer
          files={files}
          isActive={isActive}
          width={explorerWidth}
          loadingDirectoryPaths={loadingDirectoryPaths}
          onExpandDirectory={onExpandDirectory}
          scopeKey={currentProjectId}
          selectedFile={selectedFile || undefined}
          basePath={currentProjectPath}
          onSelectFile={onSelectFile}
          onCreateFile={onCreateFile}
          onCreateFolder={onCreateFolder}
          onDeleteFile={onDeleteFile}
          onDeleteFolder={onDeleteFolder}
          onRenameNode={onRenameNode}
        />
        <ResizeHandle direction="horizontal" onResize={onExplorerResize} />
        <CodeEditorSurface
          fileCount={files.length}
          openFiles={openFiles}
          selectedFile={selectedFile}
          viewingDiff={viewingDiff}
          fileContent={fileContent}
          onSelectFile={onSelectFile}
          onCloseFile={onCloseFile}
          onAcceptDiff={onAcceptDiff}
          onRejectDiff={onRejectDiff}
          onFileDraftChange={onFileDraftChange}
          onCreateRootFile={onCreateRootFile}
          getLanguageFromPath={getLanguageFromPath}
        />
        <ResizeHandle direction="horizontal" onResize={onChatResize} />
        <div className="flex min-w-0 max-w-full flex-col shrink-0 overflow-hidden bg-[#0e0e11]" style={{ width: chatWidth }}>
          <div className="min-h-0 flex-1">
            <CodeEditorWorkspaceChatPanel
              selectedCodingSessionId={selectedCodingSessionId}
              selectedCodingSessionScopeKey={selectedCodingSessionScopeKey}
              messages={messages}
              chatEmptyState={chatEmptyState}
              isActive={isActive}
              isBusy={isBusy}
              showComposerEngineSelector={showComposerEngineSelector}
              selectedEngineId={selectedEngineId}
              selectedModelId={selectedModelId}
              onSendMessage={onSendMessage}
              onSelectedEngineIdChange={onSelectedEngineIdChange}
              onSelectedModelIdChange={onSelectedModelIdChange}
              onViewChanges={onViewChanges}
              onRestoreMessage={onRestoreMessage}
              onEditMessage={onEditMessage}
              onDeleteMessage={onDeleteMessage}
              onRegenerateMessage={onRegenerateMessage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}, areCodeEditorWorkspacePanelPropsEqual);

CodeEditorWorkspacePanel.displayName = 'CodeEditorWorkspacePanel';
