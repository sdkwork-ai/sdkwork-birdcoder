import assert from 'node:assert/strict';
import {
  refreshCodingSessionMessages,
  refreshProjectSessions,
} from '../packages/sdkwork-birdcoder-commons/src/workbench/sessionRefresh.ts';
import type {
  BirdCoderCodingSession,
  BirdCoderCodingSessionSummary,
  BirdCoderProject,
} from '../packages/sdkwork-birdcoder-types/src/index.ts';

type RefreshCodingSessionMessagesOptions = Parameters<typeof refreshCodingSessionMessages>[0];
type RefreshCoreReadService = NonNullable<RefreshCodingSessionMessagesOptions['coreReadService']>;
type RefreshProjectService = RefreshCodingSessionMessagesOptions['projectService'];

const workspaceId = 'workspace-refresh-timeout';
const projectId = 'project-refresh-timeout';
const codingSessionId = 'coding-session-refresh-timeout';
const timestamp = '2026-04-28T08:00:00.000Z';
const never = new Promise<never>(() => undefined);

function buildSession(id = codingSessionId): BirdCoderCodingSession {
  return {
    archived: false,
    createdAt: timestamp,
    displayTime: 'just now',
    engineId: 'codex',
    hostMode: 'desktop',
    id,
    lastTurnAt: timestamp,
    messages: [],
    modelId: 'gpt-5.4',
    pinned: false,
    projectId,
    runtimeStatus: 'streaming',
    sortTimestamp: String(Date.parse(timestamp)),
    status: 'active',
    title: 'Refresh timeout session',
    transcriptUpdatedAt: timestamp,
    unread: false,
    updatedAt: timestamp,
    workspaceId,
  };
}

function buildProject(session = buildSession()): BirdCoderProject {
  return {
    archived: false,
    codingSessions: [session],
    createdAt: timestamp,
    id: session.projectId,
    name: 'Refresh Timeout Project',
    path: 'D:/workspace/refresh-timeout',
    updatedAt: timestamp,
    workspaceId: session.workspaceId,
  };
}

function buildSummary(session = buildSession()): BirdCoderCodingSessionSummary {
  return {
    createdAt: session.createdAt,
    engineId: session.engineId,
    hostMode: session.hostMode,
    id: session.id,
    lastTurnAt: session.lastTurnAt,
    modelId: session.modelId,
    projectId: session.projectId,
    runtimeStatus: session.runtimeStatus,
    status: session.status,
    title: session.title,
    transcriptUpdatedAt: session.transcriptUpdatedAt,
    updatedAt: session.updatedAt,
    workspaceId: session.workspaceId,
  };
}

function unexpectedProjectServiceCall(method: string): never {
  throw new Error(`${method} should not be called by this contract`);
}

function buildProjectService(
  project: BirdCoderProject,
  overrides: Partial<RefreshProjectService> = {},
): RefreshProjectService {
  return {
    async getProjects() {
      return [project];
    },
    async getProjectById(candidateProjectId: string) {
      return candidateProjectId === project.id ? project : null;
    },
    async getProjectByPath() {
      return unexpectedProjectServiceCall('getProjectByPath');
    },
    async createProject() {
      return unexpectedProjectServiceCall('createProject');
    },
    async renameProject() {
      return unexpectedProjectServiceCall('renameProject');
    },
    async updateProject() {
      return unexpectedProjectServiceCall('updateProject');
    },
    async deleteProject() {
      return unexpectedProjectServiceCall('deleteProject');
    },
    async createCodingSession() {
      return unexpectedProjectServiceCall('createCodingSession');
    },
    async upsertCodingSession() {
      return undefined;
    },
    async renameCodingSession() {
      return unexpectedProjectServiceCall('renameCodingSession');
    },
    async updateCodingSession() {
      return unexpectedProjectServiceCall('updateCodingSession');
    },
    async forkCodingSession() {
      return unexpectedProjectServiceCall('forkCodingSession');
    },
    async deleteCodingSession() {
      return unexpectedProjectServiceCall('deleteCodingSession');
    },
    async addCodingSessionMessage() {
      return unexpectedProjectServiceCall('addCodingSessionMessage');
    },
    async editCodingSessionMessage() {
      return unexpectedProjectServiceCall('editCodingSessionMessage');
    },
    async deleteCodingSessionMessage() {
      return unexpectedProjectServiceCall('deleteCodingSessionMessage');
    },
    ...overrides,
  };
}

function buildCoreReadService(
  summary: BirdCoderCodingSessionSummary,
  overrides: Partial<RefreshCoreReadService> = {},
): RefreshCoreReadService {
  return {
    async getCodingSession() {
      return summary;
    },
    async getNativeSession() {
      throw new Error('native session detail should not be requested');
    },
    async listCodingSessionEvents() {
      return [];
    },
    async listCodingSessions() {
      return [summary];
    },
    async listNativeSessions() {
      return [];
    },
    ...overrides,
  };
}

