import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createClaudeOfficialSdkBridge,
} from '../packages/sdkwork-birdcoder-chat-claude/src/index.ts';
import {
  createCodexOfficialSdkBridge,
} from '../packages/sdkwork-birdcoder-chat-codex/src/index.ts';
import {
  createGeminiOfficialSdkBridge,
} from '../packages/sdkwork-birdcoder-chat-gemini/src/index.ts';
import {
  createOpenCodeOfficialSdkBridge,
} from '../packages/sdkwork-birdcoder-chat-opencode/src/index.ts';
import {
  buildMessageTranscriptPrompt,
  normalizeProviderToolArgumentRecord,
  resolveCumulativeTextDelta,
  streamResponseAsChunks,
} from '../packages/sdkwork-birdcoder-chat/src/index.ts';

import type {
  ChatMessage,
  ChatStreamChunk,
} from '../packages/sdkwork-birdcoder-chat/src/index.ts';

const messages: ChatMessage[] = [
  {
    id: 'provider-bridge-user-1',
    role: 'user',
    content: 'Use the official SDK provider bridge.',
    timestamp: Date.now(),
  },
];

const richTranscriptPrompt = buildMessageTranscriptPrompt([
  {
    id: 'provider-bridge-assistant-tool-call',
    role: 'assistant',
    content: 'I will inspect the file.',
    timestamp: Date.now(),
    tool_calls: [
      {
        id: 'tool-read-file',
        type: 'function',
        function: {
          name: 'read_file',
          arguments: '{"path":"src/App.tsx"}',
        },
      },
    ],
  },
  {
    id: 'provider-bridge-tool-response',
    role: 'tool',
    content: 'export const answer = 42;',
    timestamp: Date.now(),
    tool_call_id: 'tool-read-file',
    attachments: [
      {
        id: 'attachment-app',
        workspaceId: 101777208078558037n,
        type: 'file',
        name: 'src/App.tsx',
        content: 'export const answer = 42;',
      },
    ],
  },
]);
assert.equal(
  richTranscriptPrompt,
  [
    'ASSISTANT: I will inspect the file.',
    'TOOL_CALLS: [{"id":"tool-read-file","type":"function","function":{"name":"read_file","arguments":"{\\"path\\":\\"src/App.tsx\\"}"}}]',
    '',
    'TOOL: export const answer = 42;',
    'TOOL_CALL_ID: tool-read-file',
    'ATTACHMENTS: [{"id":"attachment-app","workspaceId":"101777208078558037","type":"file","name":"src/App.tsx","content":"export const answer = 42;"}]',
  ].join('\n'),
  'shared provider transcript prompts must preserve tool calls, tool response ids, and attachments so all code-engine adapters receive the same conversation context',
);
assert.equal(
  resolveCumulativeTextDelta('', 'BirdCoder response'),
  'BirdCoder response',
  'shared cumulative text delta helper should emit the first snapshot unchanged',
);
assert.equal(
  resolveCumulativeTextDelta('BirdCoder ', 'BirdCoder response'),
  'response',
  'shared cumulative text delta helper should trim prefix snapshots into append-only deltas',
);
assert.equal(
  resolveCumulativeTextDelta('Claude bridge ', 'bridge response'),
  'response',
  'shared cumulative text delta helper should trim overlap snapshots so provider streams do not duplicate text',
);
assert.equal(
  resolveCumulativeTextDelta('old text', 'replacement text'),
  'replacement text',
  'shared cumulative text delta helper should emit replacement snapshots when no prefix or overlap relationship exists',
);
assert.deepEqual(
  normalizeProviderToolArgumentRecord('{"path":"src/App.tsx","requestId":101777208078558036}'),
  {
    path: 'src/App.tsx',
    requestId: '101777208078558036',
  },
  'shared provider tool argument helper must parse JSON object strings and preserve unsafe Java Long IDs',
);
assert.deepEqual(
  normalizeProviderToolArgumentRecord('["src/App.tsx"]'),
  {
    input: ['src/App.tsx'],
  },
  'shared provider tool argument helper must wrap non-object JSON values under input',
);
assert.deepEqual(
  normalizeProviderToolArgumentRecord('not-json'),
  {
    input: 'not-json',
  },
  'shared provider tool argument helper must preserve invalid JSON strings as raw input',
);
assert.deepEqual(
  normalizeProviderToolArgumentRecord({ command: 'pnpm lint' }),
  {
    command: 'pnpm lint',
  },
  'shared provider tool argument helper must shallow-copy object inputs',
);

const cumulativeTextDeltaAdapterFiles = [
  'packages/sdkwork-birdcoder-chat-claude/src/index.ts',
  'packages/sdkwork-birdcoder-chat-codex/src/index.ts',
  'packages/sdkwork-birdcoder-chat-opencode/src/index.ts',
];
const forbiddenLocalCumulativeTextDeltaPatterns = [
  /function getClaudeQueryResultDelta/u,
  /function getCodexAgentMessageDelta/u,
  /function getOpenCodeTextSnapshotDelta/u,
];
for (const filePath of cumulativeTextDeltaAdapterFiles) {
  const source = readFileSync(filePath, 'utf8');
  for (const pattern of forbiddenLocalCumulativeTextDeltaPatterns) {
    assert.equal(
      pattern.test(source),
      false,
      `${filePath} must consume the shared cumulative text delta helper instead of ${pattern}`,
    );
  }
}

