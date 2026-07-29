import { useCallback } from 'react';
import {
  useAgentSessionPendingInteractions,
} from '@sdkwork/birdcoder-pc-workbench/hooks/useAgentSessionInteractions';
import type {
  AgentApprovalDecisionInput,
  AgentQuestionAnswerInput,
} from '@sdkwork/birdcoder-pc-workbench/hooks/useAgentSessionInteractions';

interface UseCodePendingInteractionsOptions {
  agentId: string | null;
  refreshToken?: string | number | null;
  projectId?: string | null;
  sessionId: string | null;
  sessionScopeKey?: string | null;
  onRefreshAgentSessionItems: (
    agentSessionId: string,
    projectId?: string | null,
  ) => void | Promise<void>;
}

export function useCodePendingInteractions({
  agentId,
  refreshToken,
  projectId,
  sessionId,
  sessionScopeKey,
  onRefreshAgentSessionItems,
}: UseCodePendingInteractionsOptions) {
  const {
    approvals: pendingApprovals,
    isLoading: arePendingInteractionsLoading,
    questions: pendingUserQuestions,
    submitApprovalDecision,
    submitQuestionAnswer,
  } = useAgentSessionPendingInteractions(
    agentId && sessionId ? { agentId, sessionId } : null,
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
      await onRefreshAgentSessionItems(sessionId, projectId);
    }
  }, [onRefreshAgentSessionItems, projectId, sessionId, submitApprovalDecision]);

  const onSubmitUserQuestionAnswer = useCallback(async (
    interactionId: string,
    request: AgentQuestionAnswerInput,
  ) => {
    await submitQuestionAnswer(interactionId, request);
    if (sessionId) {
      await onRefreshAgentSessionItems(sessionId, projectId);
    }
  }, [onRefreshAgentSessionItems, projectId, sessionId, submitQuestionAnswer]);

  return {
    onSubmitApprovalDecision,
    onSubmitUserQuestionAnswer,
    pendingApprovals,
    pendingUserQuestions,
    arePendingInteractionsLoading,
  };
}
