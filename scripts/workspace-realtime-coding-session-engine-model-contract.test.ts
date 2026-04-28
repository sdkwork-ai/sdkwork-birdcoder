import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { BirdCoderProject, BirdCoderWorkspaceRealtimeEvent } from '../packages/sdkwork-birdcoder-types/src/index.ts';
import {
  applyWorkspaceRealtimeEventToProjects,
  isWorkspaceRealtimeEventSatisfiedByProjects,
} from '../packages/sdkwork-birdcoder-commons/src/stores/workspaceRealtime.ts';

const baseProject: BirdCoderProject = {
  id: 'project-realtime-contract',
  workspaceId: 'workspace-realtime-contract',
  name: 'Realtime Contract Project',
  description: undefined,
  path: 'D:/workspace/realtime-contract',
  createdAt: '2026-04-20T10:00:00.000Z',
  updatedAt: '2026-04-20T10:00:00.000Z',
  archived: false,
  codingSessions: [],
};

function createRealtimeEvent(
  overrides: Partial<BirdCoderWorkspaceRealtimeEvent>,
): BirdCoderWorkspaceRealtimeEvent {
  return {
    eventId: 'event-realtime-contract',
    eventKind: 'coding-session.created',
    workspaceId: 'workspace-realtime-contract',
    projectId: 'project-realtime-contract',
    projectName: 'Realtime Contract Project',
    codingSessionId: 'coding-session-realtime-contract',
    codingSessionTitle: 'Realtime Contract Session',
    codingSessionStatus: 'active',
    codingSessionHostMode: 'desktop',
    codingSessionEngineId: 'codex',
    codingSessionModelId: 'gpt-5.4',
    occurredAt: '2026-04-20T10:01:00.000Z',
    projectUpdatedAt: '2026-04-20T10:01:00.000Z',
    codingSessionUpdatedAt: '2026-04-20T10:01:00.000Z',
    sourceSurface: 'core',
    ...overrides,
  };
}

const ignoredCreationWithoutModel = applyWorkspaceRealtimeEventToProjects(
  [baseProject],
  createRealtimeEvent({
    codingSessionModelId: undefined,
  }),
);
assert.equal(
  ignoredCreationWithoutModel,
  null,
  'workspace realtime must ignore coding-session creation events that do not carry an explicit model id.',
);
assert.equal(
  isWorkspaceRealtimeEventSatisfiedByProjects(
    [],
    createRealtimeEvent({
      codingSessionModelId: undefined,
    }),
  ),
  false,
  'workspace realtime must request an authoritative refresh when an incomplete session event references a missing project.',
);

const seededProjectAndSession = applyWorkspaceRealtimeEventToProjects([], createRealtimeEvent({}));
assert.ok(
  seededProjectAndSession,
  'workspace realtime must materialize complete coding-session creation events even when the project-created event has not arrived yet.',
);
assert.equal(seededProjectAndSession?.[0]?.id, 'project-realtime-contract');
assert.equal(seededProjectAndSession?.[0]?.codingSessions[0]?.id, 'coding-session-realtime-contract');
assert.equal(
  isWorkspaceRealtimeEventSatisfiedByProjects(
    seededProjectAndSession ?? [],
    createRealtimeEvent({ eventId: 'event-realtime-contract-satisfied-after-seed' }),
  ),
  true,
  'workspace realtime satisfaction must treat a project seeded from a complete session event as satisfying the original session event.',
);
const otherProject: BirdCoderProject = {
  ...baseProject,
  id: 'project-realtime-other',
  name: 'Realtime Other Project',
  codingSessions: [],
};
const seededProjectsWithExistingInventory = applyWorkspaceRealtimeEventToProjects(
  [otherProject],
  createRealtimeEvent({ eventId: 'event-realtime-contract-seed-with-existing' }),
);
assert.equal(
  seededProjectsWithExistingInventory?.some((project) => project.id === otherProject.id),
  true,
  'workspace realtime must preserve existing projects when a session event seeds a missing project.',
);
assert.equal(
  seededProjectsWithExistingInventory?.some((project) => project.id === 'project-realtime-contract'),
  true,
  'workspace realtime must add the missing project from a complete session event without replacing the inventory.',
);

const createdProjects = applyWorkspaceRealtimeEventToProjects([baseProject], createRealtimeEvent({}));
assert.ok(createdProjects, 'workspace realtime must materialize coding sessions from complete creation events.');
assert.equal(createdProjects?.[0]?.codingSessions[0]?.engineId, 'codex');
assert.equal(createdProjects?.[0]?.codingSessions[0]?.modelId, 'gpt-5.4');

