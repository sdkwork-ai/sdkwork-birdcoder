import {
  type AgentSessionItemRecord,
  type AgentResourceUserStateRecord,
  type AgentSessionRecord,
  type AgentSessionRuntimeBindingRecord,
  type AgentTurnRecord,
  type AgentTurnStreamEvent,
  completeAgentTurn,
  type CreateAgentSessionRuntimeBindingRequest,
  type SessionActivitySummary,
  type SdkworkAppClient as AgentsAppSdkClient,
} from '@sdkwork/birdcoder-pc-core/sdk/agents-app';
import { sha256Hash } from '@sdkwork/utils/crypto';
import { uuid } from '@sdkwork/utils/id';
import { normalizeOffsetListQuery } from '@sdkwork/utils/pagination';

import type {
  AgentProjectSessionPageRequest,
  AgentScopedSessionPageRequest,
  AgentSessionActivityPageRequest,
  AgentSessionReadOptions,
  AgentSessionPageRequest,
  AgentTurnCompletion,
  AgentWorkspaceSessionPageRequest,
  CreateAgentSessionInput,
  IAgentSessionService,
  SubmitAgentTurnOptions,
  SubmitAgentTurnInput,
} from './interfaces/IAgentSessionService.ts';

export const BIRDCODER_ASSISTANT_AGENT_ID = 'agent.birdcoder';
const SESSION_USER_STATE_BATCH_SIZE = 100;
const SESSION_ACTIVITY_CURSOR_MAX_LENGTH = 2_048;
const SESSION_ACTIVITY_DEFAULT_PAGE_SIZE = 20;
const SESSION_ACTIVITY_MAX_PAGE_SIZE = 200;
const TURN_RECOVERY_DEFAULT_MAX_ATTEMPTS = 300;
const TURN_RECOVERY_DEFAULT_POLL_INTERVAL_MS = 2_000;
const TURN_RECOVERY_ITEM_PAGE_SIZE = 200;
const TURN_RECOVERY_MAX_ITEM_PAGES = 10;

export interface BirdCoderAgentSessionServiceOptions {
  agentId?: string;
  client: AgentsAppSdkClient;
  providerSessionDirectoryIdentityProvider?: (
    projectId: string,
  ) => Promise<{ directoryFingerprint: string; directoryName: string } | null>;
  turnRecoveryMaxAttempts?: number;
  turnRecoveryPollIntervalMs?: number;
}

function hashPayload(value: unknown): string {
  return `sha256:${sha256Hash(JSON.stringify(value))}`;
}

function normalizePageRequest(request: AgentSessionPageRequest = {}) {
  const { page, page_size: pageSize } = normalizeOffsetListQuery({
    page: request.page,
    page_size: request.pageSize,
  });
  return { page, pageSize };
}

function toApiRequestOptions(options: AgentSessionReadOptions = {}) {
  return {
    signal: options.signal,
    timeout: options.timeoutMs,
  };
}

function normalizeProjectId(projectId: string): string {
  const normalized = projectId.trim();
  if (!normalized) {
    throw new Error('Agents project ID is required for session operations.');
  }
  return normalized;
}

function normalizeWorkspaceId(workspaceId: string): string {
  const normalized = workspaceId.trim();
  if (!normalized) {
    throw new Error('Agents workspace ID is required for session operations.');
  }
  return normalized;
}

