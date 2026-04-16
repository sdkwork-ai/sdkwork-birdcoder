import assert from 'node:assert/strict';

const defaultServicesModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts',
  import.meta.url,
);
const sessionInventoryModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/sessionInventory.ts',
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
  const { listStoredCodingSessions } = await import(
    `${sessionInventoryModulePath.href}?t=${Date.now()}`
  );

  const services = createDefaultBirdCoderIdeServices();
  const createdWorkspace = await services.workspaceService.createWorkspace(
    'Coding Session Persistence Workspace',
    'Workspace used to verify coding session persistence.',
  );
  const createdProject = await services.projectService.createProject(
    createdWorkspace.id,
    'Coding Session Persistence Project',
  );
  const createdSession = await services.projectService.createCodingSession(
    createdProject.id,
    'Persistent Session',
    {
      engineId: 'codex',
      modelId: 'codex',
    },
  );
  const createdMessage = await services.projectService.addCodingSessionMessage(
    createdProject.id,
    createdSession.id,
    {
      role: 'user',
      content: 'Persist this coding session across service recreation.',
    },
  );

  const reloadedServices = createDefaultBirdCoderIdeServices();
  const reloadedProjects = await reloadedServices.projectService.getProjects(createdWorkspace.id);
  const reloadedProject = reloadedProjects.find((project) => project.id === createdProject.id);
  const storedCodingSessions = await listStoredCodingSessions({
    projectId: createdProject.id,
  });

  assert.ok(reloadedProject, 'reloaded services must still resolve the created project.');
  assert.deepEqual(
    reloadedProject?.codingSessions.map((session) => ({
      id: session.id,
      title: session.title,
      engineId: session.engineId,
      modelId: session.modelId,
      messages: session.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
      })),
    })),
    [
      {
        id: createdSession.id,
        title: 'Persistent Session',
        engineId: 'codex',
        modelId: 'codex',
        messages: [
          {
            id: createdMessage.id,
            role: 'user',
            content: 'Persist this coding session across service recreation.',
          },
        ],
      },
    ],
    'coding sessions and projected messages must persist across service recreation.',
  );
  assert.deepEqual(
    storedCodingSessions.map((session) => session.id),
    [createdSession.id],
    'coding session inventory must enumerate the persisted session from canonical storage.',
  );
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

console.log('coding session persistence contract passed.');
