import assert from 'node:assert/strict';

import { ClaudeChatEngine } from '../packages/sdkwork-birdcoder-chat-claude/src/index.ts';
import { CodexChatEngine } from '../packages/sdkwork-birdcoder-chat-codex/src/index.ts';
import { GeminiChatEngine } from '../packages/sdkwork-birdcoder-chat-gemini/src/index.ts';
import { OpenCodeChatEngine } from '../packages/sdkwork-birdcoder-chat-opencode/src/index.ts';
import type {
  ChatMessage,
  ChatResponse,
  ChatStreamChunk,
} from '../packages/sdkwork-birdcoder-chat/src/index.ts';

const messages: ChatMessage[] = [
  {
    id: 'sdk-runtime-user-1',
    role: 'user',
    content: 'Use the official SDK lane when available.',
    timestamp: Date.now(),
  },
];

function createSdkResponse(engineId: string): ChatResponse {
  return {
    id: `sdk-${engineId}-response`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: `${engineId}-sdk-model`,
    choices: [
      {
        index: 0,
        message: {
          id: `sdk-${engineId}-message`,
          role: 'assistant',
          content: `${engineId} official sdk response`,
          timestamp: Date.now(),
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 6,
      total_tokens: 16,
    },
  };
}

async function collectStream(
  iterable: AsyncGenerator<ChatStreamChunk, void, unknown>,
): Promise<ChatStreamChunk[]> {
  const chunks: ChatStreamChunk[] = [];
  for await (const chunk of iterable) {
    chunks.push(chunk);
  }
  return chunks;
}

function createSdkStream(engineId: string): AsyncGenerator<ChatStreamChunk, void, unknown> {
  return (async function* sdkStream() {
    yield {
      id: `sdk-${engineId}-stream`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: `${engineId}-sdk-model`,
      choices: [
        {
          index: 0,
          delta: {
            role: 'assistant',
            content: `${engineId} official `,
          },
          finish_reason: null,
        },
      ],
    };

    yield {
      id: `sdk-${engineId}-stream`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: `${engineId}-sdk-model`,
      choices: [
        {
          index: 0,
          delta: {
            content: 'sdk stream',
          },
          finish_reason: 'stop',
        },
      ],
    };
  })();
}

const providers = [
  {
    engineId: 'codex',
    createWithSdk: () =>
      new CodexChatEngine({
        officialSdkBridgeLoader: {
          load: async () => ({
            sendMessage: async () => createSdkResponse('codex'),
            sendMessageStream: async function* () {
              yield* createSdkStream('codex');
            },
          }),
        },
      }),
    createFallback: () =>
      new CodexChatEngine({
        officialSdkBridgeLoader: {
          load: async () => null,
        },
        cliJsonlTurnExecutor: async () => [
          {
            type: 'item.updated',
            item: {
              id: 'codex-cli-fallback-message',
              type: 'agent_message',
              text: 'codex cli fallback response',
            },
          },
          {
            type: 'turn.completed',
          },
        ],
      }),
  },
  {
    engineId: 'claude-code',
    createWithSdk: () =>
      new ClaudeChatEngine({
        officialSdkBridgeLoader: {
          load: async () => ({
            sendMessage: async () => createSdkResponse('claude-code'),
            sendMessageStream: async function* () {
              yield* createSdkStream('claude-code');
            },
          }),
        },
      }),
    createFallback: () =>
      new ClaudeChatEngine({
        officialSdkBridgeLoader: {
          load: async () => null,
        },
      }),
  },
  {
    engineId: 'gemini',
    createWithSdk: () =>
      new GeminiChatEngine({
        officialSdkBridgeLoader: {
          load: async () => ({
            sendMessage: async () => createSdkResponse('gemini'),
            sendMessageStream: async function* () {
              yield* createSdkStream('gemini');
            },
          }),
        },
      }),
    createFallback: () =>
      new GeminiChatEngine({
        officialSdkBridgeLoader: {
          load: async () => null,
        },
      }),
  },
  {
    engineId: 'opencode',
    createWithSdk: () =>
      new OpenCodeChatEngine({
        officialSdkBridgeLoader: {
          load: async () => ({
            sendMessage: async () => createSdkResponse('opencode'),
            sendMessageStream: async function* () {
              yield* createSdkStream('opencode');
            },
          }),
        },
      }),
    createFallback: () =>
      new OpenCodeChatEngine({
        officialSdkBridgeLoader: {
          load: async () => null,
        },
      }),
  },
] as const;

for (const provider of providers) {
  const sdkEngine = provider.createWithSdk();
  const sdkResponse = await sdkEngine.sendMessage(messages, {
    model: provider.engineId,
  });

  assert.equal(
    sdkResponse.choices[0]?.message.content,
    `${provider.engineId} official sdk response`,
    `${provider.engineId} should prefer the official SDK branch for one-shot responses`,
  );

  const sdkChunks = await collectStream(
    sdkEngine.sendMessageStream(messages, {
      model: provider.engineId,
    }),
  );

  assert.equal(
    sdkChunks.map((chunk) => chunk.choices[0]?.delta.content ?? '').join(''),
    `${provider.engineId} official sdk stream`,
    `${provider.engineId} should prefer the official SDK branch for streaming responses`,
  );

  const fallbackEngine = provider.createFallback();
  const fallbackResponse = await fallbackEngine.sendMessage(messages, {
    model: provider.engineId,
  });
  const fallbackChunks = await collectStream(
    fallbackEngine.sendMessageStream(messages, {
      model: provider.engineId,
    }),
  );

  assert.notEqual(
    fallbackResponse.choices[0]?.message.content,
    `${provider.engineId} official sdk response`,
    `${provider.engineId} should fall back when no official SDK bridge is available`,
  );
  assert.notEqual(
    fallbackChunks.map((chunk) => chunk.choices[0]?.delta.content ?? '').join(''),
    `${provider.engineId} official sdk stream`,
    `${provider.engineId} stream should fall back when no official SDK bridge is available`,
  );
}

console.log('engine official sdk runtime selection contract passed.');
