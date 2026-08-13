import {
  type AgentSessionItemRecord,
  type AgentResourceUserStateRecord,
  type AgentSessionRecord,
  type AgentSessionRuntimeBindingRecord,
  type AgentTurnInputQueueEntry,
  type AgentTurnRecord,
  type AgentTurnRuntimeEvent,
  type AgentTurnStreamEvent,
  completeAgentTurn,
  type CreateAgentSessionRuntimeBindingRequest,
  type SessionActivitySummary,
  type SdkworkAppClient as AgentsAppSdkClient,
} from '@sdkwork/birdcoder-pc-core/sdk/agents-app';
import { sha256Hash } from '@sdkwork/utils/crypto';
import { uuid } from '@sdkwork/utils/id';
import { normalizeOffsetListPageRequest } from './paginationValidation.ts';

import type {
  AgentInteractionPageRequest,
  AgentProjectSessionPageRequest,
  AgentScopedSessionPageRequest,
  AgentSessionActivityPageRequest,
  AgentSessionIdentity,
  AgentSessionItemPageRequest,
  AgentSessionItemSynchronizationStatus,
  AgentSessionItemSynchronizationView,
  AgentSessionPageRequest,
  AgentSessionReadOptions,
  AgentTurnCompletion,
  AgentWorkspaceSessionPageRequest,
  CreateAgentSessionInput,
  IAgentSessionService,
  SubmitAgentTurnOptions,
  SubmitAgentTurnInput,
} from './interfaces/IAgentSessionService.ts';

export const BIRDCODER_ASSISTANT_AGENT_ID = 'agent.birdcoder';
const SESSION_USER_STATE_BATCH_SIZE = 100;
const SESSION_USER_STATE_MAX_IDS = 1_000;
const SESSION_USER_STATE_MAX_CONCURRENCY = 4;
const SESSION_ACTIVITY_CURSOR_MAX_LENGTH = 2_048;
const SESSION_ACTIVITY_DEFAULT_PAGE_SIZE = 20;
const SESSION_ACTIVITY_MAX_PAGE_SIZE = 200;
const SESSION_ITEM_CURSOR_MAX_LENGTH = 2_048;
const SESSION_ITEM_DEFAULT_PAGE_SIZE = 50;
const SESSION_ITEM_MAX_PAGE_SIZE = 200;
const TURN_RECOVERY_DEFAULT_MAX_ATTEMPTS = 300;
const TURN_RECOVERY_DEFAULT_POLL_INTERVAL_MS = 2_000;
const TURN_RECOVERY_DISCOVERY_MAX_ATTEMPTS = 5;
const TURN_RECOVERY_ITEM_PAGE_SIZE = 200;
const TURN_RECOVERY_MAX_ITEM_PAGES = 10;
const AGENT_TURN_MAX_CONTENT_CHARACTERS = 1_048_576;
const AGENT_TURN_MAX_CONTENT_TYPE_CHARACTERS = 64;
const AGENT_TURN_MAX_DRIVE_REFS = 64;
const AGENT_TURN_MAX_IDENTITY_CHARACTERS = 128;
const AGENT_TURN_INPUT_QUEUE_PAGE_SIZE = 32;
const AGENT_TURN_MAX_RUNTIME_EVENTS = 10_000;
const AGENT_TURN_MAX_RUNTIME_EVENT_PAYLOAD_CHARACTERS = 4 * 1_048_576;
const AGENT_TURN_MAX_RUNTIME_EVENT_PAYLOAD_NODES = 65_536;
const AGENT_TURN_MAX_RUNTIME_EVENT_TOTAL_PAYLOAD_CHARACTERS = 8 * 1_048_576;
const AGENT_TURN_MAX_RUNTIME_EVENT_TOTAL_PAYLOAD_NODES = 131_072;
const AGENT_TURN_MAX_PROVIDER_IDENTITY_CHARACTERS = 2_048;
const AGENT_TURN_RUNTIME_EVENT_SOURCES = new Set([
  'runtime',
  'manifest',
  'provider',
  'model',
  'tool',
  'context',
  'memory',
  'policy',
  'host',
  'protocol_adapter',
  'kernel_ui',
  'code_kernel',
  'telemetry',
  'unknown',
]);
const AGENT_TURN_RUNTIME_EVENT_SEVERITIES = new Set([
  'debug',
  'info',
  'warn',
  'error',
]);
const AGENT_TURN_RUNTIME_EVENT_REDACTION_CLASSIFICATIONS = new Set([
  'public',
  'internal',
  'tenant_sensitive',
  'personal_data',
  'secret',
  'regulated',
  'unknown',
]);
const AGENT_INTERACTION_MAX_REASON_CHARACTERS = 2_048;
const AGENT_INTERACTION_MAX_ANSWER_CHARACTERS = 65_536;
const AGENT_INTERACTION_MAX_OPTION_VALUE_CHARACTERS = 256;
const AGENT_SESSION_ITEM_SYNCHRONIZATION_STATUSES = new Set<string>([
  'engine-unavailable',
  'imported',
  'no-active-binding',
  'not-provider-session',
]);

export interface BirdCoderAgentSessionServiceOptions {
  agentId?: string;
  client: AgentsAppSdkClient;
  turnRecoveryMaxAttempts?: number;
  turnRecoveryPollIntervalMs?: number;
}

type AgentTurnInputQueuePage = Awaited<ReturnType<
  AgentsAppSdkClient['ai']['agents']['turnInputQueueEntries']['list']
>>;

function hashPayload(value: unknown): string {
  return `sha256:${sha256Hash(JSON.stringify(value))}`;
}

function normalizePageRequest(request: AgentSessionPageRequest = {}) {
  const { page, pageSize } = normalizeOffsetListPageRequest({
    page: request.page,
    pageSize: request.pageSize,
  });
  return { page, pageSize };
}

function normalizeSessionItemPageRequest(
  request: AgentSessionItemPageRequest = {},
) {
  const pageSize = request.pageSize ?? SESSION_ITEM_DEFAULT_PAGE_SIZE;
  if (
    !Number.isSafeInteger(pageSize)
    || pageSize < 1
    || pageSize > SESSION_ITEM_MAX_PAGE_SIZE
  ) {
    throw new Error('Agents Session Item page size must be between 1 and 200.');
  }
  const cursor = request.cursor;
  if (
    cursor !== undefined
    && (
      cursor.length < 1
      || cursor.length > SESSION_ITEM_CURSOR_MAX_LENGTH
      || cursor.trim() !== cursor
    )
  ) {
    throw new Error('Agents Session Item cursor must be an unpadded value between 1 and 2048 characters.');
  }
  return {
    cursor,
    pageSize,
    sort: request.sort,
  };
}

