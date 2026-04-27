import assert from 'node:assert/strict';
import type {
  BirdCoderAppAdminApiClient,
  BirdCoderCodingSessionSummary,
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

function clearCachedProjectLists(readCache: Map<string, unknown>): void {
  for (const key of [...readCache.keys()]) {
    if (key.startsWith('getProjects:')) {
      readCache.delete(key);
    }
  }
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

  await repositories.workspaces.save({
    id: 'workspace-summary-cache-contract',
    name: 'Summary Cache Contract Workspace',
    description: 'Workspace for authoritative coding session summary cache invalidation.',
    ownerId: 'user-summary-cache-contract',
    createdAt: '2026-04-20T12:00:00.000Z',
    updatedAt: '2026-04-20T12:00:00.000Z',
  });
  await repositories.projects.save({
    id: 'project-summary-cache-contract',
    workspaceId: 'workspace-summary-cache-contract',
    name: 'Summary Cache Contract Project',
    description: 'Project used to validate coding session summary cache invalidation.',
    status: 'active',
    createdAt: '2026-04-20T12:01:00.000Z',
    updatedAt: '2026-04-20T12:01:00.000Z',
  });
  await repositories.projectContents.save({
    id: 'project-content-summary-cache-contract',
    projectId: 'project-summary-cache-contract',
    projectUuid: 'project-project-summary-cache-contract',
    configData: JSON.stringify({
      rootPath: 'D:/workspace/summary-cache-contract',
    }),
    contentVersion: '1.0',
    createdAt: '2026-04-20T12:01:00.250Z',
    updatedAt: '2026-04-20T12:01:00.250Z',
  });

  const appAdminClient: BirdCoderAppAdminApiClient = createBirdCoderGeneratedAppAdminApiClient({
    transport: createBirdCoderInProcessAppAdminApiTransport({
      queries,
    }),
  });

  let remoteCodingSessions: BirdCoderCodingSessionSummary[] = [];

  const coreReadClient: BirdCoderCoreReadApiClient = {
    async getCodingSession(codingSessionId) {
      const codingSession = remoteCodingSessions.find((candidate) => candidate.id === codingSessionId);
      if (!codingSession) {
        throw new Error(`coding session ${codingSessionId} not found`);
      }
      return codingSession;
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
    async listCodingSessionEvents() {
      return [];
    },
    async listCodingSessions(request) {
      return remoteCodingSessions.filter((codingSession) => {
        if (request.projectId && codingSession.projectId !== request.projectId) {
          return false;
        }
        if (request.workspaceId && codingSession.workspaceId !== request.workspaceId) {
          return false;
        }
        return true;
      });
    },
    async listEngines() {
      throw new Error('not needed');
    },
    async listModels() {
      throw new Error('not needed');
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

  const coreWriteClient: BirdCoderCoreWriteApiClient = {
    async createCodingSession(request) {
      const createdSession: BirdCoderCodingSessionSummary = {
        id: 'coding-session-summary-cache-contract',
        workspaceId: request.workspaceId,
        projectId: request.projectId,
        title: request.title ?? 'Summary Cache Session',
        status: 'active',
        hostMode: request.hostMode ?? 'server',
        engineId: request.engineId,
        modelId: request.modelId,
        createdAt: '2026-04-20T12:02:00.000Z',
        updatedAt: '2026-04-20T12:02:00.000Z',
        lastTurnAt: '2026-04-20T12:02:00.000Z',
      };
      remoteCodingSessions = [createdSession];
      return createdSession;
    },
    async updateCodingSession() {
      throw new Error('not needed');
    },
    async forkCodingSession() {
      throw new Error('not needed');
    },
    async deleteCodingSession(codingSessionId) {
      remoteCodingSessions = remoteCodingSessions.filter(
        (codingSession) => codingSession.id !== codingSessionId,
      );
      return {
        id: codingSessionId,
      };
    },
    async createCodingSessionTurn() {
      throw new Error('not needed');
    },
    async submitApprovalDecision() {
      throw new Error('not needed');
    },
    async submitUserQuestionAnswer() {
      throw new Error('not needed');
    },
    async deleteCodingSessionMessage() {
      throw new Error('not needed');
    },
  };

  const services = createDefaultBirdCoderIdeServices({
    appAdminClient,
    coreReadClient,
    coreWriteClient,
    storageProvider: provider,
  });

  const initialProjects = await services.projectService.getProjects('workspace-summary-cache-contract');
  assert.deepEqual(
    initialProjects[0]?.codingSessions ?? [],
    [],
    'initial project load must prime an empty authoritative coding session summary cache.',
  );

  const internalReadCache = (
    services.projectService as unknown as {
      readCache: Map<string, unknown>;
    }
  ).readCache;
  assert.ok(
    [...internalReadCache.keys()].some((key) =>
      key.startsWith('listAuthoritativeCodingSessionSummaries:'),
    ),
    'test setup must prime the authoritative coding session summaries cache.',
  );

  await services.projectService.createCodingSession(
    'project-summary-cache-contract',
    'Summary Cache Session',
    {
      engineId: 'codex',
      modelId: 'gpt-5.4',
    },
  );

  clearCachedProjectLists(internalReadCache);
  const reloadedProjectsAfterCreate = await services.projectService.getProjects(
    'workspace-summary-cache-contract',
  );
  assert.deepEqual(
    reloadedProjectsAfterCreate[0]?.codingSessions.map((codingSession) => codingSession.id),
    ['coding-session-summary-cache-contract'],
    'creating a coding session must invalidate authoritative session summaries so reloaded project lists cannot reuse stale empty summaries.',
  );

  const sameTimestamp = '2026-04-20T12:03:00.000Z';
  const createdCodingSession = reloadedProjectsAfterCreate[0]?.codingSessions[0];
  assert.ok(createdCodingSession, 'created coding session must exist for runtime merge assertion.');
  await services.projectService.upsertCodingSession('project-summary-cache-contract', {
    ...createdCodingSession,
    runtimeStatus: 'streaming',
    updatedAt: sameTimestamp,
    lastTurnAt: sameTimestamp,
    transcriptUpdatedAt: sameTimestamp,
  });
  remoteCodingSessions = [
    {
      ...remoteCodingSessions[0]!,
      runtimeStatus: 'completed',
      updatedAt: sameTimestamp,
      lastTurnAt: sameTimestamp,
      transcriptUpdatedAt: sameTimestamp,
    },
  ];
  internalReadCache.clear();
  const reloadedProjectsAfterTerminalSummary = await services.projectService.getProjects(
    'workspace-summary-cache-contract',
  );
  assert.equal(
    reloadedProjectsAfterTerminalSummary[0]?.codingSessions[0]?.runtimeStatus,
    'completed',
    'same-timestamp authoritative terminal summaries must override local streaming state.',
  );

  await services.projectService.deleteCodingSession(
    'project-summary-cache-contract',
    'coding-session-summary-cache-contract',
  );

  clearCachedProjectLists(internalReadCache);
  const reloadedProjectsAfterDelete = await services.projectService.getProjects(
    'workspace-summary-cache-contract',
  );
  assert.deepEqual(
    reloadedProjectsAfterDelete[0]?.codingSessions.map((codingSession) => codingSession.id),
    [],
    'deleting a coding session must invalidate authoritative session summaries so reloaded project lists cannot resurrect removed sessions from stale summary cache.',
  );
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

console.log('coding session authoritative summary cache contract passed.');
