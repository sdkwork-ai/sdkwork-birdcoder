import assert from 'node:assert/strict';

import {
  createOpenCodeOfficialSdkBridge,
} from '../packages/sdkwork-birdcoder-chat-opencode/src/index.ts';

import type {
  ChatMessage,
  ChatStreamChunk,
} from '../packages/sdkwork-birdcoder-chat/src/index.ts';

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

const messages: ChatMessage[] = [
  {
    id: 'user-1',
    role: 'user',
    content: 'Create an artifact stream.',
    timestamp: Date.now(),
  },
];

const promptCalls: Record<string, unknown>[] = [];
const promptAsyncCalls: Record<string, unknown>[] = [];

const bridge = createOpenCodeOfficialSdkBridge({
  createOpencodeClient: () => ({
    session: {
      create: async () => ({
        id: 'session-1',
      }),
      prompt: async (options) => {
        promptCalls.push(options);
        return {
          parts: [
            {
              type: 'text',
              text: 'OpenCode response',
            },
          ],
        };
      },
      promptAsync: async (options) => {
        promptAsyncCalls.push(options);
        return undefined;
      },
    },
    event: {
      subscribe: async () => ({
        stream: (async function* () {
          yield {
            type: 'message.part.updated',
            properties: {
              part: {
                id: 'part-text-1',
                sessionID: 'session-1',
                messageID: 'message-1',
                type: 'text',
                text: 'OpenCode final text',
              },
              delta: 'OpenCode ',
            },
          };

          yield {
            type: 'message.part.updated',
            properties: {
              part: {
                id: 'part-tool-1',
                sessionID: 'session-1',
                messageID: 'message-1',
                type: 'tool',
                callID: 'tool-1',
                tool: 'write_file',
                state: {
                  status: 'running',
                  input: {
                    path: 'src/App.tsx',
                  },
                  time: {
                    start: Date.now(),
                  },
                },
              },
            },
          };

          yield {
            type: 'session.idle',
            properties: {
              sessionID: 'session-1',
            },
          };
        })(),
      }),
    },
  }),
});

assert.ok(bridge, 'OpenCode bridge should be created from the official SDK surface');

const streamChunks = await collectStream(
  bridge!.sendMessageStream!(
    messages,
    {
      model: 'opencode',
      context: {
        workspaceRoot: 'D:/workspace/demo',
      },
    },
  ),
);

assert.equal(
  streamChunks.map((chunk) => chunk.choices[0]?.delta.content ?? '').join(''),
  'OpenCode ',
  'OpenCode official SDK bridge should forward text deltas from SSE events',
);

const toolChunk = streamChunks.find(
  (chunk) => (chunk.choices[0]?.delta.tool_calls?.length ?? 0) > 0,
);

assert.ok(toolChunk, 'OpenCode official SDK bridge should project tool parts into canonical tool call chunks');
assert.equal(
  toolChunk?.choices[0]?.delta.tool_calls?.[0]?.function.name,
  'write_file',
);
const toolArguments = JSON.parse(
  toolChunk?.choices[0]?.delta.tool_calls?.[0]?.function.arguments ?? '{}',
) as Record<string, unknown>;
assert.equal(
  toolArguments.path,
  'src/App.tsx',
  'OpenCode bridge should lift tool state.input fields into canonical tool arguments so file-change projection does not need OpenCode-specific parsing',
);
const openCodeState = toolArguments.openCodeState as Record<string, unknown> | undefined;
assert.equal(
  openCodeState?.status,
  'running',
  'OpenCode bridge should preserve the raw tool state under an engine-scoped field for debugging and future adapter migrations',
);
assert.deepEqual(openCodeState?.input, {
  path: 'src/App.tsx',
});
assert.equal(
  streamChunks.at(-1)?.choices[0]?.finish_reason,
  'stop',
  'OpenCode official SDK bridge should stop when the session becomes idle',
);

