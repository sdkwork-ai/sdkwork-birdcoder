import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  areBirdCoderChatMessagesEquivalent,
  areBirdCoderChatMessagesLogicallyMatched,
  createBirdCoderGeneratedCoreReadApiClient,
  mergeBirdCoderProjectionMessages,
  mergeBirdCoderComparableChatMessages,
  type BirdCoderChatMessage,
  type BirdCoderCodingSession,
  type BirdCoderProject,
} from '../packages/sdkwork-birdcoder-types/src/index.ts';
import { createBirdCoderInProcessCoreApiTransport } from '../packages/sdkwork-birdcoder-infrastructure/src/services/coreApiClient.ts';
import { readAuthorityBackedNativeSessionRecord } from '../packages/sdkwork-birdcoder-commons/src/workbench/nativeSessionAuthority.ts';

const baseMessage: BirdCoderChatMessage = {
  id: 'message-1',
  codingSessionId: 'coding-session-1',
  turnId: 'turn-1',
  role: 'assistant',
  content: 'Build completed.',
  createdAt: '2026-04-20T10:00:00.000Z',
  timestamp: Date.parse('2026-04-20T10:00:00.000Z'),
};

const commandChangedMessage: BirdCoderChatMessage = {
  ...baseMessage,
  commands: [{ command: 'pnpm build', status: 'success', output: 'ok' }],
};

const fileChangeChangedMessage: BirdCoderChatMessage = {
  ...baseMessage,
  fileChanges: [{ path: 'src/App.tsx', additions: 12, deletions: 3 }],
};

const metadataChangedMessage: BirdCoderChatMessage = {
  ...baseMessage,
  metadata: { runtimeStatus: 'completed', engineId: 'codex' },
};

const taskProgressChangedMessage: BirdCoderChatMessage = {
  ...baseMessage,
  taskProgress: { total: 4, completed: 3 },
};

assert.equal(
  areBirdCoderChatMessagesEquivalent(baseMessage, { ...baseMessage }),
  true,
  'identical chat messages should remain equivalent',
);

assert.equal(
  areBirdCoderChatMessagesLogicallyMatched(
    baseMessage,
    {
      ...baseMessage,
      createdAt: '2026-04-20T10:00:01.000Z',
      content: 'Build completed.\r\n',
    },
  ),
  true,
  'messages from the same turn should match logically even when line endings or createdAt differ across projection and store boundaries',
);

assert.equal(
  areBirdCoderChatMessagesLogicallyMatched(
    baseMessage,
    {
      ...baseMessage,
      id: 'message-from-other-session',
      codingSessionId: 'coding-session-2',
    },
  ),
  false,
  'messages from different coding sessions must never match logically even when ids, turn ids, roles, and content collide',
);

assert.equal(
  areBirdCoderChatMessagesLogicallyMatched(
    baseMessage,
    {
      ...baseMessage,
      codingSessionId: '',
    },
  ),
  false,
  'messages with a missing codingSessionId must not match a scoped session message by id alone',
);

assert.equal(
  areBirdCoderChatMessagesLogicallyMatched(
    {
      ...baseMessage,
      id: 'message-collision-left',
      turnId: 'turn:assistant:one',
      content: 'two',
    },
    {
      ...baseMessage,
      id: 'message-collision-right',
      turnId: 'turn',
      content: 'one:assistant:two',
    },
  ),
  false,
  'logical message keys must be delimiter-safe so turn ids and content containing colons cannot collapse distinct messages',
);

assert.equal(
  areBirdCoderChatMessagesLogicallyMatched(
    {
      ...baseMessage,
      id: 'message-no-turn-1',
      turnId: undefined,
      role: 'user',
      content: 'repeat',
      createdAt: '2026-04-20T10:00:00.000Z',
    },
    {
      ...baseMessage,
      id: 'message-no-turn-2',
      turnId: undefined,
      role: 'user',
      content: 'repeat',
      createdAt: '2026-04-20T10:00:05.000Z',
    },
  ),
  false,
  'messages without turn ids must keep createdAt in the logical match so repeated user prompts are not collapsed together',
);

assert.equal(
  areBirdCoderChatMessagesEquivalent(baseMessage, commandChangedMessage),
  false,
  'command payload changes must invalidate message equivalence',
);

assert.equal(
  areBirdCoderChatMessagesEquivalent(baseMessage, fileChangeChangedMessage),
  false,
  'file change payload updates must invalidate message equivalence',
);

assert.equal(
  areBirdCoderChatMessagesEquivalent(baseMessage, metadataChangedMessage),
  false,
  'metadata updates must invalidate message equivalence',
);

assert.equal(
  areBirdCoderChatMessagesEquivalent(baseMessage, taskProgressChangedMessage),
  false,
  'task progress updates must invalidate message equivalence',
);

const mergedRichMessage = mergeBirdCoderComparableChatMessages(
  baseMessage,
  {
    ...baseMessage,
    commands: [{ command: 'pnpm build', status: 'success', output: 'ok' }],
    fileChanges: [{ path: 'src/App.tsx', additions: 12, deletions: 3 }],
    taskProgress: { total: 4, completed: 4 },
  },
);

assert.deepEqual(
  mergedRichMessage.commands,
  [{ command: 'pnpm build', status: 'success', output: 'ok' }],
  'rich command payloads should upgrade an existing logical message',
);

assert.deepEqual(
  mergedRichMessage.fileChanges,
  [{ path: 'src/App.tsx', additions: 12, deletions: 3 }],
  'file change payloads should upgrade an existing logical message',
);

assert.deepEqual(
  mergedRichMessage.taskProgress,
  { total: 4, completed: 4 },
  'task progress payloads should upgrade an existing logical message',
);

const projectedMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: 'coding-session-1',
  existingMessages: [
    baseMessage,
    {
      ...baseMessage,
      id: 'other-session-message',
      codingSessionId: 'coding-session-2',
      content: 'This belongs to another session.',
    },
  ],
  idPrefix: 'refreshed',
  events: [],
});
assert.deepEqual(
  projectedMessages.map((message) => message.codingSessionId),
  ['coding-session-1'],
  'projection refresh must drop existing messages whose codingSessionId does not match the selected session',
);

const unsafeProjectionCounterMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: 'coding-session-1',
  existingMessages: [],
  idPrefix: 'refreshed',
  events: [
    {
      id: 'unsafe-counter-artifact',
      codingSessionId: 'coding-session-1',
      kind: 'artifact.upserted',
      payload: {
        artifactKind: 'diff',
        path: 'src/unsafe-counter.ts',
        patch: [
          '--- a/src/unsafe-counter.ts',
          '+++ b/src/unsafe-counter.ts',
          '-const value = 1;',
          '+const value = 2;',
        ].join('\n'),
        additions: '101777208078558009',
        deletions: Number('101777208078558011'),
      },
      sequence: '2',
      createdAt: '2026-04-20T10:00:02.000Z',
      turnId: 'turn-unsafe-counter',
    },
    {
      id: 'unsafe-counter-completed',
      codingSessionId: 'coding-session-1',
      kind: 'message.completed',
      payload: {
        role: 'assistant',
        content: 'Applied one replacement.',
      },
      sequence: '3',
      createdAt: '2026-04-20T10:00:03.000Z',
      turnId: 'turn-unsafe-counter',
    },
  ],
});
assert.deepEqual(
  unsafeProjectionCounterMessages[0]?.fileChanges,
  [
    {
      path: 'src/unsafe-counter.ts',
      additions: 1,
      deletions: 1,
    },
  ],
  'projection file-change counters must reject unsafe JavaScript integers and fall back to diff-derived counts instead of rendering rounded Long-sized counts.',
);

const unsafeTaskProgressMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: 'coding-session-1',
  existingMessages: [],
  idPrefix: 'refreshed',
  events: [
    {
      id: 'unsafe-task-progress-completed',
      codingSessionId: 'coding-session-1',
      kind: 'message.completed',
      payload: {
        role: 'assistant',
        content: 'Still working.',
        taskProgress: {
          total: Number('101777208078558013'),
          completed: 1,
        },
      },
      sequence: '4',
      createdAt: '2026-04-20T10:00:04.000Z',
      turnId: 'turn-unsafe-task-progress',
    },
  ],
});
assert.equal(
  unsafeTaskProgressMessages[0]?.taskProgress,
  undefined,
  'projection task progress must reject unsafe JavaScript integers instead of rendering rounded Long-sized progress counters.',
);

const delimiterSafeProjectedMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: 'coding-session-1',
  existingMessages: [],
  idPrefix: 'refreshed',
  events: [
    {
      id: 'projection-collision-completed',
      codingSessionId: 'coding-session-1',
      kind: 'message.completed',
      payload: {
        role: 'assistant',
        content: 'payload',
      },
      sequence: '1',
      createdAt: '2026-04-20T10:00:01.000Z',
      turnId: 'turn:user',
    },
    {
      id: 'projection-collision-delta',
      codingSessionId: 'coding-session-1',
      kind: 'message.delta',
      payload: {
        role: 'user',
        contentDelta: 'assistant:payload',
      },
      sequence: '2',
      createdAt: '2026-04-20T10:00:02.000Z',
      turnId: 'turn',
    },
  ],
});
assert.deepEqual(
  delimiterSafeProjectedMessages.map((message) => [
    message.turnId,
    message.role,
    message.content,
  ]),
  [
    ['turn:user', 'assistant', 'payload'],
    ['turn', 'user', 'assistant:payload'],
  ],
  'projection message identities must be delimiter-safe so distinct turn/role/content tuples cannot collapse during authoritative merge',
);

const streamingCompletedProjectedMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: 'coding-session-1',
  existingMessages: [],
  idPrefix: 'refreshed',
  events: [
    {
      id: 'streaming-delta-1',
      codingSessionId: 'coding-session-1',
      kind: 'message.delta',
      payload: {
        role: 'assistant',
        contentDelta: 'I will inspect',
      },
      sequence: '1',
      createdAt: '2026-04-20T10:00:02.000Z',
      turnId: 'streaming-turn',
    },
    {
      id: 'streaming-delta-2',
      codingSessionId: 'coding-session-1',
      kind: 'message.delta',
      payload: {
        role: 'assistant',
        contentDelta: ' the provider first.',
      },
      sequence: '2',
      createdAt: '2026-04-20T10:00:03.000Z',
      turnId: 'streaming-turn',
    },
    {
      id: 'streaming-completed',
      codingSessionId: 'coding-session-1',
      kind: 'message.completed',
      payload: {
        role: 'assistant',
        content: 'I will inspect the provider first and then patch the adapter.',
      },
      sequence: '3',
      createdAt: '2026-04-20T10:00:04.000Z',
      turnId: 'streaming-turn',
    },
  ],
});
assert.deepEqual(
  streamingCompletedProjectedMessages.map((message) => [
    message.turnId,
    message.role,
    message.content,
  ]),
  [
    [
      'streaming-turn',
      'assistant',
      'I will inspect the provider first and then patch the adapter.',
    ],
  ],
  'completed projection messages must replace same-turn streaming deltas so a single assistant reply cannot render multiple times after refresh',
);

const streamingOnlyProjectedMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: 'coding-session-1',
  existingMessages: [],
  idPrefix: 'refreshed',
  events: [
    {
      id: 'streaming-only-delta-1',
      codingSessionId: 'coding-session-1',
      kind: 'message.delta',
      payload: {
        role: 'assistant',
        contentDelta: 'I will inspect',
      },
      sequence: '1',
      createdAt: '2026-04-20T10:00:02.000Z',
      turnId: 'streaming-only-turn',
    },
    {
      id: 'streaming-only-delta-2',
      codingSessionId: 'coding-session-1',
      kind: 'message.delta',
      payload: {
        role: 'assistant',
        contentDelta: ' the provider first.',
      },
      sequence: '2',
      createdAt: '2026-04-20T10:00:03.000Z',
      turnId: 'streaming-only-turn',
    },
  ],
});
assert.equal(
  streamingOnlyProjectedMessages[0]?.content,
  'I will inspect the provider first.',
  'streaming projection must preserve contentDelta whitespace while assembling an in-flight assistant reply',
);

const mixedSessionProjectedMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: 'coding-session-1',
  existingMessages: [],
  idPrefix: 'refreshed',
  events: [
    {
      id: 'target-session-event',
      codingSessionId: 'coding-session-1',
      kind: 'message.completed',
      payload: {
        role: 'assistant',
        content: 'Target session reply.',
      },
      sequence: '1',
      createdAt: '2026-04-20T10:00:03.000Z',
      turnId: 'target-turn',
    },
    {
      id: 'wrong-session-event',
      codingSessionId: 'coding-session-2',
      kind: 'message.completed',
      payload: {
        role: 'assistant',
        content: 'Wrong session reply.',
      },
      sequence: '2',
      createdAt: '2026-04-20T10:00:04.000Z',
      turnId: 'wrong-turn',
    },
  ],
});
assert.deepEqual(
  mixedSessionProjectedMessages.map((message) => message.content),
  ['Target session reply.'],
  'projection refresh must ignore authority events whose codingSessionId belongs to another session',
);

const localMirrorUserProjectionMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: 'coding-session-1',
  existingMessages: [
    {
      id: 'local-user-message',
      codingSessionId: 'coding-session-1',
      role: 'user',
      content: 'Run tests',
      createdAt: '2026-04-20T10:00:00.000Z',
      timestamp: Date.parse('2026-04-20T10:00:00.000Z'),
    },
    {
      id: 'local-user-repeat',
      codingSessionId: 'coding-session-1',
      role: 'user',
      content: 'Run tests',
      createdAt: '2026-04-20T10:10:00.000Z',
      timestamp: Date.parse('2026-04-20T10:10:00.000Z'),
    },
  ],
  idPrefix: 'refreshed',
  events: [
    {
      id: 'authoritative-user-event',
      codingSessionId: 'coding-session-1',
      kind: 'message.completed',
      payload: {
        role: 'user',
        content: 'Run tests',
      },
      sequence: '1',
      createdAt: '2026-04-20T10:00:02.000Z',
      turnId: 'turn-user-1',
    },
  ],
});
assert.deepEqual(
  localMirrorUserProjectionMessages.map((message) => ({
    id: message.id,
    turnId: message.turnId,
    content: message.content,
  })),
  [
    {
      id: 'coding-session-1:refreshed:turn-user-1:user',
      turnId: 'turn-user-1',
      content: 'Run tests',
    },
    {
      id: 'local-user-repeat',
      turnId: undefined,
      content: 'Run tests',
    },
  ],
  'projection refresh must replace the nearby local user mirror with the authoritative turn message without collapsing a later repeated prompt',
);

const commandOnlyProjectedMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: 'coding-session-1',
  existingMessages: [],
  idPrefix: 'refreshed',
  events: [
    {
      id: 'command-only-completed',
      codingSessionId: 'coding-session-1',
      kind: 'message.completed',
      payload: {
        role: 'assistant',
        content: '',
        commandsJson: JSON.stringify([
          {
            command: 'pnpm lint',
            status: 'success',
            output: 'ok',
          },
        ]),
      },
      sequence: '1',
      createdAt: '2026-04-20T10:00:05.000Z',
      turnId: 'command-only-turn',
    },
  ],
});
assert.deepEqual(
  commandOnlyProjectedMessages.map((message) => ({
    role: message.role,
    content: message.content,
    commands: message.commands,
  })),
  [
    {
      role: 'assistant',
      content: '',
      commands: [
        {
          command: 'pnpm lint',
          status: 'success',
          output: 'ok',
        },
      ],
    },
  ],
  'projection refresh must preserve command-only assistant messages emitted by native code-engine adapters',
);

const canonicalToolEventProjectedMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: 'coding-session-1',
  existingMessages: [],
  idPrefix: 'refreshed',
  events: [
    {
      id: 'canonical-user-message',
      codingSessionId: 'coding-session-1',
      kind: 'message.completed',
      payload: {
        role: 'user',
        content: 'Run lint',
      },
      sequence: '1',
      createdAt: '2026-04-20T10:00:06.000Z',
      turnId: 'canonical-tool-turn',
    },
    {
      id: 'canonical-tool-call',
      codingSessionId: 'coding-session-1',
      kind: 'tool.call.requested',
      payload: {
        toolCallId: 'tool-run-lint',
        toolName: 'run_command',
        toolArguments: JSON.stringify({
          command: 'pnpm lint',
          cwd: 'D:/workspace/demo',
        }),
      },
      sequence: '2',
      createdAt: '2026-04-20T10:00:07.000Z',
      turnId: 'canonical-tool-turn',
    },
    {
      id: 'canonical-assistant-message',
      codingSessionId: 'coding-session-1',
      kind: 'message.completed',
      payload: {
        role: 'assistant',
        content: 'I will run lint.',
      },
      sequence: '3',
      createdAt: '2026-04-20T10:00:08.000Z',
      turnId: 'canonical-tool-turn',
    },
  ],
});
assert.deepEqual(
  canonicalToolEventProjectedMessages.map((message) => ({
    role: message.role,
    content: message.content,
    commands: message.commands,
  })),
  [
    {
      role: 'user',
      content: 'Run lint',
      commands: undefined,
    },
    {
      role: 'assistant',
      content: 'I will run lint.',
      commands: [
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
    },
  ],
  'projection refresh must fold canonical tool-call events into assistant transcript command cards without attaching them to the user message',
);

const sameTimestampTurnMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: 'coding-session-1',
  existingMessages: [],
  idPrefix: 'refreshed',
  events: [
    {
      id: 'same-timestamp-assistant-message',
      codingSessionId: 'coding-session-1',
      kind: 'message.completed',
      payload: {
        role: 'assistant',
        content: 'Done.',
      },
      sequence: '2',
      createdAt: '2026-04-20T10:00:09.000Z',
      turnId: 'same-timestamp-turn',
    },
    {
      id: 'same-timestamp-user-message',
      codingSessionId: 'coding-session-1',
      kind: 'message.completed',
      payload: {
        role: 'user',
        content: 'Run lint',
      },
      sequence: '1',
      createdAt: '2026-04-20T10:00:09.000Z',
      turnId: 'same-timestamp-turn',
    },
  ],
});
assert.deepEqual(
  sameTimestampTurnMessages.map((message) => message.role),
  ['user', 'assistant'],
  'projection refresh must keep user prompts before assistant replies for the same turn even when event timestamps are identical',
);

const completedToolArgumentProjectedMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: 'coding-session-1',
  existingMessages: [],
  idPrefix: 'refreshed',
  events: [
    {
      id: 'completed-tool-call',
      codingSessionId: 'coding-session-1',
      kind: 'tool.call.requested',
      payload: {
        toolCallId: 'tool-run-tests',
        toolName: 'run_command',
        toolArguments: JSON.stringify({
          command: 'pnpm test',
          status: 'completed',
          exitCode: 0,
          requiresApproval: true,
          output: 'ok',
        }),
      },
      sequence: '1',
      createdAt: '2026-04-20T10:00:10.000Z',
      turnId: 'completed-tool-turn',
    },
    {
      id: 'completed-tool-assistant-message',
      codingSessionId: 'coding-session-1',
      kind: 'message.completed',
      payload: {
        role: 'assistant',
        content: 'Tests passed.',
      },
      sequence: '2',
      createdAt: '2026-04-20T10:00:11.000Z',
      turnId: 'completed-tool-turn',
    },
  ],
});
assert.deepEqual(
  completedToolArgumentProjectedMessages.map((message) => message.commands),
  [
    [
      {
        command: 'pnpm test',
        status: 'success',
        output: 'ok',
        kind: 'command',
        toolName: 'run_command',
        toolCallId: 'tool-run-tests',
        runtimeStatus: 'completed',
        requiresApproval: false,
        requiresReply: false,
      },
    ],
  ],
  'projection refresh must use completed command_execution status and output from canonical tool arguments instead of showing an endless running command',
);

const objectToolArgumentProjectedMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: 'coding-session-1',
  existingMessages: [],
  idPrefix: 'refreshed',
  events: [
    {
      id: 'object-tool-call-with-long-argument',
      codingSessionId: 'coding-session-1',
      kind: 'tool.call.requested',
      payload: {
        toolCallId: 'tool-long-object-argument',
        toolName: 'run_command',
        toolArguments: {
          command: 'inspect ticket',
          requestId: 101777208078558061n,
          status: 'completed',
        },
      },
      sequence: '1',
      createdAt: '2026-04-20T10:00:10.500Z',
      turnId: 'object-tool-argument-turn',
    },
    {
      id: 'object-tool-argument-assistant-message',
      codingSessionId: 'coding-session-1',
      kind: 'message.completed',
      payload: {
        role: 'assistant',
        content: 'Ticket inspected.',
      },
      sequence: '2',
      createdAt: '2026-04-20T10:00:10.750Z',
      turnId: 'object-tool-argument-turn',
    },
  ],
});
assert.equal(
  objectToolArgumentProjectedMessages[0]?.commands?.[0]?.output,
  '{"command":"inspect ticket","requestId":"101777208078558061","status":"completed"}',
  'projection command output must serialize object toolArguments through the shared BirdCoder JSON codec so Long ids do not crash or round.',
);

const userQuestionProjectedMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: 'coding-session-1',
  existingMessages: [],
  idPrefix: 'refreshed',
  events: [
    {
      id: 'user-question-tool-call',
      codingSessionId: 'coding-session-1',
      kind: 'tool.call.requested',
      payload: {
        toolCallId: 'tool-user-question',
        toolName: 'question',
        toolArguments: JSON.stringify({
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
      sequence: '1',
      createdAt: '2026-04-20T10:00:11.500Z',
      turnId: 'user-question-turn',
    },
    {
      id: 'user-question-assistant-message',
      codingSessionId: 'coding-session-1',
      kind: 'message.completed',
      payload: {
        role: 'assistant',
        content: 'I need one choice before continuing.',
      },
      sequence: '2',
      createdAt: '2026-04-20T10:00:11.600Z',
      turnId: 'user-question-turn',
    },
  ],
});
assert.equal(
  userQuestionProjectedMessages[0]?.commands?.[0]?.command,
  'Which tests should I run?',
  'projection refresh should render cross-engine user_question cards with the actual question instead of raw provider JSON',
);
assert.deepEqual(
  userQuestionProjectedMessages[0]?.commands?.[0],
  {
    command: 'Which tests should I run?',
    status: 'running',
    output: '{"questions":[{"header":"Test scope","question":"Which tests should I run?","options":[{"label":"Unit","description":"Run unit tests only"}]}]}',
    kind: 'user_question',
    toolName: 'user_question',
    toolCallId: 'tool-user-question',
    runtimeStatus: 'awaiting_user',
    requiresApproval: false,
    requiresReply: true,
  },
  'projection refresh must preserve user_question semantics so the IDE can render a reply card instead of a generic running command',
);

const answeredUserQuestionProjectedMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: 'coding-session-1',
  existingMessages: [],
  idPrefix: 'refreshed',
  events: [
    {
      id: 'answered-user-question-tool-call',
      codingSessionId: 'coding-session-1',
      kind: 'tool.call.requested',
      payload: {
        toolCallId: 'tool-user-question',
        toolName: 'question',
        toolArguments: JSON.stringify({
          requestId: 'question-request-1',
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
      sequence: '1',
      createdAt: '2026-04-20T10:00:11.500Z',
      turnId: 'answered-user-question-turn',
    },
    {
      id: 'answered-user-question-answer',
      codingSessionId: 'coding-session-1',
      kind: 'operation.updated',
      payload: {
        questionId: 'question-request-1',
        toolCallId: 'tool-user-question',
        answer: 'Unit',
      },
      sequence: '2',
      createdAt: '2026-04-20T10:00:11.550Z',
      turnId: 'answered-user-question-turn',
    },
    {
      id: 'answered-user-question-assistant-message',
      codingSessionId: 'coding-session-1',
      kind: 'message.completed',
      payload: {
        role: 'assistant',
        content: 'Continuing with unit tests.',
      },
      sequence: '3',
      createdAt: '2026-04-20T10:00:11.600Z',
      turnId: 'answered-user-question-turn',
    },
  ],
});
assert.deepEqual(
  answeredUserQuestionProjectedMessages[0]?.commands?.[0],
  {
    command: 'Which tests should I run?',
    status: 'success',
    output: 'Unit',
    kind: 'user_question',
    toolName: 'user_question',
    toolCallId: 'tool-user-question',
    runtimeStatus: 'awaiting_tool',
    requiresApproval: false,
    requiresReply: false,
  },
  'answered user_question operation updates must settle the existing question card instead of leaving it in Needs reply state',
);

const providerAliasAnsweredUserQuestionProjectedMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: 'coding-session-1',
  existingMessages: [],
  idPrefix: 'refreshed',
  events: [
    {
      id: 'provider-alias-user-question-tool-call',
      codingSessionId: 'coding-session-1',
      kind: 'tool.call.requested',
      payload: {
        callID: 'tool-provider-alias-question',
        toolName: 'question',
        toolArguments: JSON.stringify({
          requestID: 'question-provider-alias-1',
          questions: [
            {
              question: 'Use provider ID aliases?',
            },
          ],
        }),
      },
      sequence: '1',
      createdAt: '2026-04-20T10:00:11.500Z',
      turnId: 'provider-alias-user-question-turn',
    },
    {
      id: 'provider-alias-user-question-answer',
      codingSessionId: 'coding-session-1',
      kind: 'tool.call.completed',
      payload: {
        callID: 'tool-provider-alias-question',
        toolName: 'question',
        toolArguments: JSON.stringify({
          requestID: 'question-provider-alias-1',
          answer: 'Yes',
          status: 'completed',
        }),
      },
      sequence: '2',
      createdAt: '2026-04-20T10:00:11.550Z',
      turnId: 'provider-alias-user-question-turn',
    },
    {
      id: 'provider-alias-user-question-assistant-message',
      codingSessionId: 'coding-session-1',
      kind: 'message.completed',
      payload: {
        role: 'assistant',
        content: 'Continuing after the provider alias answer.',
      },
      sequence: '3',
      createdAt: '2026-04-20T10:00:11.600Z',
      turnId: 'provider-alias-user-question-turn',
    },
  ],
});
assert.deepEqual(
  providerAliasAnsweredUserQuestionProjectedMessages[0]?.commands,
  [
    {
      command: 'Use provider ID aliases?',
      status: 'success',
      output: 'Yes',
      kind: 'user_question',
      toolName: 'user_question',
      toolCallId: 'tool-provider-alias-question',
      runtimeStatus: 'awaiting_tool',
      requiresApproval: false,
      requiresReply: false,
    },
  ],
  'message projection must merge provider requestID/callID user_question lifecycle events into one settled reply card.',
);

