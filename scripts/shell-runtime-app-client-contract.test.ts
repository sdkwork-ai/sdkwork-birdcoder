import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

interface CapturedRequest {
  method: string;
  url: string;
}

function createListEnvelope<TItem>(items: readonly TItem[]) {
  return {
    requestId: 'req.shell-runtime-app-client-contract',
    timestamp: '2026-04-10T00:00:00.000Z',
    items: [...items],
    meta: {
      page: 1,
      pageSize: items.length,
      total: items.length,
      version: 'v1',
    },
  };
}

function readRequestUrl(input: URL | RequestInfo): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

const bootstrapModulePath = new URL(
  '../packages/sdkwork-birdcoder-shell-runtime/src/application/bootstrap/bootstrapShellRuntime.ts',
  import.meta.url,
);
const bootstrapImplSourcePath = new URL(
  '../packages/sdkwork-birdcoder-shell-runtime/src/application/bootstrap/bootstrapShellRuntimeImpl.ts',
  import.meta.url,
);
const infrastructureEntrySourcePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/index.ts',
  import.meta.url,
);
const defaultIdeServicesSourcePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts',
  import.meta.url,
);
const defaultIdeServicesRuntimeModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServicesRuntime.ts',
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
const apiBackedWorkspaceServiceModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedWorkspaceService.ts',
  import.meta.url,
);
const apiBackedProjectServiceModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts',
  import.meta.url,
);
const ideContextSourcePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/context/IDEContext.tsx',
  import.meta.url,
);
const serviceContextSourcePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/context/ServiceContext.tsx',
  import.meta.url,
);

function cloneValue<TValue>(value: TValue): TValue {
  return structuredClone(value);
}

function createWorkspaceMirror() {
  const localWorkspaces = new Map<string, Record<string, unknown>>();

  return {
    async syncWorkspaceSummary(summary: Record<string, unknown>) {
      const existingWorkspace = localWorkspaces.get(String(summary.id));
      const nextWorkspace = {
        ...existingWorkspace,
        id: String(summary.id),
        name: String(summary.name),
        description:
          typeof summary.description === 'string' ? summary.description : undefined,
        ownerId: typeof summary.ownerId === 'string' ? summary.ownerId : undefined,
        status: summary.status === 'archived' ? 'archived' : 'active',
      };
      localWorkspaces.set(nextWorkspace.id, nextWorkspace);
      return cloneValue(nextWorkspace);
    },
    writeService: {
      async deleteWorkspace(id: string) {
        localWorkspaces.delete(id);
      },
      async getWorkspaces() {
        return [...localWorkspaces.values()].map((workspace) => cloneValue(workspace));
      },
    },
  };
}

function createProjectMirror() {
  const localProjects = new Map<string, Record<string, unknown>>();

  return {
    async syncProjectSummary(summary: Record<string, unknown>) {
      const existingProject = localProjects.get(String(summary.id));
      const createdAt =
        typeof existingProject?.createdAt === 'string'
          ? existingProject.createdAt
          : typeof summary.createdAt === 'string'
            ? summary.createdAt
            : '2026-04-10T00:00:01.000Z';
      const nextProject = {
        ...existingProject,
        id: String(summary.id),
        workspaceId: String(summary.workspaceId),
        name: String(summary.name),
        description:
          typeof summary.description === 'string' ? summary.description : undefined,
        path: typeof summary.rootPath === 'string' ? summary.rootPath : undefined,
        createdAt,
        updatedAt:
          typeof summary.updatedAt === 'string' ? summary.updatedAt : createdAt,
        codingSessions: Array.isArray(existingProject?.codingSessions)
          ? cloneValue(existingProject.codingSessions)
          : [],
        archived: summary.status === 'archived',
      };
      localProjects.set(nextProject.id, nextProject);
      return cloneValue(nextProject);
    },
    writeService: {
      async deleteProject(id: string) {
        localProjects.delete(id);
      },
      async getProjects(workspaceId?: string) {
        return [...localProjects.values()]
          .filter(
            (project) =>
              !workspaceId || project.workspaceId === workspaceId,
          )
          .map((project) => cloneValue(project));
      },
    },
  };
}

