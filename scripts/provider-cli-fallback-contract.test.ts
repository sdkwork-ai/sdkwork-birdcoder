import assert from 'node:assert/strict';

import { GeminiChatEngine } from '../packages/sdkwork-birdcoder-chat-gemini/src/index.ts';
import { OpenCodeChatEngine } from '../packages/sdkwork-birdcoder-chat-opencode/src/index.ts';
import type {
  ChatMessage,
  ChatStreamChunk,
} from '../packages/sdkwork-birdcoder-chat/src/index.ts';

const NULL_OFFICIAL_SDK_BRIDGE_LOADER = {
  load: async () => null,
};

const messages: ChatMessage[] = [
  {
    id: 'provider-cli-fallback-user-1',
    role: 'user',
    content: 'Use the provider CLI fallback when the official SDK package is unavailable.',
    timestamp: Date.now(),
  },
];

async function collectStream(
  iterable: AsyncIterable<ChatStreamChunk>,
): Promise<ChatStreamChunk[]> {
  const chunks: ChatStreamChunk[] = [];
  for await (const chunk of iterable) {
    chunks.push(chunk);
  }
  return chunks;
}

function createJsonlReadable() {
  const listeners: Array<(chunk: unknown) => void> = [];
  return {
    on(event: 'data', listener: (chunk: unknown) => void) {
      if (event === 'data') {
        listeners.push(listener);
      }
    },
    emitData(chunk: string) {
      for (const listener of listeners) {
        listener(chunk);
      }
    },
  };
}

function createWritable(onEnd: () => void) {
  return {
    write() {
      // Gemini/OpenCode CLI fallbacks pass prompt arguments on argv, not stdin.
    },
    end() {
      onEnd();
    },
  };
}