function normalizeOptionalActivityScopeId(
  value: string | undefined,
  label: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} must not be blank.`);
  }
  return normalized;
}

function normalizeSessionActivityPageRequest(
  request: AgentSessionActivityPageRequest = {},
) {
  const pageSize = request.pageSize ?? SESSION_ACTIVITY_DEFAULT_PAGE_SIZE;
  if (
    !Number.isSafeInteger(pageSize)
    || pageSize < 1
    || pageSize > SESSION_ACTIVITY_MAX_PAGE_SIZE
  ) {
    throw new Error('Agents Session activity page size must be between 1 and 200.');
  }
  const cursor = request.cursor === undefined ? undefined : request.cursor.trim();
  if (
    cursor !== undefined
    && (cursor.length < 1 || cursor.length > SESSION_ACTIVITY_CURSOR_MAX_LENGTH)
  ) {
    throw new Error('Agents Session activity cursor must be between 1 and 2048 characters.');
  }
  return {
    agentId: normalizeOptionalActivityScopeId(request.agentId, 'Agents Agent ID'),
    cursor,
    pageSize,
    projectId: normalizeOptionalActivityScopeId(request.projectId, 'Agents project ID'),
    workspaceId: normalizeOptionalActivityScopeId(request.workspaceId, 'Agents workspace ID'),
  };
}

function isAgentSessionNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as {
    httpStatus?: unknown;
    message?: unknown;
    response?: { status?: unknown };
    status?: unknown;
    statusCode?: unknown;
  };
  const status = candidate.status
    ?? candidate.statusCode
    ?? candidate.httpStatus
    ?? candidate.response?.status;
  if (status === 404) {
    return true;
  }
  return (
    typeof candidate.message === 'string'
    && /(?:agent\s+)?session\s+not\s+found/iu.test(candidate.message)
  );
}

function normalizeOptionalRuntimeBindingValue(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function assertCreatedSessionIdentity(
  session: { agentId: string; projectId?: string | null; sessionId: string },
  expectedAgentId: string,
  expectedProjectId: string,
): void {
  const responseAgentId = session.agentId.trim();
  const responseProjectId = session.projectId?.trim() ?? '';
  if (responseAgentId !== expectedAgentId) {
    throw new Error(
      `Agents created Session ${session.sessionId} for Agent "${responseAgentId}" instead of requested Agent "${expectedAgentId}".`,
    );
  }
  if (responseProjectId !== expectedProjectId) {
    throw new Error(
      `Agents created Session ${session.sessionId} for Project "${responseProjectId}" instead of requested Project "${expectedProjectId}".`,
    );
  }
}

function isMatchingRuntimeBinding(
  binding: AgentSessionRuntimeBindingRecord,
  request: CreateAgentSessionRuntimeBindingRequest,
): boolean {
  return binding.runtimeBindingId === request.runtimeBindingId
    && binding.hostMode === request.hostMode
    && binding.transportKind === request.transportKind
    && binding.providerBindingId === request.providerBindingId
    && binding.modelId === request.modelId
    && binding.providerId === request.providerId
    && normalizeOptionalRuntimeBindingValue(binding.runtimeLocationId)
      === normalizeOptionalRuntimeBindingValue(request.runtimeLocationId)
    && normalizeOptionalRuntimeBindingValue(binding.providerSessionId)
      === normalizeOptionalRuntimeBindingValue(request.providerSessionId)
    && normalizeOptionalRuntimeBindingValue(binding.providerSessionTreeId)
      === normalizeOptionalRuntimeBindingValue(request.providerSessionTreeId)
    && normalizeOptionalRuntimeBindingValue(binding.providerParentSessionId)
      === normalizeOptionalRuntimeBindingValue(request.providerParentSessionId)
    && normalizeOptionalRuntimeBindingValue(binding.providerForkedFromSessionId)
      === normalizeOptionalRuntimeBindingValue(request.providerForkedFromSessionId)
    && binding.status === 'active'
    && binding.isCurrent;
}

function assertAgentTurnCompletion(
  value: unknown,
): asserts value is AgentTurnCompletion {
  if (
    !value
    || typeof value !== 'object'
    || !('session' in value)
    || !value.session
    || typeof value.session !== 'object'
    || !('turn' in value)
    || !value.turn
    || typeof value.turn !== 'object'
    || !('items' in value)
    || !Array.isArray(value.items)
  ) {
    throw new Error(
      'Agents turn completion response is missing its session, turn, or session items.',
    );
  }
}

function assertAgentTurnCompletionIdentity(
  completion: AgentTurnCompletion,
  expectedAgentId: string,
  expectedSessionId: string,
  expectedTurnId?: string,
  expectedRuntimeBindingId?: string,
): void {
  if (
    completion.session.agentId !== expectedAgentId
    || completion.session.sessionId !== expectedSessionId
    || completion.turn.agentId !== expectedAgentId
    || completion.turn.sessionId !== expectedSessionId
  ) {
    throw new Error('Agents turn completion identity does not match the submitted session.');
  }
  if (expectedTurnId && completion.turn.turnId !== expectedTurnId) {
    throw new Error('Agents turn completion returned an unexpected turn ID.');
  }
  if (
    expectedRuntimeBindingId
    && completion.turn.runtimeBindingId !== expectedRuntimeBindingId
  ) {
    throw new Error('Agents turn completion returned an unexpected runtime binding ID.');
  }
  if (completion.items.some((item) => item.sessionId !== expectedSessionId)) {
    throw new Error('Agents turn completion contains an item from another session.');
  }
}

function readAgentTurnCompletionEvent(event: unknown): AgentTurnCompletion {
  if (!event || typeof event !== 'object') {
    throw new Error('Agents turn stream completion event is malformed.');
  }
  const streamEvent = event as AgentTurnStreamEvent;
  const response = streamEvent.response;
  if (
    streamEvent.eventType !== 'completion'
    || !response
    || response.code !== 0
    || !response.data
    || typeof response.data !== 'object'
    || !('item' in response.data)
  ) {
    throw new Error('Agents turn stream completion event is malformed.');
  }
  const completion = response.data.item;
  assertAgentTurnCompletion(completion);
  return completion;
}

function isAgentTurnNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as {
    httpStatus?: unknown;
    message?: unknown;
    response?: { status?: unknown };
    status?: unknown;
    statusCode?: unknown;
  };
  const status = candidate.status
    ?? candidate.statusCode
    ?? candidate.httpStatus
    ?? candidate.response?.status;
  return status === 404 || (
    typeof candidate.message === 'string'
    && /(?:agent\s+)?turn\s+not\s+found/iu.test(candidate.message)
  );
}

function throwIfTurnDeliveryAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }
  throw signal.reason instanceof Error
    ? signal.reason
    : new Error('Agent turn delivery was aborted.');
}

async function waitForTurnRecovery(intervalMs: number, signal?: AbortSignal): Promise<void> {
  throwIfTurnDeliveryAborted(signal);
  if (intervalMs === 0) {
    await Promise.resolve();
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort);
      resolve();
    }, intervalMs);
    const handleAbort = () => {
      globalThis.clearTimeout(timeout);
      reject(
        signal?.reason instanceof Error
          ? signal.reason
          : new Error('Agent turn delivery was aborted.'),
      );
    };
    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}

function compareAgentSessionItemSequence(
  left: AgentSessionItemRecord,
  right: AgentSessionItemRecord,
): number {
  try {
    const leftSequence = BigInt(left.sequence);
    const rightSequence = BigInt(right.sequence);
    return leftSequence < rightSequence ? -1 : leftSequence > rightSequence ? 1 : 0;
  } catch {
    return left.sequence.localeCompare(right.sequence);
  }
}

function isTerminalAgentTurn(turn: AgentTurnRecord): boolean {
  return turn.status === 'completed'
    || turn.status === 'failed'
    || turn.status === 'cancelled';
}

function normalizeTurnRecoveryOption(value: number, fallback: number, minimum: number): number {
  return Number.isFinite(value)
    ? Math.max(minimum, Math.trunc(value))
    : fallback;
}

export class BirdCoderAgentSessionService implements IAgentSessionService {
  private readonly agentId: string;
  private readonly client: AgentsAppSdkClient;
  private readonly providerSessionDirectoryIdentityProvider?: BirdCoderAgentSessionServiceOptions['providerSessionDirectoryIdentityProvider'];
  private readonly sessionAgentIds = new Map<string, string>();
  private readonly turnRecoveryMaxAttempts: number;
  private readonly turnRecoveryPollIntervalMs: number;

  constructor({
    agentId,
    client,
    providerSessionDirectoryIdentityProvider,
    turnRecoveryMaxAttempts = TURN_RECOVERY_DEFAULT_MAX_ATTEMPTS,
    turnRecoveryPollIntervalMs = TURN_RECOVERY_DEFAULT_POLL_INTERVAL_MS,
  }: BirdCoderAgentSessionServiceOptions) {
    this.agentId = resolveAgentId(agentId);
    this.client = client;
    this.providerSessionDirectoryIdentityProvider = providerSessionDirectoryIdentityProvider;
    this.turnRecoveryMaxAttempts = normalizeTurnRecoveryOption(
      turnRecoveryMaxAttempts,
      TURN_RECOVERY_DEFAULT_MAX_ATTEMPTS,
      1,
    );
    this.turnRecoveryPollIntervalMs = normalizeTurnRecoveryOption(
      turnRecoveryPollIntervalMs,
      TURN_RECOVERY_DEFAULT_POLL_INTERVAL_MS,
      0,
    );
  }

  private async loadRecoveredTurnCompletion(
    agentId: string,
    sessionId: string,
    turn: AgentTurnRecord,
    options: SubmitAgentTurnOptions,
  ): Promise<AgentTurnCompletion> {
    const requestOptions = toApiRequestOptions(options);
    const matchedItems = new Map<string, AgentSessionItemRecord>();
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= TURN_RECOVERY_MAX_ITEM_PAGES) {
      const response = await this.client.ai.agents.sessionItems.list(
        agentId,
        sessionId,
        { page, pageSize: TURN_RECOVERY_ITEM_PAGE_SIZE, sort: '-sequence' },
        requestOptions,
      );
      for (const item of response.items) {
        if (
          item.turnId === turn.turnId
          || item.itemId === turn.requestItemId
          || item.itemId === turn.responseItemId
        ) {
          matchedItems.set(item.itemId, item);
        }
      }
      const hasRequestItem = matchedItems.has(turn.requestItemId);
      const hasResponseItem = !turn.responseItemId || matchedItems.has(turn.responseItemId);
      if (hasRequestItem && hasResponseItem) {
        break;
      }
      hasMore = response.pageInfo.hasMore === true;
      page += 1;
    }

    const missingItemIds = [turn.requestItemId, turn.responseItemId]
      .filter((itemId): itemId is string => Boolean(itemId && !matchedItems.has(itemId)));
    const directlyRetrievedItems = await Promise.all(
      missingItemIds.map((itemId) => this.client.ai.agents.sessionItems.retrieve(
        agentId,
        sessionId,
        itemId,
        requestOptions,
      )),
    );
    for (const item of directlyRetrievedItems) {
      matchedItems.set(item.itemId, item);
    }

    if (!matchedItems.has(turn.requestItemId)) {
      throw new Error(`Agents turn ${turn.turnId} replay is missing its user Session Item.`);
    }
    if (turn.status === 'completed' && (
      !turn.responseItemId || !matchedItems.has(turn.responseItemId)
    )) {
      throw new Error(`Agents turn ${turn.turnId} replay is missing its assistant Session Item.`);
    }

    const session = await this.client.ai.agents.sessions.retrieve(
      agentId,
      sessionId,
      requestOptions,
    );
    return {
      session,
      turn,
      items: [...matchedItems.values()].sort(compareAgentSessionItemSequence),
    };
  }

  private async recoverTurnCompletion(
    agentId: string,
    sessionId: string,
    turnId: string,
    options: SubmitAgentTurnOptions,
    notifyAccepted: () => void,
    notifyDeliveryUncertain: () => void,
  ): Promise<AgentTurnCompletion | null> {
    const turnsApi = this.client.ai.agents.turns as {
      retrieve?: (
        requestedAgentId: string,
        requestedSessionId: string,
        requestedTurnId: string,
        requestOptions?: ReturnType<typeof toApiRequestOptions>,
      ) => Promise<AgentTurnRecord>;
    };
    if (typeof turnsApi.retrieve !== 'function') {
      return null;
    }

    let didFindTurn = false;
    let didObserveNotFound = false;
    let lastRecoveryError: unknown;
    for (let attempt = 0; attempt < this.turnRecoveryMaxAttempts; attempt += 1) {
      throwIfTurnDeliveryAborted(options.signal);
      try {
        const turn = await turnsApi.retrieve(
          agentId,
          sessionId,
          turnId,
          toApiRequestOptions(options),
        );
        didFindTurn = true;
        notifyAccepted();
        if (isTerminalAgentTurn(turn)) {
          try {
            return await this.loadRecoveredTurnCompletion(agentId, sessionId, turn, options);
          } catch (error: unknown) {
            lastRecoveryError = error;
          }
        }
      } catch (error: unknown) {
        if (isAgentTurnNotFoundError(error)) {
          didObserveNotFound = true;
        } else {
          lastRecoveryError = error;
        }
      }
      if (attempt + 1 < this.turnRecoveryMaxAttempts) {
        await waitForTurnRecovery(this.turnRecoveryPollIntervalMs, options.signal);
      }
    }

    if (!didFindTurn) {
      if (!didObserveNotFound && lastRecoveryError !== undefined) {
        notifyDeliveryUncertain();
        throw new Error(
          `Agents turn ${turnId} delivery could not be confirmed because recovery is unavailable.`,
          { cause: lastRecoveryError },
        );
      }
      return null;
    }
    const detail = lastRecoveryError instanceof Error && lastRecoveryError.message.trim()
      ? ` Last recovery error: ${lastRecoveryError.message}`
      : '';
    throw new Error(
      `Agents accepted turn ${turnId}, but it did not reach a replayable terminal state before recovery timed out.${detail}`,
      lastRecoveryError === undefined ? undefined : { cause: lastRecoveryError },
    );
  }

  private rememberSession(session: { agentId: string; sessionId: string }): void {
    this.sessionAgentIds.set(session.sessionId, resolveAgentId(session.agentId));
  }

  private rememberSessions(sessions: readonly { agentId: string; sessionId: string }[]): void {
    for (const session of sessions) {
      this.rememberSession(session);
    }
  }

  private resolveSessionAgentId(sessionId: string): string {
    return this.sessionAgentIds.get(sessionId) ?? this.agentId;
  }

  async createSession(input: CreateAgentSessionInput) {
    const projectId = normalizeProjectId(input.projectId);
    const agentId = resolveAgentId(input.agentId ?? this.agentId);
    const requestedAt = new Date().toISOString();
    const sessionPayload = {
      sessionId: input.sessionId,
      projectId,
      sessionKind: 'coding' as const,
      entrySurface: 'pc' as const,
      sourceModule: 'sdkwork-birdcoder',
      sourceContextKind: input.sourceContextKind ?? 'coding-workbench',
      sourceContextId: input.sourceContextId ?? input.projectId,
      parentSessionId: input.parentSessionId,
      forkedFromTurnId: input.forkedFromTurnId,
      title: input.title,
    };
    const response = await this.client.ai.agents.projectSessions.create(projectId, {
      agentId,
      sessionId: sessionPayload.sessionId,
      sessionKind: sessionPayload.sessionKind,
      entrySurface: sessionPayload.entrySurface,
      sourceModule: sessionPayload.sourceModule,
      sourceContextKind: sessionPayload.sourceContextKind,
      sourceContextId: sessionPayload.sourceContextId,
      parentSessionId: sessionPayload.parentSessionId,
      forkedFromTurnId: sessionPayload.forkedFromTurnId,
      title: sessionPayload.title,
      idempotencyKey: uuid(),
      payloadHash: hashPayload(sessionPayload),
      requestedAt,
    });
    assertCreatedSessionIdentity(response, agentId, projectId);
    this.rememberSession(response);
    return response;
  }

  async getSession(sessionId: string, options: AgentSessionReadOptions = {}) {
    const rememberedAgentId = this.sessionAgentIds.get(sessionId);
    const requestOptions = toApiRequestOptions(options);
    if (rememberedAgentId) {
      const response = await this.client.ai.agents.sessions.retrieve(
        rememberedAgentId,
        sessionId,
        requestOptions,
      );
      this.rememberSession(response);
      return response;
    }

    let notFoundError: unknown;
    const retrieveFromAgent = async (agentId: string) => {
      try {
        const response = await this.client.ai.agents.sessions.retrieve(
          agentId,
          sessionId,
          requestOptions,
        );
        this.rememberSession(response);
        return response;
      } catch (error) {
        if (!isAgentSessionNotFoundError(error)) {
          throw error;
        }
        notFoundError = error;
        return null;
      }
    };

    const defaultAgentResponse = await retrieveFromAgent(this.agentId);
    if (defaultAgentResponse) {
      return defaultAgentResponse;
    }

    const catalog = await this.client.ai.agents.codeEngines.list(requestOptions);
    const attemptedAgentIds = new Set([this.agentId]);
    for (const engine of catalog.engines) {
      const agentId = engine.agentId.trim();
      if (!agentId || attemptedAgentIds.has(agentId)) {
        continue;
      }
      attemptedAgentIds.add(agentId);
      const response = await retrieveFromAgent(agentId);
      if (response) {
        return response;
      }
    }

    throw notFoundError ?? new Error(`Agent Session ${sessionId} not found.`);
  }

  async listSessions(
    request: AgentProjectSessionPageRequest,
    options: AgentSessionReadOptions = {},
  ) {
    return this.listSessionsByProject(request, options);
  }

  async listSessionActivitySummaries(
    request: AgentSessionActivityPageRequest = {},
    options: AgentSessionReadOptions = {},
  ): Promise<Awaited<ReturnType<IAgentSessionService['listSessionActivitySummaries']>>> {
    const response = await this.client.ai.agents.sessionActivitySummaries.list(
      normalizeSessionActivityPageRequest(request),
      toApiRequestOptions(options),
    );
    // The generated page base currently intersects typed items with unknown[].
    // Normalize that generator boundary once instead of leaking unknown to consumers.
    const items = response.items as SessionActivitySummary[];
    this.rememberSessions(items.map((summary) => summary.session));
    return {
      items,
      pageInfo: response.pageInfo,
    };
  }

  async listSessionsByAgent(
    request: AgentScopedSessionPageRequest = {},
    options: AgentSessionReadOptions = {},
  ) {
    const agentId = resolveAgentId(request.agentId ?? this.agentId);
    const response = await this.client.ai.agents.sessions.list(agentId, {
      ...normalizePageRequest(request),
      includeArchived: request.includeArchived,
      projectId: request.projectId?.trim() || undefined,
      status: request.status,
    }, toApiRequestOptions(options));
    this.rememberSessions(response.items);
    return response;
  }

  async listSessionsByProject(
    request: AgentProjectSessionPageRequest,
    options: AgentSessionReadOptions = {},
  ) {
    const projectId = normalizeProjectId(request.projectId);
    const pageRequest = normalizePageRequest(request);
    const providerSessionDirectoryIdentity = pageRequest.page === 1
      ? await this.providerSessionDirectoryIdentityProvider?.(projectId) ?? null
      : null;
    const response = await this.client.ai.agents.projectSessions.list(projectId, {
      ...pageRequest,
      includeArchived: request.includeArchived,
      ...(providerSessionDirectoryIdentity ? {
        providerSessionDirectoryFingerprint: providerSessionDirectoryIdentity.directoryFingerprint,
        providerSessionDirectoryName: providerSessionDirectoryIdentity.directoryName,
      } : {}),
      status: request.status,
    }, toApiRequestOptions(options));
    this.rememberSessions(response.items);
    return response;
  }

  async listSessionsByWorkspace(
    request: AgentWorkspaceSessionPageRequest,
    options: AgentSessionReadOptions = {},
  ) {
    const workspaceId = normalizeWorkspaceId(request.workspaceId);
    const response = await this.client.ai.agents.workspaceSessions.list(workspaceId, {
      ...normalizePageRequest(request),
      includeArchived: request.includeArchived,
      status: request.status,
    }, toApiRequestOptions(options));
    this.rememberSessions(response.items);
    return response;
  }

  async updateSession(
    sessionId: string,
    request: Parameters<IAgentSessionService['updateSession']>[1],
  ) {
    const response = await this.client.ai.agents.sessions.update(
      this.resolveSessionAgentId(sessionId),
      sessionId,
      request,
    );
    return response;
  }

  async closeSession(sessionId: string, expectedVersion: string) {
    const response = await this.client.ai.agents.sessions.close(
      this.resolveSessionAgentId(sessionId),
      sessionId,
      { expectedVersion, requestedAt: new Date().toISOString() },
    );
    return response;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.ai.agents.sessions.delete(
      this.resolveSessionAgentId(sessionId),
      sessionId,
    );
    this.sessionAgentIds.delete(sessionId);
  }

  async listSessionItems(
    sessionId: string,
    request: AgentSessionPageRequest = {},
    options: AgentSessionReadOptions = {},
  ) {
    const response = await this.client.ai.agents.sessionItems.list(
      this.resolveSessionAgentId(sessionId),
      sessionId,
      {
        ...normalizePageRequest(request),
        sort: request.sort,
      },
      toApiRequestOptions(options),
    );
    return response;
  }

  async listTurns(
    sessionId: string,
    request: AgentSessionPageRequest = {},
    options: AgentSessionReadOptions = {},
  ) {
    const response = await this.client.ai.agents.turns.list(
      this.resolveSessionAgentId(sessionId),
      sessionId,
      normalizePageRequest(request),
      toApiRequestOptions(options),
    );
    return response;
  }

  async submitTurn(
    sessionId: string,
    input: SubmitAgentTurnInput,
    options: SubmitAgentTurnOptions,
  ) {
    const normalizedSessionId = sessionId.trim();
    const agentId = options.agentId.trim();
    if (!normalizedSessionId) {
      throw new Error('Agent session ID is required for turn submission.');
    }
    if (!agentId) {
      throw new Error('Agent ID is required for turn submission.');
    }
    const rememberedAgentId = this.sessionAgentIds.get(normalizedSessionId);
    if (rememberedAgentId && rememberedAgentId !== agentId) {
      throw new Error(
        `Agent session ${normalizedSessionId} belongs to Agent "${rememberedAgentId}", not "${agentId}".`,
      );
    }

    const idempotencyKey = uuid();
    const turnId = input.turnId?.trim() || `turn.${uuid()}`;
    const clientRequestId = input.clientRequestId?.trim() || idempotencyKey;
    const payload = {
      ...input,
      content: input.content.trim(),
      clientRequestId,
      requestedModelId: input.requestedModelId?.trim() || undefined,
      runtimeBindingId: input.runtimeBindingId?.trim() || undefined,
      turnId,
      turnMode: input.turnMode ?? 'interactive',
    };
    if (!payload.content) {
      throw new Error('Agent turn content is required.');
    }
    if (!payload.runtimeBindingId) {
      throw new Error('Agent runtime binding ID is required for turn submission.');
    }
    const command = {
      ...payload,
      idempotencyKey,
      payloadHash: hashPayload(payload),
      requestedAt: new Date().toISOString(),
    };

    let completion: AgentTurnCompletion | null = null;
    let content = '';
    let didNotifyAccepted = false;
    let didNotifyDeliveryUncertain = false;
    let expectedDeltaIndex = 0;
    const notifyAccepted = () => {
      if (didNotifyAccepted) {
        return;
      }
      didNotifyAccepted = true;
      try {
        options.onAccepted?.();
      } catch {
        // Presentation observers cannot change the outcome of an accepted backend command.
      }
    };
    const notifyDeliveryUncertain = () => {
      if (didNotifyDeliveryUncertain) {
        return;
      }
      didNotifyDeliveryUncertain = true;
      try {
        options.onDeliveryUncertain?.();
      } catch {
        // Presentation observers cannot change the durable recovery outcome.
      }
    };
    let streamError: unknown;
    try {
      const events = await this.client.ai.agents.turns.stream(
        agentId,
        normalizedSessionId,
        command,
        { stream: true },
        toApiRequestOptions(options),
      );
      for await (const event of events) {
        if (completion) {
          throw new Error('Agents turn stream emitted an event after completion.');
        }
        if (!event || typeof event !== 'object') {
          throw new Error('Agents turn stream emitted a malformed event.');
        }
        if (event.eventType === 'delta') {
          if (
            !Number.isSafeInteger(event.index)
            || event.index !== expectedDeltaIndex
            || typeof event.delta !== 'string'
          ) {
            throw new Error(
              `Agents turn stream delta ${expectedDeltaIndex} is missing or out of order.`,
            );
          }
          notifyAccepted();
          content += event.delta;
          try {
            options.onDelta?.({ content, delta: event.delta, index: event.index });
          } catch {
            // Presentation observers cannot change the outcome of an accepted backend command.
          }
          expectedDeltaIndex += 1;
          continue;
        }
        if (event.eventType !== 'completion') {
          throw new Error('Agents turn stream emitted an unsupported event type.');
        }
        completion = readAgentTurnCompletionEvent(event);
        notifyAccepted();
      }
      if (!completion) {
        throw new Error('Agents turn stream ended without a completion event.');
      }
    } catch (error: unknown) {
      completion = null;
      streamError = error;
    }

    if (!completion) {
      throwIfTurnDeliveryAborted(options.signal);
      const clientWithHttp = this.client as AgentsAppSdkClient & {
        http?: { post?: unknown };
      };
      if (typeof clientWithHttp.http?.post === 'function') {
        try {
          completion = await completeAgentTurn(
            this.client,
            agentId,
            normalizedSessionId,
            command,
          );
          notifyAccepted();
        } catch {
          // The durable turn and Session Item APIs are the final recovery authority.
        }
      }
    }

    if (!completion) {
      const recovered = await this.recoverTurnCompletion(
        agentId,
        normalizedSessionId,
        turnId,
        options,
        notifyAccepted,
        notifyDeliveryUncertain,
      );
      if (recovered) {
        completion = recovered;
      }
    }

    if (!completion) {
      throw streamError instanceof Error
        ? streamError
        : new Error('Agents turn delivery failed before the command was accepted.');
    }
    assertAgentTurnCompletionIdentity(
      completion,
      agentId,
      normalizedSessionId,
      input.turnId?.trim() || undefined,
      payload.runtimeBindingId,
    );
    this.rememberSession(completion.session);
    return completion;
  }

  async listInteractions(
    sessionId: string,
    request: AgentSessionPageRequest = {},
    options: AgentSessionReadOptions = {},
  ) {
    const response = await this.client.ai.agents.interactions.list(
      this.resolveSessionAgentId(sessionId),
      sessionId,
      normalizePageRequest(request),
      toApiRequestOptions(options),
    );
    return response;
  }

  async getInteraction(
    sessionId: string,
    interactionId: string,
    options: AgentSessionReadOptions = {},
  ) {
    const response = await this.client.ai.agents.interactions.retrieve(
      this.resolveSessionAgentId(sessionId),
      sessionId,
      interactionId,
      toApiRequestOptions(options),
    );
    return response;
  }

  async claimInteraction(
    sessionId: string,
    interactionId: string,
    request: Parameters<IAgentSessionService['claimInteraction']>[2],
  ) {
    const response = await this.client.ai.agents.interactions.claim(
      this.resolveSessionAgentId(sessionId),
      sessionId,
      interactionId,
      request,
    );
    return response;
  }

  async approveInteraction(
    sessionId: string,
    interactionId: string,
    request: Parameters<IAgentSessionService['approveInteraction']>[2],
  ) {
    const response = await this.client.ai.agents.interactions.approve(
      this.resolveSessionAgentId(sessionId),
      sessionId,
      interactionId,
      request,
    );
    return response;
  }

  async answerInteraction(
    sessionId: string,
    interactionId: string,
    request: Parameters<IAgentSessionService['answerInteraction']>[2],
  ) {
    const response = await this.client.ai.agents.interactions.answer(
      this.resolveSessionAgentId(sessionId),
      sessionId,
      interactionId,
      request,
    );
    return response;
  }

  async listRuntimeBindings(
    sessionId: string,
    request: AgentSessionPageRequest = {},
    options: AgentSessionReadOptions = {},
  ) {
    const response = await this.client.ai.agents.sessionRuntimeBindings.list(
      this.resolveSessionAgentId(sessionId),
      sessionId,
      normalizePageRequest(request),
      toApiRequestOptions(options),
    );
    return response;
  }

  async createRuntimeBinding(
    sessionId: string,
    request: Parameters<IAgentSessionService['createRuntimeBinding']>[1],
  ) {
    const agentId = this.resolveSessionAgentId(sessionId);
    const runtimeBindingId = request.runtimeBindingId?.trim()
      || `runtime_binding.${uuid()}`;
    const idempotentRequest = {
      ...request,
      runtimeBindingId,
    };

    try {
      return await this.client.ai.agents.sessionRuntimeBindings.create(
        agentId,
        sessionId,
        idempotentRequest,
      );
    } catch (creationError) {
      try {
        const existingBinding = await this.client.ai.agents.sessionRuntimeBindings.retrieve(
          agentId,
          sessionId,
          runtimeBindingId,
        );
        if (isMatchingRuntimeBinding(existingBinding, idempotentRequest)) {
          return existingBinding;
        }
      } catch {
        // Preserve the creation failure when recovery cannot prove an idempotent replay.
      }
      throw creationError;
    }
  }

  async listCheckpoints(
    sessionId: string,
    request: AgentSessionPageRequest = {},
    options: AgentSessionReadOptions = {},
  ) {
    const response = await this.client.ai.agents.checkpoints.list(
      this.resolveSessionAgentId(sessionId),
      sessionId,
      normalizePageRequest(request),
      toApiRequestOptions(options),
    );
    return response;
  }

  async getSessionUserStates(
    sessionIds: readonly string[],
    options: AgentSessionReadOptions = {},
  ) {
    const sessionIdsByAgent = new Map<string, string[]>();
    const normalizedSessionIds = new Set<string>();
    for (const value of sessionIds) {
      const sessionId = value.trim();
      if (!sessionId) {
        throw new Error('Agent session ID is required for user-state reads.');
      }
      if (normalizedSessionIds.has(sessionId)) {
        continue;
      }
      normalizedSessionIds.add(sessionId);
      const agentId = this.resolveSessionAgentId(sessionId);
      const agentSessionIds = sessionIdsByAgent.get(agentId) ?? [];
      agentSessionIds.push(sessionId);
      sessionIdsByAgent.set(agentId, agentSessionIds);
    }

    const batches = [...sessionIdsByAgent].flatMap(([agentId, agentSessionIds]) => {
      const agentBatches: Array<{ agentId: string; sessionIds: string[] }> = [];
      for (let index = 0; index < agentSessionIds.length; index += SESSION_USER_STATE_BATCH_SIZE) {
        agentBatches.push({
          agentId,
          sessionIds: agentSessionIds.slice(index, index + SESSION_USER_STATE_BATCH_SIZE),
        });
      }
      return agentBatches;
    });
    const pages = await Promise.all(batches.map(async ({ agentId, sessionIds: batchSessionIds }) => {
      const page = await this.client.ai.agents.sessionUserStates.list(agentId, {
        page: 1,
        pageSize: batchSessionIds.length,
        includeHidden: true,
        sessionIds: batchSessionIds.join(','),
      }, toApiRequestOptions(options));
      if (page.pageInfo.hasMore || page.items.length > batchSessionIds.length) {
        throw new Error('Agents session user-state batch exceeded its requested bounds.');
      }
      return { batchSessionIds, page };
    }));

    const statesBySessionId = new Map<string, AgentResourceUserStateRecord>();
    for (const { batchSessionIds, page } of pages) {
      const requestedSessionIds = new Set(batchSessionIds);
      for (const state of page.items) {
        if (state.resourceType !== 'session' || !requestedSessionIds.has(state.resourceId)) {
          throw new Error(
            `Agents session user-state batch returned unexpected resource ${state.resourceId}.`,
          );
        }
        if (statesBySessionId.has(state.resourceId)) {
          throw new Error(
            `Agents session user-state batch returned duplicate resource ${state.resourceId}.`,
          );
        }
        statesBySessionId.set(state.resourceId, state);
      }
    }
    return statesBySessionId;
  }

  async updateSessionUserState(
    sessionId: string,
    request: Parameters<IAgentSessionService['updateSessionUserState']>[1],
  ) {
    const response = await this.client.ai.agents.sessionUserStates.update(
      this.resolveSessionAgentId(sessionId),
      sessionId,
      request,
    );
    return response;
  }
}

function resolveAgentId(value?: string): string {
  const agentId = value?.trim() || BIRDCODER_ASSISTANT_AGENT_ID;
  if (!agentId) {
    throw new Error('BirdCoder assistant agentId is required.');
  }
  return agentId;
}