async function assertRejectsWithin(
  promise: Promise<unknown>,
  expectedMessage: RegExp,
  label: string,
): Promise<void> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const outcome = await Promise.race([
    promise.then(
      (value) => ({ status: 'resolved' as const, value }),
      (error: unknown) => ({ status: 'rejected' as const, error }),
    ),
    new Promise<{ status: 'hung' }>((resolve) => {
      timeoutHandle = setTimeout(() => {
        resolve({ status: 'hung' });
      }, 150);
    }),
  ]);

  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }

  if (outcome.status === 'resolved') {
    assert.fail(`${label} should reject instead of resolving.`);
  }

  if (outcome.status === 'hung') {
    assert.fail(`${label} did not settle within the guard window.`);
  }

  assert.match(
    outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
    expectedMessage,
    label,
  );
}

const projectRefreshSession = buildSession('coding-session-project-refresh-timeout');
const projectRefreshProject = buildProject(projectRefreshSession);
let projectRefreshShouldHang = true;
let projectRefreshReads = 0;
const projectRefreshService = buildProjectService(projectRefreshProject, {
  async getProjects() {
    projectRefreshReads += 1;
    if (projectRefreshShouldHang) {
      return never;
    }

    return [projectRefreshProject];
  },
});

await assertRejectsWithin(
  refreshProjectSessions({
    identityScope: 'refresh-timeout-user',
    projectService: projectRefreshService,
    refreshTimeoutMs: 10,
    workspaceId,
  }),
  /Timed out refreshing project sessions/,
  'project session refresh must time out instead of keeping the sidebar refresh icon alive forever',
);

projectRefreshShouldHang = false;
const projectRetryResult = await refreshProjectSessions({
  identityScope: 'refresh-timeout-user',
  projectService: projectRefreshService,
  refreshTimeoutMs: 100,
  workspaceId,
});
assert.equal(
  projectRetryResult.status,
  'refreshed',
  'project session refresh must allow a clean retry after the previous in-flight task timed out.',
);
assert.equal(
  projectRefreshReads,
  2,
  'project session refresh must not reuse a timed-out in-flight task on retry.',
);

const locationSession = buildSession('coding-session-location-timeout');
const locationProject = buildProject(locationSession);
const locationSummary = buildSummary(locationSession);
await assertRejectsWithin(
  refreshCodingSessionMessages({
    codingSessionId: locationSession.id,
    coreReadService: buildCoreReadService(locationSummary, {
      async getCodingSession() {
        return never;
      },
    }),
    identityScope: 'location-timeout-user',
    projectService: buildProjectService(locationProject),
    refreshTimeoutMs: 10,
    workspaceId,
  }),
  /Timed out resolving coding session location/,
  'coding-session location resolution must time out before selected-session hydration can stay loading forever',
);

const messageSession = buildSession('coding-session-message-timeout');
const messageProject = buildProject(messageSession);
const messageSummary = buildSummary(messageSession);
await assertRejectsWithin(
  refreshCodingSessionMessages({
    codingSessionId: messageSession.id,
    coreReadService: buildCoreReadService(messageSummary, {
      async listCodingSessionEvents() {
        return never;
      },
    }),
    identityScope: 'message-timeout-user',
    projectService: buildProjectService(messageProject),
    refreshTimeoutMs: 10,
    resolvedLocation: {
      codingSession: messageSession,
      project: messageProject,
      summary: messageSummary,
    },
    workspaceId,
  }),
  /Timed out refreshing coding session messages/,
  'coding-session message refresh must time out before manual refresh actions can stay stuck.',
);

let messageRefreshUpserts = 0;
const messageRetryResult = await refreshCodingSessionMessages({
  codingSessionId: messageSession.id,
  coreReadService: buildCoreReadService(messageSummary),
  identityScope: 'message-timeout-user',
  projectService: buildProjectService(messageProject, {
    async upsertCodingSession() {
      messageRefreshUpserts += 1;
    },
  }),
  refreshTimeoutMs: 100,
  resolvedLocation: {
    codingSession: messageSession,
    project: messageProject,
    summary: messageSummary,
  },
  workspaceId,
});
assert.equal(
  messageRetryResult.status,
  'refreshed',
  'coding-session message refresh must allow a clean retry after the previous in-flight task timed out.',
);
assert.equal(
  messageRefreshUpserts,
  1,
  'coding-session message refresh retry must execute fresh synchronization work after timeout cleanup.',
);

console.log('session refresh timeout contract passed.');
