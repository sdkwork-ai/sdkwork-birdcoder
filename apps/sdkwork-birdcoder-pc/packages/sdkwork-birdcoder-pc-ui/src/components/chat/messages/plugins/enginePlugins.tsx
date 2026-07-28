import React, { memo } from 'react';
import { estimateAgentSessionItemPresentationHeight } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageRendererEntry, ChatMessageRendererProps } from '../types.ts';
import { AssistantReplyMessageRenderer } from '../renderers/ReplyMessageRenderers.tsx';
import {
  CHAT_PROVIDER_PRESENTATION_PROFILES,
  resolveChatProviderPresentationProfile,
  shouldShowChatProviderByline,
  type ChatProviderPresentationProfile,
} from '../presentation/providerPresentationProfiles.ts';

export const CHAT_ENGINE_PRESENTATION_PROFILES = CHAT_PROVIDER_PRESENTATION_PROFILES;
export const resolveChatEnginePresentationProfile = resolveChatProviderPresentationProfile;

function createEngineTaggedRenderer(profile: ChatProviderPresentationProfile) {
  return memo(function EngineTaggedAssistantReplyMessageRenderer(
    props: ChatMessageRendererProps,
  ) {
    const isAuthoredReply = props.view.source.role === 'assistant'
      || props.view.source.role === 'planner'
      || props.view.source.role === 'reviewer';
    const showEngineLabel = shouldShowChatProviderByline(profile, {
      hasAuthoredMarkdown: props.view.blocks.some(
        (block) => block.type === 'markdown'
          && !block.noticeKind
          && block.content.trim().length > 0,
      ),
      isAuthoredReply,
      layout: props.context.layout,
    });

    return (
      <div
        className="flex w-full min-w-0 max-w-full flex-col"
        data-chat-engine={profile.engineId}
        data-chat-engine-protocol={profile.protocolAdapterId}
        data-chat-transcript-style={profile.presentation.transcriptStyle}
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