const genericToolArgumentAdapterFiles = [
  'packages/sdkwork-birdcoder-chat-codex/src/index.ts',
  'packages/sdkwork-birdcoder-chat-gemini/src/index.ts',
  'packages/sdkwork-birdcoder-chat-opencode/src/index.ts',
];
const forbiddenLocalToolArgumentPatterns = [
  /function normalizeCodexToolArgumentRecord/u,
  /function normalizeGeminiToolArguments/u,
  /function normalizeGeminiToolArgumentRecord/u,
  /function normalizeOpenCodeToolArgumentRecord/u,
];
for (const filePath of genericToolArgumentAdapterFiles) {
  const source = readFileSync(filePath, 'utf8');
  assert.match(
    source,
    /normalizeProviderToolArgumentRecord/u,
    `${filePath} must consume the shared provider tool argument normalizer.`,
  );
  for (const pattern of forbiddenLocalToolArgumentPatterns) {
    assert.equal(
      pattern.test(source),
      false,
      `${filePath} must not carry a local generic tool argument normalizer matching ${pattern}`,
    );
  }
}

async function collectStream(
  iterableOrPromise: AsyncIterable<ChatStreamChunk> | Promise<AsyncIterable<ChatStreamChunk>>,
): Promise<ChatStreamChunk[]> {
  const iterable = await iterableOrPromise;
  const chunks: ChatStreamChunk[] = [];
  for await (const chunk of iterable) {
    chunks.push(chunk);
  }
  return chunks;
}

