import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {
  BirdCoderCodingSession,
  BirdCoderCodingSessionSummary,
  BirdCoderProject,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  synchronizeProjectSessionsFromAuthority,
  synchronizeProjectsSessionsFromAuthority,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/projectSessionSynchronization.ts';
import type { IProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/services/interfaces/IProjectService.ts';

const sessionInventorySource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/sessionInventory.ts',
    import.meta.url,
  ),
  'utf8',
);
assert.doesNotMatch(
  sessionInventorySource,
  /import\('\.\.\/terminal\/sessions\.ts'\)/,
  'Session authority must not dynamically import a module already owned by the workbench package.',
);

const workspaceId = 'workspace-session-authority-sync';
const projectId = 'project-session-authority-sync';
const runtimeLocationId = 'runtime-location-session-authority-sync';
const baseTimestamp = Date.parse('2026-07-15T00:00:00.000Z');
const providerIds = ['codex', 'claude-code', 'gemini', 'opencode'] as const;

function iso(offsetMinutes: number): string {
  return new Date(baseTimestamp + offsetMinutes * 60_000).toISOString();
}

function buildSession(
  overrides: Partial<BirdCoderCodingSession> = {},
): BirdCoderCodingSession {
  return {
    id: 'birdcoder-codex-session',
    workspaceId,
    projectId,
    title: 'Codex persisted session',
    status: 'active',
    hostMode: 'desktop',
    engineId: 'codex',
    modelId: 'gpt-5.4',
    nativeSessionId: 'codex-provider-session',
    runtimeLocationId,
    runtimeStatus: 'completed',
    createdAt: iso(0),
    updatedAt: iso(1),
    lastTurnAt: iso(1),
    sortTimestamp: String(Date.parse(iso(1))),
    transcriptUpdatedAt: iso(1),
    messages: [],
    ...overrides,
  };
}

function toSummary(session: BirdCoderCodingSession): BirdCoderCodingSessionSummary {
  const { messages: _messages, ...summary } = session;
  return summary;
}

const existingSession = buildSession({
  messages: [{
    id: 'persisted-message',
    codingSessionId: 'birdcoder-codex-session',
    role: 'user',
    content: 'preserve me',
    createdAt: iso(1),
    timestamp: Date.parse(iso(1)),
  }],
});
const localNewerSession = buildSession({
  id: 'birdcoder-local-newer-session',
  nativeSessionId: 'local-newer-provider-session',
  title: 'Local newer title',
  runtimeStatus: 'streaming',
  updatedAt: iso(8),
  lastTurnAt: iso(8),
  sortTimestamp: String(Date.parse(iso(8))),
  transcriptUpdatedAt: iso(8),
});
const project: BirdCoderProject = {
  id: projectId,
  workspaceId,
  name: 'Session authority sync',
  createdAt: iso(0),
  updatedAt: iso(1),
  codingSessions: [existingSession, localNewerSession],
};

const unifiedSummaries: BirdCoderCodingSessionSummary[] = [
  toSummary(buildSession({
    updatedAt: iso(2),
    lastTurnAt: iso(2),
    sortTimestamp: String(Date.parse(iso(2))),
    transcriptUpdatedAt: iso(2),
  })),
  toSummary(buildSession({
    id: localNewerSession.id,
    nativeSessionId: localNewerSession.nativeSessionId,
    title: 'Stale authority title',
    updatedAt: iso(4),
    lastTurnAt: iso(4),
    sortTimestamp: String(Date.parse(iso(4))),
    transcriptUpdatedAt: iso(4),
  })),
  ...providerIds.slice(1).map((engineId, index) => toSummary(buildSession({
    id: `birdcoder-${engineId}-session`,
    engineId,
    modelId: `${engineId}-model`,
    nativeSessionId: `${engineId}-provider-session`,
    title: `${engineId} discovered history`,
    updatedAt: iso(5 + index),
    lastTurnAt: iso(5 + index),
    sortTimestamp: String(Date.parse(iso(5 + index))),
    transcriptUpdatedAt: iso(5 + index),
  }))),
];

const pageRequests: Array<{ limit?: number; offset?: number }> = [];
const appRuntimeReadService = {
  async listCodingSessions() {
    throw new Error('Synchronization must use the authoritative page method.');
  },
  async listCodingSessionPage(request: {
    limit?: number;
    offset?: number;
    projectId?: string;
    runtimeLocationId?: string;
    workspaceId?: string;
  }) {
    assert.equal(request.workspaceId, workspaceId);
    assert.equal(request.projectId, projectId);
    assert.equal(request.runtimeLocationId, runtimeLocationId);
    pageRequests.push({ limit: request.limit, offset: request.offset });
    return {
      items: unifiedSummaries,
      pageInfo: { hasMore: false },
    };
  },
};
const upserts: BirdCoderCodingSession[] = [];
const projectService = {
  async upsertCodingSession(_projectId: string, codingSession: BirdCoderCodingSession) {
    upserts.push(codingSession);
  },
} as IProjectService;