async function verifyDefaultProviderCliSpawnShape() {
  const runtimeProcess = globalThis.process as typeof process & {
    getBuiltinModule?: (id: string) => unknown;
  };
  const originalGetBuiltinModule = runtimeProcess.getBuiltinModule;
  const capturedCommands: Array<{ command: string; args: readonly string[]; cwd?: string }> = [];

  const fakeChildProcessModule = {
    spawn(command: string, args: readonly string[], options: { cwd?: string }) {
      capturedCommands.push({ command, args, cwd: options.cwd });
      const stdout = createJsonlReadable();
      const stderr = createJsonlReadable();
      let closeListener: ((code: number | null) => void) | null = null;
      const child = {
        stdin: createWritable(() => {
          queueMicrotask(() => {
            if (args.includes('run')) {
              stdout.emitData(
                '{"type":"text","part":{"id":"opencode-spawn-text","type":"text","text":"OpenCode default CLI response."}}\n',
              );
            } else {
              stdout.emitData(
                '{"type":"message","role":"assistant","content":"Gemini default CLI response.","delta":true}\n',
              );
              stdout.emitData('{"type":"result","status":"success"}\n');
            }
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
    'Node runtime must expose process.getBuiltinModule for provider CLI fallback spawn contracts.',
  );
  const requiredGetBuiltinModule = originalGetBuiltinModule as NonNullable<
    typeof originalGetBuiltinModule
  >;
  runtimeProcess.getBuiltinModule = ((id: string): object =>
    id === 'node:child_process'
      ? fakeChildProcessModule
      : requiredGetBuiltinModule.call(runtimeProcess, id)) as typeof runtimeProcess.getBuiltinModule;

  try {
    const geminiDefaultEngine = new GeminiChatEngine({
      officialSdkBridgeLoader: NULL_OFFICIAL_SDK_BRIDGE_LOADER,
    });
    const geminiResponse = await geminiDefaultEngine.sendMessage(messages, {
      model: 'gemini',
      context: {
        workspaceRoot: 'D:\\workspace',
      },
    });
    assert.equal(
      geminiResponse.choices[0]?.message.content,
      'Gemini default CLI response.',
      'Gemini default CLI fallback should parse real stream-json events from the spawned CLI.',
    );

    const openCodeDefaultEngine = new OpenCodeChatEngine({
      officialSdkBridgeLoader: NULL_OFFICIAL_SDK_BRIDGE_LOADER,
    });
    const openCodeResponse = await openCodeDefaultEngine.sendMessage(messages, {
      model: 'opencode',
      context: {
        workspaceRoot: 'D:\\workspace',
      },
    });
    assert.equal(
      openCodeResponse.choices[0]?.message.content,
      'OpenCode default CLI response.',
      'OpenCode default CLI fallback should parse real json events from the spawned CLI.',
    );
  } finally {
    runtimeProcess.getBuiltinModule = originalGetBuiltinModule;
  }

  const geminiCommand = capturedCommands.find((entry) =>
    entry.args.includes('--output-format') || entry.command.includes('gemini'),
  );
  assert.ok(geminiCommand, 'Gemini fallback should spawn the gemini CLI.');
  assert.equal(
    geminiCommand.args.includes('gemini') || geminiCommand.command === 'gemini',
    true,
    'Gemini fallback should invoke the platform Gemini command.',
  );
  assert.deepEqual(
    geminiCommand.args.slice(
      geminiCommand.args.indexOf('--output-format'),
      geminiCommand.args.indexOf('--output-format') + 2,
    ),
    ['--output-format', 'stream-json'],
    'Gemini fallback should use stream-json output.',
  );
  assert.equal(
    geminiCommand.args.includes('--prompt'),
    true,
    'Gemini fallback should run in non-interactive prompt mode.',
  );
  assert.equal(
    geminiCommand.args.includes('--model'),
    false,
    'Gemini fallback should not pass the BirdCoder gemini sentinel as a provider model id.',
  );
  assert.equal(
    geminiCommand.cwd,
    'D:\\workspace',
    'Gemini fallback should spawn from ChatOptions.context.workspaceRoot.',
  );

  const openCodeCommand = capturedCommands.find((entry) => entry.args.includes('run'));
  assert.ok(openCodeCommand, 'OpenCode fallback should spawn the opencode run CLI.');
  assert.equal(
    openCodeCommand.args.includes('opencode') || openCodeCommand.command === 'opencode',
    true,
    'OpenCode fallback should invoke the platform OpenCode command.',
  );
  assert.deepEqual(
    openCodeCommand.args.slice(
      openCodeCommand.args.indexOf('--format'),
      openCodeCommand.args.indexOf('--format') + 2,
    ),
    ['--format', 'json'],
    'OpenCode fallback should use opencode run json output.',
  );
  assert.equal(
    openCodeCommand.args.includes('--model'),
    false,
    'OpenCode fallback should not pass the BirdCoder opencode sentinel as a provider model id.',
  );
  assert.deepEqual(
    openCodeCommand.args.slice(
      openCodeCommand.args.indexOf('--dir'),
      openCodeCommand.args.indexOf('--dir') + 2,
    ),
    ['--dir', 'D:\\workspace'],
    'OpenCode fallback should pass ChatOptions.context.workspaceRoot through --dir.',
  );
  assert.match(
    openCodeCommand.args[openCodeCommand.args.length - 1] ?? '',
    /provider CLI fallback/,
    'OpenCode fallback should pass the canonical transcript as the run message.',
  );
}

await verifyDefaultProviderCliSpawnShape();

const geminiPrompts: string[] = [];
const geminiEngine = new GeminiChatEngine({
  officialSdkBridgeLoader: NULL_OFFICIAL_SDK_BRIDGE_LOADER,
  geminiCliJsonlTurnExecutor: async function* geminiCliJsonlTurn(prompt, options) {
    geminiPrompts.push(prompt);
    assert.equal(
      options?.model,
      'gemini',
      'Gemini CLI fallback should keep the selected BirdCoder model in ChatOptions while normalizing CLI args separately.',
    );
    yield {
      type: 'message',
      role: 'assistant',
      content: 'Gemini ',
      delta: true,
    };
    yield {
      type: 'tool_use',
      tool_id: 'gemini-tool-read-1',
      tool_name: 'Read',
      parameters: {
        file_path: 'src/App.tsx',
      },
    };
    yield {
      type: 'message',
      role: 'assistant',
      content: 'fallback response.',
      delta: true,
    };
    yield {
      type: 'result',
      status: 'success',
    };
  },
});

const geminiResponse = await geminiEngine.sendMessage(messages, {
  model: 'gemini',
});
assert.equal(
  geminiResponse.choices[0]?.message.content,
  'Gemini fallback response.',
  'Gemini CLI fallback must aggregate stream-json assistant deltas instead of throwing when the SDK bridge is unavailable.',
);
assert.equal(
  geminiResponse.choices[0]?.message.tool_calls?.[0]?.function.name,
  'read_file',
  'Gemini CLI fallback must preserve provider tool_use events as canonical assistant tool_calls.',
);
assert.deepEqual(
  JSON.parse(geminiResponse.choices[0]?.message.tool_calls?.[0]?.function.arguments ?? '{}'),
  {
    file_path: 'src/App.tsx',
  },
);

const geminiChunks = await collectStream(geminiEngine.sendMessageStream(messages, {
  model: 'gemini',
}));
assert.equal(
  geminiChunks.map((chunk) => chunk.choices[0]?.delta.content ?? '').join(''),
  'Gemini fallback response.',
  'Gemini CLI fallback streaming must yield assistant deltas as CLI JSONL arrives.',
);
assert.equal(
  geminiChunks.find((chunk) => (chunk.choices[0]?.delta.tool_calls?.length ?? 0) > 0)
    ?.choices[0]?.delta.tool_calls?.[0]?.function.name,
  'read_file',
  'Gemini CLI fallback streaming must yield tool_use events as canonical tool calls.',
);
assert.match(
  geminiPrompts.join('\n'),
  /provider CLI fallback/,
  'Gemini CLI fallback should receive the canonical transcript prompt.',
);

const opencodePrompts: string[] = [];
const openCodeEngine = new OpenCodeChatEngine({
  officialSdkBridgeLoader: NULL_OFFICIAL_SDK_BRIDGE_LOADER,
  openCodeCliJsonlTurnExecutor: async function* openCodeCliJsonlTurn(prompt, options) {
    opencodePrompts.push(prompt);
    assert.equal(
      options?.model,
      'opencode',
      'OpenCode CLI fallback should keep the selected BirdCoder model in ChatOptions while normalizing CLI args separately.',
    );
    yield {
      type: 'text',
      part: {
        id: 'opencode-text-part-1',
        type: 'text',
        text: 'OpenCode ',
      },
    };
    yield {
      type: 'tool_use',
      part: {
        id: 'opencode-tool-1',
        type: 'tool',
        callID: 'opencode-tool-1',
        tool: 'bash',
        state: {
          status: 'completed',
          input: {
            command: 'pnpm lint',
          },
          output: 'ok',
        },
      },
    };
    yield {
      type: 'text',
      part: {
        id: 'opencode-text-part-1',
        type: 'text',
        text: 'OpenCode fallback response.',
      },
    };
  },
});

const openCodeResponse = await openCodeEngine.sendMessage(messages, {
  model: 'opencode',
});
assert.equal(
  openCodeResponse.choices[0]?.message.content,
  'OpenCode fallback response.',
  'OpenCode CLI fallback must aggregate opencode run --format json text events instead of throwing when the SDK bridge is unavailable.',
);
assert.equal(
  openCodeResponse.choices[0]?.message.tool_calls?.[0]?.function.name,
  'run_command',
  'OpenCode CLI fallback must preserve tool_use events as canonical assistant tool_calls.',
);
assert.deepEqual(
  JSON.parse(openCodeResponse.choices[0]?.message.tool_calls?.[0]?.function.arguments ?? '{}'),
  {
    command: 'pnpm lint',
    output: 'ok',
    openCodeState: {
      status: 'completed',
      input: {
        command: 'pnpm lint',
      },
      output: 'ok',
    },
    status: 'completed',
  },
);

const openCodeChunks = await collectStream(openCodeEngine.sendMessageStream(messages, {
  model: 'opencode',
}));
assert.equal(
  openCodeChunks.map((chunk) => chunk.choices[0]?.delta.content ?? '').join(''),
  'OpenCode fallback response.',
  'OpenCode CLI fallback streaming must normalize cumulative text snapshots into append-only deltas.',
);
assert.equal(
  openCodeChunks.find((chunk) => (chunk.choices[0]?.delta.tool_calls?.length ?? 0) > 0)
    ?.choices[0]?.delta.tool_calls?.[0]?.function.name,
  'run_command',
  'OpenCode CLI fallback streaming must yield tool_use events as canonical tool calls.',
);
assert.match(
  opencodePrompts.join('\n'),
  /provider CLI fallback/,
  'OpenCode CLI fallback should receive the canonical transcript prompt.',
);

console.log('provider CLI fallback contract passed.');