const responseFallbackChunks = await collectStream(
  streamResponseAsChunks({
    id: 'one-shot-with-tool-calls',
    object: 'chat.completion',
    created: 1,
    model: 'fallback-model',
    choices: [
      {
        index: 0,
        message: {
          id: 'one-shot-with-tool-calls-message',
          role: 'assistant',
          content: 'I need to run a command.',
          timestamp: Date.now(),
          tool_calls: [
            {
              id: 'one-shot-tool-run',
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
  }),
);
assert.equal(
  responseFallbackChunks.some((chunk) => chunk.choices[0]?.delta.content === 'I need to run a command.'),
  true,
  'one-shot response fallback streaming should preserve assistant text',
);
assert.equal(
  responseFallbackChunks.some((chunk) => chunk.choices[0]?.delta.tool_calls?.[0]?.id === 'one-shot-tool-run'),
  true,
  'one-shot response fallback streaming must preserve assistant tool_calls so non-streaming official SDKs do not drop command/approval/question events',
);

const codexBridge = createCodexOfficialSdkBridge({
  Codex: class {
    startThread() {
      return {
        run: async () => ({
          finalResponse: 'Codex bridge response',
          items: [
            {
              id: 'codex-one-shot-command',
              type: 'command_execution',
              command: 'pnpm lint',
              aggregated_output: 'ok',
              exit_code: 0,
              status: 'completed',
            },
          ],
          usage: {
            input_tokens: 3,
            cached_input_tokens: 1,
            output_tokens: 4,
          },
        }),
        runStreamed: async () => ({
          events: (async function* () {
            yield {
              type: 'item.updated',
              item: {
                type: 'agent_message',
                text: 'Codex ',
              },
            };
            yield {
              type: 'item.completed',
              item: {
                id: 'codex-tool-1',
                type: 'command_execution',
                command: 'pnpm lint',
                aggregated_output: 'ok',
                exit_code: 0,
                status: 'completed',
              },
            };
            yield {
              type: 'turn.completed',
            };
          })(),
        }),
      };
    }
  },
});

assert.ok(codexBridge, 'Codex bridge should be created from the official SDK surface');
const codexResponse = await codexBridge!.sendMessage!(messages, {
  model: 'codex',
});
assert.equal(codexResponse.choices[0]?.message.content, 'Codex bridge response');
assert.equal(
  codexResponse.choices[0]?.message.tool_calls?.[0]?.function.name,
  'run_command',
  'Codex one-shot official SDK bridge must preserve buffered turn.items as assistant tool_calls instead of dropping command/file-change semantics',
);
assert.deepEqual(codexResponse.usage, {
  prompt_tokens: 4,
  completion_tokens: 4,
  total_tokens: 8,
});
const codexChunks = await collectStream(codexBridge!.sendMessageStream!(messages, {
  model: 'codex',
}));
assert.equal(codexChunks[0]?.choices[0]?.delta.content, 'Codex ');
assert.equal(
  codexChunks.find((chunk) => chunk.choices[0]?.delta.tool_calls?.length)?.choices[0]?.delta.tool_calls?.[0]?.function.name,
  'run_command',
);
assert.equal(codexChunks.at(-1)?.choices[0]?.finish_reason, 'stop');

const codexCumulativeAgentMessageBridge = createCodexOfficialSdkBridge({
  Codex: class {
    startThread() {
      return {
        run: async () => ({
          finalResponse: 'Codex cumulative response',
          usage: null,
        }),
        runStreamed: async () => ({
          events: (async function* () {
            yield {
              type: 'item.updated',
              item: {
                id: 'codex-cumulative-message',
                type: 'agent_message',
                text: 'Codex ',
              },
            };
            yield {
              type: 'item.completed',
              item: {
                id: 'codex-cumulative-message',
                type: 'agent_message',
                text: 'Codex cumulative response',
              },
            };
            yield {
              type: 'turn.completed',
            };
          })(),
        }),
      };
    }
  },
});
const codexCumulativeAgentMessageChunks = await collectStream(
  codexCumulativeAgentMessageBridge!.sendMessageStream!(messages, {
    model: 'codex',
  }),
);
assert.equal(
  codexCumulativeAgentMessageChunks
    .map((chunk) => chunk.choices[0]?.delta.content ?? '')
    .join(''),
  'Codex cumulative response',
  'Codex official SDK bridge should normalize cumulative agent_message item updates into text deltas so transcripts do not duplicate streamed content',
);

const codexStringMcpArgumentsBridge = createCodexOfficialSdkBridge({
  Codex: class {
    startThread() {
      return {
        run: async () => ({
          finalResponse: 'Codex MCP response',
          usage: null,
          items: [
            {
              id: 'codex-mcp-string-args',
              type: 'mcp_tool_call',
              tool: 'shell-command',
              arguments: '{"command":"pnpm test","requestId":101777208078558035}',
            },
          ],
        }),
        runStreamed: async () => ({
          events: (async function* () {
            yield {
              type: 'item.completed',
              item: {
                id: 'codex-mcp-string-args',
                type: 'mcp_tool_call',
                tool: 'shell-command',
                arguments: '{"command":"pnpm test","requestId":101777208078558035}',
              },
            };
            yield {
              type: 'turn.completed',
            };
          })(),
        }),
      };
    }
  },
});
const codexStringMcpResponse = await codexStringMcpArgumentsBridge!.sendMessage!(messages, {
  model: 'codex',
});
const codexStringMcpCall = codexStringMcpResponse.choices[0]?.message.tool_calls?.[0];
assert.equal(
  codexStringMcpCall?.function.name,
  'run_command',
  'Codex MCP tool aliases should be normalized before reaching the shared projection layer.',
);
assert.deepEqual(
  JSON.parse(codexStringMcpCall?.function.arguments ?? '{}'),
  {
    command: 'pnpm test',
    requestId: '101777208078558035',
  },
  'Codex MCP tool JSON-string arguments must be parsed through the shared BirdCoder JSON codec instead of being double-encoded.',
);
const codexStringMcpChunks = await collectStream(
  codexStringMcpArgumentsBridge!.sendMessageStream!(messages, {
    model: 'codex',
  }),
);
assert.deepEqual(
  JSON.parse(
    codexStringMcpChunks.find((chunk) => chunk.choices[0]?.delta.tool_calls?.length)
      ?.choices[0]?.delta.tool_calls?.[0]?.function.arguments ?? '{}',
  ),
  {
    command: 'pnpm test',
    requestId: '101777208078558035',
  },
  'Codex streamed MCP tool JSON-string arguments must stay structured and Long-safe.',
);

const codexObjectMcpArgumentsBridge = createCodexOfficialSdkBridge({
  Codex: class {
    startThread() {
      return {
        run: async () => ({
          finalResponse: 'Codex MCP object response',
          usage: null,
          items: [
            {
              id: 'codex-mcp-object-args',
              type: 'mcp_tool_call',
              tool: 'shell-command',
              arguments: {
                command: 'pnpm test',
                requestId: 101777208078558041n,
              },
            },
          ],
        }),
        runStreamed: async () => ({
          events: (async function* () {
            yield {
              type: 'item.completed',
              item: {
                id: 'codex-mcp-object-args',
                type: 'mcp_tool_call',
                tool: 'shell-command',
                arguments: {
                  command: 'pnpm test',
                  requestId: 101777208078558041n,
                },
              },
            };
            yield {
              type: 'turn.completed',
            };
          })(),
        }),
      };
    }
  },
});
const codexObjectMcpResponse = await codexObjectMcpArgumentsBridge!.sendMessage!(messages, {
  model: 'codex',
});
assert.deepEqual(
  JSON.parse(codexObjectMcpResponse.choices[0]?.message.tool_calls?.[0]?.function.arguments ?? '{}'),
  {
    command: 'pnpm test',
    requestId: '101777208078558041',
  },
  'Codex MCP object arguments must be serialized through the shared BirdCoder JSON codec so native Long ids are exact strings.',
);
const codexObjectMcpChunks = await collectStream(
  codexObjectMcpArgumentsBridge!.sendMessageStream!(messages, {
    model: 'codex',
  }),
);
assert.deepEqual(
  JSON.parse(
    codexObjectMcpChunks.find((chunk) => chunk.choices[0]?.delta.tool_calls?.length)
      ?.choices[0]?.delta.tool_calls?.[0]?.function.arguments ?? '{}',
  ),
  {
    command: 'pnpm test',
    requestId: '101777208078558041',
  },
  'Codex streamed MCP object arguments must be serialized through the shared BirdCoder JSON codec.',
);

let claudePromptModelOption: unknown = 'not-called';
let claudeQueryModelOption: unknown = 'not-called';
const claudeBridge = createClaudeOfficialSdkBridge({
  unstable_v2_prompt: async (_prompt, options) => {
    claudePromptModelOption = options?.model;
    return {
    result: 'Claude bridge response',
    };
  },
  query: async function* ({ options }) {
    claudeQueryModelOption = options?.model;
    yield {
      type: 'partial_assistant',
      event: {
        text: 'Claude ',
      },
    };
    yield {
      type: 'tool_progress',
      tool_use_id: 'claude-tool-1',
      tool_name: 'run_command',
      elapsed_time_seconds: 2,
      input: {
        command: 'pnpm test',
        requestId: 101777208078558039n,
      },
    };
    yield {
      type: 'result',
      result: 'done',
    };
  },
});

assert.ok(claudeBridge, 'Claude bridge should be created from the official SDK surface');
const claudeResponse = await claudeBridge!.sendMessage!(messages, {
  model: 'claude-code',
});
assert.equal(claudeResponse.choices[0]?.message.content, 'Claude bridge response');
assert.equal(
  claudePromptModelOption,
  undefined,
  'Claude SDK bridge should not forward the BirdCoder engine sentinel as an SDK model id',
);
const claudeChunks = await collectStream(claudeBridge!.sendMessageStream!(messages, {
  model: 'claude-code',
}));
assert.equal(claudeChunks[0]?.choices[0]?.delta.content, 'Claude ');
assert.equal(
  claudeQueryModelOption,
  undefined,
  'Claude SDK query bridge should not forward the BirdCoder engine sentinel as an SDK model id',
);
assert.equal(
  claudeChunks.find((chunk) => chunk.choices[0]?.delta.tool_calls?.length)?.choices[0]?.delta.tool_calls?.[0]?.function.name,
  'run_command',
);
assert.deepEqual(
  JSON.parse(
    claudeChunks.find((chunk) => chunk.choices[0]?.delta.tool_calls?.length)
      ?.choices[0]?.delta.tool_calls?.[0]?.function.arguments ?? '{}',
  ),
  {
    command: 'pnpm test',
    cmd: 'pnpm test',
    requestId: '101777208078558039',
    elapsedTimeSeconds: 2,
    status: 'running',
  },
  'Claude tool_progress events should project native input fields at the top level with status=running for shared command-card and runtime lifecycle handling',
);
assert.equal(claudeChunks.at(-1)?.choices[0]?.finish_reason, 'stop');

const claudeToolUseBlockBridge = createClaudeOfficialSdkBridge({
  query: async function* () {
    yield {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            id: 'claude-tool-use-block-1',
            name: 'Edit',
            input:
              '{"file_path":"src/App.tsx","requestId":101777208078558033,"new_string":"export const answer = 42;"}',
          },
        ],
      },
    };
    yield {
      type: 'result',
      result: 'done',
    };
  },
});
const claudeToolUseBlockChunks = await collectStream(
  claudeToolUseBlockBridge!.sendMessageStream!(messages, {
    model: 'claude-code',
  }),
);
const claudeToolUseBlockCall = claudeToolUseBlockChunks.find(
  (chunk) => chunk.choices[0]?.delta.tool_calls?.length,
)?.choices[0]?.delta.tool_calls?.[0];
assert.equal(
  claudeToolUseBlockCall?.function.name,
  'edit_file',
  'Claude bridge should project assistant tool_use content blocks into canonical tool_calls with standard tool names',
);
assert.deepEqual(
  JSON.parse(claudeToolUseBlockCall?.function.arguments ?? '{}'),
  {
    claudeToolName: 'Edit',
    file_path: 'src/App.tsx',
    path: 'src/App.tsx',
    requestId: '101777208078558033',
    new_string: 'export const answer = 42;',
  },
  'Claude bridge should preserve tool_use input and unquoted Long identifiers while adding canonical file path aliases for shared file-change projection',
);

const claudeToolUseBlockResponse = await claudeToolUseBlockBridge!.sendMessage!(messages, {
  model: 'claude-code',
});
assert.equal(
  claudeToolUseBlockResponse.choices[0]?.message.tool_calls?.[0]?.function.name,
  'edit_file',
  'Claude one-shot query bridge should preserve assistant tool_use content blocks on the assistant message',
);

let claudeExplicitModelOption: unknown = null;
const claudeExplicitModelBridge = createClaudeOfficialSdkBridge({
  unstable_v2_prompt: async (_prompt, options) => {
    claudeExplicitModelOption = options?.model;
    return {
      result: 'Claude explicit model response',
    };
  },
});
assert.ok(
  claudeExplicitModelBridge,
  'Claude bridge should support explicit provider model ids',
);
await claudeExplicitModelBridge!.sendMessage!(messages, {
  model: 'claude-sonnet-4-6',
});
assert.equal(
  claudeExplicitModelOption,
  'claude-sonnet-4-6',
  'Claude SDK bridge should preserve explicit provider model ids',
);

const claudePromptOnlyStreamBridge = createClaudeOfficialSdkBridge({
  unstable_v2_prompt: async () => ({
    result: 'Claude prompt-only streamed fallback',
    message: {
      content: [
        {
          type: 'tool_use',
          id: 'claude-prompt-only-tool',
          name: 'Read',
          input: {
            file_path: 'src/App.tsx',
          },
        },
      ],
    },
  }),
});
const claudePromptOnlyStreamChunks = await collectStream(
  claudePromptOnlyStreamBridge!.sendMessageStream!(messages, {
    model: 'claude-code',
  }),
);
assert.equal(
  claudePromptOnlyStreamChunks.map((chunk) => chunk.choices[0]?.delta.content ?? '').join(''),
  'Claude prompt-only streamed fallback',
  'Claude stream bridge must fall back to one-shot prompt results when the official SDK surface does not expose query streaming',
);
assert.equal(
  claudePromptOnlyStreamChunks.find((chunk) => chunk.choices[0]?.delta.tool_calls?.length)
    ?.choices[0]?.delta.tool_calls?.[0]?.function.name,
  'read_file',
  'Claude prompt-only stream fallback must preserve promptOnce tool_use blocks as canonical tool_calls',
);

const claudeQueryOnlyBridge = createClaudeOfficialSdkBridge({
  query: async function* () {
    yield {
      type: 'partial_assistant',
      event: {
        text: 'Claude ',
      },
    };
    yield {
      type: 'partial_assistant',
      event: {
        text: 'query ',
      },
    };
    yield {
      type: 'result',
      result: 'response',
    };
  },
});

assert.ok(claudeQueryOnlyBridge, 'Claude bridge should support query-only official SDK surfaces');
const claudeQueryOnlyResponse = await claudeQueryOnlyBridge!.sendMessage!(messages, {
  model: 'claude-code',
});
assert.equal(
  claudeQueryOnlyResponse.choices[0]?.message.content,
  'Claude query response',
  'Claude query-only bridge should aggregate streamed partials and the final result into one-shot output',
);

const claudeQueryStreamDedupBridge = createClaudeOfficialSdkBridge({
  query: async function* () {
    yield {
      type: 'partial_assistant',
      event: {
        text: 'Claude ',
      },
    };
    yield {
      type: 'partial_assistant',
      event: {
        text: 'bridge ',
      },
    };
    yield {
      type: 'result',
      result: 'Claude bridge response',
    };
  },
});

assert.ok(
  claudeQueryStreamDedupBridge,
  'Claude bridge should support query streams whose final result repeats the full assistant text',
);
const claudeQueryStreamDedupChunks = await collectStream(
  claudeQueryStreamDedupBridge!.sendMessageStream!(messages, {
    model: 'claude-code',
  }),
);
assert.equal(
  claudeQueryStreamDedupChunks.map((chunk) => chunk.choices[0]?.delta.content ?? '').join(''),
  'Claude bridge response',
  'Claude stream bridge should not duplicate already-streamed partial text when the result event carries the full final response',
);
assert.equal(
  claudeQueryStreamDedupChunks.at(-1)?.choices[0]?.finish_reason,
  'stop',
  'Claude deduplicated result stream should still terminate cleanly',
);

const claudeAssistantFullMessageDedupBridge = createClaudeOfficialSdkBridge({
  query: async function* () {
    yield {
      type: 'partial_assistant',
      event: {
        text: 'Claude ',
      },
    };
    yield {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'text',
            text: 'Claude bridge response',
          },
        ],
      },
    };
    yield {
      type: 'result',
      result: 'Claude bridge response',
    };
  },
});
const claudeAssistantFullMessageResponse = await claudeAssistantFullMessageDedupBridge!.sendMessage!(
  messages,
  {
    model: 'claude-code',
  },
);
assert.equal(
  claudeAssistantFullMessageResponse.choices[0]?.message.content,
  'Claude bridge response',
  'Claude one-shot bridge should not duplicate partial_assistant text when assistant carries the full message',
);
const claudeAssistantFullMessageChunks = await collectStream(
  claudeAssistantFullMessageDedupBridge!.sendMessageStream!(messages, {
    model: 'claude-code',
  }),
);
assert.equal(
  claudeAssistantFullMessageChunks
    .map((chunk) => chunk.choices[0]?.delta.content ?? '')
    .join(''),
  'Claude bridge response',
  'Claude stream bridge should normalize full assistant events after partial_assistant into deltas',
);

