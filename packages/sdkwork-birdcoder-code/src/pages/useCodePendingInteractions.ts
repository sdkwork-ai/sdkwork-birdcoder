import { useCallback } from 'react';
import {
  useCodingSessionPendingInteractionState,
} from '@sdkwork/birdcoder-commons';
import type {
  BirdCoderSubmitApprovalDecisionRequest,
  BirdCoderSubmitUserQuestionAnswerRequest,
} from '@sdkwork/birdcoder-types';

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
    approvalId: string,
    request: BirdCoderSubmitApprovalDecisionRequest,
  ) => {
    await submitApprovalDecision(approvalId, request);
    if (sessionId) {
      await onRefreshCodingSessionMessages(sessionId);
    }
  }, [onRefreshCodingSessionMessages, sessionId, submitApprovalDecision]);

  const onSubmitUserQuestionAnswer = useCallback(async (
    questionId: string,
    request: BirdCoderSubmitUserQuestionAnswerRequest,
  ) => {
    await submitUserQuestionAnswer(questionId, request);
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