const stringInputToolPartBridge = createOpenCodeOfficialSdkBridge({
  createOpencodeClient: () => ({
    session: {
      create: async () => ({
        id: 'session-string-input-1',
      }),
      prompt: async () => ({
        parts: [],
      }),
      promptAsync: async () => undefined,
    },
    event: {
      subscribe: async () => ({
        stream: (async function* () {
          yield {
            type: 'message.part.updated',
            properties: {
              part: {
                id: 'part-string-input-tool-1',
                sessionID: 'session-string-input-1',
                messageID: 'message-string-input-1',
                type: 'tool',
                callID: 'tool-string-input-1',
                tool: 'write_file',
                state: {
                  status: 'running',
                  input: '{"path":"src/LongId.tsx","requestId":101777208078558036}',
                },
              },
            },
          };
          yield {
            type: 'session.idle',
            properties: {
              sessionID: 'session-string-input-1',
            },
          };
        })(),
      }),
    },
  }),
});

const stringInputToolPartChunks = await collectStream(
  stringInputToolPartBridge!.sendMessageStream!(messages, {
    model: 'opencode',
  }),
);
const stringInputToolArguments = JSON.parse(
  stringInputToolPartChunks.find((chunk) => (chunk.choices[0]?.delta.tool_calls?.length ?? 0) > 0)
    ?.choices[0]?.delta.tool_calls?.[0]?.function.arguments ?? '{}',
) as Record<string, unknown>;
assert.equal(
  stringInputToolArguments.path,
  'src/LongId.tsx',
  'OpenCode bridge must parse JSON string state.input into canonical tool arguments.',
);
assert.equal(
  stringInputToolArguments.requestId,
  '101777208078558036',
  'OpenCode bridge must preserve unsafe Java Long IDs when parsing JSON string state.input.',
);

const sentinelPromptBody = promptAsyncCalls[0]?.body as Record<string, unknown> | undefined;
assert.ok(sentinelPromptBody, 'OpenCode stream bridge should send a prompt body');
assert.equal(
  'model' in sentinelPromptBody,
  false,
  'OpenCode SDK bridge should not forward the BirdCoder engine sentinel as a prompt model',
);

await bridge!.sendMessage!(messages, {
  model: 'openai/gpt-5.4',
  context: {
    workspaceRoot: 'D:/workspace/demo',
  },
});

const explicitPromptBody = promptCalls.at(-1)?.body as Record<string, unknown> | undefined;
assert.ok(explicitPromptBody, 'OpenCode one-shot bridge should send a prompt body');
assert.deepEqual(
  explicitPromptBody.model,
  {
    providerID: 'openai',
    modelID: 'gpt-5.4',
  },
  'OpenCode SDK bridge should preserve explicit provider-scoped model ids',
);

const promptToolPartsBridge = createOpenCodeOfficialSdkBridge({
  createOpencodeClient: () => ({
    session: {
      create: async () => ({
        id: 'session-prompt-parts-1',
      }),
      prompt: async () => ({
        info: {
          id: 'message-prompt-parts-1',
        },
        parts: [
          {
            id: 'part-prompt-text-1',
            sessionID: 'session-prompt-parts-1',
            messageID: 'message-prompt-parts-1',
            type: 'text',
            text: 'OpenCode prompt response',
          },
          {
            id: 'part-prompt-tool-1',
            sessionID: 'session-prompt-parts-1',
            messageID: 'message-prompt-parts-1',
            type: 'tool',
            callID: 'tool-prompt-1',
            tool: 'write_file',
            state: {
              status: 'completed',
              input: {
                path: 'src/App.tsx',
              },
              output: 'updated',
              title: 'Update App',
              metadata: {
                source: 'prompt-response',
              },
              time: {
                start: Date.now(),
                end: Date.now(),
              },
            },
          },
        ],
      }),
    },
  }),
});