const requests: CapturedRequest[] = [];
const localStore = new Map<string, string>();
const originalFetch = globalThis.fetch;
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
let resetDefaultBirdCoderIdeServicesRuntimeForTests: (() => void) | undefined;

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: {
      getItem(key: string) {
        return localStore.has(key) ? localStore.get(key)! : null;
      },
      setItem(key: string, value: string) {
        localStore.set(key, value);
      },
      removeItem(key: string) {
        localStore.delete(key);
      },
    },
  },
});

globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
  const url = readRequestUrl(input);
  requests.push({
    method: init?.method ?? 'GET',
    url,
  });

  if (url.includes('/api/app/v1/workspaces')) {
    return new Response(
      JSON.stringify(
        createListEnvelope([
          {
            id: 'workspace-runtime-contract',
            name: 'Runtime Contract Workspace',
            description: 'Workspace loaded through shell runtime app client.',
            ownerId: 'user-runtime-contract',
            status: 'active',
          },
        ]),
      ),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }

  if (url.includes('/api/app/v1/projects')) {
    return new Response(
      JSON.stringify(
        createListEnvelope([
          {
            id: 'project-runtime-contract',
            workspaceId: 'workspace-runtime-contract',
            name: 'Runtime Contract Project',
            description: 'Project loaded through shell runtime app client.',
            rootPath: 'D:/workspace/runtime-contract-project',
            status: 'active',
            createdAt: '2026-04-10T00:00:01.000Z',
            updatedAt: '2026-04-10T00:00:01.000Z',
          },
        ]),
      ),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }

  if (url.includes('/api/core/v1/coding-sessions')) {
    return new Response(
      JSON.stringify(createListEnvelope([])),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }

  return new Response(
    JSON.stringify({
      message: `Unhandled request: ${url}`,
    }),
    {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
}) as typeof fetch;

try {
  const {
    bindDefaultBirdCoderIdeServicesRuntime,
    getDefaultBirdCoderIdeServicesRuntimeConfig,
    resetDefaultBirdCoderIdeServicesRuntimeForTests: resetDefaultBirdCoderIdeServicesRuntime,
  } = await import(defaultIdeServicesRuntimeModulePath.href);
  const { createBirdCoderHttpApiTransport } = await import(
    `${appAdminApiClientModulePath.href}?t=${Date.now()}`
  );
  const {
    createBirdCoderGeneratedAppAdminApiClient,
    createBirdCoderGeneratedCoreReadApiClient,
  } = await import(`${typesEntryModulePath.href}?t=${Date.now()}`);
  const { ApiBackedWorkspaceService } = await import(
    `${apiBackedWorkspaceServiceModulePath.href}?t=${Date.now()}`
  );
  const { ApiBackedProjectService } = await import(
    `${apiBackedProjectServiceModulePath.href}?t=${Date.now()}`
  );

  resetDefaultBirdCoderIdeServicesRuntimeForTests =
    resetDefaultBirdCoderIdeServicesRuntime;
  resetDefaultBirdCoderIdeServicesRuntimeForTests();

  const bootstrapEntrySource = readFileSync(bootstrapModulePath, 'utf8');
  const bootstrapImplSource = readFileSync(bootstrapImplSourcePath, 'utf8');
  assert.match(
    bootstrapEntrySource,
    /const module = await import\('\.\/loadBootstrapShellRuntimeImpl\.ts'\);/u,
    'shell runtime entry must continue to lazy-load the concrete bootstrap implementation.',
  );
  assert.match(
    bootstrapImplSource,
    /bindDefaultBirdCoderIdeServicesRuntime\(options\);/u,
    'shell runtime bootstrap must bind the default IDE services runtime before consumers resolve app/core clients.',
  );
  assert.match(
    bootstrapImplSource,
    /const \[coreReadService, coreWriteService\] = await Promise\.all\(\[[\s\S]*loadDefaultBirdCoderIdeService\('coreReadService'\),[\s\S]*loadDefaultBirdCoderIdeService\('coreWriteService'\),[\s\S]*\]\);[\s\S]*await bootstrapShellUserState\(\{[\s\S]*coreReadService,[\s\S]*coreWriteService,[\s\S]*\}\);/u,
    'shell runtime bootstrap must initialize persisted shell user state with bound core services so model-config synchronization uses the same runtime authority.',
  );

  bindDefaultBirdCoderIdeServicesRuntime({
    host: {
      mode: 'desktop',
      appId: 'sdkwork-birdcoder-cn',
      appName: 'SDKWork BirdCoder',
      distributionId: 'cn',
      apiBaseUrl: 'https://cn.sdkwork.local/birdcoder',
    },
  } as never);

  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  assert.equal(
    runtimeConfig.apiBaseUrl,
    'https://cn.sdkwork.local/birdcoder',
    'shell runtime bootstrap must normalize the host apiBaseUrl without appending an extra /api segment.',
  );
  assert.equal(
    runtimeConfig.executionAuthorityMode,
    'remote-required',
    'shell runtime bootstrap must require remote authority composition when an apiBaseUrl is bound.',
  );

  const infrastructureEntrySource = readFileSync(
    infrastructureEntrySourcePath,
    'utf8',
  );
  const defaultIdeServicesSource = readFileSync(
    defaultIdeServicesSourcePath,
    'utf8',
  );
  assert.match(
    infrastructureEntrySource,
    /export \* from '\.\/services\/defaultIdeServices\.ts';/u,
    'the infrastructure root entry must continue to expose the canonical default IDE services entrypoint.',
  );
  assert.match(
    defaultIdeServicesSource,
    /new ApiBackedWorkspaceService\(/u,
    'default IDE services must continue to compose the authoritative app workspace service.',
  );
  assert.match(
    defaultIdeServicesSource,
    /new ApiBackedProjectService\(/u,
    'default IDE services must continue to compose the authoritative project service with app/core clients.',
  );

  const transport = createBirdCoderHttpApiTransport({
    baseUrl: runtimeConfig.apiBaseUrl!,
    fetchImpl: globalThis.fetch,
  });
  const appAdminClient = createBirdCoderGeneratedAppAdminApiClient({
    transport,
  });
  const coreReadClient = createBirdCoderGeneratedCoreReadApiClient({
    transport,
  });
  const workspaceMirror = createWorkspaceMirror();
  const projectMirror = createProjectMirror();
  const workspaceService = new ApiBackedWorkspaceService({
    client: appAdminClient,
    workspaceMirror,
    writeService: workspaceMirror.writeService,
  });
  const projectService = new ApiBackedProjectService({
    client: appAdminClient,
    coreReadClient,
    projectMirror,
    writeService: projectMirror.writeService,
  });

  await workspaceService.getWorkspaces();
  await projectService.getProjects('workspace-runtime-contract');

  assert.deepEqual(
    requests,
    [
      {
        method: 'GET',
        url: 'https://cn.sdkwork.local/birdcoder/api/app/v1/workspaces',
      },
      {
        method: 'GET',
        url: 'https://cn.sdkwork.local/birdcoder/api/app/v1/projects?workspaceId=workspace-runtime-contract',
      },
      {
        method: 'GET',
        url: 'https://cn.sdkwork.local/birdcoder/api/core/v1/coding-sessions?workspaceId=workspace-runtime-contract',
      },
    ],
    'shell runtime defaults must normalize the host apiBaseUrl and route app/core authority HTTP transport without duplicating the /api prefix.',
  );

  const ideContextSource = readFileSync(ideContextSourcePath, 'utf8');
  const serviceContextSource = readFileSync(serviceContextSourcePath, 'utf8');

  assert.ok(
    ideContextSource.includes('const IDEContext = createContext<IIDEContext | null>(null);') &&
      ideContextSource.includes('const defaultContextRef = useRef<IIDEContext | null>(null);'),
    'IDEContext must resolve default IDE services lazily inside provider or hook boundaries.',
  );
  assert.ok(
    serviceContextSource.includes('const ServiceContext = createContext<IServices | null>(null);') &&
      serviceContextSource.includes('const defaultServicesRef = useRef<IServices | null>(null);'),
    'ServiceContext must resolve default IDE services lazily inside provider or hook boundaries.',
  );
} finally {
  resetDefaultBirdCoderIdeServicesRuntimeForTests?.();

  if (originalFetch) {
    globalThis.fetch = originalFetch;
  } else {
    Reflect.deleteProperty(globalThis, 'fetch');
  }

  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

console.log('shell runtime app client contract passed.');
