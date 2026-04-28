import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { ClaudeChatEngine } from '../packages/sdkwork-birdcoder-chat-claude/src/index.ts';
import { CodexChatEngine } from '../packages/sdkwork-birdcoder-chat-codex/src/index.ts';
import { GeminiChatEngine } from '../packages/sdkwork-birdcoder-chat-gemini/src/index.ts';
import { OpenCodeChatEngine } from '../packages/sdkwork-birdcoder-chat-opencode/src/index.ts';
import type {
  ChatMessage,
  ChatResponse,
  ChatStreamChunk,
} from '../packages/sdkwork-birdcoder-chat/src/index.ts';

const messages: ChatMessage[] = [
  {
    id: 'sdk-runtime-user-1',
    role: 'user',
    content: 'Use the official SDK lane when available.',
    timestamp: Date.now(),
  },
];

const adapterSourcePaths = [
  '../packages/sdkwork-birdcoder-chat-codex/src/index.ts',
  '../packages/sdkwork-birdcoder-chat-claude/src/index.ts',
  '../packages/sdkwork-birdcoder-chat-gemini/src/index.ts',
  '../packages/sdkwork-birdcoder-chat-opencode/src/index.ts',
] as const;

for (const adapterSourcePath of adapterSourcePaths) {
  const absolutePath = fileURLToPath(new URL(adapterSourcePath, import.meta.url));
  const source = readFileSync(absolutePath, 'utf8');
  assert.match(
    source,
    /'officialSdkBridgeLoader'\s+in\s+options\s*\?\s*options\.officialSdkBridgeLoader\s*\?\?\s*null\s*:\s*DEFAULT_[A-Z_]+_OFFICIAL_SDK_BRIDGE_LOADER/,
    `${absolutePath} must treat officialSdkBridgeLoader: null as an explicit request to disable the default SDK bridge loader.`,
  );
}

