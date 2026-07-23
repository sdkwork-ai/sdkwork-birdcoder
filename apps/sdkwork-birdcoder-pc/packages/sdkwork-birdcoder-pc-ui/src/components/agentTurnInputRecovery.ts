import type { WorkbenchQueuedAgentTurnInput } from '@sdkwork/birdcoder-pc-workbench';

export function resolveComposerInputAfterSendFailure(
  submittedInput: string,
  currentInput: string,
): string {
  return currentInput.trim() ? currentInput : submittedInput;
}

export function restoreQueuedAgentTurnInputsAfterSendFailure(
  dispatchedInputs: readonly WorkbenchQueuedAgentTurnInput[],
  currentInputs: readonly WorkbenchQueuedAgentTurnInput[],
): WorkbenchQueuedAgentTurnInput[] {
  if (dispatchedInputs.length === 0) {
    return [...currentInputs];
  }

  const dispatchedInputIds = new Set(
    dispatchedInputs.map((input) => input.id.trim()).filter(Boolean),
  );
  return [
    ...dispatchedInputs,
    ...currentInputs.filter((input) => !dispatchedInputIds.has(input.id)),
  ];
}
