import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  areBirdCoderChatMessagesEquivalent,
  areBirdCoderChatMessagesLogicallyMatched,
  mergeBirdCoderComparableChatMessages,
  type BirdCoderChatMessage,
} from '../packages/sdkwork-birdcoder-types/src/index.ts';

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
