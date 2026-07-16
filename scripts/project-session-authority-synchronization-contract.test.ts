import assert from 'node:assert/strict';
import fs from 'node:fs';
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

const sessionInventorySource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/workbench/sessionInventory.ts',
    import.meta.url,
  ),
  'utf8',
);

assert.match(
  sessionInventorySource,
  /import \{[\s\S]*?listStoredTerminalSessions,[\s\S]*?type TerminalSessionRecord,[\s\S]*?\} from '\.\.\/terminal\/sessions\.ts';/,
  'session authority must use the canonical terminal inventory export without an ineffective dynamic import.',
);
assert.match(
  sessionInventorySource,
  /try \{[\s\S]*?return listStoredTerminalSessions\(options\);[\s\S]*?catch \(error\)/,
  'session authority must isolate optional terminal inventory failures without hiding provider sessions.',
);
assert.doesNotMatch(
  sessionInventorySource,
  /import\('\.\.\/terminal\/sessions\.ts'\)/,
  'session authority must not retain an ineffective dynamic import for a module already exported by the commons package.',
);

const workspaceId = 'workspace-session-authority-sync';
const projectId = 'project-session-authority-sync';
const runtimeLocationId = 'runtime-location-session-authority-sync';

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
    runtimeLocationId,
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
  async listNativeSessions(request: { runtimeLocationId: string }) {
    assert.equal(request.runtimeLocationId, runtimeLocationId);
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
  runtimeLocationId,
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
  mergedProjectionSession?.runtimeLocationId,
  runtimeLocationId,
  'authority synchronization must retain the exact opaque runtime-location binding.',
);
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
  runtimeLocationId,
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

let projectionOnlyNativeReads = 0;
const legacyProjectionSync = await synchronizeProjectSessionsFromAuthority({
  appRuntimeReadService: {
    async listCodingSessions() {
      return [
        buildProjectionSummary({
          id: 'legacy-visible-session',
          nativeSessionId: 'legacy-visible-native-session',
          runtimeLocationId: undefined,
        }),
      ];
    },
    async listNativeSessions() {
      projectionOnlyNativeReads += 1;
      return [
        buildNativeSummary({
          id: 'codex-native:must-not-be-discovered',
          nativeSessionId: 'codex-native:must-not-be-discovered',
        }),
      ];
    },
  } as never,
  project: {
    ...project,
    codingSessions: [],
  },
  projectService: {
    async upsertCodingSession() {},
  } as IProjectService,
});
assert.equal(
  projectionOnlyNativeReads,
  0,
  'without an explicitly supplied runtime-location id, synchronization must not discover native sessions.',
);
assert.equal(
  legacyProjectionSync.project.codingSessions.length,
  1,
  'a legacy session without a runtime-location binding must remain visible in the persisted projection.',
);
assert.equal(
  legacyProjectionSync.project.codingSessions[0]?.runtimeLocationId,
  undefined,
  'legacy projections must not synthesize a runtime-location binding.',
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
  runtimeLocationId,
});
assert.equal(
  boundedSync.project.codingSessions.length,
  6,
  'initial project synchronization must retain five visible sessions plus one hidden sentinel.',
);
assert.equal(
  boundedUpserts.length,
  6,
  'initial project synchronization must only mirror the bounded session prefix.',
);
assert.equal(
  boundedSync.hasMoreSessions,
  true,
  'the hidden sentinel must report that the project still has additional authority sessions.',
);
assert.equal(boundedSync.loadedSessionCount, 6);

const expandedToFifteen = await synchronizeProjectSessionsFromAuthority({
  appRuntimeReadService: {
    async listCodingSessions() {
      return boundedProjectionSummaries;
    },
    async listNativeSessions() {
      return boundedNativeSummaries;
    },
  } as never,
  project: boundedSync.project,
  projectService: {
    async upsertCodingSession() {},
  } as IProjectService,
  runtimeLocationId,
  sessionLimit: 16,
});
assert.equal(
  expandedToFifteen.project.codingSessions.length,
  16,
  'the first Show more target must retain fifteen visible sessions plus one hidden sentinel.',
);
assert.equal(expandedToFifteen.hasMoreSessions, true);

const expandedToTwentyFive = await synchronizeProjectSessionsFromAuthority({
  appRuntimeReadService: {
    async listCodingSessions() {
      return boundedProjectionSummaries;
    },
    async listNativeSessions() {
      return boundedNativeSummaries;
    },
  } as never,
  project: expandedToFifteen.project,
  projectService: {
    async upsertCodingSession() {},
  } as IProjectService,
  runtimeLocationId,
  sessionLimit: 26,
});
assert.equal(
  expandedToTwentyFive.project.codingSessions.length,
  26,
  'the second Show more target must retain twenty-five visible sessions plus one hidden sentinel.',
);
assert.equal(expandedToTwentyFive.hasMoreSessions, true);

