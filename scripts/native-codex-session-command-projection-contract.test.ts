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
  const codexHome = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-native-codex-command-'));
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
    path.join(sessionsDirectory, 'native-command-session.jsonl'),
    [
      JSON.stringify({
        timestamp: '2026-04-16T10:00:00.000Z',
        type: 'session_meta',
        payload: {
          id: 'native-command-session',
          timestamp: '2026-04-16T10:00:00.000Z',
          cwd: 'D:/workspace/birdcoder',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T10:01:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'user_message',
          turn_id: 'turn-1',
          message: 'Inspect the workspace layout',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T10:02:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'exec_command_end',
          call_id: 'call-1',
          turn_id: 'turn-1',
          command: ['powershell.exe', '-Command', 'Get-ChildItem src'],
          cwd: 'D:/workspace/birdcoder',
          aggregated_output: 'src\\index.ts\r\nsrc\\App.tsx\r\n',
          exit_code: 0,
          status: 'completed',
        },
      }),
    ].join('\n'),
    'utf8',
  );

  const moduleVersion = Date.now();
  const { readNativeCodexSessionRecord } = await import(`${storeModulePath.href}?t=${moduleVersion}`);
  const { ensureNativeCodexSessionMirror } = await import(`${mirrorModulePath.href}?t=${moduleVersion}`);
  const { MockProjectService } = await import(`${mockProjectServiceModulePath.href}?t=${moduleVersion}`);

  const record = await readNativeCodexSessionRecord('codex-native:native-command-session');

  assert.ok(record, 'native Codex session record should resolve command-bearing sessions.');
  assert.equal(
    record?.summary.transcriptUpdatedAt,
    '2026-04-16T10:02:00.000Z',
    'command execution should advance the projected transcript freshness timestamp so refresh can detect the new visible message.',
  );
  assert.deepEqual(
    record?.messages.map((message) => ({
      role: message.role,
      content: message.content,
      commands: message.commands,
    })),
    [
      {
        role: 'user',
        content: 'Inspect the workspace layout',
        commands: undefined,
      },
      {
        role: 'tool',
        content: 'powershell.exe -Command Get-ChildItem src',
        commands: [
          {
            command: 'powershell.exe -Command Get-ChildItem src',
            status: 'success',
            output: 'src\\index.ts\r\nsrc\\App.tsx',
          },
        ],
      },
    ],
    'native Codex parser should project command execution events into visible tool messages instead of silently dropping them.',
  );

  const projectService = new MockProjectService();
  await ensureNativeCodexSessionMirror({
    inventory: [record!.summary],
    projectService,
    workspaceId: 'ws-1',
  });

  const mirroredSession = (await projectService.getProjects('ws-1'))
    .find((project) => project.name === 'Codex Sessions')
    ?.codingSessions.find((codingSession) => codingSession.id === 'codex-native:native-command-session');

  assert.deepEqual(
    mirroredSession?.messages.map((message) => ({
      role: message.role,
      content: message.content,
      commands: message.commands,
    })),
    [
      {
        role: 'user',
        content: 'Inspect the workspace layout',
        commands: undefined,
      },
      {
        role: 'tool',
        content: 'powershell.exe -Command Get-ChildItem src',
        commands: [
          {
            command: 'powershell.exe -Command Get-ChildItem src',
            status: 'success',
            output: 'src\\index.ts\r\nsrc\\App.tsx',
          },
        ],
      },
    ],
    'native Codex mirror should persist projected command messages so project sessions show the same command trail after import and refresh.',
  );
});

console.log('native codex session command projection contract passed.');