function normalizeSessionItemCursorPage<TItem>(
  page: {
    items: TItem[];
    pageInfo: {
      hasMore?: boolean;
      mode: 'cursor' | 'offset';
      nextCursor?: string | null;
      pageSize?: number;
    };
  },
  request: ReturnType<typeof normalizeSessionItemPageRequest>,
) {
  const { pageInfo } = page;
  if (pageInfo.mode !== 'cursor') {
    throw new Error('Agents Session Item list must use cursor pagination.');
  }
  if (pageInfo.pageSize !== request.pageSize) {
    throw new Error('Agents Session Item list returned an unexpected page size.');
  }
  if (typeof pageInfo.hasMore !== 'boolean') {
    throw new Error('Agents Session Item list omitted its continuation state.');
  }
  const nextCursor = pageInfo.nextCursor;
  if (pageInfo.hasMore) {
    if (
      typeof nextCursor !== 'string'
      || nextCursor.length < 1
      || nextCursor.length > SESSION_ITEM_CURSOR_MAX_LENGTH
      || nextCursor.trim() !== nextCursor
      || nextCursor === request.cursor
    ) {
      throw new Error('Agents Session Item list returned a non-progressing cursor.');
    }
  } else if (nextCursor !== null && nextCursor !== undefined) {
    throw new Error('Agents Session Item terminal page must omit or null its cursor.');
  }
  return {
    ...page,
    pageInfo: {
      hasMore: pageInfo.hasMore,
      mode: 'cursor' as const,
      nextCursor: nextCursor ?? null,
      pageSize: request.pageSize,
    },
  };
}

function toApiRequestOptions(options: AgentSessionReadOptions = {}) {
  return {
    signal: options.signal,
    timeout: options.timeoutMs,
  };
}

/**
 * Validates the provider transcript synchronization outcome returned by
 * `agents.sessionItems.synchronize`. The generated SDK unwraps the command
 * envelope, but the outcome is still checked defensively so a malformed
 * status or count never reaches consumers as a trusted value.
 */
