import React, { memo, useMemo } from 'react';
import {
  resolveAgentTurnActivityPresentation,
  resolveAgentSessionItemPresentation,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { AgentSessionItemView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { defaultChatMessageRendererRegistry } from './defaultRegistry.ts';
import {
  buildTranscriptSurfaceStyle,
  resolveTranscriptSurfaceIntrinsicSize,
} from './messageLayout.ts';
import type {
  ChatMessageLayout,
  ChatMessageRenderContext,
} from './types.ts';
import type { ChatMessageRendererRegistry } from './registry.ts';
import { ChatTurnActiveTail } from './renderers/ChatTurnActiveTail.tsx';

export interface ChatTranscriptMessageProps {
  message: AgentSessionItemView;
  index: number;
  sessionId: string;
  layout: ChatMessageLayout;
  engineId?: string;
  messageRenderKey?: string;
  messageRef?: (element: HTMLDivElement | null) => void;
  context: ChatMessageRenderContext;
  registry?: ChatMessageRendererRegistry;
}

export const ChatTranscriptMessage = memo(function ChatTranscriptMessage({
  message,
  index,
  sessionId,
  layout,
  engineId,
  messageRenderKey,
  messageRef,
  context,
  registry = defaultChatMessageRendererRegistry,
}: ChatTranscriptMessageProps) {
  const activitySummary = useMemo(
    () => resolveAgentTurnActivityPresentation(context.allMessages, message, { engineId }),
    [context.allMessages, engineId, message],
  );
  const view = useMemo(
    () => resolveAgentSessionItemPresentation(message, { activitySummary, engineId, layout }),
    [activitySummary, engineId, layout, message],
  );
  const entry = useMemo(() => registry.resolve(view), [registry, view]);
  const Renderer = entry.Component;
  const isUser = view.kind === 'user.text';
  const resolvedContext = useMemo(
    () => ({
      ...context,
      index,
      layout,
    }),
    [context, index, layout],
  );

  if (layout === 'sidebar') {
    return (
      <div
        data-transcript-message-index={index}
        ref={messageRef}
        key={messageRenderKey ?? `${sessionId}\u0001${index}\u0001${message.id || 'message'}`}
        className={isUser
          ? 'group flex w-full min-w-0 flex-col items-end'
          : 'group flex w-full min-w-0 max-w-full flex-col items-start'}
        data-chat-turn-end={resolvedContext.turn.isEnd ? 'true' : undefined}
        data-chat-turn-key={resolvedContext.turn.key}
        data-chat-turn-position={resolvedContext.turn.position}
        data-chat-turn-start={resolvedContext.turn.isStart ? 'true' : undefined}
        style={buildTranscriptSurfaceStyle(resolveTranscriptSurfaceIntrinsicSize(layout, isUser))}
      >
        <Renderer
          view={view}
          context={resolvedContext}
        />
        {resolvedContext.turn.isActiveTail ? (
          <ChatTurnActiveTail layout={layout} t={resolvedContext.environment?.t} />
        ) : null}
      </div>
    );
  }

  return (
    <div
      data-transcript-message-index={index}
      ref={messageRef}
      key={messageRenderKey ?? `${sessionId}\u0001${index}\u0001${message.id || 'message'}`}
      className={`group flex w-full min-w-0 px-5 ${
        isUser
          ? `${resolvedContext.turn.isStart ? 'pt-6' : 'pt-3'} pb-0`
          : `${resolvedContext.turn.isStart ? 'pt-6' : 'pt-3'} ${resolvedContext.turn.isEnd ? 'pb-3' : 'pb-0'}`
      }`}
      data-chat-turn-end={resolvedContext.turn.isEnd ? 'true' : undefined}
      data-chat-turn-key={resolvedContext.turn.key}
      data-chat-turn-position={resolvedContext.turn.position}
      data-chat-turn-start={resolvedContext.turn.isStart ? 'true' : undefined}
      style={buildTranscriptSurfaceStyle(resolveTranscriptSurfaceIntrinsicSize(layout, isUser))}
    >
      <div
        className={`mx-auto flex w-full min-w-0 max-w-[880px] flex-col ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        <Renderer
          view={view}
          context={resolvedContext}
        />
        {resolvedContext.turn.isActiveTail ? (
          <ChatTurnActiveTail layout={layout} t={resolvedContext.environment?.t} />
        ) : null}
      </div>
    </div>
  );
});
