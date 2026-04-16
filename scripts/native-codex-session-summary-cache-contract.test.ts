import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const storeModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/nativeCodexSessionStore.ts',
  import.meta.url,
);

async function withTemporaryCodexHome<T>(callback: (codexHome: string) => Promise<T>): Promise<T> {
  const codexHome = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-native-codex-summary-cache-'));
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

function createWrappedFsModule(counters: {
  sessionFileReads: string[];
}) {
  return {
    ...fs,
    openSync(filePath: fs.PathLike, flags?: fs.OpenMode, mode?: fs.Mode) {
      const normalizedPath = String(filePath);
      if (normalizedPath.includes(`${path.sep}sessions${path.sep}`)) {
        counters.sessionFileReads.push(normalizedPath);
      }

      return fs.openSync(filePath, flags, mode);
    },
    readFileSync(filePath: fs.PathLike, encoding?: BufferEncoding | {
      encoding?: BufferEncoding | null;
      flag?: string | undefined;
    } | null) {
      const normalizedPath = String(filePath);
      if (normalizedPath.includes(`${path.sep}sessions${path.sep}`)) {
        counters.sessionFileReads.push(normalizedPath);
      }

      return fs.readFileSync(filePath, encoding as never);
    },
  };
}

function buildLargeRolloutLines(sessionId: string): string[] {
  const lines = [
    JSON.stringify({
      timestamp: '2026-04-16T10:00:00.000Z',
      type: 'session_meta',
      payload: {
        id: sessionId,
        cwd: `D:\\workspace\\${sessionId}`,
        timestamp: '2026-04-16T10:00:00.000Z',
      },
    }),
    JSON.stringify({
      timestamp: '2026-04-16T10:01:00.000Z',
      type: 'event_msg',
      payload: {
        type: 'user_message',
        message: `Bootstrap ${sessionId}`,
      },
    }),
  ];

  for (let index = 0; index < 280; index += 1) {
    lines.push(JSON.stringify({
      timestamp: `2026-04-16T10:${(2 + Math.floor(index / 60)).toString().padStart(2, '0')}:${(index % 60).toString().padStart(2, '0')}.000Z`,
      type: 'turn_context',
      payload: {
        padding: `${sessionId}-ctx-${index}-${'x'.repeat(220)}`,
      },
    }));
  }

  lines.push(JSON.stringify({
    timestamp: '2026-04-16T10:15:00.000Z',
    type: 'event_msg',
    payload: {
      type: 'agent_message',
      message: `Completed ${sessionId}`,
    },
  }));

  return lines;
}

await withTemporaryCodexHome(async (codexHome) => {
  const sessionsDirectory = path.join(codexHome, 'sessions', '2026', '04', '16');
  await mkdir(sessionsDirectory, { recursive: true });

  for (const sessionId of ['native-cache-1', 'native-cache-2']) {
    await writeFile(
      path.join(sessionsDirectory, `rollout-2026-04-16T10-00-00-${sessionId}.jsonl`),
      `${buildLargeRolloutLines(sessionId).join('\n')}\n`,
      'utf8',
    );
  }

  const builtinModuleLoader = process.getBuiltinModule?.bind(process);
  assert.ok(builtinModuleLoader, 'Node runtime should expose process.getBuiltinModule for the summary cache contract.');

  const counters = {
    sessionFileReads: [] as string[],
  };
  const originalGetBuiltinModule = process.getBuiltinModule;
  process.getBuiltinModule = ((specifier: string) => {
    if (specifier === 'node:fs') {
      return createWrappedFsModule(counters);
    }

    return builtinModuleLoader(specifier);
  }) as typeof process.getBuiltinModule;

  try {
    const moduleVersion = Date.now();
    const { listNativeCodexSessions } = await import(`${storeModulePath.href}?t=${moduleVersion}`);

    await listNativeCodexSessions(10);
    assert.equal(
      counters.sessionFileReads.length > 0,
      true,
      'The first inventory pass should read native rollout summaries.',
    );

    counters.sessionFileReads.length = 0;

    await listNativeCodexSessions(10);

    assert.deepEqual(
      counters.sessionFileReads,
      [],
      'The second inventory pass should reuse cached native summaries when rollout files have not changed.',
    );
  } finally {
    process.getBuiltinModule = originalGetBuiltinModule;
  }
});

console.log('native codex session summary cache contract passed.');
