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
  createdAt: string;
  updatedAt: string;
  lastTurnAt?: string;
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
