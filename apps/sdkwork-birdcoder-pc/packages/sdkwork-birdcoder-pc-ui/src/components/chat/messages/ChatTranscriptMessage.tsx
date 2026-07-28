import React, { memo, useMemo } from 'react';
import {
  resolveAgentTurnActivityPresentation,
  resolveAgentSessionItemPresentation,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { AgentSessionItemView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { defaultChatMessageRendererRegistry } from './defaultRegistry.ts';
import type {
  ChatMessageLayout,
  ChatMessageRenderContext,
} from './types.ts';
import type { ChatMessageRendererRegistry } from './registry.ts';
import { ChatTurnActiveTail } from './renderers/ChatTurnActiveTail.tsx';
import { ChatTranscriptSurface } from './ChatTranscriptSurface.tsx';

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

  return (
    <ChatTranscriptSurface
      key={messageRenderKey ?? `${sessionId}\u0001${index}\u0001${message.id || 'message'}`}
      index={index}
      isUser={isUser}
      layout={layout}
      messageRef={messageRef}
      providerProfile={resolvedContext.providerProfile}
      turn={resolvedContext.turn}
    >
      <Renderer
        view={view}
        context={resolvedContext}
      />
      {resolvedContext.turn.isActiveTail ? (
        <ChatTurnActiveTail
          layout={layout}
          providerProfile={resolvedContext.providerProfile}
          t={resolvedContext.environment?.t}
        />
      ) : null}
    </ChatTranscriptSurface>
  );
});
