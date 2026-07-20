import { DeferredFileExplorer } from '@sdkwork/birdcoder-pc-ui/components/DeferredFileExplorer';
import { DeferredUniversalChat } from '@sdkwork/birdcoder-pc-ui/components/DeferredUniversalChat';
import { ResizeHandle } from '@sdkwork/birdcoder-pc-ui-shell';
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
  isEngineBusy,
  messages,
  pendingApprovals,
  pendingUserQuestions,
  showComposerEngineSelector,
  selectedCodingSessionId,
  selectedCodingSessionScopeKey,
  selectedEngineId,
  selectedModelId,
  onDeleteMessage,
  onEditMessage,
  onRegenerateMessage,
  onOpenFile,
  onRestoreMessage,
  onSelectedEngineIdChange,
  onSelectedModelIdChange,
  onSendMessage,
  onSubmitApprovalDecision,
  onSubmitUserQuestionAnswer,
  onViewChanges,
}: WorkspaceChatProps) {
  return (
    <DeferredUniversalChat
      sessionId={selectedCodingSessionId || undefined}
      sessionScopeKey={selectedCodingSessionScopeKey || undefined}
      isActive={isActive}
      messages={messages}
      pendingApprovals={pendingApprovals}
      pendingUserQuestions={pendingUserQuestions}
      onSendMessage={onSendMessage}
      onSubmitApprovalDecision={onSubmitApprovalDecision}
      onSubmitUserQuestionAnswer={onSubmitUserQuestionAnswer}
      isBusy={isBusy}
      isEngineBusy={isEngineBusy}
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
      onOpenFile={onOpenFile}
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
  viewingDiff,
  fileContent,
  explorerWidth,
  chatWidth,
  selectedCodingSessionId,
  selectedCodingSessionScopeKey,
  messages,
  pendingApprovals,
  pendingUserQuestions,
  chatEmptyState,
  isBusy,
  isEngineBusy,
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
}: CodeEditorWorkspacePanelProps) {
  return (
    <div className={isActive ? 'flex flex-1 min-h-0 overflow-hidden' : 'hidden'}>
      <div className="flex-1 flex h-full min-w-0 overflow-hidden">
        <DeferredFileExplorer
          files={files}
          isActive={isActive}
          width={explorerWidth}
          loadingDirectoryPaths={loadingDirectoryPaths}
          onExpandDirectory={onExpandDirectory}
          projectId={currentProjectId}
          scopeKey={currentProjectId}
          selectedFile={selectedFile || undefined}
          onSelectFile={onSelectFile}
          onCreateFile={onCreateFile}
          onCreateFolder={onCreateFolder}
          onDeleteFile={onDeleteFile}
          onDeleteFolder={onDeleteFolder}
          onRenameNode={onRenameNode}
        />
        <ResizeHandle direction="horizontal" onResize={onExplorerResize} />
        <CodeEditorSurface
          currentProjectId={currentProjectId}
          fileCount={files.length}
          openFiles={openFiles}
          selectedFile={selectedFile}
          viewingDiff={viewingDiff}
          fileContent={fileContent}
          onSelectFile={onSelectFile}
          onCloseFile={onCloseFile}
          onCloseDiff={onCloseDiff}
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
              pendingApprovals={pendingApprovals}
              pendingUserQuestions={pendingUserQuestions}
              chatEmptyState={chatEmptyState}
              isActive={isActive}
              isBusy={isBusy}
              isEngineBusy={isEngineBusy}
              showComposerEngineSelector={showComposerEngineSelector}
              selectedEngineId={selectedEngineId}
              selectedModelId={selectedModelId}
              onSendMessage={onSendMessage}
              onSubmitApprovalDecision={onSubmitApprovalDecision}
              onSubmitUserQuestionAnswer={onSubmitUserQuestionAnswer}
              onSelectedEngineIdChange={onSelectedEngineIdChange}
              onSelectedModelIdChange={onSelectedModelIdChange}
              onViewChanges={onViewChanges}
              onRestoreMessage={onRestoreMessage}
              onEditMessage={onEditMessage}
              onDeleteMessage={onDeleteMessage}
              onRegenerateMessage={onRegenerateMessage}
              onOpenFile={onSelectFile}
            />
          </div>
        </div>
      </div>
    </div>
  );
}, areCodeEditorWorkspacePanelPropsEqual);

CodeEditorWorkspacePanel.displayName = 'CodeEditorWorkspacePanel';

