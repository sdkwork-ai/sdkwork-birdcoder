import assert from 'node:assert/strict';

import { ClaudeChatEngine } from '../packages/sdkwork-birdcoder-chat-claude/src/index.ts';
import { GeminiChatEngine } from '../packages/sdkwork-birdcoder-chat-gemini/src/index.ts';
import { OpenCodeChatEngine } from '../packages/sdkwork-birdcoder-chat-opencode/src/index.ts';
import type { ChatMessage, IChatEngine } from '../packages/sdkwork-birdcoder-chat/src/types.ts';
import { resolveFallbackRuntimeMode } from '../packages/sdkwork-birdcoder-chat/src/index.ts';
import { createChatEngineById } from '../packages/sdkwork-birdcoder-codeengine/src/engines.ts';
import { listWorkbenchCliEngines } from '../packages/sdkwork-birdcoder-codeengine/src/kernel.ts';
import { createWorkbenchCanonicalChatEngine } from '../packages/sdkwork-birdcoder-codeengine/src/runtime.ts';

const EXPECTED_OFFICIAL_PACKAGES = {
  codex: '@openai/codex-sdk',
  'claude-code': '@anthropic-ai/claude-agent-sdk',
  gemini: '@google/gemini-cli-sdk',
  opencode: '@opencode-ai/sdk',
} as const;
const UNSAFE_CODEX_CLI_TOOL_ID = '101777208078558035';

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
  `{"type":"item.completed","item":{"id":${UNSAFE_CODEX_CLI_TOOL_ID},"type":"command_execution","command":"pnpm lint","aggregated_output":"ok","exit_code":0,"status":"completed"}}\n`,
  `${JSON.stringify({
    type: 'turn.completed',
  })}\n`,
];

