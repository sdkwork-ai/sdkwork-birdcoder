import assert from 'node:assert/strict';
import type {
  BirdCoderAppAdminApiClient,
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
    id: 'workspace-core-write-contract',
    name: 'Core Write Contract Workspace',
    description: 'Workspace for core write create-session adoption.',
    ownerIdentityId: 'identity-core-write-contract',
    createdAt: '2026-04-11T11:30:00.000Z',
    updatedAt: '2026-04-11T11:30:00.000Z',
  });
  await repositories.projects.save({
    id: 'project-core-write-contract',
    workspaceId: 'workspace-core-write-contract',
    name: 'Core Write Contract Project',
    description: 'Project catalog item resolved before remote create.',
    rootPath: 'D:/workspace/core-write-contract',
    status: 'active',
    createdAt: '2026-04-11T11:31:00.000Z',
    updatedAt: '2026-04-11T11:31:00.000Z',
  });

  const appAdminClient: BirdCoderAppAdminApiClient = createBirdCoderGeneratedAppAdminApiClient({
    transport: createBirdCoderInProcessAppAdminApiTransport({
      queries,
    }),
  });

  const observedRemoteCreates: Array<{
    engineId?: string;
    hostMode?: string;
    modelId?: string;
    projectId: string;
    title?: string;
    workspaceId: string;
  }> = [];

  const coreWriteClient: BirdCoderCoreWriteApiClient = {
    async createCodingSession(request) {
      observedRemoteCreates.push({
        workspaceId: request.workspaceId,
        projectId: request.projectId,
        title: request.title,
        hostMode: request.hostMode,
        engineId: request.engineId,
        modelId: request.modelId,
      });

      return {
        id: 'coding-session-server-authoritative',
        workspaceId: request.workspaceId,
        projectId: request.projectId,
        title: request.title ?? 'New Thread',
        status: 'active',
        hostMode: request.hostMode ?? 'server',
        engineId: request.engineId ?? 'codex',
        modelId: request.modelId ?? request.engineId ?? 'codex',
        createdAt: '2026-04-11T11:32:00.000Z',
        updatedAt: '2026-04-11T11:32:00.000Z',
        lastTurnAt: '2026-04-11T11:32:00.000Z',
      };
    },
    async createCodingSessionTurn() {
      throw new Error('not needed');
    },
    async submitApprovalDecision() {
      throw new Error('not needed');
    },
  };

  const services = createDefaultBirdCoderIdeServices({
    appAdminClient,
    coreWriteClient,
    storageProvider: provider,
  });

  const createdSession = await services.projectService.createCodingSession(
    'project-core-write-contract',
    'Remote Authoritative Session',
  );

  assert.equal(createdSession.id, 'coding-session-server-authoritative');
  assert.equal(createdSession.projectId, 'project-core-write-contract');

  const projects = await services.projectService.getProjects('workspace-core-write-contract');
  const project = projects.find((candidate) => candidate.id === 'project-core-write-contract');

  assert.ok(project, 'project catalog must still resolve through the shared app client.');
  assert.deepEqual(observedRemoteCreates, [
    {
      workspaceId: 'workspace-core-write-contract',
      projectId: 'project-core-write-contract',
      title: 'Remote Authoritative Session',
      hostMode: undefined,
      engineId: undefined,
      modelId: undefined,
    },
  ]);
  assert.deepEqual(
    project?.codingSessions.map((session) => ({
      id: session.id,
      projectId: session.projectId,
      title: session.title,
      workspaceId: session.workspaceId,
    })),
    [
      {
        id: 'coding-session-server-authoritative',
        workspaceId: 'workspace-core-write-contract',
        projectId: 'project-core-write-contract',
        title: 'Remote Authoritative Session',
      },
    ],
    'server-created sessions must be mirrored into local project state so refreshed UI catalogs do not lose them.',
  );
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

console.log('api-backed project service core create-coding-session contract passed.');
