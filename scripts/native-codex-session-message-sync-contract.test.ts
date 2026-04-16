import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
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
  const codexHome = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-native-codex-session-'));
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

async function writeNativeCodexSessionFile(
  codexHome: string,
  sessionFileName: string,
  lines: string[],
) {
  const sessionsDirectory = path.join(codexHome, 'sessions', '2026', '04', '16');
  await mkdir(sessionsDirectory, { recursive: true });
  const sessionFilePath = path.join(sessionsDirectory, sessionFileName);
  await writeFile(sessionFilePath, `${lines.join('\n')}\n`, 'utf8');
  return sessionFilePath;
}

await withTemporaryCodexHome(async (codexHome) => {
  const moduleVersion = Date.now();
  const { readNativeCodexSessionRecord } = await import(`${storeModulePath.href}?t=${moduleVersion}`);
  const { ensureNativeCodexSessionMirror } = await import(`${mirrorModulePath.href}?t=${moduleVersion}`);
  const { MockProjectService } = await import(`${mockProjectServiceModulePath.href}?t=${moduleVersion}`);

  const sessionFilePath = await writeNativeCodexSessionFile(codexHome, 'native-session-1.jsonl', [
    JSON.stringify({
      type: 'session_meta',
      timestamp: '2026-04-16T10:00:00.000Z',
      payload: {
        id: 'native-session-1',
        cwd: 'D:/workspace/birdcoder',
        timestamp: '2026-04-16T10:00:00.000Z',
      },
    }),
    JSON.stringify({
      type: 'event_msg',
      timestamp: '2026-04-16T10:01:00.000Z',
      payload: {
        type: 'user_message',
        message: 'Build a refresh pipeline',
      },
    }),
    JSON.stringify({
      type: 'event_msg',
      timestamp: '2026-04-16T10:02:00.000Z',
      payload: {
        type: 'agent_message',
        message: 'Implemented the first refresh pipeline slice.',
      },
    }),
    JSON.stringify({
      type: 'event_msg',
      timestamp: '2026-04-16T10:03:00.000Z',
      payload: {
        type: 'user_message',
        message: 'Add a session-level refresh action',
      },
    }),
    JSON.stringify({
      type: 'event_msg',
      timestamp: '2026-04-16T10:04:00.000Z',
      payload: {
        type: 'agent_message',
        message: 'Added the session refresh action to the sidebar.',
      },
    }),
    JSON.stringify({
      type: 'response_item',
      timestamp: '2026-04-16T10:04:01.000Z',
      payload: {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'Added the session refresh action to the sidebar.' }],
      },
    }),
  ]);

  const nativeRecord = await readNativeCodexSessionRecord('codex-native:native-session-1');

  assert.ok(nativeRecord, 'native Codex authority reader should resolve a session by BirdCoder native session id.');
  assert.equal(nativeRecord?.summary.id, 'codex-native:native-session-1');
  assert.equal(nativeRecord?.summary.title, 'Build a refresh pipeline');
  assert.equal(nativeRecord?.filePath, sessionFilePath);
  assert.deepEqual(
    nativeRecord?.messages.map((message: { role: string; content: string }) => ({
      role: message.role,
      content: message.content,
    })),
    [
      { role: 'user', content: 'Build a refresh pipeline' },
      { role: 'assistant', content: 'Implemented the first refresh pipeline slice.' },
      { role: 'user', content: 'Add a session-level refresh action' },
      { role: 'assistant', content: 'Added the session refresh action to the sidebar.' },
    ],
    'native Codex authority reader should reconstruct a stable transcript from JSONL events.',
  );

  const projectService = new MockProjectService();
  await ensureNativeCodexSessionMirror({
    inventory: [nativeRecord!.summary],
    projectService,
    workspaceId: 'ws-1',
  });

  const firstPassProjects = await projectService.getProjects('ws-1');
  const firstPassMirroredSession = firstPassProjects
    .find((project) => project.name === 'Codex Sessions')
    ?.codingSessions.find((codingSession) => codingSession.id === 'codex-native:native-session-1');

  assert.deepEqual(
    firstPassMirroredSession?.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    [
      { role: 'user', content: 'Build a refresh pipeline' },
      { role: 'assistant', content: 'Implemented the first refresh pipeline slice.' },
      { role: 'user', content: 'Add a session-level refresh action' },
      { role: 'assistant', content: 'Added the session refresh action to the sidebar.' },
    ],
    'native Codex mirror should persist the parsed transcript into the mirrored session.',
  );

  await unlink(sessionFilePath);

  await ensureNativeCodexSessionMirror({
    inventory: [
      {
        ...nativeRecord!.summary,
        title: 'Build a refresh pipeline (updated title only)',
        updatedAt: '2026-04-16T10:05:00.000Z',
        lastTurnAt: '2026-04-16T10:05:00.000Z',
        sortTimestamp: Date.parse('2026-04-16T10:05:00.000Z'),
      },
    ],
    projectService,
    workspaceId: 'ws-1',
  });

  const secondPassProjects = await projectService.getProjects('ws-1');
  const secondPassMirroredSession = secondPassProjects
    .find((project) => project.name === 'Codex Sessions')
    ?.codingSessions.find((codingSession) => codingSession.id === 'codex-native:native-session-1');

  assert.equal(
    secondPassMirroredSession?.title,
    'Build a refresh pipeline (updated title only)',
    'native Codex mirror should still refresh summary metadata when the transcript authority is unavailable.',
  );
  assert.deepEqual(
    secondPassMirroredSession?.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    [
      { role: 'user', content: 'Build a refresh pipeline' },
      { role: 'assistant', content: 'Implemented the first refresh pipeline slice.' },
      { role: 'user', content: 'Add a session-level refresh action' },
      { role: 'assistant', content: 'Added the session refresh action to the sidebar.' },
    ],
    'native Codex mirror must preserve existing mirrored messages when transcript reload fails.',
  );
});

console.log('native codex session message sync contract passed.');
