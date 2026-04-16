import assert from 'node:assert/strict';

const mirrorModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/nativeCodexSessionMirror.ts',
  import.meta.url,
);
const mockProjectServiceModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/services/impl/MockProjectService.ts',
  import.meta.url,
);

const { ensureNativeCodexSessionMirror } = await import(`${mirrorModulePath.href}?t=${Date.now()}`);
const { MockProjectService } = await import(`${mockProjectServiceModulePath.href}?t=${Date.now()}`);

const projectService = new MockProjectService();

const nativeSessionRecord = {
  id: 'codex-native:native-session-browser-import',
  workspaceId: '',
  projectId: '',
  title: 'Resume browser imported project session',
  status: 'paused',
  hostMode: 'desktop',
  engineId: 'codex',
  modelId: 'codex',
  createdAt: '2026-04-16T11:00:00.000Z',
  updatedAt: '2026-04-16T11:10:00.000Z',
  lastTurnAt: '2026-04-16T11:10:00.000Z',
  nativeCwd: 'D:\\repos\\birdcoder',
  kind: 'coding' as const,
  sortTimestamp: Date.parse('2026-04-16T11:10:00.000Z'),
};

const firstPass = await ensureNativeCodexSessionMirror({
  inventory: [nativeSessionRecord],
  projectService,
  workspaceId: 'ws-1',
});

assert.ok(firstPass, 'The first pass should mirror the discovered native session.');

const projectsAfterFallbackMirror = await projectService.getProjects('ws-1');
const fallbackProject = projectsAfterFallbackMirror.find((project) => project.name === 'Codex Sessions');

assert.ok(
  fallbackProject?.codingSessions.some((session) => session.id === nativeSessionRecord.id),
  'Native sessions without a matching imported project should land in the managed fallback project.',
);

await projectService.addCodingSessionMessage(fallbackProject!.id, nativeSessionRecord.id, {
  role: 'assistant',
  content: 'Preserve this mirrored message while migrating the browser-imported session.',
});

const importedProject = await projectService.createProject('ws-1', 'birdcoder');
await projectService.updateProject(importedProject.id, {
  path: '/birdcoder',
});

const secondPass = await ensureNativeCodexSessionMirror({
  inventory: [nativeSessionRecord],
  projectService,
  workspaceId: 'ws-1',
});

assert.ok(secondPass, 'The second pass should re-evaluate browser-imported project attribution.');

const projectsAfterBrowserImport = await projectService.getProjects('ws-1');
const migratedProject = projectsAfterBrowserImport.find((project) => project.id === importedProject.id);
const refreshedFallbackProject = projectsAfterBrowserImport.find((project) => project.id === fallbackProject!.id);
const migratedSession = migratedProject?.codingSessions.find(
  (session) => session.id === nativeSessionRecord.id,
);

assert.ok(
  migratedSession,
  'A native session should migrate into a browser-imported project when the imported folder name matches the native Codex cwd basename.',
);
assert.equal(
  refreshedFallbackProject?.codingSessions.some((session) => session.id === nativeSessionRecord.id),
  false,
  'Migrated native sessions must be removed from the fallback project after browser import.',
);
assert.deepEqual(
  migratedSession?.messages.map((message) => message.content),
  ['Preserve this mirrored message while migrating the browser-imported session.'],
  'Migrating a native session into a browser-imported project must preserve previously mirrored messages.',
);

console.log('native codex session browser project attribution contract passed.');
