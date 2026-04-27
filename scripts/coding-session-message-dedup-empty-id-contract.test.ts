import assert from 'node:assert/strict';
import {
  areBirdCoderChatMessagesLogicallyMatched,
  deduplicateBirdCoderComparableChatMessages,
  type BirdCoderChatMessage,
} from '../packages/sdkwork-birdcoder-types/src/index.ts';

const emptyIdUserMessage: BirdCoderChatMessage = {
  id: '',
  codingSessionId: 'session-empty-id',
  role: 'user',
  content: 'First message without a provider id.',
  createdAt: '2026-04-27T02:00:00.000Z',
};
const emptyIdAssistantMessage: BirdCoderChatMessage = {
  id: '',
  codingSessionId: 'session-empty-id',
  role: 'assistant',
  content: 'Second message without a provider id.',
  createdAt: '2026-04-27T02:00:01.000Z',
};
const repeatedEmptyIdUserMessage: BirdCoderChatMessage = {
  ...emptyIdUserMessage,
  commands: [
    {
      command: 'echo merged',
      status: 'success',
    },
  ],
};

assert.equal(
  areBirdCoderChatMessagesLogicallyMatched(
    emptyIdUserMessage,
    emptyIdAssistantMessage,
  ),
  false,
  'blank provider message ids must not logically match unrelated messages in the same session.',
);

const deduplicatedMessages = deduplicateBirdCoderComparableChatMessages([
  emptyIdUserMessage,
  emptyIdAssistantMessage,
  repeatedEmptyIdUserMessage,
]);
const longMetadataMessages = deduplicateBirdCoderComparableChatMessages([
  {
    ...emptyIdUserMessage,
    id: 'message-with-long-metadata',
    metadata: {
      requestId: 101777208078558063n,
    },
  },
  {
    ...emptyIdAssistantMessage,
    id: 'message-without-long-metadata',
  },
]);

assert.deepEqual(
  deduplicatedMessages.map((message) => ({
    role: message.role,
    content: message.content,
    commands: message.commands,
  })),
  [
    {
      role: 'user',
      content: 'First message without a provider id.',
      commands: [
        {
          command: 'echo merged',
          status: 'success',
        },
      ],
    },
    {
      role: 'assistant',
      content: 'Second message without a provider id.',
      commands: undefined,
    },
  ],
  'deduplication may merge exact blank-id duplicates, but must not collapse distinct blank-id transcript rows.',
);
assert.equal(
  longMetadataMessages.length,
  2,
  'message deduplication signatures must serialize metadata through a Long-safe path so provider-native bigint metadata cannot crash session synchronization.',
);

console.log('coding session message dedup empty id contract passed.');
