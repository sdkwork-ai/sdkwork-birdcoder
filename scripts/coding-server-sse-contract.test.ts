import assert from 'node:assert/strict';

import type { ChatMessage } from '../packages/sdkwork-birdcoder-chat/src/types.ts';
import { executeBirdCoderCoreSessionRun, streamBirdCoderCoreSessionEventEnvelopes } from '../packages/sdkwork-birdcoder-server/src/index.ts';

const messages: ChatMessage[] = [
  {
    id: 'msg-user-1',
    role: 'user',
    content: 'Review the workspace and use a tool if you need to modify files.',
    timestamp: Date.now(),
  },
];

type RuntimeProcessWithBuiltinModules = NodeJS.Process & {
  getBuiltinModule?: (id: string) => unknown;
};

function createFakeSpawnModule(stdoutLines: readonly string[]) {
  return {
    spawn() {
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
            for (const line of stdoutLines) {
              for (const listener of stdoutListeners) {
                listener(line);
              }
            }
            for (const listener of stderrListeners) {
              listener('');
            }
            queueMicrotask(() => {
              onceListeners.close?.(0);
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
  stdoutLines: readonly string[],
  callback: () => Promise<T>,
): Promise<T> {
  const runtimeProcess = process as RuntimeProcessWithBuiltinModules;
  const originalGetBuiltinModule = runtimeProcess.getBuiltinModule;

  runtimeProcess.getBuiltinModule = (id: string) => {
    if (id === 'node:child_process') {
      return createFakeSpawnModule(stdoutLines);
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

const fakeCodexJsonlLines = [
  `${JSON.stringify({
    type: 'item.updated',
    item: {
      id: 'coding-server-sse-message',
      type: 'agent_message',
      text: 'Codex server SSE response.',
    },
  })}\n`,
  `${JSON.stringify({
    type: 'item.completed',
    item: {
      id: 'coding-server-sse-command',
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
];

await withMockChildProcessModule(fakeCodexJsonlLines, async () => {
  const projection = await executeBirdCoderCoreSessionRun({
    sessionId: 'coding-session-1',
    runtimeId: 'runtime-1',
    turnId: 'turn-1',
    engineId: 'codex',
    modelId: 'codex',
    hostMode: 'server',
    messages,
    options: {
      model: 'codex',
      context: {
        workspaceRoot: 'D:/workspace',
        currentFile: {
          path: 'src/App.tsx',
          content: 'export default function App() { return null; }',
          language: 'tsx',
        },
      },
    },
  });

  assert.equal(projection.runtime.engineId, 'codex');
  assert.equal(projection.runtime.hostMode, 'server');
  assert.equal(projection.runtime.nativeRef.transportKind, 'cli-jsonl');
  assert.equal(projection.events[0]?.kind, 'session.started');
  assert.equal(projection.events[1]?.kind, 'turn.started');
  assert.equal(projection.events.some((event) => event.kind === 'approval.required'), true);
  assert.equal(projection.artifacts.length > 0, true, 'server projection must preserve projected artifacts');
  assert.equal(projection.operation.status, 'running');
  assert.equal(projection.operation.streamKind, 'sse');
  assert.equal(
    projection.operation.streamUrl,
    '/api/core/v1/coding-sessions/coding-session-1/events',
  );

  const envelopes = [];
  for await (const envelope of streamBirdCoderCoreSessionEventEnvelopes({
    sessionId: 'coding-session-1',
    runtimeId: 'runtime-1',
    turnId: 'turn-1',
    engineId: 'codex',
    modelId: 'codex',
    hostMode: 'server',
    messages,
    options: {
      model: 'codex',
    },
  })) {
    envelopes.push(envelope);
  }

  assert.equal(envelopes.length > 0, true, 'coding-server SSE contract must emit envelopes');
  assert.equal(envelopes[0]?.meta.version, 'v1');
  assert.equal(envelopes[0]?.data.kind, 'session.started');
  assert.equal(envelopes.some((envelope) => envelope.data.kind === 'tool.call.requested'), true);
  assert.equal(envelopes.some((envelope) => envelope.data.kind === 'artifact.upserted'), true);
  assert.equal(envelopes.some((envelope) => envelope.data.kind === 'turn.completed'), true);
});

console.log('coding server sse contract passed.');
