export type { FileExplorerProps, FileNode } from './components/FileExplorer';
export { DeferredFileExplorer } from './components/DeferredFileExplorer';

export { WorkbenchNewSessionButton } from './components/WorkbenchNewSessionButton';
export { copyTextToClipboard } from './components/clipboard';
export { resolveSafeMarkdownHref } from './components/markdownLinkSecurity';

export { ProjectGitOverviewPanel } from './components/ProjectGitOverviewPanel';
export { ProjectGitOverviewDrawer } from './components/ProjectGitOverviewDrawer';
export { ProjectGitDiffDialog } from './components/ProjectGitDiffDialog';
export { ProjectGitSubmitDialog } from './components/ProjectGitSubmitDialog';
export type { ProjectGitSubmitMode } from './components/ProjectGitSubmitDialog';
export { ProjectGitOverviewSurface } from './components/ProjectGitOverviewSurface';
export type { ProjectGitOverviewSectionId } from './components/ProjectGitOverviewSurface';

export { ProjectGitHeaderControls } from './components/ProjectGitHeaderControls';
export type { ProjectGitHeaderControlsVariant } from './components/ProjectGitHeaderControls';

export { ProjectGitWorktreeManagementPanel } from './components/ProjectGitWorktreeManagementPanel';
export { ProjectGitBranchMenu } from './components/ProjectGitBranchMenu';
export type { ProjectGitBranchMenuVariant } from './components/ProjectGitBranchMenu';
export { ProjectGitWorktreeMenu } from './components/ProjectGitWorktreeMenu';
export type { ProjectGitWorktreeMenuVariant } from './components/ProjectGitWorktreeMenu';
export { ProjectGitCreateBranchDialog } from './components/ProjectGitCreateBranchDialog';

export { ContentWorkbench } from './components/ContentWorkbench';
export type {
  ContentWorkbenchLabels,
  ContentWorkbenchProps,
} from './components/ContentWorkbench';
export { buildBirdCoderEditorModelPath } from './components/editorModelPath';

export { DeferredDiffEditor } from './components/DeferredDiffEditor';
export { FileChangeDiffViewer } from './components/FileChangeDiffViewer';
export { DeferredRunConfigurationDialog, DeferredRunTaskDialog } from './components/DeferredRunDialogs';

export { DeferredUniversalChat } from './components/DeferredUniversalChat';
export type {
  ChatSkill,
  UniversalChatComposerSelection,
  UniversalChatProps,
} from './components/UniversalChat';

export {
  ChatTranscriptMessage,
  createChatMessageRendererRegistry,
  createDefaultChatMessageRendererRegistry,
  defaultChatMessageRendererRegistry,
  estimateRendererHeight,
} from './components/chat/messages/index.ts';
export {
  resolveChatMessageView,
  resolveChatMessageViews,
  buildChatMessageViewSynchronizationSignature,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
export type {
  BirdCoderChatMessageView,
  BirdCoderChatMessageViewKind,
  ChatMessageContentBlock,
  ChatMessageLayoutHints,
  ChatMessageViewSource,
  ResolveChatMessageViewOptions,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
export type {
  ChatMessageEnvironment,
  ChatMessageLayout,
  ChatMessageRenderContext,
  ChatMessageRendererEntry,
  ChatMessageRendererRegistry,
  ChatTranscriptMessageProps,
} from './components/chat/messages/index.ts';
export { UniversalChatComposerChrome } from './components/UniversalChatComposerChrome';
export type { UniversalChatComposerChromeProps } from './components/UniversalChatComposerChrome';

export {
  buildHtmlPreviewDocument,
  buildSvgPreviewDocument,
  parseKeyValuePreviewValue,
  parseStructuredDataPreviewValue,
  parseTabularDataPreviewValue,
  resolveContentPreviewCodeLanguage,
  resolveContentPreviewDescriptor,
  resolveContentPreviewDisplayLabel,
  resolveContentPreviewKind,
  resolveContentPreviewSandbox,
  shouldDefaultToSplitContentWorkbench,
  type ContentPreviewKind,
  type ContentPreviewPresentation,
  type ContentPreviewSandboxPolicy,
  type ParsedKeyValuePreviewValue,
  type ParsedStructuredDataPreviewValue,
  type ParsedTabularDataPreviewValue,
  type ResolvedContentPreviewDescriptor,
  type ResolvedContentPreviewKind,
} from './components/contentPreview';
export {
  resolveContentPreviewKindFast,
  shouldDefaultToSplitContentWorkbenchFast,
} from './components/contentPreviewHeuristics';
export type {
  LightweightContentPreviewKind,
  LightweightResolvedContentPreviewKind,
  LightweightResolveContentPreviewOptions,
} from './components/contentPreviewHeuristics';
