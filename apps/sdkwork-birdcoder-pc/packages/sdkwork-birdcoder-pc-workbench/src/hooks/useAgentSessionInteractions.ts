import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AgentSessionIdentity,
  IAgentSessionService,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import { useIDEServices } from '../context/ideServices.ts';
import {
  invalidateActiveWorkspaceSessionInboxSynchronizations,
} from '../workbench/workspaceSessionInboxCoordinator.ts';

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
  error: Error | null;
  isLoading: boolean;
}

const EMPTY_PENDING_INTERACTIONS: AgentSessionPendingInteractions = {
  approvals: [],
  questions: [],
};
const INITIAL_STATE: AgentSessionPendingInteractionState = {
  ...EMPTY_PENDING_INTERACTIONS,
  error: null,
  isLoading: false,
};
const INTERACTION_CLAIM_LEASE_SECONDS = 60;
const PENDING_INTERACTION_PAGE_SIZE = 200;
const PENDING_INTERACTION_MAX_PAGES = 5;
export const MAX_AGENT_INTERACTION_APPROVAL_REASON_CHARACTERS = 2_048;
export const MAX_AGENT_INTERACTION_ANSWER_CHARACTERS = 65_536;
export const MAX_AGENT_INTERACTION_OPTION_VALUE_CHARACTERS = 256;

function normalizeBoundedInteractionInput(
  value: string | null | undefined,
  label: string,
  maxCharacters: number,
): string | undefined {
  if (value !== null && value !== undefined && value.length > maxCharacters) {
    throw new RangeError(`${label} must be ${maxCharacters} characters or fewer.`);
  }
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    return undefined;
  }
  if (normalized.length > maxCharacters) {
    throw new RangeError(`${label} must be ${maxCharacters} characters or fewer.`);
  }
  return normalized;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

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
  identity: AgentSessionIdentity,
  expectedProjectId?: string | null,
  signal?: AbortSignal,
): Promise<AgentSessionPendingInteractions> {
  const normalizedIdentity = {
    agentId: identity.agentId.trim(),
    sessionId: identity.sessionId.trim(),
  };
  const session = await service.getSession(normalizedIdentity, { signal });
  const sessionId = normalizedIdentity.sessionId;
  const normalizedExpectedProjectId = expectedProjectId?.trim();
  if (
    normalizedExpectedProjectId
    && session.projectId?.trim() !== normalizedExpectedProjectId
  ) {
    throw new Error(
      `Agent session ${sessionId} does not belong to project ${normalizedExpectedProjectId}.`,
    );
  }

  const pendingInteractions: AgentInteractionRecord[] = [];
  const interactionIds = new Set<string>();
  for (let page = 1; page <= PENDING_INTERACTION_MAX_PAGES; page += 1) {
    signal?.throwIfAborted();
    const interactionPage = await service.listInteractions(normalizedIdentity, {
      page,
      pageSize: PENDING_INTERACTION_PAGE_SIZE,
      status: 'pending',
    }, { signal });
    if (
      interactionPage.pageInfo.mode !== 'offset'
      || typeof interactionPage.pageInfo.hasMore !== 'boolean'
      || (interactionPage.pageInfo.page ?? page) !== page
      || (interactionPage.pageInfo.pageSize ?? PENDING_INTERACTION_PAGE_SIZE)
        !== PENDING_INTERACTION_PAGE_SIZE
      || interactionPage.items.length > PENDING_INTERACTION_PAGE_SIZE
    ) {
      throw new Error('Agents pending Interaction pagination metadata is inconsistent.');
    }
    for (const interaction of interactionPage.items) {
      if (interaction.sessionId !== sessionId || interaction.status !== 'pending') {
        throw new Error('Agents pending Interaction page returned an unexpected resource.');
      }
      if (interactionIds.has(interaction.interactionId)) {
        throw new Error(
          `Agents pending Interaction page returned duplicate ${interaction.interactionId}.`,
        );
      }
      interactionIds.add(interaction.interactionId);
      pendingInteractions.push(interaction);
    }
    if (!interactionPage.pageInfo.hasMore) {
      return mapAgentSessionPendingInteractions(pendingInteractions);
    }
  }
  throw new Error(
    `Agents Session has more than ${PENDING_INTERACTION_PAGE_SIZE * PENDING_INTERACTION_MAX_PAGES} pending Interactions.`,
  );
}

