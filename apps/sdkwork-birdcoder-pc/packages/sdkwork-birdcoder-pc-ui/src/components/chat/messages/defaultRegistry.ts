import { estimateAgentSessionItemPresentationHeight } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { createChatMessageRendererRegistry } from './registry.ts';
import { createEngineChatMessageRendererEntries } from './plugins/enginePlugins.tsx';
import type { ChatMessageRendererEntry } from './types.ts';
import {
  AssistantReplyMessageRenderer,
  UserTextMessageRenderer,
} from './renderers/ReplyMessageRenderers.tsx';

const FALLBACK_RENDERER_ENTRY: ChatMessageRendererEntry = {
  id: 'fallback.assistant.text',
  match: {},
  priority: 0,
  Component: AssistantReplyMessageRenderer,
  estimateHeight: estimateAgentSessionItemPresentationHeight,
};

const DEFAULT_CHAT_MESSAGE_RENDERER_ENTRIES: readonly ChatMessageRendererEntry[] = [
  {
    id: 'user.text',
    match: { viewKind: 'user.text' },
    priority: 10,
    Component: UserTextMessageRenderer,
    estimateHeight: estimateAgentSessionItemPresentationHeight,
  },
  {
    id: 'assistant.text',
    match: { viewKind: 'assistant.text' },
    priority: 10,
    Component: AssistantReplyMessageRenderer,
    estimateHeight: estimateAgentSessionItemPresentationHeight,
  },
  {
    id: 'assistant.activity',
    match: { viewKind: 'assistant.activity' },
    priority: 20,
    Component: AssistantReplyMessageRenderer,
    estimateHeight: estimateAgentSessionItemPresentationHeight,
  },
  {
    id: 'tool.result',
    match: { viewKind: 'tool.result' },
    priority: 10,
    Component: AssistantReplyMessageRenderer,
    estimateHeight: estimateAgentSessionItemPresentationHeight,
  },
  {
    id: 'system.notice',
    match: { viewKind: 'system.notice' },
    priority: 10,
    Component: AssistantReplyMessageRenderer,
    estimateHeight: estimateAgentSessionItemPresentationHeight,
  },
  {
    id: 'planner.plan',
    match: { viewKind: 'planner.plan' },
    priority: 10,
    Component: AssistantReplyMessageRenderer,
    estimateHeight: estimateAgentSessionItemPresentationHeight,
  },
  {
    id: 'reviewer.feedback',
    match: { viewKind: 'reviewer.feedback' },
    priority: 10,
    Component: AssistantReplyMessageRenderer,
    estimateHeight: estimateAgentSessionItemPresentationHeight,
  },
];

export function createDefaultChatMessageRendererRegistry() {
  return createChatMessageRendererRegistry(
    [...DEFAULT_CHAT_MESSAGE_RENDERER_ENTRIES, ...createEngineChatMessageRendererEntries()],
    FALLBACK_RENDERER_ENTRY,
  );
}

export const defaultChatMessageRendererRegistry = createDefaultChatMessageRendererRegistry();
