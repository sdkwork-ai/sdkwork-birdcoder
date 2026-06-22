import type { BirdCoderChatMessage } from '@sdkwork/birdcoder-pc-commons/chat/types';
import { resolveMessageCopyContent } from '@sdkwork/birdcoder-pc-commons/chat/types';
import type { ChatMessageActionTarget } from './types.ts';

const EMPTY_MESSAGE_ACTION_TARGETS = new Map<number, ChatMessageActionTarget>();

export function isReplySegmentRole(role: BirdCoderChatMessage['role']): boolean {
  return (
    role === 'assistant' ||
    role === 'planner' ||
    role === 'reviewer' ||
    role === 'tool'
  );
}

export function buildVisibleMessageActionTargets(
  messages: readonly BirdCoderChatMessage[],
  visibleStartIndex: number,
  visibleCount: number,
): ReadonlyMap<number, ChatMessageActionTarget> {
  const normalizedVisibleStartIndex = Math.max(0, Math.floor(visibleStartIndex));
  const visibleEndIndex = Math.min(
    messages.length - 1,
    normalizedVisibleStartIndex + Math.max(0, Math.floor(visibleCount)) - 1,
  );
  if (normalizedVisibleStartIndex > visibleEndIndex) {
    return EMPTY_MESSAGE_ACTION_TARGETS;
  }

  const targets = new Map<number, ChatMessageActionTarget>();
  for (let index = normalizedVisibleStartIndex; index <= visibleEndIndex; index += 1) {
    const currentMessage = messages[index];
    if (!currentMessage) {
      continue;
    }

    if (currentMessage.role === 'user') {
      targets.set(index, {
        endIndex: index,
        startIndex: index,
      });
      continue;
    }

    if (!isReplySegmentRole(currentMessage.role)) {
      continue;
    }

    let startIndex = index;
    while (
      startIndex > 0 &&
      isReplySegmentRole(messages[startIndex - 1]?.role ?? 'system')
    ) {
      startIndex -= 1;
    }

    let endIndex = index;
    while (
      endIndex + 1 < messages.length &&
      isReplySegmentRole(messages[endIndex + 1]?.role ?? 'system')
    ) {
      endIndex += 1;
    }

    const target: ChatMessageActionTarget = {
      endIndex,
      startIndex,
    };

    const firstVisibleSegmentIndex = Math.max(startIndex, normalizedVisibleStartIndex);
    const lastVisibleSegmentIndex = Math.min(endIndex, visibleEndIndex);
    for (
      let groupedIndex = firstVisibleSegmentIndex;
      groupedIndex <= lastVisibleSegmentIndex;
      groupedIndex += 1
    ) {
      targets.set(groupedIndex, target);
    }

    index = lastVisibleSegmentIndex;
  }

  return targets;
}

export function resolveMessageActionTargetCopyText(
  messages: readonly BirdCoderChatMessage[],
  target: ChatMessageActionTarget | null | undefined,
  fallbackContent: string,
): string {
  if (!target) {
    return fallbackContent;
  }

  if (target.startIndex === target.endIndex && messages[target.startIndex]?.role === 'user') {
    return messages[target.startIndex]?.content ?? fallbackContent;
  }

  const startIndex = Math.max(0, target.startIndex);
  const endIndex = Math.min(messages.length - 1, target.endIndex);
  const copySegments: string[] = [];

  for (let index = startIndex; index <= endIndex; index += 1) {
    const message = messages[index];
    if (!message) {
      continue;
    }

    const content = resolveMessageCopyContent(message).trim();
    if (content) {
      copySegments.push(content);
    }
  }

  return copySegments.length > 0 ? copySegments.join('\n\n') : fallbackContent;
}

export function resolveMessageActionTargetMessageIds(
  messages: readonly BirdCoderChatMessage[],
  target: ChatMessageActionTarget | null | undefined,
  fallbackMessageId: string,
): string[] {
  if (!target) {
    return fallbackMessageId.trim().length > 0 ? [fallbackMessageId] : [];
  }

  const startIndex = Math.max(0, target.startIndex);
  const endIndex = Math.min(messages.length - 1, target.endIndex);
  const messageIds: string[] = [];

  for (let index = startIndex; index <= endIndex; index += 1) {
    const messageId = messages[index]?.id.trim() ?? '';
    if (messageId.length > 0) {
      messageIds.push(messageId);
    }
  }

  return messageIds.length > 0
    ? messageIds
    : (fallbackMessageId.trim().length > 0 ? [fallbackMessageId] : []);
}