const geminiAgentOptions: Record<string, unknown>[] = [];
const geminiBridge = createGeminiOfficialSdkBridge({
  GeminiCliAgent: class {
    constructor(options: Record<string, unknown>) {
      geminiAgentOptions.push(options);
    }

    session() {
      return {
        sendStream: async function* () {
          yield {
            type: 'content',
            value: {
              text: 'Gemini ',
            },
          };
          yield {
            type: 'tool_call_request',
            value: {
              callId: 'gemini-tool-1',
              name: 'search_code',
              args: {
                query: 'TODO',
              },
            },
          };
          yield {
            type: 'content',
            value: {
              text: 'bridge response',
            },
          };
        },
      };
    }
  },
});

assert.ok(geminiBridge, 'Gemini bridge should be created from the official SDK surface');
const geminiResponse = await geminiBridge!.sendMessage!(messages, {
  model: 'gemini',
});
assert.equal(geminiResponse.choices[0]?.message.content, 'Gemini bridge response');
assert.equal(
  geminiResponse.choices[0]?.message.tool_calls?.[0]?.function.name,
  'search_code',
  'Gemini one-shot bridge should preserve tool_call_request events on the assistant message instead of dropping non-text semantics',
);
assert.equal(
  geminiAgentOptions[0]?.model,
  undefined,
  'Gemini SDK bridge should not forward the BirdCoder engine sentinel as an SDK model id',
);
const geminiChunks = await collectStream(geminiBridge!.sendMessageStream!(messages, {
  model: 'gemini',
}));
assert.equal(
  geminiChunks.map((chunk) => chunk.choices[0]?.delta.content ?? '').join(''),
  'Gemini bridge response',
);
assert.equal(
  geminiAgentOptions[1]?.model,
  undefined,
  'Gemini SDK stream bridge should not forward the BirdCoder engine sentinel as an SDK model id',
);
assert.equal(
  geminiChunks.find((chunk) => chunk.choices[0]?.delta.tool_calls?.length)?.choices[0]?.delta.tool_calls?.[0]?.function.name,
  'search_code',
);
assert.equal(geminiChunks.at(-1)?.choices[0]?.finish_reason, 'stop');

