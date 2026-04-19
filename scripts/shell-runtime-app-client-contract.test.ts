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
  '../packages/sdkwork-birdcoder-shell/src/application/bootstrap/bootstrapShellRuntime.ts',
  import.meta.url,
);
const infrastructureEntryModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/index.ts',
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
  const { createDefaultBirdCoderIdeServices } = await import(infrastructureEntryModulePath.href);
  const { bootstrapShellRuntime } = await import(
    `${bootstrapModulePath.href}?t=${Date.now()}`
  );

  bootstrapShellRuntime({
    host: {
      mode: 'desktop',
      appId: 'sdkwork-birdcoder-cn',
      appName: 'SDKWork BirdCoder',
      distributionId: 'cn',
      apiBaseUrl: 'https://cn.sdkwork.local/birdcoder',
    },
  } as never);

  const services = createDefaultBirdCoderIdeServices();

  await services.workspaceService.getWorkspaces();
  await services.projectService.getProjects('workspace-runtime-contract');

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
