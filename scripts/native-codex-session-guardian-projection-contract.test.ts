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
  const codexHome = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-native-codex-guardian-'));
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
    path.join(sessionsDirectory, 'native-guardian-session.jsonl'),
    [
      JSON.stringify({
        timestamp: '2026-04-16T13:00:00.000Z',
        type: 'session_meta',
        payload: {
          id: 'native-guardian-session',
          timestamp: '2026-04-16T13:00:00.000Z',
          cwd: 'D:/workspace/birdcoder',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T13:01:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'user_message',
          turn_id: 'turn-1',
          message: 'Push the release branch',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T13:02:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'exec_approval_request',
          call_id: 'guardian-command-1',
          turn_id: 'turn-1',
          command: ['git', 'push', 'origin', 'release'],
          cwd: 'D:/workspace/birdcoder',
          reason: 'Network access requires approval.',
          available_decisions: ['approved', 'approved_for_session', 'abort'],
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T13:03:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'guardian_assessment',
          id: 'guardian-review-1',
          target_item_id: 'guardian-command-1',
          turn_id: 'turn-1',
          status: 'denied',
          risk_level: 'high',
          user_authorization: 'low',
          rationale: 'Pushing the release branch requires explicit operator confirmation.',
          action: {
            type: 'execve',
            source: 'shell',
            program: 'git',
            argv: ['git', 'push', 'origin', 'release'],
            cwd: 'D:/workspace/birdcoder',
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

  const record = await readNativeCodexSessionRecord('codex-native:native-guardian-session');

  assert.ok(record, 'native Codex session record should resolve guardian-reviewed sessions.');
  assert.equal(
    record?.summary.transcriptUpdatedAt,
    '2026-04-16T13:03:00.000Z',
    'guardian assessment results should advance transcript freshness so denied approvals refresh immediately.',
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
        content: 'Push the release branch',
        commands: undefined,
      },
      {
        role: 'tool',
        content: 'Command approval denied: git push origin release',
        commands: [
          {
            command: 'git push origin release',
            status: 'error',
            output: [
              'Rationale: Pushing the release branch requires explicit operator confirmation.',
              'Risk level: high',
              'User authorization: low',
            ].join('\n'),
          },
        ],
      },
    ],
    'guardian assessments should replace the in-progress approval prompt with a final denied command item, matching Codex thread-history semantics.',
  );

  const projectService = new MockProjectService();
  await ensureNativeCodexSessionMirror({
    inventory: [record!.summary],
    projectService,
    workspaceId: 'ws-1',
  });

  const mirroredSession = (await projectService.getProjects('ws-1'))
    .find((project) => project.name === 'Codex Sessions')
    ?.codingSessions.find((codingSession) => codingSession.id === 'codex-native:native-guardian-session');

  assert.deepEqual(
    mirroredSession?.messages.map((message) => ({
      role: message.role,
      content: message.content,
      commands: message.commands,
    })),
    [
      {
        role: 'user',
        content: 'Push the release branch',
        commands: undefined,
      },
      {
        role: 'tool',
        content: 'Command approval denied: git push origin release',
        commands: [
          {
            command: 'git push origin release',
            status: 'error',
            output: [
              'Rationale: Pushing the release branch requires explicit operator confirmation.',
              'Risk level: high',
              'User authorization: low',
            ].join('\n'),
          },
        ],
      },
    ],
    'native Codex mirror should persist the guardian-reviewed command state so imported sessions do not show stale in-progress approvals.',
  );
});

console.log('native codex session guardian projection contract passed.');
