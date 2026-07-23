import { useCallback } from 'react';
import {
  useAgentSessionPendingInteractions,
} from '@sdkwork/birdcoder-pc-workbench/hooks/useAgentSessionInteractions';
import type {
  AgentApprovalDecisionInput,
  AgentQuestionAnswerInput,
} from '@sdkwork/birdcoder-pc-workbench/hooks/useAgentSessionInteractions';

interface UseCodePendingInteractionsOptions {
  refreshToken?: string | number | null;
  projectId?: string | null;
  sessionId: string | null;
  sessionScopeKey?: string | null;
  onRefreshAgentSessionItems: (
    agentSessionId: string,
  ) => void | Promise<void>;
}

export function useCodePendingInteractions({
  refreshToken,
  projectId,
  sessionId,
  sessionScopeKey,
  onRefreshAgentSessionItems,
}: UseCodePendingInteractionsOptions) {
  const {
    approvals: pendingApprovals,
    questions: pendingUserQuestions,
    submitApprovalDecision,
    submitQuestionAnswer,
  } = useAgentSessionPendingInteractions(
    sessionId,
    refreshToken,
    sessionScopeKey,
    projectId,
  );

  const onSubmitApprovalDecision = useCallback(async (
    interactionId: string,
    request: AgentApprovalDecisionInput,
  ) => {
    await submitApprovalDecision(interactionId, request);
    if (sessionId) {
      await onRefreshAgentSessionItems(sessionId);
    }
  }, [onRefreshAgentSessionItems, sessionId, submitApprovalDecision]);

  const onSubmitUserQuestionAnswer = useCallback(async (
    interactionId: string,
    request: AgentQuestionAnswerInput,
  ) => {
    await submitQuestionAnswer(interactionId, request);
    if (sessionId) {
      await onRefreshAgentSessionItems(sessionId);
    }
  }, [onRefreshAgentSessionItems, sessionId, submitQuestionAnswer]);

  return {
    onSubmitApprovalDecision,
    onSubmitUserQuestionAnswer,
    pendingApprovals,
    pendingUserQuestions,
  };
}
