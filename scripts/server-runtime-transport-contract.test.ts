import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BIRDCODER_DEFAULT_LOCAL_API_BASE_URL,
  createBirdHostDescriptorFromDistribution,
} from '../packages/sdkwork-birdcoder-host-core/src/index.ts';

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

const serverEntrySourcePath = new URL(
  '../packages/sdkwork-birdcoder-server/src/index.ts',
  import.meta.url,
);
const serverRuntimeDefaultIdeServicesRuntimeModulePath = new URL(
  '../packages/sdkwork-birdcoder-server/node_modules/@sdkwork/birdcoder-infrastructure/src/services/defaultIdeServicesRuntime.ts',
  import.meta.url,
);
const appAdminApiClientModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts',
  import.meta.url,
);
const serverApiModulePath = new URL(
  '../packages/sdkwork-birdcoder-types/src/server-api.ts',
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
  const {
    bindDefaultBirdCoderIdeServicesRuntime,
    getDefaultBirdCoderIdeServicesRuntimeConfig,
    resetDefaultBirdCoderIdeServicesRuntimeForTests,
  } = await import(serverRuntimeDefaultIdeServicesRuntimeModulePath.href);
  const { createBirdCoderHttpApiTransport } = await import(
    `${appAdminApiClientModulePath.href}?t=${Date.now()}`
  );
  const {
    createBirdCoderGeneratedAppAdminApiClient,
    createBirdCoderGeneratedCoreReadApiClient,
  } = await import(`${serverApiModulePath.href}?t=${Date.now()}`);

  resetDefaultBirdCoderIdeServicesRuntimeForTests();
  const serverIndexSource = readFileSync(serverEntrySourcePath, 'utf8');
  assert.match(
    serverIndexSource,
    /export async function bindBirdCoderServerRuntimeTransport\(/u,
    'coding-server entry must continue to expose the canonical runtime transport binder.',
  );
  assert.match(
    serverIndexSource,
    /const host = options\.host \?\? resolveServerRuntime\(options\.distributionId\);/u,
    'server runtime binding must continue to derive the host descriptor from the canonical server runtime resolver when no host override is supplied.',
  );
  assert.match(
    serverIndexSource,
    /cn:\s*'https:\/\/cn\.sdkwork\.local\/birdcoder'/u,
    'server runtime binding must keep the cn runtime transport base URL normalized to the canonical authority host.',
  );
  assert.match(
    serverIndexSource,
    /options\.apiBaseUrl \?\?\s*\(options\.host \? undefined : BIRD_SERVER_RUNTIME_TRANSPORT_BASE_URLS\[distributionId\]\)/u,
    'server runtime binding must continue to prefer the canonical runtime transport base URL when only a distribution id is supplied.',
  );

  const host = createBirdHostDescriptorFromDistribution(
    'server',
    {
      id: 'cn',
      appId: 'sdkwork-birdcoder-cn',
      appName: 'SDKWork BirdCoder',
      apiBaseUrl: BIRDCODER_DEFAULT_LOCAL_API_BASE_URL,
    },
  );
  bindDefaultBirdCoderIdeServicesRuntime({
    apiBaseUrl: 'https://cn.sdkwork.local/birdcoder',
    host,
  });

  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  assert.equal(
    runtimeConfig.apiBaseUrl,
    'https://cn.sdkwork.local/birdcoder',
    'server runtime binding must normalize the distribution host base URL without adding an extra /api segment.',
  );
  assert.equal(runtimeConfig.executionAuthorityMode, 'remote-required');

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

  await appAdminClient.listWorkspaces();
  await appAdminClient.listProjects({
    workspaceId: 'workspace-server-runtime-contract',
  });
  await coreReadClient.listCodingSessions({
    workspaceId: 'workspace-server-runtime-contract',
  });
  await appAdminClient.listTeams({
    workspaceId: 'workspace-server-runtime-contract',
  });

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
    'server runtime binding must normalize the distribution host base URL and generated clients must route both app and core authority calls without duplicating the /api prefix.',
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
