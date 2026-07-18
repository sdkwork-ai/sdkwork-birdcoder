import assert from 'node:assert/strict';

import {
  buildChatMessageViewSynchronizationSignature,
  resolveChatMessageView,
  type ChatMessageViewSource,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-view.ts';

const userMessage: ChatMessageViewSource = {
  id: 'msg-user-1',
  codingSessionId: 'session-1',
  role: 'user',
  content: 'Build a chat message registry',
  createdAt: '2026-06-22T00:00:00.000Z',
};

const activityMessage: ChatMessageViewSource = {
  id: 'msg-assistant-1',
  codingSessionId: 'session-1',
  role: 'assistant',
  content: 'Updated the following files:',
  createdAt: '2026-06-22T00:00:01.000Z',
  fileChanges: [
    {
      path: 'src/chat/messages/registry.ts',
      additions: 42,
      deletions: 0,
    },
  ],
  commands: [
    {
      command: 'pnpm run typecheck',
      status: 'success',
    },
  ],
};

const userView = resolveChatMessageView(userMessage);
assert.equal(userView.kind, 'user.text');
assert.equal(userView.blocks.some((block) => block.type === 'markdown'), true);

const activityView = resolveChatMessageView(activityMessage, { engineId: 'codex' });
assert.equal(activityView.kind, 'assistant.activity');
assert.equal(activityView.engineId, 'codex');
assert.equal(activityView.blocks.some((block) => block.type === 'activity'), true);
assert.equal(activityView.blocks.some((block) => block.type === 'file-changes'), false);
assert.equal(activityView.blocks.some((block) => block.type === 'commands'), false);
assert.equal(activityView.blocks.some((block) => block.type === 'markdown'), false);
assert.ok(activityView.layoutHints.estimatedHeight > 0);

const activityBlock = activityView.blocks.find((block) => block.type === 'activity');
assert.ok(activityBlock && activityBlock.type === 'activity');
assert.equal(activityBlock.fileChanges.length, 1);
assert.equal(activityBlock.commands.length, 1);

const signature = buildChatMessageViewSynchronizationSignature(activityView);
assert.match(signature, /assistant\.activity/);

console.log('chat message view contract passed.');
