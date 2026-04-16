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
  const codexHome = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-native-codex-image-generation-'));
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
    path.join(sessionsDirectory, 'native-image-generation-session.jsonl'),
    [
      JSON.stringify({
        timestamp: '2026-04-16T17:00:00.000Z',
        type: 'session_meta',
        payload: {
          id: 'native-image-generation-session',
          timestamp: '2026-04-16T17:00:00.000Z',
          cwd: 'D:/workspace/birdcoder',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T17:01:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'user_message',
          turn_id: 'turn-1',
          message: 'Generate an updated empty-state illustration',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T17:02:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'image_generation_begin',
          call_id: 'img-1',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T17:03:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'image_generation_end',
          call_id: 'img-1',
          status: 'completed',
          revised_prompt: 'A clean product empty-state illustration with subtle orange accents',
          result: 'Image saved successfully',
          saved_path: 'D:/workspace/birdcoder/.tmp/empty-state.png',
        },
      }),
    ].join('\n'),
    'utf8',
  );

  const moduleVersion = Date.now();
  const { readNativeCodexSessionRecord } = await import(`${storeModulePath.href}?t=${moduleVersion}`);
  const { ensureNativeCodexSessionMirror } = await import(`${mirrorModulePath.href}?t=${moduleVersion}`);
  const { MockProjectService } = await import(`${mockProjectServiceModulePath.href}?t=${moduleVersion}`);

  const record = await readNativeCodexSessionRecord('codex-native:native-image-generation-session');

  assert.ok(record, 'native Codex session record should resolve image-generation-bearing sessions.');
  assert.equal(
    record?.summary.transcriptUpdatedAt,
    '2026-04-16T17:03:00.000Z',
    'image generation completion should advance transcript freshness so session refresh detects the projected tool item.',
  );
  assert.deepEqual(
    record?.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    [
      {
        role: 'user',
        content: 'Generate an updated empty-state illustration',
      },
      {
        role: 'tool',
        content: [
          'Image generation completed',
          'Prompt: A clean product empty-state illustration with subtle orange accents',
          'Result: Image saved successfully',
          'Saved path: D:/workspace/birdcoder/.tmp/empty-state.png',
        ].join('\n'),
      },
    ],
    'native Codex parser should project image generation events into a single visible tool message instead of dropping begin/end details.',
  );

  const projectService = new MockProjectService();
  await ensureNativeCodexSessionMirror({
    inventory: [record!.summary],
    projectService,
    workspaceId: 'ws-1',
  });

  const mirroredSession = (await projectService.getProjects('ws-1'))
    .find((project) => project.name === 'Codex Sessions')
    ?.codingSessions.find((codingSession) => codingSession.id === 'codex-native:native-image-generation-session');

  assert.deepEqual(
    mirroredSession?.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    [
      {
        role: 'user',
        content: 'Generate an updated empty-state illustration',
      },
      {
        role: 'tool',
        content: [
          'Image generation completed',
          'Prompt: A clean product empty-state illustration with subtle orange accents',
          'Result: Image saved successfully',
          'Saved path: D:/workspace/birdcoder/.tmp/empty-state.png',
        ].join('\n'),
      },
    ],
    'native Codex mirror should persist projected image generation messages after import and refresh.',
  );
});

console.log('native codex session image generation projection contract passed.');
