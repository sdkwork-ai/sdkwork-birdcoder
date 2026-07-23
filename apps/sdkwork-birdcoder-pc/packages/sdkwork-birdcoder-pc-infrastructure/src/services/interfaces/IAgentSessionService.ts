import type {
  AgentInteractionRecord,
  AgentResourceUserStateRecord,
  AgentSessionCheckpointRecord,
  AgentSessionItemRecord,
  AgentSessionRecord,
  AgentSessionRuntimeBindingRecord,
  AgentTurnRecord,
  AnswerAgentInteractionRequest,
  AppUpdateAgentSessionRequest,
  ApproveAgentInteractionRequest,
  ClaimAgentInteractionRequest,
  CreateAgentSessionRuntimeBindingRequest,
  CreateAgentTurnRequest,
  PageInfo,
  UpdateAgentSessionUserStateRequest,
} from '@sdkwork/birdcoder-pc-core/sdk/agents-app';

export interface AgentSessionPageRequest {
  page?: number;
  pageSize?: number;
  projectId?: string;
}

export interface AgentSessionPage<TItem> {
  items: TItem[];
  pageInfo: PageInfo;
}

export interface CreateAgentSessionInput {
  projectId?: string;
  sessionId?: string;
  title?: string;
  sourceContextId?: string;
  sourceContextKind?: string;
  parentSessionId?: string;
  forkedFromTurnId?: string;
}

export interface SubmitAgentTurnInput
  extends Pick<
    CreateAgentTurnRequest,
    | 'clientRequestId'
    | 'content'
    | 'contentType'
    | 'driveRefs'
    | 'requestedModelId'
    | 'runtimeBindingId'
    | 'turnId'
    | 'turnMode'
  > {}

export interface AgentTurnCompletion {
  turn: AgentTurnRecord;
  items: AgentSessionItemRecord[];
}

export interface AgentInteractionClaim {
  interaction: AgentInteractionRecord;
  claimToken: string;
  claimExpiresAt: string;
  fencingToken: string;
}

/**
 * BirdCoder's application port for the canonical sdkwork-agents session domain.
 * Implementations must not persist, mirror, or replay these records locally.
 */
export interface IAgentSessionService {
  createSession(input: CreateAgentSessionInput): Promise<AgentSessionRecord>;
  getSession(sessionId: string): Promise<AgentSessionRecord>;
  listSessions(
    request?: AgentSessionPageRequest,
  ): Promise<AgentSessionPage<AgentSessionRecord>>;
  updateSession(
    sessionId: string,
    request: AppUpdateAgentSessionRequest,
  ): Promise<AgentSessionRecord>;
  closeSession(sessionId: string, expectedVersion: string): Promise<AgentSessionRecord>;
  deleteSession(sessionId: string): Promise<void>;
  listSessionItems(
    sessionId: string,
    request?: AgentSessionPageRequest,
  ): Promise<AgentSessionPage<AgentSessionItemRecord>>;
  listTurns(
    sessionId: string,
    request?: AgentSessionPageRequest,
  ): Promise<AgentSessionPage<AgentTurnRecord>>;
  submitTurn(sessionId: string, input: SubmitAgentTurnInput): Promise<AgentTurnCompletion>;
  listInteractions(
    sessionId: string,
    request?: AgentSessionPageRequest,
  ): Promise<AgentSessionPage<AgentInteractionRecord>>;
  getInteraction(sessionId: string, interactionId: string): Promise<AgentInteractionRecord>;
  claimInteraction(
    sessionId: string,
    interactionId: string,
    request: ClaimAgentInteractionRequest,
  ): Promise<AgentInteractionClaim>;
  approveInteraction(
    sessionId: string,
    interactionId: string,
    request: ApproveAgentInteractionRequest,
  ): Promise<AgentInteractionRecord>;
  answerInteraction(
    sessionId: string,
    interactionId: string,
    request: AnswerAgentInteractionRequest,
  ): Promise<AgentInteractionRecord>;
  listRuntimeBindings(
    sessionId: string,
    request?: AgentSessionPageRequest,
  ): Promise<AgentSessionPage<AgentSessionRuntimeBindingRecord>>;
  createRuntimeBinding(
    sessionId: string,
    request: CreateAgentSessionRuntimeBindingRequest,
  ): Promise<AgentSessionRuntimeBindingRecord>;
  listCheckpoints(
    sessionId: string,
    request?: AgentSessionPageRequest,
  ): Promise<AgentSessionPage<AgentSessionCheckpointRecord>>;
  getSessionUserState(sessionId: string): Promise<AgentResourceUserStateRecord>;
  updateSessionUserState(
    sessionId: string,
    request: UpdateAgentSessionUserStateRequest,
  ): Promise<AgentResourceUserStateRecord>;
}
