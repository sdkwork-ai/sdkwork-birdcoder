import type { IChatEngine } from '@sdkwork/birdcoder-chat';
import { ClaudeChatEngine } from '@sdkwork/birdcoder-chat-claude';
import { CodexChatEngine } from '@sdkwork/birdcoder-chat-codex';
import { GeminiChatEngine } from '@sdkwork/birdcoder-chat-gemini';
import { OpenCodeChatEngine } from '@sdkwork/birdcoder-chat-opencode';
import { findWorkbenchCodeEngineKernel } from './kernel.ts';
import { createWorkbenchCanonicalChatEngine } from './runtime.ts';

function createNativeChatEngine(engineId: string): IChatEngine {
  const kernel = findWorkbenchCodeEngineKernel(engineId);
  if (!kernel) {
    throw new Error(
      `BirdCoder cannot create a chat engine for unknown engineId "${engineId.trim() || 'unknown'}".`,
    );
  }

  switch (kernel.id) {
    case 'claude-code':
      return new ClaudeChatEngine();
    case 'gemini':
      return new GeminiChatEngine();
    case 'opencode':
      return new OpenCodeChatEngine();
    case 'codex':
      return new CodexChatEngine();
  }
}

// Runtime factories stay isolated in this entrypoint so manifest/kernel remain
// pure engine metadata surfaces for app and server orchestration layers.
export function createChatEngineById(engineId: string): IChatEngine {
  const kernel = findWorkbenchCodeEngineKernel(engineId);
  if (!kernel) {
    throw new Error(
      `BirdCoder cannot create a chat engine for unknown engineId "${engineId.trim() || 'unknown'}".`,
    );
  }

  return createWorkbenchCanonicalChatEngine(createNativeChatEngine(kernel.id), {
    defaultModelId: kernel.defaultModelId,
    descriptor: kernel.descriptor,
  });
}
