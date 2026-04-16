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
  const codexHome = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-native-codex-fast-path-'));
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
  openedSessionFiles: string[];
  readSessionFiles: string[];
}) {
  return {
    ...fs,
    openSync(filePath: fs.PathLike, flags?: fs.OpenMode, mode?: fs.Mode) {
      const normalizedPath = String(filePath);
      if (normalizedPath.includes(`${path.sep}sessions${path.sep}`)) {
        counters.openedSessionFiles.push(normalizedPath);
      }

      return fs.openSync(filePath, flags, mode);
    },
    readFileSync(filePath: fs.PathLike, encoding?: BufferEncoding | {
      encoding?: BufferEncoding | null;
      flag?: string | undefined;
    } | null) {
      const normalizedPath = String(filePath);
      if (normalizedPath.includes(`${path.sep}sessions${path.sep}`)) {
        counters.readSessionFiles.push(normalizedPath);
      }

      return fs.readFileSync(filePath, encoding as never);
    },
  };
}

await withTemporaryCodexHome(async (codexHome) => {
  const sessionsDirectory = path.join(codexHome, 'sessions', '2026', '04', '16');
  await mkdir(sessionsDirectory, { recursive: true });

  for (let index = 1; index <= 6; index += 1) {
    await writeFile(
      path.join(
        sessionsDirectory,
        `rollout-2026-04-16T10-${index.toString().padStart(2, '0')}-00-native-session-${index}.jsonl`,
      ),
      [
        JSON.stringify({
          timestamp: `2026-04-16T10:${index.toString().padStart(2, '0')}:00.000Z`,
          type: 'session_meta',
          payload: {
            id: `native-session-${index}`,
            cwd: `D:\\workspace\\project-${index}`,
            timestamp: `2026-04-16T10:${index.toString().padStart(2, '0')}:00.000Z`,
          },
        }),
        JSON.stringify({
          timestamp: `2026-04-16T10:${index.toString().padStart(2, '0')}:01.000Z`,
          type: 'event_msg',
          payload: {
            type: 'user_message',
            message: `Session ${index} bootstrap`,
          },
        }),
      ].join('\n'),
      'utf8',
    );
  }

  const builtinModuleLoader = process.getBuiltinModule?.bind(process);
  assert.ok(builtinModuleLoader, 'Node runtime should expose process.getBuiltinModule for the native Codex store tests.');

  const counters = {
    openedSessionFiles: [] as string[],
    readSessionFiles: [] as string[],
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
    const { readNativeCodexSessionRecord } = await import(`${storeModulePath.href}?t=${moduleVersion}`);
    const record = await readNativeCodexSessionRecord('codex-native:does-not-exist');

    assert.equal(record, null);
    assert.deepEqual(
      counters.readSessionFiles,
      [],
      'Missing native Codex session lookups must not read unrelated rollout files.',
    );
    assert.deepEqual(
      counters.openedSessionFiles,
      [],
      'Missing native Codex session lookups must short-circuit before opening unrelated rollout files.',
    );
  } finally {
    process.getBuiltinModule = originalGetBuiltinModule;
  }
});

console.log('native codex session fast-path contract passed.');
