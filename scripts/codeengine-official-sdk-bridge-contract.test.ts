import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as officialSdkBridge from './codeengine-official-sdk-bridge.ts';

import type {
  ChatStreamChunk,
} from '../packages/sdkwork-birdcoder-chat/src/types.ts';

const {
  collectOfficialSdkBridgeStreamResult,
  isOfficialSdkBridgeResponseEmpty,
} = officialSdkBridge;
const serializeOfficialSdkBridgeOutput = (
  officialSdkBridge as unknown as {
    serializeOfficialSdkBridgeOutput?: (value: unknown) => string;
  }
).serializeOfficialSdkBridgeOutput;
const parseOfficialSdkBridgeRequest = (
  officialSdkBridge as unknown as {
    parseOfficialSdkBridgeRequest?: (payload: string) => Record<string, unknown>;
  }
).parseOfficialSdkBridgeRequest;
const buildOfficialSdkBridgeFailureOutput = (
  officialSdkBridge as unknown as {
    buildOfficialSdkBridgeFailureOutput?: (error: unknown) => string;
  }
).buildOfficialSdkBridgeFailureOutput;
const bridgeSource = readFileSync(
  new URL('./codeengine-official-sdk-bridge.ts', import.meta.url),
  'utf8',
);

assert.match(
  bridgeSource,
  /const\s+options\s*=\s*\{[\s\S]*?\bstream:\s*true[\s\S]*?\};/,
  'codeengine official SDK bridge must default ChatOptions.stream to true before invoking sendMessageStream.',
);
assert.match(
  bridgeSource,
  /engine\.sendMessageStream\(messages,\s*options\)/,
  'codeengine official SDK bridge must pass the default stream-enabled options into sendMessageStream.',
);

