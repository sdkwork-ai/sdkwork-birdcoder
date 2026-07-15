import type {
  BirdCoderAppRuntimeSdkApiClient,
  BirdCoderAppSdkApiClient,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';
import assert from 'node:assert/strict';
import { buildTestCodeEngineModelConfigSyncResult } from './test-code-engine-model-config-fixture.ts';

const dataKernelModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/dataKernel.ts',
  import.meta.url,
);
const consoleRepositoryModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/appConsoleRepository.ts',
  import.meta.url,
);
const consoleQueriesModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/consoleQueries.ts',
  import.meta.url,
);
const appSdkTransportModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSdkTransport.ts',
  import.meta.url,
);
const sdkClientsModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts',
  import.meta.url,
);
const typesEntryModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/index.ts',
  import.meta.url,
);
const defaultServicesModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServices.ts',
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
  const { createBirdCoderConsoleQueries } = await import(
    `${consoleQueriesModulePath.href}?t=${Date.now()}`
  );
  const {
    createBirdCoderInProcessAppSdkTransport,
  } = await import(`${appSdkTransportModulePath.href}?t=${Date.now()}`);
  const { createBirdCoderAppSdkApiClient } = await import(
    `${sdkClientsModulePath.href}?t=${Date.now()}`
  );
  const { createDefaultBirdCoderIdeServices } = await import(
    `${defaultServicesModulePath.href}?t=${Date.now()}`
  );

  const provider = createBirdCoderStorageProvider('sqlite');
  const repositories = createBirdCoderConsoleRepositories({
    providerId: provider.providerId,
    storage: provider,
  });
  const queries = createBirdCoderConsoleQueries({ repositories });

  await Promise.all([
    repositories.workspaces.clear(),
    repositories.projects.clear(),
    repositories.projectContents.clear(),
    repositories.teams.clear(),
    repositories.releases.clear(),
  ]);

  await repositories.workspaces.save({
    id: 'workspace-app-runtime-write-contract',
    name: 'App Runtime Write Contract Workspace',
    description: 'Workspace for app runtime write create-session adoption.',
    ownerId: 'user-app-runtime-write-contract',
    createdAt: '2026-04-11T11:30:00.000Z',
    updatedAt: '2026-04-11T11:30:00.000Z',
  });
  await repositories.projects.save({
    id: 'project-app-runtime-write-contract',
    workspaceId: 'workspace-app-runtime-write-contract',
    name: 'App Runtime Write Contract Project',
    description: 'Project catalog item resolved before remote create.',
    status: 'active',
    createdAt: '2026-04-11T11:31:00.000Z',
    updatedAt: '2026-04-11T11:31:00.000Z',
  });
  const appClient: BirdCoderAppSdkApiClient = createBirdCoderAppSdkApiClient({
    transport: createBirdCoderInProcessAppSdkTransport({
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

  const runtimeCodingSessions: Array<
    Awaited<ReturnType<BirdCoderAppRuntimeSdkApiClient['createCodingSession']>>
  > = [];

  const codingRuntimeClient = {
    ...appClient,
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

      const codingSession = {
        id: 'coding-session-server-authoritative',
        workspaceId: request.workspaceId,
        projectId: request.projectId,
        title: request.title ?? 'New Session',
        status: 'active' as const,
        hostMode: request.hostMode ?? 'server',
        engineId: request.engineId,
        modelId: request.modelId,
        createdAt: '2026-04-11T11:32:00.000Z',
        updatedAt: '2026-04-11T11:32:00.000Z',
        lastTurnAt: '2026-04-11T11:32:00.000Z',
      };
      runtimeCodingSessions.push(codingSession);
      return codingSession;
    },
    async getCodingSession(codingSessionId) {
      const codingSession = runtimeCodingSessions.find(
        (candidate) => candidate.id === codingSessionId,
      );
      if (!codingSession) {
        throw new Error(`coding session ${codingSessionId} not found`);
      }
      return codingSession;
    },
    async listCodingSessions(request = {}) {
      return runtimeCodingSessions.filter(
        (candidate) =>
          (!request.workspaceId || candidate.workspaceId === request.workspaceId) &&
          (!request.projectId || candidate.projectId === request.projectId) &&
          (!request.engineId || candidate.engineId === request.engineId),
      );
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
  } satisfies BirdCoderAppRuntimeSdkApiClient;

  const services = createDefaultBirdCoderIdeServices({
    appClient,
    appRuntimeClient: codingRuntimeClient,
    storageProvider: provider,
  });

  const createdSession = await (services.projectService.createCodingSession as (
    projectId: string,
    title: string,
    options: { engineId: string; modelId: string },
  ) => Promise<Awaited<ReturnType<typeof services.projectService.createCodingSession>>> )(
    'project-app-runtime-write-contract',
    'Remote Authoritative Session',
    {
      engineId: 'claude-code',
      modelId: 'claude-code',
    },
  );

  assert.equal(createdSession.id, 'coding-session-server-authoritative');
  assert.equal(createdSession.projectId, 'project-app-runtime-write-contract');
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

  const projects = await services.projectService.getProjects('workspace-app-runtime-write-contract');
  const project = projects.find((candidate) => candidate.id === 'project-app-runtime-write-contract');

  assert.ok(project, 'project catalog must still resolve through the shared app client.');
  assert.deepEqual(observedRemoteCreates, [
    {
      workspaceId: 'workspace-app-runtime-write-contract',
      projectId: 'project-app-runtime-write-contract',
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
        workspaceId: 'workspace-app-runtime-write-contract',
        projectId: 'project-app-runtime-write-contract',
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

console.log('api-backed project service app runtime create-coding-session contract passed.');
