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
  id: 'codex-native:native-session-migrate',
  workspaceId: '',
  projectId: '',
  title: 'Continue imported project bootstrap',
  status: 'paused',
  hostMode: 'desktop',
  engineId: 'codex',
  modelId: 'codex',
  createdAt: '2026-04-16T11:00:00.000Z',
  updatedAt: '2026-04-16T11:10:00.000Z',
  lastTurnAt: '2026-04-16T11:10:00.000Z',
  nativeCwd: 'D:\\repos\\birdcoder\\packages\\sdkwork-birdcoder-code',
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
  role: 'user',
  content: 'Preserve this mirrored message while migrating the thread.',
});

const importedProject = await projectService.createProject('ws-1', 'BirdCoder Repo');
await projectService.updateProject(importedProject.id, {
  path: 'D:\\repos\\birdcoder',
});

const secondPass = await ensureNativeCodexSessionMirror({
  inventory: [nativeSessionRecord],
  projectService,
  workspaceId: 'ws-1',
});

assert.ok(secondPass, 'The second pass should re-evaluate native session attribution after import.');

const projectsAfterProjectImport = await projectService.getProjects('ws-1');
const migratedProject = projectsAfterProjectImport.find((project) => project.id === importedProject.id);
const refreshedFallbackProject = projectsAfterProjectImport.find((project) => project.id === fallbackProject!.id);
const migratedSession = migratedProject?.codingSessions.find(
  (session) => session.id === nativeSessionRecord.id,
);

assert.ok(
  migratedSession,
  'A native session whose cwd falls under an imported project path should migrate into that project.',
);
assert.equal(
  refreshedFallbackProject?.codingSessions.some((session) => session.id === nativeSessionRecord.id),
  false,
  'Migrated native sessions must be removed from the fallback project to avoid duplicate sidebar entries.',
);
assert.deepEqual(
  migratedSession?.messages.map((message) => message.content),
  ['Preserve this mirrored message while migrating the thread.'],
  'Migrating a native session into the imported project must preserve the previously mirrored local message history.',
);

console.log('native codex session project attribution contract passed.');