const providerAliasOperationUpdatedUserQuestionProjectedMessages =
  mergeBirdCoderProjectionMessages({
    codingSessionId: 'coding-session-1',
    existingMessages: [],
    idPrefix: 'refreshed',
    events: [
      {
        id: 'provider-alias-operation-user-question-tool-call',
        codingSessionId: 'coding-session-1',
        kind: 'tool.call.requested',
        payload: {
          callID: 'tool-provider-alias-operation-question',
          toolName: 'question',
          toolArguments: JSON.stringify({
            requestID: 'question-provider-alias-operation-1',
            questions: [
              {
                question: 'Accept operation answer aliases?',
              },
            ],
          }),
        },
        sequence: '1',
        createdAt: '2026-04-20T10:00:11.500Z',
        turnId: 'provider-alias-operation-user-question-turn',
      },
      {
        id: 'provider-alias-operation-user-question-answer',
        codingSessionId: 'coding-session-1',
        kind: 'operation.updated',
        payload: {
          callID: 'tool-provider-alias-operation-question',
          toolName: 'question',
          toolArguments: JSON.stringify({
            requestID: 'question-provider-alias-operation-1',
            answer: 'Yes',
            runtimeStatus: 'awaiting_tool',
          }),
        },
        sequence: '2',
        createdAt: '2026-04-20T10:00:11.550Z',
        turnId: 'provider-alias-operation-user-question-turn',
      },
      {
        id: 'provider-alias-operation-user-question-assistant-message',
        codingSessionId: 'coding-session-1',
        kind: 'message.completed',
        payload: {
          role: 'assistant',
          content: 'Continuing after the operation answer.',
        },
        sequence: '3',
        createdAt: '2026-04-20T10:00:11.600Z',
        turnId: 'provider-alias-operation-user-question-turn',
      },
    ],
  });
assert.deepEqual(
  providerAliasOperationUpdatedUserQuestionProjectedMessages[0]?.commands,
  [
    {
      command: 'Accept operation answer aliases?',
      status: 'success',
      output: 'Yes',
      kind: 'user_question',
      toolName: 'user_question',
      toolCallId: 'tool-provider-alias-operation-question',
      runtimeStatus: 'awaiting_tool',
      requiresApproval: false,
      requiresReply: false,
    },
  ],
  'message projection must also merge operation.updated answers when answer and IDs are inside provider toolArguments.',
);

const permissionRequestProjectedMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: 'coding-session-1',
  existingMessages: [],
  idPrefix: 'refreshed',
  events: [
    {
      id: 'permission-request-tool-call',
      codingSessionId: 'coding-session-1',
      kind: 'tool.call.requested',
      payload: {
        toolCallId: 'tool-permission-request',
        toolName: 'approval_request',
        toolArguments: JSON.stringify({
          status: 'awaiting_approval',
          tool: 'edit_file',
          permission: 'write',
          patterns: ['src/**'],
        }),
      },
      sequence: '1',
      createdAt: '2026-04-20T10:00:11.700Z',
      turnId: 'permission-request-turn',
    },
    {
      id: 'permission-request-assistant-message',
      codingSessionId: 'coding-session-1',
      kind: 'message.completed',
      payload: {
        role: 'assistant',
        content: 'I need approval before editing files.',
      },
      sequence: '2',
      createdAt: '2026-04-20T10:00:11.800Z',
      turnId: 'permission-request-turn',
    },
  ],
});
assert.deepEqual(
  permissionRequestProjectedMessages[0]?.commands,
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
  'projection refresh should render cross-engine permission_request cards as readable approval prompts instead of raw provider JSON',
);

const permissionRequestFilePathAliasProjectedMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: 'coding-session-1',
  existingMessages: [],
  idPrefix: 'refreshed',
  events: [
    {
      id: 'permission-request-file-path-alias-tool-call',
      codingSessionId: 'coding-session-1',
      kind: 'tool.call.requested',
      payload: {
        toolCallId: 'tool-permission-file-path-alias',
        toolName: 'permission_request',
        toolArguments: JSON.stringify({
          status: 'awaiting_approval',
          request: {
            args: {
              file_path: 'src/App.tsx',
            },
          },
        }),
      },
      sequence: '1',
      createdAt: '2026-04-20T10:00:11.710Z',
      turnId: 'permission-request-file-path-alias-turn',
    },
    {
      id: 'permission-request-file-path-alias-assistant-message',
      codingSessionId: 'coding-session-1',
      kind: 'message.completed',
      payload: {
        role: 'assistant',
        content: 'I need approval before editing src/App.tsx.',
      },
      sequence: '2',
      createdAt: '2026-04-20T10:00:11.810Z',
      turnId: 'permission-request-file-path-alias-turn',
    },
  ],
});
assert.deepEqual(
  permissionRequestFilePathAliasProjectedMessages[0]?.commands,
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
  'projection refresh should use file_path aliases inside permission request args when rendering approval command text',
);

const approvedPermissionRequestProjectedMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: 'coding-session-1',
  existingMessages: [],
  idPrefix: 'refreshed',
  events: [
    {
      id: 'approved-permission-request-tool-call',
      codingSessionId: 'coding-session-1',
      kind: 'tool.call.requested',
      payload: {
        toolCallId: 'tool-permission-request',
        toolName: 'approval_request',
        toolArguments: JSON.stringify({
          status: 'awaiting_approval',
          tool: 'edit_file',
          permission: 'write',
          patterns: ['src/**'],
        }),
      },
      sequence: '1',
      createdAt: '2026-04-20T10:00:11.700Z',
      turnId: 'approved-permission-request-turn',
    },
    {
      id: 'approved-permission-request-update',
      codingSessionId: 'coding-session-1',
      kind: 'tool.call.progress',
      payload: {
        toolCallId: 'tool-permission-request',
        toolName: 'permission_request',
        toolArguments: JSON.stringify({
          status: 'approved',
          tool: 'edit_file',
          permission: 'write',
          patterns: ['src/**'],
        }),
      },
      sequence: '2',
      createdAt: '2026-04-20T10:00:11.750Z',
      turnId: 'approved-permission-request-turn',
    },
    {
      id: 'approved-permission-request-assistant-message',
      codingSessionId: 'coding-session-1',
      kind: 'message.completed',
      payload: {
        role: 'assistant',
        content: 'Continuing after approval.',
      },
      sequence: '3',
      createdAt: '2026-04-20T10:00:11.800Z',
      turnId: 'approved-permission-request-turn',
    },
  ],
});
assert.deepEqual(
  approvedPermissionRequestProjectedMessages[0]?.commands,
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
  'projection refresh must settle approved permission_request updates instead of leaving stale Needs approval UI state',
);

const canonicalFileArtifactProjectedMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: 'coding-session-1',
  existingMessages: [],
  idPrefix: 'refreshed',
  events: [
    {
      id: 'file-edit-tool-call',
      codingSessionId: 'coding-session-1',
      kind: 'tool.call.requested',
      payload: {
        toolCallId: 'tool-edit-app',
        toolName: 'edit_file',
        toolArguments: JSON.stringify({
          path: 'src/App.tsx',
          originalContent: 'export const answer = 41;\n',
          content: 'export const answer = 42;\nexport const label = "done";\n',
        }),
      },
      sequence: '1',
      createdAt: '2026-04-20T10:00:12.000Z',
      turnId: 'file-edit-turn',
    },
    {
      id: 'file-edit-artifact',
      codingSessionId: 'coding-session-1',
      kind: 'artifact.upserted',
      payload: {
        toolCallId: 'tool-edit-app',
        toolName: 'edit_file',
        artifactKind: 'patch',
        artifactTitle: 'edit_file:tool-edit-app',
        toolArguments: JSON.stringify({
          path: 'src/App.tsx',
          originalContent: 'export const answer = 41;\n',
          content: 'export const answer = 42;\nexport const label = "done";\n',
        }),
      },
      sequence: '2',
      createdAt: '2026-04-20T10:00:13.000Z',
      turnId: 'file-edit-turn',
    },
    {
      id: 'file-edit-assistant-message',
      codingSessionId: 'coding-session-1',
      kind: 'message.completed',
      payload: {
        role: 'assistant',
        content: 'Updated src/App.tsx.',
      },
      sequence: '3',
      createdAt: '2026-04-20T10:00:14.000Z',
      turnId: 'file-edit-turn',
    },
  ],
});
assert.deepEqual(
  canonicalFileArtifactProjectedMessages.map((message) => ({
    content: message.content,
    fileChanges: message.fileChanges,
  })),
  [
    {
      content: 'Updated src/App.tsx.',
      fileChanges: [
        {
          path: 'src/App.tsx',
          additions: 2,
          deletions: 1,
          content: 'export const answer = 42;\nexport const label = "done";\n',
          originalContent: 'export const answer = 41;\n',
        },
      ],
    },
  ],
  'projection refresh must fold canonical file artifacts into assistant message fileChanges so patch/restore UI works across engines',
);

const codexMultiFilePatchProjectedMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: 'coding-session-1',
  existingMessages: [],
  idPrefix: 'refreshed',
  events: [
    {
      id: 'codex-multi-file-patch',
      codingSessionId: 'coding-session-1',
      kind: 'artifact.upserted',
      payload: {
        toolCallId: 'tool-codex-patch',
        toolName: 'apply_patch',
        artifactKind: 'patch',
        toolArguments: JSON.stringify({
          changes: [
            {
              path: 'src/App.tsx',
              diff: '--- a/src/App.tsx\n+++ b/src/App.tsx\n@@\n-export const answer = 41;\n+export const answer = 42;\n',
            },
            {
              path: 'src/index.ts',
              diff: '--- a/src/index.ts\n+++ b/src/index.ts\n@@\n+export * from "./App";\n',
            },
          ],
        }),
      },
      sequence: '1',
      createdAt: '2026-04-20T10:00:15.000Z',
      turnId: 'codex-multi-file-turn',
    },
    {
      id: 'codex-multi-file-assistant-message',
      codingSessionId: 'coding-session-1',
      kind: 'message.completed',
      payload: {
        role: 'assistant',
        content: 'Updated two files.',
      },
      sequence: '2',
      createdAt: '2026-04-20T10:00:16.000Z',
      turnId: 'codex-multi-file-turn',
    },
  ],
});
assert.deepEqual(
  codexMultiFilePatchProjectedMessages[0]?.fileChanges,
  [
    {
      path: 'src/App.tsx',
      additions: 1,
      deletions: 1,
    },
    {
      path: 'src/index.ts',
      additions: 1,
      deletions: 0,
    },
  ],
  'projection refresh must expand canonical changes[] patch payloads into multiple fileChanges for multi-file code engine edits',
);
const codexMultiFilePatchCommandMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: 'coding-session-1',
  existingMessages: [],
  idPrefix: 'refreshed',
  events: [
    {
      id: 'codex-multi-file-patch-command',
      codingSessionId: 'coding-session-1',
      kind: 'tool.call.requested',
      payload: {
        toolCallId: 'tool-codex-patch-command',
        toolName: 'apply_patch',
        toolArguments: JSON.stringify({
          changes: [
            { path: 'src/App.tsx', diff: '+answer\n' },
            { path: 'src/index.ts', diff: '+export\n' },
          ],
        }),
      },
      sequence: '1',
      createdAt: '2026-04-20T10:00:17.000Z',
      turnId: 'codex-multi-file-command-turn',
    },
    {
      id: 'codex-multi-file-command-assistant-message',
      codingSessionId: 'coding-session-1',
      kind: 'message.completed',
      payload: {
        role: 'assistant',
        content: 'Prepared a patch.',
      },
      sequence: '2',
      createdAt: '2026-04-20T10:00:18.000Z',
      turnId: 'codex-multi-file-command-turn',
    },
  ],
});
assert.equal(
  codexMultiFilePatchCommandMessages[0]?.commands?.[0]?.command,
  'apply_patch: src/App.tsx, src/index.ts',
  'projection refresh should render changes[] patch command cards as concise file lists instead of raw provider JSON',
);

const dialectFileChangeAliasProjectedMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: 'coding-session-1',
  existingMessages: [],
  idPrefix: 'refreshed',
  events: [
    {
      id: 'dialect-file-change-alias-command',
      codingSessionId: 'coding-session-1',
      kind: 'tool.call.requested',
      payload: {
        toolCallId: 'tool-dialect-file-change-alias',
        toolName: 'str-replace-editor',
        toolArguments: JSON.stringify({
          path: 'src/Alias.ts',
          oldContent: 'export const value = 1;\n',
          newContent: 'export const value = 2;\n',
        }),
      },
      sequence: '1',
      createdAt: '2026-04-20T10:00:19.000Z',
      turnId: 'dialect-file-change-alias-turn',
    },
    {
      id: 'dialect-file-change-alias-assistant-message',
      codingSessionId: 'coding-session-1',
      kind: 'message.completed',
      payload: {
        role: 'assistant',
        content: 'Updated alias file.',
      },
      sequence: '2',
      createdAt: '2026-04-20T10:00:20.000Z',
      turnId: 'dialect-file-change-alias-turn',
    },
  ],
});
assert.deepEqual(
  dialectFileChangeAliasProjectedMessages[0]?.fileChanges,
  [
    {
      path: 'src/Alias.ts',
      additions: 1,
      deletions: 1,
      content: 'export const value = 2;\n',
      originalContent: 'export const value = 1;\n',
    },
  ],
  'projection refresh must derive fileChanges from shared file_change aliases such as str-replace-editor, not from a local tool-name set',
);

const richReplaySession: BirdCoderCodingSession = {
  id: 'coding-session-rich-replay',
  workspaceId: 'workspace-rich-replay',
  projectId: 'project-rich-replay',
  title: 'Rich replay session',
  status: 'active',
  hostMode: 'desktop',
  engineId: 'codex',
  modelId: 'gpt-5-codex',
  runtimeStatus: 'completed',
  createdAt: '2026-04-20T10:01:00.000Z',
  updatedAt: '2026-04-20T10:01:02.000Z',
  lastTurnAt: '2026-04-20T10:01:02.000Z',
  displayTime: 'Just now',
  messages: [
    {
      id: 'rich-replay-user-message',
      codingSessionId: 'coding-session-rich-replay',
      turnId: 'rich-replay-turn',
      role: 'user',
      content: 'Update the app.',
      createdAt: '2026-04-20T10:01:00.000Z',
    },
    {
      id: 'rich-replay-assistant-message',
      codingSessionId: 'coding-session-rich-replay',
      turnId: 'rich-replay-turn',
      role: 'assistant',
      content: 'Updated the app and ran checks.',
      createdAt: '2026-04-20T10:01:02.000Z',
      commands: [
        {
          command: 'pnpm test',
          status: 'success',
          output: 'ok',
        },
      ],
      tool_calls: [
        {
          id: 'rich-replay-tool-call',
          type: 'function',
          function: {
            name: 'run_command',
            arguments: '{"command":"pnpm test"}',
          },
        },
      ],
      fileChanges: [
        {
          path: 'src/App.tsx',
          additions: 1,
          deletions: 1,
          content: 'export const answer = 42;\n',
          originalContent: 'export const answer = 41;\n',
        },
      ],
      taskProgress: {
        total: 2,
        completed: 2,
      },
    },
    {
      id: 'rich-replay-tool-message',
      codingSessionId: 'coding-session-rich-replay',
      turnId: 'rich-replay-turn',
      role: 'tool',
      content: 'ok',
      createdAt: '2026-04-20T10:01:03.000Z',
      tool_call_id: 'rich-replay-tool-call',
    },
  ],
};
const richReplayProject: BirdCoderProject = {
  id: 'project-rich-replay',
  workspaceId: 'workspace-rich-replay',
  name: 'Rich replay project',
  createdAt: '2026-04-20T10:00:00.000Z',
  updatedAt: '2026-04-20T10:01:02.000Z',
  codingSessions: [richReplaySession],
};
const richReplayCoreReadClient = createBirdCoderGeneratedCoreReadApiClient({
  transport: createBirdCoderInProcessCoreApiTransport({
    projectService: {
      async getProjectById(projectId: string) {
        return projectId === richReplayProject.id ? richReplayProject : null;
      },
      async getProjects() {
        return [richReplayProject];
      },
    } as never,
  }),
});
const richReplayEvents = await richReplayCoreReadClient.listCodingSessionEvents(
  richReplaySession.id,
);
const richReplayAssistantEvent = richReplayEvents.find(
  (event) => event.kind === 'message.completed' && event.payload.role === 'assistant',
);
assert.equal(
  typeof richReplayAssistantEvent?.payload.commandsJson,
  'string',
  'in-process core replay should preserve command payloads on message.completed events',
);
assert.equal(
  typeof richReplayAssistantEvent?.payload.fileChangesJson,
  'string',
  'in-process core replay should preserve fileChanges payloads on message.completed events so all engine sessions render the same file cards',
);
assert.equal(
  typeof richReplayAssistantEvent?.payload.taskProgressJson,
  'string',
  'in-process core replay should preserve taskProgress payloads on message.completed events so planner/reviewer progress survives refresh',
);
assert.equal(
  typeof richReplayAssistantEvent?.payload.toolCallsJson,
  'string',
  'in-process core replay should preserve assistant tool_calls on message.completed events for OpenAI-compatible history adapters',
);
const richReplayToolEvent = richReplayEvents.find(
  (event) => event.kind === 'message.completed' && event.payload.role === 'tool',
);
assert.equal(
  richReplayToolEvent?.payload.toolCallId,
  'rich-replay-tool-call',
  'in-process core replay should preserve tool_call_id on tool messages so tool responses can be matched to assistant requests',
);
const richReplayProjectedMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: richReplaySession.id,
  existingMessages: [],
  idPrefix: 'refreshed',
  events: richReplayEvents,
});
assert.deepEqual(
  richReplayProjectedMessages.find((message) => message.role === 'assistant')?.fileChanges,
  richReplaySession.messages[1]?.fileChanges,
  'projecting in-process core replay events should restore assistant fileChanges exactly',
);
assert.deepEqual(
  richReplayProjectedMessages.find((message) => message.role === 'assistant')?.taskProgress,
  richReplaySession.messages[1]?.taskProgress,
  'projecting in-process core replay events should restore assistant taskProgress exactly',
);
assert.deepEqual(
  richReplayProjectedMessages.find((message) => message.role === 'assistant')?.tool_calls,
  richReplaySession.messages[1]?.tool_calls,
  'projecting in-process core replay events should restore assistant tool_calls exactly',
);
assert.equal(
  richReplayProjectedMessages.find((message) => message.role === 'tool')?.tool_call_id,
  'rich-replay-tool-call',
  'projecting in-process core replay events should restore tool_call_id exactly',
);

