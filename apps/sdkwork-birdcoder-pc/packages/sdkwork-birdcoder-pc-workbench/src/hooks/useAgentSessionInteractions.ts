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

export type AgentSessionPendingTypedRequest = NonNullable<AgentInteractionRecord['request']>;
export type AgentInteractionAction = AgentSessionPendingTypedRequest['allowedActions'][number];
export type AgentTypedInteractionResolution = Parameters<
  IAgentSessionService['resolveInteraction']
>[2]['resolution'];

export interface AgentApprovalDecisionInput {
  action?: AgentInteractionAction;
  content?: unknown;
  decision: 'approved' | 'denied' | 'blocked';
  execPolicyAmendment?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  networkPolicyAmendment?: Record<string, unknown>;
  permissions?: Record<string, unknown>;
  reason?: string;
  scope?: 'turn' | 'session';
  strictAutoReview?: boolean;
}

export interface AgentQuestionAnswerInput {
  action?: AgentInteractionAction;
  answer?: string;
  answers?: Record<string, string[]>;
  content?: unknown;
  freeformAnswer?: string | null;
  metadata?: Record<string, unknown>;
  optionLabel?: string;
  optionValue?: string;
  rejected?: boolean;
  selectedOptions?: string[];
  selectedRoles?: string[];
  selectedSources?: string[];
}

export interface AgentSessionPendingApproval {
  interactionId: string;
  prompt: string;
  request?: AgentSessionPendingTypedRequest;
  runtimeBindingId?: string;
  sessionId: string;
  turnId?: string;
}

export interface AgentSessionPendingQuestionOption {
  description?: string;
  label: string;
  value: string;
}

export interface AgentSessionPendingQuestionPrompt {
  allowOther?: boolean;
  header?: string;
  id?: string;
  options?: AgentSessionPendingQuestionOption[];
  question: string;
  secret?: boolean;
}