const firstSync = await synchronizeProjectSessionsFromAuthority({
  appRuntimeReadService,
  project,
  projectService,
  runtimeLocationId,
  sessionLimit: 10,
});

assert.deepEqual(pageRequests, [{ limit: 10, offset: 0 }]);
assert.equal(firstSync.project.codingSessions.length, 5);
assert.deepEqual(
  new Set(firstSync.project.codingSessions.map((session) => session.engineId)),
  new Set(providerIds),
  'One unified authority page must materialize Codex, Claude Code, Gemini, and OpenCode rows.',
);
assert.deepEqual(
  firstSync.project.codingSessions.map((session) => session.id).sort(),
  [
    'birdcoder-claude-code-session',
    'birdcoder-codex-session',
    'birdcoder-gemini-session',
    'birdcoder-local-newer-session',
    'birdcoder-opencode-session',
  ],
  'Synchronization must preserve persistent BirdCoder logical ids.',
);
assert.equal(
  firstSync.project.codingSessions.find((session) => session.id === existingSession.id)
    ?.messages[0]?.content,
  'preserve me',
  'Refreshing summaries must preserve already hydrated transcript messages.',
);
assert.equal(
  firstSync.project.codingSessions.find((session) => session.id === localNewerSession.id)?.title,
  'Local newer title',
  'An older authority snapshot must not replace newer local activity.',
);

upserts.length = 0;
pageRequests.length = 0;
const secondSync = await synchronizeProjectSessionsFromAuthority({
  appRuntimeReadService,
  project: firstSync.project,
  projectService,
  runtimeLocationId,
  sessionLimit: 10,
});
assert.equal(upserts.length, 0, 'Repeating an unchanged synchronization must be idempotent.');
assert.deepEqual(
  secondSync.project.codingSessions.map((session) => session.id),
  firstSync.project.codingSessions.map((session) => session.id),
);

const pagedSummaries = Array.from({ length: 240 }, (_, index) => {
  const engineId = providerIds[index % providerIds.length];
  const nativeSessionId = index < 2 ? 'cross-provider-id' : `provider-${index}`;
  return toSummary(buildSession({
    id: `birdcoder-paged-session-${index}`,
    engineId,
    modelId: `${engineId}-model`,
    nativeSessionId,
    title: `Paged ${engineId} session ${index}`,
    updatedAt: new Date(baseTimestamp + index).toISOString(),
    lastTurnAt: new Date(baseTimestamp + index).toISOString(),
    sortTimestamp: String(baseTimestamp + index),
    transcriptUpdatedAt: new Date(baseTimestamp + index).toISOString(),
  }));
});
const paginationRequests: Array<{ limit?: number; offset?: number }> = [];
const pagedSync = await synchronizeProjectSessionsFromAuthority({
  appRuntimeReadService: {
    async listCodingSessions() {
      throw new Error('Paged synchronization must use listCodingSessionPage.');
    },
    async listCodingSessionPage(request) {
      paginationRequests.push({ limit: request?.limit, offset: request?.offset });
      const limit = request?.limit ?? 20;
      const offset = request?.offset ?? 0;
      const items = pagedSummaries.slice(offset, offset + limit);
      return {
        items,
        pageInfo: { hasMore: offset + items.length < pagedSummaries.length },
      };
    },
  },
  project: { ...project, codingSessions: [] },
  projectService: {
    async upsertCodingSession() {},
  } as IProjectService,
  runtimeLocationId,
  sessionLimit: 240,
});

assert.deepEqual(paginationRequests, [
  { limit: 200, offset: 0 },
  { limit: 200, offset: 200 },
]);
assert.equal(pagedSync.project.codingSessions.length, 240);
assert.equal(new Set(pagedSync.project.codingSessions.map((session) => session.id)).size, 240);
assert.equal(
  pagedSync.project.codingSessions.filter(
    (session) => session.nativeSessionId === 'cross-provider-id',
  ).length,
  2,
  'The same provider id under different engines must remain two logical sessions.',
);

let batchReads = 0;
const secondProjectId = 'project-session-authority-sync-2';
const batchProjects = await synchronizeProjectsSessionsFromAuthority({
  appRuntimeReadService: {
    async listCodingSessions(request) {
      batchReads += 1;
      return [toSummary(buildSession({
        id: `batch-${request?.projectId}`,
        projectId: request?.projectId,
      }))];
    },
  },
  projects: [
    { ...project, codingSessions: [] },
    { ...project, id: secondProjectId, codingSessions: [] },
  ],
  projectService: {
    async upsertCodingSession() {},
  } as IProjectService,
  workspaceId,
});
assert.equal(batchReads, 2);
assert.equal(batchProjects[0]?.codingSessions[0]?.id, `batch-${projectId}`);
assert.equal(batchProjects[1]?.codingSessions[0]?.id, `batch-${secondProjectId}`);

console.log('project session unified authority synchronization contract passed.');
