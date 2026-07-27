import {
  completeAgentTurn,
  type AgentSessionRuntimeBindingRecord,
  type CreateAgentSessionRuntimeBindingRequest,
  type SdkworkAppClient as AgentsAppSdkClient,
} from '@sdkwork/birdcoder-pc-core/sdk/agents-app';
import { NotFoundError } from '@sdkwork/sdk-common';
import { sha256Hash } from '@sdkwork/utils/crypto';
import { uuid } from '@sdkwork/utils/id';
import { normalizeOffsetListQuery } from '@sdkwork/utils/pagination';

import type {
  AgentProjectSessionPageRequest,
  AgentScopedSessionPageRequest,
  AgentSessionReadOptions,
  AgentSessionPageRequest,
  AgentTurnCompletion,
  AgentWorkspaceSessionPageRequest,
  CreateAgentSessionInput,
  IAgentSessionService,
  SubmitAgentTurnInput,
} from './interfaces/IAgentSessionService.ts';

export const BIRDCODER_ASSISTANT_AGENT_ID = 'agent.birdcoder';

export interface BirdCoderAgentSessionServiceOptions {
  agentId?: string;
  client: AgentsAppSdkClient;
  nativeDirectoryIdentityProvider?: (
    projectId: string,
  ) => Promise<{ directoryFingerprint: string; directoryName: string } | null>;
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

function normalizeOptionalRuntimeBindingValue(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function isMissingSessionUserStateError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const sdkError = error as Error & {
    code?: unknown;
    httpStatus?: unknown;
    problem?: unknown;
  };
  const isNotFound = error instanceof NotFoundError
    || (
      sdkError.name === 'NotFoundError'
      && sdkError.code === 'NOT_FOUND'
      && sdkError.httpStatus === 404
    );
  if (!isNotFound) {
    return false;
  }

  if (sdkError.problem && typeof sdkError.problem === 'object') {
    const problem = sdkError.problem as Record<string, unknown>;
    return String(problem.code) === '40401'
      && problem.operationId === 'agents.sessionUserStates.retrieve'
      && problem.detail === 'session user state not found';
  }

  // sdk-common 1.0.2 discarded Problem Details for non-2xx responses.
  return sdkError.code === 'NOT_FOUND' && sdkError.httpStatus === 404;
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
    && normalizeOptionalRuntimeBindingValue(binding.nativeSessionId)
      === normalizeOptionalRuntimeBindingValue(request.nativeSessionId)
    && normalizeOptionalRuntimeBindingValue(binding.nativeSessionTreeId)
      === normalizeOptionalRuntimeBindingValue(request.nativeSessionTreeId)
    && normalizeOptionalRuntimeBindingValue(binding.nativeParentSessionId)
      === normalizeOptionalRuntimeBindingValue(request.nativeParentSessionId)
    && normalizeOptionalRuntimeBindingValue(binding.nativeForkedFromSessionId)
      === normalizeOptionalRuntimeBindingValue(request.nativeForkedFromSessionId)
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

export class BirdCoderAgentSessionService implements IAgentSessionService {
  private readonly agentId: string;
  private readonly client: AgentsAppSdkClient;
  private readonly nativeDirectoryIdentityProvider?: BirdCoderAgentSessionServiceOptions['nativeDirectoryIdentityProvider'];
  private readonly sessionAgentIds = new Map<string, string>();

  constructor({
    agentId,
    client,
    nativeDirectoryIdentityProvider,
  }: BirdCoderAgentSessionServiceOptions) {
    this.agentId = resolveAgentId(agentId);
    this.client = client;
    this.nativeDirectoryIdentityProvider = nativeDirectoryIdentityProvider;
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
    const response = await this.client.ai.agents.sessions.retrieve(
      this.resolveSessionAgentId(sessionId),
      sessionId,
      toApiRequestOptions(options),
    );
    this.rememberSession(response);
    return response;
  }

  async listSessions(
    request: AgentProjectSessionPageRequest,
    options: AgentSessionReadOptions = {},
  ) {
    return this.listSessionsByProject(request, options);
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
    const nativeDirectoryIdentity = pageRequest.page === 1
      ? await this.nativeDirectoryIdentityProvider?.(projectId) ?? null
      : null;
    const response = await this.client.ai.agents.projectSessions.list(projectId, {
      ...pageRequest,
      includeArchived: request.includeArchived,
      ...(nativeDirectoryIdentity ? {
        nativeDirectoryFingerprint: nativeDirectoryIdentity.directoryFingerprint,
        nativeDirectoryName: nativeDirectoryIdentity.directoryName,
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

  async submitTurn(sessionId: string, input: SubmitAgentTurnInput) {
    const idempotencyKey = uuid();
    const payload = {
      ...input,
      content: input.content.trim(),
      turnMode: input.turnMode ?? 'interactive',
    };
    if (!payload.content) {
      throw new Error('Agent turn content is required.');
    }
    const response = await completeAgentTurn(this.client, this.resolveSessionAgentId(sessionId), sessionId, {
      ...payload,
      idempotencyKey,
      payloadHash: hashPayload(payload),
      clientRequestId: input.clientRequestId ?? idempotencyKey,
      requestedAt: new Date().toISOString(),
    });
    assertAgentTurnCompletion(response);
    return response;
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

  async getSessionUserState(sessionId: string, options: AgentSessionReadOptions = {}) {
    try {
      return await this.client.ai.agents.sessionUserStates.retrieve(
        this.resolveSessionAgentId(sessionId),
        sessionId,
        toApiRequestOptions(options),
      );
    } catch (error) {
      if (isMissingSessionUserStateError(error)) {
        return null;
      }
      throw error;
    }
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
