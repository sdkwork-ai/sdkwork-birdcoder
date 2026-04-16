import assert from 'node:assert/strict';

import type { ChatMessage } from '../packages/sdkwork-birdcoder-chat/src/types.ts';
import { resolveFallbackRuntimeMode } from '../packages/sdkwork-birdcoder-chat/src/index.ts';
import { createChatEngineById } from '../packages/sdkwork-birdcoder-commons/src/workbench/engines.ts';
import { listWorkbenchCliEngines } from '../packages/sdkwork-birdcoder-commons/src/workbench/kernel.ts';

const EXPECTED_OFFICIAL_PACKAGES = {
  codex: '@openai/codex-sdk',
  'claude-code': '@anthropic-ai/claude-agent-sdk',
  gemini: '@google/gemini-cli-sdk',
  opencode: '@opencode-ai/sdk',
} as const;

const messages: ChatMessage[] = [
  {
    id: 'msg-user-1',
    role: 'user',
    content: 'Inspect the current workspace and use the appropriate tool if needed.',
    timestamp: Date.now(),
  },
];

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

const codexFakeJsonlLines = [
  `${JSON.stringify({
    type: 'item.updated',
    item: {
      id: 'codex-runtime-adapter-message',
      type: 'agent_message',
      text: 'Codex canonical runtime adapter response.',
    },
  })}\n`,
  `${JSON.stringify({
    type: 'item.completed',
    item: {
      id: 'codex-runtime-adapter-command',
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

for (const engine of listWorkbenchCliEngines()) {
  const runtime = createChatEngineById(engine.id);

  assert.equal(
    typeof runtime.describeRuntime,
    'function',
    `${engine.id} must expose a canonical runtime descriptor`,
  );
  assert.equal(
    typeof runtime.sendCanonicalEvents,
    'function',
    `${engine.id} must expose a canonical runtime event stream`,
  );
  assert.equal(
    typeof runtime.describeIntegration,
    'function',
    `${engine.id} must preserve provider integration metadata through the canonical wrapper`,
  );
  assert.equal(
    typeof runtime.getHealth,
    'function',
    `${engine.id} must preserve provider health diagnostics through the canonical wrapper`,
  );

  const descriptor = runtime.describeRuntime?.({
    model: engine.defaultModelId,
  });
  const integration = runtime.describeIntegration?.();
  const health = await runtime.getHealth?.();

  assert.ok(descriptor, `${engine.id} runtime descriptor must be available`);
  assert.ok(integration, `${engine.id} integration descriptor must be available`);
  assert.ok(health, `${engine.id} health report must be available`);
  assert.equal(descriptor?.engineId, engine.id);
  assert.equal(descriptor?.modelId, engine.defaultModelId);
  assert.ok(
    descriptor?.transportKind
      ? engine.descriptor.transportKinds.includes(descriptor.transportKind)
      : false,
    `${engine.id} transportKind must stay inside the shared kernel descriptor`,
  );
  assert.equal(descriptor?.approvalPolicy, 'OnRequest');
  assert.equal(integration?.integrationClass, 'official-sdk');
  assert.equal(integration?.officialEntry.packageName, EXPECTED_OFFICIAL_PACKAGES[engine.id]);
  assert.equal(
    integration?.transportKinds.includes(descriptor?.transportKind ?? 'missing'),
    true,
    `${engine.id} integration transports must contain the canonical runtime transport`,
  );
  assert.equal(
    health?.runtimeMode,
    health?.sdkAvailable
      ? integration?.runtimeMode
      : resolveFallbackRuntimeMode(integration?.transportKinds ?? []) ?? integration?.runtimeMode,
    `${engine.id} health runtime mode must stay aligned with the resolved runtime lane`,
  );

  const events = [];
  const collectEvents = async () => {
    for await (const event of runtime.sendCanonicalEvents?.(messages, {
      model: engine.defaultModelId,
      context: {
        workspaceRoot: 'D:/workspace',
        currentFile: {
          path: 'src/App.tsx',
          content: 'export default function App() { return null; }',
          language: 'tsx',
        },
      },
    }) ?? []) {
      events.push(event);
    }
  };

  if (engine.id === 'codex') {
    await withMockChildProcessModule(
      createFakeSpawnModule({
        stdoutLines: codexFakeJsonlLines,
      }),
      collectEvents,
    );
  } else {
    await collectEvents();
  }

  assert.equal(events.length > 0, true, `${engine.id} must emit canonical runtime events`);
  assert.equal(events[0]?.kind, 'session.started');
  assert.equal(events[1]?.kind, 'turn.started');
  assert.equal(
    events.some((event) => event.kind === 'message.delta'),
    true,
    `${engine.id} must normalize content chunks into message.delta events`,
  );
  assert.equal(
    events.some((event) => event.kind === 'message.completed'),
    true,
    `${engine.id} must normalize stream completion into message.completed`,
  );
  assert.equal(
    events.some((event) => event.kind === 'tool.call.requested'),
    true,
    `${engine.id} must normalize tool requests`,
  );
  assert.equal(
    events.some((event) => event.kind === 'artifact.upserted'),
    true,
    `${engine.id} must project tool results into canonical artifacts`,
  );
  assert.equal(
    events.some((event) => event.kind === 'operation.updated'),
    true,
    `${engine.id} must expose canonical runtime status updates`,
  );
  assert.equal(
    events.some((event) => event.kind === 'turn.completed'),
    true,
    `${engine.id} must close the canonical turn stream`,
  );

  const toolRequestedEvent = events.find((event) => event.kind === 'tool.call.requested');
  assert.doesNotThrow(
    () => JSON.parse(String(toolRequestedEvent?.payload.toolArguments ?? '{}')),
    `${engine.id} tool.call.requested payload must keep JSON-safe tool arguments`,
  );

  if (engine.id !== 'gemini') {
    assert.equal(
      events.some((event) => event.kind === 'approval.required'),
      true,
      `${engine.id} side-effecting tool projections must emit approval.required`,
    );
  }
}

console.log('engine runtime adapter contract passed.');