const createdProjectsWithNativeSessionId = applyWorkspaceRealtimeEventToProjects(
  [baseProject],
  createRealtimeEvent({
    eventId: 'event-realtime-contract-native-session-create',
    codingSessionId: 'coding-session-realtime-native-session-create',
    nativeSessionId: 'realtime-native-session-create',
  }),
);
assert.equal(
  createdProjectsWithNativeSessionId?.[0]?.codingSessions[0]?.nativeSessionId,
  'realtime-native-session-create',
  'workspace realtime must materialize the provider-native session id so terminal resume can use the engine session instead of the BirdCoder session id.',
);

const createdProjectsFromNativeBusyStatus = applyWorkspaceRealtimeEventToProjects(
  [baseProject],
  createRealtimeEvent({
    eventId: 'event-realtime-contract-native-busy',
    codingSessionId: 'coding-session-realtime-native-busy',
    codingSessionRuntimeStatus: 'busy' as BirdCoderWorkspaceRealtimeEvent['codingSessionRuntimeStatus'],
  }),
);
assert.equal(
  createdProjectsFromNativeBusyStatus?.[0]?.codingSessions[0]?.runtimeStatus,
  'streaming',
  'workspace realtime must normalize native busy runtime status aliases when materializing sessions.',
);
assert.equal(
  isWorkspaceRealtimeEventSatisfiedByProjects(
    createdProjectsFromNativeBusyStatus ?? [],
    createRealtimeEvent({
      eventId: 'event-realtime-contract-native-busy-satisfied',
      codingSessionId: 'coding-session-realtime-native-busy',
      codingSessionRuntimeStatus: 'busy' as BirdCoderWorkspaceRealtimeEvent['codingSessionRuntimeStatus'],
    }),
  ),
  true,
  'workspace realtime satisfaction checks must compare canonical runtime statuses for native aliases.',
);

const updatedProjects = applyWorkspaceRealtimeEventToProjects(
  createdProjects ?? [baseProject],
  createRealtimeEvent({
    eventId: 'event-realtime-contract-update',
    eventKind: 'coding-session.updated',
    codingSessionTitle: 'Realtime Contract Session Updated',
    codingSessionEngineId: 'claude-code',
    codingSessionModelId: 'claude-sonnet-4.5',
    nativeSessionId: 'realtime-native-session-update',
    codingSessionRuntimeStatus: 'completed',
    occurredAt: '2026-04-20T10:02:00.000Z',
    projectUpdatedAt: '2026-04-20T10:02:00.000Z',
    codingSessionUpdatedAt: '2026-04-20T10:02:00.000Z',
  }),
);
assert.ok(updatedProjects, 'workspace realtime must still update mutable session metadata.');
assert.equal(updatedProjects?.[0]?.codingSessions[0]?.title, 'Realtime Contract Session Updated');
assert.equal(updatedProjects?.[0]?.codingSessions[0]?.runtimeStatus, 'completed');
assert.equal(
  updatedProjects?.[0]?.codingSessions[0]?.engineId,
  'codex',
  'workspace realtime must not mutate the immutable coding session engine id after creation.',
);
assert.equal(
  updatedProjects?.[0]?.codingSessions[0]?.modelId,
  'gpt-5.4',
  'workspace realtime must not mutate the immutable coding session model id after creation.',
);
assert.equal(
  updatedProjects?.[0]?.codingSessions[0]?.nativeSessionId,
  'realtime-native-session-update',
  'workspace realtime must attach the provider-native session id from coding-session updates so the session context menu can resume in terminal.',
);
assert.equal(
  isWorkspaceRealtimeEventSatisfiedByProjects(
    createdProjects ?? [baseProject],
    createRealtimeEvent({
      eventId: 'event-realtime-contract-native-session-unsatisfied',
      eventKind: 'coding-session.updated',
      nativeSessionId: 'realtime-native-session-update',
      occurredAt: '2026-04-20T10:01:00.000Z',
      projectUpdatedAt: '2026-04-20T10:01:00.000Z',
      codingSessionUpdatedAt: '2026-04-20T10:01:00.000Z',
    }),
  ),
  false,
  'workspace realtime satisfaction must not treat a session as current when an event carries a nativeSessionId that the local session has not adopted.',
);
assert.equal(
  isWorkspaceRealtimeEventSatisfiedByProjects(
    updatedProjects ?? [baseProject],
    createRealtimeEvent({
      eventId: 'event-realtime-contract-native-session-satisfied',
      eventKind: 'coding-session.updated',
      nativeSessionId: 'realtime-native-session-update',
      occurredAt: '2026-04-20T10:02:00.000Z',
      projectUpdatedAt: '2026-04-20T10:02:00.000Z',
      codingSessionUpdatedAt: '2026-04-20T10:02:00.000Z',
    }),
  ),
  true,
  'workspace realtime satisfaction must treat an adopted nativeSessionId as current.',
);

