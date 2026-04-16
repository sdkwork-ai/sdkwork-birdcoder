import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { CodexChatEngine } from '../packages/sdkwork-birdcoder-chat-codex/src/index.ts';
import type {
  ChatEngineOfficialSdkBridgeLoader,
  ChatMessage,
} from '../packages/sdkwork-birdcoder-chat/src/index.ts';

const NULL_OFFICIAL_SDK_BRIDGE_LOADER: ChatEngineOfficialSdkBridgeLoader = {
  load: async () => null,
};

type RuntimeProcessWithBuiltinModules = NodeJS.Process & {
  getBuiltinModule?: (id: string) => unknown;
};

type SpawnInvocation = {
  command: string;
  args: readonly string[];
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    stdio?: ['pipe', 'pipe', 'pipe'];
    windowsHide?: boolean;
  } | undefined;
};

const messageFixture: ChatMessage[] = [
  {
    id: 'codex-config-compat-user-1',
    role: 'user',
    content: 'Verify Codex local configuration compatibility.',
    timestamp: Date.now(),
  },
];

async function withTemporaryCodexHome<T>(
  callback: (codexHome: string, fakeBinDir: string) => Promise<T>,
): Promise<T> {
  const codexHome = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-codex-home-'));
  const fakeBinDir = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-codex-bin-'));
  const originalCodexHome = process.env.CODEX_HOME;
  const originalPath = process.env.PATH;
  const originalPathExt = process.env.PATHEXT;
  const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
  const originalCodexApiKey = process.env.CODEX_API_KEY;

  await writeFile(path.join(fakeBinDir, 'codex.cmd'), '@echo off\r\necho codex\r\n', 'utf8');

  process.env.CODEX_HOME = codexHome;
  process.env.PATH = fakeBinDir;
  process.env.PATHEXT = '.CMD;.EXE';
  delete process.env.OPENAI_API_KEY;
  delete process.env.CODEX_API_KEY;

  try {
    return await callback(codexHome, fakeBinDir);
  } finally {
    if (originalCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = originalCodexHome;
    }
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }
    if (originalPathExt === undefined) {
      delete process.env.PATHEXT;
    } else {
      process.env.PATHEXT = originalPathExt;
    }
    if (originalOpenAiApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiApiKey;
    }
    if (originalCodexApiKey === undefined) {
      delete process.env.CODEX_API_KEY;
    } else {
      process.env.CODEX_API_KEY = originalCodexApiKey;
    }

    await rm(codexHome, { recursive: true, force: true });
    await rm(fakeBinDir, { recursive: true, force: true });
  }
}

function createFakeSpawnModule(options: {
  stdoutLines?: readonly string[];
  stderrLines?: readonly string[];
  exitCode?: number;
  onSpawn?: (invocation: SpawnInvocation) => void;
}) {
  return {
    spawn(
      command: string,
      args: readonly string[] = [],
      spawnOptions?: SpawnInvocation['options'],
    ) {
      options.onSpawn?.({
        command,
        args,
        options: spawnOptions,
      });

      const stdoutListeners: Array<(chunk: unknown) => void> = [];
      const stderrListeners: Array<(chunk: unknown) => void> = [];
      const onceListeners: {
        error?: (error: Error) => void;
        close?: (code: number | null) => void;
      } = {};

      return {
        stdin: {
          write() {
            return undefined;
          },
          end() {
            for (const line of options.stdoutLines ?? []) {
              for (const listener of stdoutListeners) {
                listener(line);
              }
            }
            for (const line of options.stderrLines ?? []) {
              for (const listener of stderrListeners) {
                listener(line);
              }
            }
            queueMicrotask(() => {
              onceListeners.close?.(options.exitCode ?? 0);
            });
          },
        },
        stdout: {
          on(event: 'data', listener: (chunk: unknown) => void) {
            if (event === 'data') {
              stdoutListeners.push(listener);
            }
          },
        },
        stderr: {
          on(event: 'data', listener: (chunk: unknown) => void) {
            if (event === 'data') {
              stderrListeners.push(listener);
            }
          },
        },
        kill() {
          return true;
        },
        once(event: 'error' | 'close', listener: (value: Error | number | null) => void) {
          if (event === 'error') {
            onceListeners.error = listener as (error: Error) => void;
          } else {
            onceListeners.close = listener as (code: number | null) => void;
          }
          return this;
        },
      };
    },
  };
}