export interface AgentSessionPendingQuestion {
  interactionId: string;
  prompt: string;
  questions: AgentSessionPendingQuestionPrompt[];
  request?: AgentSessionPendingTypedRequest;
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
      request: interaction.request ?? undefined,
      runtimeBindingId: interaction.runtimeBindingId ?? undefined,
      sessionId: interaction.sessionId,
      turnId: interaction.turnId ?? undefined,
    };
    if (
      interaction.request?.category === 'approval'
      || interaction.request?.category === 'elicitation'
      || (!interaction.request && interaction.kind === 'approval')
    ) {
      approvals.push(common);
      continue;
    }
    if (
      interaction.request?.category === 'user_input'
      || interaction.request?.category === 'setup'
      || (!interaction.request && interaction.kind === 'user_question')
    ) {
      const typedQuestions = interaction.request?.data.questions?.map((question) => ({
        allowOther: question.allowOther,
        header: question.header,
        id: question.id,
        question: question.prompt,
        secret: question.secret,
        options: question.options?.map((option) => ({
          description: option.description ?? undefined,
          label: option.label,
          value: option.label,
        })) ?? undefined,
      }));
      const pickerQuestion = interaction.request?.data.question
        ? [{
            allowOther: true,
            question: interaction.request.data.question,
            options: interaction.request.data.options?.map((option) => ({
              description: option.description ?? undefined,
              label: option.label,
              value: option.label,
            })),
          }]
        : undefined;
      questions.push({
        ...common,
        questions: typedQuestions?.length
          ? typedQuestions
          : pickerQuestion ?? [{
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

function resolveAllowedAction(
  request: AgentSessionPendingTypedRequest,
  preferredAction: AgentInteractionAction | undefined,
  fallbackActions: readonly AgentInteractionAction[],
): AgentInteractionAction {
  const action = preferredAction
    ?? fallbackActions.find((candidate) => request.allowedActions.includes(candidate));
  if (!action || !request.allowedActions.includes(action)) {
    throw new Error(
      `Agent interaction ${request.kind} does not allow the requested action.`,
    );
  }
  return action;
}

function isApprovalInteraction(interaction: AgentInteractionRecord): boolean {
  return interaction.request
    ? interaction.request.category === 'approval'
      || interaction.request.category === 'elicitation'
    : interaction.kind === 'approval';
}

function isUserInputInteraction(interaction: AgentInteractionRecord): boolean {
  return interaction.request
    ? interaction.request.category === 'user_input'
      || interaction.request.category === 'setup'
    : interaction.kind === 'user_question';
}

function compactStringArray(values: readonly string[] | undefined): string[] | undefined {
  if (!values) return undefined;
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : [];
}

function buildTypedApprovalResolution(
  request: AgentSessionPendingTypedRequest,
  input: AgentApprovalDecisionInput,
): AgentTypedInteractionResolution {
  const action = resolveAllowedAction(
    request,
    input.action,
    input.decision === 'approved'
      ? ['accept', 'grant']
      : input.decision === 'blocked'
        ? ['cancel', 'decline']
        : ['decline', 'cancel'],
  );
  const resolution: AgentTypedInteractionResolution = { action };
  if (input.content !== undefined) resolution.content = input.content;
  if (input.execPolicyAmendment) {
    resolution.execPolicyAmendment = input.execPolicyAmendment;
  }
  if (input.metadata) resolution.metadata = input.metadata;
  if (input.networkPolicyAmendment) {
    resolution.networkPolicyAmendment = input.networkPolicyAmendment;
  }
  if (input.permissions) resolution.permissions = input.permissions;
  if (input.scope) resolution.scope = input.scope;
  if (input.strictAutoReview !== undefined) {
    resolution.strictAutoReview = input.strictAutoReview;
  }
  return resolution;
}

function buildTypedQuestionResolution(
  request: AgentSessionPendingTypedRequest,
  input: AgentQuestionAnswerInput,
): AgentTypedInteractionResolution {
  const action = resolveAllowedAction(
    request,
    input.action,
    input.rejected
      ? ['cancel', 'dismiss', 'skip']
      : ['submit', 'continue'],
  );
  const answer = input.answer?.trim() || input.optionLabel?.trim() || '';
  const resolution: AgentTypedInteractionResolution = { action };
  const firstQuestionId = request.data.questions?.[0]?.id;
  if (input.answers) {
    resolution.answers = input.answers;
  } else if (answer && firstQuestionId) {
    resolution.answers = { [firstQuestionId]: [answer] };
  }
  if (input.content !== undefined) resolution.content = input.content;
  if (input.freeformAnswer !== undefined) {
    resolution.freeformAnswer = input.freeformAnswer?.trim() || null;
  } else if (answer && request.kind === 'option_picker') {
    resolution.freeformAnswer = answer;
  }
  if (input.metadata) resolution.metadata = input.metadata;
  const selectedOptions = compactStringArray(input.selectedOptions);
  if (selectedOptions) resolution.selectedOptions = selectedOptions;
  const selectedRoles = compactStringArray(input.selectedRoles);
  if (selectedRoles) resolution.selectedRoles = selectedRoles;
  const selectedSources = compactStringArray(input.selectedSources);
  if (selectedSources) resolution.selectedSources = selectedSources;
  if (answer && request.kind === 'context_source_picker' && !selectedSources) {
    resolution.selectedSources = [answer];
  }
  if (
    answer
    && request.kind === 'setup_step'
    && request.data.step === 'role'
    && !selectedRoles
  ) {
    resolution.selectedRoles = [answer];
  }
  if (
    answer
    && request.kind === 'setup_step'
    && request.data.step === 'context'
    && !selectedSources
  ) {
    resolution.selectedSources = [answer];
  }
  return resolution;
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
    if (!isApprovalInteraction(interaction)) {
      throw new Error(`Agent interaction ${interactionId} is not an approval.`);
    }
    const claim = await claimInteraction(
      agentSessionService,
      { agentId, sessionId },
      interaction,
      claimOwner,
    );
    const requestedAt = new Date().toISOString();
    const result = interaction.request
      ? await agentSessionService.resolveInteraction(
          { agentId, sessionId },
          interaction.interactionId,
          {
            resolution: buildTypedApprovalResolution(interaction.request, input),
            claimToken: claim.claimToken,
            expectedVersion: claim.interaction.version,
            fencingToken: claim.fencingToken,
            requestedAt,
          },
        )
      : await agentSessionService.approveInteraction(
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
            requestedAt,
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
    if (!isUserInputInteraction(interaction)) {
      throw new Error(`Agent interaction ${interactionId} is not a user question.`);
    }
    if (
      !interaction.request
      &&
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
    const requestedAt = new Date().toISOString();
    const result = interaction.request
      ? await agentSessionService.resolveInteraction(
          { agentId, sessionId },
          interaction.interactionId,
          {
            resolution: buildTypedQuestionResolution(interaction.request, {
              ...input,
              answer,
              optionLabel,
              optionValue,
            }),
            claimToken: claim.claimToken,
            expectedVersion: claim.interaction.version,
            fencingToken: claim.fencingToken,
            requestedAt,
          },
        )
      : await agentSessionService.answerInteraction(
          { agentId, sessionId },
          interaction.interactionId,
          {
            answer,
            claimToken: claim.claimToken,
            expectedVersion: claim.interaction.version,
            fencingToken: claim.fencingToken,
            rejected: input.rejected === true,
            requestedAt,
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
