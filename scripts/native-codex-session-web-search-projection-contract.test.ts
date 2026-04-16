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
  const codexHome = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-native-codex-web-search-'));
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
    path.join(sessionsDirectory, 'native-web-search-session.jsonl'),
    [
      JSON.stringify({
        timestamp: '2026-04-16T13:00:00.000Z',
        type: 'session_meta',
        payload: {
          id: 'native-web-search-session',
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
          message: 'Research Codex thread sync behavior',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T13:02:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'web_search_end',
          call_id: 'search-1',
          turn_id: 'turn-1',
          query: 'codex thread sync behavior',
          action: {
            type: 'search',
            query: 'codex thread sync behavior',
            queries: ['codex thread sync behavior', 'codex session index'],
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

  const record = await readNativeCodexSessionRecord('codex-native:native-web-search-session');

  assert.ok(record, 'native Codex session record should resolve web-search-bearing sessions.');
  assert.equal(
    record?.summary.transcriptUpdatedAt,
    '2026-04-16T13:02:00.000Z',
    'web search completion should advance transcript freshness so refresh can detect the visible tool message.',
  );
  assert.deepEqual(
    record?.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    [
      {
        role: 'user',
        content: 'Research Codex thread sync behavior',
      },
      {
        role: 'tool',
        content: [
          'Web search completed:',
          'Query: codex thread sync behavior',
          'Action: search',
          'Queries: codex thread sync behavior; codex session index',
        ].join('\n'),
      },
    ],
    'native Codex parser should project completed web searches into visible tool messages instead of dropping them.',
  );

  const projectService = new MockProjectService();
  await ensureNativeCodexSessionMirror({
    inventory: [record!.summary],
    projectService,
    workspaceId: 'ws-1',
  });

  const mirroredSession = (await projectService.getProjects('ws-1'))
    .find((project) => project.name === 'Codex Sessions')
    ?.codingSessions.find((codingSession) => codingSession.id === 'codex-native:native-web-search-session');

  assert.deepEqual(
    mirroredSession?.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    [
      {
        role: 'user',
        content: 'Research Codex thread sync behavior',
      },
      {
        role: 'tool',
        content: [
          'Web search completed:',
          'Query: codex thread sync behavior',
          'Action: search',
          'Queries: codex thread sync behavior; codex session index',
        ].join('\n'),
      },
    ],
    'native Codex mirror should persist projected web search messages after import and refresh.',
  );
});

console.log('native codex session web search projection contract passed.');