const retriedProjects = applyWorkspaceRealtimeEventToProjects(
  createdProjects ?? [baseProject],
  createRealtimeEvent({
    eventId: 'event-realtime-contract-native-retry',
    eventKind: 'coding-session.updated',
    codingSessionRuntimeStatus: 'retry' as BirdCoderWorkspaceRealtimeEvent['codingSessionRuntimeStatus'],
    occurredAt: '2026-04-20T10:02:30.000Z',
    projectUpdatedAt: '2026-04-20T10:02:30.000Z',
    codingSessionUpdatedAt: '2026-04-20T10:02:30.000Z',
  }),
);
assert.equal(
  retriedProjects?.[0]?.codingSessions[0]?.runtimeStatus,
  'failed',
  'workspace realtime must normalize native retry runtime status aliases on updates.',
);

const locallyAdvancedProjects = applyWorkspaceRealtimeEventToProjects(
  updatedProjects ?? createdProjects ?? [baseProject],
  createRealtimeEvent({
    eventId: 'event-realtime-contract-turn',
    eventKind: 'coding-session.turn.created',
    codingSessionTitle: 'Stale Title From Turn Snapshot',
    codingSessionStatus: 'archived',
    codingSessionHostMode: 'server',
    codingSessionRuntimeStatus: 'streaming',
    occurredAt: '2026-04-20T10:03:00.000Z',
    projectUpdatedAt: '2026-04-20T10:03:00.000Z',
    codingSessionUpdatedAt: '2026-04-20T10:03:00.000Z',
  }),
);
assert.ok(
  locallyAdvancedProjects,
  'workspace realtime must advance session activity when a newer turn-created event arrives.',
);
assert.equal(
  locallyAdvancedProjects?.[0]?.codingSessions[0]?.title,
  'Realtime Contract Session Updated',
  'workspace realtime turn activity events must not mutate session metadata from a possibly stale turn snapshot.',
);
assert.equal(
  locallyAdvancedProjects?.[0]?.codingSessions[0]?.status,
  'active',
  'workspace realtime turn activity events must not mutate the persisted session status.',
);
assert.equal(
  locallyAdvancedProjects?.[0]?.codingSessions[0]?.hostMode,
  'desktop',
  'workspace realtime turn activity events must not mutate the persisted host mode.',
);
assert.equal(
  locallyAdvancedProjects?.[0]?.codingSessions[0]?.runtimeStatus,
  'streaming',
);

const sameTimestampCompletedProjects = applyWorkspaceRealtimeEventToProjects(
  locallyAdvancedProjects ?? updatedProjects ?? createdProjects ?? [baseProject],
  createRealtimeEvent({
    eventId: 'event-realtime-contract-same-timestamp-completed',
    eventKind: 'coding-session.updated',
    codingSessionTitle: 'Stale Title From Completed Turn Snapshot',
    turnId: 'turn-realtime-contract',
    codingSessionRuntimeStatus: 'completed',
    occurredAt: '2026-04-20T10:03:00.000Z',
    projectUpdatedAt: '2026-04-20T10:03:00.000Z',
    codingSessionUpdatedAt: '2026-04-20T10:03:00.000Z',
  }),
);
assert.ok(
  sameTimestampCompletedProjects,
  'workspace realtime must accept terminal runtime updates that share the same timestamp as the streaming turn-created event.',
);
assert.equal(
  sameTimestampCompletedProjects?.[0]?.codingSessions[0]?.runtimeStatus,
  'completed',
);
assert.equal(
  sameTimestampCompletedProjects?.[0]?.codingSessions[0]?.title,
  'Realtime Contract Session Updated',
  'workspace realtime completed turn updates must update runtime state without reverting metadata.',
);
assert.equal(
  isWorkspaceRealtimeEventSatisfiedByProjects(
    locallyAdvancedProjects ?? updatedProjects ?? createdProjects ?? [baseProject],
    createRealtimeEvent({
      eventId: 'event-realtime-contract-stale-update-satisfaction',
      eventKind: 'coding-session.updated',
      codingSessionTitle: 'Realtime Contract Session Updated',
      codingSessionStatus: 'archived',
      codingSessionHostMode: 'server',
      codingSessionRuntimeStatus: 'completed',
      occurredAt: '2026-04-20T10:02:00.000Z',
      projectUpdatedAt: '2026-04-20T10:02:00.000Z',
      codingSessionUpdatedAt: '2026-04-20T10:02:00.000Z',
    }),
  ),
  true,
  'workspace realtime satisfaction checks must treat stale coding-session updates as already satisfied when local state is newer.',
);

