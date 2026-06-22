import assert from 'node:assert/strict';

import {
  resolveChatMessageView,
  type ChatMessageViewSource,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/chat-message-view.ts';
import {
  resolveMessageCopyContent,
  resolveProjectedActivityFileChanges,
  resolveVisibleAssistantMessageContent,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/chat-message-activity-projection.ts';
import { resolveTaskProgressDisplayState } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/chat-message-task-progress.ts';

const headerOnlyActivityMessage: ChatMessageViewSource = {
  id: 'msg-assistant-header',
  codingSessionId: 'session-1',
  role: 'assistant',
  content: 'Updated the following files:',
  createdAt: '2026-06-22T00:00:01.000Z',
  fileChanges: [
    {
      path: 'src/example.ts',
      additions: 3,
      deletions: 1,
    },
  ],
};

assert.equal(
  resolveVisibleAssistantMessageContent(headerOnlyActivityMessage),
  '',
  'header-only activity messages must not expose duplicate raw tool summary text.',
);

assert.equal(
  resolveMessageCopyContent(headerOnlyActivityMessage),
  '',
  'copy projection must omit hidden tool summary prose.',
);

const parsedSummaryMessage: ChatMessageViewSource = {
  id: 'msg-assistant-parsed',
  codingSessionId: 'session-1',
  role: 'assistant',
  content: [
    'Here is the plan.',
    '',
    'Updated the following files:',
    'M src/example.ts',
  ].join('\n'),
  createdAt: '2026-06-22T00:00:02.000Z',
};

assert.equal(
  resolveVisibleAssistantMessageContent(parsedSummaryMessage),
  'Here is the plan.',
  'surrounding assistant prose must remain visible after stripping parsed file summaries.',
);

assert.equal(
  resolveProjectedActivityFileChanges(parsedSummaryMessage).length,
  1,
  'parsed file summaries must become structured activity file changes.',
);

const parsedOnlyView = resolveChatMessageView(parsedSummaryMessage);
assert.equal(parsedOnlyView.blocks.some((block) => block.type === 'activity'), true);
assert.equal(
  parsedOnlyView.blocks.some((block) => block.type === 'markdown' && block.content === 'Here is the plan.'),
  true,
);

assert.equal(
  resolveTaskProgressDisplayState({ total: '4', completed: '2' })?.percent,
  50,
  'task progress normalization must accept string counters from native engine payloads.',
);

assert.equal(
  resolveTaskProgressDisplayState({ total: Number.NaN, completed: 1 }),
  null,
  'task progress blocks must be omitted when counters are non-finite.',
);

const invalidProgressView = resolveChatMessageView({
  id: 'msg-assistant-invalid-progress',
  codingSessionId: 'session-1',
  role: 'assistant',
  content: 'working',
  createdAt: '2026-06-22T00:00:03.000Z',
  taskProgress: {
    total: Number.NaN,
    completed: 1,
  },
});
assert.equal(
  invalidProgressView.blocks.some((block) => block.type === 'task-progress'),
  false,
);

console.log('chat message projection contract passed.');
