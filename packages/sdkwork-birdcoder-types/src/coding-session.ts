import type {
  BirdCoderCodeEngineKey,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineTransportKind,
} from './engine.ts';

export const BIRDCODER_HOST_MODES = ['web', 'desktop', 'server'] as const;

export type BirdCoderHostMode = (typeof BIRDCODER_HOST_MODES)[number];

export const BIRDCODER_CODING_SESSION_STATUSES = [
  'draft',
  'active',
  'paused',
  'completed',
  'archived',
] as const;

export type BirdCoderCodingSessionStatus =
  (typeof BIRDCODER_CODING_SESSION_STATUSES)[number];

export const BIRDCODER_CODING_SESSION_RUNTIME_STATUSES = [
  'initializing',
  'ready',
  'streaming',
  'awaiting_tool',
  'awaiting_approval',
  'completed',
  'failed',
  'terminated',
] as const;

export type BirdCoderCodingSessionRuntimeStatus =
  (typeof BIRDCODER_CODING_SESSION_RUNTIME_STATUSES)[number];

const BIRDCODER_CODING_SESSION_EXECUTING_RUNTIME_STATUS_SET = new Set<
  BirdCoderCodingSessionRuntimeStatus
>(['initializing', 'streaming', 'awaiting_tool', 'awaiting_approval']);

function isBirdCoderCodingSessionRuntimeStatus(
  value: unknown,
): value is BirdCoderCodingSessionRuntimeStatus {
  return (
    typeof value === 'string' &&
    (BIRDCODER_CODING_SESSION_RUNTIME_STATUSES as readonly string[]).includes(value)
  );
}

interface BirdCoderCodingSessionExecutionLike {
  runtimeStatus?: BirdCoderCodingSessionRuntimeStatus | null;
}

export function resolveBirdCoderCodingSessionRuntimeStatus(
  events: readonly {
    payload?: Record<string, unknown> | null | undefined;
  }[],
  fallback?: BirdCoderCodingSessionRuntimeStatus | null,
): BirdCoderCodingSessionRuntimeStatus | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const runtimeStatus = events[index]?.payload?.runtimeStatus;
    if (isBirdCoderCodingSessionRuntimeStatus(runtimeStatus)) {
      return runtimeStatus;
    }
  }

  return fallback ?? undefined;
}

export function isBirdCoderCodingSessionExecuting(
  session: BirdCoderCodingSessionExecutionLike | null | undefined,
): boolean {
  if (!session?.runtimeStatus) {
    return false;
  }

  return BIRDCODER_CODING_SESSION_EXECUTING_RUNTIME_STATUS_SET.has(session.runtimeStatus);
}

export const BIRDCODER_CODING_SESSION_MESSAGE_ROLES = [
  'user',
  'assistant',
  'system',
  'tool',
  'reviewer',
  'planner',
] as const;

export type BirdCoderCodingSessionMessageRole =
  (typeof BIRDCODER_CODING_SESSION_MESSAGE_ROLES)[number];

export const BIRDCODER_CODING_SESSION_EVENT_KINDS = [
  'session.started',
  'turn.started',
  'message.delta',
  'message.completed',
  'message.deleted',
  'tool.call.requested',
  'tool.call.progress',
  'tool.call.completed',
  'artifact.upserted',
  'approval.required',
  'operation.updated',
  'turn.completed',
  'turn.failed',
] as const;

export type BirdCoderCodingSessionEventKind =
  (typeof BIRDCODER_CODING_SESSION_EVENT_KINDS)[number];

export const BIRDCODER_CODING_SESSION_ARTIFACT_KINDS = [
  'diff',
  'patch',
  'file',
  'command-log',
  'todo-list',
  'pty-transcript',
  'structured-output',
  'build-evidence',
  'preview-evidence',
  'simulator-evidence',
  'test-evidence',
  'release-evidence',
  'diagnostic-bundle',
] as const;

export type BirdCoderCodingSessionArtifactKind =
  (typeof BIRDCODER_CODING_SESSION_ARTIFACT_KINDS)[number];