const promptToolPartsResponse = await promptToolPartsBridge!.sendMessage!(messages, {
  model: 'opencode',
});
assert.equal(
  promptToolPartsResponse.choices[0]?.message.content,
  'OpenCode prompt response',
  'OpenCode one-shot prompt responses must still extract assistant text from returned parts',
);
assert.equal(
  promptToolPartsResponse.choices[0]?.message.tool_calls?.[0]?.function.name,
  'write_file',
  'OpenCode one-shot prompt responses must preserve returned tool parts as canonical assistant tool_calls',
);
const promptToolArguments = JSON.parse(
  promptToolPartsResponse.choices[0]?.message.tool_calls?.[0]?.function.arguments ?? '{}',
) as Record<string, unknown>;
assert.equal(
  promptToolArguments.path,
  'src/App.tsx',
  'OpenCode one-shot tool parts must lift state.input fields into the shared command-card argument shape',
);
assert.equal(promptToolArguments.status, 'completed');
assert.equal(promptToolArguments.output, 'updated');
assert.equal(promptToolArguments.title, 'Update App');
assert.deepEqual(
  (promptToolArguments.openCodeState as Record<string, unknown> | undefined)?.metadata,
  {
    source: 'prompt-response',
  },
  'OpenCode one-shot tool parts must preserve the raw state metadata under openCodeState',
);

const promptToolPartsChunks = await collectStream(
  promptToolPartsBridge!.sendMessageStream!(messages, {
    model: 'opencode',
  }),
);
assert.equal(
  promptToolPartsChunks.map((chunk) => chunk.choices[0]?.delta.content ?? '').join(''),
  'OpenCode prompt response',
  'OpenCode fallback streaming over session.prompt must preserve returned text parts',
);
assert.equal(
  promptToolPartsChunks.find((chunk) => (chunk.choices[0]?.delta.tool_calls?.length ?? 0) > 0)
    ?.choices[0]?.delta.tool_calls?.[0]?.function.name,
  'write_file',
  'OpenCode fallback streaming over session.prompt must preserve returned tool parts as tool_call chunks',
);

const deltaEventBridge = createOpenCodeOfficialSdkBridge({
  createOpencodeClient: () => ({
    session: {
      create: async () => ({
        id: 'session-delta-1',
      }),
      prompt: async () => ({
        parts: [],
      }),
      promptAsync: async () => undefined,
    },
    event: {
      subscribe: async () => ({
        stream: (async function* () {
          yield {
            type: 'message.part.delta',
            properties: {
              sessionID: 'session-delta-1',
              messageID: 'message-delta-1',
              partID: 'part-delta-1',
              field: 'text',
              delta: 'OpenCode delta text',
            },
          };
          yield {
            type: 'session.idle',
            properties: {
              sessionID: 'session-delta-1',
            },
          };
        })(),
      }),
    },
  }),
});
const deltaEventChunks = await collectStream(
  deltaEventBridge!.sendMessageStream!(messages, {
    model: 'opencode',
    context: {
      workspaceRoot: 'D:/workspace/demo',
    },
  }),
);
assert.equal(
  deltaEventChunks.map((chunk) => chunk.choices[0]?.delta.content ?? '').join(''),
  'OpenCode delta text',
  'OpenCode official SDK bridge should forward v2 message.part.delta text events so streaming transcripts are not blank',
);

const cumulativeTextUpdateBridge = createOpenCodeOfficialSdkBridge({
  createOpencodeClient: () => ({
    session: {
      create: async () => ({
        id: 'session-cumulative-text-1',
      }),
      prompt: async () => ({
        parts: [],
      }),
      promptAsync: async () => undefined,
    },
    event: {
      subscribe: async () => ({
        stream: (async function* () {
          yield {
            type: 'message.part.updated',
            properties: {
              part: {
                id: 'part-cumulative-text-1',
                sessionID: 'session-cumulative-text-1',
                messageID: 'message-cumulative-text-1',
                type: 'text',
                text: 'OpenCode ',
              },
            },
          };
          yield {
            type: 'message.part.updated',
            properties: {
              part: {
                id: 'part-cumulative-text-1',
                sessionID: 'session-cumulative-text-1',
                messageID: 'message-cumulative-text-1',
                type: 'text',
                text: 'OpenCode response',
              },
            },
          };
          yield {
            type: 'session.idle',
            properties: {
              sessionID: 'session-cumulative-text-1',
            },
          };
        })(),
      }),
    },
  }),
});
const cumulativeTextUpdateChunks = await collectStream(
  cumulativeTextUpdateBridge!.sendMessageStream!(messages, {
    model: 'opencode',
    context: {
      workspaceRoot: 'D:/workspace/demo',
    },
  }),
);
assert.equal(
  cumulativeTextUpdateChunks.map((chunk) => chunk.choices[0]?.delta.content ?? '').join(''),
  'OpenCode response',
  'OpenCode official SDK bridge should normalize cumulative message.part.updated text snapshots into display deltas',
);

