type RuntimeProcessWithBuiltinModules = NodeJS.Process & {
  getBuiltinModule?: (id: string) => unknown;
};

export type MockCodexCliSpawnInvocation = {
  command: string;
  args: readonly string[];
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    stdio?: ['pipe', 'pipe', 'pipe'];
    windowsHide?: boolean;
  } | undefined;
};

export interface MockCodexCliJsonlOptions {
  exitCode?: number;
  onSpawn?: (invocation: MockCodexCliSpawnInvocation) => void;
  stderrLines?: readonly string[];
  stdoutLines?: readonly string[];
  kernelTurnAssistantContent?: string;
  kernelTurnNativeSessionId?: string | null;
  kernelTurnShouldFail?: boolean;
  kernelTurnFailureMessage?: string;
}

export const DEFAULT_MOCK_CODEX_CLI_JSONL_LINES = [
  `${JSON.stringify({
    type: 'item.updated',
    item: {
      id: 'mock-codex-agent-message',
      type: 'agent_message',
      text: 'Mocked Codex projection response.',
    },
  })}\n`,
  `${JSON.stringify({
    type: 'item.completed',
    item: {
      id: 'mock-codex-command',
      type: 'command_execution',
      command: 'pnpm lint',
      aggregated_output: 'ok',
      exit_code: 0,
      status: 'completed',
    },
  })}\n`,
  `${JSON.stringify({
    type: 'turn.completed',
  })}\n`,
] as const;

function isKernelTurnBinary(command: string): boolean {
  return command.replace(/\\/gu, '/').includes('birdcoder-kernel-turn');
}

function createFakeSpawnModule(options: MockCodexCliJsonlOptions = {}) {
  return {
    spawn(
      command: string,
      args: readonly string[] = [],
      spawnOptions?: MockCodexCliSpawnInvocation['options'],
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
            for (const line of options.stdoutLines ?? DEFAULT_MOCK_CODEX_CLI_JSONL_LINES) {
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
    execFileSync(
      command: string,
      _args: readonly string[] = [],
      execOptions?: {
        input?: string;
        encoding?: string;
      },
    ) {
      if (!isKernelTurnBinary(command)) {
        throw new Error(`Unmocked execFileSync command: ${command}`);
      }

      if (options.kernelTurnShouldFail) {
        throw new Error(options.kernelTurnFailureMessage ?? 'Error: provider stream disconnected');
      }

      let nativeSessionId = options.kernelTurnNativeSessionId ?? null;
      if (execOptions?.input) {
        try {
          const payload = JSON.parse(execOptions.input) as { nativeSessionId?: string | null };
          nativeSessionId = payload.nativeSessionId ?? nativeSessionId;
        } catch {
          nativeSessionId = options.kernelTurnNativeSessionId ?? null;
        }
      }

      return JSON.stringify({
        assistantContent:
          options.kernelTurnAssistantContent ?? 'Mocked kernel bridge turn response.',
        nativeSessionId,
      });
    },
  };
}

export async function withMockCodexCliJsonl<T>(
  callback: () => Promise<T>,
  options: MockCodexCliJsonlOptions = {},
): Promise<T> {
  const runtimeProcess = process as RuntimeProcessWithBuiltinModules;
  const originalGetBuiltinModule = runtimeProcess.getBuiltinModule;
  const originalContractMock = process.env.BIRDCODER_KERNEL_TURN_CONTRACT_MOCK;

  process.env.BIRDCODER_KERNEL_TURN_CONTRACT_MOCK = '1';

  runtimeProcess.getBuiltinModule = (id: string) => {
    if (id === 'node:child_process') {
      return createFakeSpawnModule(options);
    }
    return originalGetBuiltinModule?.(id);
  };

  try {
    return await callback();
  } finally {
    if (originalContractMock === undefined) {
      delete process.env.BIRDCODER_KERNEL_TURN_CONTRACT_MOCK;
    } else {
      process.env.BIRDCODER_KERNEL_TURN_CONTRACT_MOCK = originalContractMock;
    }
    if (originalGetBuiltinModule) {
      runtimeProcess.getBuiltinModule = originalGetBuiltinModule;
    } else {
      delete runtimeProcess.getBuiltinModule;
    }
  }
}
