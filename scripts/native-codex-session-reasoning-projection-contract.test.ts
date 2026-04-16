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
  const codexHome = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-native-codex-reasoning-'));
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
    path.join(sessionsDirectory, 'native-reasoning-session.jsonl'),
    [
      JSON.stringify({
        timestamp: '2026-04-16T12:00:00.000Z',
        type: 'session_meta',
        payload: {
          id: 'native-reasoning-session',
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
          message: 'Audit the startup recovery flow',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T12:02:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'agent_reasoning',
          turn_id: 'turn-1',
          text: '**Tracing startup state**\n\nI should verify the recovery gate before changing desktop bootstrap behavior.',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T12:02:30.000Z',
        type: 'event_msg',
        payload: {
          type: 'agent_reasoning_raw_content',
          turn_id: 'turn-1',
          text: 'raw hidden reasoning that should not be mirrored',
        },
      }),
    ].join('\n'),
    'utf8',
  );

  const moduleVersion = Date.now();
  const { readNativeCodexSessionRecord } = await import(`${storeModulePath.href}?t=${moduleVersion}`);
  const { ensureNativeCodexSessionMirror } = await import(`${mirrorModulePath.href}?t=${moduleVersion}`);
  const { MockProjectService } = await import(`${mockProjectServiceModulePath.href}?t=${moduleVersion}`);

  const record = await readNativeCodexSessionRecord('codex-native:native-reasoning-session');

  assert.ok(record, 'native Codex session record should resolve reasoning-bearing sessions.');
  assert.equal(
    record?.summary.transcriptUpdatedAt,
    '2026-04-16T12:02:00.000Z',
    'summary reasoning should advance transcript freshness, while raw reasoning must stay hidden.',
  );
  assert.deepEqual(
    record?.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    [
      {
        role: 'user',
        content: 'Audit the startup recovery flow',
      },
      {
        role: 'planner',
        content: '**Tracing startup state**\n\nI should verify the recovery gate before changing desktop bootstrap behavior.',
      },
    ],
    'native Codex parser should project summary reasoning into visible planner messages without exposing raw reasoning content.',
  );

  const projectService = new MockProjectService();
  await ensureNativeCodexSessionMirror({
    inventory: [record!.summary],
    projectService,
    workspaceId: 'ws-1',
  });

  const mirroredSession = (await projectService.getProjects('ws-1'))
    .find((project) => project.name === 'Codex Sessions')
    ?.codingSessions.find((codingSession) => codingSession.id === 'codex-native:native-reasoning-session');

  assert.deepEqual(
    mirroredSession?.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    [
      {
        role: 'user',
        content: 'Audit the startup recovery flow',
      },
      {
        role: 'planner',
        content: '**Tracing startup state**\n\nI should verify the recovery gate before changing desktop bootstrap behavior.',
      },
    ],
    'native Codex mirror should persist visible summary reasoning messages after import and refresh.',
  );
});

console.log('native codex session reasoning projection contract passed.');
