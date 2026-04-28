import type { WorkbenchChatQueuedMessage } from '@sdkwork/birdcoder-commons';

export function resolveComposerInputAfterSendFailure(
  submittedInput: string,
  currentInput: string,
): string {
  return currentInput.trim() ? currentInput : submittedInput;
}

export function restoreQueuedMessagesAfterSendFailure(
  dispatchedQueue: readonly WorkbenchChatQueuedMessage[],
  currentQueue: readonly WorkbenchChatQueuedMessage[],
): WorkbenchChatQueuedMessage[] {
  if (dispatchedQueue.length === 0) {
    return [...currentQueue];
  }

  const dispatchedMessageIds = new Set(
    dispatchedQueue.map((message) => message.id.trim()).filter(Boolean),
  );
  return [
    ...dispatchedQueue,
    ...currentQueue.filter((message) => !dispatchedMessageIds.has(message.id)),
  ];
}
