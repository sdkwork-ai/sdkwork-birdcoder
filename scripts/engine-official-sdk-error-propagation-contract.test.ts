import assert from 'node:assert/strict';

import { ClaudeChatEngine } from '../packages/sdkwork-birdcoder-chat-claude/src/index.ts';
import { CodexChatEngine } from '../packages/sdkwork-birdcoder-chat-codex/src/index.ts';
import { GeminiChatEngine } from '../packages/sdkwork-birdcoder-chat-gemini/src/index.ts';
import { OpenCodeChatEngine } from '../packages/sdkwork-birdcoder-chat-opencode/src/index.ts';
import type {
  ChatEngineOfficialSdkBridge,
  ChatEngineOfficialSdkBridgeLoader,
  ChatMessage,
  ChatStreamChunk,
  IChatEngine,
} from '../packages/sdkwork-birdcoder-chat/src/index.ts';

const messages: ChatMessage[] = [
  {
    id: 'sdk-error-propagation-user-1',
    role: 'user',
    content: 'Surface official SDK execution failures to the caller.',
    timestamp: Date.now(),
  },
];

function createBridgeLoader(
  bridge: ChatEngineOfficialSdkBridge,
): ChatEngineOfficialSdkBridgeLoader {
  return {
    load: async () => bridge,
  };
}

async function collectStream(
  iterable: AsyncIterable<ChatStreamChunk>,
): Promise<ChatStreamChunk[]> {
  const chunks: ChatStreamChunk[] = [];
  for await (const chunk of iterable) {
    chunks.push(chunk);
  }
  return chunks;
}

async function assertPropagatesError(
  label: string,
  execute: () => Promise<unknown>,
  expectedError: Error,
): Promise<void> {
  await assert.rejects(
    execute(),
    (error) => {
      assert.equal(
        error,
        expectedError,
        `${label} should preserve the original bridge execution error`,
      );
      return true;
    },
    `${label} should reject instead of silently falling back`,
  );
}

const providers: Array<{
  engineId: string;
  createEngine: (loader: ChatEngineOfficialSdkBridgeLoader) => IChatEngine;
}> = [
  {
    engineId: 'codex',
    createEngine: (loader) =>
      new CodexChatEngine({
        officialSdkBridgeLoader: loader,
      }),
  },
  {
    engineId: 'claude-code',
    createEngine: (loader) =>
      new ClaudeChatEngine({
        officialSdkBridgeLoader: loader,
      }),
  },
  {
    engineId: 'gemini',
    createEngine: (loader) =>
      new GeminiChatEngine({
        officialSdkBridgeLoader: loader,
      }),
  },
  {
    engineId: 'opencode',
    createEngine: (loader) =>
      new OpenCodeChatEngine({
        officialSdkBridgeLoader: loader,
      }),
  },
];

for (const provider of providers) {
  const oneShotError = new Error(`${provider.engineId} official sdk sendMessage failure`);
  const oneShotEngine = provider.createEngine(
    createBridgeLoader({
      sendMessage: async () => {
        throw oneShotError;
      },
    }),
  );

  await assertPropagatesError(
    `${provider.engineId} one-shot`,
    () =>
      oneShotEngine.sendMessage(messages, {
        model: provider.engineId,
      }),
    oneShotError,
  );

  const streamError = new Error(`${provider.engineId} official sdk sendMessageStream failure`);
  const streamEngine = provider.createEngine(
    createBridgeLoader({
      sendMessage: async () => {
        throw new Error('stream test must not fall back to one-shot bridge execution');
      },
      async *sendMessageStream() {
        throw streamError;
      },
    }),
  );

  await assertPropagatesError(
    `${provider.engineId} streaming`,
    () =>
      collectStream(
        streamEngine.sendMessageStream(messages, {
          model: provider.engineId,
        }),
      ),
    streamError,
  );

  const synthesizedStreamError = new Error(
    `${provider.engineId} official sdk synthesized stream source failure`,
  );
  const synthesizedStreamEngine = provider.createEngine(
    createBridgeLoader({
      sendMessage: async () => {
        throw synthesizedStreamError;
      },
    }),
  );

  await assertPropagatesError(
    `${provider.engineId} synthesized streaming`,
    () =>
      collectStream(
        synthesizedStreamEngine.sendMessageStream(messages, {
          model: provider.engineId,
        }),
      ),
    synthesizedStreamError,
  );
}

console.log('engine official sdk error propagation contract passed.');