function createMockSdkBackedRuntime(
  engine: ReturnType<typeof listWorkbenchCliEngines>[number],
) {
  const model = engine.defaultModelId;
  const created = Math.floor(Date.now() / 1000);
  const contentPrefix = `${engine.label} canonical runtime adapter response.`;
  const baseEngine =
    engine.id === 'claude-code'
      ? new ClaudeChatEngine({
        officialSdkBridgeLoader: {
          load: async () => ({
            async sendMessage() {
              return {
                id: `${engine.id}-runtime-adapter-response`,
                object: 'chat.completion',
                created,
                model,
                choices: [
                  {
                    index: 0,
                    message: {
                      id: `${engine.id}-runtime-adapter-message`,
                      role: 'assistant',
                      content: contentPrefix,
                      timestamp: Date.now(),
                    },
                    finish_reason: 'stop',
                  },
                ],
              };
            },
            async *sendMessageStream() {
              yield {
                id: `${engine.id}-runtime-adapter-stream`,
                object: 'chat.completion.chunk',
                created,
                model,
                choices: [
                  {
                    index: 0,
                    delta: {
                      role: 'assistant',
                      content: `${contentPrefix} `,
                    },
                    finish_reason: null,
                  },
                ],
              };

              yield {
                id: `${engine.id}-runtime-adapter-stream`,
                object: 'chat.completion.chunk',
                created,
                model,
                choices: [
                  {
                    index: 0,
                    delta: {
                      tool_calls: [
                        {
                          id: `${engine.id}-runtime-adapter-tool`,
                          type: 'function',
                          function: {
                            name: 'run_command',
                            arguments: JSON.stringify({
                              command: 'pnpm lint',
                              source: `${engine.id}-runtime-adapter-contract`,
                            }),
                          },
                        },
                      ],
                    },
                    finish_reason: 'tool_calls',
                  },
                ],
              };

              yield {
                id: `${engine.id}-runtime-adapter-stream`,
                object: 'chat.completion.chunk',
                created,
                model,
                choices: [
                  {
                    index: 0,
                    delta: {},
                    finish_reason: 'stop',
                  },
                ],
              };
            },
          }),
        },
      })
      : engine.id === 'gemini'
        ? new GeminiChatEngine({
          officialSdkBridgeLoader: {
            load: async () => ({
              async sendMessage() {
                return {
                  id: `${engine.id}-runtime-adapter-response`,
                  object: 'chat.completion',
                  created,
                  model,
                  choices: [
                    {
                      index: 0,
                      message: {
                        id: `${engine.id}-runtime-adapter-message`,
                        role: 'assistant',
                        content: contentPrefix,
                        timestamp: Date.now(),
                      },
                      finish_reason: 'stop',
                    },
                  ],
                };
              },
              async *sendMessageStream() {
                yield {
                  id: `${engine.id}-runtime-adapter-stream`,
                  object: 'chat.completion.chunk',
                  created,
                  model,
                  choices: [
                    {
                      index: 0,
                      delta: {
                        role: 'assistant',
                        content: `${contentPrefix} `,
                      },
                      finish_reason: null,
                    },
                  ],
                };

                yield {
                  id: `${engine.id}-runtime-adapter-stream`,
                  object: 'chat.completion.chunk',
                  created,
                  model,
                  choices: [
                    {
                      index: 0,
                      delta: {
                        tool_calls: [
                          {
                            id: `${engine.id}-runtime-adapter-tool`,
                            type: 'function',
                            function: {
                              name: 'search_code',
                              arguments: JSON.stringify({
                                query: 'pnpm lint',
                                source: `${engine.id}-runtime-adapter-contract`,
                              }),
                            },
                          },
                        ],
                      },
                      finish_reason: 'tool_calls',
                    },
                  ],
                };

                yield {
                  id: `${engine.id}-runtime-adapter-stream`,
                  object: 'chat.completion.chunk',
                  created,
                  model,
                  choices: [
                    {
                      index: 0,
                      delta: {},
                      finish_reason: 'stop',
                    },
                  ],
                };
              },
            }),
          },
        })
        : new OpenCodeChatEngine({
          officialSdkBridgeLoader: {
            load: async () => ({
              async sendMessage() {
                return {
                  id: 'opencode-runtime-adapter-response',
                  object: 'chat.completion',
                  created,
                  model,
                  choices: [
                    {
                      index: 0,
                      message: {
                        id: 'opencode-runtime-adapter-message',
                        role: 'assistant',
                        content: 'OpenCode canonical runtime adapter response.',
                        timestamp: Date.now(),
                      },
                      finish_reason: 'stop',
                    },
                  ],
                };
              },
              async *sendMessageStream() {
                yield {
                  id: 'opencode-runtime-adapter-stream',
                  object: 'chat.completion.chunk',
                  created,
                  model,
                  choices: [
                    {
                      index: 0,
                      delta: {
                        role: 'assistant',
                        content: 'OpenCode canonical runtime adapter response. ',
                      },
                      finish_reason: null,
                    },
                  ],
                };

                yield {
                  id: 'opencode-runtime-adapter-stream',
                  object: 'chat.completion.chunk',
                  created,
                  model,
                  choices: [
                    {
                      index: 0,
                      delta: {
                        tool_calls: [
                          {
                            id: 'opencode-runtime-adapter-tool',
                            type: 'function',
                            function: {
                              name: 'run_command',
                              arguments: JSON.stringify({
                                command: 'pnpm lint',
                                source: 'opencode-runtime-adapter-contract',
                              }),
                            },
                          },
                        ],
                      },
                      finish_reason: 'tool_calls',
                    },
                  ],
                };

                yield {
                  id: 'opencode-runtime-adapter-stream',
                  object: 'chat.completion.chunk',
                  created,
                  model,
                  choices: [
                    {
                      index: 0,
                      delta: {},
                      finish_reason: 'stop',
                    },
                  ],
                };
              },
            }),
          },
        });

  return createWorkbenchCanonicalChatEngine(
    baseEngine,
    {
      defaultModelId: engine.defaultModelId,
      descriptor: engine.descriptor,
    },
  );
}

