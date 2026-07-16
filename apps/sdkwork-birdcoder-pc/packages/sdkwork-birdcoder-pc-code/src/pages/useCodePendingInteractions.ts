import { useCallback } from 'react';
import {
  useCodingSessionPendingInteractionState,
} from '@sdkwork/birdcoder-pc-commons/hooks/useCodingSessionProjection';
import type {
  BirdCoderSubmitApprovalDecisionRequest,
  BirdCoderSubmitUserQuestionAnswerRequest,
} from '@sdkwork/birdcoder-pc-types';

interface UseCodePendingInteractionsOptions {
  refreshToken?: string | number | null;
  projectId?: string | null;
  sessionId: string | null;
  sessionScopeKey?: string | null;
  onRefreshCodingSessionMessages: (
    codingSessionId: string,
  ) => void | Promise<void>;
}

export function useCodePendingInteractions({
  refreshToken,
  projectId,
  sessionId,
  sessionScopeKey,
  onRefreshCodingSessionMessages,
}: UseCodePendingInteractionsOptions) {
  const {
    approvals: pendingApprovals,
    questions: pendingUserQuestions,
    submitApprovalDecision,
    submitUserQuestionAnswer,
  } = useCodingSessionPendingInteractionState(
    sessionId,
    refreshToken,
    sessionScopeKey,
    projectId,
  );

  const onSubmitApprovalDecision = useCallback(async (
    interactionEventId: string,
    request: BirdCoderSubmitApprovalDecisionRequest,
  ) => {
    await submitApprovalDecision(interactionEventId, request);
    if (sessionId) {
      await onRefreshCodingSessionMessages(sessionId);
    }
  }, [onRefreshCodingSessionMessages, sessionId, submitApprovalDecision]);

  const onSubmitUserQuestionAnswer = useCallback(async (
    interactionEventId: string,
    request: BirdCoderSubmitUserQuestionAnswerRequest,
  ) => {
    await submitUserQuestionAnswer(interactionEventId, request);
    if (sessionId) {
      await onRefreshCodingSessionMessages(sessionId);
    }
  }, [onRefreshCodingSessionMessages, sessionId, submitUserQuestionAnswer]);

  return {
    onSubmitApprovalDecision,
    onSubmitUserQuestionAnswer,
    pendingApprovals,
    pendingUserQuestions,
  };
}