const geminiStringArgsBridge = createGeminiOfficialSdkBridge({
  GeminiCliAgent: class {
    session() {
      return {
        sendStream: async function* () {
          yield {
            type: 'tool_call_request',
            value: {
              callId: 'gemini-tool-string-args',
              name: 'read_file',
              args: '{"path":"src/App.tsx","requestId":101777208078558031}',
            },
          };
        },
      };
    }
  },
});
const geminiStringArgsChunks = await collectStream(
  geminiStringArgsBridge!.sendMessageStream!(messages, {
    model: 'gemini',
  }),
);
assert.deepEqual(
  JSON.parse(
    geminiStringArgsChunks.find((chunk) => chunk.choices[0]?.delta.tool_calls?.length)
      ?.choices[0]?.delta.tool_calls?.[0]?.function.arguments ?? '{}',
  ),
  {
    path: 'src/App.tsx',
    requestId: '101777208078558031',
  },
  'Gemini bridge should parse JSON-string tool args without rounding unquoted Long identifiers before emitting canonical tool_call arguments',
);

const geminiLongObjectArgsBridge = createGeminiOfficialSdkBridge({
  GeminiCliAgent: class {
    session() {
      return {
        sendStream: async function* () {
          yield {
            type: 'tool_call_request',
            value: {
              callId: 'gemini-tool-long-object-args',
              name: 'read_file',
              args: {
                path: 'src/App.tsx',
                requestId: 101777208078558043n,
              },
            },
          };
        },
      };
    }
  },
});
const geminiLongObjectArgsChunks = await collectStream(
  geminiLongObjectArgsBridge!.sendMessageStream!(messages, {
    model: 'gemini',
  }),
);
assert.deepEqual(
  JSON.parse(
    geminiLongObjectArgsChunks.find((chunk) => chunk.choices[0]?.delta.tool_calls?.length)
      ?.choices[0]?.delta.tool_calls?.[0]?.function.arguments ?? '{}',
  ),
  {
    path: 'src/App.tsx',
    requestId: '101777208078558043',
  },
  'Gemini object tool args must be serialized through the shared BirdCoder JSON codec so native Long ids are exact strings.',
);

