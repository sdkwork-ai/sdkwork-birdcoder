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
import { TurnFileChangesCard } from './activity/TurnFileChangesCard.tsx';
import { TurnProcessDisclosure } from './presentation/TurnProcessDisclosure.tsx';

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
  const displayView = useMemo(() => {
    if (!context.suppressProcessBlocks) return view;
    const blocks = view.blocks.filter((block) => (
      (block.type === 'markdown' && !block.noticeKind)
      || (message.role === 'user' && block.type === 'resources')
    ));
    return blocks.length === view.blocks.length
      ? view
      : {
          ...view,
          blocks,
          layoutHints: {
            ...view.layoutHints,
            hasCollapsibleSections: false,
          },
        };
  }, [context.suppressProcessBlocks, message.role, view]);
  const entry = useMemo(() => registry.resolve(displayView), [displayView, registry]);
  const Renderer = entry.Component;
  const isUser = displayView.kind === 'user.text';
  const resolvedContext = useMemo(
    () => ({
      ...context,
      index,
      layout,
    }),
    [context, index, layout],
  );
  const hasSurfaceContent = displayView.blocks.length > 0
    || Boolean(resolvedContext.turnProcess)
    || Boolean(resolvedContext.turnFileChanges)
    || resolvedContext.turn.isActiveTail;

  if (!hasSurfaceContent) {
    return (
      <div
        key={messageRenderKey ?? `${sessionId}\u0001${index}\u0001${message.id || 'message'}`}
        ref={messageRef}
        className="h-0 w-full overflow-hidden"
        data-chat-process-source-hidden="true"
        data-transcript-message-index={index}
        aria-hidden="true"
      />
    );
  }

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
      {resolvedContext.turnProcess ? (
        <TurnProcessDisclosure
          context={resolvedContext}
          presentation={resolvedContext.turnProcess}
        />
      ) : null}
      {displayView.blocks.length > 0 ? (
        <Renderer
          view={displayView}
          context={resolvedContext}
        />
      ) : null}
      {resolvedContext.turnFileChanges ? (
        <TurnFileChangesCard
          compact={layout === 'sidebar'}
          environment={resolvedContext.environment}
          expandedDisclosureKeys={resolvedContext.expandedDisclosureKeys}
          presentation={resolvedContext.turnFileChanges}
          toggleDisclosure={resolvedContext.toggleDisclosure}
        />
      ) : null}
      {resolvedContext.turn.isActiveTail && !resolvedContext.turnProcess ? (
        <ChatTurnActiveTail
          layout={layout}
          providerProfile={resolvedContext.providerProfile}
          t={resolvedContext.environment?.t}
        />
      ) : null}
    </ChatTranscriptSurface>
  );
});
