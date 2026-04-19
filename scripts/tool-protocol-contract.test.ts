import assert from 'node:assert/strict';

import type { ToolCall } from '../packages/sdkwork-birdcoder-chat/src/types.ts';
import { createChatEngineById } from '../packages/sdkwork-birdcoder-codeengine/src/engines.ts';
import { listWorkbenchCliEngines } from '../packages/sdkwork-birdcoder-codeengine/src/kernel.ts';
import {
  BIRDCODER_CODING_SESSION_ARTIFACT_KINDS,
  BIRDCODER_CODING_SESSION_EVENT_KINDS,
} from '../packages/sdkwork-birdcoder-types/src/coding-session.ts';
import { withMockCodexCliJsonl } from './test-support/mockCodexCli.ts';

assert.equal(BIRDCODER_CODING_SESSION_EVENT_KINDS.includes('tool.call.requested'), true);
assert.equal(BIRDCODER_CODING_SESSION_EVENT_KINDS.includes('tool.call.completed'), true);
assert.equal(BIRDCODER_CODING_SESSION_EVENT_KINDS.includes('artifact.upserted'), true);
assert.equal(BIRDCODER_CODING_SESSION_EVENT_KINDS.includes('approval.required'), true);
assert.equal(BIRDCODER_CODING_SESSION_ARTIFACT_KINDS.includes('command-log'), true);
assert.equal(BIRDCODER_CODING_SESSION_ARTIFACT_KINDS.includes('diagnostic-bundle'), true);

for (const engine of listWorkbenchCliEngines()) {
  assert.equal(
    engine.descriptor.capabilityMatrix.toolCalls,
    true,
    `${engine.id} must advertise tool-call support`,
  );

  const runtime = createChatEngineById(engine.id);
  const toolCalls: ToolCall[] = [];

  const collectToolCalls = async () => {
    for await (const chunk of runtime.sendMessageStream(
      [
        {
          id: 'msg-user-1',
          role: 'user',
          content: 'Use a tool to inspect or modify the workspace.',
          timestamp: Date.now(),
        },
      ],
      {
        model: engine.defaultModelId,
        context: {
          workspaceRoot: 'D:/workspace',
        },
      },
    )) {
      toolCalls.push(...(chunk.choices[0]?.delta?.tool_calls ?? []));
    }
  };

  if (engine.id === 'codex') {
    await withMockCodexCliJsonl(collectToolCalls);
  } else {
    await collectToolCalls();
  }

  assert.equal(toolCalls.length > 0, true, `${engine.id} must emit at least one tool call`);

  for (const toolCall of toolCalls) {
    assert.ok(toolCall.id.length > 0);
    assert.equal(toolCall.type, 'function');
    assert.ok(toolCall.function.name.length > 0);
    assert.doesNotThrow(
      () => JSON.parse(toolCall.function.arguments),
      `${engine.id} tool-call arguments must be JSON`,
    );
  }
}

console.log('tool protocol contract passed.');