const geminiQuestionBridge = createGeminiOfficialSdkBridge({
  GeminiCliAgent: class {
    session() {
      return {
        sendStream: async function* () {
          yield {
            type: 'tool_call_request',
            value: {
              callId: 'gemini-question-1',
              name: 'question',
              args: {
                question: 'Which tests should I run?',
                options: [
                  {
                    label: 'Unit',
                    description: 'Run unit tests only',
                  },
                ],
              },
            },
          };
        },
      };
    }
  },
});
const geminiQuestionChunks = await collectStream(
  geminiQuestionBridge!.sendMessageStream!(messages, {
    model: 'gemini',
  }),
);
const geminiQuestionCall = geminiQuestionChunks.find(
  (chunk) => chunk.choices[0]?.delta.tool_calls?.length,
)?.choices[0]?.delta.tool_calls?.[0];
assert.equal(
  geminiQuestionCall?.function.name,
  'user_question',
  'Gemini question tool requests must be normalized to canonical user_question tool calls',
);
assert.deepEqual(
  JSON.parse(geminiQuestionCall?.function.arguments ?? '{}'),
  {
    question: 'Which tests should I run?',
    options: [
      {
        label: 'Unit',
        description: 'Run unit tests only',
      },
    ],
    status: 'awaiting_user',
  },
  'Gemini user_question calls should carry an awaiting_user status for shared reply UI semantics',
);

