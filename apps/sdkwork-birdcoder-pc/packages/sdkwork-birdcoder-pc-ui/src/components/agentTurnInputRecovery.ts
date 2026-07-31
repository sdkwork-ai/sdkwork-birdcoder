export function resolveComposerInputAfterSendFailure(
  submittedInput: string,
  currentInput: string,
): string {
  return currentInput.trim() ? currentInput : submittedInput;
}
