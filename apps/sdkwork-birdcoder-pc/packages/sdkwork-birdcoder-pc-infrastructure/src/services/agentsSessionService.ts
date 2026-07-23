import {
  completeAgentTurn,
  type AgentSessionRecord,
  type SdkworkAppClient as AgentsAppSdkClient,
} from '@sdkwork/birdcoder-pc-core/sdk/agents-app';
import { sha256Hash } from '@sdkwork/utils/crypto';
import { uuid } from '@sdkwork/utils/id';
import { normalizeOffsetListQuery } from '@sdkwork/utils/pagination';

import type {
  AgentSessionPageRequest,
  CreateAgentSessionInput,
  IAgentSessionService,
  SubmitAgentTurnInput,
} from './interfaces/IAgentSessionService.ts';

export const BIRDCODER_ASSISTANT_AGENT_ID = 'agent.birdcoder';

export interface BirdCoderAgentSessionServiceOptions {
  agentId?: string;
  client: AgentsAppSdkClient;
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

export class BirdCoderAgentSessionService implements IAgentSessionService {
  private readonly agentId: string;
  private readonly client: AgentsAppSdkClient;

  constructor({ agentId, client }: BirdCoderAgentSessionServiceOptions) {
    this.agentId = resolveAgentId(agentId);
    this.client = client;
  }

  async createSession(input: CreateAgentSessionInput) {
    const requestedAt = new Date().toISOString();
    const sessionPayload = {
      sessionId: input.sessionId,
      projectId: input.projectId,
      sessionKind: 'coding' as const,
      entrySurface: 'pc' as const,
      sourceModule: 'sdkwork-birdcoder',
      sourceContextKind: input.sourceContextKind ?? 'coding-workbench',
      sourceContextId: input.sourceContextId ?? input.projectId,
      parentSessionId: input.parentSessionId,
      forkedFromTurnId: input.forkedFromTurnId,
      title: input.title,
    };
    const response = await this.client.ai.agents.sessions.create(this.agentId, {
      ...sessionPayload,
      idempotencyKey: uuid(),
      payloadHash: hashPayload(sessionPayload),
      requestedAt,
    });
    return response;
  }

  async getSession(sessionId: string) {
    const response = await this.client.ai.agents.sessions.retrieve(
      this.agentId,
      sessionId,
    );
    return response;
  }

  async listSessions(
    request: AgentSessionPageRequest = {},
  ) {
    const response = await this.client.ai.agents.sessions.list(this.agentId, {
      ...normalizePageRequest(request),
      projectId: request.projectId,
    });
    return {
      items: (response.items as AgentSessionRecord[])
        .filter((session) => session.sessionKind === 'coding'),
      pageInfo: response.pageInfo,
    };
  }

  async updateSession(
    sessionId: string,
    request: Parameters<IAgentSessionService['updateSession']>[1],
  ) {
    const response = await this.client.ai.agents.sessions.update(
      this.agentId,
      sessionId,
      request,
    );
    return response;
  }

  async closeSession(sessionId: string, expectedVersion: string) {
    const response = await this.client.ai.agents.sessions.close(
      this.agentId,
      sessionId,
      { expectedVersion, requestedAt: new Date().toISOString() },
    );
    return response;
  }

  deleteSession(sessionId: string): Promise<void> {
    return this.client.ai.agents.sessions.delete(this.agentId, sessionId);
  }

  async listSessionItems(sessionId: string, request: AgentSessionPageRequest = {}) {
    const response = await this.client.ai.agents.sessionItems.list(
      this.agentId,
      sessionId,
      normalizePageRequest(request),
    );
    return response;
  }

  async listTurns(sessionId: string, request: AgentSessionPageRequest = {}) {
    const response = await this.client.ai.agents.turns.list(
      this.agentId,
      sessionId,
      normalizePageRequest(request),
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
    const response = await completeAgentTurn(this.client, this.agentId, sessionId, {
      ...payload,
      idempotencyKey,
      payloadHash: hashPayload(payload),
      clientRequestId: input.clientRequestId ?? idempotencyKey,
      requestedAt: new Date().toISOString(),
    });
    return response;
  }

  async listInteractions(sessionId: string, request: AgentSessionPageRequest = {}) {
    const response = await this.client.ai.agents.interactions.list(
      this.agentId,
      sessionId,
      normalizePageRequest(request),
    );
    return response;
  }

  async getInteraction(sessionId: string, interactionId: string) {
    const response = await this.client.ai.agents.interactions.retrieve(
      this.agentId,
      sessionId,
      interactionId,
    );
    return response;
  }

  async claimInteraction(
    sessionId: string,
    interactionId: string,
    request: Parameters<IAgentSessionService['claimInteraction']>[2],
  ) {
    const response = await this.client.ai.agents.interactions.claim(
      this.agentId,
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
      this.agentId,
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
      this.agentId,
      sessionId,
      interactionId,
      request,
    );
    return response;
  }

  async listRuntimeBindings(sessionId: string, request: AgentSessionPageRequest = {}) {
    const response = await this.client.ai.agents.sessionRuntimeBindings.list(
      this.agentId,
      sessionId,
      normalizePageRequest(request),
    );
    return response;
  }

  async createRuntimeBinding(
    sessionId: string,
    request: Parameters<IAgentSessionService['createRuntimeBinding']>[1],
  ) {
    const response = await this.client.ai.agents.sessionRuntimeBindings.create(
      this.agentId,
      sessionId,
      request,
    );
    return response;
  }

  async listCheckpoints(sessionId: string, request: AgentSessionPageRequest = {}) {
    const response = await this.client.ai.agents.checkpoints.list(
      this.agentId,
      sessionId,
      normalizePageRequest(request),
    );
    return response;
  }

  async getSessionUserState(sessionId: string) {
    const response = await this.client.ai.agents.sessionUserStates.retrieve(
      this.agentId,
      sessionId,
    );
    return response;
  }

  async updateSessionUserState(
    sessionId: string,
    request: Parameters<IAgentSessionService['updateSessionUserState']>[1],
  ) {
    const response = await this.client.ai.agents.sessionUserStates.update(
      this.agentId,
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