const permissionAskedBridge = createOpenCodeOfficialSdkBridge({
  createOpencodeClient: () => ({
    session: {
      create: async () => ({
        id: 'session-permission-1',
      }),
      prompt: async () => ({
        parts: [],
      }),
      promptAsync: async () => undefined,
    },
    event: {
      subscribe: async () => ({
        stream: (async function* () {
          yield {
            type: 'permission.asked',
            properties: {
              id: 'permission-1',
              sessionID: 'session-permission-1',
              permission: 'bash',
              patterns: ['pnpm test'],
              metadata: {
                command: 'pnpm test',
              },
              always: [],
              tool: {
                messageID: 'message-permission-1',
                callID: 'tool-permission-1',
              },
            },
          };
          yield {
            type: 'session.idle',
            properties: {
              sessionID: 'session-permission-1',
            },
          };
        })(),
      }),
    },
  }),
});
const permissionAskedChunks = await collectStream(
  permissionAskedBridge!.sendMessageStream!(messages, {
    model: 'opencode',
    context: {
      workspaceRoot: 'D:/workspace/demo',
    },
  }),
);
const permissionAskedToolCall = permissionAskedChunks.find(
  (chunk) => (chunk.choices[0]?.delta.tool_calls?.length ?? 0) > 0,
)?.choices[0]?.delta.tool_calls?.[0];
assert.equal(
  permissionAskedToolCall?.function.name,
  'permission_request',
  'OpenCode official SDK bridge should project v2 permission.asked events into canonical permission_request tool calls',
);
assert.deepEqual(
  JSON.parse(permissionAskedToolCall?.function.arguments ?? '{}'),
  {
    status: 'awaiting_approval',
    permission: 'bash',
    patterns: ['pnpm test'],
    metadata: {
      command: 'pnpm test',
    },
    always: [],
    tool: {
      messageID: 'message-permission-1',
      callID: 'tool-permission-1',
    },
  },
  'OpenCode permission_request tool calls should preserve v2 permission metadata for approval UI and debugging',
);

const permissionUpdatedBridge = createOpenCodeOfficialSdkBridge({
  createOpencodeClient: () => ({
    session: {
      create: async () => ({
        id: 'session-permission-updated-1',
      }),
      prompt: async () => ({
        parts: [],
      }),
      promptAsync: async () => undefined,
    },
    event: {
      subscribe: async () => ({
        stream: (async function* () {
          yield {
            type: 'permission.updated',
            properties: {
              id: 'permission-1',
              sessionID: 'session-permission-updated-1',
              status: 'accepted',
              type: 'permission',
              title: 'Run tests',
              pattern: 'pnpm test',
              metadata: {
                command: 'pnpm test',
              },
            },
          };
          yield {
            type: 'session.idle',
            properties: {
              sessionID: 'session-permission-updated-1',
            },
          };
        })(),
      }),
    },
  }),
});
const permissionUpdatedChunks = await collectStream(
  permissionUpdatedBridge!.sendMessageStream!(messages, {
    model: 'opencode',
    context: {
      workspaceRoot: 'D:/workspace/demo',
    },
  }),
);
const permissionUpdatedToolCall = permissionUpdatedChunks.find(
  (chunk) => (chunk.choices[0]?.delta.tool_calls?.length ?? 0) > 0,
)?.choices[0]?.delta.tool_calls?.[0];
assert.deepEqual(
  JSON.parse(permissionUpdatedToolCall?.function.arguments ?? '{}'),
  {
    status: 'accepted',
    runtimeStatus: 'awaiting_tool',
    type: 'permission',
    title: 'Run tests',
    pattern: 'pnpm test',
    metadata: {
      command: 'pnpm test',
    },
  },
  'OpenCode permission.updated tool calls should settle approval cards with canonical runtimeStatus instead of leaving lifecycle inference to the UI',
);

