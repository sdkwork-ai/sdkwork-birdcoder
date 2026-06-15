import type { CodeEditorWorkspacePanelProps } from './codeEditorWorkspacePanel.types';

export function areCodeEditorWorkspacePanelRenderInputsEqual(
  left: CodeEditorWorkspacePanelProps,
  right: CodeEditorWorkspacePanelProps,
) {
  return (
    left.currentProjectId === right.currentProjectId &&
    left.files === right.files &&
    left.loadingDirectoryPaths === right.loadingDirectoryPaths &&
    left.openFiles === right.openFiles &&
    left.selectedFile === right.selectedFile &&
    left.currentProjectPath === right.currentProjectPath &&
    left.viewingDiff === right.viewingDiff &&
    left.fileContent === right.fileContent &&
    left.explorerWidth === right.explorerWidth &&
    left.chatWidth === right.chatWidth &&
    left.selectedCodingSessionId === right.selectedCodingSessionId &&
    left.selectedCodingSessionScopeKey === right.selectedCodingSessionScopeKey &&
    left.messages === right.messages &&
    left.pendingApprovals === right.pendingApprovals &&
    left.pendingUserQuestions === right.pendingUserQuestions &&
    left.chatEmptyState === right.chatEmptyState &&
    left.isBusy === right.isBusy &&
    left.isEngineBusy === right.isEngineBusy &&
    left.showComposerEngineSelector === right.showComposerEngineSelector &&
    left.selectedEngineId === right.selectedEngineId &&
    left.selectedModelId === right.selectedModelId &&
    left.onSelectFile === right.onSelectFile &&
    left.onExpandDirectory === right.onExpandDirectory &&
    left.onCloseFile === right.onCloseFile &&
    left.onCreateFile === right.onCreateFile &&
    left.onCreateFolder === right.onCreateFolder &&
    left.onDeleteFile === right.onDeleteFile &&
    left.onDeleteFolder === right.onDeleteFolder &&
    left.onRenameNode === right.onRenameNode &&
    left.onAcceptDiff === right.onAcceptDiff &&
    left.onRejectDiff === right.onRejectDiff &&
    left.onFileDraftChange === right.onFileDraftChange &&
    left.onExplorerResize === right.onExplorerResize &&
    left.onChatResize === right.onChatResize &&
    left.onSelectedEngineIdChange === right.onSelectedEngineIdChange &&
    left.onSelectedModelIdChange === right.onSelectedModelIdChange &&
    left.onSendMessage === right.onSendMessage &&
    left.onSubmitApprovalDecision === right.onSubmitApprovalDecision &&
    left.onSubmitUserQuestionAnswer === right.onSubmitUserQuestionAnswer &&
    left.onViewChanges === right.onViewChanges &&
    left.onRestoreMessage === right.onRestoreMessage &&
    left.onEditMessage === right.onEditMessage &&
    left.onDeleteMessage === right.onDeleteMessage &&
    left.onRegenerateMessage === right.onRegenerateMessage &&
    left.onCreateRootFile === right.onCreateRootFile &&
    left.getLanguageFromPath === right.getLanguageFromPath
  );
}