function createSdkResponse(engineId: string): ChatResponse {
  return {
    id: `sdk-${engineId}-response`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: `${engineId}-sdk-model`,
    choices: [
      {
        index: 0,
        message: {
          id: `sdk-${engineId}-message`,
          role: 'assistant',
          content: `${engineId} official sdk response`,
          timestamp: Date.now(),
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 6,
      total_tokens: 16,
    },
  };
}

async function collectStream(
  iterable: AsyncGenerator<ChatStreamChunk, void, unknown>,
): Promise<ChatStreamChunk[]> {
  const chunks: ChatStreamChunk[] = [];
  for await (const chunk of iterable) {
    chunks.push(chunk);
  }
  return chunks;
}

async function verifyProviderStreamOptionsDefaultToTrue() {
  const providers = [
    {
      engineId: 'codex',
      createEngine: (streamValues: Array<boolean | undefined>) =>
        new CodexChatEngine({
          officialSdkBridgeLoader: {
            load: async () => ({
              async *sendMessageStream(_messages, options) {
                streamValues.push(options?.stream);
                yield* createSdkStream('codex-stream-default');
              },
            }),
          },
          cliJsonlTurnExecutor: null,
        }),
    },
    {
      engineId: 'claude-code',
      createEngine: (streamValues: Array<boolean | undefined>) =>
        new ClaudeChatEngine({
          officialSdkBridgeLoader: {
            load: async () => ({
              async *sendMessageStream(_messages, options) {
                streamValues.push(options?.stream);
                yield* createSdkStream('claude-stream-default');
              },
            }),
          },
          claudeCliTurnExecutor: null,
        }),
    },
    {
      engineId: 'gemini',
      createEngine: (streamValues: Array<boolean | undefined>) =>
        new GeminiChatEngine({
          officialSdkBridgeLoader: {
            load: async () => ({
              async *sendMessageStream(_messages, options) {
                streamValues.push(options?.stream);
                yield* createSdkStream('gemini-stream-default');
              },
            }),
          },
        }),
    },
    {
      engineId: 'opencode',
      createEngine: (streamValues: Array<boolean | undefined>) =>
        new OpenCodeChatEngine({
          officialSdkBridgeLoader: {
            load: async () => ({
              async *sendMessageStream(_messages, options) {
                streamValues.push(options?.stream);
                yield* createSdkStream('opencode-stream-default');
              },
            }),
          },
        }),
    },
  ] as const;

  for (const provider of providers) {
    const streamValues: Array<boolean | undefined> = [];
    const engine = provider.createEngine(streamValues);
    await collectStream(
      engine.sendMessageStream(messages, {
        model: provider.engineId,
      }),
    );
    await collectStream(
      engine.sendMessageStream(messages, {
        model: provider.engineId,
        stream: false,
      }),
    );

    assert.deepEqual(
      streamValues,
      [true, true],
      `${provider.engineId} sendMessageStream must force ChatOptions.stream=true for official SDK bridges so IDE turns always use streamed echo semantics.`,
    );
  }
}

async function verifyFallbackStreamOptionsDefaultToTrue() {
  const codexStreamValues: Array<boolean | undefined> = [];
  const codexEngine = new CodexChatEngine({
    officialSdkBridgeLoader: {
      load: async () => null,
    },
    cliJsonlTurnExecutor: async (_prompt, options) => {
      codexStreamValues.push(options?.stream);
      return [
        {
          type: 'item.updated',
          item: {
            id: 'codex-cli-stream-default-message',
            type: 'agent_message',
            text: 'codex cli stream default response',
          },
        },
        {
          type: 'turn.completed',
        },
      ];
    },
  });
  await collectStream(
    codexEngine.sendMessageStream(messages, {
      model: 'codex',
    }),
  );
  await collectStream(
    codexEngine.sendMessageStream(messages, {
      model: 'codex',
      stream: false,
    }),
  );
  assert.deepEqual(
    codexStreamValues,
    [true, true],
    'Codex CLI stream fallback must receive ChatOptions.stream=true from sendMessageStream.',
  );

  const claudeStreamValues: Array<boolean | undefined> = [];
  const claudeEngine = new ClaudeChatEngine({
    officialSdkBridgeLoader: {
      load: async () => null,
    },
    claudeCliTurnExecutor: async (_prompt, options) => {
      claudeStreamValues.push(options?.stream);
      return 'claude cli stream default response';
    },
  });
  await collectStream(
    claudeEngine.sendMessageStream(messages, {
      model: 'claude-code',
    }),
  );
  await collectStream(
    claudeEngine.sendMessageStream(messages, {
      model: 'claude-code',
      stream: false,
    }),
  );
  assert.deepEqual(
    claudeStreamValues,
    [true, true],
    'Claude CLI stream fallback must receive ChatOptions.stream=true from sendMessageStream.',
  );
}

async function verifyClaudeDefaultCliJsonlFallback() {
  const runtimeProcess = globalThis.process as typeof process & {
    getBuiltinModule?: (id: string) => unknown;
  };
  const originalGetBuiltinModule = runtimeProcess.getBuiltinModule;
  let capturedPrompt = '';
  let spawnCalled = false;

  class FakeReadable {
    private dataListeners: Array<(chunk: unknown) => void> = [];

    on(event: 'data', listener: (chunk: unknown) => void) {
      if (event === 'data') {
        this.dataListeners.push(listener);
      }
    }

    emitData(chunk: string) {
      for (const listener of this.dataListeners) {
        listener(chunk);
      }
    }
  }

  class FakeWritable {
    private readonly handleEnd: () => void;

    constructor(onEnd: () => void) {
      this.handleEnd = onEnd;
    }

    write(chunk: string) {
      capturedPrompt += chunk;
    }

    end() {
      this.handleEnd();
    }
  }

  const fakeChildProcessModule = {
    spawn(command: string, args: readonly string[], options: { cwd?: string }) {
      spawnCalled = true;
      assert.equal(
        command,
        runtimeProcess.platform === 'win32' ? runtimeProcess.env.ComSpec || 'cmd.exe' : 'claude',
        'Claude CLI fallback should invoke the platform command wrapper',
      );
      assert.equal(
        args.includes('claude') || command === 'claude',
        true,
        'Claude CLI fallback should invoke the real claude command',
      );
      assert.equal(
        args.includes('--print'),
        true,
        'Claude CLI fallback should run in non-interactive print mode',
      );
      assert.deepEqual(
        args.slice(args.indexOf('--output-format'), args.indexOf('--output-format') + 2),
        ['--output-format', 'stream-json'],
        'Claude CLI fallback should use the JSONL stream output lane declared by the catalog',
      );
      assert.equal(
        args.includes('--verbose'),
        true,
        'Claude CLI fallback should satisfy Claude Code stream-json print mode requirements',
      );
      assert.equal(
        args.includes('--no-session-persistence'),
        true,
        'Claude CLI fallback should avoid unmanaged Claude session persistence for bridge turns',
      );
      assert.equal(
        args.includes('--model'),
        false,
        'Claude CLI fallback should not forward the BirdCoder engine sentinel as a provider model id',
      );
      assert.equal(
        options.cwd,
        process.cwd(),
        'Claude CLI fallback should default to the runtime working directory',
      );

      const stdout = new FakeReadable();
      const stderr = new FakeReadable();
      let closeListener: ((code: number | null) => void) | null = null;
      const child = {
        stdin: new FakeWritable(() => {
          queueMicrotask(() => {
            stdout.emitData(
              '{"type":"assistant","message":{"content":[{"type":"text","text":"Claude "}]}}\n',
            );
            stdout.emitData(
              '{"type":"result","result":"Claude cli jsonl response"}\n',
            );
            closeListener?.(0);
          });
        }),
        stdout,
        stderr,
        kill: () => true,
        once(event: 'error' | 'close', listener: (value: Error | number | null) => void) {
          if (event === 'close') {
            closeListener = listener as (code: number | null) => void;
          }
          return child;
        },
      };
      return child;
    },
  };

  assert.equal(
    typeof originalGetBuiltinModule,
    'function',
    'Node runtime must expose process.getBuiltinModule for the CLI fallback contract',
  );
  const requiredGetBuiltinModule = originalGetBuiltinModule as NonNullable<
    typeof originalGetBuiltinModule
  >;
  runtimeProcess.getBuiltinModule = ((id: string): object =>
    id === 'node:child_process'
      ? fakeChildProcessModule
      : requiredGetBuiltinModule.call(runtimeProcess, id)) as typeof runtimeProcess.getBuiltinModule;

  try {
    const engine = new ClaudeChatEngine({
      officialSdkBridgeLoader: {
        load: async () => null,
      },
    });
    const response = await engine.sendMessage(messages, {
      model: 'claude-code',
    });
    const chunks = await collectStream(
      engine.sendMessageStream(messages, {
        model: 'claude-code',
      }),
    );

    assert.equal(spawnCalled, true, 'Claude default CLI fallback should spawn the CLI');
    assert.match(
      capturedPrompt,
      /Use the official SDK lane when available\./,
      'Claude default CLI fallback should send the canonical prompt through stdin',
    );
    assert.equal(
      response.choices[0]?.message.content,
      'Claude cli jsonl response',
      'Claude default CLI fallback should aggregate stream-json assistant/result events',
    );
    assert.equal(
      chunks.map((chunk) => chunk.choices[0]?.delta.content ?? '').join(''),
      'Claude cli jsonl response',
      'Claude default CLI stream fallback should reuse the same JSONL CLI response',
    );
  } finally {
    runtimeProcess.getBuiltinModule = originalGetBuiltinModule;
  }
}

function createSdkStream(engineId: string): AsyncGenerator<ChatStreamChunk, void, unknown> {
  return (async function* sdkStream() {
    yield {
      id: `sdk-${engineId}-stream`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: `${engineId}-sdk-model`,
      choices: [
        {
          index: 0,
          delta: {
            role: 'assistant',
            content: `${engineId} official `,
          },
          finish_reason: null,
        },
      ],
    };

    yield {
      id: `sdk-${engineId}-stream`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: `${engineId}-sdk-model`,
      choices: [
        {
          index: 0,
          delta: {
            content: 'sdk stream',
          },
          finish_reason: 'stop',
        },
      ],
    };
  })();
}

const providers = [
  {
    engineId: 'codex',
    fallbackBehavior: 'supported',
    createWithSdk: () =>
      new CodexChatEngine({
        officialSdkBridgeLoader: {
          load: async () => ({
            sendMessage: async () => createSdkResponse('codex'),
            sendMessageStream: async function* () {
              yield* createSdkStream('codex');
            },
          }),
        },
      }),
    createFallback: () =>
      new CodexChatEngine({
        officialSdkBridgeLoader: {
          load: async () => null,
        },
        cliJsonlTurnExecutor: async () => [
          {
            type: 'item.updated',
            item: {
              id: 'codex-cli-fallback-message',
              type: 'agent_message',
              text: 'codex cli fallback response',
            },
          },
          {
            type: 'turn.completed',
          },
        ],
      }),
  },
  {
    engineId: 'claude-code',
    fallbackBehavior: 'supported',
    expectedFallbackText: 'claude cli fallback response',
    createWithSdk: () =>
      new ClaudeChatEngine({
        officialSdkBridgeLoader: {
          load: async () => ({
            sendMessage: async () => createSdkResponse('claude-code'),
            sendMessageStream: async function* () {
              yield* createSdkStream('claude-code');
            },
          }),
        },
      }),
    createFallback: () =>
      new ClaudeChatEngine({
        officialSdkBridgeLoader: {
          load: async () => null,
        },
        claudeCliTurnExecutor: async (prompt, options) => {
          assert.match(
            prompt,
            /Use the official SDK lane when available\./,
            'Claude CLI fallback should receive the same canonical prompt as the SDK bridge',
          );
          assert.equal(
            options?.model,
            'claude-code',
            'Claude CLI fallback should preserve the selected model in chat options',
          );
          return 'claude cli fallback response';
        },
      }),
  },
  {
    engineId: 'gemini',
    fallbackBehavior: 'unavailable',
    createWithSdk: () =>
      new GeminiChatEngine({
        officialSdkBridgeLoader: {
          load: async () => ({
            sendMessage: async () => createSdkResponse('gemini'),
            sendMessageStream: async function* () {
              yield* createSdkStream('gemini');
            },
          }),
        },
      }),
    createFallback: () =>
      new GeminiChatEngine({
        officialSdkBridgeLoader: {
          load: async () => null,
        },
      }),
  },
  {
    engineId: 'opencode',
    fallbackBehavior: 'unavailable',
    createWithSdk: () =>
      new OpenCodeChatEngine({
        officialSdkBridgeLoader: {
          load: async () => ({
            sendMessage: async () => createSdkResponse('opencode'),
            sendMessageStream: async function* () {
              yield* createSdkStream('opencode');
            },
          }),
        },
      }),
    createFallback: () =>
      new OpenCodeChatEngine({
        officialSdkBridgeLoader: {
          load: async () => null,
        },
      }),
  },
] as const;

await verifyProviderStreamOptionsDefaultToTrue();
await verifyFallbackStreamOptionsDefaultToTrue();

for (const provider of providers) {
  const sdkEngine = provider.createWithSdk();
  const sdkResponse = await sdkEngine.sendMessage(messages, {
    model: provider.engineId,
  });

  assert.equal(
    sdkResponse.choices[0]?.message.content,
    `${provider.engineId} official sdk response`,
    `${provider.engineId} should prefer the official SDK branch for one-shot responses`,
  );

  const sdkChunks = await collectStream(
    sdkEngine.sendMessageStream(messages, {
      model: provider.engineId,
    }),
  );

  assert.equal(
    sdkChunks.map((chunk) => chunk.choices[0]?.delta.content ?? '').join(''),
    `${provider.engineId} official sdk stream`,
    `${provider.engineId} should prefer the official SDK branch for streaming responses`,
  );

  const fallbackEngine = provider.createFallback();
  if (provider.fallbackBehavior === 'supported') {
    const fallbackResponse = await fallbackEngine.sendMessage(messages, {
      model: provider.engineId,
    });
    const fallbackChunks = await collectStream(
      fallbackEngine.sendMessageStream(messages, {
        model: provider.engineId,
      }),
    );

    assert.notEqual(
      fallbackResponse.choices[0]?.message.content,
      `${provider.engineId} official sdk response`,
      `${provider.engineId} should fall back when no official SDK bridge is available`,
    );
    if ('expectedFallbackText' in provider) {
      assert.equal(
        fallbackResponse.choices[0]?.message.content,
        provider.expectedFallbackText,
        `${provider.engineId} should use the real configured fallback lane instead of synthesizing a response`,
      );
    }
    assert.notEqual(
      fallbackChunks.map((chunk) => chunk.choices[0]?.delta.content ?? '').join(''),
      `${provider.engineId} official sdk stream`,
      `${provider.engineId} stream should fall back when no official SDK bridge is available`,
    );
    if ('expectedFallbackText' in provider) {
      assert.equal(
        fallbackChunks.map((chunk) => chunk.choices[0]?.delta.content ?? '').join(''),
        provider.expectedFallbackText,
        `${provider.engineId} stream should reuse the real configured fallback lane`,
      );
    }
  } else {
    await assert.rejects(
      () =>
        fallbackEngine.sendMessage(messages, {
          model: provider.engineId,
        }),
      /bridge is unavailable/i,
      `${provider.engineId} should fail loudly instead of synthesizing a fallback one-shot response`,
    );
    await assert.rejects(
      () =>
        collectStream(
          fallbackEngine.sendMessageStream(messages, {
            model: provider.engineId,
          }),
        ),
      /bridge is unavailable/i,
      `${provider.engineId} should fail loudly instead of synthesizing a fallback stream`,
    );
  }
}

await verifyClaudeDefaultCliJsonlFallback();

const codexSendOnlyToolCallEngine = new CodexChatEngine({
  officialSdkBridgeLoader: {
    load: async () => ({
      sendMessage: async () => ({
        id: 'codex-send-only-tool-call-response',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'codex-sdk-model',
        choices: [
          {
            index: 0,
            message: {
              id: 'codex-send-only-tool-call-message',
              role: 'assistant',
              content: 'I need to ask a question.',
              timestamp: Date.now(),
              tool_calls: [
                {
                  id: 'codex-send-only-question',
                  type: 'function',
                  function: {
                    name: 'user_question',
                    arguments: JSON.stringify({
                      question: 'Which tests should I run?',
                      status: 'awaiting_user',
                    }),
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      }),
    }),
  },
  cliJsonlTurnExecutor: null,
});
const codexSendOnlyToolCallChunks = await collectStream(
  codexSendOnlyToolCallEngine.sendMessageStream(messages, {
    model: 'codex',
  }),
);
assert.equal(
  codexSendOnlyToolCallChunks.some(
    (chunk) => chunk.choices[0]?.delta.content === 'I need to ask a question.',
  ),
  true,
  'Codex sendMessage-only SDK stream fallback must preserve assistant text.',
);
assert.equal(
  codexSendOnlyToolCallChunks.some(
    (chunk) =>
      chunk.choices[0]?.delta.tool_calls?.[0]?.id === 'codex-send-only-question',
  ),
  true,
  'Codex sendMessage-only SDK stream fallback must preserve tool_calls so user-question/approval cards are not dropped.',
);

console.log('engine official sdk runtime selection contract passed.');