const geminiApprovalAliasBridge = createGeminiOfficialSdkBridge({
  GeminiCliAgent: class {
    session() {
      return {
        sendStream: async function* () {
          yield {
            type: 'tool_call_request',
            value: {
              callId: 'gemini-approval-alias-1',
              name: 'approval_request',
              args: {
                tool: 'edit_file',
                permission: 'write',
                patterns: ['src/**'],
              },
            },
          };
        },
      };
    }
  },
});
const geminiApprovalAliasChunks = await collectStream(
  geminiApprovalAliasBridge!.sendMessageStream!(messages, {
    model: 'gemini',
  }),
);
const geminiApprovalAliasCall = geminiApprovalAliasChunks.find(
  (chunk) => chunk.choices[0]?.delta.tool_calls?.length,
)?.choices[0]?.delta.tool_calls?.[0];
assert.equal(
  geminiApprovalAliasCall?.function.name,
  'permission_request',
  'Gemini approval_request tool aliases must be normalized to canonical permission_request tool calls',
);
assert.deepEqual(
  JSON.parse(geminiApprovalAliasCall?.function.arguments ?? '{}'),
  {
    tool: 'edit_file',
    permission: 'write',
    patterns: ['src/**'],
    status: 'awaiting_approval',
  },
  'Gemini permission_request aliases should carry an awaiting_approval status for shared approval UI semantics',
);

const geminiToolResponseBridge = createGeminiOfficialSdkBridge({
  GeminiCliAgent: class {
    session() {
      return {
        sendStream: async function* () {
          yield {
            type: 'tool_call_request',
            value: {
              callId: 'gemini-tool-response-1',
              name: 'run_command',
              args: {
                command: 'pnpm test',
              },
            },
          };
          yield {
            type: 'tool_call_response',
            value: {
              callId: 'gemini-tool-response-1',
              responseParts: [
                {
                  text: 'tests passed',
                },
              ],
              resultDisplay: 'tests passed',
              error: undefined,
              errorType: undefined,
            },
          };
        },
      };
    }
  },
});
const geminiToolResponseChunks = await collectStream(
  geminiToolResponseBridge!.sendMessageStream!(messages, {
    model: 'gemini',
  }),
);
const geminiToolResponseCall = geminiToolResponseChunks
  .filter((chunk) => chunk.choices[0]?.delta.tool_calls?.length)
  .at(-1)?.choices[0]?.delta.tool_calls?.[0];
assert.equal(
  geminiToolResponseCall?.id,
  'gemini-tool-response-1',
  'Gemini bridge should preserve tool_call_response call ids so projection can update the matching command card',
);
assert.equal(
  geminiToolResponseCall?.function.name,
  'run_command',
  'Gemini bridge should reuse the original tool name when projecting tool_call_response events',
);
assert.deepEqual(
  JSON.parse(geminiToolResponseCall?.function.arguments ?? '{}'),
  {
    command: 'pnpm test',
    status: 'success',
    output: 'tests passed',
    responseParts: [
      {
        text: 'tests passed',
      },
    ],
    resultDisplay: 'tests passed',
  },
  'Gemini bridge should project tool_call_response events into canonical tool-call snapshots with status and output for command cards',
);

const geminiToolConfirmationBridge = createGeminiOfficialSdkBridge({
  GeminiCliAgent: class {
    session() {
      return {
        sendStream: async function* () {
          yield {
            type: 'tool_call_confirmation',
            value: {
              request: {
                callId: 'gemini-confirm-1',
                name: 'run_command',
                args: {
                  command: 'pnpm build',
                },
              },
              details: {
                type: 'exec',
                title: 'Run build',
                command: 'pnpm build',
                rootCommand: 'pnpm',
              },
            },
          };
        },
      };
    }
  },
});
const geminiToolConfirmationChunks = await collectStream(
  geminiToolConfirmationBridge!.sendMessageStream!(messages, {
    model: 'gemini',
  }),
);
const geminiToolConfirmationCall = geminiToolConfirmationChunks.find(
  (chunk) => chunk.choices[0]?.delta.tool_calls?.length,
)?.choices[0]?.delta.tool_calls?.[0];
assert.equal(
  geminiToolConfirmationCall?.function.name,
  'permission_request',
  'Gemini bridge should project tool_call_confirmation events into canonical permission_request tool calls',
);
assert.deepEqual(
  JSON.parse(geminiToolConfirmationCall?.function.arguments ?? '{}'),
  {
    status: 'awaiting_approval',
    request: {
      callId: 'gemini-confirm-1',
      name: 'run_command',
      args: {
        command: 'pnpm build',
      },
    },
    details: {
      type: 'exec',
      title: 'Run build',
      command: 'pnpm build',
      rootCommand: 'pnpm',
    },
  },
  'Gemini permission_request tool calls should preserve confirmation request and details for approval UI',
);

const geminiShellAliasBridge = createGeminiOfficialSdkBridge({
  GeminiCliAgent: class {
    session() {
      return {
        sendStream: async function* () {
          yield {
            type: 'tool_call_request',
            value: {
              callId: 'gemini-shell-alias-1',
              name: 'shell-command',
              args: {
                command: 'pnpm lint',
              },
            },
          };
        },
      };
    }
  },
});
const geminiShellAliasChunks = await collectStream(
  geminiShellAliasBridge!.sendMessageStream!(messages, {
    model: 'gemini',
  }),
);
assert.equal(
  geminiShellAliasChunks.find((chunk) => chunk.choices[0]?.delta.tool_calls?.length)
    ?.choices[0]?.delta.tool_calls?.[0]?.function.name,
  'run_command',
  'Gemini command aliases must be normalized to the shared run_command tool name before they reach projection/UI layers',
);

