import assert from 'node:assert/strict';
import type {
  BirdCoderProjectRuntimeLocation,
  BirdCoderProjectRuntimeLocationPreference,
} from '@sdkwork/birdcoder-pc-core/sdk/birdcoder-app';
import type {
  BirdCoderApiTransportRequest,
  BirdCoderCodingSessionSummary,
  BirdCoderProject,
  BirdCoderProjectSummary,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type { BirdCoderConsoleQueries } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/consoleQueries.ts';
import type { IProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IProjectService.ts';

const appSdkTransportModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSdkTransport.ts',
  import.meta.url,
);
const sdkClientsModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts',
  import.meta.url,
);
const apiBackedProjectServiceModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts',
  import.meta.url,
);

const projectId = 'project runtime/1';
const runtimeLocationId = 'runtime/target:1';
const createdAt = '2026-07-22T08:00:00.000Z';
const runtimeLocation = {
  buildAvailable: true,
  createdAt,
  displayName: 'Local checkout',
  fileSystemAvailable: true,
  gitAvailable: true,
  hasAbsolutePath: true,
  healthStatus: 'healthy',
  id: runtimeLocationId,
  locationKind: 'desktop_checkout',
  pathFlavor: 'windows',
  projectId,
  rootLocator: 'desktop:checkout:runtime-target-1',
  runtimeTargetId: 'runtime-target-1',
  runtimeTargetKind: 'desktop_device',
  terminalAvailable: true,
  updatedAt: createdAt,
  version: '7',
} satisfies BirdCoderProjectRuntimeLocation;
const preferences = [
  {
    capability: 'terminal',
    createdAt,
    id: 'preference-terminal',
    projectId,
    runtimeLocationId,
    subjectUserId: 'user-runtime-location-contract',
    updatedAt: createdAt,
    version: '3',
  },
  {
    capability: 'file_system',
    createdAt,
    id: 'preference-file-system',
    projectId,
    runtimeLocationId,
    subjectUserId: 'user-runtime-location-contract',
    updatedAt: createdAt,
    version: '2',
  },
] satisfies BirdCoderProjectRuntimeLocationPreference[];

const unusedQueries = new Proxy({} as BirdCoderConsoleQueries, {
  get(_target, property) {
    throw new Error(`Unexpected console query: ${String(property)}`);
  },
});

const { createBirdCoderInProcessAppSdkTransport } = await import(
  `${appSdkTransportModulePath.href}?t=${Date.now()}`
);
const { createBirdCoderAppSdkApiClient, createBirdCoderGeneratedAppSdkClient } = await import(
  `${sdkClientsModulePath.href}?t=${Date.now()}`
);
const { ApiBackedProjectService } = await import(
  `${apiBackedProjectServiceModulePath.href}?t=${Date.now()}`
);

const observedRequests: BirdCoderApiTransportRequest[] = [];
const readCalls: Array<Record<string, unknown>> = [];
const transport = createBirdCoderInProcessAppSdkTransport({
  observe(request) {
    observedRequests.push(request);
  },
  projectRuntimeLocationReadPort: {
    async getProjectRuntimeLocation(candidateProjectId, candidateRuntimeLocationId) {
      readCalls.push({
        operation: 'retrieve',
        projectId: candidateProjectId,
        runtimeLocationId: candidateRuntimeLocationId,
      });
      return runtimeLocation;
    },
    async listProjectRuntimeLocationPreferencePage(request) {
      readCalls.push({ operation: 'preferences.list', ...request });
      return {
        items: preferences,
        total: 4,
      };
    },
  },
  queries: unusedQueries,
});
const appSdkClient = createBirdCoderGeneratedAppSdkClient({ transport });

const preferencePage = await appSdkClient.platform.projects.runtimeLocations.preferences.list(
  { projectId },
  { page: 2, page_size: 2 },
);
const runtimeLocationEnvelope = await appSdkClient.platform.projects.runtimeLocations.retrieve({
  projectId,
  runtimeLocationId,
});

assert.deepEqual(readCalls, [
  {
    limit: 2,
    offset: 2,
    operation: 'preferences.list',
    projectId,
  },
  {
    operation: 'retrieve',
    projectId,
    runtimeLocationId,
  },
]);
assert.deepEqual(
  observedRequests.map(({ method, path, query }) => ({ method, path, query })),
  [
    {
      method: 'GET',
      path: '/app/v3/api/projects/project%20runtime%2F1/runtime_location_preferences',
      query: { page: 2, page_size: 2 },
    },
    {
      method: 'GET',
      path:
        '/app/v3/api/projects/project%20runtime%2F1/runtime_locations/runtime%2Ftarget%3A1',
      query: undefined,
    },
  ],
);
assert.deepEqual(preferencePage.data, {
  items: preferences,
  pageInfo: {
    hasMore: false,
    mode: 'offset',
    page: 2,
    pageSize: 2,
    totalItems: '4',
    totalPages: 2,
  },
});
assert.deepEqual(runtimeLocationEnvelope.data, { item: runtimeLocation });

