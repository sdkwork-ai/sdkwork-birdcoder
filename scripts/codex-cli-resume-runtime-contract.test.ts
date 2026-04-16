import assert from 'node:assert/strict';

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

function createMessageFixture(content: string): ChatMessage[] {
  return [
    {
      id: `codex-cli-resume-user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    },
  ];
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

const fakeJsonlLines = [
  `${JSON.stringify({
    type: 'item.updated',
    item: {
      id: 'codex-native-reply',
      type: 'agent_message',
      text: 'Codex resumed successfully.',
    },
  })}\n`,
  `${JSON.stringify({
    type: 'turn.completed',
  })}\n`,
];

await withMockChildProcessModule(
  createFakeSpawnModule({
    stdoutLines: fakeJsonlLines,
    onSpawn(invocation) {
      const prompt = 'Continue the native Codex session.';
      const execIndex = invocation.args.indexOf('exec');
      const resumeIndex = invocation.args.indexOf('resume');

      assert.notEqual(execIndex, -1, 'Codex CLI invocation must include `exec`.');
      assert.notEqual(
        resumeIndex,
        -1,
        'Native Codex sessions must continue through the `resume` CLI subcommand.',
      );
      assert.equal(
        resumeIndex > execIndex,
        true,
        'Codex resume must be invoked as a child command of `codex exec`.',
      );
      assert.equal(
        invocation.args[resumeIndex + 1],
        'native-session-1',
        'BirdCoder must strip the synthetic `codex-native:` prefix before invoking Codex CLI.',
      );
      assert.equal(
        invocation.args[resumeIndex + 2],
        prompt,
        'BirdCoder must forward the resumed prompt as the positional resume prompt.',
      );
      assert.equal(
        invocation.args.includes('--json'),
        true,
        'Codex resume must keep the JSONL event stream enabled.',
      );
    },
  }),
  async () => {
    const engine = new CodexChatEngine({
      officialSdkBridgeLoader: NULL_OFFICIAL_SDK_BRIDGE_LOADER,
    });

    const response = await engine.sendMessage(createMessageFixture('Continue the native Codex session.'), {
      model: 'codex',
      context: {
        workspaceRoot: process.cwd(),
        sessionId: 'codex-native:native-session-1',
      },
    });

    assert.equal(response.choices[0]?.message.content, 'Codex resumed successfully.');
  },
);

await withMockChildProcessModule(
  createFakeSpawnModule({
    stdoutLines: fakeJsonlLines,
    onSpawn(invocation) {
      const resumeIndex = invocation.args.indexOf('resume');

      assert.equal(
        resumeIndex,
        -1,
        'Non-native BirdCoder session ids must not be misrouted into the Codex native resume lane.',
      );
    },
  }),
  async () => {
    const engine = new CodexChatEngine({
      officialSdkBridgeLoader: NULL_OFFICIAL_SDK_BRIDGE_LOADER,
    });

    await engine.sendMessage(createMessageFixture('Start a fresh Codex turn.'), {
      model: 'codex',
      context: {
        workspaceRoot: process.cwd(),
        sessionId: 'birdcoder-session-1',
      },
    });
  },
);

console.log('codex CLI resume runtime contract passed.');