const staleUpdatedProjects = applyWorkspaceRealtimeEventToProjects(
  locallyAdvancedProjects ?? updatedProjects ?? createdProjects ?? [baseProject],
  createRealtimeEvent({
    eventId: 'event-realtime-contract-stale-update',
    eventKind: 'coding-session.updated',
    codingSessionTitle: 'Realtime Contract Session Updated',
    codingSessionStatus: 'archived',
    codingSessionHostMode: 'server',
    codingSessionRuntimeStatus: 'completed',
    occurredAt: '2026-04-20T10:02:00.000Z',
    projectUpdatedAt: '2026-04-20T10:02:00.000Z',
    codingSessionUpdatedAt: '2026-04-20T10:02:00.000Z',
  }),
);
assert.equal(
  staleUpdatedProjects,
  null,
  'workspace realtime must ignore stale coding-session updates once newer local session state already exists.',
);
assert.equal(
  locallyAdvancedProjects?.[0]?.codingSessions[0]?.title,
  'Realtime Contract Session Updated',
  'workspace realtime must preserve newer local titles when stale events arrive later.',
);
assert.equal(
  locallyAdvancedProjects?.[0]?.codingSessions[0]?.status,
  'active',
  'workspace realtime must preserve newer local status when stale events arrive later.',
);
assert.equal(
  locallyAdvancedProjects?.[0]?.codingSessions[0]?.hostMode,
  'desktop',
  'workspace realtime must preserve newer local host mode when stale events arrive later.',
);
assert.equal(
  locallyAdvancedProjects?.[0]?.codingSessions[0]?.runtimeStatus,
  'streaming',
  'workspace realtime must not let stale updates regress a newer local runtime status.',
);

const previouslyFailedRealtimeProjects: BirdCoderProject[] = [
  {
    ...baseProject,
    codingSessions: [
      {
        ...createdProjects![0]!.codingSessions[0]!,
        messages: [],
        runtimeStatus: 'failed',
      },
    ],
  },
];
const assistantCompletedRealtimeProjects = applyWorkspaceRealtimeEventToProjects(
  previouslyFailedRealtimeProjects,
  createRealtimeEvent({
    eventId: 'event-realtime-contract-assistant-completed-runtime',
    eventKind: 'coding-session.updated',
    codingSessionEventKind: 'message.completed',
    codingSessionEventPayload: {
      content: 'The transcript loaded successfully.',
      role: 'assistant',
    },
    occurredAt: '2026-04-20T10:03:30.000Z',
    projectUpdatedAt: '2026-04-20T10:03:30.000Z',
    codingSessionUpdatedAt: '2026-04-20T10:03:30.000Z',
    turnId: 'turn-realtime-assistant-completed-runtime',
  }),
);
assert.equal(
  assistantCompletedRealtimeProjects?.[0]?.codingSessions[0]?.runtimeStatus,
  'completed',
  'workspace realtime must derive session runtimeStatus from canonical codingSessionEventKind/payload when the top-level runtimeStatus hint is absent.',
);
assert.equal(
  assistantCompletedRealtimeProjects?.[0]?.codingSessions[0]?.messages.at(-1)?.content,
  'The transcript loaded successfully.',
  'workspace realtime must still merge the completed assistant message while converging the left session row runtime status.',
);

const deltaAppliedProjects = applyWorkspaceRealtimeEventToProjects(
  createdProjects ?? [baseProject],
  createRealtimeEvent({
    eventId: 'event-realtime-contract-message-delta',
    eventKind: 'coding-session.updated',
    codingSessionRuntimeStatus: 'streaming',
    codingSessionEventKind: 'message.delta',
    codingSessionEventPayload: {
      role: 'assistant',
      contentDelta: 'Streaming response chunk.',
      runtimeStatus: 'streaming',
    },
    turnId: 'turn-realtime-streaming',
    occurredAt: '2026-04-20T10:04:00.000Z',
    projectUpdatedAt: '2026-04-20T10:04:00.000Z',
    codingSessionUpdatedAt: '2026-04-20T10:04:00.000Z',
  }),
);
assert.equal(
  deltaAppliedProjects?.[0]?.codingSessions[0]?.messages.at(-1)?.content,
  'Streaming response chunk.',
  'workspace realtime must merge message.delta chunks directly into cached session messages so the selected transcript can echo through the stream instead of waiting for a refresh.',
);

