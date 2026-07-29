import assert from 'node:assert/strict';

import { BirdCoderAgentSessionService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/agentsSessionService.ts';

const createCalls: Array<[string, Record<string, unknown>]> = [];
type ListCall = [
  string,
  Record<string, unknown>,
  { signal?: AbortSignal; timeout?: number },
];

const agentListCalls: ListCall[] = [];
const projectListCalls: ListCall[] = [];
const sessionActivityListCalls: Array<[
  Record<string, unknown>,
  { signal?: AbortSignal; timeout?: number },
]> = [];
const workspaceListCalls: ListCall[] = [];
const runtimeBindingListCalls: Array<[string, string]> = [];
const runtimeBindingCreateCalls: Array<[string, string, Record<string, unknown>]> = [];
const runtimeBindingRetrieveCalls: Array<[string, string, string]> = [];
const sessionUserStateListCalls: ListCall[] = [];
const sessionRetrieveCalls: Array<[
  string,
  string,
  { signal?: AbortSignal; timeout?: number },
]> = [];
const codeEngineListCalls: Array<[{ signal?: AbortSignal; timeout?: number }]> = [];
const missingSessionUserStateIds = new Set<string>();
let runtimeBindingCreateError: Error | null = null;
let recoveredRuntimeBinding: Record<string, unknown> | null = null;
let createdSessionAgentIdOverride = '';
let createdSessionProjectIdOverride = '';

function sessionPage(scopeId: string) {
  return {
    items: [
      {
        sessionId: 'session.coding',
        projectId: scopeId,
        sessionKind: 'coding',
      },
      {
        sessionId: 'session.assistant',
        projectId: scopeId,
        sessionKind: 'assistant',
      },
    ],
    pageInfo: { mode: 'offset', page: 2, pageSize: 20, hasMore: false },
  };
}

const sessions = {
  async retrieve(
    agentId: string,
    sessionId: string,
    requestOptions: { signal?: AbortSignal; timeout?: number },
  ) {
    sessionRetrieveCalls.push([agentId, sessionId, requestOptions]);
    if (agentId !== 'agent.code-engine.codex' || sessionId !== 'session.recovery-target') {
      throw Object.assign(new Error('Resource lookup failed.'), { httpStatus: 404 });
    }
    return {
      agentId,
      sessionId,
      projectId: 'project.contract',
    };
  },
  async list(
    agentId: string,
    params: Record<string, unknown>,
    requestOptions: { signal?: AbortSignal; timeout?: number },
  ) {
    agentListCalls.push([agentId, params, requestOptions]);
    return sessionPage('project.agent-scope');
  },
};

const projectSessions = {
  async create(projectId: string, body: Record<string, unknown>) {
    createCalls.push([projectId, body]);
    return {
      ...body,
      agentId: createdSessionAgentIdOverride || body.agentId,
      sessionId: `session.project-route-${createCalls.length}`,
      projectId: createdSessionProjectIdOverride || projectId,
      itemCount: '0',
    };
  },
  async list(
    projectId: string,
    params: Record<string, unknown>,
    requestOptions: { signal?: AbortSignal; timeout?: number },
  ) {
    projectListCalls.push([projectId, params, requestOptions]);
    return sessionPage(projectId);
  },
};

const workspaceSessions = {
  async list(
    workspaceId: string,
    params: Record<string, unknown>,
    requestOptions: { signal?: AbortSignal; timeout?: number },
  ) {
    workspaceListCalls.push([workspaceId, params, requestOptions]);
    return sessionPage('project.workspace-scope');
  },
};
const client = {
  ai: {
    agents: {
      codeEngines: {
        async list(requestOptions: { signal?: AbortSignal; timeout?: number }) {
          codeEngineListCalls.push([requestOptions]);
          return {
            engines: [
              { agentId: 'agent.birdcoder', engineKey: 'birdcoder', bindingId: '', models: [] },
              {
                agentId: 'agent.code-engine.codex',
                engineKey: 'codex',
                bindingId: 'codex',
                models: [],
              },
            ],
          };
        },
      },
      projectSessions,
      sessionActivitySummaries: {
        async list(
          params: Record<string, unknown>,
          requestOptions: { signal?: AbortSignal; timeout?: number },
        ) {
          sessionActivityListCalls.push([params, requestOptions]);
          return {
            items: [{
              session: {
                agentId: 'agent.code-engine.codex',
                sessionId: 'session.activity-contract',
              },
            }],
            pageInfo: {
              mode: 'cursor',
              pageSize: params.pageSize,
              hasMore: false,
              nextCursor: null,
            },
          };
        },
      },
      sessionRuntimeBindings: {
        async create(
          agentId: string,
          sessionId: string,
          body: Record<string, unknown>,
        ) {
          runtimeBindingCreateCalls.push([agentId, sessionId, body]);
          if (runtimeBindingCreateError) {
            throw runtimeBindingCreateError;
          }
          return {
            ...body,
            sessionId,
            status: 'active',
            isCurrent: true,
          };
        },
        async list(agentId: string, sessionId: string) {
          runtimeBindingListCalls.push([agentId, sessionId]);
          return {
            items: [],
            pageInfo: { mode: 'offset', page: 1, pageSize: 20, hasMore: false },
          };
        },
        async retrieve(agentId: string, sessionId: string, runtimeBindingId: string) {
          runtimeBindingRetrieveCalls.push([agentId, sessionId, runtimeBindingId]);
          if (!recoveredRuntimeBinding) {
            throw new Error('Runtime Binding not found.');
          }
          return recoveredRuntimeBinding;
        },
      },
      sessionUserStates: {
        async list(
          agentId: string,
          params: Record<string, unknown>,
          requestOptions: { signal?: AbortSignal; timeout?: number },
        ) {
          sessionUserStateListCalls.push([agentId, params, requestOptions]);
          const sessionIds = String(params.sessionIds ?? '')
            .split(',')
            .filter(Boolean);
          return {
            items: sessionIds
              .filter((sessionId) => !missingSessionUserStateIds.has(sessionId))
              .map((sessionId) => ({
                resourceId: sessionId,
                resourceType: 'session',
                version: '0',
              })),
            pageInfo: {
              mode: 'offset',
              page: 1,
              pageSize: Number(params.pageSize),
              hasMore: false,
            },
          };
        },
      },
      sessions,
      workspaceSessions,
    },
  },
} as unknown as ConstructorParameters<typeof BirdCoderAgentSessionService>[0]['client'];
const service = new BirdCoderAgentSessionService({ client });

const created = await service.createSession({
  projectId: ' project.contract ',
  title: 'Project-scoped session',
});
assert.equal(created.projectId, 'project.contract');
assert.equal(createCalls.length, 1);
assert.equal(createCalls[0]?.[0], 'project.contract');
assert.equal(createCalls[0]?.[1].agentId, 'agent.birdcoder');
assert.equal('projectId' in (createCalls[0]?.[1] ?? {}), false);

const providerSession = await service.createSession({
  agentId: ' agent.code-engine.codex ',
  projectId: 'project.contract',
  title: 'Codex session',
});
const providerSessionIdentity = {
  agentId: providerSession.agentId,
  sessionId: providerSession.sessionId,
};
const createdSessionIdentity = {
  agentId: created.agentId,
  sessionId: created.sessionId,
};
await service.listRuntimeBindings(providerSessionIdentity);
assert.equal(createCalls[1]?.[1].agentId, 'agent.code-engine.codex');
assert.deepEqual(runtimeBindingListCalls[0], [
  'agent.code-engine.codex',
  providerSession.sessionId,
]);

const userStateAbortController = new AbortController();
const userStates = await service.getSessionUserStates([
  providerSessionIdentity,
  providerSessionIdentity,
  createdSessionIdentity,
], {
  signal: userStateAbortController.signal,
  timeoutMs: 2_000,
});
assert.equal(userStates.get(providerSession.sessionId)?.resourceId, providerSession.sessionId);
assert.equal(userStates.get(created.sessionId)?.resourceId, created.sessionId);
assert.deepEqual(sessionUserStateListCalls, [[
  'agent.code-engine.codex',
  {
    page: 1,
    pageSize: 1,
    includeHidden: true,
    sessionIds: providerSession.sessionId,
  },
  { signal: userStateAbortController.signal, timeout: 2_000 },
], [
  'agent.birdcoder',
  {
    page: 1,
    pageSize: 1,
    includeHidden: true,
    sessionIds: created.sessionId,
  },
  { signal: userStateAbortController.signal, timeout: 2_000 },
]]);

missingSessionUserStateIds.add(providerSession.sessionId);
const missingUserStates = await service.getSessionUserStates([providerSessionIdentity]);
assert.equal(missingUserStates.has(providerSession.sessionId), false);
missingSessionUserStateIds.clear();

createdSessionAgentIdOverride = 'agent.unexpected';
await assert.rejects(
  service.createSession({
    agentId: 'agent.code-engine.codex',
    projectId: 'project.contract',
  }),
  /instead of requested Agent "agent\.code-engine\.codex"/u,
);
createdSessionAgentIdOverride = '';
await service.listRuntimeBindings({
  agentId: 'agent.birdcoder',
  sessionId: 'session.project-route-3',
});
assert.deepEqual(runtimeBindingListCalls[1], [
  'agent.birdcoder',
  'session.project-route-3',
]);

createdSessionProjectIdOverride = 'project.unexpected';
await assert.rejects(
  service.createSession({
    agentId: 'agent.code-engine.codex',
    projectId: 'project.contract',
  }),
  /instead of requested Project "project\.contract"/u,
);
createdSessionProjectIdOverride = '';

const runtimeBindingInput = {
  hostMode: 'web',
  transportKind: 'sdk-stream',
  providerBindingId: 'binding.codex',
  modelId: 'gpt-5-codex',
  providerId: 'provider.openai',
  requestedAt: '2026-07-27T00:00:00.000Z',
};
const createdRuntimeBinding = await service.createRuntimeBinding(
  providerSessionIdentity,
  runtimeBindingInput,
);
assert.match(createdRuntimeBinding.runtimeBindingId, /^runtime_binding\.[0-9a-f-]+$/u);
assert.deepEqual(runtimeBindingCreateCalls[0]?.slice(0, 2), [
  'agent.code-engine.codex',
  providerSession.sessionId,
]);
assert.equal(
  runtimeBindingCreateCalls[0]?.[2].runtimeBindingId,
  createdRuntimeBinding.runtimeBindingId,
);

runtimeBindingCreateError = new Error('Runtime Binding response was lost.');
recoveredRuntimeBinding = {
  ...runtimeBindingInput,
  runtimeBindingId: 'runtime_binding.recovered-contract',
  sessionId: providerSession.sessionId,
  status: 'active',
  isCurrent: true,
};
const replayedRuntimeBinding = await service.createRuntimeBinding(
  providerSessionIdentity,
  {
    ...runtimeBindingInput,
    runtimeBindingId: 'runtime_binding.recovered-contract',
  },
);
assert.equal(replayedRuntimeBinding.runtimeBindingId, 'runtime_binding.recovered-contract');
assert.deepEqual(runtimeBindingRetrieveCalls[0], [
  'agent.code-engine.codex',
  providerSession.sessionId,
  'runtime_binding.recovered-contract',
]);

recoveredRuntimeBinding = {
  ...recoveredRuntimeBinding,
  modelId: 'different-model',
};
await assert.rejects(
  service.createRuntimeBinding(providerSessionIdentity, {
    ...runtimeBindingInput,
    runtimeBindingId: 'runtime_binding.recovered-contract',
  }),
  runtimeBindingCreateError,
);

const abortController = new AbortController();
const listed = await service.listSessions(
  { projectId: ' project.contract ', page: 2, pageSize: 20 },
  { signal: abortController.signal, timeoutMs: 3_000 },
);
assert.deepEqual(listed.items.map((session) => session.sessionId), [
  'session.coding',
  'session.assistant',
]);
assert.equal(projectListCalls.length, 1);
assert.equal(projectListCalls[0]?.[0], 'project.contract');
assert.deepEqual(projectListCalls[0]?.[1], {
  page: 2,
  pageSize: 20,
  includeArchived: undefined,
  status: undefined,
});
assert.equal(projectListCalls[0]?.[2].signal, abortController.signal);
assert.equal(projectListCalls[0]?.[2].timeout, 3_000);

await service.listSessionsByAgent({
  agentId: ' agent.custom ',
  projectId: ' project.agent-filter ',
  page: 3,
  pageSize: 50,
  status: 'idle',
  includeArchived: true,
});
assert.deepEqual(agentListCalls, [[
  'agent.custom',
  {
    page: 3,
    pageSize: 50,
    includeArchived: true,
    projectId: 'project.agent-filter',
    status: 'idle',
  },
  { signal: undefined, timeout: undefined },
]]);

await service.listSessionsByProject({
  projectId: ' project.explicit ',
  status: 'active',
  includeArchived: false,
});
assert.deepEqual(projectListCalls[1], [
  'project.explicit',
  {
    page: 1,
    pageSize: 20,
    includeArchived: false,
    status: 'active',
  },
  { signal: undefined, timeout: undefined },
]);

const workspacePage = await service.listSessionsByWorkspace({
  workspaceId: ' workspace.contract ',
  page: 4,
  pageSize: 100,
  status: 'archived',
  includeArchived: true,
});
assert.deepEqual(workspacePage.items.map((session) => session.sessionId), [
  'session.coding',
  'session.assistant',
]);
assert.deepEqual(workspaceListCalls, [[
  'workspace.contract',
  {
    page: 4,
    pageSize: 100,
    includeArchived: true,
    status: 'archived',
  },
  { signal: undefined, timeout: undefined },
]]);

const activityAbortController = new AbortController();
const activityPage = await service.listSessionActivitySummaries({
  agentId: ' agent.code-engine.codex ',
  cursor: ' cursor.activity ',
  pageSize: 200,
  projectId: ' project.contract ',
  workspaceId: ' workspace.contract ',
}, {
  signal: activityAbortController.signal,
  timeoutMs: 4_000,
});
assert.equal(activityPage.items[0]?.session.sessionId, 'session.activity-contract');
assert.deepEqual(sessionActivityListCalls, [[
  {
    agentId: 'agent.code-engine.codex',
    cursor: 'cursor.activity',
    pageSize: 200,
    projectId: 'project.contract',
    workspaceId: 'workspace.contract',
  },
  { signal: activityAbortController.signal, timeout: 4_000 },
]]);

await assert.rejects(
  service.listSessionActivitySummaries({ pageSize: 201 }),
  /page size must be between 1 and 200/u,
);
await assert.rejects(
  service.listSessionActivitySummaries({ workspaceId: ' ' }),
  /workspace ID must not be blank/u,
);

await assert.rejects(
  service.listSessions({ projectId: ' ' }),
  /project ID is required/u,
);
await assert.rejects(
  service.listSessionsByWorkspace({ workspaceId: ' ' }),
  /workspace ID is required/u,
);

sessionUserStateListCalls.length = 0;
const batchingService = new BirdCoderAgentSessionService({ client });
const batchedSessionIds = Array.from(
  { length: 101 },
  (_, index) => `session.user-state-batch-${index + 1}`,
);
const batchedUserStates = await batchingService.getSessionUserStates(
  batchedSessionIds.map((sessionId) => ({
    agentId: 'agent.birdcoder',
    sessionId,
  })),
);
assert.equal(batchedUserStates.size, 101);
assert.deepEqual(
  sessionUserStateListCalls.map(([agentId, params]) => ({
    agentId,
    pageSize: params.pageSize,
    sessionCount: String(params.sessionIds).split(',').length,
  })),
  [
    { agentId: 'agent.birdcoder', pageSize: 100, sessionCount: 100 },
    { agentId: 'agent.birdcoder', pageSize: 1, sessionCount: 1 },
  ],
);
await assert.rejects(
  batchingService.getSessionUserStates([
    { agentId: 'agent.birdcoder', sessionId: 'session.valid' },
    { agentId: 'agent.birdcoder', sessionId: ' ' },
  ]),
  /both Agent and Session identities/u,
);

const recoveryReadController = new AbortController();
const recoveryIdentity = {
  agentId: 'agent.code-engine.codex',
  sessionId: 'session.recovery-target',
};
const recoveredSession = await service.getSession(recoveryIdentity, {
  signal: recoveryReadController.signal,
  timeoutMs: 2_000,
});
assert.equal(recoveredSession.agentId, 'agent.code-engine.codex');
assert.deepEqual(sessionRetrieveCalls, [[
  'agent.code-engine.codex',
  'session.recovery-target',
  { signal: recoveryReadController.signal, timeout: 2_000 },
]]);
assert.deepEqual(codeEngineListCalls, []);
await service.listRuntimeBindings(recoveryIdentity);
assert.deepEqual(runtimeBindingListCalls.at(-1), [
  'agent.code-engine.codex',
  recoveredSession.sessionId,
]);

console.log('agents scoped session service contract passed.');
