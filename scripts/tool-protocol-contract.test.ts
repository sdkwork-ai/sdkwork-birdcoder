import assert from 'node:assert/strict';

import { ClaudeChatEngine } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-chat-claude/src/index.ts';
import { GeminiChatEngine } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-chat-gemini/src/index.ts';
import { OpenCodeChatEngine } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-chat-opencode/src/index.ts';
import type { ChatEngineOfficialSdkBridgeLoader } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-chat/src/index.ts';
import type { IChatEngine, ToolCall } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-chat/src/types.ts';
import { createChatEngineById } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/engines.ts';
import { listWorkbenchCliEngines } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/kernel.ts';
import {
  BIRDCODER_CODING_SESSION_ARTIFACT_KINDS,
  BIRDCODER_CODING_SESSION_EVENT_KINDS,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/coding-session.ts';
import { withMockCodexCliJsonl } from './test-support/mockCodexCli.ts';

assert.equal(BIRDCODER_CODING_SESSION_EVENT_KINDS.includes('tool.call.requested'), true);
assert.equal(BIRDCODER_CODING_SESSION_EVENT_KINDS.includes('tool.call.completed'), true);
assert.equal(BIRDCODER_CODING_SESSION_EVENT_KINDS.includes('artifact.upserted'), true);
assert.equal(BIRDCODER_CODING_SESSION_EVENT_KINDS.includes('approval.required'), true);
assert.equal(BIRDCODER_CODING_SESSION_ARTIFACT_KINDS.includes('command-log'), true);
assert.equal(BIRDCODER_CODING_SESSION_ARTIFACT_KINDS.includes('diagnostic-bundle'), true);

function createToolProtocolMockLoader(
  engineId: string,
  modelId: string,
): ChatEngineOfficialSdkBridgeLoader {
  const created = Math.floor(Date.now() / 1000);
  return {
    load: async () => ({
      async *sendMessageStream() {
        yield {
          id: `${engineId}-tool-protocol-stream`,
          object: 'chat.completion.chunk',
          created,
          model: modelId,
          choices: [
            {
              index: 0,
              delta: {
                role: 'assistant',
                content: `${engineId} will use a tool. `,
              },
              finish_reason: null,
            },
          ],
        };
        yield {
          id: `${engineId}-tool-protocol-stream`,
          object: 'chat.completion.chunk',
          created,
          model: modelId,
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    id: `${engineId}-tool-protocol-call`,
                    type: 'function',
                    function: {
                      name: 'run_command',
                      arguments: JSON.stringify({ command: 'pnpm lint' }),
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        };
      },
    }),
  };
}

function createToolProtocolRuntime(
  engineId: string,
  modelId: string,
): IChatEngine {
  const officialSdkBridgeLoader = createToolProtocolMockLoader(engineId, modelId);
  switch (engineId) {
    case 'claude-code':
      return new ClaudeChatEngine({ officialSdkBridgeLoader });
    case 'gemini':
      return new GeminiChatEngine({ officialSdkBridgeLoader });
    case 'opencode':
      return new OpenCodeChatEngine({ officialSdkBridgeLoader });
    default:
      return createChatEngineById(engineId);
  }
}

for (const engine of listWorkbenchCliEngines()) {
  assert.equal(
    engine.descriptor.capabilityMatrix.toolCalls,
    true,
    `${engine.id} must advertise tool-call support`,
  );

  const runtime = createToolProtocolRuntime(engine.id, engine.defaultModelId);
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
