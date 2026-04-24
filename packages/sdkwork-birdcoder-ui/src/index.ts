export { FileExplorer } from './components/FileExplorer';
export type { FileNode } from './components/FileExplorer';

export { WorkbenchNewSessionButton } from './components/WorkbenchNewSessionButton';

export { ProjectGitOverviewPanel } from './components/ProjectGitOverviewPanel';
export { ProjectGitOverviewDrawer } from './components/ProjectGitOverviewDrawer';
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

export { DeferredDiffEditor } from './components/DeferredDiffEditor';
export { DeferredRunConfigurationDialog, DeferredRunTaskDialog } from './components/DeferredRunDialogs';

export { UniversalChat } from './components/UniversalChat';
export type { ChatSkill, UniversalChatProps } from './components/UniversalChat';

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
