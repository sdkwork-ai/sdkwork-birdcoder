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
  AgentTurnInputQueueEntry,
  AgentTurnRecord,
  AgentTurnRuntimeEvent,
  AnswerAgentInteractionRequest,
  AppUpdateAgentSessionRequest,
  ApproveAgentInteractionRequest,
  CancelAgentTurnRequest,
  ClaimAgentInteractionRequest,
  ClaimNextAgentTurnInputQueueEntryRequest,
  ClaimNextAgentTurnInputQueueEntryResult,
  CreateAgentSessionRuntimeBindingRequest,
  CreateAgentTurnInputQueueEntryRequest,
  CreateAgentTurnRequest,
  FailAgentTurnInputQueueEntryRequest,
  Int64String,
  PageInfo,
  ProjectSessionSynchronizationResult,
  ReorderAgentTurnInputQueueEntriesRequest,
  ResolveAgentInteractionRequest,
  RetryAgentTurnInputQueueEntryRequest,
  SessionActivitySummary,
  UpdateAgentTurnInputQueueEntryRequest,
  UpdateAgentSessionUserStateRequest,
} from '@sdkwork/birdcoder-pc-core/sdk/agents-app';

export interface AgentSessionPageRequest {
  page?: number;
  pageSize?: number;
  projectId?: string;
}

