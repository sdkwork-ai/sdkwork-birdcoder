import assert from 'node:assert/strict';
import type {
  BirdCoderAppAdminApiClient,
  BirdCoderCoreWriteApiClient,
} from '@sdkwork/birdcoder-types';
import { buildTestCodeEngineModelConfigSyncResult } from './test-code-engine-model-config-fixture.ts';

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
    repositories.projectContents.clear(),
    repositories.teams.clear(),
    repositories.releases.clear(),
  ]);

  await repositories.workspaces.save({
    id: 'workspace-core-write-contract',
    name: 'Core Write Contract Workspace',
    description: 'Workspace for core write create-session adoption.',
    ownerId: 'user-core-write-contract',
    createdAt: '2026-04-11T11:30:00.000Z',
    updatedAt: '2026-04-11T11:30:00.000Z',
  });
  await repositories.projects.save({
    id: 'project-core-write-contract',
    workspaceId: 'workspace-core-write-contract',
    name: 'Core Write Contract Project',
    description: 'Project catalog item resolved before remote create.',
    status: 'active',
    createdAt: '2026-04-11T11:31:00.000Z',
    updatedAt: '2026-04-11T11:31:00.000Z',
  });
  await repositories.projectContents.save({
    id: 'project-content-core-write-contract',
    projectId: 'project-core-write-contract',
    projectUuid: 'project-project-core-write-contract',
    configData: JSON.stringify({
      rootPath: 'D:/workspace/core-write-contract',
    }),
    contentVersion: '1.0',
    createdAt: '2026-04-11T11:31:00.250Z',
    updatedAt: '2026-04-11T11:31:00.250Z',
  });

  const appAdminClient: BirdCoderAppAdminApiClient = createBirdCoderGeneratedAppAdminApiClient({
    transport: createBirdCoderInProcessAppAdminApiTransport({
      queries,
    }),
  });

  const observedRemoteCreates: Array<{
    engineId: string;
    hostMode?: string;
    modelId: string;
    projectId: string;
    title?: string;
    workspaceId: string;
  }> = [];

  const coreWriteClient: BirdCoderCoreWriteApiClient = {
    async createCodingSession(request) {
      if (!request.engineId || !request.modelId) {
        throw new Error('expected explicit engineId and modelId');
      }

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
        title: request.title ?? 'New Session',
        status: 'active',
        hostMode: request.hostMode ?? 'server',
        engineId: request.engineId,
        modelId: request.modelId,
        createdAt: '2026-04-11T11:32:00.000Z',
        updatedAt: '2026-04-11T11:32:00.000Z',
        lastTurnAt: '2026-04-11T11:32:00.000Z',
      };
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

  const services = createDefaultBirdCoderIdeServices({
    appAdminClient,
    coreWriteClient,
    storageProvider: provider,
  });

  const createdSession = await (services.projectService.createCodingSession as (
    projectId: string,
    title: string,
    options: { engineId: string; modelId: string },
  ) => Promise<Awaited<ReturnType<typeof services.projectService.createCodingSession>>> )(
    'project-core-write-contract',
    'Remote Authoritative Session',
    {
      engineId: 'claude-code',
      modelId: 'claude-code',
    },
  );

  assert.equal(createdSession.id, 'coding-session-server-authoritative');
  assert.equal(createdSession.projectId, 'project-core-write-contract');
  assert.equal(
    createdSession.engineId,
    'claude-code',
    'remote authoritative session metadata must reflect the requested engine when the user selected a non-default code engine.',
  );
  assert.equal(
    createdSession.modelId,
    'claude-code',
    'remote authoritative session metadata must reflect the requested model so follow-up turns stay aligned with the selected provider runtime.',
  );

  const projects = await services.projectService.getProjects('workspace-core-write-contract');
  const project = projects.find((candidate) => candidate.id === 'project-core-write-contract');

  assert.ok(project, 'project catalog must still resolve through the shared app client.');
  assert.deepEqual(observedRemoteCreates, [
    {
      workspaceId: 'workspace-core-write-contract',
      projectId: 'project-core-write-contract',
      title: 'Remote Authoritative Session',
      hostMode: undefined,
      engineId: 'claude-code',
      modelId: 'claude-code',
    },
  ]);
  assert.deepEqual(
    project?.codingSessions.map((session) => ({
      id: session.id,
      engineId: session.engineId,
      modelId: session.modelId,
      projectId: session.projectId,
      title: session.title,
      workspaceId: session.workspaceId,
    })),
    [
      {
        id: 'coding-session-server-authoritative',
        engineId: 'claude-code',
        modelId: 'claude-code',
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