const richReplayNativeSession = await richReplayCoreReadClient.getNativeSession(
  richReplaySession.id,
);
const richReplayNativeAssistantMessage = richReplayNativeSession.messages.find(
  (message) => message.role === 'assistant',
) as BirdCoderChatMessage | undefined;
const richReplayNativeToolMessage = richReplayNativeSession.messages.find(
  (message) => message.role === 'tool',
) as BirdCoderChatMessage | undefined;
assert.deepEqual(
  richReplayNativeAssistantMessage?.fileChanges,
  richReplaySession.messages[1]?.fileChanges,
  'native session detail should preserve assistant fileChanges so cross-engine history refresh keeps file cards',
);
assert.deepEqual(
  richReplayNativeAssistantMessage?.taskProgress,
  richReplaySession.messages[1]?.taskProgress,
  'native session detail should preserve assistant taskProgress so progress UI survives session reload',
);
assert.deepEqual(
  richReplayNativeAssistantMessage?.tool_calls,
  richReplaySession.messages[1]?.tool_calls,
  'native session detail should preserve assistant tool_calls for OpenAI-compatible history adapters',
);
assert.equal(
  richReplayNativeToolMessage?.tool_call_id,
  'rich-replay-tool-call',
  'native session detail should preserve tool_call_id so tool responses remain matched after refresh',
);

const authorityBackedNativeRecord = await readAuthorityBackedNativeSessionRecord(
  richReplaySession.id,
  {
    coreReadService: {
      async getNativeSession() {
        return richReplayNativeSession;
      },
      async listNativeSessions() {
        return [];
      },
    },
  },
);
const authorityBackedNativeAssistantMessage = authorityBackedNativeRecord?.messages.find(
  (message) => message.role === 'assistant',
);
const authorityBackedNativeToolMessage = authorityBackedNativeRecord?.messages.find(
  (message) => message.role === 'tool',
);
assert.deepEqual(
  authorityBackedNativeAssistantMessage?.fileChanges,
  richReplaySession.messages[1]?.fileChanges,
  'authority-backed native session adapter must preserve fileChanges from native detail messages',
);
assert.deepEqual(
  authorityBackedNativeAssistantMessage?.taskProgress,
  richReplaySession.messages[1]?.taskProgress,
  'authority-backed native session adapter must preserve taskProgress from native detail messages',
);
assert.deepEqual(
  authorityBackedNativeAssistantMessage?.tool_calls,
  richReplaySession.messages[1]?.tool_calls,
  'authority-backed native session adapter must preserve assistant tool_calls from native detail messages',
);
assert.equal(
  authorityBackedNativeToolMessage?.tool_call_id,
  'rich-replay-tool-call',
  'authority-backed native session adapter must preserve tool_call_id from native tool messages',
);

const useProjectsSource = await readFile(
  resolve('packages/sdkwork-birdcoder-commons/src/hooks/useProjects.ts'),
  'utf8',
);
const sessionRefreshSource = await readFile(
  resolve('packages/sdkwork-birdcoder-commons/src/workbench/sessionRefresh.ts'),
  'utf8',
);
const apiBackedProjectServiceSource = await readFile(
  resolve('packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts'),
  'utf8',
);
const projectionSource = await readFile(
  resolve('packages/sdkwork-birdcoder-infrastructure/src/services/codingSessionMessageProjection.ts'),
  'utf8',
);

assert.match(
  useProjectsSource,
  /areBirdCoderChatMessagesEquivalent/,
  'projects store synchronization should use the shared chat-message equivalence helper',
);

assert.match(
  sessionRefreshSource,
  /areBirdCoderChatMessagesEquivalent/,
  'session refresh synchronization should use the shared chat-message equivalence helper',
);

assert.match(
  useProjectsSource,
  /areBirdCoderChatMessagesLogicallyMatched/,
  'projects store message upsert logic should use the shared logical message matcher instead of a local duplicate rule',
);

assert.match(
  apiBackedProjectServiceSource,
  /areBirdCoderChatMessagesLogicallyMatched/,
  'API-backed project service should use the shared logical message matcher instead of its own duplicate rule',
);

assert.match(
  projectionSource,
  /buildBirdCoderChatMessageLogicalMatchKey/,
  'projection message merge should derive logical match keys from the shared helper so store and authority stay aligned',
);

console.log('coding session message synchronization contract passed');
