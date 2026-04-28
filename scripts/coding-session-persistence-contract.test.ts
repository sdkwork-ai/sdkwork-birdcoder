import assert from 'node:assert/strict';
import type {
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionSummary,
  BirdCoderCoreReadApiClient,
  BirdCoderCoreWriteApiClient,
} from '@sdkwork/birdcoder-types';
import {
  TEST_CODE_ENGINE_MODEL_CONFIG,
  buildTestCodeEngineModelConfigSyncResult,
} from './test-code-engine-model-config-fixture.ts';

const dataKernelModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts',
  import.meta.url,
);
const consoleRepositoryModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts',
  import.meta.url,
);
const consoleQueriesModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/appAdminConsoleQueries.ts',
  import.meta.url,
);
const appAdminApiClientModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts',
  import.meta.url,
);
const typesEntryModulePath = new URL(
  '../packages/sdkwork-birdcoder-types/src/index.ts',
  import.meta.url,
);
const defaultServicesModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts',
  import.meta.url,
);
const sessionInventoryModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/sessionInventory.ts',
  import.meta.url,
);

const backingStore = new Map<string, string>();
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: {
      getItem(key: string) {
        return backingStore.has(key) ? backingStore.get(key)! : null;
      },
      setItem(key: string, value: string) {
        backingStore.set(key, value);
      },
      removeItem(key: string) {
        backingStore.delete(key);
      },
    },
  },
});

function createTimestamp(offset: number): string {
  return new Date(Date.UTC(2026, 3, 11, 12, 0, 0) + offset * 1000).toISOString();
}

