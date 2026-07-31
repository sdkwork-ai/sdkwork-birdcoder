import React, { memo, useMemo } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import {
  resolveAgentSessionItemPresentation,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type {
  AgentSessionItemView,
  AgentTurnActivityPresentation,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { defaultChatMessageRendererRegistry } from './defaultRegistry.ts';
import type {
  ChatMessageLayout,
  ChatMessageRenderContext,
} from './types.ts';
import type { ChatMessageRendererRegistry } from './registry.ts';
import { ChatTurnActiveTail } from './renderers/ChatTurnActiveTail.tsx';
import { ChatTranscriptSurface } from './ChatTranscriptSurface.tsx';
import { ChatTurnRenderBoundary } from './ChatTurnRenderBoundary.tsx';
import { TurnFileChangesCard } from './activity/TurnFileChangesCard.tsx';
import { TurnProcessDisclosure } from './presentation/TurnProcessDisclosure.tsx';

export interface ChatTranscriptMessageProps {
  activitySummary: AgentTurnActivityPresentation | null;
  message: AgentSessionItemView;
  index: number;
  transcriptIndex?: number;
  sessionId: string;
  layout: ChatMessageLayout;
  engineId?: string;
  messageRenderKey?: string;
  messageRef?: (element: HTMLDivElement | null) => void;
  context: ChatMessageRenderContext;
  registry?: ChatMessageRendererRegistry;
}

function ChatTranscriptMessageContent({
  activitySummary,
  message,
  index,
  transcriptIndex = index,
  sessionId,
  layout,
  engineId,
  messageRenderKey,
  messageRef,
  context,
  registry = defaultChatMessageRendererRegistry,
}: ChatTranscriptMessageProps) {
  const resolvedMessageKey = messageRenderKey
    ?? `${sessionId}\u0001${message.id || message.createdAt || 'message'}`;
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
  const renderStreamingMarkdownContent = useMemo(
    () => (content: string) => context.renderMarkdownContent(content, 'basic'),
    [context.renderMarkdownContent],
  );
  const resolvedContext = useMemo(
    () => ({
      ...context,
      index,
      layout,
      renderMarkdownContent: context.turn.isActiveTail
        ? renderStreamingMarkdownContent
        : context.renderMarkdownContent,
    }),
    [context, index, layout, renderStreamingMarkdownContent],
  );
  const hasSurfaceContent = displayView.blocks.length > 0
    || Boolean(resolvedContext.turnProcess)
    || Boolean(resolvedContext.turnFileChanges)
    || resolvedContext.turn.isActiveTail;

  if (!hasSurfaceContent) {
    return (
      <div
        ref={messageRef}
        className="h-0 w-full overflow-hidden"
        data-chat-process-source-hidden="true"
        data-transcript-message-index={transcriptIndex}
        data-transcript-message-key={resolvedMessageKey}
        aria-hidden="true"
      />
    );
  }

  return (
    <ChatTranscriptSurface
      index={transcriptIndex}
      isUser={isUser}
      layout={layout}
      messageKey={resolvedMessageKey}
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
}

function resolveMessageRenderKey({
  message,
  messageRenderKey,
  sessionId,
}: ChatTranscriptMessageProps): string {
  return messageRenderKey
    ?? `${sessionId}\u0001${message.id || message.createdAt || 'message'}`;
}

function ChatTurnRenderFallback({
  context,
  index,
  layout,
  message,
  messageRef,
  messageRenderKey,
  retry,
  transcriptIndex,
}: Omit<ChatTranscriptMessageProps, 'messageRenderKey'> & {
  messageRenderKey: string;
  retry: () => void;
}) {
  const retryLabel = context.environment?.t('chat.turnRenderRetry') ?? 'Try again';
  const failureLabel = context.environment?.t('chat.turnRenderFailed')
    ?? "This turn couldn't render";

  return (
    <ChatTranscriptSurface
      index={transcriptIndex ?? index}
      isUser={message.role === 'user'}
      layout={layout}
      messageKey={messageRenderKey}
      messageRef={messageRef}
      providerProfile={context.providerProfile}
      turn={context.turn}
    >
      <div
        className="flex w-full min-w-0 items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-300"
        role="alert"
      >
        <span className="flex min-w-0 items-center gap-2">
          <TriangleAlert aria-hidden="true" className="shrink-0 text-amber-300" size={15} />
          <span className="break-words">{failureLabel}</span>
        </span>
        <button
          aria-label={retryLabel}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-gray-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          onClick={retry}
          type="button"
        >
          <RotateCcw aria-hidden="true" size={13} />
          <span>{retryLabel}</span>
        </button>
      </div>
    </ChatTranscriptSurface>
  );
}

export const ChatTranscriptMessage = memo(function ChatTranscriptMessage(
  props: ChatTranscriptMessageProps,
) {
  const messageRenderKey = resolveMessageRenderKey(props);
  return (
    <ChatTurnRenderBoundary
      fallback={(retry) => (
        <ChatTurnRenderFallback
          {...props}
          messageRenderKey={messageRenderKey}
          retry={retry}
        />
      )}
      onError={(error, errorInfo) => {
        console.error('[ChatTranscriptMessage] Session Turn render failed', {
          messageId: props.message.id,
          sessionId: props.sessionId,
          turnKey: props.context.turn.key,
        }, error, errorInfo.componentStack);
      }}
      resetKey={props.message}
    >
      <ChatTranscriptMessageContent
        {...props}
        messageRenderKey={messageRenderKey}
      />
    </ChatTurnRenderBoundary>
  );
}, areChatTranscriptMessagePropsEqual);

function areShallowObjectsEqual(left: object, right: object): boolean {
  if (left === right) return true;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  if (leftKeys.length !== Object.keys(rightRecord).length) return false;
  return leftKeys.every((key) => leftRecord[key] === rightRecord[key]);
}

function areOrderedShallowObjectsEqual<T extends object>(
  left: readonly T[] | undefined,
  right: readonly T[] | undefined,
): boolean {
  if (left === right) return true;
  if (!left || !right || left.length !== right.length) return false;
  return left.every((value, index) => {
    const nextValue = right[index];
    return Boolean(nextValue && areShallowObjectsEqual(value, nextValue));
  });
}

function areActivitySummariesEqual(
  left: AgentTurnActivityPresentation | null,
  right: AgentTurnActivityPresentation | null,
): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return areOrderedShallowObjectsEqual(left.commands, right.commands)
    && areOrderedShallowObjectsEqual(left.fileChanges, right.fileChanges);
}

function areTurnPresentationsEqual(
  left: ChatMessageRenderContext['turn'],
  right: ChatMessageRenderContext['turn'],
): boolean {
  return left === right || (
    left.isActiveTail === right.isActiveTail
    && left.isEnd === right.isEnd
    && left.isStart === right.isStart
    && left.key === right.key
    && left.position === right.position
  );
}

function areFileChangePresentationsEqual(
  left: ChatMessageRenderContext['turnFileChanges'],
  right: ChatMessageRenderContext['turnFileChanges'],
): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.messageId === right.messageId
    && left.scopeKey === right.scopeKey
    && areOrderedShallowObjectsEqual(left.fileChanges, right.fileChanges);
}

function areProcessPresentationsEqual(
  left: ChatMessageRenderContext['turnProcess'],
  right: ChatMessageRenderContext['turnProcess'],
): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  if (
    left.completedAtMs !== right.completedAtMs
    || left.isActive !== right.isActive
    || left.itemCount !== right.itemCount
    || left.key !== right.key
    || left.processBlockCount !== right.processBlockCount
    || left.startedAtMs !== right.startedAtMs
    || left.targetIndex !== right.targetIndex
    || left.items.length !== right.items.length
  ) {
    return false;
  }

  return left.items.every((item, index) => {
    const nextItem = right.items[index];
    return item === nextItem || (
      item.sourceIndex === nextItem?.sourceIndex
      && item.view.source === nextItem.view.source
    );
  });
}