const pagedProviderIds = ['codex', 'claude-code', 'gemini', 'opencode'] as const;
const pagedBaseTimestamp = Date.parse('2026-07-15T03:00:00.000Z');
const pagedProjectionSummaries = Array.from({ length: 240 }, (_, index) => {
  const isSharedWithNative = index < 180;
  const engineId = pagedProviderIds[index % pagedProviderIds.length];
  return buildProjectionSummary({
    id: isSharedWithNative
      ? `paged-projection-shared-${index}`
      : `paged-projection-only-${index}`,
    engineId,
    modelId: `${engineId}-model`,
    nativeSessionId: isSharedWithNative
      ? `paged-shared-${index}`
      : `paged-projection-only-native-${index}`,
    title: isSharedWithNative
      ? `Paged shared projection ${index}`
      : `Paged projection only ${index}`,
    updatedAt: new Date(pagedBaseTimestamp + index).toISOString(),
    lastTurnAt: new Date(pagedBaseTimestamp + index).toISOString(),
    sortTimestamp: String(pagedBaseTimestamp + index),
    transcriptUpdatedAt: new Date(pagedBaseTimestamp + index).toISOString(),
  });
});
const pagedSharedNativeSummaries = Array.from({ length: 180 }, (_, index) => {
  const engineId = pagedProviderIds[index % pagedProviderIds.length];
  const activityTimestamp = pagedBaseTimestamp + 10_000 + index;
  return buildNativeSummary({
    id: `${engineId}-native:paged-shared-${index}`,
    engineId,
    modelId: `${engineId}-model`,
    nativeSessionId: `paged-shared-${index}`,
    title: `Paged shared native ${index}`,
    updatedAt: new Date(activityTimestamp).toISOString(),
    lastTurnAt: new Date(activityTimestamp).toISOString(),
    sortTimestamp: String(activityTimestamp),
    transcriptUpdatedAt: new Date(activityTimestamp).toISOString(),
  });
});
const pagedNativeOnlySummaries = Array.from({ length: 60 }, (_, index) => {
  const engineId = index === 0
    ? 'codex'
    : index === 1
      ? 'gemini'
      : pagedProviderIds[(index + 1) % pagedProviderIds.length];
  const activityTimestamp = pagedBaseTimestamp + 20_000 + index;
  const crossProviderNativeId = index < 2
    ? 'same-native-id-across-providers'
    : `paged-native-only-${index}`;
  return buildNativeSummary({
    id: `${engineId}-native:${crossProviderNativeId}`,
    engineId,
    modelId: `${engineId}-model`,
    nativeSessionId: crossProviderNativeId,
    title: `Paged native only ${index}`,
    updatedAt: new Date(activityTimestamp).toISOString(),
    lastTurnAt: new Date(activityTimestamp).toISOString(),
    sortTimestamp: String(activityTimestamp),
    transcriptUpdatedAt: new Date(activityTimestamp).toISOString(),
  });
});
const pagedNativeSummaries = [
  ...pagedSharedNativeSummaries.slice(100),
  ...pagedNativeOnlySummaries,
  ...pagedSharedNativeSummaries.slice(0, 100),
];
const projectionPageRequests: Array<{ limit?: number; offset?: number }> = [];
const nativePageRequests: Array<{ limit?: number; offset?: number }> = [];
const buildRuntimePage = <T,>(
  items: readonly T[],
  request: { limit?: number; offset?: number } | undefined,
) => {
  const limit = request?.limit ?? 20;
  const offset = request?.offset ?? 0;
  const pageItems = items.slice(offset, offset + limit);
  return {
    items: pageItems,
    pageInfo: {
      hasMore: offset + pageItems.length < items.length,
    },
  };
};
const pagedUpserts: BirdCoderCodingSession[] = [];
const pagedSync = await synchronizeProjectSessionsFromAuthority({
  appRuntimeReadService: {
    async listCodingSessions() {
      throw new Error('paged authority synchronization must use listCodingSessionPage');
    },
    async listCodingSessionPage(request) {
      assert.equal(request?.workspaceId, workspaceId);
      assert.equal(request?.projectId, projectId);
      assert.equal(request?.runtimeLocationId, runtimeLocationId);
      projectionPageRequests.push({ limit: request?.limit, offset: request?.offset });
      return buildRuntimePage(pagedProjectionSummaries, request);
    },
    async listNativeSessions() {
      throw new Error('paged authority synchronization must use listNativeSessionPage');
    },
    async listNativeSessionPage(request) {
      assert.equal(request?.workspaceId, workspaceId);
      assert.equal(request?.projectId, projectId);
      assert.equal(request?.runtimeLocationId, runtimeLocationId);
      nativePageRequests.push({ limit: request?.limit, offset: request?.offset });
      return buildRuntimePage(pagedNativeSummaries, request);
    },
  },
  project: {
    ...project,
    codingSessions: [],
  },
  projectService: {
    async upsertCodingSession(_projectId: string, codingSession: BirdCoderCodingSession) {
      pagedUpserts.push(codingSession);
    },
  } as IProjectService,
  runtimeLocationId,
  sessionLimit: 300,
});

