import assert from 'node:assert/strict';

import {
  buildAgentSessionItemPresentationSynchronizationSignature,
  resolveAgentSessionItemPresentation,
  type AgentSessionItemViewSource,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-presentation.ts';

const userMessage: AgentSessionItemViewSource = {
  id: 'msg-user-1',
  agentSessionId: 'session-1',
  role: 'user',
  content: 'Build a chat message registry',
  createdAt: '2026-06-22T00:00:00.000Z',
};

const activityMessage: AgentSessionItemViewSource = {
  id: 'msg-assistant-1',
  agentSessionId: 'session-1',
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

const userView = resolveAgentSessionItemPresentation(userMessage);
assert.equal(userView.kind, 'user.text');
assert.equal(userView.blocks.some((block) => block.type === 'markdown'), true);

const activityView = resolveAgentSessionItemPresentation(activityMessage, { engineId: 'codex' });
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

const signature = buildAgentSessionItemPresentationSynchronizationSignature(activityView);
assert.match(signature, /assistant\.activity/);

const mixedFileActivityView = resolveAgentSessionItemPresentation({
  ...activityMessage,
  id: 'msg-assistant-mixed-file-tools',
  tool_calls: [
    {
      id: 'read-file-call',
      type: 'function',
      name: 'read_file',
      arguments: JSON.stringify({ path: 'src/chat/messages/registry.ts' }),
      status: 'completed',
    },
    {
      id: 'edit-file-call',
      type: 'function',
      name: 'apply_patch',
      arguments: JSON.stringify({ path: 'src/chat/messages/registry.ts' }),
      status: 'completed',
    },
  ],
}, { engineId: 'codex' });
const mixedFileToolBlock = mixedFileActivityView.blocks.find((block) => block.type === 'tool-calls');
assert.ok(mixedFileToolBlock && mixedFileToolBlock.type === 'tool-calls');
assert.deepEqual(
  mixedFileToolBlock.calls.map((call) => call.name),
  ['read_file'],
  'File reads must remain visible when a separate file-change row deduplicates mutations.',
);

const detailedTaskProgressView = resolveAgentSessionItemPresentation({
  id: 'msg-assistant-detailed-task-progress',
  agentSessionId: 'session-1',
  role: 'assistant',
  content: '',
  createdAt: '2026-06-22T00:00:02.000Z',
  taskProgress: {
    total: 2,
    completed: 1,
  },
  tool_calls: [{
    id: 'todo-codex-detailed',
    type: 'todo_list',
    items: [
      { text: 'Inspect Codex messages', completed: true },
      { text: 'Align Claude messages', completed: false },
    ],
  }],
}, { engineId: 'codex' });
const detailedTaskProgressBlock = detailedTaskProgressView.blocks.find(
  (block) => block.type === 'task-progress',
);
const detailedTaskToolBlock = detailedTaskProgressView.blocks.find(
  (block) => block.type === 'tool-calls',
);
assert.deepEqual(
  detailedTaskProgressBlock,
  {
    type: 'task-progress',
    progress: {
      total: 2,
      completed: 1,
    },
  },
  'Provider-neutral task progress must preserve its compact completion summary.',
);
assert.ok(detailedTaskToolBlock && detailedTaskToolBlock.type === 'tool-calls');
assert.deepEqual(
  detailedTaskToolBlock.calls[0]?.resultBlocks,
  [{
    type: 'list',
    items: ['[x] Inspect Codex messages', '[ ] Align Claude messages'],
  }],
  'A compact task-progress counter must not discard the provider task checklist or its text.',
);

const geminiDetailedTaskProgressView = resolveAgentSessionItemPresentation({
  id: 'msg-assistant-gemini-detailed-task-progress',
  agentSessionId: 'session-1',
  role: 'assistant',
  content: '',
  createdAt: '2026-06-22T00:00:03.000Z',
  taskProgress: {
    total: 2,
    completed: 1,
  },
  tool_calls: [{
    id: 'todo-gemini-detailed',
    name: 'write_todos',
    args: { source: 'gemini' },
    status: 'success',
    resultDisplay: {
      todos: [
        { description: 'Inspect Gemini messages', status: 'completed' },
        { description: 'Align shared rendering', status: 'in_progress' },
      ],
    },
  }],
}, { engineId: 'gemini' });
const geminiDetailedTaskToolBlock = geminiDetailedTaskProgressView.blocks.find(
  (block) => block.type === 'tool-calls',
);
assert.ok(geminiDetailedTaskToolBlock && geminiDetailedTaskToolBlock.type === 'tool-calls');
assert.deepEqual(
  geminiDetailedTaskToolBlock.calls[0]?.resultBlocks,
  [{
    type: 'list',
    items: ['[x] Inspect Gemini messages', '[~] Align shared rendering'],
  }],
  'Gemini resultDisplay.todos must survive alongside its normalized progress counter.',
);

console.log('chat message view contract passed.');
