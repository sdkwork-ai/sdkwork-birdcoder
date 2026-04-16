import assert from 'node:assert/strict';

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
  const { createDefaultBirdCoderIdeServices } = await import(
    `${defaultServicesModulePath.href}?t=${Date.now()}`
  );

  const serviceA = createDefaultBirdCoderIdeServices();
  const createdWorkspace = await serviceA.workspaceService.createWorkspace(
    'Concurrent Coding Session Workspace',
    'Workspace used to detect stale-cache session overwrites.',
  );
  const createdProject = await serviceA.projectService.createProject(
    createdWorkspace.id,
    'Concurrent Coding Session Project',
  );

  const serviceB = createDefaultBirdCoderIdeServices();

  await serviceA.projectService.getProjects(createdWorkspace.id);
  await serviceB.projectService.getProjects(createdWorkspace.id);

  const sessionA = await serviceA.projectService.createCodingSession(
    createdProject.id,
    'Concurrent Session A',
  );
  const sessionB = await serviceB.projectService.createCodingSession(
    createdProject.id,
    'Concurrent Session B',
  );

  const reloadedServices = createDefaultBirdCoderIdeServices();
  const reloadedProjects = await reloadedServices.projectService.getProjects(createdWorkspace.id);
  const reloadedProject = reloadedProjects.find((project) => project.id === createdProject.id);

  assert.ok(reloadedProject, 'reloaded services must still resolve the created project.');
  assert.deepEqual(
    reloadedProject?.codingSessions.map((session) => session.id).sort(),
    [sessionA.id, sessionB.id].sort(),
    'concurrent IDE services must merge persisted coding sessions instead of overwriting each other with stale in-memory caches.',
  );
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

console.log('coding session concurrent persistence contract passed.');
