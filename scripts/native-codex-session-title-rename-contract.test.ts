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
  const codexHome = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-native-codex-rename-'));
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
  transcriptReads: string[];
}) {
  return {
    ...fs,
    readFileSync(filePath: fs.PathLike, encoding?: BufferEncoding | {
      encoding?: BufferEncoding | null;
      flag?: string | undefined;
    } | null) {
      const normalizedPath = String(filePath);
      if (normalizedPath.includes(`${path.sep}sessions${path.sep}`)) {
        counters.transcriptReads.push(normalizedPath);
      }

      return fs.readFileSync(filePath, encoding as never);
    },
  };
}

function buildLargeRolloutLines(): string[] {
  const lines = [
    JSON.stringify({
      timestamp: '2026-04-16T10:00:00.000Z',
      type: 'session_meta',
      payload: {
        id: 'native-session-rename',
        cwd: 'D:\\workspace\\birdcoder',
        timestamp: '2026-04-16T10:00:00.000Z',
      },
    }),
    JSON.stringify({
      timestamp: '2026-04-16T10:01:00.000Z',
      type: 'event_msg',
      payload: {
        type: 'user_message',
        message: 'Bootstrap the renamed Codex session.',
      },
    }),
  ];

  for (let index = 0; index < 320; index += 1) {
    lines.push(JSON.stringify({
      timestamp: `2026-04-16T10:${(2 + Math.floor(index / 60)).toString().padStart(2, '0')}:${(index % 60).toString().padStart(2, '0')}.000Z`,
      type: 'turn_context',
      payload: {
        padding: `ctx-${index}-${'x'.repeat(240)}`,
      },
    }));
  }

  lines.push(JSON.stringify({
    timestamp: '2026-04-16T10:20:00.000Z',
    type: 'event_msg',
    payload: {
      type: 'agent_message',
      message: 'The transcript should not be reread after a pure title rename.',
    },
  }));

  return lines;
}

await withTemporaryCodexHome(async (codexHome) => {
  const sessionsDirectory = path.join(codexHome, 'sessions', '2026', '04', '16');
  await mkdir(sessionsDirectory, { recursive: true });

  await writeFile(
    path.join(sessionsDirectory, 'rollout-2026-04-16T10-00-00-native-session-rename.jsonl'),
    `${buildLargeRolloutLines().join('\n')}\n`,
    'utf8',
  );
  await writeFile(
    path.join(codexHome, 'session_index.jsonl'),
    `${JSON.stringify({
      id: 'native-session-rename',
      thread_name: 'Original session title',
      updated_at: '2026-04-16T10:20:00.000Z',
    })}\n`,
    'utf8',
  );

  const builtinModuleLoader = process.getBuiltinModule?.bind(process);
  assert.ok(builtinModuleLoader, 'Node runtime should expose process.getBuiltinModule for the title rename contract.');

  const counters = {
    transcriptReads: [] as string[],
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
    const { ensureStoredNativeCodexSessionMirror } = await import(`${mirrorModulePath.href}?t=${moduleVersion}`);
    const { MockProjectService } = await import(`${mockProjectServiceModulePath.href}?t=${moduleVersion}`);

    const projectService = new MockProjectService();

    await ensureStoredNativeCodexSessionMirror({
      projectService,
      workspaceId: 'ws-1',
    });

    assert.equal(
      counters.transcriptReads.length > 0,
      true,
      'The initial mirror pass should read the native transcript once.',
    );

    counters.transcriptReads.length = 0;

    await writeFile(
      path.join(codexHome, 'session_index.jsonl'),
      `${JSON.stringify({
        id: 'native-session-rename',
        thread_name: 'Renamed in session index only',
        updated_at: '2026-04-16T11:00:00.000Z',
      })}\n`,
      'utf8',
    );

    await ensureStoredNativeCodexSessionMirror({
      projectService,
      workspaceId: 'ws-1',
    });

    const projects = await projectService.getProjects('ws-1');
    const mirroredSession = projects
      .find((project) => project.name === 'Codex Sessions')
      ?.codingSessions.find((session) => session.id === 'codex-native:native-session-rename');

    assert.equal(
      mirroredSession?.title,
      'Renamed in session index only',
      'The mirror should refresh native session titles from session_index updates.',
    );
    assert.deepEqual(
      counters.transcriptReads,
      [],
      'A pure session_index rename must not trigger a full rollout transcript reread.',
    );
  } finally {
    process.getBuiltinModule = originalGetBuiltinModule;
  }
});

console.log('native codex session title rename contract passed.');
