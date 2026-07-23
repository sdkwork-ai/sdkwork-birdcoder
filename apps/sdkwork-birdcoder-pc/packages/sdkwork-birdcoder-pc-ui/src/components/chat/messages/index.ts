export type {
  ChatMessageActionTarget,
  ChatMessageEnvironment,
  ChatMessageLayout,
  ChatMessageRenderContext,
  ChatMessageRendererComponent,
  ChatMessageRendererEntry,
  ChatMessageRendererMatch,
  ChatMessageRendererProps,
  ChatMessageTranslate,
} from './types.ts';

export {
  buildVisibleMessageActionTargets,
  isReplySegmentRole,
  resolveMessageActionTargetCopyText,
  resolveMessageActionTargetMessageIds,
} from './messageActions.ts';

export {
  resolveMessageActivityFileChanges,
  resolveSessionItemCopyContent,
  resolveVisibleAssistantSessionItemContent,
  shouldHideSessionItemContentAsFileUpdateSummary,
  stripFileUpdateSummaryContent,
} from './messageActivity.ts';
export type { ActivityFileChange } from './messageActivity.ts';

export {
  createChatMessageRendererRegistry,
  estimateRendererHeight,
} from './registry.ts';
export type { ChatMessageRendererRegistry } from './registry.ts';

export {
  createDefaultChatMessageRendererRegistry,
  defaultChatMessageRendererRegistry,
} from './defaultRegistry.ts';

export { ChatTranscriptMessage } from './ChatTranscriptMessage.tsx';
export type { ChatTranscriptMessageProps } from './ChatTranscriptMessage.tsx';

export {
  buildTranscriptSurfaceStyle,
  resolveTranscriptSurfaceIntrinsicSize,
} from './messageLayout.ts';

export { ContentBlockList } from './contentBlocks/ContentBlockList.tsx';
export {
  createChatMessageContentBlockRendererRegistry,
} from './contentBlocks/registry.ts';
export type {
  ChatMessageContentBlockRendererEntry,
  ChatMessageContentBlockRendererRegistry,
} from './contentBlocks/registry.ts';
export {
  createDefaultChatMessageContentBlockRendererRegistry,
  defaultChatMessageContentBlockRendererRegistry,
} from './contentBlocks/defaultRegistry.ts';
export { createEngineChatMessageRendererEntries } from './plugins/enginePlugins.tsx';
