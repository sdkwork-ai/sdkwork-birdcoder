import assert from 'node:assert/strict';

import { ClaudeChatEngine } from '../packages/sdkwork-birdcoder-chat-claude/src/index.ts';
import { GeminiChatEngine } from '../packages/sdkwork-birdcoder-chat-gemini/src/index.ts';
import { OpenCodeChatEngine } from '../packages/sdkwork-birdcoder-chat-opencode/src/index.ts';
import type { ChatEngineOfficialSdkBridgeLoader } from '../packages/sdkwork-birdcoder-chat/src/index.ts';
import type {
  ChatMessage,
  IChatEngine,
} from '../packages/sdkwork-birdcoder-chat/src/types.ts';
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

function createMockBridgeLoader(
  engineId: string,
  modelId: string,
): ChatEngineOfficialSdkBridgeLoader {
  const created = Math.floor(Date.now() / 1000);
  return {
    load: async () => ({
      async sendMessage() {
        return {
          id: `${engineId}-conformance-response`,
          object: 'chat.completion',
          created,
          model: modelId,
          choices: [
            {
              index: 0,
              message: {
                id: `${engineId}-conformance-message`,
                role: 'assistant',
                content: `${engineId} conformance response.`,
                timestamp: Date.now(),
              },
              finish_reason: 'stop',
            },
          ],
        };
      },
      async *sendMessageStream() {
        yield {
          id: `${engineId}-conformance-stream`,
          object: 'chat.completion.chunk',
          created,
          model: modelId,
          choices: [
            {
              index: 0,
              delta: {
                role: 'assistant',
                content: `${engineId} conformance stream. `,
              },
              finish_reason: null,
            },
          ],
        };
        yield {
          id: `${engineId}-conformance-stream`,
          object: 'chat.completion.chunk',
          created,
          model: modelId,
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    id: `${engineId}-conformance-tool`,
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
        yield {
          id: `${engineId}-conformance-stream`,
          object: 'chat.completion.chunk',
          created,
          model: modelId,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: 'stop',
            },
          ],
        };
      },
    }),
  };
}

function createConformanceRuntime(
  engineId: string,
  modelId: string,
): IChatEngine {
  const officialSdkBridgeLoader = createMockBridgeLoader(engineId, modelId);
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
  const runtime = createConformanceRuntime(engine.id, engine.defaultModelId);

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