function areActionTargetsEqual(
  left: ChatMessageRenderContext['actionTarget'],
  right: ChatMessageRenderContext['actionTarget'],
): boolean {
  return left === right || (
    left?.startIndex === right?.startIndex
    && left?.endIndex === right?.endIndex
  );
}

function areActionTargetMessagesEqual(
  left: ChatMessageRenderContext,
  right: ChatMessageRenderContext,
): boolean {
  const actionTarget = left.actionTarget;
  if (!left.showMessageActions || !actionTarget) {
    return true;
  }

  for (let index = actionTarget.startIndex; index <= actionTarget.endIndex; index += 1) {
    if (left.allMessages[index] !== right.allMessages[index]) {
      return false;
    }
  }
  return true;
}

function isDisclosureKeyInScope(key: string, scope: string | undefined): boolean {
  const normalizedScope = scope?.trim();
  return Boolean(
    normalizedScope
    && (key === normalizedScope || key.startsWith(`${normalizedScope}\u0001`)),
  );
}

function isDisclosureKeyRelevantToSourceMessage(
  key: string,
  context: ChatMessageRenderContext,
  sourceIndex: number,
): boolean {
  const sourceMessage = context.allMessages[sourceIndex];
  const sessionScope = `${context.sessionId}\u0001`;
  const turnId = sourceMessage?.turnId?.trim();
  const messageId = sourceMessage?.id?.trim();
  return Boolean(
    (turnId && key.startsWith(`${sessionScope}${turnId}\u0001`))
    || (messageId && key.startsWith(`${sessionScope}${messageId}\u0001`))
    || key.startsWith(`${sessionScope}${sourceIndex}\u0001`),
  );
}

