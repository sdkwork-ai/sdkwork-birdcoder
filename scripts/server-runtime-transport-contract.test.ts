import assert from 'node:assert/strict';

interface CapturedRequest {
  method: string;
  url: string;
}

function createListEnvelope<TItem>(items: readonly TItem[]) {
  return {
    requestId: 'req.server-runtime-transport-contract',
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

const serverEntryModulePath = new URL(
  '../packages/sdkwork-birdcoder-server/src/index.ts',
  import.meta.url,
);
const infrastructureEntryModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/index.ts',
  import.meta.url,
);

const requests: CapturedRequest[] = [];
const localStore = new Map<string, string>();
const originalFetch = globalThis.fetch;
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

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
            id: 'workspace-server-runtime-contract',
            name: 'Server Runtime Contract Workspace',
            description: 'Workspace loaded through server runtime binding.',
            ownerId: 'user-server-runtime-contract',
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
            id: 'project-server-runtime-contract',
            workspaceId: 'workspace-server-runtime-contract',
            name: 'Server Runtime Contract Project',
            description: 'Project loaded through server runtime binding.',
            rootPath: 'D:/workspace/server-runtime-contract-project',
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

  if (url.includes('/api/app/v1/teams')) {
    return new Response(
      JSON.stringify(
        createListEnvelope([
          {
            id: 'team-server-runtime-contract',
            workspaceId: 'workspace-server-runtime-contract',
            name: 'Server Runtime Contract Team',
            description: 'Team loaded through server runtime binding.',
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
  const { bindBirdCoderServerRuntimeTransport } = await import(
    `${serverEntryModulePath.href}?t=${Date.now()}`
  );
  const {
    createDefaultBirdCoderIdeServices,
    resetDefaultBirdCoderIdeServicesRuntimeForTests,
  } = await import(`${infrastructureEntryModulePath.href}?t=${Date.now()}`);

  resetDefaultBirdCoderIdeServicesRuntimeForTests();
  bindBirdCoderServerRuntimeTransport({
    distributionId: 'cn',
  });

  const services = createDefaultBirdCoderIdeServices();

  await services.workspaceService.getWorkspaces();
  await services.projectService.getProjects('workspace-server-runtime-contract');
  await services.teamService.getTeams('workspace-server-runtime-contract');

  assert.deepEqual(
    requests,
    [
      {
        method: 'GET',
        url: 'https://cn.sdkwork.local/birdcoder/api/app/v1/workspaces',
      },
      {
        method: 'GET',
        url: 'https://cn.sdkwork.local/birdcoder/api/app/v1/projects?workspaceId=workspace-server-runtime-contract',
      },
      {
        method: 'GET',
        url: 'https://cn.sdkwork.local/birdcoder/api/core/v1/coding-sessions?workspaceId=workspace-server-runtime-contract',
      },
      {
        method: 'GET',
        url: 'https://cn.sdkwork.local/birdcoder/api/app/v1/teams?workspaceId=workspace-server-runtime-contract',
      },
    ],
    'server runtime binding must normalize the distribution host base URL and route both app and core authority calls without duplicating the /api prefix.',
  );

  resetDefaultBirdCoderIdeServicesRuntimeForTests();
} finally {
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

console.log('server runtime transport contract passed.');
