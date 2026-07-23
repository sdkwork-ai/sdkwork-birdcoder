import { useCallback, useEffect, useRef, useState } from 'react';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import { useIDEServices } from '../context/ideServices.ts';

type AgentInteractionRecord = Awaited<
  ReturnType<IAgentSessionService['listInteractions']>
>['items'][number];

export interface AgentApprovalDecisionInput {
  decision: 'approved' | 'denied' | 'blocked';
  reason?: string;
}

export interface AgentQuestionAnswerInput {
  answer?: string;
  optionLabel?: string;
  optionValue?: string;
  rejected?: boolean;
}

export interface AgentSessionPendingApproval {
  interactionId: string;
  prompt: string;
  runtimeBindingId?: string;
  sessionId: string;
  turnId?: string;
}

export interface AgentSessionPendingQuestionOption {
  label: string;
  value: string;
}

export interface AgentSessionPendingQuestionPrompt {
  options?: AgentSessionPendingQuestionOption[];
  question: string;
}

export interface AgentSessionPendingQuestion {
  interactionId: string;
  prompt: string;
  questions: AgentSessionPendingQuestionPrompt[];
  runtimeBindingId?: string;
  sessionId: string;
  turnId?: string;
}

export interface AgentSessionPendingInteractions {
  approvals: AgentSessionPendingApproval[];
  questions: AgentSessionPendingQuestion[];
}

export interface AgentSessionPendingInteractionState
  extends AgentSessionPendingInteractions {
  isLoading: boolean;
}

const EMPTY_PENDING_INTERACTIONS: AgentSessionPendingInteractions = {
  approvals: [],
  questions: [],
};
const INITIAL_STATE: AgentSessionPendingInteractionState = {
  ...EMPTY_PENDING_INTERACTIONS,
  isLoading: false,
};
const INTERACTION_CLAIM_LEASE_SECONDS = 60;

function compareInteractions(
  left: AgentInteractionRecord,
  right: AgentInteractionRecord,
): number {
  const timestampComparison = Date.parse(left.createdAt) - Date.parse(right.createdAt);
  return timestampComparison || left.interactionId.localeCompare(right.interactionId);
}

export function mapAgentSessionPendingInteractions(
  interactions: readonly AgentInteractionRecord[],
): AgentSessionPendingInteractions {
  const approvals: AgentSessionPendingApproval[] = [];
  const questions: AgentSessionPendingQuestion[] = [];

  for (const interaction of [...interactions].sort(compareInteractions)) {
    if (interaction.status !== 'pending') {
      continue;
    }
    const common = {
      interactionId: interaction.interactionId,
      prompt: interaction.prompt,
      runtimeBindingId: interaction.runtimeBindingId ?? undefined,
      sessionId: interaction.sessionId,
      turnId: interaction.turnId ?? undefined,
    };
    if (interaction.kind === 'approval') {
      approvals.push(common);
      continue;
    }
    if (interaction.kind === 'user_question') {
      questions.push({
        ...common,
        questions: [{
          question: interaction.prompt,
          options: interaction.options.length > 0
            ? interaction.options.map((option) => ({
                label: option.label,
                value: option.value,
              }))
            : undefined,
        }],
      });
    }
  }

  return approvals.length === 0 && questions.length === 0
    ? EMPTY_PENDING_INTERACTIONS
    : { approvals, questions };
}

export async function loadAgentSessionPendingInteractions(
  service: IAgentSessionService,
  sessionId: string,
  expectedProjectId?: string | null,
): Promise<AgentSessionPendingInteractions> {
  const session = await service.getSession(sessionId);
  const normalizedExpectedProjectId = expectedProjectId?.trim();
  if (
    normalizedExpectedProjectId
    && session.projectId?.trim() !== normalizedExpectedProjectId
  ) {
    throw new Error(
      `Agent session ${sessionId} does not belong to project ${normalizedExpectedProjectId}.`,
    );
  }

  const interactionPage = await service.listInteractions(sessionId, {
    page: 1,
    pageSize: 50,
  });
  return mapAgentSessionPendingInteractions(interactionPage.items);
}

async function claimInteraction(
  service: IAgentSessionService,
  sessionId: string,
  interaction: AgentInteractionRecord,
  claimOwner: string,
) {
  return service.claimInteraction(sessionId, interaction.interactionId, {
    claimOwner,
    expectedVersion: interaction.version,
    leaseSeconds: INTERACTION_CLAIM_LEASE_SECONDS,
    requestedAt: new Date().toISOString(),
  });
}

