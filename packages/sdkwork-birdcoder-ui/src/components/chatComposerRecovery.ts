export function resolveComposerInputAfterSendFailure(
  submittedInput: string,
  currentInput: string,
): string {
  return currentInput.trim() ? currentInput : submittedInput;
}

export function restoreQueuedMessagesAfterSendFailure(
  dispatchedQueue: readonly string[],
  currentQueue: readonly string[],
): string[] {
  if (dispatchedQueue.length === 0) {
    return currentQueue as string[];
  }

  return [...dispatchedQueue, ...currentQueue];
}