const geminiErrorBridge = createGeminiOfficialSdkBridge({
  GeminiCliAgent: class {
    session() {
      return {
        sendStream: async function* () {
          yield {
            type: 'error',
            value: {
              message: 'Gemini SDK failed',
            },
          };
        },
      };
    }
  },
});
await assert.rejects(
  () => geminiErrorBridge!.sendMessage!(messages, {
    model: 'gemini',
  }),
  /Gemini SDK failed/u,
  'Gemini one-shot bridge should propagate SDK error events instead of returning an empty successful assistant response',
);
await assert.rejects(
  () => collectStream(geminiErrorBridge!.sendMessageStream!(messages, {
    model: 'gemini',
  })),
  /Gemini SDK failed/u,
  'Gemini stream bridge should propagate SDK error events instead of ending the turn as stop',
);

const geminiMaxSessionTurnsBridge = createGeminiOfficialSdkBridge({
  GeminiCliAgent: class {
    session() {
      return {
        sendStream: async function* () {
          yield {
            type: 'max_session_turns',
          };
        },
      };
    }
  },
});
await assert.rejects(
  () => geminiMaxSessionTurnsBridge!.sendMessage!(messages, {
    model: 'gemini',
  }),
  /maximum session turn limit/u,
  'Gemini one-shot bridge should propagate max_session_turns as a clear terminal error instead of an empty successful response',
);
await assert.rejects(
  () => collectStream(geminiMaxSessionTurnsBridge!.sendMessageStream!(messages, {
    model: 'gemini',
  })),
  /maximum session turn limit/u,
  'Gemini stream bridge should propagate max_session_turns as a clear terminal error instead of ending as stop',
);

const geminiBlockedBridge = createGeminiOfficialSdkBridge({
  GeminiCliAgent: class {
    session() {
      return {
        sendStream: async function* () {
          yield {
            type: 'agent_execution_blocked',
            value: {
              reason: 'policy',
              systemMessage: 'Shell execution is blocked',
            },
          };
        },
      };
    }
  },
});
await assert.rejects(
  () => geminiBlockedBridge!.sendMessage!(messages, {
    model: 'gemini',
  }),
  /Shell execution is blocked/u,
  'Gemini one-shot bridge should propagate agent_execution_blocked with its SDK diagnostic message',
);
await assert.rejects(
  () => collectStream(geminiBlockedBridge!.sendMessageStream!(messages, {
    model: 'gemini',
  })),
  /Shell execution is blocked/u,
  'Gemini stream bridge should propagate agent_execution_blocked with its SDK diagnostic message',
);

let geminiExplicitModelOption: unknown = null;
const geminiExplicitModelBridge = createGeminiOfficialSdkBridge({
  GeminiCliAgent: class {
    constructor(options: Record<string, unknown>) {
      geminiExplicitModelOption = options.model;
    }

    session() {
      return {
        sendStream: async function* () {
          yield {
            type: 'content',
            value: {
              text: 'Gemini explicit model response',
            },
          };
        },
      };
    }
  },
});

assert.ok(
  geminiExplicitModelBridge,
  'Gemini bridge should support explicit provider model ids',
);
await geminiExplicitModelBridge!.sendMessage!(messages, {
  model: 'gemini-1.5-pro',
});
assert.equal(
  geminiExplicitModelOption,
  'gemini-1.5-pro',
  'Gemini SDK bridge should preserve explicit provider model ids',
);

const openCodeLongPermissionBridge = createOpenCodeOfficialSdkBridge({
  createOpencodeClient: () => ({
    session: {
      create: async () => ({
        id: 'opencode-session-long-args',
      }),
      prompt: async () => ({}),
      promptAsync: async () => ({}),
    },
    event: {
      subscribe: async () => ({
        stream: (async function* () {
          yield {
            type: 'permission.asked',
            properties: {
              sessionID: 'opencode-session-long-args',
              requestID: 101777208078558045n,
              permission: 'write',
              metadata: {
                workspaceId: 101777208078558047n,
              },
              tool: {
                id: 101777208078558049n,
              },
            },
          };
          yield {
            type: 'session.idle',
            properties: {
              sessionID: 'opencode-session-long-args',
            },
          };
        })(),
      }),
    },
  }),
});
const openCodeLongPermissionChunks = await collectStream(
  openCodeLongPermissionBridge!.sendMessageStream!(messages, {
    model: 'opencode',
  }),
);
const openCodeLongPermissionCall = openCodeLongPermissionChunks.find(
  (chunk) => chunk.choices[0]?.delta.tool_calls?.length,
)?.choices[0]?.delta.tool_calls?.[0];
assert.equal(
  openCodeLongPermissionCall?.id,
  '101777208078558045',
  'OpenCode permission request ids must stay exact when the provider SDK exposes them as native Long values.',
);
assert.deepEqual(
  JSON.parse(openCodeLongPermissionCall?.function.arguments ?? '{}'),
  {
    status: 'awaiting_approval',
    permission: 'write',
    metadata: {
      workspaceId: '101777208078558047',
    },
    tool: {
      id: '101777208078558049',
    },
  },
  'OpenCode permission payloads must be serialized through the shared BirdCoder JSON codec so nested Long ids are exact strings.',
);

console.log('provider official sdk bridge contract passed.');
