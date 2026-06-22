import React, { memo } from 'react';
import { estimateChatMessageViewHeight } from '@sdkwork/birdcoder-pc-commons/chat/types';
import { BIRDCODER_CODE_ENGINE_KEYS } from '@sdkwork/birdcoder-pc-commons/chat/types';
import type { ChatMessageRendererEntry, ChatMessageRendererProps } from '../types.ts';
import { AssistantReplyMessageRenderer } from '../renderers/ReplyMessageRenderers.tsx';

const EngineTaggedAssistantReplyMessageRenderer = memo(function EngineTaggedAssistantReplyMessageRenderer(
  props: ChatMessageRendererProps,
) {
  const engineId = props.view.engineId;
  return (
    <div data-chat-engine={engineId}>
      <AssistantReplyMessageRenderer {...props} />
    </div>
  );
});

export function createEngineChatMessageRendererEntries(): ChatMessageRendererEntry[] {
  return BIRDCODER_CODE_ENGINE_KEYS.flatMap((engineId) => [
    {
      id: `${engineId}.assistant.text`,
      match: { viewKind: 'assistant.text', engineId },
      priority: 30,
      Component: EngineTaggedAssistantReplyMessageRenderer,
      estimateHeight: estimateChatMessageViewHeight,
    },
    {
      id: `${engineId}.assistant.activity`,
      match: { viewKind: 'assistant.activity', engineId },
      priority: 30,
      Component: EngineTaggedAssistantReplyMessageRenderer,
      estimateHeight: estimateChatMessageViewHeight,
    },
    {
      id: `${engineId}.tool.result`,
      match: { viewKind: 'tool.result', engineId },
      priority: 30,
      Component: EngineTaggedAssistantReplyMessageRenderer,
      estimateHeight: estimateChatMessageViewHeight,
    },
  ]);
}