async function* createBridgeStream(): AsyncGenerator<ChatStreamChunk, void, unknown> {
  yield {
    id: 'bridge-stream-contract',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'gemini',
    choices: [
      {
        index: 0,
        delta: {
          role: 'assistant',
          content: 'Inspecting ',
        },
        finish_reason: null,
      },
    ],
  };
  yield {
    id: 'bridge-stream-contract',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'gemini',
    choices: [
      {
        index: 0,
        delta: {
          tool_calls: [
            {
              id: 'tool-run-lint',
              type: 'function',
              function: {
                name: 'run_command',
                arguments: JSON.stringify({
                  command: 'pnpm lint',
                  cwd: 'D:/workspace/demo',
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
    id: 'bridge-stream-contract',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'gemini',
    choices: [
      {
        index: 0,
        delta: {
          content: 'workspace.',
        },
        finish_reason: 'stop',
      },
    ],
  };
}

async function* createCommandOnlyBridgeStream(): AsyncGenerator<ChatStreamChunk, void, unknown> {
  yield {
    id: 'bridge-command-only-stream-contract',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'claude-code',
    choices: [
      {
        index: 0,
        delta: {
          role: 'assistant',
          tool_calls: [
            {
              id: 'tool-read-file',
              type: 'function',
              function: {
                name: 'read_file',
                arguments: JSON.stringify({
                  path: 'src/index.ts',
                }),
              },
            },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
  };
}

async function* createQueryToolBridgeStream(): AsyncGenerator<ChatStreamChunk, void, unknown> {
  yield {
    id: 'bridge-query-tool-stream-contract',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'gemini',
    choices: [
      {
        index: 0,
        delta: {
          role: 'assistant',
          tool_calls: [
            {
              id: 'tool-search-code',
              type: 'function',
              function: {
                name: 'search_code',
                arguments: JSON.stringify({
                  query: 'TODO',
                }),
              },
            },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
  };
}

async function* createQuestionBridgeStream(): AsyncGenerator<ChatStreamChunk, void, unknown> {
  yield {
    id: 'bridge-question-stream-contract',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'opencode',
    choices: [
      {
        index: 0,
        delta: {
          role: 'assistant',
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
                      header: 'Test scope',
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
}

async function* createAnsweredQuestionBridgeStream(): AsyncGenerator<ChatStreamChunk, void, unknown> {
  yield {
    id: 'bridge-answered-question-stream-contract',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'opencode',
    choices: [
      {
        index: 0,
        delta: {
          role: 'assistant',
          tool_calls: [
            {
              id: 'tool-user-question',
              type: 'function',
              function: {
                name: 'user_question',
                arguments: JSON.stringify({
                  status: 'completed',
                  answer: 'Unit',
                }),
              },
            },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
  };
}

async function* createQuestionLifecycleBridgeStream(): AsyncGenerator<ChatStreamChunk, void, unknown> {
  yield {
    id: 'bridge-question-lifecycle-stream-contract',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'opencode',
    choices: [
      {
        index: 0,
        delta: {
          role: 'assistant',
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
  yield {
    id: 'bridge-question-lifecycle-stream-contract',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'opencode',
    choices: [
      {
        index: 0,
        delta: {
          tool_calls: [
            {
              id: 'tool-user-question',
              type: 'function',
              function: {
                name: 'user_question',
                arguments: JSON.stringify({
                  status: 'completed',
                  answer: 'Unit',
                }),
              },
            },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
  };
}

async function* createPermissionBridgeStream(): AsyncGenerator<ChatStreamChunk, void, unknown> {
  yield {
    id: 'bridge-permission-stream-contract',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'gemini',
    choices: [
      {
        index: 0,
        delta: {
          role: 'assistant',
          tool_calls: [
            {
              id: 'tool-permission-request',
              type: 'function',
              function: {
                name: 'approval_request',
                arguments: JSON.stringify({
                  status: 'awaiting_approval',
                  tool: 'edit_file',
                  permission: 'write',
                  patterns: ['src/**'],
                }),
              },
            },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
  };
}

async function* createPermissionRequestFilePathAliasBridgeStream(): AsyncGenerator<ChatStreamChunk, void, unknown> {
  yield {
    id: 'bridge-permission-file-path-alias-stream-contract',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'gemini',
    choices: [
      {
        index: 0,
        delta: {
          role: 'assistant',
          tool_calls: [
            {
              id: 'tool-permission-file-path-alias',
              type: 'function',
              function: {
                name: 'permission_request',
                arguments: JSON.stringify({
                  status: 'awaiting_approval',
                  request: {
                    args: {
                      file_path: 'src/App.tsx',
                    },
                  },
                }),
              },
            },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
  };
}

async function* createApprovedPermissionBridgeStream(): AsyncGenerator<ChatStreamChunk, void, unknown> {
  yield {
    id: 'bridge-approved-permission-stream-contract',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'opencode',
    choices: [
      {
        index: 0,
        delta: {
          role: 'assistant',
          tool_calls: [
            {
              id: 'tool-permission-request',
              type: 'function',
              function: {
                name: 'permission_request',
                arguments: JSON.stringify({
                  status: 'approved',
                  tool: 'edit_file',
                  permission: 'write',
                  patterns: ['src/**'],
                }),
              },
            },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
  };
}

async function* createChunkedToolCallBridgeStream(): AsyncGenerator<ChatStreamChunk, void, unknown> {
  yield {
    id: 'bridge-chunked-tool-stream-contract',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'claude-code',
    choices: [
      {
        index: 0,
        delta: {
          role: 'assistant',
          tool_calls: [
            {
              id: 'tool-run-tests',
              index: 0,
              type: 'function',
              function: {
                name: 'run_command',
                arguments: '{"command":"pnpm',
              },
            } as never,
          ],
        },
        finish_reason: null,
      },
    ],
  };
  yield {
    id: 'bridge-chunked-tool-stream-contract',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'claude-code',
    choices: [
      {
        index: 0,
        delta: {
          tool_calls: [
            {
              function: {
                arguments: ' test","cwd":"D:/workspace/demo"}',
              },
            } as never,
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
  };
}

async function* createMultiFilePatchBridgeStream(): AsyncGenerator<ChatStreamChunk, void, unknown> {
  yield {
    id: 'bridge-multi-file-patch-stream-contract',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'codex',
    choices: [
      {
        index: 0,
        delta: {
          tool_calls: [
            {
              id: 'tool-multi-file-patch',
              type: 'function',
              function: {
                name: 'apply_patch',
                arguments: JSON.stringify({
                  changes: [
                    { path: 'src/App.tsx', diff: '+answer\n' },
                    { path: 'src/index.ts', diff: '+export\n' },
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
}

async function* createFailedCommandBridgeStream(): AsyncGenerator<ChatStreamChunk, void, unknown> {
  yield {
    id: 'bridge-failed-command-stream-contract',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'claude-code',
    choices: [
      {
        index: 0,
        delta: {
          tool_calls: [
            {
              id: 'tool-failed-command',
              type: 'function',
              function: {
                name: 'run_command',
                arguments: JSON.stringify({
                  command: 'pnpm test',
                  status: 'failed',
                  exitCode: 1,
                  requiresApproval: true,
                  output: 'test failed',
                }),
              },
            },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
  };
}

async function* createLongIdentifierArgumentBridgeStream(): AsyncGenerator<ChatStreamChunk, void, unknown> {
  yield {
    id: 'bridge-long-identifier-argument-stream-contract',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'claude-code',
    choices: [
      {
        index: 0,
        delta: {
          tool_calls: [
            {
              id: 'tool-long-identifier-command',
              type: 'function',
              function: {
                name: 'run_command',
                arguments: '{"command":"inspect ticket","requestId":101777208078558031}',
              },
            },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
  };
}

async function* createFullSnapshotToolCallBridgeStream(): AsyncGenerator<ChatStreamChunk, void, unknown> {
  yield {
    id: 'bridge-full-snapshot-tool-stream-contract',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'opencode',
    choices: [
      {
        index: 0,
        delta: {
          tool_calls: [
            {
              id: 'tool-snapshot-command',
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
    id: 'bridge-full-snapshot-tool-stream-contract',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'opencode',
    choices: [
      {
        index: 0,
        delta: {
          tool_calls: [
            {
              id: 'tool-snapshot-command',
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
}

async function* createDuplicateSnapshotToolCallBridgeStream(): AsyncGenerator<ChatStreamChunk, void, unknown> {
  for (let index = 0; index < 2; index += 1) {
    yield {
      id: 'bridge-duplicate-snapshot-tool-stream-contract',
      object: 'chat.completion.chunk',
      created: 1,
      model: 'opencode',
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                id: 'tool-duplicate-snapshot-command',
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
}

async function* createLifecycleToolCallBridgeStream(): AsyncGenerator<ChatStreamChunk, void, unknown> {
  yield {
    id: 'bridge-lifecycle-tool-stream-contract',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'gemini',
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
    id: 'bridge-lifecycle-tool-stream-contract',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'gemini',
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
                  status: 'success',
                  output: 'tests passed',
                }),
              },
            },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
  };
}

const result = await collectOfficialSdkBridgeStreamResult(createBridgeStream());
const streamedEvents: Array<{
  contentDelta?: string;
  payload?: Record<string, unknown>;
  role?: string;
  type: string;
}> = [];
const streamedResult = await collectOfficialSdkBridgeStreamResult(createBridgeStream(), {
  onEvent: (event) => streamedEvents.push(event),
});

assert.equal(
  result.assistantContent,
  'Inspecting workspace.',
  'codeengine official SDK bridge should aggregate assistant stream content for authoritative transcript display',
);
assert.deepEqual(
  result.commands,
  [
    {
      command: 'pnpm lint',
      status: 'running',
      output: '{"command":"pnpm lint","cwd":"D:/workspace/demo"}',
      kind: 'command',
      toolName: 'run_command',
      toolCallId: 'tool-run-lint',
      requiresApproval: false,
      requiresReply: false,
    },
  ],
  'codeengine official SDK bridge should preserve request-only stream tool calls as running transcript command payloads',
);
assert.equal(
  streamedResult.assistantContent,
  result.assistantContent,
  'stream event emission must not change the aggregated bridge response',
);
assert.deepEqual(
  streamedEvents,
  [
    {
      type: 'message.delta',
      role: 'assistant',
      contentDelta: 'Inspecting ',
    },
    {
      type: 'tool.call.requested',
      payload: {
        toolName: 'run_command',
        toolCallId: 'tool-run-lint',
        toolArguments: {
          command: 'pnpm lint',
          cwd: 'D:/workspace/demo',
        },
        status: 'running',
        requiresApproval: false,
        requiresReply: false,
      },
    },
    {
      type: 'message.delta',
      role: 'assistant',
      contentDelta: 'workspace.',
    },
  ],
  'codeengine official SDK bridge should expose assistant content chunks and live tool calls as canonical stream events',
);

const commandOnlyResult = await collectOfficialSdkBridgeStreamResult(createCommandOnlyBridgeStream());

assert.equal(
  commandOnlyResult.assistantContent,
  '',
  'command-only bridge streams may legitimately have no assistant text',
);
assert.deepEqual(
  commandOnlyResult.commands,
  [
    {
      command: 'src/index.ts',
      status: 'running',
      output: '{"path":"src/index.ts"}',
      kind: 'tool',
      toolName: 'read_file',
      toolCallId: 'tool-read-file',
      requiresApproval: false,
      requiresReply: false,
    },
  ],
  'command-only bridge streams should still preserve command payloads for transcript display',
);
assert.equal(
  isOfficialSdkBridgeResponseEmpty(commandOnlyResult),
  false,
  'bridge responses with command payloads must not be rejected as empty assistant responses',
);

const queryToolResult = await collectOfficialSdkBridgeStreamResult(createQueryToolBridgeStream());
assert.deepEqual(
  queryToolResult.commands,
  [
    {
      command: 'TODO',
      status: 'running',
      output: '{"query":"TODO"}',
      kind: 'tool',
      toolName: 'search_code',
      toolCallId: 'tool-search-code',
      requiresApproval: false,
      requiresReply: false,
    },
  ],
  'official SDK bridge should render query-based diagnostic tool calls as readable command text instead of raw provider JSON',
);
assert.equal(
  isOfficialSdkBridgeResponseEmpty({
    assistantContent: '',
    commands: [],
  }),
  true,
  'bridge responses with no text and no command payloads should still be treated as empty',
);
assert.equal(
  typeof parseOfficialSdkBridgeRequest,
  'function',
  'official SDK bridge must expose its request parser so the request JSON codec is covered by contract tests.',
);
const parsedLongIdentifierBridgeRequest = parseOfficialSdkBridgeRequest!(
  '{"engineId":"codex","modelId":"codex","promptText":"Inspect","nativeSessionId":101777208078558031,"ideContext":{"workspaceId":101777208078558032,"projectId":101777208078558033,"sessionId":101777208078558034}}',
);
assert.deepEqual(
  {
    nativeSessionId: parsedLongIdentifierBridgeRequest.nativeSessionId,
    ideContext: parsedLongIdentifierBridgeRequest.ideContext,
  },
  {
    nativeSessionId: '101777208078558031',
    ideContext: {
      workspaceId: '101777208078558032',
      projectId: '101777208078558033',
      sessionId: '101777208078558034',
    },
  },
  'official SDK bridge must parse request payloads through the shared BirdCoder JSON codec so Java Long-compatible ids survive before context mapping.',
);

const questionResult = await collectOfficialSdkBridgeStreamResult(createQuestionBridgeStream());
assert.deepEqual(
  questionResult.commands,
  [
    {
      command: 'Which tests should I run?',
      status: 'running',
      output: '{"status":"awaiting_user","questions":[{"header":"Test scope","question":"Which tests should I run?","options":[{"label":"Unit","description":"Run unit tests only"}]}]}',
      kind: 'user_question',
      toolName: 'user_question',
      toolCallId: 'tool-user-question',
      runtimeStatus: 'awaiting_user',
      requiresApproval: false,
      requiresReply: true,
    },
  ],
  'official SDK bridge should render cross-engine user_question tool calls as the actual prompt instead of raw provider JSON',
);

const answeredQuestionResult = await collectOfficialSdkBridgeStreamResult(createAnsweredQuestionBridgeStream());
assert.deepEqual(
  answeredQuestionResult.commands,
  [
    {
      command: 'Unit',
      status: 'success',
      output: '{"status":"completed","answer":"Unit"}',
      kind: 'user_question',
      toolName: 'user_question',
      toolCallId: 'tool-user-question',
      runtimeStatus: 'awaiting_tool',
      requiresApproval: false,
      requiresReply: false,
    },
  ],
  'official SDK bridge must not mark answered user_question snapshots as still needing a reply',
);

const questionLifecycleResult = await collectOfficialSdkBridgeStreamResult(createQuestionLifecycleBridgeStream());
assert.deepEqual(
  questionLifecycleResult.commands,
  [
    {
      command: 'Which tests should I run?',
      status: 'success',
      output: '{"status":"completed","answer":"Unit"}',
      kind: 'user_question',
      toolName: 'user_question',
      toolCallId: 'tool-user-question',
      runtimeStatus: 'awaiting_tool',
      requiresApproval: false,
      requiresReply: false,
    },
  ],
  'official SDK bridge must preserve the original user_question prompt when a later lifecycle snapshot settles the same tool call',
);

const permissionResult = await collectOfficialSdkBridgeStreamResult(createPermissionBridgeStream());
const permissionStreamedEvents: Array<{
  payload?: Record<string, unknown>;
  type: string;
}> = [];
await collectOfficialSdkBridgeStreamResult(createPermissionBridgeStream(), {
  onEvent: (event) => permissionStreamedEvents.push(event),
});
assert.deepEqual(
  permissionResult.commands,
  [
    {
      command: 'Permission required: edit_file',
      status: 'running',
      output: '{"status":"awaiting_approval","tool":"edit_file","permission":"write","patterns":["src/**"]}',
      kind: 'approval',
      toolName: 'permission_request',
      toolCallId: 'tool-permission-request',
      runtimeStatus: 'awaiting_approval',
      requiresApproval: true,
      requiresReply: false,
    },
  ],
  'official SDK bridge should render cross-engine permission_request tool calls as approval prompts instead of raw provider JSON',
);
assert.deepEqual(
  permissionStreamedEvents,
  [
    {
      type: 'tool.call.requested',
      payload: {
        toolName: 'permission_request',
        toolCallId: 'tool-permission-request',
        toolArguments: {
          status: 'awaiting_approval',
          tool: 'edit_file',
          permission: 'write',
          patterns: ['src/**'],
        },
        status: 'running',
        runtimeStatus: 'awaiting_approval',
        requiresApproval: true,
        requiresReply: false,
      },
    },
    {
      type: 'approval.required',
      payload: {
        toolName: 'permission_request',
        toolCallId: 'tool-permission-request',
        toolArguments: {
          status: 'awaiting_approval',
          tool: 'edit_file',
          permission: 'write',
          patterns: ['src/**'],
        },
        status: 'running',
        runtimeStatus: 'awaiting_approval',
        requiresApproval: true,
        requiresReply: false,
      },
    },
  ],
  'official SDK bridge must stream approval.required immediately instead of waiting for the final turn response',
);

const permissionFilePathAliasResult = await collectOfficialSdkBridgeStreamResult(
  createPermissionRequestFilePathAliasBridgeStream(),
);
assert.deepEqual(
  permissionFilePathAliasResult.commands,
  [
    {
      command: 'Permission required: src/App.tsx',
      status: 'running',
      output: '{"status":"awaiting_approval","request":{"args":{"file_path":"src/App.tsx"}}}',
      kind: 'approval',
      toolName: 'permission_request',
      toolCallId: 'tool-permission-file-path-alias',
      runtimeStatus: 'awaiting_approval',
      requiresApproval: true,
      requiresReply: false,
    },
  ],
  'official SDK bridge should use file_path aliases inside permission request args when rendering approval command text',
);

const approvedPermissionResult = await collectOfficialSdkBridgeStreamResult(
  createApprovedPermissionBridgeStream(),
);
assert.deepEqual(
  approvedPermissionResult.commands,
  [
    {
      command: 'Permission required: edit_file',
      status: 'success',
      output: '{"status":"approved","tool":"edit_file","permission":"write","patterns":["src/**"]}',
      kind: 'approval',
      toolName: 'permission_request',
      toolCallId: 'tool-permission-request',
      runtimeStatus: 'awaiting_tool',
      requiresApproval: false,
      requiresReply: false,
    },
  ],
  'official SDK bridge must settle approved permission_request snapshots instead of keeping them in Needs approval state',
);

const chunkedToolCallResult = await collectOfficialSdkBridgeStreamResult(createChunkedToolCallBridgeStream());
assert.deepEqual(
  chunkedToolCallResult.commands,
  [
    {
      command: 'pnpm test',
      status: 'running',
      output: '{"command":"pnpm test","cwd":"D:/workspace/demo"}',
      kind: 'command',
      toolName: 'run_command',
      toolCallId: 'tool-run-tests',
      requiresApproval: false,
      requiresReply: false,
    },
  ],
  'official SDK bridge must merge OpenAI-style chunked tool_call request deltas before converting them to running transcript commands',
);

const multiFilePatchResult = await collectOfficialSdkBridgeStreamResult(createMultiFilePatchBridgeStream());
assert.deepEqual(
  multiFilePatchResult.commands,
  [
    {
      command: 'apply_patch: src/App.tsx, src/index.ts',
      status: 'running',
      output: '{"changes":[{"path":"src/App.tsx","diff":"+answer\\n"},{"path":"src/index.ts","diff":"+export\\n"}]}',
      kind: 'file_change',
      toolName: 'apply_patch',
      toolCallId: 'tool-multi-file-patch',
      requiresApproval: false,
      requiresReply: false,
    },
  ],
  'official SDK bridge should render request-only changes[] patch commands as concise running file lists for native session transcripts',
);

const failedCommandResult = await collectOfficialSdkBridgeStreamResult(createFailedCommandBridgeStream());
assert.deepEqual(
  failedCommandResult.commands,
  [
    {
      command: 'pnpm test',
      status: 'error',
      output: '{"command":"pnpm test","status":"failed","exitCode":1,"requiresApproval":true,"output":"test failed"}',
      kind: 'command',
      toolName: 'run_command',
      toolCallId: 'tool-failed-command',
      runtimeStatus: 'failed',
      requiresApproval: false,
      requiresReply: false,
    },
  ],
  'official SDK bridge should preserve failed tool-call status so native session command cards are not shown as successful',
);

const longIdentifierArgumentResult = await collectOfficialSdkBridgeStreamResult(
  createLongIdentifierArgumentBridgeStream(),
);
assert.deepEqual(
  longIdentifierArgumentResult.commands,
  [
    {
      command: 'inspect ticket',
      status: 'running',
      output: '{"command":"inspect ticket","requestId":"101777208078558031"}',
      kind: 'command',
      toolName: 'run_command',
      toolCallId: 'tool-long-identifier-command',
      requiresApproval: false,
      requiresReply: false,
    },
  ],
  'official SDK bridge must parse tool-call arguments through the shared BirdCoder JSON codec so Java Long-compatible ids are not rounded in native transcripts',
);

const fullSnapshotToolCallResult = await collectOfficialSdkBridgeStreamResult(createFullSnapshotToolCallBridgeStream());
const fullSnapshotToolCallEvents: Array<{
  payload?: Record<string, unknown>;
  type: string;
}> = [];
await collectOfficialSdkBridgeStreamResult(createFullSnapshotToolCallBridgeStream(), {
  onEvent: (event) => fullSnapshotToolCallEvents.push(event),
});
assert.deepEqual(
  fullSnapshotToolCallResult.commands,
  [
    {
      command: 'pnpm test',
      status: 'success',
      output: '{"command":"pnpm test","status":"completed","output":"ok"}',
      kind: 'command',
      toolName: 'run_command',
      toolCallId: 'tool-snapshot-command',
      runtimeStatus: 'completed',
      requiresApproval: false,
      requiresReply: false,
    },
  ],
  'official SDK bridge must replace repeated complete tool-call snapshots instead of concatenating them into invalid native transcript command payloads',
);
assert.deepEqual(
  fullSnapshotToolCallEvents,
  [
    {
      type: 'tool.call.requested',
      payload: {
        toolName: 'run_command',
        toolCallId: 'tool-snapshot-command',
        toolArguments: {
          command: 'pnpm test',
          status: 'running',
        },
        status: 'running',
        runtimeStatus: 'streaming',
        requiresApproval: false,
        requiresReply: false,
      },
    },
    {
      type: 'tool.call.completed',
      payload: {
        toolName: 'run_command',
        toolCallId: 'tool-snapshot-command',
        toolArguments: {
          command: 'pnpm test',
          status: 'completed',
          output: 'ok',
        },
        status: 'success',
        runtimeStatus: 'completed',
        requiresApproval: false,
        requiresReply: false,
      },
    },
  ],
  'official SDK bridge must stream complete tool-call snapshots immediately so IDE tool cards do not wait for finish_reason or turn completion.',
);

const duplicateSnapshotToolCallEvents: Array<{
  payload?: Record<string, unknown>;
  type: string;
}> = [];
await collectOfficialSdkBridgeStreamResult(createDuplicateSnapshotToolCallBridgeStream(), {
  onEvent: (event) => duplicateSnapshotToolCallEvents.push(event),
});
assert.deepEqual(
  duplicateSnapshotToolCallEvents,
  [
    {
      type: 'tool.call.requested',
      payload: {
        toolName: 'run_command',
        toolCallId: 'tool-duplicate-snapshot-command',
        toolArguments: {
          command: 'pnpm lint',
          status: 'running',
        },
        status: 'running',
        runtimeStatus: 'streaming',
        requiresApproval: false,
        requiresReply: false,
      },
    },
  ],
  'official SDK bridge must deduplicate repeated complete tool-call snapshots so realtime/UI work is not restreamed without a state change.',
);

const lifecycleToolCallResult = await collectOfficialSdkBridgeStreamResult(createLifecycleToolCallBridgeStream());
assert.deepEqual(
  lifecycleToolCallResult.commands,
  [
    {
      command: 'pnpm test',
      status: 'success',
      output: '{"command":"pnpm test","status":"success","output":"tests passed"}',
      kind: 'command',
      toolName: 'run_command',
      toolCallId: 'tool-lifecycle-command',
      runtimeStatus: 'completed',
      requiresApproval: false,
      requiresReply: false,
    },
  ],
  'official SDK bridge must merge repeated tool-call lifecycle events by call id instead of rendering duplicate native transcript command cards',
);

assert.equal(
  typeof serializeOfficialSdkBridgeOutput,
  'function',
  'official SDK bridge must expose its process-output serializer so stdout JSON stays covered by the same Long-safe boundary contract.',
);
assert.equal(
  serializeOfficialSdkBridgeOutput!({
    response: {
      assistantContent: 'ok',
      commands: [
        {
          command: 'inspect ticket',
          status: 'success',
          output: {
            requestId: 101777208078558063n,
          },
        },
      ],
    },
    type: 'turn.completed',
  }),
  '{"response":{"assistantContent":"ok","commands":[{"command":"inspect ticket","status":"success","output":{"requestId":"101777208078558063"}}]},"type":"turn.completed"}',
  'official SDK bridge stdout serialization must preserve Java Long-compatible fields even when an engine adapter returns provider-native bigint values.',
);

assert.equal(
  typeof buildOfficialSdkBridgeFailureOutput,
  'function',
  'official SDK bridge must expose its canonical failure serializer so stream-mode errors stay on the same JSONL contract as successful events.',
);
assert.equal(
  buildOfficialSdkBridgeFailureOutput!(new Error('Codeengine SDK bridge request requires modelId.')),
  '{"payload":{"errorMessage":"Codeengine SDK bridge request requires modelId.","runtimeStatus":"failed"},"type":"turn.failed"}',
  'streaming bridge failures must serialize as a canonical turn.failed event before process exit so realtime projection can finish without waiting for a fallback refresh.',
);
assert.match(
  bridgeSource,
  /if\s*\(\s*request\.streamEvents\s*\)\s*\{[\s\S]*stdout\.write\(`\$\{buildOfficialSdkBridgeFailureOutput\(error\)\}\\n`/s,
  'official SDK bridge main must write the canonical failure envelope to stdout when a stream-mode request fails.',
);

console.log('codeengine official sdk bridge contract passed.');