const questionAskedBridge = createOpenCodeOfficialSdkBridge({
  createOpencodeClient: () => ({
    session: {
      create: async () => ({
        id: 'session-question-1',
      }),
      prompt: async () => ({
        parts: [],
      }),
      promptAsync: async () => undefined,
    },
    event: {
      subscribe: async () => ({
        stream: (async function* () {
          yield {
            type: 'question.asked',
            properties: {
              requestID: 'question-request-1',
              sessionID: 'session-question-1',
              questions: [
                {
                  header: 'Test scope',
                  question: 'Which tests should I run?',
                  options: [
                    {
                      label: 'Unit',
                      description: 'Run unit tests only',
                    },
                    {
                      label: 'All',
                      description: 'Run all checks',
                    },
                  ],
                  multiple: false,
                  custom: true,
                },
              ],
              tool: {
                messageID: 'message-question-1',
                callID: 'tool-question-1',
              },
            },
          };
          yield {
            type: 'session.idle',
            properties: {
              sessionID: 'session-question-1',
            },
          };
        })(),
      }),
    },
  }),
});
const questionAskedChunks = await collectStream(
  questionAskedBridge!.sendMessageStream!(messages, {
    model: 'opencode',
    context: {
      workspaceRoot: 'D:/workspace/demo',
    },
  }),
);
const questionAskedToolCall = questionAskedChunks.find(
  (chunk) => (chunk.choices[0]?.delta.tool_calls?.length ?? 0) > 0,
)?.choices[0]?.delta.tool_calls?.[0];
assert.equal(
  questionAskedToolCall?.function.name,
  'user_question',
  'OpenCode official SDK bridge should project v2 question.asked events into canonical user_question tool calls',
);
assert.equal(
  questionAskedToolCall?.id,
  'question-request-1',
  'OpenCode question.asked tool call ids must use the provider request id so follow-up lifecycle events settle the same card.',
);
assert.deepEqual(
  JSON.parse(questionAskedToolCall?.function.arguments ?? '{}'),
  {
    status: 'awaiting_user',
    requestId: 'question-request-1',
    sessionID: 'session-question-1',
    questions: [
      {
        header: 'Test scope',
        question: 'Which tests should I run?',
        options: [
          {
            label: 'Unit',
            description: 'Run unit tests only',
          },
          {
            label: 'All',
            description: 'Run all checks',
          },
        ],
        multiple: false,
        custom: true,
      },
    ],
    tool: {
      messageID: 'message-question-1',
      callID: 'tool-question-1',
    },
  },
  'OpenCode user_question tool calls should preserve question choices and request metadata for cross-engine input UI',
);