try {
  const { createBirdCoderStorageProvider } = await import(
    `${dataKernelModulePath.href}?t=${Date.now()}`
  );
  const { createBirdCoderConsoleRepositories } = await import(
    `${consoleRepositoryModulePath.href}?t=${Date.now()}`
  );
  const { createBirdCoderAppAdminConsoleQueries } = await import(
    `${consoleQueriesModulePath.href}?t=${Date.now()}`
  );
  const {
    createBirdCoderInProcessAppAdminApiTransport,
  } = await import(`${appAdminApiClientModulePath.href}?t=${Date.now()}`);
  const { createBirdCoderGeneratedAppAdminApiClient } = await import(
    `${typesEntryModulePath.href}?t=${Date.now()}`
  );
  const { createDefaultBirdCoderIdeServices } = await import(
    `${defaultServicesModulePath.href}?t=${Date.now()}`
  );
  const { listStoredCodingSessions } = await import(
    `${sessionInventoryModulePath.href}?t=${Date.now()}`
  );

  const provider = createBirdCoderStorageProvider('sqlite');
  const repositories = createBirdCoderConsoleRepositories({
    providerId: provider.providerId,
    storage: provider,
  });
  const queries = createBirdCoderAppAdminConsoleQueries({ repositories });

  await Promise.all([
    repositories.workspaces.clear(),
    repositories.projects.clear(),
    repositories.projectContents.clear(),
    repositories.teams.clear(),
    repositories.releases.clear(),
  ]);

  const appAdminClient = createBirdCoderGeneratedAppAdminApiClient({
    transport: createBirdCoderInProcessAppAdminApiTransport({
      queries,
    }),
  });

  const authoritativeSessions = new Map<string, BirdCoderCodingSessionSummary>();
  const authoritativeEvents = new Map<string, BirdCoderCodingSessionEvent[]>();
  let sessionCounter = 0;
  let turnCounter = 0;

  const coreWriteClient: BirdCoderCoreWriteApiClient = {
    async createCodingSession(request) {
      if (!request.engineId || !request.modelId) {
        throw new Error('expected explicit engineId and modelId');
      }

      sessionCounter += 1;
      const sessionId = `coding-session-persistence-${sessionCounter}`;
      const timestamp = createTimestamp(sessionCounter);
      const summary: BirdCoderCodingSessionSummary = {
        id: sessionId,
        workspaceId: request.workspaceId,
        projectId: request.projectId,
        title: request.title ?? 'Persistent Session',
        status: 'active',
        hostMode: request.hostMode ?? 'server',
        engineId: request.engineId,
        modelId: request.modelId,
        nativeSessionId: `persistence-native-${sessionCounter}`,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastTurnAt: timestamp,
      };
      authoritativeSessions.set(sessionId, summary);
      authoritativeEvents.set(sessionId, []);
      return summary;
    },
    async updateCodingSession() {
      throw new Error('not needed');
    },
    async forkCodingSession() {
      throw new Error('not needed');
    },
    async deleteCodingSession() {
      throw new Error('not needed');
    },
    async createCodingSessionTurn(codingSessionId, request) {
      const session = authoritativeSessions.get(codingSessionId);
      if (!session) {
        throw new Error(`Unknown coding session: ${codingSessionId}`);
      }

      turnCounter += 1;
      const turnId = `coding-turn-persistence-${turnCounter}`;
      const startedAt = createTimestamp(100 + turnCounter * 2);
      const completedAt = createTimestamp(101 + turnCounter * 2);
      const sessionEvents = authoritativeEvents.get(codingSessionId) ?? [];
      const baseSequence = sessionEvents.length + 1;

      sessionEvents.push(
        {
          id: `${turnId}:event:${baseSequence}`,
          codingSessionId,
          turnId,
          runtimeId: 'runtime-persistence-contract',
          kind: 'turn.started',
          sequence: String(baseSequence),
          payload: {
            requestKind: request.requestKind,
            inputSummary: request.inputSummary,
            runtimeStatus: 'streaming',
          },
          createdAt: startedAt,
        },
        {
          id: `${turnId}:event:${baseSequence + 1}`,
          codingSessionId,
          turnId,
          runtimeId: 'runtime-persistence-contract',
          kind: 'message.completed',
          sequence: String(baseSequence + 1),
          payload: {
            role: 'user',
            content: request.inputSummary,
            runtimeStatus: 'completed',
          },
          createdAt: startedAt,
        },
        {
          id: `${turnId}:event:${baseSequence + 2}`,
          codingSessionId,
          turnId,
          runtimeId: 'runtime-persistence-contract',
          kind: 'message.completed',
          sequence: String(baseSequence + 2),
          payload: {
            role: 'assistant',
            content: `Acknowledged: ${request.inputSummary}`,
            runtimeStatus: 'completed',
          },
          createdAt: completedAt,
        },
      );
      authoritativeEvents.set(codingSessionId, sessionEvents);
      authoritativeSessions.set(codingSessionId, {
        ...session,
        updatedAt: completedAt,
        lastTurnAt: completedAt,
      });

      return {
        id: turnId,
        codingSessionId,
        runtimeId: 'runtime-persistence-contract',
        requestKind: request.requestKind,
        status: 'completed',
        inputSummary: request.inputSummary,
        startedAt,
        completedAt,
      };
    },
    async submitApprovalDecision() {
      throw new Error('not needed');
    },
    async submitUserQuestionAnswer() {
      throw new Error('not needed');
    },
    async syncModelConfig(request) {
      return buildTestCodeEngineModelConfigSyncResult(request.localConfig);
    },
    async editCodingSessionMessage() {
      throw new Error('not needed');
    },
    async deleteCodingSessionMessage() {
      throw new Error('not needed');
    },
  };

  const coreReadClient: BirdCoderCoreReadApiClient = {
    async getCodingSession(codingSessionId) {
      const session = authoritativeSessions.get(codingSessionId);
      if (!session) {
        throw new Error(`Unknown coding session: ${codingSessionId}`);
      }
      return session;
    },
    async getDescriptor() {
      throw new Error('not needed');
    },
    async getEngineCapabilities() {
      throw new Error('not needed');
    },
    async getHealth() {
      throw new Error('not needed');
    },
    async getModelConfig() {
      return TEST_CODE_ENGINE_MODEL_CONFIG;
    },
    async getNativeSession() {
      throw new Error('not needed');
    },
    async getOperation() {
      throw new Error('not needed');
    },
    async getRuntime() {
      throw new Error('not needed');
    },
    async listCodingSessionArtifacts() {
      return [];
    },
    async listCodingSessionCheckpoints() {
      return [];
    },
    async listCodingSessionEvents(codingSessionId) {
      return authoritativeEvents.get(codingSessionId) ?? [];
    },
    async listCodingSessions() {
      return [...authoritativeSessions.values()];
    },
    async listEngines() {
      return [];
    },
    async listModels() {
      return [];
    },
    async listNativeSessionProviders() {
      return [];
    },
    async listNativeSessions() {
      return [];
    },
    async listRoutes() {
      return [];
    },
  };

  const services = createDefaultBirdCoderIdeServices({
    appAdminClient,
    coreReadClient,
    coreWriteClient,
    storageProvider: provider,
  });
  const createdWorkspace = await services.workspaceService.createWorkspace(
    'Coding Session Persistence Workspace',
    'Workspace used to verify coding session persistence.',
  );
  const createdProject = await services.projectService.createProject(
    createdWorkspace.id,
    'Coding Session Persistence Project',
    {
      path: 'D:/sdkwork/contracts/coding-session-persistence',
    },
  );
  const createdSession = await services.projectService.createCodingSession(
    createdProject.id,
    'Persistent Session',
    {
      engineId: 'codex',
      modelId: 'codex',
    },
  );
  const createdMessage = await services.projectService.addCodingSessionMessage(
    createdProject.id,
    createdSession.id,
    {
      role: 'user',
      content: 'Persist this coding session across service recreation.',
    },
  );

  const reloadedServices = createDefaultBirdCoderIdeServices({
    appAdminClient,
    coreReadClient,
    coreWriteClient,
    storageProvider: provider,
  });
  const reloadedProjects = await reloadedServices.projectService.getProjects(createdWorkspace.id);
  const reloadedProject = reloadedProjects.find((project) => project.id === createdProject.id);
  const storedCodingSessions = await listStoredCodingSessions({
    projectId: createdProject.id,
  });

  assert.ok(reloadedProject, 'reloaded services must still resolve the created project.');
  assert.deepEqual(
    reloadedProject?.codingSessions.map((session) => ({
      id: session.id,
      title: session.title,
      engineId: session.engineId,
      modelId: session.modelId,
      nativeSessionId: session.nativeSessionId,
      messages: session.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
      })),
    })),
    [
      {
        id: createdSession.id,
        title: 'Persistent Session',
        engineId: 'codex',
        modelId: 'codex',
        nativeSessionId: 'persistence-native-1',
        messages: [
          {
            id: createdMessage.id,
            role: 'user',
            content: 'Persist this coding session across service recreation.',
          },
          {
            id: reloadedProject?.codingSessions[0]?.messages[1]?.id,
            role: 'assistant',
            content: 'Acknowledged: Persist this coding session across service recreation.',
          },
        ],
      },
    ],
    'coding sessions and projected messages must persist across service recreation.',
  );
  assert.deepEqual(
    storedCodingSessions.map((session) => session.id),
    [createdSession.id],
    'coding session inventory must enumerate the persisted session from canonical storage.',
  );
  assert.deepEqual(
    storedCodingSessions.map((session) => session.nativeSessionId),
    ['persistence-native-1'],
    'coding session inventory storage must preserve raw provider-native session ids for later terminal resume.',
  );
  backingStore.set(
    'sdkwork-birdcoder:coding-session:table.sqlite.coding-sessions.v1',
    JSON.stringify([
      ...storedCodingSessions,
      {
        id: 'coding-session-invalid-missing-model',
        workspaceId: createdWorkspace.id,
        projectId: createdProject.id,
        title: 'Invalid Missing Model',
        status: 'active',
        hostMode: 'desktop',
        engineId: 'codex',
        createdAt: createTimestamp(999),
        updatedAt: createTimestamp(999),
      },
    ]),
  );
  const sanitizedStoredCodingSessions = await listStoredCodingSessions({
    projectId: createdProject.id,
  });
  assert.deepEqual(
    sanitizedStoredCodingSessions.map((session) => ({
      id: session.id,
      modelId: session.modelId,
    })),
    [
      {
        id: createdSession.id,
        modelId: 'codex',
      },
    ],
    'coding session inventory must discard persisted session records that do not carry an explicit model id.',
  );
  backingStore.set(
    'sdkwork-birdcoder:coding-session:table.sqlite.coding-sessions.v1',
    JSON.stringify([
      {
        id: 'coding-session-authoritative-model-case',
        workspaceId: createdWorkspace.id,
        projectId: createdProject.id,
        title: 'Authoritative Model Case',
        status: 'active',
        hostMode: 'desktop',
        engineId: 'codex',
        modelId: 'GPT-5.4',
        createdAt: createTimestamp(1001),
        updatedAt: createTimestamp(1001),
      },
    ]),
  );
  const preservedModelIdSessions = await listStoredCodingSessions({
    projectId: createdProject.id,
  });
  assert.deepEqual(
    preservedModelIdSessions.map((session) => ({
      id: session.id,
      modelId: session.modelId,
    })),
    [
      {
        id: 'coding-session-authoritative-model-case',
        modelId: 'GPT-5.4',
      },
    ],
    'coding session inventory must preserve the authoritative persisted model id instead of coercing it through the engine catalog.',
  );
  backingStore.set(
    'sdkwork-birdcoder:coding-session:table.sqlite.coding-sessions.v1',
    JSON.stringify([
      {
        id: 'coding-session-runtime-busy-alias',
        workspaceId: createdWorkspace.id,
        projectId: createdProject.id,
        title: 'Runtime Busy Alias',
        status: 'active',
        hostMode: 'desktop',
        engineId: 'claude-code',
        modelId: 'claude-sonnet-4.5',
        runtimeStatus: 'busy',
        createdAt: createTimestamp(1101),
        updatedAt: createTimestamp(1101),
      },
      {
        id: 'coding-session-runtime-retry-alias',
        workspaceId: createdWorkspace.id,
        projectId: createdProject.id,
        title: 'Runtime Retry Alias',
        status: 'active',
        hostMode: 'desktop',
        engineId: 'opencode',
        modelId: 'opencode-default',
        runtimeStatus: 'retry',
        createdAt: createTimestamp(1102),
        updatedAt: createTimestamp(1102),
      },
      {
        id: 'coding-session-runtime-unknown',
        workspaceId: createdWorkspace.id,
        projectId: createdProject.id,
        title: 'Runtime Unknown',
        status: 'active',
        hostMode: 'desktop',
        engineId: 'gemini',
        modelId: 'gemini-2.5-pro',
        runtimeStatus: 'unknown-runtime-status',
        createdAt: createTimestamp(1103),
        updatedAt: createTimestamp(1103),
      },
    ]),
  );
  const normalizedRuntimeStatusSessions = await listStoredCodingSessions({
    projectId: createdProject.id,
  });
  assert.deepEqual(
    normalizedRuntimeStatusSessions.map((session) => ({
      id: session.id,
      runtimeStatus: session.runtimeStatus,
    })),
    [
      {
        id: 'coding-session-runtime-unknown',
        runtimeStatus: undefined,
      },
      {
        id: 'coding-session-runtime-retry-alias',
        runtimeStatus: 'failed',
      },
      {
        id: 'coding-session-runtime-busy-alias',
        runtimeStatus: 'streaming',
      },
    ],
    'coding session inventory must normalize native runtime status aliases and discard unknown persisted runtime statuses.',
  );
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

console.log('coding session persistence contract passed.');
