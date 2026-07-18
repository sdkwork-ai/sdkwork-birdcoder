import assert from 'node:assert/strict';

import {
  projectChatMessageToolCall,
  projectChatMessageToolCalls,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-tool-calls.ts';
import { resolveChatMessageView } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-view.ts';

const structuredToolCall = projectChatMessageToolCall(
  {
    id: 'call-1',
    type: 'function',
    function: {
      name: 'bash',
      arguments: '{"command":"pnpm run typecheck"}',
    },
  },
  0,
);
assert.deepEqual(structuredToolCall, {
  id: 'call-1',
  type: 'function',
  name: 'bash',
  arguments: '{"command":"pnpm run typecheck"}',
});

const projectedToolCalls = projectChatMessageToolCalls([
  structuredToolCall,
  'raw tool output',
]);
assert.equal(projectedToolCalls.length, 2);
assert.equal(projectedToolCalls[1]?.name, 'tool');
assert.equal(projectedToolCalls[1]?.arguments, 'raw tool output');

const toolCallView = resolveChatMessageView({
  id: 'msg-tool-1',
  codingSessionId: 'session-1',
  role: 'assistant',
  content: '',
  createdAt: '2026-06-22T00:00:02.000Z',
  tool_calls: [
    {
      id: 'call-2',
      function: {
        name: 'read',
        arguments: '{"path":"src/index.ts"}',
      },
    },
  ],
});
const toolCallBlock = toolCallView.blocks.find((block) => block.type === 'tool-calls');
assert.ok(toolCallBlock && toolCallBlock.type === 'tool-calls');
assert.equal(toolCallBlock.calls.length, 1);
assert.equal(toolCallBlock.calls[0]?.name, 'read');

assert.equal(projectChatMessageToolCall({}, 0), null);
assert.equal(projectChatMessageToolCall({ type: 'function' }, 0), null);

console.log('chat message tool calls contract passed.');
