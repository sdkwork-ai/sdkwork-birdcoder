import type {
  AgentInteractionKind,
  AgentInteractionRecord,
  AgentInteractionStatus,
  AgentResourceUserStateRecord,
  AgentSessionCheckpointRecord,
  AgentSessionItemRecord,
  AgentSessionRecord,
  AgentSessionRuntimeBindingRecord,
  AgentSessionStatus,
  AgentTurnRecord,
  AnswerAgentInteractionRequest,
  AppUpdateAgentSessionRequest,
  ApproveAgentInteractionRequest,
  ClaimAgentInteractionRequest,
  CreateAgentSessionRuntimeBindingRequest,
  CreateAgentTurnRequest,
  PageInfo,
  SessionActivitySummary,
  UpdateAgentSessionUserStateRequest,
} from '@sdkwork/birdcoder-pc-core/sdk/agents-app';

export interface AgentSessionPageRequest {
  page?: number;
  pageSize?: number;
  projectId?: string;
  sort?: 'sequence' | '-sequence';
}

export interface AgentInteractionPageRequest extends AgentSessionPageRequest {
  kind?: AgentInteractionKind;
  status?: AgentInteractionStatus;
}

export interface AgentSessionListPageRequest {
  page?: number;
  pageSize?: number;
  status?: AgentSessionStatus;
  includeArchived?: boolean;
}

export interface AgentProjectSessionPageRequest extends AgentSessionListPageRequest {
  projectId: string;
}

export interface AgentWorkspaceSessionPageRequest extends AgentSessionListPageRequest {
  workspaceId: string;
}

export interface AgentScopedSessionPageRequest extends AgentSessionListPageRequest {
  agentId?: string;
  projectId?: string;
}

export interface AgentSessionActivityPageRequest {
  agentId?: string;
  cursor?: string;
  pageSize?: number;
  projectId?: string;
  workspaceId?: string;
}

export interface AgentSessionReadOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface AgentSessionPage<TItem> {
  items: TItem[];
  pageInfo: PageInfo;
}

export interface CreateAgentSessionInput {
  agentId?: string;
  projectId: string;
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
  > {
  turnMode?: CreateAgentTurnRequest['turnMode'];
}

export interface AgentTurnStreamDelta {
  content: string;
  delta: string;
  index: number;
}

export interface SubmitAgentTurnOptions extends AgentSessionReadOptions {
  agentId: string;
  onAccepted?: () => void;
  onDelta?: (delta: Readonly<AgentTurnStreamDelta>) => void;
  onDeliveryUncertain?: () => void;
}

export interface AgentTurnCompletion {
  session: AgentSessionRecord;
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
  getSession(sessionId: string, options?: AgentSessionReadOptions): Promise<AgentSessionRecord>;
  listSessionActivitySummaries(
    request?: AgentSessionActivityPageRequest,
    options?: AgentSessionReadOptions,
  ): Promise<AgentSessionPage<SessionActivitySummary>>;
  listSessions(
    request: AgentProjectSessionPageRequest,
    options?: AgentSessionReadOptions,
  ): Promise<AgentSessionPage<AgentSessionRecord>>;
  listSessionsByAgent(
    request?: AgentScopedSessionPageRequest,
    options?: AgentSessionReadOptions,
  ): Promise<AgentSessionPage<AgentSessionRecord>>;
  listSessionsByProject(
    request: AgentProjectSessionPageRequest,
    options?: AgentSessionReadOptions,
  ): Promise<AgentSessionPage<AgentSessionRecord>>;
  listSessionsByWorkspace(
    request: AgentWorkspaceSessionPageRequest,
    options?: AgentSessionReadOptions,
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
    options?: AgentSessionReadOptions,
  ): Promise<AgentSessionPage<AgentSessionItemRecord>>;
  listTurns(
    sessionId: string,
    request?: AgentSessionPageRequest,
    options?: AgentSessionReadOptions,
  ): Promise<AgentSessionPage<AgentTurnRecord>>;
  submitTurn(
    sessionId: string,
    input: SubmitAgentTurnInput,
    options: SubmitAgentTurnOptions,
  ): Promise<AgentTurnCompletion>;
  listInteractions(
    sessionId: string,
    request?: AgentInteractionPageRequest,
    options?: AgentSessionReadOptions,
  ): Promise<AgentSessionPage<AgentInteractionRecord>>;
  getInteraction(
    sessionId: string,
    interactionId: string,
    options?: AgentSessionReadOptions,
  ): Promise<AgentInteractionRecord>;
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
    options?: AgentSessionReadOptions,
  ): Promise<AgentSessionPage<AgentSessionRuntimeBindingRecord>>;
  createRuntimeBinding(
    sessionId: string,
    request: CreateAgentSessionRuntimeBindingRequest,
  ): Promise<AgentSessionRuntimeBindingRecord>;
  listCheckpoints(
    sessionId: string,
    request?: AgentSessionPageRequest,
    options?: AgentSessionReadOptions,
  ): Promise<AgentSessionPage<AgentSessionCheckpointRecord>>;
  getSessionUserStates(
    sessionIds: readonly string[],
    options?: AgentSessionReadOptions,
  ): Promise<ReadonlyMap<string, AgentResourceUserStateRecord>>;
  updateSessionUserState(
    sessionId: string,
    request: UpdateAgentSessionUserStateRequest,
  ): Promise<AgentResourceUserStateRecord>;
}