async function withMockChildProcessModule<T>(
  moduleFactory: ReturnType<typeof createFakeSpawnModule>,
  callback: () => Promise<T>,
): Promise<T> {
  const runtimeProcess = process as RuntimeProcessWithBuiltinModules;
  const originalGetBuiltinModule = runtimeProcess.getBuiltinModule;

  runtimeProcess.getBuiltinModule = (id: string) => {
    if (id === 'node:child_process') {
      return moduleFactory;
    }
    return originalGetBuiltinModule?.(id);
  };

  try {
    return await callback();
  } finally {
    if (originalGetBuiltinModule) {
      runtimeProcess.getBuiltinModule = originalGetBuiltinModule;
    } else {
      delete runtimeProcess.getBuiltinModule;
    }
  }
}

await withTemporaryCodexHome(async (codexHome) => {
  await mkdir(codexHome, { recursive: true });
  await writeFile(
    path.join(codexHome, 'auth.json'),
    JSON.stringify({ OPENAI_API_KEY: 'sk-test-codex-home' }),
    'utf8',
  );
  await writeFile(
    path.join(codexHome, 'config.toml'),
    [
      'model_provider = "custom"',
      '[model_providers.custom]',
      'name = "custom"',
      'base_url = "https://example.test/v1"',
      'requires_openai_auth = true',
      '',
    ].join('\n'),
    'utf8',
  );

  const engine = new CodexChatEngine({
    officialSdkBridgeLoader: NULL_OFFICIAL_SDK_BRIDGE_LOADER,
  });
  const health = engine.getHealth();

  assert.equal(
    health.authConfigured,
    true,
    'Codex health should treat an existing CODEX_HOME/auth.json as valid authentication.',
  );
  assert.equal(
    health.cliAvailable,
    true,
    'Codex health should still confirm the CLI is available when using local config compatibility.',
  );
  assert.equal(
    health.diagnostics.some((line) => line.includes('auth.json')),
    true,
    'Codex health should report that it detected the existing local auth.json configuration.',
  );
  assert.equal(
    health.diagnostics.some((line) => line.includes('config.toml')),
    true,
    'Codex health should report that it detected the existing local config.toml configuration.',
  );
  assert.equal(
    health.diagnostics.some((line) => line.includes('model provider') || line.includes('provider base URL')),
    true,
    'Codex health should surface the active local provider/base URL override instead of hiding it.',
  );
});

await withMockChildProcessModule(
  createFakeSpawnModule({
    stdoutLines: [
      `${JSON.stringify({
        type: 'turn.failed',
        error: {
          message: 'Missing bearer or basic authentication in header',
        },
      })}\n`,
    ],
    exitCode: 1,
  }),
  async () => {
    const engine = new CodexChatEngine({
      officialSdkBridgeLoader: NULL_OFFICIAL_SDK_BRIDGE_LOADER,
    });

    await assert.rejects(
      () => engine.sendMessage(messageFixture, {
        model: 'codex',
        context: {
          workspaceRoot: process.cwd(),
        },
      }),
      (error) =>
        error instanceof Error &&
        error.message ===
          'Codex CLI authentication is not configured. BirdCoder reuses your existing Codex auth from `CODEX_HOME` or `~/.codex`; if none is configured, set `OPENAI_API_KEY` or run `codex login --with-api-key`.',
      'Codex CLI auth failures should explain that BirdCoder automatically reuses the standard local Codex configuration.',
    );
  },
);

console.log('codex config compatibility contract passed.');
