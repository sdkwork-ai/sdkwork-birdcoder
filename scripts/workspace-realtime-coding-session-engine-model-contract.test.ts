import assert from 'node:assert/strict';

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

const createdProjects = applyWorkspaceRealtimeEventToProjects([baseProject], createRealtimeEvent({}));
assert.ok(createdProjects, 'workspace realtime must materialize coding sessions from complete creation events.');
assert.equal(createdProjects?.[0]?.codingSessions[0]?.engineId, 'codex');
assert.equal(createdProjects?.[0]?.codingSessions[0]?.modelId, 'gpt-5.4');

const updatedProjects = applyWorkspaceRealtimeEventToProjects(
  createdProjects ?? [baseProject],
  createRealtimeEvent({
    eventId: 'event-realtime-contract-update',
    eventKind: 'coding-session.updated',
    codingSessionTitle: 'Realtime Contract Session Updated',
    codingSessionEngineId: 'claude-code',
    codingSessionModelId: 'claude-sonnet-4.5',
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

const locallyAdvancedProjects = applyWorkspaceRealtimeEventToProjects(
  updatedProjects ?? createdProjects ?? [baseProject],
  createRealtimeEvent({
    eventId: 'event-realtime-contract-turn',
    eventKind: 'coding-session.turn.created',
    codingSessionTitle: 'Realtime Contract Session Locally Advanced',
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
  'Realtime Contract Session Locally Advanced',
);
assert.equal(
  locallyAdvancedProjects?.[0]?.codingSessions[0]?.runtimeStatus,
  'streaming',
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
  'Realtime Contract Session Locally Advanced',
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

console.log('workspace realtime coding session engine/model contract passed.');
