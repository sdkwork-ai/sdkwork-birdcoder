import assert from 'node:assert/strict';

import type { AgentSessionView, BirdCoderProject } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts';
import type { IAgentSessionService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IAgentSessionService.ts';
import type { IProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/services/interfaces/IProjectService.ts';
import type { AgentSessionRecord } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/services/agentSessionViewModels.ts';
import {
  refreshAgentSessionItems,
  refreshProjectSessions,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/sessionRefresh.ts';

const workspaceId = '2001';
const birdCoderProjectId = '3001';
const agentProjectId = 'project.refresh-timeout';
const agentSessionId = 'session.refresh-timeout';
const timestamp = '2026-07-23T08:00:00.000Z';
const never = new Promise<never>(() => undefined);

function buildSessionRecord(id = agentSessionId): AgentSessionRecord {
  return {
    agentId: 'agent.birdcoder',
    createdAt: timestamp,
    createdBy: '4001',
    entrySurface: 'pc',
    itemCount: '0',
    lastItemAt: timestamp,
    lastItemSequence: '0',
    organizationId: '5001',
    ownerUserId: '4001',
    projectId: agentProjectId,
    sessionId: id,
    sessionKind: 'coding',
    status: 'active',
    tenantId: '6001',
    title: 'Refresh timeout session',
    totalInputTokens: '0',
    totalOutputTokens: '0',
    updatedAt: timestamp,
    updatedBy: '4001',
    version: '1',
  };
}

function buildSessionView(id = agentSessionId): AgentSessionView {
  return {
    agentProjectId,
    archived: false,
    birdCoderProjectId,
    createdAt: timestamp,
    displayTime: 'Just now',
    engineId: 'codex',
    hostMode: 'desktop',
    id,
    items: [],
    lastTurnAt: timestamp,
    modelId: 'gpt-5.4',
    pinned: false,
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

function buildProject(session = buildSessionView()): BirdCoderProject {
  return {
    agentSessions: [session],
    archived: false,
    createdAt: timestamp,
    defaultAgentProjectId: agentProjectId,
    id: birdCoderProjectId,
    name: 'Refresh Timeout Project',
    updatedAt: timestamp,
    workspaceId,
  };
}

function buildAgentSessionService(
  session: AgentSessionRecord,
  overrides: Partial<IAgentSessionService> = {},
): IAgentSessionService {
  return {
    async getSession() {
      return session;
    },
    async listRuntimeBindings() {
      return {
        items: [],
        pageInfo: { hasMore: false, mode: 'offset', page: 1, pageSize: 20 },
      };
    },
    async listSessionItems() {
      return {
        items: [],
        pageInfo: { hasMore: false, mode: 'offset', page: 1, pageSize: 200 },
      };
    },
    async listSessions() {
      return {
        items: [session],
        pageInfo: { hasMore: false, mode: 'offset', page: 1, pageSize: 200 },
      };
    },
    ...overrides,
  } as IAgentSessionService;
}

function buildProjectService(
  project: BirdCoderProject,
  overrides: Partial<IProjectService> = {},
): IProjectService {
  return {
    async getProjectById(projectId: string) {
      return projectId === project.id ? project : null;
    },
    ...overrides,
  } as IProjectService;
}

async function assertRejectsWithin(
  promise: Promise<unknown>,
  expectedMessage: RegExp,
  label: string,
): Promise<void> {
  let guardHandle: ReturnType<typeof setTimeout> | undefined;
  const outcome = await Promise.race([
    promise.then(
      (value) => ({ status: 'resolved' as const, value }),
      (error: unknown) => ({ status: 'rejected' as const, error }),
    ),
    new Promise<{ status: 'hung' }>((resolve) => {
      guardHandle = setTimeout(() => resolve({ status: 'hung' }), 150);
    }),
  ]);
  if (guardHandle !== undefined) clearTimeout(guardHandle);
  if (outcome.status === 'resolved') assert.fail(`${label} should reject.`);
  if (outcome.status === 'hung') assert.fail(`${label} did not settle within the guard window.`);
  assert.match(
    outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
    expectedMessage,
    label,
  );
}

const sessionRecord = buildSessionRecord();
const sessionView = buildSessionView();
const project = buildProject(sessionView);

let projectReadShouldHang = true;
let projectReadCount = 0;
const projectService = buildProjectService(project, {
  async getProjectById(projectId: string) {
    projectReadCount += 1;
    if (projectReadShouldHang) return never;
    return projectId === project.id ? project : null;
  },
});
await assertRejectsWithin(
  refreshProjectSessions({
    agentSessionService: buildAgentSessionService(sessionRecord),
    projectId: birdCoderProjectId,
    projectService,
    refreshTimeoutMs: 10,
    workspaceId,
  }),
  /Refreshing Agents project sessions timed out after 10 ms/,
  'Project session refresh',
);
projectReadShouldHang = false;
const projectRetry = await refreshProjectSessions({
  agentSessionService: buildAgentSessionService(sessionRecord),
  projectId: birdCoderProjectId,
  projectService,
  refreshTimeoutMs: 100,
  workspaceId,
});
assert.equal(projectRetry.status, 'refreshed');
assert.equal(projectReadCount, 2, 'A retry must start fresh work after timeout.');

let sessionReadShouldHang = true;
let sessionReadCount = 0;
const sessionService = buildAgentSessionService(sessionRecord, {
  async getSession() {
    sessionReadCount += 1;
    if (sessionReadShouldHang) return never;
    return sessionRecord;
  },
});
await assertRejectsWithin(
  refreshAgentSessionItems({
    agentSessionId,
    agentSessionService: sessionService,
    refreshTimeoutMs: 10,
    resolvedLocation: { agentSession: sessionView, project },
    workspaceId,
  }),
  /Refreshing Agents session items timed out after 10 ms/,
  'Session item refresh',
);
sessionReadShouldHang = false;
const itemRetry = await refreshAgentSessionItems({
  agentSessionId,
  agentSessionService: sessionService,
  refreshTimeoutMs: 100,
  resolvedLocation: { agentSession: sessionView, project },
  workspaceId,
});
assert.equal(itemRetry.status, 'refreshed');
assert.equal(itemRetry.itemCount, 0);
assert.equal(itemRetry.agentSession?.birdCoderProjectId, birdCoderProjectId);
assert.equal(itemRetry.agentSession?.agentProjectId, agentProjectId);
assert.equal(sessionReadCount, 2, 'A retry must not reuse a timed-out request.');

console.log('session refresh timeout contract passed.');
