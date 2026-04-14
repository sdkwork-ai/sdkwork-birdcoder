import assert from 'node:assert/strict';
import type {
  BirdCoderCoreReadApiClient,
  BirdCoderCoreWriteApiClient,
} from '@sdkwork/birdcoder-types';

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

  const provider = createBirdCoderStorageProvider('sqlite');
  const repositories = createBirdCoderConsoleRepositories({
    providerId: provider.providerId,
    storage: provider,
  });
  const queries = createBirdCoderAppAdminConsoleQueries({ repositories });

  await Promise.all([
    repositories.workspaces.clear(),
    repositories.projects.clear(),
    repositories.teams.clear(),
    repositories.releases.clear(),
  ]);

  await repositories.workspaces.save({
    id: 'workspace-core-turn-contract',
    name: 'Core Turn Contract Workspace',
    description: 'Workspace for core write create-turn adoption.',
    ownerIdentityId: 'identity-core-turn-contract',
    createdAt: '2026-04-11T12:00:00.000Z',
    updatedAt: '2026-04-11T12:00:00.000Z',
  });
  await repositories.projects.save({
    id: 'project-core-turn-contract',
    workspaceId: 'workspace-core-turn-contract',
    name: 'Core Turn Contract Project',
    description: 'Project catalog item resolved before remote create turn.',
    rootPath: 'D:/workspace/core-turn-contract',
    status: 'active',
    createdAt: '2026-04-11T12:01:00.000Z',
    updatedAt: '2026-04-11T12:01:00.000Z',
  });

  const appAdminClient = createBirdCoderGeneratedAppAdminApiClient({
    transport: createBirdCoderInProcessAppAdminApiTransport({
      queries,
    }),
  });

  const observedRemoteTurnCreates: Array<{
    codingSessionId: string;
    inputSummary: string;
    requestKind: string;
    runtimeId?: string;
  }> = [];

  const coreWriteClient: BirdCoderCoreWriteApiClient = {
    async createCodingSession(request) {
      return {
        id: 'coding-session-turn-contract',
        workspaceId: request.workspaceId,
        projectId: request.projectId,
        title: request.title ?? 'Turn Contract Session',
        status: 'active',
        hostMode: request.hostMode ?? 'server',
        engineId: request.engineId ?? 'codex',
        modelId: request.modelId ?? request.engineId ?? 'codex',
        createdAt: '2026-04-11T12:02:00.000Z',
        updatedAt: '2026-04-11T12:02:00.000Z',
        lastTurnAt: '2026-04-11T12:02:00.000Z',
      };
    },
    async createCodingSessionTurn(codingSessionId, request) {
      observedRemoteTurnCreates.push({
        codingSessionId,
        runtimeId: request.runtimeId,
        requestKind: request.requestKind,
        inputSummary: request.inputSummary,
      });

      return {
        id: 'coding-turn-server-authoritative',
        codingSessionId,
        runtimeId: request.runtimeId ?? 'runtime-turn-contract',
        requestKind: request.requestKind,
        status: 'running',
        inputSummary: request.inputSummary,
        startedAt: '2026-04-11T12:03:00.000Z',
        completedAt: undefined,
      };
    },
    async submitApprovalDecision() {
      throw new Error('not needed');
    },
  };
  const coreReadClient: BirdCoderCoreReadApiClient = {
    async getCodingSession(codingSessionId) {
      return {
        id: codingSessionId,
        workspaceId: 'workspace-core-turn-contract',
        projectId: 'project-core-turn-contract',
        title: 'Turn Contract Session',
        status: 'active',
        hostMode: 'server',
        engineId: 'codex',
        modelId: 'gpt-5-codex',
        createdAt: '2026-04-11T12:02:00.000Z',
        updatedAt: '2026-04-11T12:03:01.000Z',
        lastTurnAt: '2026-04-11T12:03:01.000Z',
      };
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
      return [
        {
          id: 'runtime-turn-contract:coding-turn-server-authoritative:event:1',
          codingSessionId,
          turnId: 'coding-turn-server-authoritative',
          runtimeId: 'runtime-turn-contract',
          kind: 'turn.started',
          sequence: 1,
          payload: {
            requestKind: 'chat',
            inputSummary: 'Implement shared core turn facade.',
            runtimeStatus: 'streaming',
          },
          createdAt: '2026-04-11T12:03:00.000Z',
        },
        {
          id: 'runtime-turn-contract:coding-turn-server-authoritative:event:2',
          codingSessionId,
          turnId: 'coding-turn-server-authoritative',
          runtimeId: 'runtime-turn-contract',
          kind: 'message.completed',
          sequence: 2,
          payload: {
            role: 'assistant',
            content: 'Server runtime turn completed for shared core turn facade.',
            runtimeStatus: 'completed',
          },
          createdAt: '2026-04-11T12:03:01.000Z',
        },
        {
          id: 'runtime-turn-contract:coding-turn-server-authoritative:event:3',
          codingSessionId,
          turnId: 'coding-turn-server-authoritative',
          runtimeId: 'runtime-turn-contract',
          kind: 'turn.completed',
          sequence: 3,
          payload: {
            finishReason: 'stop',
            runtimeStatus: 'completed',
          },
          createdAt: '2026-04-11T12:03:01.000Z',
        },
      ];
    },
    async listEngines() {
      throw new Error('not needed');
    },
    async listModels() {
      throw new Error('not needed');
    },
  };

  const services = createDefaultBirdCoderIdeServices({
    appAdminClient,
    coreReadClient,
    coreWriteClient,
    storageProvider: provider,
  });

  const createdSession = await services.projectService.createCodingSession(
    'project-core-turn-contract',
    'Turn Contract Session',
  );
  const createdMessage = await services.projectService.addCodingSessionMessage(
    'project-core-turn-contract',
    createdSession.id,
    {
      role: 'user',
      content: 'Implement shared core turn facade.',
    },
  );

  assert.equal(createdMessage.turnId, 'coding-turn-server-authoritative');
  assert.deepEqual(observedRemoteTurnCreates, [
    {
      codingSessionId: 'coding-session-turn-contract',
      runtimeId: undefined,
      requestKind: 'chat',
      inputSummary: 'Implement shared core turn facade.',
    },
  ]);

  const projects = await services.projectService.getProjects('workspace-core-turn-contract');
  const project = projects.find((candidate) => candidate.id === 'project-core-turn-contract');
  const codingSession = project?.codingSessions.find(
    (candidate) => candidate.id === 'coding-session-turn-contract',
  );

  assert.ok(project, 'project catalog must still resolve through the shared app client.');
  assert.ok(codingSession, 'server-created session must stay visible after local turn mirroring.');
  assert.deepEqual(
    codingSession?.messages.map((message) => ({
      id: message.id,
      content: message.content,
      role: message.role,
      turnId: message.turnId,
    })),
    [
      {
        id: createdMessage.id,
        content: 'Implement shared core turn facade.',
        role: 'user',
        turnId: 'coding-turn-server-authoritative',
      },
      {
        id: codingSession?.messages[1]?.id,
        content: 'Server runtime turn completed for shared core turn facade.',
        role: 'assistant',
        turnId: 'coding-turn-server-authoritative',
      },
    ],
    'remote create-turn adoption must preserve the server-authoritative turn id and mirror completed assistant output back into refreshed project session state.',
  );
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

console.log('api-backed project service core create-coding-session-turn contract passed.');