const questionRepliedBridge = createOpenCodeOfficialSdkBridge({
  createOpencodeClient: () => ({
    session: {
      create: async () => ({
        id: 'session-question-replied-1',
      }),
      prompt: async () => ({
        parts: [],
      }),
      promptAsync: async () => undefined,
    },
    event: {
      subscribe: async () => ({
        stream: (async function* () {
          yield {
            type: 'question.replied',
            properties: {
              sessionID: 'session-question-replied-1',
              requestID: 'question-request-1',
              answers: [['Unit']],
            },
          };
          yield {
            type: 'session.idle',
            properties: {
              sessionID: 'session-question-replied-1',
            },
          };
        })(),
      }),
    },
  }),
});
const questionRepliedChunks = await collectStream(
  questionRepliedBridge!.sendMessageStream!(messages, {
    model: 'opencode',
    context: {
      workspaceRoot: 'D:/workspace/demo',
    },
  }),
);
const questionRepliedToolCall = questionRepliedChunks.find(
  (chunk) => (chunk.choices[0]?.delta.tool_calls?.length ?? 0) > 0,
)?.choices[0]?.delta.tool_calls?.[0];
assert.equal(
  questionRepliedToolCall?.function.name,
  'user_question',
  'OpenCode official SDK bridge should project v2 question.replied events into canonical user_question lifecycle updates',
);
assert.deepEqual(
  JSON.parse(questionRepliedToolCall?.function.arguments ?? '{}'),
  {
    status: 'completed',
    runtimeStatus: 'awaiting_tool',
    requestId: 'question-request-1',
    sessionID: 'session-question-replied-1',
    answer: 'Unit',
    answers: [['Unit']],
  },
  'OpenCode question.replied tool calls should settle user_question cards without losing the provider answer matrix',
);

const questionRejectedBridge = createOpenCodeOfficialSdkBridge({
  createOpencodeClient: () => ({
    session: {
      create: async () => ({
        id: 'session-question-rejected-1',
      }),
      prompt: async () => ({
        parts: [],
      }),
      promptAsync: async () => undefined,
    },
    event: {
      subscribe: async () => ({
        stream: (async function* () {
          yield {
            type: 'question.rejected',
            properties: {
              sessionID: 'session-question-rejected-1',
              requestID: 'question-request-1',
            },
          };
          yield {
            type: 'session.idle',
            properties: {
              sessionID: 'session-question-rejected-1',
            },
          };
        })(),
      }),
    },
  }),
});
const questionRejectedChunks = await collectStream(
  questionRejectedBridge!.sendMessageStream!(messages, {
    model: 'opencode',
    context: {
      workspaceRoot: 'D:/workspace/demo',
    },
  }),
);
const questionRejectedToolCall = questionRejectedChunks.find(
  (chunk) => (chunk.choices[0]?.delta.tool_calls?.length ?? 0) > 0,
)?.choices[0]?.delta.tool_calls?.[0];
assert.deepEqual(
  JSON.parse(questionRejectedToolCall?.function.arguments ?? '{}'),
  {
    status: 'rejected',
    runtimeStatus: 'failed',
    requestId: 'question-request-1',
    sessionID: 'session-question-rejected-1',
  },
  'OpenCode question.rejected tool calls should settle user_question cards as failed instead of leaving them pending',
);

const commandAliasToolPartBridge = createOpenCodeOfficialSdkBridge({
  createOpencodeClient: () => ({
    session: {
      create: async () => ({
        id: 'session-command-alias-1',
      }),
      prompt: async () => ({
        parts: [],
      }),
      promptAsync: async () => undefined,
    },
    event: {
      subscribe: async () => ({
        stream: (async function* () {
          yield {
            type: 'message.part.updated',
            properties: {
              part: {
                id: 'part-command-alias-1',
                sessionID: 'session-command-alias-1',
                messageID: 'message-command-alias-1',
                type: 'tool',
                callID: 'tool-command-alias-1',
                tool: 'bash',
                state: {
                  status: 'running',
                  input: {
                    command: 'pnpm lint',
                  },
                },
              },
            },
          };
          yield {
            type: 'session.idle',
            properties: {
              sessionID: 'session-command-alias-1',
            },
          };
        })(),
      }),
    },
  }),
});
const commandAliasToolPartChunks = await collectStream(
  commandAliasToolPartBridge!.sendMessageStream!(messages, {
    model: 'opencode',
    context: {
      workspaceRoot: 'D:/workspace/demo',
    },
  }),
);
assert.equal(
  commandAliasToolPartChunks.find((chunk) => (chunk.choices[0]?.delta.tool_calls?.length ?? 0) > 0)
    ?.choices[0]?.delta.tool_calls?.[0]?.function.name,
  'run_command',
  'OpenCode native command aliases must be normalized to run_command before entering the shared message/projection pipeline',
);

console.log('opencode official sdk bridge contract passed.');
