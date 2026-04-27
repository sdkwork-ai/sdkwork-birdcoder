import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { refreshCodingSessionMessages } from '../packages/sdkwork-birdcoder-commons/src/workbench/sessionRefresh.ts';
import type {
  BirdCoderCodingSession,
  BirdCoderCodingSessionSummary,
  BirdCoderProject,
} from '../packages/sdkwork-birdcoder-types/src/index.ts';

const rootDir = process.cwd();
const selectedMessagesHookSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-commons',
    'src',
    'hooks',
    'useSelectedCodingSessionMessages.ts',
  ),
  'utf8',
);
const sessionRefreshSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-commons',
    'src',
    'workbench',
    'sessionRefresh.ts',
  ),
  'utf8',
);
const sessionRefreshActionsSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-commons',
    'src',
    'hooks',
    'useSessionRefreshActions.ts',
  ),
  'utf8',
);

type RefreshCodingSessionMessagesOptions = Parameters<typeof refreshCodingSessionMessages>[0];
type RefreshCoreReadService = NonNullable<RefreshCodingSessionMessagesOptions['coreReadService']>;
type RefreshProjectService = RefreshCodingSessionMessagesOptions['projectService'];

const workspaceId = 'workspace-shared';
const projectId = 'project-shared';
const codingSessionId = 'coding-session-shared';
const timestamp = '2026-04-25T00:00:00.000Z';

function unexpectedProjectServiceCall(method: string): never {
  throw new Error(`${method} should not be called by this contract`);
}

function buildSession(title: string): BirdCoderCodingSession {
  return {
    archived: false,
    createdAt: timestamp,
    displayTime: 'just now',
    engineId: 'codex',
    hostMode: 'desktop',
    id: codingSessionId,
    lastTurnAt: timestamp,
    messages: [],
    modelId: 'gpt-5.4',
    pinned: false,
    projectId,
    runtimeStatus: 'streaming',
    sortTimestamp: String(Date.parse(timestamp)),
    status: 'active',
    title,
    transcriptUpdatedAt: timestamp,
    unread: false,
    updatedAt: timestamp,
    workspaceId,
  };
}

function buildProject(session: BirdCoderCodingSession): BirdCoderProject {
  return {
    archived: false,
    codingSessions: [session],
    createdAt: timestamp,
    id: session.projectId,
    name: `${session.title} project`,
    path: `D:/workspace/${session.title.replace(/\s+/g, '-').toLowerCase()}`,
    updatedAt: timestamp,
    workspaceId: session.workspaceId,
  };
}

function buildSummary(session: BirdCoderCodingSession): BirdCoderCodingSessionSummary {
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

function buildProjectService(
  project: BirdCoderProject,
  onUpsert: () => void,
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
      onUpsert();
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
  };
}

function buildCoreReadService(
  summary: BirdCoderCodingSessionSummary,
  onListEvents: () => Promise<void> | void,
): RefreshCoreReadService {
  return {
    async getCodingSession() {
      return summary;
    },
    async getNativeSession() {
      throw new Error('native session detail should not be requested');
    },
    async listCodingSessionEvents() {
      await onListEvents();
      return [];
    },
    async listCodingSessions() {
      return [summary];
    },
    async listNativeSessions() {
      return [];
    },
  };
}

