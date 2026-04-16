import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const mirrorModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/nativeCodexSessionMirror.ts',
  import.meta.url,
);
const mockProjectServiceModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/services/impl/MockProjectService.ts',
  import.meta.url,
);

async function withTemporaryCodexHome<T>(callback: (codexHome: string) => Promise<T>): Promise<T> {
  const codexHome = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-native-codex-incremental-'));
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
  readSessionFiles: string[];
}) {
  return {
    ...fs,
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
  await writeFile(
    path.join(sessionsDirectory, 'rollout-2026-04-16T10-00-00-native-session-1.jsonl'),
    [
      JSON.stringify({
        timestamp: '2026-04-16T10:00:00.000Z',
        type: 'session_meta',
        payload: {
          id: 'native-session-1',
          cwd: 'D:\\workspace\\birdcoder',
          timestamp: '2026-04-16T10:00:00.000Z',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T10:01:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'user_message',
          message: 'Bootstrap the Codex mirror refresh.',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T10:02:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'agent_message',
          message: 'Initial mirror sync hydrated the transcript.',
        },
      }),
    ].join('\n'),
    'utf8',
  );

  const builtinModuleLoader = process.getBuiltinModule?.bind(process);
  assert.ok(builtinModuleLoader, 'Node runtime should expose process.getBuiltinModule for the native Codex mirror tests.');

  const counters = {
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
    const { ensureNativeCodexSessionMirror } = await import(`${mirrorModulePath.href}?t=${moduleVersion}`);
    const { MockProjectService } = await import(`${mockProjectServiceModulePath.href}?t=${moduleVersion}`);

    const projectService = new MockProjectService();
    const inventoryRecord = {
      id: 'codex-native:native-session-1',
      workspaceId: '',
      projectId: '',
      title: 'Bootstrap the Codex mirror refresh.',
      status: 'completed' as const,
      hostMode: 'desktop' as const,
      engineId: 'codex' as const,
      modelId: 'codex',
      createdAt: '2026-04-16T10:00:00.000Z',
      updatedAt: '2026-04-16T10:02:00.000Z',
      lastTurnAt: '2026-04-16T10:01:00.000Z',
      kind: 'coding' as const,
      sortTimestamp: Date.parse('2026-04-16T10:02:00.000Z'),
      nativeCwd: 'D:\\workspace\\birdcoder',
      transcriptUpdatedAt: '2026-04-16T10:02:00.000Z',
    };

    await ensureNativeCodexSessionMirror({
      inventory: [inventoryRecord],
      projectService,
      workspaceId: 'ws-1',
    });

    assert.equal(
      counters.readSessionFiles.length > 0,
      true,
      'The first native Codex mirror pass should hydrate transcript messages from the rollout file.',
    );

    counters.readSessionFiles.length = 0;

    await ensureNativeCodexSessionMirror({
      inventory: [inventoryRecord],
      projectService,
      workspaceId: 'ws-1',
    });

    assert.deepEqual(
      counters.readSessionFiles,
      [],
      'An unchanged native Codex session should not reread the rollout transcript during mirror refresh.',
    );
  } finally {
    process.getBuiltinModule = originalGetBuiltinModule;
  }
});

console.log('native codex session incremental refresh contract passed.');