export interface BirdCoderNativeSessionRef {
  engineId: BirdCoderCodeEngineKey;
  transportKind: BirdCoderEngineTransportKind;
  nativeSessionId?: string;
  nativeTurnContainerId?: string;
  nativeCheckpointId?: string;
  metadata?: Record<string, unknown>;
}

export interface BirdCoderCodingSessionSummary {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  status: BirdCoderCodingSessionStatus;
  hostMode: BirdCoderHostMode;
  engineId: BirdCoderCodeEngineKey;
  modelId?: string;
  runtimeStatus?: BirdCoderCodingSessionRuntimeStatus;
  createdAt: string;
  updatedAt: string;
  lastTurnAt?: string;
  sortTimestamp?: number;
  transcriptUpdatedAt?: string | null;
}

export function formatBirdCoderSessionDisplayTime(
  updatedAt?: string,
  createdAt?: string,
  now: number = Date.now(),
): string {
  const resolvedTimestamp =
    (typeof updatedAt === 'string' && !Number.isNaN(Date.parse(updatedAt)) ? updatedAt : '') ||
    (typeof createdAt === 'string' && !Number.isNaN(Date.parse(createdAt)) ? createdAt : '');

  if (!resolvedTimestamp) {
    return 'Unknown';
  }

  const resolvedValue = Date.parse(resolvedTimestamp);
  const deltaSeconds = Math.max(0, Math.floor((now - resolvedValue) / 1000));
  if (deltaSeconds < 60) {
    return 'Just now';
  }
  if (deltaSeconds < 3600) {
    const minutes = Math.floor(deltaSeconds / 60);
    return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  }
  if (deltaSeconds < 86400) {
    const hours = Math.floor(deltaSeconds / 3600);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.floor(deltaSeconds / 86400);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export interface BirdCoderSessionActivityLike {
  createdAt?: string;
  lastTurnAt?: string;
  sortTimestamp?: number;
  transcriptUpdatedAt?: string | null;
  updatedAt?: string;
}

function parseBirdCoderIsoTimestamp(value: string | null | undefined): number {
  if (typeof value !== 'string') {
    return Number.NaN;
  }

  const parsedValue = Date.parse(value);
  return Number.isNaN(parsedValue) ? Number.NaN : parsedValue;
}

export function resolveBirdCoderSessionActivityTimestamp(
  session: BirdCoderSessionActivityLike,
): string | undefined {
  const candidates = [
    session.transcriptUpdatedAt ?? undefined,
    session.lastTurnAt,
    session.updatedAt,
    session.createdAt,
  ];

  return candidates.find(
    (candidate): candidate is string => !Number.isNaN(parseBirdCoderIsoTimestamp(candidate)),
  );
}

export function resolveBirdCoderSessionSortTimestamp(
  session: BirdCoderSessionActivityLike,
): number {
  if (
    typeof session.sortTimestamp === 'number' &&
    Number.isFinite(session.sortTimestamp)
  ) {
    return session.sortTimestamp;
  }

  const activityTimestamp = resolveBirdCoderSessionActivityTimestamp(session);
  const parsedActivityTimestamp = parseBirdCoderIsoTimestamp(activityTimestamp);
  return Number.isNaN(parsedActivityTimestamp) ? 0 : parsedActivityTimestamp;
}

export function buildBirdCoderSessionSynchronizationVersion(
  session: BirdCoderSessionActivityLike,
  messageCount: number = 0,
): string {
  const normalizedMessageCount =
    Number.isFinite(messageCount) && messageCount > 0 ? Math.floor(messageCount) : 0;
  const transcriptUpdatedAt = session.transcriptUpdatedAt ?? null;
  return `${resolveBirdCoderSessionSortTimestamp(session)}:${normalizedMessageCount}:${transcriptUpdatedAt ?? ''}`;
}

export function formatBirdCoderSessionActivityDisplayTime(
  session: BirdCoderSessionActivityLike,
  now: number = Date.now(),
): string {
  return formatBirdCoderSessionDisplayTime(
    resolveBirdCoderSessionActivityTimestamp(session),
    session.createdAt,
    now,
  );
}

const BIRDCODER_TEXT_CONTENT_VALUE_KEYS = [
  'text',
  'content',
  'message',
  'summary',
  'value',
] as const;

const BIRDCODER_TEXT_CONTENT_COLLECTION_KEYS = [
  'parts',
  'items',
  'blocks',
  'segments',
  'children',
  'entries',
] as const;

function normalizeBirdCoderTextFragment(value: string): string | undefined {
  const normalizedValue = value.replace(/\r\n?/gu, '\n').trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function joinBirdCoderTextFragments(fragments: readonly string[]): string | undefined {
  const normalizedFragments = fragments
    .map((fragment) => normalizeBirdCoderTextFragment(fragment))
    .filter((fragment): fragment is string => typeof fragment === 'string');

  if (normalizedFragments.length === 0) {
    return undefined;
  }

  const deduplicatedFragments = normalizedFragments.filter(
    (fragment, index) => index === 0 || normalizedFragments[index - 1] !== fragment,
  );
  return deduplicatedFragments.join('\n\n');
}

function extractBirdCoderTextContentInternal(
  value: unknown,
  visitedObjects: WeakSet<object>,
): string | undefined {
  if (typeof value === 'string') {
    return normalizeBirdCoderTextFragment(value);
  }

  if (Array.isArray(value)) {
    return joinBirdCoderTextFragments(
      value
        .map((entry) => extractBirdCoderTextContentInternal(entry, visitedObjects))
        .filter((entry): entry is string => typeof entry === 'string'),
    );
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }

  if (visitedObjects.has(value)) {
    return undefined;
  }
  visitedObjects.add(value);

  const record = value as Record<string, unknown>;
  for (const key of BIRDCODER_TEXT_CONTENT_VALUE_KEYS) {
    const extractedValue = extractBirdCoderTextContentInternal(record[key], visitedObjects);
    if (extractedValue) {
      return extractedValue;
    }
  }

  for (const key of BIRDCODER_TEXT_CONTENT_COLLECTION_KEYS) {
    const extractedValue = extractBirdCoderTextContentInternal(record[key], visitedObjects);
    if (extractedValue) {
      return extractedValue;
    }
  }

  return undefined;
}

export function extractBirdCoderTextContent(value: unknown): string | undefined {
  return extractBirdCoderTextContentInternal(value, new WeakSet<object>());
}

export interface BirdCoderCodingSessionRuntime {
  id: string;
  codingSessionId: string;
  hostMode: BirdCoderHostMode;
  status: BirdCoderCodingSessionRuntimeStatus;
  engineId: BirdCoderCodeEngineKey;
  modelId?: string;
  nativeRef: BirdCoderNativeSessionRef;
  capabilitySnapshot: BirdCoderEngineCapabilityMatrix;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BirdCoderCodingSessionTurn {
  id: string;
  codingSessionId: string;
  runtimeId?: string;
  requestKind: 'chat' | 'plan' | 'tool' | 'review' | 'apply';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  inputSummary: string;
  startedAt?: string;
  completedAt?: string;
}

export interface BirdCoderCodingSessionMessage {
  id: string;
  codingSessionId: string;
  turnId?: string;
  role: BirdCoderCodingSessionMessageRole;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface BirdCoderCodingSessionEvent {
  id: string;
  codingSessionId: string;
  turnId?: string;
  runtimeId?: string;
  kind: BirdCoderCodingSessionEventKind | (string & {});
  sequence: number;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface BirdCoderCodingSessionArtifact {
  id: string;
  codingSessionId: string;
  turnId?: string;
  kind: BirdCoderCodingSessionArtifactKind | (string & {});
  status?: 'draft' | 'sealed' | 'archived';
  title: string;
  blobRef?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface BirdCoderCodingSessionCheckpoint {
  id: string;
  codingSessionId: string;
  runtimeId?: string;
  checkpointKind: 'resume' | 'approval' | 'handoff' | 'snapshot';
  resumable: boolean;
  state: Record<string, unknown>;
  createdAt: string;
}
