import assert from 'node:assert/strict';
import type {
  BirdCoderCodingSession,
  BirdCoderCodingSessionSummary,
  BirdCoderNativeSessionSummary,
  BirdCoderProject,
} from '@sdkwork/birdcoder-pc-types';
import {
  synchronizeProjectSessionsFromAuthority,
  synchronizeProjectsSessionsFromAuthority,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/workbench/projectSessionSynchronization.ts';
import type { IProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/services/interfaces/IProjectService.ts';

const workspaceId = 'workspace-session-authority-sync';
const projectId = 'project-session-authority-sync';

function buildSession(
  overrides: Partial<BirdCoderCodingSession> = {},
): BirdCoderCodingSession {
  return {
    id: 'projection-session',
    workspaceId,
    projectId,
    title: 'Projection session',
    status: 'active',
    hostMode: 'desktop',
    engineId: 'codex',
    modelId: 'gpt-5.4',
    nativeSessionId: 'shared-native-session',
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:01:00.000Z',
    lastTurnAt: '2026-07-15T00:01:00.000Z',
    sortTimestamp: String(Date.parse('2026-07-15T00:01:00.000Z')),
    transcriptUpdatedAt: '2026-07-15T00:01:00.000Z',
    messages: [],
    ...overrides,
  };
}

function buildProjectionSummary(
  overrides: Partial<BirdCoderCodingSessionSummary> = {},
): BirdCoderCodingSessionSummary {
  const session = buildSession(overrides as Partial<BirdCoderCodingSession>);
  const { messages: _messages, ...summary } = session;
  return summary;
}

function buildNativeSummary(
  overrides: Partial<BirdCoderNativeSessionSummary> = {},
): BirdCoderNativeSessionSummary {
  return {
    ...buildProjectionSummary(),
    kind: 'coding',
    nativeCwd: 'E:/workspace/session-authority-sync',
    ...overrides,
  };
}

const existingSession = buildSession({
  messages: [
    {
      id: 'existing-message',
      codingSessionId: 'projection-session',
      role: 'user',
      content: 'preserve me',
      createdAt: '2026-07-15T00:00:30.000Z',
      timestamp: Date.parse('2026-07-15T00:00:30.000Z'),
    },
  ],
});
const localNewerSession = buildSession({
  id: 'local-newer-session',
  nativeSessionId: 'local-newer-native-session',
  title: 'Local newer session',
  runtimeStatus: 'streaming',
  updatedAt: '2026-07-15T00:05:00.000Z',
  lastTurnAt: '2026-07-15T00:05:00.000Z',
  sortTimestamp: String(Date.parse('2026-07-15T00:05:00.000Z')),
  transcriptUpdatedAt: '2026-07-15T00:05:00.000Z',
});
const project: BirdCoderProject = {
  id: projectId,
  workspaceId,
  name: 'Session authority sync',
  createdAt: '2026-07-15T00:00:00.000Z',
  updatedAt: '2026-07-15T00:01:00.000Z',
  codingSessions: [existingSession, localNewerSession],
};

const appRuntimeReadService = {
  async listCodingSessions() {
    return [
      buildProjectionSummary({
        updatedAt: '2026-07-15T00:02:00.000Z',
        lastTurnAt: '2026-07-15T00:02:00.000Z',
        sortTimestamp: String(Date.parse('2026-07-15T00:02:00.000Z')),
        transcriptUpdatedAt: '2026-07-15T00:02:00.000Z',
      }),
      buildProjectionSummary({
        id: 'duplicate-projection-session',
        nativeSessionId: 'shared-native-session',
        title: 'Latest duplicate projection snapshot',
        updatedAt: '2026-07-15T00:02:30.000Z',
        lastTurnAt: '2026-07-15T00:02:30.000Z',
        sortTimestamp: String(Date.parse('2026-07-15T00:02:30.000Z')),
        transcriptUpdatedAt: '2026-07-15T00:02:30.000Z',
      }),
      buildProjectionSummary({
        id: 'stale-authority-session',
        nativeSessionId: 'local-newer-native-session',
        title: 'Stale authority session',
        runtimeStatus: 'completed',
        updatedAt: '2026-07-15T00:04:00.000Z',
        lastTurnAt: '2026-07-15T00:04:00.000Z',
        sortTimestamp: String(Date.parse('2026-07-15T00:04:00.000Z')),
        transcriptUpdatedAt: '2026-07-15T00:04:00.000Z',
      }),
    ];
  },
  async listNativeSessions() {
    return [
      buildNativeSummary({
        id: 'codex-native:shared-native-session',
        nativeSessionId: 'codex-native:shared-native-session',
        updatedAt: '2026-07-15T00:02:00.000Z',
        lastTurnAt: '2026-07-15T00:02:00.000Z',
        sortTimestamp: String(Date.parse('2026-07-15T00:02:00.000Z')),
        transcriptUpdatedAt: '2026-07-15T00:02:00.000Z',
      }),
      buildNativeSummary({
        id: 'codex-native:native-only-session',
        nativeSessionId: 'codex-native:native-only-session',
        title: 'Native only session',
        updatedAt: '2026-07-15T00:03:00.000Z',
        lastTurnAt: '2026-07-15T00:03:00.000Z',
        sortTimestamp: String(Date.parse('2026-07-15T00:03:00.000Z')),
        transcriptUpdatedAt: '2026-07-15T00:03:00.000Z',
      }),
    ];
  },
};

const upserts: BirdCoderCodingSession[] = [];
const projectService = {
  async upsertCodingSession(_projectId: string, codingSession: BirdCoderCodingSession) {
    upserts.push(codingSession);
  },
} as IProjectService;

const firstSync = await synchronizeProjectSessionsFromAuthority({
  appRuntimeReadService: appRuntimeReadService as never,
  project,
  projectService,
});

assert.equal(firstSync.project.codingSessions.length, 3);
const nativeOnlySession = firstSync.project.codingSessions.find(
  (session) => session.nativeSessionId === 'native-only-session',
);
assert.ok(
  nativeOnlySession,
  'native-only authority sessions must be added to the project projection.',
);
assert.ok(
  firstSync.project.codingSessions.indexOf(nativeOnlySession) >
    firstSync.project.codingSessions.findIndex(
      (session) => session.id === 'local-newer-session',
    ),
  'session projection must sort by latest activity instead of assuming the native-only item is always first.',
);
const mergedProjectionSession = firstSync.project.codingSessions.find(
  (session) => session.id === 'projection-session',
);
assert.equal(
  mergedProjectionSession?.title,
  'Latest duplicate projection snapshot',
  'repeated authority snapshots for one native session must collapse to the newest summary.',
);
assert.equal(
  mergedProjectionSession?.messages[0]?.id,
  'existing-message',
  'summary synchronization must preserve an already hydrated local transcript.',
);
assert.equal(
  firstSync.project.codingSessions.filter(
    (session) => session.nativeSessionId === 'shared-native-session',
  ).length,
  1,
  'projection and native summaries for the same engine session must not create duplicates.',
);
assert.equal(upserts.length, 2, 'the first synchronization must persist both changed summaries.');
const preservedLocalNewerSession = firstSync.project.codingSessions.find(
  (session) => session.id === 'local-newer-session',
);
assert.equal(
  preservedLocalNewerSession?.title,
  'Local newer session',
  'an older authority snapshot must not overwrite newer local session state.',
);
assert.equal(preservedLocalNewerSession?.runtimeStatus, 'streaming');
assert.equal(
  preservedLocalNewerSession?.sortTimestamp,
  localNewerSession.sortTimestamp,
  'an older authority snapshot must not move a locally newer session backwards.',
);

upserts.length = 0;
const secondSync = await synchronizeProjectSessionsFromAuthority({
  appRuntimeReadService: appRuntimeReadService as never,
  project: firstSync.project,
  projectService,
});
assert.equal(
  upserts.length,
  0,
  'repeating an unchanged authority synchronization must not write session summaries again.',
);
assert.deepEqual(
  secondSync.project.codingSessions.map((session) => session.id),
  firstSync.project.codingSessions.map((session) => session.id),
);

const boundedProjectionSummaries = Array.from({ length: 150 }, (_, index) =>
  buildProjectionSummary({
    id: `bounded-projection-${index}`,
    nativeSessionId: `bounded-projection-native-${index}`,
    title: `Bounded projection ${index}`,
    sortTimestamp: String(Date.parse('2026-07-15T01:00:00.000Z') + index),
  }),
);
const boundedNativeSummaries = Array.from({ length: 150 }, (_, index) =>
  buildNativeSummary({
    id: `bounded-native-${index}`,
    nativeSessionId: `bounded-native-${index}`,
    title: `Bounded native ${index}`,
    sortTimestamp: String(Date.parse('2026-07-15T02:00:00.000Z') + index),
  }),
);
const boundedUpserts: BirdCoderCodingSession[] = [];
const boundedSync = await synchronizeProjectSessionsFromAuthority({
  appRuntimeReadService: {
    async listCodingSessions() {
      return boundedProjectionSummaries;
    },
    async listNativeSessions() {
      return boundedNativeSummaries;
    },
  } as never,
  project: {
    ...project,
    codingSessions: [],
  },
  projectService: {
    async upsertCodingSession(_projectId: string, codingSession: BirdCoderCodingSession) {
      boundedUpserts.push(codingSession);
    },
  } as IProjectService,
});
assert.equal(
  boundedSync.project.codingSessions.length,
  200,
  'a synchronization pass must cap the merged projection/native page at 200 sessions.',
);
assert.equal(
  boundedUpserts.length,
  200,
  'a synchronization pass must not write more than the bounded merged session page.',
);

let batchProjectionReads = 0;
let batchNativeReads = 0;
const secondProjectId = 'project-session-authority-sync-2';
const batchUpserts: Array<{ projectId: string; sessionId: string }> = [];
const batchProjects = await synchronizeProjectsSessionsFromAuthority({
  appRuntimeReadService: {
    async listCodingSessions() {
      batchProjectionReads += 1;
      return [
        buildProjectionSummary({
          id: 'batch-projection-1',
          nativeSessionId: 'batch-native-1',
        }),
        buildProjectionSummary({
          id: 'batch-projection-2',
          nativeSessionId: 'batch-native-2',
          projectId: secondProjectId,
        }),
      ];
    },
    async listNativeSessions() {
      batchNativeReads += 1;
      return [];
    },
  } as never,
  projects: [
    { ...project, codingSessions: [] },
    { ...project, id: secondProjectId, codingSessions: [] },
  ],
  projectService: {
    async upsertCodingSession(targetProjectId: string, codingSession: BirdCoderCodingSession) {
      batchUpserts.push({ projectId: targetProjectId, sessionId: codingSession.id });
    },
  } as IProjectService,
  workspaceId,
});
assert.equal(batchProjectionReads, 1);
assert.equal(batchNativeReads, 1);
assert.equal(
  batchProjects.find((candidate) => candidate.id === projectId)?.codingSessions[0]?.id,
  'batch-projection-1',
);
assert.equal(
  batchProjects.find((candidate) => candidate.id === secondProjectId)?.codingSessions[0]?.id,
  'batch-projection-2',
);
assert.deepEqual(batchUpserts, [
  { projectId, sessionId: 'batch-projection-1' },
  { projectId: secondProjectId, sessionId: 'batch-projection-2' },
]);

console.log('project session authority synchronization contract passed.');
