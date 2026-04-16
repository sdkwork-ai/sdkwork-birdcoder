import assert from 'node:assert/strict';

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
  const { createDefaultBirdCoderIdeServices } = await import(
    `${defaultServicesModulePath.href}?t=${Date.now()}`
  );

  const provider = createBirdCoderStorageProvider('sqlite');
  const repositories = createBirdCoderConsoleRepositories({
    providerId: 'sqlite',
    storage: provider,
  });
  const queries = createBirdCoderAppAdminConsoleQueries({ repositories });

  await Promise.all([
    repositories.workspaces.clear(),
    repositories.projects.clear(),
  ]);

  const bootstrappedWorkspaces = await queries.listWorkspaces();
  assert.deepEqual(
    bootstrappedWorkspaces.map((workspace) => workspace.id),
    ['workspace-default'],
    'console queries must bootstrap a default workspace when storage is empty.',
  );

  const bootstrappedProjects = await queries.listProjects({ workspaceId: 'workspace-default' });
  assert.deepEqual(
    bootstrappedProjects.map((project) => project.id),
    ['project-default'],
    'console queries must bootstrap a default starter project for the default workspace when storage is empty.',
  );

  const services = createDefaultBirdCoderIdeServices({
    storageProvider: provider,
  });
  const serviceWorkspaces = await services.workspaceService.getWorkspaces();
  const serviceProjects = await services.projectService.getProjects('workspace-default');

  assert.deepEqual(
    serviceWorkspaces.map((workspace) => workspace.id),
    ['workspace-default'],
    'default IDE services must surface the bootstrapped default workspace.',
  );
  assert.deepEqual(
    serviceProjects.map((project) => project.id),
    ['project-default'],
    'default IDE services must surface the bootstrapped starter project.',
  );
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

console.log('console default bootstrap contract passed.');