const liveToolAppliedProjects = applyWorkspaceRealtimeEventToProjects(
  createdProjects ?? [baseProject],
  createRealtimeEvent({
    eventId: 'event-realtime-contract-tool-call',
    eventKind: 'coding-session.updated',
    codingSessionRuntimeStatus: 'streaming',
    codingSessionEventKind: 'tool.call.requested',
    codingSessionEventPayload: {
      toolName: 'run_command',
      toolCallId: 'tool-run-lint',
      toolArguments: {
        command: 'pnpm lint',
        cwd: 'D:/workspace/demo',
      },
      status: 'running',
      requiresApproval: false,
      requiresReply: false,
    },
    turnId: 'turn-realtime-streaming-tool',
    occurredAt: '2026-04-20T10:04:01.000Z',
    projectUpdatedAt: '2026-04-20T10:04:01.000Z',
    codingSessionUpdatedAt: '2026-04-20T10:04:01.000Z',
  }),
);
assert.deepEqual(
  liveToolAppliedProjects?.[0]?.codingSessions[0]?.messages.at(-1)?.commands?.[0],
  {
    command: 'pnpm lint',
    status: 'running',
    output: '{"command":"pnpm lint","cwd":"D:/workspace/demo"}',
    kind: 'command',
    toolName: 'run_command',
    toolCallId: 'tool-run-lint',
    runtimeStatus: 'streaming',
    requiresApproval: false,
    requiresReply: false,
  },
  'workspace realtime must merge streamed tool.call events directly into cached session command cards instead of waiting for final message.completed commandsJson.',
);

const serverHostSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-server/src-host/src/lib.rs', import.meta.url),
  'utf8',
);
assert.match(
  serverHostSource,
  /fn publish_coding_session_realtime_event\(/,
  'Rust host must publish coding-session realtime events through one helper so every event carries project metadata for frontend seeding.',
);
assert.match(
  serverHostSource,
  /native_session_id:\s*Option<String>/,
  'Rust coding-session realtime events must carry the provider-native session id through the standardized helper.',
);
assert.match(
  serverHostSource,
  /input\.native_session_id/,
  'Rust coding-session realtime helper must pass nativeSessionId into workspace realtime publication.',
);
assert.match(
  serverHostSource,
  /native_session_id,\s*\n\s*turn_id,/,
  'Rust workspace realtime payloads must expose nativeSessionId to the frontend.',
);
assert.match(
  serverHostSource,
  /coding_session_event_kind:\s*Option<String>/,
  'Rust workspace realtime payloads must carry generic coding-session event kinds so tool and approval streams are not text-only.',
);
assert.match(
  serverHostSource,
  /coding_session_event_payload:\s*Option<serde_json::Value>/,
  'Rust workspace realtime payloads must carry generic coding-session event payloads so streamed tool cards can render without a refresh.',
);
assert.match(
  serverHostSource,
  /payload:\s*BTreeMap<String,\s*serde_json::Value>/,
  'Rust coding-session event payloads must be modeled as JSON values so persisted events do not coerce booleans, arrays, or objects into strings.',
);
assert.match(
  serverHostSource,
  /parse_json_object_value_map\(/,
  'Rust coding-session event loaders must parse payload_json as a JSON object instead of a string-only map.',
);
assert.doesNotMatch(
  serverHostSource,
  /\.\s*publish_workspace_realtime_event\(\s*"coding-session\.(?:created|updated|deleted|turn\.created)"/,
  'Rust host must not publish raw coding-session realtime events without the standardized project metadata helper.',
);
assert.doesNotMatch(
  serverHostSource,
  /coding_session_message_(?:event_kind|role|content_delta)/,
  'Rust workspace realtime payloads must not keep a legacy text-only message delta side channel.',
);
assert.doesNotMatch(
  serverHostSource,
  /coerce_stream_event_payload_to_string_map/,
  'Rust stream event persistence must not flatten JSON event payload values into string maps.',
);

const serverApiSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-types/src/server-api.ts', import.meta.url),
  'utf8',
);
assert.doesNotMatch(
  serverApiSource,
  /codingSessionMessage(?:EventKind|Role|ContentDelta)/,
  'TypeScript workspace realtime API types must expose stream events only through codingSessionEventKind/codingSessionEventPayload.',
);

const workspaceRealtimeStoreSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/stores/workspaceRealtime.ts', import.meta.url),
  'utf8',
);
assert.doesNotMatch(
  workspaceRealtimeStoreSource,
  /buildRealtimeMessageDeltaProjectionEvent/,
  'Workspace realtime projection must not keep the legacy message-delta helper after canonical stream events are available.',
);

console.log('workspace realtime coding session engine/model contract passed.');