export interface AgentSessionItemPageRequest {
  cursor?: string;
  pageSize?: number;
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

export interface AgentSessionIdentity {
  agentId: string;
  sessionId: string;
}

export interface AgentSessionPage<TItem> {
  items: TItem[];
  pageInfo: PageInfo;
}

export interface AgentSessionCursorPage<TItem> {
  items: TItem[];
  pageInfo: {
    hasMore: boolean;
    mode: 'cursor';
    nextCursor: string | null;
    pageSize: number;
  };
}

export type AgentSessionItemSynchronizationRequest = Omit<
  AgentSessionItemPageRequest,
  'cursor'
>;

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
    | 'accessModeId'
    | 'content'
    | 'contentType'
    | 'driveRefs'
    | 'requestedModelId'
    | 'runtimeBindingId'
    | 'turnId'
  > {
  idempotencyKey?: string;
  payloadHash?: string;
  turnMode?: CreateAgentTurnRequest['turnMode'];
}

export interface AgentTurnStreamDelta {
  content: string;
  delta: string;
  index: number;
}

export interface SubmitAgentTurnOptions extends AgentSessionReadOptions {
  onAccepted?: () => void;
  onDelta?: (delta: Readonly<AgentTurnStreamDelta>) => void;
  onDeliveryUncertain?: () => void;
  onRuntimeEvent?: (event: Readonly<AgentTurnRuntimeEvent>) => void;
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
  getSession(
    identity: AgentSessionIdentity,
    options?: AgentSessionReadOptions,
  ): Promise<AgentSessionRecord>;
  getProjectSession(
    projectId: string,
    sessionId: string,
    options?: AgentSessionReadOptions,
  ): Promise<AgentSessionRecord>;
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
  synchronizeProjectSessions(
    projectId: string,
    options?: AgentSessionReadOptions,
  ): Promise<ProjectSessionSynchronizationResult>;
  listSessionsByWorkspace(
    request: AgentWorkspaceSessionPageRequest,
    options?: AgentSessionReadOptions,
  ): Promise<AgentSessionPage<AgentSessionRecord>>;
  updateSession(
    identity: AgentSessionIdentity,
    request: AppUpdateAgentSessionRequest,
  ): Promise<AgentSessionRecord>;
  closeSession(
    identity: AgentSessionIdentity,
    expectedVersion: string,
  ): Promise<AgentSessionRecord>;
  deleteSession(identity: AgentSessionIdentity): Promise<void>;
  listSessionItems(
    identity: AgentSessionIdentity,
    request?: AgentSessionItemPageRequest,
    options?: AgentSessionReadOptions,
  ): Promise<AgentSessionCursorPage<AgentSessionItemRecord>>;
  synchronizeSessionItems(
    identity: AgentSessionIdentity,
    request?: AgentSessionItemSynchronizationRequest,
    options?: AgentSessionReadOptions,
  ): Promise<AgentSessionCursorPage<AgentSessionItemRecord>>;
  listTurns(
    identity: AgentSessionIdentity,
    request?: AgentSessionPageRequest,
    options?: AgentSessionReadOptions,
  ): Promise<AgentSessionPage<AgentTurnRecord>>;
  getTurn(
    identity: AgentSessionIdentity,
    turnId: string,
    options?: AgentSessionReadOptions,
  ): Promise<AgentTurnRecord>;
  cancelTurn(
    identity: AgentSessionIdentity,
    turnId: string,
    request: CancelAgentTurnRequest,
  ): Promise<AgentTurnRecord>;
  listTurnInputQueueEntries(
    identity: AgentSessionIdentity,
    options?: AgentSessionReadOptions,
  ): Promise<AgentSessionPage<AgentTurnInputQueueEntry>>;
  createTurnInputQueueEntry(
    identity: AgentSessionIdentity,
    request: CreateAgentTurnInputQueueEntryRequest,
    options?: AgentSessionReadOptions,
  ): Promise<AgentTurnInputQueueEntry>;
  clearTurnInputQueueEntries(
    identity: AgentSessionIdentity,
    options?: AgentSessionReadOptions,
  ): Promise<{ clearedCount: Int64String }>;
  reorderTurnInputQueueEntries(
    identity: AgentSessionIdentity,
    request: ReorderAgentTurnInputQueueEntriesRequest,
    options?: AgentSessionReadOptions,
  ): Promise<AgentTurnInputQueueEntry[]>;
  claimNextTurnInputQueueEntry(
    identity: AgentSessionIdentity,
    request: ClaimNextAgentTurnInputQueueEntryRequest,
    options?: AgentSessionReadOptions,
  ): Promise<ClaimNextAgentTurnInputQueueEntryResult>;
  updateTurnInputQueueEntry(
    identity: AgentSessionIdentity,
    queueEntryId: string,
    request: UpdateAgentTurnInputQueueEntryRequest,
    options?: AgentSessionReadOptions,
  ): Promise<AgentTurnInputQueueEntry>;
  removeTurnInputQueueEntry(
    identity: AgentSessionIdentity,
    queueEntryId: string,
    expectedVersion: Int64String,
    options?: AgentSessionReadOptions,
  ): Promise<void>;
  failTurnInputQueueEntry(
    identity: AgentSessionIdentity,
    queueEntryId: string,
    request: FailAgentTurnInputQueueEntryRequest,
    options?: AgentSessionReadOptions,
  ): Promise<AgentTurnInputQueueEntry>;
  retryTurnInputQueueEntry(
    identity: AgentSessionIdentity,
    queueEntryId: string,
    request: RetryAgentTurnInputQueueEntryRequest,
    options?: AgentSessionReadOptions,
  ): Promise<AgentTurnInputQueueEntry>;
  submitTurn(
    identity: AgentSessionIdentity,
    input: SubmitAgentTurnInput,
    options: SubmitAgentTurnOptions,
  ): Promise<AgentTurnCompletion>;
  listInteractions(
    identity: AgentSessionIdentity,
    request?: AgentInteractionPageRequest,
    options?: AgentSessionReadOptions,
  ): Promise<AgentSessionPage<AgentInteractionRecord>>;
  getInteraction(
    identity: AgentSessionIdentity,
    interactionId: string,
    options?: AgentSessionReadOptions,
  ): Promise<AgentInteractionRecord>;
  claimInteraction(
    identity: AgentSessionIdentity,
    interactionId: string,
    request: ClaimAgentInteractionRequest,
  ): Promise<AgentInteractionClaim>;
  approveInteraction(
    identity: AgentSessionIdentity,
    interactionId: string,
    request: ApproveAgentInteractionRequest,
  ): Promise<AgentInteractionRecord>;
  answerInteraction(
    identity: AgentSessionIdentity,
    interactionId: string,
    request: AnswerAgentInteractionRequest,
  ): Promise<AgentInteractionRecord>;
  resolveInteraction(
    identity: AgentSessionIdentity,
    interactionId: string,
    request: ResolveAgentInteractionRequest,
  ): Promise<AgentInteractionRecord>;
  listRuntimeBindings(
    identity: AgentSessionIdentity,
    request?: AgentSessionPageRequest,
    options?: AgentSessionReadOptions,
  ): Promise<AgentSessionPage<AgentSessionRuntimeBindingRecord>>;
  createRuntimeBinding(
    identity: AgentSessionIdentity,
    request: CreateAgentSessionRuntimeBindingRequest,
  ): Promise<AgentSessionRuntimeBindingRecord>;
  listCheckpoints(
    identity: AgentSessionIdentity,
    request?: AgentSessionPageRequest,
    options?: AgentSessionReadOptions,
  ): Promise<AgentSessionPage<AgentSessionCheckpointRecord>>;
  getSessionUserStates(
    identities: readonly AgentSessionIdentity[],
    options?: AgentSessionReadOptions,
  ): Promise<ReadonlyMap<string, AgentResourceUserStateRecord>>;
  updateSessionUserState(
    identity: AgentSessionIdentity,
    request: UpdateAgentSessionUserStateRequest,
  ): Promise<AgentResourceUserStateRecord>;
}
