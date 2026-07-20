import React, { memo } from 'react';
import { estimateChatMessageViewHeight } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { BIRDCODER_CODE_ENGINE_KEYS } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { BirdCoderCodeEngineKey } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageRendererEntry, ChatMessageRendererProps } from '../types.ts';
import { AssistantReplyMessageRenderer } from '../renderers/ReplyMessageRenderers.tsx';

const ENGINE_SURFACE_STYLES: Record<string, { label: string; className: string }> = {
  codex: {
    label: 'Codex',
    className: 'border-orange-400/30 bg-orange-500/10 text-orange-200',
  },
  'claude-code': {
    label: 'Claude Code',
    className: 'border-violet-400/30 bg-violet-500/10 text-violet-200',
  },
  gemini: {
    label: 'Gemini',
    className: 'border-sky-400/30 bg-sky-500/10 text-sky-200',
  },
  opencode: {
    label: 'OpenCode',
    className: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  },
};

function resolveEngineSurfaceStyle(engineId?: BirdCoderCodeEngineKey) {
  if (!engineId) {
    return {
      label: 'Engine',
      className: 'border-white/10 bg-white/5 text-gray-300',
    };
  }

  return ENGINE_SURFACE_STYLES[engineId] ?? {
    label: engineId,
    className: 'border-white/10 bg-white/5 text-gray-300',
  };
}

const EngineTaggedAssistantReplyMessageRenderer = memo(function EngineTaggedAssistantReplyMessageRenderer(
  props: ChatMessageRendererProps,
) {
  const engineId = props.view.engineId;
  const surface = resolveEngineSurfaceStyle(engineId);

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-2" data-chat-engine={engineId}>
      <div className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${surface.className}`}>
        {surface.label}
      </div>
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
