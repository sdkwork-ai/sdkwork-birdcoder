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

const result = await ensureNativeCodexSessionMirror({
  inventory: [
    {
      id: 'codex-native:native-session-1',
      workspaceId: '',
      projectId: '',
      title: 'Resume BirdCoder bootstrap hardening',
      status: 'paused',
      hostMode: 'desktop',
      engineId: 'codex',
      modelId: 'codex',
      createdAt: '2026-04-16T10:00:00.000Z',
      updatedAt: '2026-04-16T10:30:00.000Z',
      lastTurnAt: '2026-04-16T10:30:00.000Z',
      kind: 'coding',
      sortTimestamp: Date.parse('2026-04-16T10:30:00.000Z'),
    },
    {
      id: 'coding-session-local-1',
      workspaceId: 'ws-1',
      projectId: 'p1',
      title: 'Local session should be ignored',
      status: 'active',
      hostMode: 'desktop',
      engineId: 'codex',
      modelId: 'codex',
      createdAt: '2026-04-16T10:00:00.000Z',
      updatedAt: '2026-04-16T10:30:00.000Z',
      lastTurnAt: '2026-04-16T10:30:00.000Z',
      kind: 'coding',
      sortTimestamp: Date.parse('2026-04-16T10:30:00.000Z'),
    },
  ],
  projectService,
  workspaceId: 'ws-1',
});

assert.equal(result?.mirroredSessionIds.includes('codex-native:native-session-1'), true);

const firstPassProjects = await projectService.getProjects('ws-1');
const nativeMirrorProject = firstPassProjects.find((project) => project.name === 'Codex Sessions');

assert.ok(nativeMirrorProject, 'native Codex sessions should be mirrored into a dedicated project.');
assert.equal(
  nativeMirrorProject?.description,
  'Managed BirdCoder mirror for imported local Codex sessions.',
  'the dedicated native Codex mirror project should carry a deterministic management marker.',
);
assert.deepEqual(
  nativeMirrorProject?.codingSessions.map((session) => session.id),
  ['codex-native:native-session-1'],
  'only native Codex sessions should be mirrored into the dedicated project surface.',
);
assert.equal(
  nativeMirrorProject?.codingSessions[0]?.title,
  'Resume BirdCoder bootstrap hardening',
);

await projectService.addCodingSessionMessage(nativeMirrorProject!.id, 'codex-native:native-session-1', {
  role: 'user',
  content: 'Continue the mirrored native session.',
});

await ensureNativeCodexSessionMirror({
  inventory: [
    {
      id: 'codex-native:native-session-1',
      workspaceId: '',
      projectId: '',
      title: 'Resume BirdCoder bootstrap hardening (updated)',
      status: 'active',
      hostMode: 'desktop',
      engineId: 'codex',
      modelId: 'codex',
      createdAt: '2026-04-16T10:00:00.000Z',
      updatedAt: '2026-04-16T10:35:00.000Z',
      lastTurnAt: '2026-04-16T10:35:00.000Z',
      kind: 'coding',
      sortTimestamp: Date.parse('2026-04-16T10:35:00.000Z'),
    },
  ],
  projectService,
  workspaceId: 'ws-1',
});

const secondPassProjects = await projectService.getProjects('ws-1');
const secondPassNativeProjects = secondPassProjects.filter((project) => project.name === 'Codex Sessions');
const mirroredSession = secondPassNativeProjects[0]?.codingSessions.find(
  (session) => session.id === 'codex-native:native-session-1',
);

assert.equal(
  secondPassNativeProjects.length,
  1,
  'native Codex mirroring should be idempotent and must not duplicate the managed project.',
);
assert.equal(
  mirroredSession?.title,
  'Resume BirdCoder bootstrap hardening (updated)',
  'native Codex mirroring should refresh session metadata from the latest inventory snapshot.',
);
assert.equal(
  mirroredSession?.messages.length,
  1,
  'native Codex mirroring must preserve previously mirrored local message history.',
);

console.log('native codex session mirror contract passed.');
