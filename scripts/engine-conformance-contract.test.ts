import assert from 'node:assert/strict';

import type { ChatMessage } from '../packages/sdkwork-birdcoder-chat/src/types.ts';
import { createChatEngineById } from '../packages/sdkwork-birdcoder-codeengine/src/engines.ts';
import { listWorkbenchCliEngines } from '../packages/sdkwork-birdcoder-codeengine/src/kernel.ts';
import { withMockCodexCliJsonl } from './test-support/mockCodexCli.ts';

const messages: ChatMessage[] = [
  {
    id: 'msg-user-1',
    role: 'user',
    content: 'Review the current workspace and propose the next code change.',
    timestamp: Date.now(),
  },
];

for (const engine of listWorkbenchCliEngines()) {
  const runtime = createChatEngineById(engine.id);

  assert.equal(typeof runtime.sendMessage, 'function');
  assert.equal(typeof runtime.sendMessageStream, 'function');

  const chunks = [];
  const exerciseRuntime = async () => {
    const response = await runtime.sendMessage(messages, {
      model: engine.defaultModelId,
      context: {
        workspaceRoot: 'D:/workspace',
      },
    });

    assert.equal(response.object, 'chat.completion');
    assert.equal(response.model, engine.defaultModelId);
    assert.ok(response.id.length > 0);
    assert.equal(response.choices.length > 0, true);
    assert.equal(response.choices[0]?.message.role, 'assistant');
    assert.ok(response.choices[0]?.message.content.length > 0);

    for await (const chunk of runtime.sendMessageStream(messages, {
      model: engine.defaultModelId,
      context: {
        workspaceRoot: 'D:/workspace',
        currentFile: {
          path: 'src/App.tsx',
          content: 'export default function App() { return null; }',
          language: 'tsx',
        },
      },
    })) {
      chunks.push(chunk);
    }
  };

  if (engine.id === 'codex') {
    await withMockCodexCliJsonl(exerciseRuntime);
  } else {
    await exerciseRuntime();
  }

  assert.equal(chunks.length > 0, true, `${engine.id} must emit stream chunks`);
  assert.equal(
    chunks.every((chunk) => chunk.object === 'chat.completion.chunk'),
    true,
    `${engine.id} must emit OpenAI-compatible stream chunks`,
  );
  assert.equal(
    chunks.some((chunk) => chunk.choices[0]?.delta?.role === 'assistant'),
    true,
    `${engine.id} must identify the assistant role in the stream`,
  );
  assert.equal(
    chunks.some(
      (chunk) =>
        typeof chunk.choices[0]?.delta?.content === 'string' &&
        chunk.choices[0].delta.content.length > 0,
    ),
    true,
    `${engine.id} must stream content deltas`,
  );
  assert.equal(
    chunks.some((chunk) => chunk.choices[0]?.finish_reason === 'tool_calls'),
    true,
    `${engine.id} must surface tool-call completion in the stream`,
  );
}

console.log('engine conformance contract passed.');
