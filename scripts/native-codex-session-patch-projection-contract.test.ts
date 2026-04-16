import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const storeModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/nativeCodexSessionStore.ts',
  import.meta.url,
);
const mirrorModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/nativeCodexSessionMirror.ts',
  import.meta.url,
);
const mockProjectServiceModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/services/impl/MockProjectService.ts',
  import.meta.url,
);

async function withTemporaryCodexHome<T>(callback: (codexHome: string) => Promise<T>): Promise<T> {
  const codexHome = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-native-codex-patch-'));
  const originalCodexHome = process.env.CODEX_HOME;

  process.env.CODEX_HOME = codexHome;

  try {
    return await callback(codexHome);
  } finally {
    if (originalCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = originalCodexHome;
    }

    await rm(codexHome, { recursive: true, force: true });
  }
}

await withTemporaryCodexHome(async (codexHome) => {
  const sessionsDirectory = path.join(codexHome, 'sessions', '2026', '04', '16');
  await mkdir(sessionsDirectory, { recursive: true });

  await writeFile(
    path.join(sessionsDirectory, 'native-patch-session.jsonl'),
    [
      JSON.stringify({
        timestamp: '2026-04-16T11:00:00.000Z',
        type: 'session_meta',
        payload: {
          id: 'native-patch-session',
          timestamp: '2026-04-16T11:00:00.000Z',
          cwd: 'D:/workspace/birdcoder',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T11:01:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'user_message',
          turn_id: 'turn-1',
          message: 'Add a startup recovery banner',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T11:02:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'apply_patch_approval_request',
          call_id: 'patch-1',
          turn_id: 'turn-1',
          reason: 'Need write access to update the desktop shell.',
          changes: {
            'src/App.tsx': {
              type: 'update',
              unified_diff: '@@ -1,1 +1,2 @@\n-old line\n+new line\n+banner line\n',
              move_path: null,
            },
            'src/banner.ts': {
              type: 'add',
              content: 'export const banner = true;\n',
            },
          },
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T11:03:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'patch_apply_end',
          call_id: 'patch-1',
          turn_id: 'turn-1',
          success: true,
          status: 'completed',
          stdout: 'Applied patch successfully.',
          stderr: '',
          changes: {
            'src/App.tsx': {
              type: 'update',
              unified_diff: '@@ -1,1 +1,2 @@\n-old line\n+new line\n+banner line\n',
              move_path: null,
            },
            'src/banner.ts': {
              type: 'add',
              content: 'export const banner = true;\n',
            },
          },
        },
      }),
    ].join('\n'),
    'utf8',
  );

  const moduleVersion = Date.now();
  const { readNativeCodexSessionRecord } = await import(`${storeModulePath.href}?t=${moduleVersion}`);
  const { ensureNativeCodexSessionMirror } = await import(`${mirrorModulePath.href}?t=${moduleVersion}`);
  const { MockProjectService } = await import(`${mockProjectServiceModulePath.href}?t=${moduleVersion}`);

  const record = await readNativeCodexSessionRecord('codex-native:native-patch-session');

  assert.ok(record, 'native Codex session record should resolve patch-bearing sessions.');
  assert.equal(
    record?.summary.transcriptUpdatedAt,
    '2026-04-16T11:03:00.000Z',
    'patch approval and completion should advance the visible transcript freshness timestamp.',
  );
  assert.deepEqual(
    record?.messages.map((message) => ({
      role: message.role,
      content: message.content,
      fileChanges: message.fileChanges,
    })),
    [
      {
        role: 'user',
        content: 'Add a startup recovery banner',
        fileChanges: undefined,
      },
      {
        role: 'reviewer',
        content: [
          'Patch approval required for 2 file(s):',
          '- src/App.tsx (+2 -1)',
          '- src/banner.ts (+1 -0)',
          'Reason: Need write access to update the desktop shell.',
        ].join('\n'),
        fileChanges: undefined,
      },
      {
        role: 'tool',
        content: [
          'Patch completed for 2 file(s):',
          '- src/App.tsx (+2 -1)',
          '- src/banner.ts (+1 -0)',
          'Output: Applied patch successfully.',
        ].join('\n'),
        fileChanges: undefined,
      },
    ],
    'native Codex parser should project patch approval and patch completion events into visible session messages without emitting unsafe reversible file snapshots.',
  );

  const projectService = new MockProjectService();
  await ensureNativeCodexSessionMirror({
    inventory: [record!.summary],
    projectService,
    workspaceId: 'ws-1',
  });

  const mirroredSession = (await projectService.getProjects('ws-1'))
    .find((project) => project.name === 'Codex Sessions')
    ?.codingSessions.find((codingSession) => codingSession.id === 'codex-native:native-patch-session');

  assert.deepEqual(
    mirroredSession?.messages.map((message) => ({
      role: message.role,
      content: message.content,
      fileChanges: message.fileChanges,
    })),
    [
      {
        role: 'user',
        content: 'Add a startup recovery banner',
        fileChanges: undefined,
      },
      {
        role: 'reviewer',
        content: [
          'Patch approval required for 2 file(s):',
          '- src/App.tsx (+2 -1)',
          '- src/banner.ts (+1 -0)',
          'Reason: Need write access to update the desktop shell.',
        ].join('\n'),
        fileChanges: undefined,
      },
      {
        role: 'tool',
        content: [
          'Patch completed for 2 file(s):',
          '- src/App.tsx (+2 -1)',
          '- src/banner.ts (+1 -0)',
          'Output: Applied patch successfully.',
        ].join('\n'),
        fileChanges: undefined,
      },
    ],
    'native Codex mirror should persist projected patch approval and completion messages after import and refresh.',
  );
});

console.log('native codex session patch projection contract passed.');
