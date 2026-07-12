import assert from 'node:assert/strict';
import type { BirdCoderApiTransportRequest } from '@sdkwork/birdcoder-pc-types';

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

const workspaceId = 'workspace-project-pagination-contract';
const createdAt = '2026-07-10T00:00:00.000Z';
const expectedProjectIds = Array.from(
  { length: 20 },
  (_, index) => `project-pagination-${String(index + 21).padStart(2, '0')}`,
);
const localStorageValues = new Map<string, string>();
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: {
      getItem(key: string) {
        return localStorageValues.get(key) ?? null;
      },
      removeItem(key: string) {
        localStorageValues.delete(key);
      },
      setItem(key: string, value: string) {
        localStorageValues.set(key, value);
      },
    },
  },
});

try {
  const { createBirdCoderStorageProvider } = await import(
    `${dataKernelModulePath.href}?t=${Date.now()}`,
  );
  const { createBirdCoderConsoleRepositories } = await import(
    `${consoleRepositoryModulePath.href}?t=${Date.now()}`,
  );
  const { createBirdCoderConsoleQueries } = await import(
    `${consoleQueriesModulePath.href}?t=${Date.now()}`,
  );
  const { createBirdCoderInProcessAppSdkTransport } = await import(
    `${appSdkTransportModulePath.href}?t=${Date.now()}`,
  );
  const { createBirdCoderGeneratedAppSdkClient } = await import(
    `${sdkClientsModulePath.href}?t=${Date.now()}`,
  );

  const provider = createBirdCoderStorageProvider('sqlite');
  const repositories = createBirdCoderConsoleRepositories({
    providerId: provider.providerId,
    storage: provider,
  });
  await Promise.all([
    repositories.projectContents.clear(),
    repositories.projects.clear(),
    repositories.workspaces.clear(),
  ]);
  await repositories.workspaces.save({
    createdAt,
    description: 'Workspace used to verify in-process project pagination.',
    id: workspaceId,
    name: 'Project Pagination Contract Workspace',
    ownerId: 'user-project-pagination-contract',
    status: 'active',
    updatedAt: createdAt,
  });

  for (let index = 1; index <= 41; index += 1) {
    const projectId = `project-pagination-${String(index).padStart(2, '0')}`;
    await repositories.projects.save({
      createdAt,
      description: `Project ${index} for the pagination contract.`,
      id: projectId,
      name: `Project Pagination ${String(index).padStart(2, '0')}`,
      status: 'active',
      updatedAt: createdAt,
      workspaceId,
    });
    await repositories.projectContents.save({
      configData: JSON.stringify({
        rootPath: `D:/workspace/project-pagination/${String(index).padStart(2, '0')}`,
      }),
      contentVersion: '1.0',
      createdAt,
      id: `project-content-pagination-${String(index).padStart(2, '0')}`,
      projectId,
      projectUuid: `project-${projectId}`,
      updatedAt: createdAt,
    });
  }

  repositories.projects.list = async () => {
    throw new Error('Project pagination must not materialize the complete project inventory.');
  };
  repositories.workspaces.list = async () => {
    throw new Error('Project pagination must not materialize the complete workspace inventory.');
  };

  const observedRequests: BirdCoderApiTransportRequest[] = [];
  const transport = createBirdCoderInProcessAppSdkTransport({
    observe(request) {
      observedRequests.push(request);
    },
    queries: createBirdCoderConsoleQueries({ repositories }),
  });
  const appSdkClient = createBirdCoderGeneratedAppSdkClient({ transport });
  const projectPage = await appSdkClient.platform.projects.list({
    page: 2,
    page_size: 20,
    workspaceId,
  });

  assert.deepEqual(
    observedRequests.map((request) => ({
      method: request.method,
      path: request.path,
      query: request.query,
    })),
    [
      {
        method: 'GET',
        path: '/app/v3/api/projects',
        query: {
          page: 2,
          page_size: 20,
          workspaceId,
        },
      },
    ],
    'the composed app SDK must preserve the standard page and page_size query wire.',
  );
  assert.equal(expectedProjectIds.length, 20, 'the page-two fixture must contain exactly 20 projects.');
  assert.deepEqual(
    {
      itemIds: projectPage.data.items.map((project) => project.id),
      pageInfo: projectPage.data.pageInfo,
    },
    {
      itemIds: expectedProjectIds,
      pageInfo: {
        hasMore: true,
        mode: 'offset',
        page: 2,
        pageSize: 20,
        totalItems: '41',
        totalPages: 3,
      },
    },
    'project page two must expose only its 20 server-selected records with complete offset PageInfo.',
  );

  await assert.rejects(
    () =>
      appSdkClient.platform.projects.list({
        page: 1,
        page_size: 20,
        rootPath: 'D:/workspace/project-pagination/01',
        workspaceId,
      }),
    (error: unknown) => {
      if (!error || typeof error !== 'object') {
        return false;
      }
      const typedError = error as {
        code?: unknown;
        httpStatus?: unknown;
        traceId?: unknown;
      };
      return (
        typedError.code === 42201 &&
        typedError.httpStatus === 422 &&
        typeof typedError.traceId === 'string' &&
        typedError.traceId.length > 0
      );
    },
    'an unindexed rootPath filter must fail closed with a standard typed transport error.',
  );
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

console.log('in-process app SDK project pagination contract passed.');
