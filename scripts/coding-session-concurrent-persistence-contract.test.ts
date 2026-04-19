import assert from 'node:assert/strict';
import type {
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

function createTimestamp(offset: number): string {
  return new Date(Date.UTC(2026, 3, 11, 13, 0, 0) + offset * 1000).toISOString();
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
    repositories.teams.clear(),
    repositories.releases.clear(),
  ]);

  const appAdminClient = createBirdCoderGeneratedAppAdminApiClient({
    transport: createBirdCoderInProcessAppAdminApiTransport({
      queries,
    }),
  });

  const authoritativeSessions = new Map<string, BirdCoderCodingSessionSummary>();
  let sessionCounter = 0;

  const coreWriteClient: BirdCoderCoreWriteApiClient = {
    async createCodingSession(request) {
      sessionCounter += 1;
      const sessionId = `coding-session-concurrent-${sessionCounter}`;
      const timestamp = createTimestamp(sessionCounter);
      const summary: BirdCoderCodingSessionSummary = {
        id: sessionId,
        workspaceId: request.workspaceId,
        projectId: request.projectId,
        title: request.title ?? `Concurrent Session ${sessionCounter}`,
        status: 'active',
        hostMode: request.hostMode ?? 'server',
        engineId: request.engineId ?? 'codex',
        modelId: request.modelId ?? request.engineId ?? 'codex',
        createdAt: timestamp,
        updatedAt: timestamp,
        lastTurnAt: timestamp,
      };
      authoritativeSessions.set(sessionId, summary);
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
    async createCodingSessionTurn() {
      throw new Error('not needed');
    },
    async submitApprovalDecision() {
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

  const serviceA = createDefaultBirdCoderIdeServices({
    appAdminClient,
    coreReadClient,
    coreWriteClient,
    storageProvider: provider,
  });
  const createdWorkspace = await serviceA.workspaceService.createWorkspace(
    'Concurrent Coding Session Workspace',
    'Workspace used to detect stale-cache session overwrites.',
  );
  const createdProject = await serviceA.projectService.createProject(
    createdWorkspace.id,
    'Concurrent Coding Session Project',
    {
      path: 'D:/sdkwork/contracts/coding-session-concurrent',
    },
  );

  const serviceB = createDefaultBirdCoderIdeServices({
    appAdminClient,
    coreReadClient,
    coreWriteClient,
    storageProvider: provider,
  });

  await serviceA.projectService.getProjects(createdWorkspace.id);
  await serviceB.projectService.getProjects(createdWorkspace.id);

  const sessionA = await serviceA.projectService.createCodingSession(
    createdProject.id,
    'Concurrent Session A',
  );
  const sessionB = await serviceB.projectService.createCodingSession(
    createdProject.id,
    'Concurrent Session B',
  );

  const reloadedServices = createDefaultBirdCoderIdeServices({
    appAdminClient,
    coreReadClient,
    coreWriteClient,
    storageProvider: provider,
  });
  const reloadedProjects = await reloadedServices.projectService.getProjects(createdWorkspace.id);
  const reloadedProject = reloadedProjects.find((project) => project.id === createdProject.id);

  assert.ok(reloadedProject, 'reloaded services must still resolve the created project.');
  assert.deepEqual(
    reloadedProject?.codingSessions.map((session) => session.id).sort(),
    [sessionA.id, sessionB.id].sort(),
    'concurrent IDE services must merge persisted coding sessions instead of overwriting each other with stale in-memory caches.',
  );
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

console.log('coding session concurrent persistence contract passed.');