for (const engine of listWorkbenchCliEngines()) {
  const canonicalRuntime =
    engine.id === 'codex'
      ? createChatEngineById(engine.id)
      : createMockSdkBackedRuntime(engine);

  assert.equal(
    typeof canonicalRuntime.describeRuntime,
    'function',
    `${engine.id} must expose a canonical runtime descriptor`,
  );
  assert.equal(
    typeof canonicalRuntime.sendCanonicalEvents,
    'function',
    `${engine.id} must expose a canonical runtime event stream`,
  );
  assert.equal(
    typeof canonicalRuntime.describeIntegration,
    'function',
    `${engine.id} must preserve provider integration metadata through the canonical wrapper`,
  );
  assert.equal(
    typeof canonicalRuntime.getHealth,
    'function',
    `${engine.id} must preserve provider health diagnostics through the canonical wrapper`,
  );

  const descriptor = canonicalRuntime.describeRuntime?.({
    model: engine.defaultModelId,
  });
  const integration = canonicalRuntime.describeIntegration?.();
  const health = await canonicalRuntime.getHealth?.();

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
    health?.fallbackActive
      ? resolveFallbackRuntimeMode(integration?.transportKinds ?? []) ?? integration?.runtimeMode
      : integration?.runtimeMode,
    `${engine.id} health runtime mode must stay aligned with the resolved runtime lane`,
  );

  const events = [];
  const collectEvents = async () => {
    for await (const event of canonicalRuntime.sendCanonicalEvents?.(messages, {
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
    events.some(
      (event) => event.kind === 'tool.call.requested' || event.kind === 'tool.call.completed',
    ),
    true,
    `${engine.id} must normalize tool requests or native completed tool snapshots`,
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

  const toolRequestedEvent = events.find(
    (event) => event.kind === 'tool.call.requested' || event.kind === 'tool.call.completed',
  );
  if (engine.id === 'codex') {
    assert.equal(
      toolRequestedEvent?.payload.toolCallId,
      UNSAFE_CODEX_CLI_TOOL_ID,
      'Codex CLI JSONL parsing must preserve unquoted Long item ids as canonical string toolCallIds',
    );
  }
  assert.doesNotThrow(
    () => JSON.parse(String(toolRequestedEvent?.payload.toolArguments ?? '{}')),
    `${engine.id} canonical tool payloads must keep JSON-safe tool arguments`,
  );

  const hasApprovalWorthyRequest = events.some((event) => {
    if (event.kind !== 'tool.call.requested') {
      return false;
    }
    return event.payload.requiresApproval === true;
  });
  if (hasApprovalWorthyRequest) {
    assert.equal(
      events.some((event) => event.kind === 'approval.required'),
      true,
      `${engine.id} side-effecting tool projections must emit approval.required`,
    );
  }
}

const streamOptionValues: Array<boolean | undefined> = [];
const streamDefaultRuntime = createWorkbenchCanonicalChatEngine(
  {
    name: 'Stream Default Runtime',
    version: 'test',
    async sendMessage() {
      throw new Error('stream default runtime contract should use streaming');
    },
    async *sendMessageStream(_messages, options) {
      streamOptionValues.push(options?.stream);
      yield {
        id: 'stream-default-runtime-stream',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'test-model',
        choices: [
          {
            index: 0,
            delta: {
              role: 'assistant',
              content: 'stream defaults stay enabled',
            },
            finish_reason: 'stop',
          },
        ],
      };
    },
  } satisfies IChatEngine,
  {
    defaultModelId: 'test-model',
    descriptor: listWorkbenchCliEngines()[0].descriptor,
  },
);

for await (const _event of streamDefaultRuntime.sendCanonicalEvents?.(messages, {
  model: 'test-model',
}) ?? []) {
  // Consume the stream to capture underlying options.
}
for await (const _event of streamDefaultRuntime.sendCanonicalEvents?.(messages, {
  model: 'test-model',
  stream: false,
}) ?? []) {
  // Consume the stream to capture underlying options.
}
assert.deepEqual(
  streamOptionValues,
  [true, true],
  'canonical runtime adapter must force ChatOptions.stream=true before calling provider sendMessageStream so canonical IDE turns cannot accidentally downgrade out of stream mode.',
);

const failingStreamRuntime = createWorkbenchCanonicalChatEngine(
  {
    name: 'Failing Stream Runtime',
    version: 'test',
    async sendMessage() {
      throw new Error('failing stream runtime contract should use streaming');
    },
    async *sendMessageStream() {
      yield {
        id: 'failing-stream-runtime-stream',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'test-model',
        choices: [
          {
            index: 0,
            delta: {
              role: 'assistant',
              content: 'partial response before failure',
            },
            finish_reason: null,
          },
        ],
      };
      throw new Error('provider stream disconnected');
    },
  } satisfies IChatEngine,
  {
    defaultModelId: 'test-model',
    descriptor: listWorkbenchCliEngines()[0].descriptor,
  },
);

const failingStreamEvents = [];
await assert.rejects(
  async () => {
    for await (const event of failingStreamRuntime.sendCanonicalEvents?.(messages, {
      model: 'test-model',
    }) ?? []) {
      failingStreamEvents.push(event);
    }
  },
  /provider stream disconnected/u,
);
const failingStreamTurnFailedEvent = failingStreamEvents.find(
  (event) => event.kind === 'turn.failed',
);
assert.equal(
  failingStreamTurnFailedEvent?.runtimeStatus,
  'failed',
  'canonical runtime adapter must emit a failed runtime status before rethrowing provider stream errors',
);
assert.equal(
  failingStreamTurnFailedEvent?.payload.errorMessage,
  'Error: provider stream disconnected',
  'canonical runtime adapter turn.failed payloads must use the shared errorMessage field used by native/server projections',
);
assert.equal(
  Object.hasOwn(failingStreamTurnFailedEvent?.payload ?? {}, 'error'),
  false,
  'canonical runtime adapter turn.failed payloads must not expose a competing error field beside errorMessage',
);

const chunkedToolCallRuntime = createWorkbenchCanonicalChatEngine(
  {
    name: 'Chunked Tool Runtime',
    version: 'test',
    async sendMessage() {
      throw new Error('chunked tool runtime contract should use streaming');
    },
    async *sendMessageStream() {
      yield {
        id: 'chunked-tool-runtime-stream',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'test-model',
        choices: [
          {
            index: 0,
            delta: {
              role: 'assistant',
              tool_calls: [
                {
                  id: 'tool-edit-file',
                  index: 0,
                  type: 'function',
                  function: {
                    name: 'edit_file',
                    arguments: '{"path":"src/App.tsx","content":"',
                  },
                } as never,
              ],
            },
            finish_reason: null,
          },
        ],
      };
      yield {
        id: 'chunked-tool-runtime-stream',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'test-model',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  function: {
                    arguments: 'export default 1;"}',
                  },
                } as never,
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };
    },
  } satisfies IChatEngine,
  {
    defaultModelId: 'test-model',
    descriptor: listWorkbenchCliEngines()[0].descriptor,
  },
);

const chunkedToolCallEvents = [];
for await (const event of chunkedToolCallRuntime.sendCanonicalEvents?.(messages, {
  model: 'test-model',
}) ?? []) {
  chunkedToolCallEvents.push(event);
}
const chunkedToolRequestedEvents = chunkedToolCallEvents.filter(
  (event) => event.kind === 'tool.call.requested',
);
assert.equal(
  chunkedToolRequestedEvents.length,
  1,
  'canonical runtime adapter must merge chunked tool_call deltas into one tool.call.requested event',
);
assert.deepEqual(
  JSON.parse(String(chunkedToolRequestedEvents[0]?.payload.toolArguments ?? '{}')),
  {
    path: 'src/App.tsx',
    content: 'export default 1;',
  },
  'canonical runtime adapter must expose complete merged tool arguments for chunked tool_call streams',
);
const chunkedArtifactEvent = chunkedToolCallEvents.find(
  (event) => event.kind === 'artifact.upserted',
);
assert.equal(
  chunkedArtifactEvent?.payload.toolArguments,
  chunkedToolRequestedEvents[0]?.payload.toolArguments,
  'artifact.upserted payloads must carry merged toolArguments so transcript projection can derive fileChanges without engine-specific lookups',
);

const fullSnapshotToolRuntime = createWorkbenchCanonicalChatEngine(
  {
    name: 'Full Snapshot Tool Runtime',
    version: 'test',
    async sendMessage() {
      throw new Error('full snapshot tool runtime contract should use streaming');
    },
    async *sendMessageStream() {
      yield {
        id: 'full-snapshot-tool-runtime-stream',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'test-model',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  id: 'tool-run-command',
                  type: 'function',
                  function: {
                    name: 'run_command',
                    arguments: JSON.stringify({
                      command: 'pnpm test',
                      status: 'running',
                    }),
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      };
      yield {
        id: 'full-snapshot-tool-runtime-stream',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'test-model',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  id: 'tool-run-command',
                  type: 'function',
                  function: {
                    name: 'run_command',
                    arguments: JSON.stringify({
                      command: 'pnpm test',
                      status: 'completed',
                      output: 'ok',
                    }),
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };
    },
  } satisfies IChatEngine,
  {
    defaultModelId: 'test-model',
    descriptor: listWorkbenchCliEngines()[0].descriptor,
  },
);

const fullSnapshotToolEvents = [];
for await (const event of fullSnapshotToolRuntime.sendCanonicalEvents?.(messages, {
  model: 'test-model',
}) ?? []) {
  fullSnapshotToolEvents.push(event);
}
assert.deepEqual(
  fullSnapshotToolEvents
    .filter((event) => event.payload.toolCallId === 'tool-run-command')
    .map((event) => event.kind),
  [
    'tool.call.progress',
    'artifact.upserted',
    'tool.call.completed',
    'artifact.upserted',
  ],
  'canonical runtime adapter must stream complete tool-call snapshots as soon as they are projectable instead of waiting for finish_reason or turn completion',
);
const fullSnapshotToolProjectedEvent = fullSnapshotToolEvents.find(
  (event) => event.kind === 'tool.call.requested' || event.kind === 'tool.call.completed',
);
assert.deepEqual(
  JSON.parse(String(fullSnapshotToolProjectedEvent?.payload.toolArguments ?? '{}')),
  {
    command: 'pnpm test',
    status: 'completed',
    output: 'ok',
  },
  'canonical runtime adapter must replace repeated complete tool-call snapshots instead of concatenating them as OpenAI-style argument deltas',
);

const toolLifecycleSnapshotRuntime = createWorkbenchCanonicalChatEngine(
  {
    name: 'Tool Lifecycle Snapshot Runtime',
    version: 'test',
    async sendMessage() {
      throw new Error('tool lifecycle snapshot runtime contract should use streaming');
    },
    async *sendMessageStream() {
      yield {
        id: 'tool-lifecycle-snapshot-runtime-stream',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'test-model',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  id: 'tool-lifecycle-command',
                  type: 'function',
                  function: {
                    name: 'run_command',
                    arguments: JSON.stringify({
                      command: 'pnpm test',
                    }),
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };
      yield {
        id: 'tool-lifecycle-snapshot-runtime-stream',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'test-model',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  id: 'tool-lifecycle-command',
                  type: 'function',
                  function: {
                    name: 'run_command',
                    arguments: JSON.stringify({
                      command: 'pnpm test',
                      status: 'completed',
                      exitCode: 0,
                      output: 'ok',
                    }),
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };
    },
  } satisfies IChatEngine,
  {
    defaultModelId: 'test-model',
    descriptor: listWorkbenchCliEngines()[0].descriptor,
  },
);

const toolLifecycleSnapshotEvents = [];
for await (const event of toolLifecycleSnapshotRuntime.sendCanonicalEvents?.(messages, {
  model: 'test-model',
}) ?? []) {
  toolLifecycleSnapshotEvents.push(event);
}
assert.deepEqual(
  toolLifecycleSnapshotEvents
    .filter((event) => event.payload.toolCallId === 'tool-lifecycle-command')
    .map((event) => event.kind),
  [
    'tool.call.requested',
    'artifact.upserted',
    'approval.required',
    'tool.call.completed',
    'artifact.upserted',
  ],
  'canonical runtime adapter must preserve tool lifecycle snapshots as requested/completed events instead of replaying completed tool responses as fresh requests',
);
assert.equal(
  toolLifecycleSnapshotEvents.filter((event) => event.kind === 'approval.required').length,
  1,
  'canonical runtime adapter must not ask for approval again when a later snapshot reports the already-requested tool result',
);

const duplicateSnapshotToolRuntime = createWorkbenchCanonicalChatEngine(
  {
    name: 'Duplicate Snapshot Tool Runtime',
    version: 'test',
    async sendMessage() {
      throw new Error('duplicate snapshot tool runtime contract should use streaming');
    },
    async *sendMessageStream() {
      for (let index = 0; index < 2; index += 1) {
        yield {
          id: 'duplicate-snapshot-tool-runtime-stream',
          object: 'chat.completion.chunk',
          created: 1,
          model: 'test-model',
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    id: 'tool-duplicate-command',
                    type: 'function',
                    function: {
                      name: 'run_command',
                      arguments: JSON.stringify({
                        command: 'pnpm lint',
                        status: 'running',
                      }),
                    },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        };
      }
    },
  } satisfies IChatEngine,
  {
    defaultModelId: 'test-model',
    descriptor: listWorkbenchCliEngines()[0].descriptor,
  },
);

const duplicateSnapshotToolEvents = [];
for await (const event of duplicateSnapshotToolRuntime.sendCanonicalEvents?.(messages, {
  model: 'test-model',
}) ?? []) {
  duplicateSnapshotToolEvents.push(event);
}
assert.deepEqual(
  duplicateSnapshotToolEvents
    .filter((event) => event.payload.toolCallId === 'tool-duplicate-command')
    .map((event) => event.kind),
  [
    'tool.call.progress',
    'artifact.upserted',
  ],
  'canonical runtime adapter must deduplicate repeated complete tool-call snapshots so realtime projections do not churn without state changes',
);

const completedOnlyToolRuntime = createWorkbenchCanonicalChatEngine(
  {
    name: 'Completed Only Tool Runtime',
    version: 'test',
    async sendMessage() {
      throw new Error('completed only tool runtime contract should use streaming');
    },
    async *sendMessageStream() {
      yield {
        id: 'completed-only-tool-runtime-stream',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'test-model',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  id: 'tool-completed-only-command',
                  type: 'function',
                  function: {
                    name: 'run_command',
                    arguments: JSON.stringify({
                      command: 'pnpm lint',
                      status: 'completed',
                      exitCode: 0,
                      output: 'ok',
                    }),
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };
    },
  } satisfies IChatEngine,
  {
    defaultModelId: 'test-model',
    descriptor: listWorkbenchCliEngines()[0].descriptor,
  },
);

const completedOnlyToolEvents = [];
for await (const event of completedOnlyToolRuntime.sendCanonicalEvents?.(messages, {
  model: 'test-model',
}) ?? []) {
  completedOnlyToolEvents.push(event);
}
assert.deepEqual(
  completedOnlyToolEvents
    .filter((event) => event.payload.toolCallId === 'tool-completed-only-command')
    .map((event) => event.kind),
  [
    'tool.call.completed',
    'artifact.upserted',
  ],
  'canonical runtime adapter must treat first-seen completed native tool snapshots as completed history, not as fresh approval requests',
);
assert.equal(
  completedOnlyToolEvents.some((event) => event.kind === 'approval.required'),
  false,
  'completed native tool snapshots must not ask for approval after the engine has already finished the command',
);
assert.equal(
  completedOnlyToolEvents.find((event) => event.kind === 'tool.call.completed')?.payload
    .requiresApproval,
  false,
  'completed native tool snapshots must expose requiresApproval=false because no BirdCoder approval is pending',
);

const runningOnlyToolRuntime = createWorkbenchCanonicalChatEngine(
  {
    name: 'Running Only Tool Runtime',
    version: 'test',
    async sendMessage() {
      throw new Error('running only tool runtime contract should use streaming');
    },
    async *sendMessageStream() {
      yield {
        id: 'running-only-tool-runtime-stream',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'test-model',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  id: 'tool-running-only-command',
                  type: 'function',
                  function: {
                    name: 'run_command',
                    arguments: JSON.stringify({
                      command: 'pnpm test',
                      status: 'running',
                    }),
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };
    },
  } satisfies IChatEngine,
  {
    defaultModelId: 'test-model',
    descriptor: listWorkbenchCliEngines()[0].descriptor,
  },
);

const runningOnlyToolEvents = [];
for await (const event of runningOnlyToolRuntime.sendCanonicalEvents?.(messages, {
  model: 'test-model',
}) ?? []) {
  runningOnlyToolEvents.push(event);
}
assert.deepEqual(
  runningOnlyToolEvents
    .filter((event) => event.payload.toolCallId === 'tool-running-only-command')
    .map((event) => event.kind),
  [
    'tool.call.progress',
    'artifact.upserted',
  ],
  'canonical runtime adapter must treat first-seen running native tool snapshots as progress, not as fresh approval requests',
);
assert.equal(
  runningOnlyToolEvents.some((event) => event.kind === 'approval.required'),
  false,
  'running native tool snapshots must not ask for BirdCoder approval after the engine has started the command',
);
assert.equal(
  runningOnlyToolEvents.find((event) => event.kind === 'turn.completed')?.runtimeStatus,
  'completed',
  'canonical runtime adapter must publish terminal turn.completed events as completed even when the last streamed tool snapshot was running, otherwise session lists keep showing an executing spinner after the provider stream ends',
);

const userQuestionRuntime = createWorkbenchCanonicalChatEngine(
  {
    name: 'User Question Runtime',
    version: 'test',
    async sendMessage() {
      throw new Error('user question runtime contract should use streaming');
    },
    async *sendMessageStream() {
      yield {
        id: 'user-question-runtime-stream',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'test-model',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  id: 'tool-user-question',
                  type: 'function',
                  function: {
                    name: 'question',
                    arguments: JSON.stringify({
                      status: 'awaiting_user',
                      questions: [
                        {
                          question: 'Which tests should I run?',
                          options: [
                            {
                              label: 'Unit',
                              description: 'Run unit tests only',
                            },
                          ],
                        },
                      ],
                    }),
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };
    },
  } satisfies IChatEngine,
  {
    defaultModelId: 'test-model',
    descriptor: listWorkbenchCliEngines()[0].descriptor,
  },
);

const userQuestionEvents = [];
for await (const event of userQuestionRuntime.sendCanonicalEvents?.(messages, {
  model: 'test-model',
}) ?? []) {
  userQuestionEvents.push(event);
}
assert.deepEqual(
  userQuestionEvents
    .filter((event) => event.payload.toolCallId === 'tool-user-question')
    .map((event) => event.kind),
  [
    'tool.call.requested',
    'artifact.upserted',
  ],
  'canonical runtime adapter must not turn cross-engine user_question prompts into approval.required events',
);
assert.equal(
  userQuestionEvents.some((event) => event.kind === 'approval.required'),
  false,
  'user_question prompts wait for a user answer, not a code-execution approval gate',
);
assert.equal(
  userQuestionEvents.find((event) => event.kind === 'tool.call.requested')?.runtimeStatus,
  'awaiting_user',
  'canonical runtime adapter must expose user_question prompts with the distinct awaiting_user runtime status',
);
assert.equal(
  userQuestionEvents.find((event) => event.kind === 'tool.call.requested')?.payload.toolName,
  'user_question',
  'canonical runtime adapter must normalize question aliases before publishing tool.call events',
);
assert.equal(
  userQuestionEvents.some((event) => event.kind === 'turn.completed'),
  false,
  'canonical runtime adapter must not publish turn.completed after a user_question prompt because the provider turn is awaiting a user answer.',
);
assert.equal(
  userQuestionEvents.at(-1)?.runtimeStatus,
  'awaiting_user',
  'canonical runtime adapter must leave user_question streams in awaiting_user state instead of overwriting them with completed.',
);

const approvalAliasRuntime = createWorkbenchCanonicalChatEngine(
  {
    name: 'Approval Alias Runtime',
    version: 'test',
    async sendMessage() {
      throw new Error('approval alias runtime contract should use streaming');
    },
    async *sendMessageStream() {
      yield {
        id: 'approval-alias-runtime-stream',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'test-model',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  id: 'tool-approval-alias',
                  type: 'function',
                  function: {
                    name: 'approval_request',
                    arguments: JSON.stringify({
                      status: 'awaiting_approval',
                      tool: 'edit_file',
                      permission: 'write',
                    }),
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };
    },
  } satisfies IChatEngine,
  {
    defaultModelId: 'test-model',
    descriptor: listWorkbenchCliEngines()[0].descriptor,
  },
);

const approvalAliasEvents = [];
for await (const event of approvalAliasRuntime.sendCanonicalEvents?.(messages, {
  model: 'test-model',
}) ?? []) {
  approvalAliasEvents.push(event);
}
assert.equal(
  approvalAliasEvents.find((event) => event.kind === 'tool.call.requested')?.payload.toolName,
  'permission_request',
  'canonical runtime adapter must normalize approval_request aliases before publishing tool.call events',
);
assert.equal(
  approvalAliasEvents.find((event) => event.kind === 'approval.required')?.payload.toolName,
  'permission_request',
  'canonical runtime adapter must normalize approval_request aliases before publishing approval.required events',
);
assert.equal(
  approvalAliasEvents.some((event) => event.kind === 'turn.completed'),
  false,
  'canonical runtime adapter must not publish turn.completed after an approval request because the provider turn is awaiting a decision.',
);
assert.equal(
  approvalAliasEvents.at(-1)?.runtimeStatus,
  'awaiting_approval',
  'canonical runtime adapter must leave approval streams in awaiting_approval state instead of overwriting them with completed.',
);

const dialectAliasRuntime = createWorkbenchCanonicalChatEngine(
  {
    name: 'Dialect Alias Runtime',
    version: 'test',
    async sendMessage() {
      throw new Error('dialect alias runtime contract should use streaming');
    },
    async *sendMessageStream() {
      yield {
        id: 'dialect-alias-runtime-stream',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'test-model',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  id: 'tool-bash-alias',
                  type: 'function',
                  function: {
                    name: 'bash',
                    arguments: JSON.stringify({
                      command: 'pnpm lint',
                    }),
                  },
                },
                {
                  id: 'tool-create-file-alias',
                  type: 'function',
                  function: {
                    name: 'create_file',
                    arguments: JSON.stringify({
                      path: 'src/App.tsx',
                      content: 'export default null;',
                    }),
                  },
                },
                {
                  id: 'tool-todowrite-alias',
                  type: 'function',
                  function: {
                    name: 'todoWrite',
                    arguments: JSON.stringify({
                      todos: [
                        {
                          content: 'Run regression contracts',
                          status: 'pending',
                        },
                      ],
                    }),
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };
    },
  } satisfies IChatEngine,
  {
    defaultModelId: 'test-model',
    descriptor: listWorkbenchCliEngines()[0].descriptor,
  },
);

const dialectAliasEvents = [];
for await (const event of dialectAliasRuntime.sendCanonicalEvents?.(messages, {
  model: 'test-model',
}) ?? []) {
  dialectAliasEvents.push(event);
}

function findDialectAliasEvent(
  kind: 'artifact.upserted' | 'tool.call.requested',
  toolCallId: string,
) {
  return dialectAliasEvents.find(
    (event) => event.kind === kind && event.payload.toolCallId === toolCallId,
  );
}

assert.equal(
  findDialectAliasEvent('artifact.upserted', 'tool-bash-alias')?.artifact?.kind,
  'command-log',
  'canonical runtime adapter must classify bash/shell aliases as command artifacts via the shared dialect standard',
);
assert.equal(
  findDialectAliasEvent('tool.call.requested', 'tool-bash-alias')?.payload.riskLevel,
  'P2',
  'canonical runtime adapter must classify bash/shell aliases as side-effecting command risk',
);
assert.equal(
  findDialectAliasEvent('tool.call.requested', 'tool-bash-alias')?.payload.toolName,
  'run_command',
  'canonical runtime adapter must publish the shared run_command tool name instead of leaking provider command aliases',
);
assert.equal(
  findDialectAliasEvent('artifact.upserted', 'tool-bash-alias')?.artifact?.metadata?.toolName,
  'run_command',
  'canonical runtime artifacts must store the shared run_command tool name for command aliases',
);
assert.equal(
  findDialectAliasEvent('artifact.upserted', 'tool-create-file-alias')?.artifact?.kind,
  'patch',
  'canonical runtime adapter must classify create_file/multi_edit aliases as patch artifacts via the shared dialect standard',
);
assert.equal(
  findDialectAliasEvent('tool.call.requested', 'tool-create-file-alias')?.payload.riskLevel,
  'P2',
  'canonical runtime adapter must classify create_file/multi_edit aliases as side-effecting file-change risk',
);
assert.equal(
  findDialectAliasEvent('artifact.upserted', 'tool-todowrite-alias')?.artifact?.kind,
  'todo-list',
  'canonical runtime adapter must classify todoWrite/write_todo aliases as todo-list artifacts via the shared dialect standard',
);
assert.equal(
  findDialectAliasEvent('tool.call.requested', 'tool-todowrite-alias')?.payload.riskLevel,
  'P1',
  'canonical runtime adapter must classify todoWrite/write_todo aliases as low-risk task updates',
);
assert.equal(
  findDialectAliasEvent('tool.call.requested', 'tool-todowrite-alias')?.payload.toolName,
  'write_todo',
  'canonical runtime adapter must publish the shared write_todo tool name instead of leaking task aliases',
);

console.log('engine runtime adapter contract passed.');