assert.deepEqual(
  projectionPageRequests,
  [
    { limit: 200, offset: 0 },
    { limit: 200, offset: 200 },
  ],
  'projection inventory must continue beyond the first 200-session authority page.',
);
assert.deepEqual(
  nativePageRequests,
  [
    { limit: 200, offset: 0 },
    { limit: 200, offset: 200 },
  ],
  'native provider inventory must continue beyond the first 200-session authority page.',
);
assert.equal(
  pagedSync.project.codingSessions.length,
  300,
  'cross-page projection and native inventories must merge into the complete 300-session project list.',
);
assert.equal(pagedSync.loadedSessionCount, 300);
assert.equal(pagedSync.hasMoreSessions, false);
assert.equal(pagedUpserts.length, 300);
assert.equal(
  pagedSync.project.codingSessions.filter((session) =>
    session.nativeSessionId?.startsWith('paged-shared-'),
  ).length,
  180,
  'projection/native snapshots for the same provider session must deduplicate even when they land on different source pages.',
);
assert.deepEqual(
  new Set(pagedSync.project.codingSessions.map((session) => session.engineId)),
  new Set(pagedProviderIds),
  'the complete project inventory must retain Codex, Claude Code, Gemini, and OpenCode sessions.',
);
assert.equal(
  pagedSync.project.codingSessions.filter(
    (session) => session.nativeSessionId === 'same-native-id-across-providers',
  ).length,
  2,
  'equal native ids owned by different providers must remain separate sessions.',
);
assert.deepEqual(
  pagedSync.project.codingSessions
    .filter((session) => session.nativeSessionId === 'same-native-id-across-providers')
    .map((session) => session.id)
    .sort(),
  [
    'codex-native:same-native-id-across-providers',
    'gemini-native:same-native-id-across-providers',
  ],
  'every member of a cross-provider id collision must receive a stable provider-scoped id independent of activity order.',
);
assert.equal(
  new Set(pagedSync.project.codingSessions.map((session) => session.id)).size,
  pagedSync.project.codingSessions.length,
  'provider-scoped native sessions must retain unique unified session ids for stable IDE row identity.',
);

const stagedNativeProject = {
  ...project,
  codingSessions: [],
};
const stagedNativeSession = buildNativeSummary({
  engineId: 'codex',
  id: 'codex-native:stable-cross-page-id',
  nativeSessionId: 'codex-native:stable-cross-page-id',
  projectId,
  workspaceId,
});
const firstStagedSync = await synchronizeProjectSessionsFromAuthority({
  appRuntimeReadService: {
    async listCodingSessions() {
      return [];
    },
    async listNativeSessions() {
      return [stagedNativeSession];
    },
  } as never,
  project: stagedNativeProject,
  projectService: {
    async upsertCodingSession() {},
  } as IProjectService,
  runtimeLocationId,
});
const firstStagedId = firstStagedSync.project.codingSessions[0]?.id;
assert.equal(
  firstStagedId,
  'codex-native:stable-cross-page-id',
  'a native-only session must receive its provider-scoped id on the first page.',
);
const secondStagedSync = await synchronizeProjectSessionsFromAuthority({
  appRuntimeReadService: {
    async listCodingSessions() {
      return [];
    },
    async listNativeSessions() {
      return [
        stagedNativeSession,
        buildNativeSummary({
          engineId: 'gemini',
          id: 'gemini-native:stable-cross-page-id',
          nativeSessionId: 'gemini-native:stable-cross-page-id',
          projectId,
          workspaceId,
        }),
      ];
    },
  } as never,
  project: firstStagedSync.project,
  projectService: {
    async upsertCodingSession() {},
  } as IProjectService,
  runtimeLocationId,
});
assert.equal(
  secondStagedSync.project.codingSessions.find((session) => session.engineId === 'codex')?.id,
  firstStagedId,
  'adding a same-raw-id session from another provider must not rename an already loaded row.',
);
assert.equal(
  secondStagedSync.project.codingSessions.find((session) => session.engineId === 'gemini')?.id,
  'gemini-native:stable-cross-page-id',
);

for (let index = 1; index < pagedSync.project.codingSessions.length; index += 1) {
  const previous = pagedSync.project.codingSessions[index - 1];
  const current = pagedSync.project.codingSessions[index];
  assert.ok(previous && current);
  assert.ok(
    BigInt(previous.sortTimestamp ?? '0') >= BigInt(current.sortTimestamp ?? '0'),
    'the fully merged cross-provider inventory must remain sorted by latest activity.',
  );
}

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
assert.equal(
  batchProjectionReads,
  2,
  'project-list synchronization must issue one scoped projection read per project.',
);
assert.equal(
  batchNativeReads,
  0,
  'project-list synchronization must remain projection-only until a trusted runtime-location id is explicitly supplied for each project.',
);
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