async function claimInteraction(
  service: IAgentSessionService,
  identity: AgentSessionIdentity,
  interaction: AgentInteractionRecord,
  claimOwner: string,
) {
  return service.claimInteraction(identity, interaction.interactionId, {
    claimOwner,
    expectedVersion: interaction.version,
    leaseSeconds: INTERACTION_CLAIM_LEASE_SECONDS,
    requestedAt: new Date().toISOString(),
  });
}

export function useAgentSessionPendingInteractions(
  identity?: AgentSessionIdentity | null,
  refreshToken?: string | number | null,
  scopeKey?: string | null,
  expectedProjectId?: string | null,
) {
  const { agentSessionService, authService } = useIDEServices();
  const [state, setState] = useState<AgentSessionPendingInteractionState>(INITIAL_STATE);
  const latestRequestIdRef = useRef(0);
  const latestScopeKeyRef = useRef<string | null>(null);
  const refreshAbortControllerRef = useRef<AbortController | null>(null);
  const agentId = identity?.agentId.trim() ?? '';
  const sessionId = identity?.sessionId.trim() ?? '';
  const normalizedScopeKey = agentId && sessionId
    ? scopeKey?.trim() || `${agentId}\u0001${sessionId}`
    : null;

  const refreshPendingInteractions = useCallback(async () => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    refreshAbortControllerRef.current?.abort(new DOMException(
      'Agents pending Interaction refresh was superseded.',
      'AbortError',
    ));
    refreshAbortControllerRef.current = null;
    if (!agentId || !sessionId) {
      latestScopeKeyRef.current = null;
      setState(INITIAL_STATE);
      return EMPTY_PENDING_INTERACTIONS;
    }

    const didSwitchScope = latestScopeKeyRef.current !== normalizedScopeKey;
    latestScopeKeyRef.current = normalizedScopeKey;
    setState((current) => ({
      ...(didSwitchScope ? EMPTY_PENDING_INTERACTIONS : current),
      error: didSwitchScope ? null : current.error,
      isLoading: true,
    }));
    const controller = new AbortController();
    refreshAbortControllerRef.current = controller;

    try {
      const pending = await loadAgentSessionPendingInteractions(
        agentSessionService,
        { agentId, sessionId },
        expectedProjectId,
        controller.signal,
      );
      if (latestRequestIdRef.current === requestId) {
        setState({ ...pending, error: null, isLoading: false });
      }
      return pending;
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        return EMPTY_PENDING_INTERACTIONS;
      }
      if (latestRequestIdRef.current === requestId) {
        setState((current) => ({
          ...current,
          error: error instanceof Error
            ? error
            : new Error('Failed to load agent session interactions.'),
          isLoading: false,
        }));
      }
      console.error('Failed to load agent session interactions', error);
      return EMPTY_PENDING_INTERACTIONS;
    } finally {
      if (refreshAbortControllerRef.current === controller) {
        refreshAbortControllerRef.current = null;
      }
    }
  }, [agentId, agentSessionService, expectedProjectId, normalizedScopeKey, sessionId]);

  const resolveInteractionAndClaimOwner = useCallback(async (interactionId: string) => {
    if (!agentId || !sessionId) {
      throw new Error('An agent session is required to resolve an interaction.');
    }
    const normalizedInteractionId = interactionId.trim();
    const [interaction, currentUser] = await Promise.all([
      agentSessionService.getInteraction(
        { agentId, sessionId },
        normalizedInteractionId,
      ),
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
  }, [agentId, agentSessionService, authService, sessionId]);

  const submitApprovalDecision = useCallback(async (
    interactionId: string,
    input: AgentApprovalDecisionInput,
  ) => {
    if (!agentId || !sessionId) {
      throw new Error('An agent session is required to approve an interaction.');
    }
    const reason = normalizeBoundedInteractionInput(
      input.reason,
      'Agent Interaction approval reason',
      MAX_AGENT_INTERACTION_APPROVAL_REASON_CHARACTERS,
    );
    const { claimOwner, interaction } = await resolveInteractionAndClaimOwner(interactionId);
    if (interaction.kind !== 'approval') {
      throw new Error(`Agent interaction ${interactionId} is not an approval.`);
    }
    const claim = await claimInteraction(
      agentSessionService,
      { agentId, sessionId },
      interaction,
      claimOwner,
    );
    const result = await agentSessionService.approveInteraction(
      { agentId, sessionId },
      interaction.interactionId,
      {
        approved: input.decision === 'approved',
        claimToken: claim.claimToken,
        expectedVersion: claim.interaction.version,
        fencingToken: claim.fencingToken,
        reason: reason || (
          input.decision === 'blocked' ? 'Blocked by user' : undefined
        ),
        requestedAt: new Date().toISOString(),
      },
    );
    void invalidateActiveWorkspaceSessionInboxSynchronizations();
    await refreshPendingInteractions();
    return result;
  }, [
    agentId,
    agentSessionService,
    refreshPendingInteractions,
    resolveInteractionAndClaimOwner,
    sessionId,
  ]);

  const submitQuestionAnswer = useCallback(async (
    interactionId: string,
    input: AgentQuestionAnswerInput,
  ) => {
    if (!agentId || !sessionId) {
      throw new Error('An agent session is required to answer an interaction.');
    }
    const submittedAnswer = normalizeBoundedInteractionInput(
      input.answer,
      'Agent Interaction answer',
      MAX_AGENT_INTERACTION_ANSWER_CHARACTERS,
    );
    const optionLabel = normalizeBoundedInteractionInput(
      input.optionLabel,
      'Agent Interaction option label',
      MAX_AGENT_INTERACTION_ANSWER_CHARACTERS,
    );
    const optionValue = normalizeBoundedInteractionInput(
      input.optionValue,
      'Agent Interaction selected option value',
      MAX_AGENT_INTERACTION_OPTION_VALUE_CHARACTERS,
    );
    const { claimOwner, interaction } = await resolveInteractionAndClaimOwner(interactionId);
    if (interaction.kind !== 'user_question') {
      throw new Error(`Agent interaction ${interactionId} is not a user question.`);
    }
    if (
      optionValue
      && !interaction.options.some((option) => option.value.trim() === optionValue)
    ) {
      throw new Error(`Agent interaction ${interactionId} does not contain the selected option.`);
    }
    const claim = await claimInteraction(
      agentSessionService,
      { agentId, sessionId },
      interaction,
      claimOwner,
    );
    const answer = submittedAnswer || optionLabel || '';
    const result = await agentSessionService.answerInteraction(
      { agentId, sessionId },
      interaction.interactionId,
      {
        answer,
        claimToken: claim.claimToken,
        expectedVersion: claim.interaction.version,
        fencingToken: claim.fencingToken,
        rejected: input.rejected === true,
        requestedAt: new Date().toISOString(),
        selectedOptionValue: optionValue,
      },
    );
    void invalidateActiveWorkspaceSessionInboxSynchronizations();
    await refreshPendingInteractions();
    return result;
  }, [
    agentId,
    agentSessionService,
    refreshPendingInteractions,
    resolveInteractionAndClaimOwner,
    sessionId,
  ]);

  useEffect(() => {
    void refreshPendingInteractions();
  }, [refreshPendingInteractions, refreshToken]);

  useEffect(() => () => {
    latestRequestIdRef.current += 1;
    refreshAbortControllerRef.current?.abort(new DOMException(
      'Agents pending Interaction scope was disposed.',
      'AbortError',
    ));
    refreshAbortControllerRef.current = null;
  }, [normalizedScopeKey]);

  const visibleState = agentId && sessionId && latestScopeKeyRef.current === normalizedScopeKey
    ? state
    : INITIAL_STATE;
  return {
    ...visibleState,
    refreshPendingInteractions,
    submitApprovalDecision,
    submitQuestionAnswer,
  };
}
