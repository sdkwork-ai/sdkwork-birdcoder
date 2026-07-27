import React, { memo } from 'react';
import { estimateAgentSessionItemPresentationHeight } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageRendererEntry, ChatMessageRendererProps } from '../types.ts';
import { AssistantReplyMessageRenderer } from '../renderers/ReplyMessageRenderers.tsx';

export interface ChatEnginePresentationProfile {
  engineId: 'claude-code' | 'codex' | 'gemini' | 'opencode';
  protocolAdapterId:
    | 'claude.content-block'
    | 'codex.item'
    | 'gemini.event'
    | 'opencode.part';
  surfaceLabel: string;
}

export const CHAT_ENGINE_PRESENTATION_PROFILES: readonly ChatEnginePresentationProfile[] = [
  {
    engineId: 'codex',
    protocolAdapterId: 'codex.item',
    surfaceLabel: 'Codex',
  },
  {
    engineId: 'claude-code',
    protocolAdapterId: 'claude.content-block',
    surfaceLabel: 'Claude Code',
  },
  {
    engineId: 'opencode',
    protocolAdapterId: 'opencode.part',
    surfaceLabel: 'OpenCode',
  },
  {
    engineId: 'gemini',
    protocolAdapterId: 'gemini.event',
    surfaceLabel: 'Gemini',
  },
];

export function resolveChatEnginePresentationProfile(
  engineId: string | undefined,
): ChatEnginePresentationProfile | undefined {
  return CHAT_ENGINE_PRESENTATION_PROFILES.find((profile) => profile.engineId === engineId);
}

function createEngineTaggedRenderer(profile: ChatEnginePresentationProfile) {
  return memo(function EngineTaggedAssistantReplyMessageRenderer(
    props: ChatMessageRendererProps,
  ) {
    const isAuthoredReply = props.view.source.role === 'assistant'
      || props.view.source.role === 'planner'
      || props.view.source.role === 'reviewer';
    const showEngineLabel = props.context.layout === 'sidebar'
      && isAuthoredReply
      && props.view.blocks.some(
        (block) => block.type === 'markdown'
          && !block.noticeKind
          && block.content.trim().length > 0,
      );

    return (
      <div
        className="flex w-full min-w-0 max-w-full flex-col"
        data-chat-engine={profile.engineId}
        data-chat-engine-protocol={profile.protocolAdapterId}
      >
        {showEngineLabel ? (
          <div className="mb-1 text-[11px] font-medium text-gray-500" data-chat-engine-label="true">
            {profile.surfaceLabel}
          </div>
        ) : null}
        <AssistantReplyMessageRenderer {...props} />
      </div>
    );
  });
}

const ENGINE_VIEW_KINDS = [
  'assistant.text',
  'assistant.activity',
  'tool.result',
] as const;

export function createEngineChatMessageRendererEntries(): ChatMessageRendererEntry[] {
  return CHAT_ENGINE_PRESENTATION_PROFILES.flatMap((profile) => {
    const Component = createEngineTaggedRenderer(profile);
    return ENGINE_VIEW_KINDS.map((viewKind) => ({
      id: `${profile.engineId}.${viewKind}`,
      match: { engineId: profile.engineId, viewKind },
      priority: 30,
      Component,
      estimateHeight: estimateAgentSessionItemPresentationHeight,
    }));
  });
}
