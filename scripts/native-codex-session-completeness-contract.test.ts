import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const storeModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/nativeCodexSessionStore.ts',
  import.meta.url,
);

async function withTemporaryCodexHome<T>(callback: (codexHome: string) => Promise<T>): Promise<T> {
  const codexHome = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-native-codex-complete-'));
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

  for (let index = 1; index <= 55; index += 1) {
    const sessionId = `native-session-${index.toString().padStart(2, '0')}`;
    const fileName = `rollout-2026-04-16T10-${index.toString().padStart(2, '0')}-00-${sessionId}.jsonl`;
    await writeFile(
      path.join(sessionsDirectory, fileName),
      [
        JSON.stringify({
          timestamp: `2026-04-16T10:${index.toString().padStart(2, '0')}:00.000Z`,
          type: 'session_meta',
          payload: {
            id: sessionId,
            timestamp: `2026-04-16T10:${index.toString().padStart(2, '0')}:00.000Z`,
            cwd: `D:\\workspace\\project-${index.toString().padStart(2, '0')}`,
          },
        }),
        JSON.stringify({
          timestamp: `2026-04-16T10:${index.toString().padStart(2, '0')}:01.000Z`,
          type: 'event_msg',
          payload: {
            type: 'user_message',
            message: `Resume session ${index}`,
          },
        }),
      ].join('\n'),
      'utf8',
    );
  }

  const moduleVersion = Date.now();
  const {
    listNativeCodexSessions,
    readNativeCodexSessionRecord,
  } = await import(`${storeModulePath.href}?t=${moduleVersion}`);

  const inventory = await listNativeCodexSessions();
  assert.equal(
    inventory.length,
    55,
    'Native Codex inventory must not silently truncate sessions when no explicit limit was requested.',
  );

  const oldestRecord = await readNativeCodexSessionRecord('codex-native:native-session-01');
  assert.ok(
    oldestRecord,
    'Native Codex record lookup must resolve sessions beyond the first 50 rollout files.',
  );
  assert.equal(oldestRecord?.summary.title, 'Resume session 1');
});

console.log('native codex session completeness contract passed.');