function readAgentSessionItemSynchronization(
  response: unknown,
): AgentSessionItemSynchronizationView {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new Error('Agents Session Item synchronization returned an invalid outcome.');
  }
  const synchronization = response as {
    importedItemCount?: unknown;
    status?: unknown;
  };
  const { importedItemCount, status } = synchronization;
  if (
    typeof status !== 'string'
    || !AGENT_SESSION_ITEM_SYNCHRONIZATION_STATUSES.has(status)
    || typeof importedItemCount !== 'string'
    || !/^[0-9]+$/u.test(importedItemCount)
  ) {
    throw new Error('Agents Session Item synchronization returned an invalid outcome.');
  }
  return {
    importedItemCount,
    status: status as AgentSessionItemSynchronizationStatus,
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

function normalizeOptionalRuntimeBindingValue(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function normalizeOptionalBoundedValue(
  value: string | null | undefined,
  label: string,
  maxLength: number,
): string | undefined {
  if (value !== null && value !== undefined && value.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    return undefined;
  }
  if (normalized.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }
  return normalized;
}

function normalizeAgentTurnDriveRefs(
  driveRefs: SubmitAgentTurnInput['driveRefs'],
): SubmitAgentTurnInput['driveRefs'] {
  if (!driveRefs) {
    return undefined;
  }
  if (driveRefs.length > AGENT_TURN_MAX_DRIVE_REFS) {
    throw new Error(`Agent turns support at most ${AGENT_TURN_MAX_DRIVE_REFS} Drive references.`);
  }
  return driveRefs.map((driveRef) => {
    if (
      !driveRef.driveSpaceId.trim()
      || driveRef.driveSpaceId.length > AGENT_TURN_MAX_IDENTITY_CHARACTERS
      || !driveRef.driveNodeId.trim()
      || driveRef.driveNodeId.length > AGENT_TURN_MAX_IDENTITY_CHARACTERS
    ) {
      throw new Error('Agent turn Drive references require bounded Space and Node identities.');
    }
    return {
      ...driveRef,
      driveNodeId: driveRef.driveNodeId.trim(),
      driveSpaceId: driveRef.driveSpaceId.trim(),
    };
  });
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

function normalizeAgentSessionIdentity(
  identity: AgentSessionIdentity,
): AgentSessionIdentity {
  const agentId = identity.agentId.trim();
  const sessionId = identity.sessionId.trim();
  if (!agentId || !sessionId) {
    throw new Error('Agents nested Session operations require both Agent and Session identities.');
  }
  return { agentId, sessionId };
}

function assertAgentSessionIdentity(
  session: Pick<AgentSessionRecord, 'agentId' | 'sessionId'>,
  expected: AgentSessionIdentity,
): void {
  if (
    session.agentId.trim() !== expected.agentId
    || session.sessionId.trim() !== expected.sessionId
  ) {
    throw new Error('Agents Session response identity does not match the requested nested resource.');
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
  if (completion.items.some(
    (item) => (item.content?.length ?? 0) > AGENT_TURN_MAX_CONTENT_CHARACTERS,
  )) {
    throw new Error('Agents turn completion contains an oversized Session Item.');
  }
}

function assertInteractionIdentity(
  interaction: { interactionId: string; sessionId: string },
  expectedSessionId: string,
  expectedInteractionId?: string,
): void {
  if (
    interaction.sessionId !== expectedSessionId
    || (expectedInteractionId && interaction.interactionId !== expectedInteractionId)
  ) {
    throw new Error('Agents Interaction identity does not match the requested Session.');
  }
}

function assertRuntimeBindingIdentity(
  binding: Pick<AgentSessionRuntimeBindingRecord, 'runtimeBindingId' | 'sessionId'>,
  expectedSessionId: string,
  expectedRuntimeBindingId?: string,
): void {
  if (
    binding.sessionId !== expectedSessionId
    || (
      expectedRuntimeBindingId
      && binding.runtimeBindingId !== expectedRuntimeBindingId
    )
  ) {
    throw new Error('Agents Runtime Binding identity does not match the requested Session.');
  }
}

function assertSessionUserStateIdentity(
  state: AgentResourceUserStateRecord,
  expectedSessionId: string,
): void {
  if (state.resourceType !== 'session' || state.resourceId !== expectedSessionId) {
    throw new Error('Agents Session user-state identity does not match the requested Session.');
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

function assertTurnInputQueueEntryIdentity(
  entry: Pick<AgentTurnInputQueueEntry, 'agentId' | 'queueEntryId' | 'sessionId'>,
  expected: AgentSessionIdentity,
  expectedQueueEntryId?: string,
): void {
  if (
    entry.agentId.trim() !== expected.agentId
    || entry.sessionId.trim() !== expected.sessionId
    || !entry.queueEntryId.trim()
    || (expectedQueueEntryId && entry.queueEntryId !== expectedQueueEntryId)
  ) {
    throw new Error(
      'Agents Turn input queue response identity does not match the requested nested resource.',
    );
  }
}

function normalizeTurnInputQueueEntryId(queueEntryId: string): string {
  const normalizedQueueEntryId = normalizeOptionalBoundedValue(
    queueEntryId,
    'Agent Turn input queue entry ID',
    AGENT_TURN_MAX_IDENTITY_CHARACTERS,
  );
  if (!normalizedQueueEntryId) {
    throw new Error('Agent Turn input queue entry ID is required.');
  }
  return normalizedQueueEntryId;
}

function readTurnInputQueuePage(response: unknown): AgentTurnInputQueuePage {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new Error('Agents Turn input queue returned an invalid page payload.');
  }

  const page = response as { items?: unknown; pageInfo?: unknown };
  const pageInfo = page.pageInfo as {
    hasMore?: unknown;
    mode?: unknown;
    page?: unknown;
    pageSize?: unknown;
  } | null;
  if (
    !Array.isArray(page.items)
    || !pageInfo
    || typeof pageInfo !== 'object'
    || Array.isArray(pageInfo)
    || typeof pageInfo.hasMore !== 'boolean'
    || pageInfo.mode !== 'offset'
    || pageInfo.page !== 1
    || pageInfo.pageSize !== AGENT_TURN_INPUT_QUEUE_PAGE_SIZE
  ) {
    throw new Error('Agents Turn input queue returned an invalid page payload.');
  }
  return response as AgentTurnInputQueuePage;
}

function readOptionalBoundedRuntimeIdentity(
  value: unknown,
  label: string,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (
    typeof value !== 'string'
    || !value.trim()
    || value.trim() !== value
    || value.length > AGENT_TURN_MAX_PROVIDER_IDENTITY_CHARACTERS
  ) {
    throw new Error(`${label} is malformed.`);
  }
  return value;
}

function readNullableBoundedRuntimeIdentity(
  value: unknown,
  label: string,
): string | null {
  if (value === undefined) {
    throw new Error(`${label} is malformed.`);
  }
  return readOptionalBoundedRuntimeIdentity(value, label);
}

function assertRuntimeEventEnum(
  value: unknown,
  allowedValues: ReadonlySet<string>,
  label: string,
): asserts value is string {
  if (typeof value !== 'string' || !allowedValues.has(value)) {
    throw new Error(`${label} is malformed.`);
  }
}

function assertAgentTurnIdentity(
  turn: Pick<AgentTurnRecord, 'agentId' | 'sessionId' | 'turnId'>,
  expected: AgentSessionIdentity,
  expectedTurnId: string,
): void {
  if (
    turn.agentId.trim() !== expected.agentId
    || turn.sessionId.trim() !== expected.sessionId
    || turn.turnId.trim() !== expectedTurnId
  ) {
    throw new Error('Agents Turn response identity does not match the requested nested resource.');
  }
}

function assertRuntimeEventTimestamp(value: unknown): void {
  const timestamp = readNullableBoundedRuntimeIdentity(
    value,
    'Runtime event timestamp',
  );
  if (timestamp && Number.isNaN(Date.parse(timestamp))) {
    throw new Error('Runtime event timestamp is malformed.');
  }
}

function assertRuntimeEventTraceContext(value: unknown): void {
  if (value === null) {
    return;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Runtime event trace context is malformed.');
  }
  const traceContext = value as Record<string, unknown>;
  if (
    !readOptionalBoundedRuntimeIdentity(traceContext.traceId, 'Runtime trace ID')
    || !readOptionalBoundedRuntimeIdentity(traceContext.spanId, 'Runtime span ID')
  ) {
    throw new Error('Runtime event trace context is malformed.');
  }
  readNullableBoundedRuntimeIdentity(traceContext.parentSpanId, 'Runtime parent span ID');
}

interface AgentTurnRuntimeEventBudget {
  remainingEvents: number;
  remainingPayloadCharacters: number;
  remainingPayloadNodes: number;
}

interface BoundedJsonMeasurement {
  characters: number;
  exceeded: boolean;
  isValid: boolean;
  nodes: number;
}

type BoundedJsonMeasurementFrame =
  | {
      index: number;
      kind: 'array';
      value: readonly unknown[];
    }
  | {
      entries: Generator<readonly [string, unknown], void>;
      kind: 'object';
    }
  | {
      kind: 'value';
      value: unknown;
    };

function* iterateOwnEnumerableRuntimeEventEntries(
  value: object,
): Generator<readonly [string, unknown], void> {
  const record = value as Record<string, unknown>;
  for (const key in record) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      yield [key, record[key]] as const;
    }
  }
}

function measureBoundedJsonValue(
  value: unknown,
  characterLimit: number,
  nodeLimit: number,
): BoundedJsonMeasurement {
  const visited = new WeakSet<object>();
  const frames: BoundedJsonMeasurementFrame[] = [{ kind: 'value', value }];
  let characters = 0;
  let nodes = 0;

  while (frames.length > 0) {
    const frame = frames.pop()!;
    if (frame.kind === 'array') {
      if (frame.index < frame.value.length) {
        frames.push({ ...frame, index: frame.index + 1 });
        frames.push({ kind: 'value', value: frame.value[frame.index] });
      }
      continue;
    }
    if (frame.kind === 'object') {
      const entry = frame.entries.next();
      if (!entry.done) {
        const [key, candidate] = entry.value;
        characters += key.length + 3;
        frames.push(frame);
        frames.push({ kind: 'value', value: candidate });
      }
      if (characters > characterLimit) {
        return { characters, exceeded: true, isValid: true, nodes };
      }
      continue;
    }

    nodes += 1;
    if (nodes > nodeLimit) {
      return { characters, exceeded: true, isValid: true, nodes };
    }
    const candidate = frame.value;
    if (typeof candidate === 'string') {
      characters += candidate.length + 2;
    } else if (candidate === null) {
      characters += 4;
    } else if (typeof candidate === 'boolean') {
      characters += candidate ? 4 : 5;
    } else if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      characters += String(candidate).length;
    } else if (typeof candidate !== 'object') {
      return { characters, exceeded: false, isValid: false, nodes };
    } else {
      if (visited.has(candidate)) {
        return { characters, exceeded: false, isValid: false, nodes };
      }
      visited.add(candidate);
      if (Array.isArray(candidate)) {
        characters += 2;
        frames.push({ index: 0, kind: 'array', value: candidate });
      } else {
        const prototype = Object.getPrototypeOf(candidate) as unknown;
        if (prototype !== Object.prototype && prototype !== null) {
          return { characters, exceeded: false, isValid: false, nodes };
        }
        characters += 2;
        frames.push({
          entries: iterateOwnEnumerableRuntimeEventEntries(candidate),
          kind: 'object',
        });
      }
    }
    if (characters > characterLimit) {
      return { characters, exceeded: true, isValid: true, nodes };
    }
  }

  return { characters, exceeded: false, isValid: true, nodes };
}

function createAgentTurnRuntimeEventBudget(): AgentTurnRuntimeEventBudget {
  return {
    remainingEvents: AGENT_TURN_MAX_RUNTIME_EVENTS,
    remainingPayloadCharacters: AGENT_TURN_MAX_RUNTIME_EVENT_TOTAL_PAYLOAD_CHARACTERS,
    remainingPayloadNodes: AGENT_TURN_MAX_RUNTIME_EVENT_TOTAL_PAYLOAD_NODES,
  };
}

function readAgentTurnRuntimeEvent(
  streamEvent: AgentTurnStreamEvent,
  expectedSessionId: string,
  expectedTurnId: string,
  expectedSequence: number,
  budget: AgentTurnRuntimeEventBudget,
): AgentTurnRuntimeEvent {
  const event = streamEvent.event;
  if (
    budget.remainingEvents <= 0
  ) {
    throw new Error('Agents turn runtime event count exceeds the presentation limit.');
  }
  if (
    streamEvent.eventType !== 'event'
    || !event
    || !Number.isSafeInteger(event.sequence)
    || event.sequence !== expectedSequence
    || event.sessionId !== expectedSessionId
    || event.turnId !== expectedTurnId
    || !event.payload
    || typeof event.payload !== 'object'
    || Array.isArray(event.payload)
  ) {
    throw new Error(
      `Agents turn runtime event ${expectedSequence} is malformed or out of order.`,
    );
  }
  if (
    !readOptionalBoundedRuntimeIdentity(event.eventId, 'Runtime event ID')
    || !readOptionalBoundedRuntimeIdentity(event.type, 'Runtime event type')
    || !readOptionalBoundedRuntimeIdentity(event.version, 'Runtime event version')
  ) {
    throw new Error(`Agents turn runtime event ${expectedSequence} is malformed.`);
  }
  readNullableBoundedRuntimeIdentity(event.providerSessionId, 'Provider Session ID');
  readNullableBoundedRuntimeIdentity(event.taskId, 'Provider task ID');
  const itemId = readNullableBoundedRuntimeIdentity(event.itemId, 'Provider item ID');
  readNullableBoundedRuntimeIdentity(event.runId, 'Provider run ID');
  readNullableBoundedRuntimeIdentity(event.correlationId, 'Runtime correlation ID');
  readNullableBoundedRuntimeIdentity(event.causationId, 'Runtime causation ID');
  readNullableBoundedRuntimeIdentity(event.payloadSchema, 'Runtime payload schema');
  assertRuntimeEventTimestamp(event.occurredAt);
  assertRuntimeEventEnum(
    event.source,
    AGENT_TURN_RUNTIME_EVENT_SOURCES,
    'Runtime event source',
  );
  assertRuntimeEventEnum(
    event.severity,
    AGENT_TURN_RUNTIME_EVENT_SEVERITIES,
    'Runtime event severity',
  );
  assertRuntimeEventEnum(
    event.redactionClassification,
    AGENT_TURN_RUNTIME_EVENT_REDACTION_CLASSIFICATIONS,
    'Runtime event redaction classification',
  );
  assertRuntimeEventTraceContext(event.traceContext);
  if (typeof event.replay !== 'boolean') {
    throw new Error('Runtime event replay marker is malformed.');
  }

  const payloadMeasurement = measureBoundedJsonValue(
    event.payload,
    Math.min(
      AGENT_TURN_MAX_RUNTIME_EVENT_PAYLOAD_CHARACTERS,
      budget.remainingPayloadCharacters,
    ),
    Math.min(
      AGENT_TURN_MAX_RUNTIME_EVENT_PAYLOAD_NODES,
      budget.remainingPayloadNodes,
    ),
  );
  if (!payloadMeasurement.isValid) {
    throw new Error('Agents turn runtime event payload is malformed.');
  }
  if (payloadMeasurement.exceeded) {
    throw new Error('Agents turn runtime event payload exceeds the presentation limit.');
  }
  budget.remainingEvents -= 1;
  budget.remainingPayloadCharacters -= payloadMeasurement.characters;
  budget.remainingPayloadNodes -= payloadMeasurement.nodes;
  const payloadItem = event.payload.item;
  if (payloadItem !== null && payloadItem !== undefined) {
    if (typeof payloadItem !== 'object' || Array.isArray(payloadItem)) {
      throw new Error('Agents turn runtime event item snapshot is malformed.');
    }
    const payloadItemId = readOptionalBoundedRuntimeIdentity(
      (payloadItem as Record<string, unknown>).id,
      'Provider payload item ID',
    );
    if (itemId && payloadItemId !== itemId) {
      throw new Error('Agents turn runtime event item identity does not match its envelope.');
    }
  }
  return event;
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
  private readonly turnRecoveryMaxAttempts: number;
  private readonly turnRecoveryPollIntervalMs: number;

  constructor({
    agentId,
    client,
    turnRecoveryMaxAttempts = TURN_RECOVERY_DEFAULT_MAX_ATTEMPTS,
    turnRecoveryPollIntervalMs = TURN_RECOVERY_DEFAULT_POLL_INTERVAL_MS,
  }: BirdCoderAgentSessionServiceOptions) {
    this.agentId = resolveAgentId(agentId);
    this.client = client;
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
    let cursor: string | undefined;
    let hasMore = true;
    let pagesRead = 0;
    while (hasMore && pagesRead < TURN_RECOVERY_MAX_ITEM_PAGES) {
      const response = await this.listSessionItems(
        { agentId, sessionId },
        { cursor, pageSize: TURN_RECOVERY_ITEM_PAGE_SIZE, sort: '-sequence' },
        options,
      );
      pagesRead += 1;
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
      cursor = response.pageInfo.nextCursor ?? undefined;
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
      if (
        !didFindTurn
        && attempt + 1 >= Math.min(
          this.turnRecoveryMaxAttempts,
          TURN_RECOVERY_DISCOVERY_MAX_ATTEMPTS,
        )
      ) {
        break;
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

  async createSession(input: CreateAgentSessionInput) {
    const projectId = normalizeProjectId(input.projectId);
    const agentId = resolveAgentId(input.agentId ?? this.agentId);
    const requestedAt = new Date().toISOString();
    // The Agents contract generates the canonical `sessionId` server-side;
    // the client must not supply one. The idempotency payload hash covers
    // exactly the fields that are actually sent.
    const sessionPayload = {
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
      ...sessionPayload,
      idempotencyKey: uuid(),
      payloadHash: hashPayload(sessionPayload),
      requestedAt,
    });
    assertCreatedSessionIdentity(response, agentId, projectId);
    return response;
  }

  async getSession(identity: AgentSessionIdentity, options: AgentSessionReadOptions = {}) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const response = await this.client.ai.agents.sessions.retrieve(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      toApiRequestOptions(options),
    );
    assertAgentSessionIdentity(response, normalizedIdentity);
    return response;
  }

  async getProjectSession(
    projectId: string,
    sessionId: string,
    options: AgentSessionReadOptions = {},
  ) {
    const normalizedProjectId = normalizeProjectId(projectId);
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) {
      throw new Error('Agents Session ID is required for project-scoped retrieval.');
    }
    const response = await this.client.ai.agents.projectSessions.retrieve(
      normalizedProjectId,
      normalizedSessionId,
      toApiRequestOptions(options),
    );
    if (
      response.projectId?.trim() !== normalizedProjectId
      || response.sessionId.trim() !== normalizedSessionId
    ) {
      throw new Error(
        'Agents project-scoped Session response identity does not match the requested resource.',
      );
    }
    return response;
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
    return response;
  }

  async listSessionsByProject(
    request: AgentProjectSessionPageRequest,
    options: AgentSessionReadOptions = {},
  ) {
    const projectId = normalizeProjectId(request.projectId);
    const pageRequest = normalizePageRequest(request);
    const response = await this.client.ai.agents.projectSessions.list(projectId, {
      ...pageRequest,
      includeArchived: request.includeArchived,
      status: request.status,
    }, toApiRequestOptions(options));
    return response;
  }

  async synchronizeProjectSessions(
    projectId: string,
    options: AgentSessionReadOptions = {},
  ) {
    const normalizedProjectId = normalizeProjectId(projectId);
    return this.client.ai.agents.projectSessions.synchronize(
      normalizedProjectId,
      toApiRequestOptions(options),
    );
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
    return response;
  }

  async updateSession(
    identity: AgentSessionIdentity,
    request: Parameters<IAgentSessionService['updateSession']>[1],
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const response = await this.client.ai.agents.sessions.update(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      request,
    );
    assertAgentSessionIdentity(response, normalizedIdentity);
    return response;
  }

  async closeSession(identity: AgentSessionIdentity, expectedVersion: string) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const response = await this.client.ai.agents.sessions.close(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      { expectedVersion, requestedAt: new Date().toISOString() },
    );
    assertAgentSessionIdentity(response, normalizedIdentity);
    return response;
  }

  async deleteSession(identity: AgentSessionIdentity): Promise<void> {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    await this.client.ai.agents.sessions.delete(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
    );
  }

  async listSessionItems(
    identity: AgentSessionIdentity,
    request: AgentSessionItemPageRequest = {},
    options: AgentSessionReadOptions = {},
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const normalizedRequest = normalizeSessionItemPageRequest(request);
    const response = await this.client.ai.agents.sessionItems.list(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      normalizedRequest,
      toApiRequestOptions(options),
    );
    return normalizeSessionItemCursorPage(response, normalizedRequest);
  }

  async synchronizeSessionItems(
    identity: AgentSessionIdentity,
    options: AgentSessionReadOptions = {},
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const response = await this.client.ai.agents.sessionItems.synchronize(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      toApiRequestOptions(options),
    );
    return readAgentSessionItemSynchronization(response);
  }

  async listTurns(
    identity: AgentSessionIdentity,
    request: AgentSessionPageRequest = {},
    options: AgentSessionReadOptions = {},
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const response = await this.client.ai.agents.turns.list(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      normalizePageRequest(request),
      toApiRequestOptions(options),
    );
    return response;
  }

  async cancelTurn(
    identity: AgentSessionIdentity,
    turnId: string,
    request: Parameters<IAgentSessionService['cancelTurn']>[2],
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const normalizedTurnId = normalizeOptionalBoundedValue(
      turnId,
      'Agent Turn ID',
      AGENT_TURN_MAX_IDENTITY_CHARACTERS,
    );
    if (!normalizedTurnId) {
      throw new Error('Agent Turn ID is required for cancellation.');
    }
    const response = await this.client.ai.agents.turns.cancel(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      normalizedTurnId,
      request,
    );
    assertAgentTurnIdentity(response, normalizedIdentity, normalizedTurnId);
    return response;
  }

  async getTurn(
    identity: AgentSessionIdentity,
    turnId: string,
    options?: Parameters<IAgentSessionService['getTurn']>[2],
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const normalizedTurnId = normalizeOptionalBoundedValue(
      turnId,
      'Agent Turn ID',
      AGENT_TURN_MAX_IDENTITY_CHARACTERS,
    );
    if (!normalizedTurnId) {
      throw new Error('Agent Turn ID is required for retrieval.');
    }
    const response = await this.client.ai.agents.turns.retrieve(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      normalizedTurnId,
      toApiRequestOptions(options),
    );
    assertAgentTurnIdentity(response, normalizedIdentity, normalizedTurnId);
    return response;
  }

  async listTurnInputQueueEntries(
    identity: AgentSessionIdentity,
    options: AgentSessionReadOptions = {},
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const response = readTurnInputQueuePage(
      await this.client.ai.agents.turnInputQueueEntries.list(
        normalizedIdentity.agentId,
        normalizedIdentity.sessionId,
        { page: 1, pageSize: AGENT_TURN_INPUT_QUEUE_PAGE_SIZE },
        toApiRequestOptions(options),
      ),
    );
    if (response.pageInfo.hasMore || response.items.length > AGENT_TURN_INPUT_QUEUE_PAGE_SIZE) {
      throw new Error('Agents Turn input queue exceeded its bounded Session capacity.');
    }
    const queueEntryIds = new Set<string>();
    for (const entry of response.items) {
      assertTurnInputQueueEntryIdentity(entry, normalizedIdentity);
      if (queueEntryIds.has(entry.queueEntryId)) {
        throw new Error(`Agents Turn input queue contains duplicate ${entry.queueEntryId}.`);
      }
      queueEntryIds.add(entry.queueEntryId);
    }
    return response;
  }

  async createTurnInputQueueEntry(
    identity: AgentSessionIdentity,
    request: Parameters<IAgentSessionService['createTurnInputQueueEntry']>[1],
    options: AgentSessionReadOptions = {},
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const response = await this.client.ai.agents.turnInputQueueEntries.create(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      request,
      toApiRequestOptions(options),
    );
    assertTurnInputQueueEntryIdentity(response, normalizedIdentity, request.queueEntryId);
    return response;
  }

  async clearTurnInputQueueEntries(
    identity: AgentSessionIdentity,
    options: AgentSessionReadOptions = {},
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const response = await this.client.ai.agents.turnInputQueueEntries.clear(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      toApiRequestOptions(options),
    );
    if (!/^\d+$/.test(response.clearedCount)) {
      throw new Error('Agents Turn input queue clear response contains an invalid count.');
    }
    return response;
  }

  async reorderTurnInputQueueEntries(
    identity: AgentSessionIdentity,
    request: Parameters<IAgentSessionService['reorderTurnInputQueueEntries']>[1],
    options: AgentSessionReadOptions = {},
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const response = await this.client.ai.agents.turnInputQueueEntries.reorder(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      request,
      toApiRequestOptions(options),
    );
    for (const entry of response.items) {
      assertTurnInputQueueEntryIdentity(entry, normalizedIdentity);
    }
    return response.items;
  }

  async claimNextTurnInputQueueEntry(
    identity: AgentSessionIdentity,
    request: Parameters<IAgentSessionService['claimNextTurnInputQueueEntry']>[1],
    options: AgentSessionReadOptions = {},
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const response = await this.client.ai.agents.turnInputQueueEntries.claimNext(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      request,
      toApiRequestOptions(options),
    );
    if (response.entry) {
      assertTurnInputQueueEntryIdentity(response.entry, normalizedIdentity);
    }
    if (
      response.outcome === 'claimed'
      && (!response.entry || !response.claimToken?.trim())
    ) {
      throw new Error('Agents Turn input queue claim response is missing its lease material.');
    }
    if (response.outcome !== 'claimed' && response.claimToken) {
      throw new Error('Agents Turn input queue returned a claim token without a claim.');
    }
    return response;
  }

  async updateTurnInputQueueEntry(
    identity: AgentSessionIdentity,
    queueEntryId: string,
    request: Parameters<IAgentSessionService['updateTurnInputQueueEntry']>[2],
    options: AgentSessionReadOptions = {},
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const normalizedQueueEntryId = normalizeTurnInputQueueEntryId(queueEntryId);
    const response = await this.client.ai.agents.turnInputQueueEntries.update(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      normalizedQueueEntryId,
      request,
      toApiRequestOptions(options),
    );
    assertTurnInputQueueEntryIdentity(
      response,
      normalizedIdentity,
      normalizedQueueEntryId,
    );
    return response;
  }

  async removeTurnInputQueueEntry(
    identity: AgentSessionIdentity,
    queueEntryId: string,
    expectedVersion: Parameters<IAgentSessionService['removeTurnInputQueueEntry']>[2],
    options: AgentSessionReadOptions = {},
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const normalizedQueueEntryId = normalizeTurnInputQueueEntryId(queueEntryId);
    await this.client.ai.agents.turnInputQueueEntries.delete(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      normalizedQueueEntryId,
      { expectedVersion },
      toApiRequestOptions(options),
    );
  }

  async failTurnInputQueueEntry(
    identity: AgentSessionIdentity,
    queueEntryId: string,
    request: Parameters<IAgentSessionService['failTurnInputQueueEntry']>[2],
    options: AgentSessionReadOptions = {},
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const normalizedQueueEntryId = normalizeTurnInputQueueEntryId(queueEntryId);
    const response = await this.client.ai.agents.turnInputQueueEntries.fail(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      normalizedQueueEntryId,
      request,
      toApiRequestOptions(options),
    );
    assertTurnInputQueueEntryIdentity(
      response,
      normalizedIdentity,
      normalizedQueueEntryId,
    );
    return response;
  }

  async retryTurnInputQueueEntry(
    identity: AgentSessionIdentity,
    queueEntryId: string,
    request: Parameters<IAgentSessionService['retryTurnInputQueueEntry']>[2],
    options: AgentSessionReadOptions = {},
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const normalizedQueueEntryId = normalizeTurnInputQueueEntryId(queueEntryId);
    const response = await this.client.ai.agents.turnInputQueueEntries.retry(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      normalizedQueueEntryId,
      request,
      toApiRequestOptions(options),
    );
    assertTurnInputQueueEntryIdentity(
      response,
      normalizedIdentity,
      normalizedQueueEntryId,
    );
    return response;
  }

  async submitTurn(
    identity: AgentSessionIdentity,
    input: SubmitAgentTurnInput,
    options: SubmitAgentTurnOptions,
  ) {
    const { agentId, sessionId: normalizedSessionId } = normalizeAgentSessionIdentity(identity);

    if (input.content.length > AGENT_TURN_MAX_CONTENT_CHARACTERS) {
      throw new Error(
        `Agent turn content must be ${AGENT_TURN_MAX_CONTENT_CHARACTERS} characters or fewer.`,
      );
    }
    const {
      idempotencyKey: requestedIdempotencyKey,
      payloadHash: requestedPayloadHash,
      ...turnInput
    } = input;
    const normalizedRequestedIdempotencyKey = normalizeOptionalBoundedValue(
      requestedIdempotencyKey,
      'Agent turn idempotency key',
      AGENT_TURN_MAX_IDENTITY_CHARACTERS,
    );
    const normalizedRequestedPayloadHash = normalizeOptionalBoundedValue(
      requestedPayloadHash,
      'Agent turn payload hash',
      AGENT_TURN_MAX_IDENTITY_CHARACTERS,
    );
    if (Boolean(normalizedRequestedIdempotencyKey) !== Boolean(normalizedRequestedPayloadHash)) {
      throw new Error(
        'Agent turn idempotency key and payload hash must be supplied together.',
      );
    }
    const driveRefs = normalizeAgentTurnDriveRefs(turnInput.driveRefs);
    const idempotencyKey = normalizedRequestedIdempotencyKey ?? uuid();
    const turnId = input.turnId?.trim() || `turn.${uuid()}`;
    const clientRequestId = normalizeOptionalBoundedValue(
      input.clientRequestId,
      'Agent turn client request ID',
      AGENT_TURN_MAX_IDENTITY_CHARACTERS,
    ) ?? idempotencyKey;
    const contentType = normalizeOptionalBoundedValue(
      input.contentType,
      'Agent turn content type',
      AGENT_TURN_MAX_CONTENT_TYPE_CHARACTERS,
    );
    const payload = {
      ...turnInput,
      accessModeId: normalizeOptionalBoundedValue(
        input.accessModeId,
        'Agent access mode ID',
        AGENT_TURN_MAX_IDENTITY_CHARACTERS,
      ),
      content: input.content.trim(),
      contentType,
      clientRequestId,
      driveRefs,
      requestedModelId: normalizeOptionalBoundedValue(
        input.requestedModelId,
        'Agent requested model ID',
        AGENT_TURN_MAX_IDENTITY_CHARACTERS,
      ),
      runtimeBindingId: normalizeOptionalBoundedValue(
        input.runtimeBindingId,
        'Agent runtime binding ID',
        AGENT_TURN_MAX_IDENTITY_CHARACTERS,
      ),
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
      payloadHash: normalizedRequestedPayloadHash ?? hashPayload(payload),
      requestedAt: new Date().toISOString(),
    };

    let completion: AgentTurnCompletion | null = null;
    let content = '';
    let didNotifyAccepted = false;
    let didNotifyDeliveryUncertain = false;
    let didObserveStreamEvent = false;
    let expectedDeltaIndex = 0;
    let expectedRuntimeEventSequence = 0;
    const runtimeEventBudget = createAgentTurnRuntimeEventBudget();
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
        { eventProtocol: 'kernel-v1', stream: true },
        toApiRequestOptions(options),
      );
      for await (const event of events) {
        didObserveStreamEvent = true;
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
            || event.delta.length === 0
          ) {
            throw new Error(
              `Agents turn stream delta ${expectedDeltaIndex} is missing or out of order.`,
            );
          }
          notifyAccepted();
          if (content.length + event.delta.length > AGENT_TURN_MAX_CONTENT_CHARACTERS) {
            throw new Error('Agents turn stream exceeded the maximum Session Item size.');
          }
          content += event.delta;
          try {
            options.onDelta?.({ content, delta: event.delta, index: event.index });
          } catch {
            // Presentation observers cannot change the outcome of an accepted backend command.
          }
          expectedDeltaIndex += 1;
          continue;
        }
        if (event.eventType === 'event') {
          const runtimeEvent = readAgentTurnRuntimeEvent(
            event,
            normalizedSessionId,
            turnId,
            expectedRuntimeEventSequence,
            runtimeEventBudget,
          );
          notifyAccepted();
          try {
            options.onRuntimeEvent?.(runtimeEvent);
          } catch {
            // Presentation observers cannot change the outcome of an accepted backend command.
          }
          expectedRuntimeEventSequence += 1;
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
        http?: { request?: unknown };
      };
      if (
        !didObserveStreamEvent
        && typeof clientWithHttp.http?.request === 'function'
      ) {
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
    return completion;
  }

  async listInteractions(
    identity: AgentSessionIdentity,
    request: AgentInteractionPageRequest = {},
    options: AgentSessionReadOptions = {},
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const response = await this.client.ai.agents.interactions.list(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      {
        ...normalizePageRequest(request),
        kind: request.kind,
        status: request.status,
      },
      toApiRequestOptions(options),
    );
    const interactionIds = new Set<string>();
    for (const interaction of response.items) {
      assertInteractionIdentity(interaction, normalizedIdentity.sessionId);
      if (
        (request.kind && interaction.kind !== request.kind)
        || (request.status && interaction.status !== request.status)
      ) {
        throw new Error('Agents Interaction page returned a resource outside its filter.');
      }
      if (interactionIds.has(interaction.interactionId)) {
        throw new Error(`Agents Interaction page contains duplicate ${interaction.interactionId}.`);
      }
      interactionIds.add(interaction.interactionId);
    }
    return response;
  }

  async getInteraction(
    identity: AgentSessionIdentity,
    interactionId: string,
    options: AgentSessionReadOptions = {},
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const response = await this.client.ai.agents.interactions.retrieve(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      interactionId,
      toApiRequestOptions(options),
    );
    assertInteractionIdentity(response, normalizedIdentity.sessionId, interactionId);
    return response;
  }

  async claimInteraction(
    identity: AgentSessionIdentity,
    interactionId: string,
    request: Parameters<IAgentSessionService['claimInteraction']>[2],
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const response = await this.client.ai.agents.interactions.claim(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      interactionId,
      request,
    );
    assertInteractionIdentity(
      response.interaction,
      normalizedIdentity.sessionId,
      interactionId,
    );
    if (
      !response.claimToken.trim()
      || !response.fencingToken.trim()
      || !Number.isFinite(Date.parse(response.claimExpiresAt))
    ) {
      throw new Error('Agents Interaction claim response is malformed.');
    }
    return response;
  }

  async approveInteraction(
    identity: AgentSessionIdentity,
    interactionId: string,
    request: Parameters<IAgentSessionService['approveInteraction']>[2],
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const reason = normalizeOptionalBoundedValue(
      request.reason,
      'Agent Interaction approval reason',
      AGENT_INTERACTION_MAX_REASON_CHARACTERS,
    );
    const response = await this.client.ai.agents.interactions.approve(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      interactionId,
      { ...request, reason },
    );
    assertInteractionIdentity(response, normalizedIdentity.sessionId, interactionId);
    return response;
  }

  async answerInteraction(
    identity: AgentSessionIdentity,
    interactionId: string,
    request: Parameters<IAgentSessionService['answerInteraction']>[2],
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    if (request.answer.length > AGENT_INTERACTION_MAX_ANSWER_CHARACTERS) {
      throw new Error(
        `Agent Interaction answer must be ${AGENT_INTERACTION_MAX_ANSWER_CHARACTERS} characters or fewer.`,
      );
    }
    const answer = request.answer.trim();
    const selectedOptionValue = normalizeOptionalBoundedValue(
      request.selectedOptionValue,
      'Agent Interaction selected option value',
      AGENT_INTERACTION_MAX_OPTION_VALUE_CHARACTERS,
    );
    const response = await this.client.ai.agents.interactions.answer(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      interactionId,
      { ...request, answer, selectedOptionValue },
    );
    assertInteractionIdentity(response, normalizedIdentity.sessionId, interactionId);
    return response;
  }

  async resolveInteraction(
    identity: AgentSessionIdentity,
    interactionId: string,
    request: Parameters<IAgentSessionService['resolveInteraction']>[2],
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const response = await this.client.ai.agents.interactions.resolve(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      interactionId,
      request,
    );
    assertInteractionIdentity(response, normalizedIdentity.sessionId, interactionId);
    return response;
  }

  async listRuntimeBindings(
    identity: AgentSessionIdentity,
    request: AgentSessionPageRequest = {},
    options: AgentSessionReadOptions = {},
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const response = await this.client.ai.agents.sessionRuntimeBindings.list(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      normalizePageRequest(request),
      toApiRequestOptions(options),
    );
    for (const binding of response.items) {
      assertRuntimeBindingIdentity(binding, normalizedIdentity.sessionId);
    }
    return response;
  }

  async createRuntimeBinding(
    identity: AgentSessionIdentity,
    request: Parameters<IAgentSessionService['createRuntimeBinding']>[1],
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const runtimeBindingId = request.runtimeBindingId?.trim()
      || `runtime_binding.${uuid()}`;
    const idempotentRequest = {
      ...request,
      runtimeBindingId,
    };

    let response: AgentSessionRuntimeBindingRecord;
    try {
      response = await this.client.ai.agents.sessionRuntimeBindings.create(
        normalizedIdentity.agentId,
        normalizedIdentity.sessionId,
        idempotentRequest,
      );
    } catch (creationError) {
      try {
        const existingBinding = await this.client.ai.agents.sessionRuntimeBindings.retrieve(
          normalizedIdentity.agentId,
          normalizedIdentity.sessionId,
          runtimeBindingId,
        );
        assertRuntimeBindingIdentity(
          existingBinding,
          normalizedIdentity.sessionId,
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
    assertRuntimeBindingIdentity(
      response,
      normalizedIdentity.sessionId,
      runtimeBindingId,
    );
    return response;
  }

  async listCheckpoints(
    identity: AgentSessionIdentity,
    request: AgentSessionPageRequest = {},
    options: AgentSessionReadOptions = {},
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const response = await this.client.ai.agents.checkpoints.list(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      normalizePageRequest(request),
      toApiRequestOptions(options),
    );
    for (const checkpoint of response.items) {
      if (checkpoint.sessionId !== normalizedIdentity.sessionId) {
        throw new Error('Agents Checkpoint identity does not match the requested Session.');
      }
    }
    return response;
  }

  async getSessionUserStates(
    identities: readonly AgentSessionIdentity[],
    options: AgentSessionReadOptions = {},
  ) {
    const sessionIdsByAgent = new Map<string, string[]>();
    const agentIdsBySessionId = new Map<string, string>();
    for (const identity of identities) {
      const { agentId, sessionId } = normalizeAgentSessionIdentity(identity);
      const existingAgentId = agentIdsBySessionId.get(sessionId);
      if (existingAgentId === agentId) {
        continue;
      }
      if (existingAgentId) {
        throw new Error(
          `Agents Session ${sessionId} cannot be read from both Agent "${existingAgentId}" and Agent "${agentId}".`,
        );
      }
      agentIdsBySessionId.set(sessionId, agentId);
      if (agentIdsBySessionId.size > SESSION_USER_STATE_MAX_IDS) {
        throw new Error(
          `Agents session user-state reads support at most ${SESSION_USER_STATE_MAX_IDS} Session ids.`,
        );
      }
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
    const pages = new Array<{
      batchSessionIds: string[];
      page: Awaited<ReturnType<AgentsAppSdkClient['ai']['agents']['sessionUserStates']['list']>>;
    }>(batches.length);
    let nextBatchIndex = 0;
    const workerCount = Math.min(SESSION_USER_STATE_MAX_CONCURRENCY, batches.length);
    await Promise.all(Array.from({ length: workerCount }, async () => {
      while (nextBatchIndex < batches.length) {
        const batchIndex = nextBatchIndex;
        nextBatchIndex += 1;
        const batch = batches[batchIndex];
        if (!batch) {
          continue;
        }
        const { agentId, sessionIds: batchSessionIds } = batch;
        options.signal?.throwIfAborted();
        const page = await this.client.ai.agents.sessionUserStates.list(agentId, {
          page: 1,
          pageSize: batchSessionIds.length,
          includeHidden: true,
          sessionIds: batchSessionIds.join(','),
        }, toApiRequestOptions(options));
        if (page.pageInfo.hasMore || page.items.length > batchSessionIds.length) {
          throw new Error('Agents session user-state batch exceeded its requested bounds.');
        }
        pages[batchIndex] = { batchSessionIds, page };
      }
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
    identity: AgentSessionIdentity,
    request: Parameters<IAgentSessionService['updateSessionUserState']>[1],
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const response = await this.client.ai.agents.sessionUserStates.update(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      request,
    );
    assertSessionUserStateIdentity(response, normalizedIdentity.sessionId);
    return response;
  }

  async updateSessionItemFeedback(
    identity: AgentSessionIdentity,
    itemId: string,
    rating: 'up' | 'down' | null,
  ) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const normalizedItemId = itemId.trim();
    if (!normalizedItemId) {
      throw new Error('Agent session item feedback requires an item id.');
    }
    return this.client.ai.agents.itemFeedback.update(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      normalizedItemId,
      rating === null ? { clearFeedback: true } : { rating },
    );
  }

  async listSessionItemFeedback(identity: AgentSessionIdentity) {
    const normalizedIdentity = normalizeAgentSessionIdentity(identity);
    const response = await this.client.ai.agents.itemFeedback.list(
      normalizedIdentity.agentId,
      normalizedIdentity.sessionId,
      { page: 1, pageSize: 200 },
    );
    const items = Array.isArray(response?.items) ? response.items : [];
    if (!Array.isArray(response?.items)) {
      // The feedback surface degrades to an empty list when the owner
      // response is malformed; keep the degradation observable instead of
      // silently hiding a backend contract break.
      console.warn(
        'Agent Session item feedback response is missing an items array; degrading to an empty list.',
        { agentId: normalizedIdentity.agentId, sessionId: normalizedIdentity.sessionId },
      );
    }
    return (items as Array<{ itemId: string; rating: 'up' | 'down' }>)
      .map((item) => ({ itemId: item.itemId, rating: item.rating }));
  }
}

function resolveAgentId(value?: string): string {
  const agentId = value?.trim() || BIRDCODER_ASSISTANT_AGENT_ID;
  if (!agentId) {
    throw new Error('BirdCoder assistant agentId is required.');
  }
  return agentId;
}
