import {
  areAgentSessionItemsEquivalent,
  type AgentSessionItemView,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';

import { resolveTranscriptMessageKey } from './transcriptVirtualization';

interface TranscriptProjectionCandidate {
  message: AgentSessionItemView;
  used: boolean;
}

/**
 * Preserves committed row references when activity composition recreates
 * semantically identical transcript items during a streaming update.
 */
export function reconcileTranscriptProjectionReferences(
  previousMessages: readonly AgentSessionItemView[],
  nextMessages: readonly AgentSessionItemView[],
): readonly AgentSessionItemView[] {
  if (previousMessages === nextMessages) {
    return previousMessages;
  }

  const previousCandidatesByKey = new Map<string, TranscriptProjectionCandidate[]>();
  previousMessages.forEach((message, index) => {
    const key = resolveTranscriptMessageKey(message, index);
    const candidates = previousCandidatesByKey.get(key) ?? [];
    candidates.push({ message, used: false });
    previousCandidatesByKey.set(key, candidates);
  });

  let didReplaceNextMessageReference = false;
  const reconciledMessages = nextMessages.map((message, index) => {
    const candidates = previousCandidatesByKey.get(
      resolveTranscriptMessageKey(message, index),
    );
    const reusableCandidate = candidates?.find((candidate) => (
      !candidate.used
      && areAgentSessionItemsEquivalent(candidate.message, message)
    ));
    if (!reusableCandidate) {
      return message;
    }

    reusableCandidate.used = true;
    didReplaceNextMessageReference ||= reusableCandidate.message !== message;
    return reusableCandidate.message;
  });

  const isPreviousProjectionUnchanged =
    previousMessages.length === reconciledMessages.length
    && reconciledMessages.every((message, index) => message === previousMessages[index]);
  if (isPreviousProjectionUnchanged) {
    return previousMessages;
  }
  return didReplaceNextMessageReference ? reconciledMessages : nextMessages;
}