export function useAgentSessionPendingInteractions(
  sessionId?: string | null,
  refreshToken?: string | number | null,
  scopeKey?: string | null,
  expectedProjectId?: string | null,
) {
  const { agentSessionService, authService } = useIDEServices();
  const [state, setState] = useState<AgentSessionPendingInteractionState>(INITIAL_STATE);
  const latestRequestIdRef = useRef(0);
  const latestScopeKeyRef = useRef<string | null>(null);
  const normalizedScopeKey = sessionId
    ? scopeKey?.trim() || sessionId
    : null;

  const refreshPendingInteractions = useCallback(async () => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    if (!sessionId) {
      latestScopeKeyRef.current = null;
      setState(INITIAL_STATE);
      return EMPTY_PENDING_INTERACTIONS;
    }

    const didSwitchScope = latestScopeKeyRef.current !== normalizedScopeKey;
    latestScopeKeyRef.current = normalizedScopeKey;
    setState((current) => ({
      ...(didSwitchScope ? EMPTY_PENDING_INTERACTIONS : current),
      isLoading: true,
    }));

    try {
      const pending = await loadAgentSessionPendingInteractions(
        agentSessionService,
        sessionId,
        expectedProjectId,
      );
      if (latestRequestIdRef.current === requestId) {
        setState({ ...pending, isLoading: false });
      }
      return pending;
    } catch (error) {
      if (latestRequestIdRef.current === requestId) {
        setState((current) => ({ ...current, isLoading: false }));
      }
      console.error('Failed to load agent session interactions', error);
      return EMPTY_PENDING_INTERACTIONS;
    }
  }, [agentSessionService, expectedProjectId, normalizedScopeKey, sessionId]);

  const resolveInteractionAndClaimOwner = useCallback(async (interactionId: string) => {
    if (!sessionId) {
      throw new Error('An agent session is required to resolve an interaction.');
    }
    const normalizedInteractionId = interactionId.trim();
    const [interaction, currentUser] = await Promise.all([
      agentSessionService.getInteraction(sessionId, normalizedInteractionId),
      authService.getCurrentUser(),
    ]);
    if (interaction.status !== 'pending') {
      throw new Error(
        `Pending agent interaction ${normalizedInteractionId} was not found in session ${sessionId}.`,
      );
    }
    const claimOwner = currentUser?.id?.trim();
    if (!claimOwner) {
      throw new Error('An authenticated user is required to claim an agent interaction.');
    }
    return { claimOwner, interaction };
  }, [agentSessionService, authService, sessionId]);

  const submitApprovalDecision = useCallback(async (
    interactionId: string,
    input: AgentApprovalDecisionInput,
  ) => {
    if (!sessionId) {
      throw new Error('An agent session is required to approve an interaction.');
    }
    const { claimOwner, interaction } = await resolveInteractionAndClaimOwner(interactionId);
    if (interaction.kind !== 'approval') {
      throw new Error(`Agent interaction ${interactionId} is not an approval.`);
    }
    const claim = await claimInteraction(
      agentSessionService,
      sessionId,
      interaction,
      claimOwner,
    );
    const result = await agentSessionService.approveInteraction(
      sessionId,
      interaction.interactionId,
      {
        approved: input.decision === 'approved',
        claimToken: claim.claimToken,
        expectedVersion: claim.interaction.version,
        fencingToken: claim.fencingToken,
        reason: input.reason?.trim() || (
          input.decision === 'blocked' ? 'Blocked by user' : undefined
        ),
        requestedAt: new Date().toISOString(),
      },
    );
    await refreshPendingInteractions();
    return result;
  }, [agentSessionService, refreshPendingInteractions, resolveInteractionAndClaimOwner, sessionId]);

  const submitQuestionAnswer = useCallback(async (
    interactionId: string,
    input: AgentQuestionAnswerInput,
  ) => {
    if (!sessionId) {
      throw new Error('An agent session is required to answer an interaction.');
    }
    const { claimOwner, interaction } = await resolveInteractionAndClaimOwner(interactionId);
    if (interaction.kind !== 'user_question') {
      throw new Error(`Agent interaction ${interactionId} is not a user question.`);
    }
    const claim = await claimInteraction(
      agentSessionService,
      sessionId,
      interaction,
      claimOwner,
    );
    const answer = input.answer?.trim() || input.optionLabel?.trim() || '';
    const result = await agentSessionService.answerInteraction(
      sessionId,
      interaction.interactionId,
      {
        answer,
        claimToken: claim.claimToken,
        expectedVersion: claim.interaction.version,
        fencingToken: claim.fencingToken,
        rejected: input.rejected === true,
        requestedAt: new Date().toISOString(),
        selectedOptionValue: input.optionValue?.trim() || undefined,
      },
    );
    await refreshPendingInteractions();
    return result;
  }, [agentSessionService, refreshPendingInteractions, resolveInteractionAndClaimOwner, sessionId]);

  useEffect(() => {
    void refreshPendingInteractions();
  }, [refreshPendingInteractions, refreshToken]);

  const visibleState = sessionId && latestScopeKeyRef.current === normalizedScopeKey
    ? state
    : INITIAL_STATE;
  return {
    ...visibleState,
    refreshPendingInteractions,
    submitApprovalDecision,
    submitQuestionAnswer,
  };
}