const localOnlyClient = createBirdCoderGeneratedAppSdkClient({
  transport: createBirdCoderInProcessAppSdkTransport({ queries: unusedQueries }),
});
const emptyPreferencePage =
  await localOnlyClient.platform.projects.runtimeLocations.preferences.list(
    { projectId: 'new-project-without-runtime-location' },
    { page: 1, page_size: 20 },
  );
assert.deepEqual(emptyPreferencePage.data, {
  items: [],
  pageInfo: {
    hasMore: false,
    mode: 'offset',
    page: 1,
    pageSize: 20,
    totalItems: '0',
    totalPages: 0,
  },
});

const workspaceId = 'workspace-joint-runtime-location-contract';
const jointProjectId = 'project-joint-runtime-location-contract';
const jointRuntimeLocationId = 'runtime-joint-runtime-location-contract';
const projectSummary: BirdCoderProjectSummary = {
  createdAt,
  id: jointProjectId,
  name: 'Joint runtime-location contract',
  status: 'active',
  updatedAt: createdAt,
  workspaceId,
};
const localProject: BirdCoderProject = {
  codingSessions: [],
  createdAt,
  id: jointProjectId,
  name: projectSummary.name,
  updatedAt: createdAt,
  workspaceId,
};
const discoveredSession: BirdCoderCodingSessionSummary = {
  createdAt,
  engineId: 'codex',
  hostMode: 'desktop',
  id: 'coding-session-joint-runtime-location-contract',
  modelId: 'gpt-5.4',
  nativeSessionId: 'provider-session-joint-runtime-location-contract',
  projectId: jointProjectId,
  runtimeLocationId: jointRuntimeLocationId,
  status: 'active',
  title: 'Discovered provider session',
  updatedAt: createdAt,
  workspaceId,
};
const jointQueries = new Proxy(
  {
    async getProject(candidateProjectId: string) {
      return candidateProjectId === jointProjectId ? projectSummary : null;
    },
  },
  {
    get(target, property) {
      if (property in target) {
        return target[property as keyof typeof target];
      }
      throw new Error(`Unexpected joint console query: ${String(property)}`);
    },
  },
) as unknown as BirdCoderConsoleQueries;
const jointAppClient = createBirdCoderAppSdkApiClient({
  transport: createBirdCoderInProcessAppSdkTransport({
    projectRuntimeLocationReadPort: {
      async getProjectRuntimeLocation(candidateProjectId, candidateRuntimeLocationId) {
        assert.equal(candidateProjectId, jointProjectId);
        assert.equal(candidateRuntimeLocationId, jointRuntimeLocationId);
        return {
          ...runtimeLocation,
          id: jointRuntimeLocationId,
          projectId: jointProjectId,
        };
      },
      async listProjectRuntimeLocationPreferencePage(request) {
        assert.deepEqual(request, {
          limit: 20,
          offset: 0,
          projectId: jointProjectId,
        });
        return {
          items: [
            {
              ...preferences[0],
              id: 'preference-joint-terminal',
              projectId: jointProjectId,
              runtimeLocationId: jointRuntimeLocationId,
            },
          ],
          total: 1,
        };
      },
    },
    queries: jointQueries,
  }),
});
const codingSessionRequests: Array<{
  projectId?: string;
  runtimeLocationId?: string;
  workspaceId?: string;
}> = [];
const codingRuntimeClient = {
  async listCodingSessions(request?: {
    projectId?: string;
    runtimeLocationId?: string;
    workspaceId?: string;
  }) {
    codingSessionRequests.push({ ...request });
    return [discoveredSession];
  },
};
const writeService = {
  async getProjectById(candidateProjectId: string) {
    return candidateProjectId === jointProjectId ? structuredClone(localProject) : null;
  },
  async getProjects(candidateWorkspaceId?: string) {
    return candidateWorkspaceId === workspaceId ? [structuredClone(localProject)] : [];
  },
} as unknown as IProjectService;
const apiBackedProjectService = new ApiBackedProjectService({
  appClient: jointAppClient,
  codingRuntimeClient,
  writeService,
});

const hydratedProject = await apiBackedProjectService.getProjectById(jointProjectId);

assert.deepEqual(codingSessionRequests, [
  {
    projectId: jointProjectId,
    runtimeLocationId: jointRuntimeLocationId,
    workspaceId,
  },
]);
assert.equal(hydratedProject?.codingSessions[0]?.id, discoveredSession.id);

console.log('in-process app SDK project runtime-location read contract passed.');