assert.match(
  selectedMessagesHookSource,
  /function buildSynchronizationScopeKey\(\s*userScope: string,/,
  'Selected session synchronization scope must include the authenticated user scope before workspace, project, and session ids.',
);
assert.match(
  selectedMessagesHookSource,
  /const synchronizationScopeKey = buildSynchronizationScopeKey\(\s*normalizedUserScope,/,
  'Selected session synchronization must pass the current authenticated user scope into its dedupe key.',
);
assert.match(
  selectedMessagesHookSource,
  /refreshCodingSessionMessages\(\{[\s\S]*identityScope: normalizedUserScope,/,
  'Automatic selected-session message refresh must pass the authenticated user scope into the shared refresh guard.',
);
assert.match(
  sessionRefreshActionsSource,
  /refreshProjectSessions\(\{[\s\S]*identityScope: normalizedUserScope,/,
  'Manual project session refresh must pass the authenticated user scope into the shared refresh guard.',
);
assert.match(
  sessionRefreshActionsSource,
  /refreshCodingSessionMessages\(\{[\s\S]*identityScope: normalizedUserScope,/,
  'Manual coding-session message refresh must pass the authenticated user scope into the shared refresh guard.',
);
assert.match(
  sessionRefreshSource,
  /identityScope\?: string;/,
  'Session refresh options must expose an optional identity scope for authenticated-user isolation.',
);
assert.match(
  sessionRefreshSource,
  /function normalizeRefreshIdentityScope\(identityScope: string \| null \| undefined\): string \{/,
  'Session refresh must normalize refresh identity scopes through one canonical helper.',
);
assert.match(
  sessionRefreshSource,
  /`session:\$\{refreshIdentityScope\}:\$\{guardWorkspaceId\}:\$\{guardProjectId\}:\$\{normalizedCodingSessionId\}`/,
  'Coding-session refresh in-flight keys must include the authenticated identity, workspace, and project scopes.',
);
assert.match(
  sessionRefreshSource,
  /`project:\$\{refreshIdentityScope\}:\$\{normalizedWorkspaceId\}:\$\{normalizedProjectId \|\| '\*'\}`/,
  'Project session refresh in-flight keys must include the authenticated identity scope.',
);

const oldUserSession = buildSession('Old user session');
const newUserSession = buildSession('New user session');
const oldUserProject = buildProject(oldUserSession);
const newUserProject = buildProject(newUserSession);
const oldUserSummary = buildSummary(oldUserSession);
const newUserSummary = buildSummary(newUserSession);

let releaseOldUserEvents!: () => void;
const oldUserEventsGate = new Promise<void>((resolve) => {
  releaseOldUserEvents = resolve;
});
let oldUserEventReads = 0;
let newUserEventReads = 0;
let oldUserUpserts = 0;
let newUserUpserts = 0;

const oldUserRefresh = refreshCodingSessionMessages({
  codingSessionId,
  coreReadService: buildCoreReadService(oldUserSummary, async () => {
    oldUserEventReads += 1;
    await oldUserEventsGate;
  }),
  identityScope: 'old-user',
  projectService: buildProjectService(oldUserProject, () => {
    oldUserUpserts += 1;
  }),
  resolvedLocation: {
    codingSession: oldUserSession,
    project: oldUserProject,
    summary: oldUserSummary,
  },
  workspaceId,
});

await Promise.resolve();

const newUserRefresh = refreshCodingSessionMessages({
  codingSessionId,
  coreReadService: buildCoreReadService(newUserSummary, () => {
    newUserEventReads += 1;
  }),
  identityScope: 'new-user',
  projectService: buildProjectService(newUserProject, () => {
    newUserUpserts += 1;
  }),
  resolvedLocation: {
    codingSession: newUserSession,
    project: newUserProject,
    summary: newUserSummary,
  },
  workspaceId,
});

releaseOldUserEvents();
const [oldUserResult, newUserResult] = await Promise.all([
  oldUserRefresh,
  newUserRefresh,
]);

assert.equal(oldUserResult.status, 'refreshed');
assert.equal(newUserResult.status, 'refreshed');
assert.equal(oldUserResult.codingSession?.title, 'Old user session');
assert.equal(newUserResult.codingSession?.title, 'New user session');
assert.equal(oldUserEventReads, 1);
assert.equal(newUserEventReads, 1);
assert.equal(oldUserUpserts, 1);
assert.equal(newUserUpserts, 1);

const workspaceASession = {
  ...buildSession('Workspace A session'),
  projectId: 'project-shared-workspace-a',
  workspaceId: 'workspace-shared-a',
};
const workspaceBSession = {
  ...buildSession('Workspace B session'),
  projectId: 'project-shared-workspace-b',
  workspaceId: 'workspace-shared-b',
};
const workspaceAProject = buildProject(workspaceASession);
const workspaceBProject = buildProject(workspaceBSession);
const workspaceASummary = buildSummary(workspaceASession);
const workspaceBSummary = buildSummary(workspaceBSession);

let releaseWorkspaceAEvents!: () => void;
const workspaceAEventsGate = new Promise<void>((resolve) => {
  releaseWorkspaceAEvents = resolve;
});
let workspaceAEventReads = 0;
let workspaceBEventReads = 0;
let workspaceAUpserts = 0;
let workspaceBUpserts = 0;

const workspaceARefresh = refreshCodingSessionMessages({
  codingSessionId,
  coreReadService: buildCoreReadService(workspaceASummary, async () => {
    workspaceAEventReads += 1;
    await workspaceAEventsGate;
  }),
  identityScope: 'shared-user',
  projectService: buildProjectService(workspaceAProject, () => {
    workspaceAUpserts += 1;
  }),
  resolvedLocation: {
    codingSession: workspaceASession,
    project: workspaceAProject,
    summary: workspaceASummary,
  },
  workspaceId: workspaceASession.workspaceId,
});

await Promise.resolve();

const workspaceBRefresh = refreshCodingSessionMessages({
  codingSessionId,
  coreReadService: buildCoreReadService(workspaceBSummary, () => {
    workspaceBEventReads += 1;
  }),
  identityScope: 'shared-user',
  projectService: buildProjectService(workspaceBProject, () => {
    workspaceBUpserts += 1;
  }),
  resolvedLocation: {
    codingSession: workspaceBSession,
    project: workspaceBProject,
    summary: workspaceBSummary,
  },
  workspaceId: workspaceBSession.workspaceId,
});

releaseWorkspaceAEvents();
const [workspaceAResult, workspaceBResult] = await Promise.all([
  workspaceARefresh,
  workspaceBRefresh,
]);

assert.equal(workspaceAResult.status, 'refreshed');
assert.equal(workspaceBResult.status, 'refreshed');
assert.equal(workspaceAResult.codingSession?.workspaceId, workspaceASession.workspaceId);
assert.equal(workspaceBResult.codingSession?.workspaceId, workspaceBSession.workspaceId);
assert.equal(workspaceAResult.codingSession?.projectId, workspaceASession.projectId);
assert.equal(workspaceBResult.codingSession?.projectId, workspaceBSession.projectId);
assert.equal(workspaceAResult.codingSession?.title, 'Workspace A session');
assert.equal(workspaceBResult.codingSession?.title, 'Workspace B session');
assert.equal(workspaceAEventReads, 1);
assert.equal(workspaceBEventReads, 1);
assert.equal(workspaceAUpserts, 1);
assert.equal(workspaceBUpserts, 1);

console.log('selected session user-scope refresh contract passed.');