function isDisclosureKeyRelevantToContext(
  key: string,
  context: ChatMessageRenderContext,
): boolean {
  if (
    isDisclosureKeyRelevantToSourceMessage(key, context, context.index)
    || isDisclosureKeyInScope(key, context.turnFileChanges?.scopeKey)
    || isDisclosureKeyInScope(key, context.turnProcess?.key)
  ) {
    return true;
  }

  return context.turnProcess?.items.some((item) => (
    isDisclosureKeyRelevantToSourceMessage(key, context, item.sourceIndex)
  )) ?? false;
}

function areDisclosureStatesEqual(
  left: ChatMessageRenderContext,
  right: ChatMessageRenderContext,
): boolean {
  const leftKeys = left.expandedDisclosureKeys;
  const rightKeys = right.expandedDisclosureKeys;
  if (leftKeys === rightKeys) {
    return true;
  }

  for (const key of leftKeys) {
    if (
      !rightKeys.has(key)
      && (
        isDisclosureKeyRelevantToContext(key, left)
        || isDisclosureKeyRelevantToContext(key, right)
      )
    ) {
      return false;
    }
  }
  for (const key of rightKeys) {
    if (
      !leftKeys.has(key)
      && (
        isDisclosureKeyRelevantToContext(key, left)
        || isDisclosureKeyRelevantToContext(key, right)
      )
    ) {
      return false;
    }
  }
  return true;
}

function areRenderContextsEqual(
  left: ChatMessageRenderContext,
  right: ChatMessageRenderContext,
): boolean {
  return left === right || (
    areActionTargetsEqual(left.actionTarget, right.actionTarget)
    && areActionTargetMessagesEqual(left, right)
    && left.copyMessageToClipboard === right.copyMessageToClipboard
    && left.engineId === right.engineId
    && left.environment === right.environment
    && areDisclosureStatesEqual(left, right)
    && left.index === right.index
    && left.layout === right.layout
    && left.providerProfile === right.providerProfile
    && left.renderMarkdownContent === right.renderMarkdownContent
    && left.sessionId === right.sessionId
    && left.showMessageActions === right.showMessageActions
    && left.suppressInlineFileChanges === right.suppressInlineFileChanges
    && left.suppressProcessBlocks === right.suppressProcessBlocks
    && left.toggleDisclosure === right.toggleDisclosure
    && areTurnPresentationsEqual(left.turn, right.turn)
    && areFileChangePresentationsEqual(left.turnFileChanges, right.turnFileChanges)
    && areProcessPresentationsEqual(left.turnProcess, right.turnProcess)
  );
}

export function areChatTranscriptMessagePropsEqual(
  previousProps: ChatTranscriptMessageProps,
  nextProps: ChatTranscriptMessageProps,
): boolean {
  return previousProps.message === nextProps.message
    && previousProps.index === nextProps.index
    && previousProps.transcriptIndex === nextProps.transcriptIndex
    && previousProps.sessionId === nextProps.sessionId
    && previousProps.layout === nextProps.layout
    && previousProps.engineId === nextProps.engineId
    && previousProps.messageRenderKey === nextProps.messageRenderKey
    && previousProps.messageRef === nextProps.messageRef
    && previousProps.registry === nextProps.registry
    && areActivitySummariesEqual(
      previousProps.activitySummary,
      nextProps.activitySummary,
    )
    && areRenderContextsEqual(previousProps.context, nextProps.context);
}
