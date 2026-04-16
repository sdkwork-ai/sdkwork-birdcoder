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
  const codexHome = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-native-codex-command-approval-'));
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
    path.join(sessionsDirectory, 'native-command-approval-session.jsonl'),
    [
      JSON.stringify({
        timestamp: '2026-04-16T12:00:00.000Z',
        type: 'session_meta',
        payload: {
          id: 'native-command-approval-session',
          timestamp: '2026-04-16T12:00:00.000Z',
          cwd: 'D:/workspace/birdcoder',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T12:01:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'user_message',
          turn_id: 'turn-1',
          message: 'Run the release checks',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T12:02:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'exec_approval_request',
          call_id: 'command-approval-1',
          turn_id: 'turn-1',
          command: ['pnpm', 'release:smoke:desktop'],
          cwd: 'D:/workspace/birdcoder',
          reason: 'Retry without sandbox to access the desktop build cache.',
          proposed_execpolicy_amendment: {
            command: ['pnpm', 'release:smoke:desktop'],
          },
          available_decisions: [
            'approved',
            {
              type: 'approved_execpolicy_amendment',
              proposed_execpolicy_amendment: {
                command: ['pnpm', 'release:smoke:desktop'],
              },
            },
            'abort',
          ],
        },
      }),
    ].join('\n'),
    'utf8',
  );

  const moduleVersion = Date.now();
  const { readNativeCodexSessionRecord } = await import(`${storeModulePath.href}?t=${moduleVersion}`);
  const { ensureNativeCodexSessionMirror } = await import(`${mirrorModulePath.href}?t=${moduleVersion}`);
  const { MockProjectService } = await import(`${mockProjectServiceModulePath.href}?t=${moduleVersion}`);

  const record = await readNativeCodexSessionRecord('codex-native:native-command-approval-session');

  assert.ok(record, 'native Codex session record should resolve command approval sessions.');
  assert.equal(
    record?.summary.transcriptUpdatedAt,
    '2026-04-16T12:02:00.000Z',
    'command approval requests should advance transcript freshness so project refresh detects newly visible approval prompts.',
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
        content: 'Run the release checks',
        commands: undefined,
      },
      {
        role: 'tool',
        content: 'Command approval required: pnpm release:smoke:desktop',
        commands: [
          {
            command: 'pnpm release:smoke:desktop',
            status: 'running',
            output: [
              'Reason: Retry without sandbox to access the desktop build cache.',
              'Working directory: D:/workspace/birdcoder',
              'Suggested allow rule: pnpm release:smoke:desktop',
              'Available decisions: approved; approved_execpolicy_amendment; abort',
            ].join('\n'),
          },
        ],
      },
    ],
    'native Codex parser should project exec approval requests into visible command cards instead of dropping them from imported sessions.',
  );

  const projectService = new MockProjectService();
  await ensureNativeCodexSessionMirror({
    inventory: [record!.summary],
    projectService,
    workspaceId: 'ws-1',
  });

  const mirroredSession = (await projectService.getProjects('ws-1'))
    .find((project) => project.name === 'Codex Sessions')
    ?.codingSessions.find(
      (codingSession) => codingSession.id === 'codex-native:native-command-approval-session',
    );

  assert.deepEqual(
    mirroredSession?.messages.map((message) => ({
      role: message.role,
      content: message.content,
      commands: message.commands,
    })),
    [
      {
        role: 'user',
        content: 'Run the release checks',
        commands: undefined,
      },
      {
        role: 'tool',
        content: 'Command approval required: pnpm release:smoke:desktop',
        commands: [
          {
            command: 'pnpm release:smoke:desktop',
            status: 'running',
            output: [
              'Reason: Retry without sandbox to access the desktop build cache.',
              'Working directory: D:/workspace/birdcoder',
              'Suggested allow rule: pnpm release:smoke:desktop',
              'Available decisions: approved; approved_execpolicy_amendment; abort',
            ].join('\n'),
          },
        ],
      },
    ],
    'native Codex mirror should persist command approval prompts so imported project sessions show the same approval state after refresh.',
  );
});

console.log('native codex session command approval projection contract passed.');
