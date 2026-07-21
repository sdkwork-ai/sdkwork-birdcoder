import React, { memo } from 'react';
import { estimateChatMessageViewHeight } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { BIRDCODER_CODE_ENGINE_KEYS } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { BirdCoderCodeEngineKey } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageRendererEntry, ChatMessageRendererProps } from '../types.ts';
import { AssistantReplyMessageRenderer } from '../renderers/ReplyMessageRenderers.tsx';

const ENGINE_SURFACE_LABELS: Record<string, string> = {
  codex: 'Codex',
  'claude-code': 'Claude Code',
  gemini: 'Gemini',
  opencode: 'OpenCode',
};

function resolveEngineSurfaceLabel(engineId?: BirdCoderCodeEngineKey): string {
  return engineId ? ENGINE_SURFACE_LABELS[engineId] ?? engineId : 'Engine';
}

const EngineTaggedAssistantReplyMessageRenderer = memo(function EngineTaggedAssistantReplyMessageRenderer(
  props: ChatMessageRendererProps,
) {
  const engineId = props.view.engineId;
  const isAuthoredReply = props.view.source.role === 'assistant'
    || props.view.source.role === 'planner'
    || props.view.source.role === 'reviewer';
  const showEngineLabel = isAuthoredReply && props.view.blocks.some(
    (block) => block.type === 'markdown' && !block.noticeKind && block.content.trim().length > 0,
  );

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col" data-chat-engine={engineId}>
      {showEngineLabel ? (
        <div
          className="mb-1 text-[11px] font-medium text-gray-500"
          data-chat-engine-label="true"
        >
          {resolveEngineSurfaceLabel(engineId)}
        </div>
      ) : null}
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
