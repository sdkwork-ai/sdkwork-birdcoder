import type { IChatEngine } from '@sdkwork/birdcoder-pc-chat';
import { ClaudeChatEngine } from '@sdkwork/birdcoder-pc-chat-claude';
import { CodexChatEngine } from '@sdkwork/birdcoder-pc-chat-codex';
import { GeminiChatEngine } from '@sdkwork/birdcoder-pc-chat-gemini';
import { OpenCodeChatEngine } from '@sdkwork/birdcoder-pc-chat-opencode';

import type { WorkbenchCodeEngineId } from './catalog.ts';
import { findWorkbenchCodeEngineKernel } from './kernel.ts';
import { createWorkbenchCanonicalChatEngine } from './runtime.ts';

type ChatEngineFactory = () => IChatEngine;

const CHAT_ENGINE_FACTORIES: Record<WorkbenchCodeEngineId, ChatEngineFactory> = {
  codex: () => new CodexChatEngine(),
  'claude-code': () => new ClaudeChatEngine(),
  gemini: () => new GeminiChatEngine(),
  opencode: () => new OpenCodeChatEngine(),
};

export function createChatEngineById(engineId: unknown): IChatEngine {
  const kernel = findWorkbenchCodeEngineKernel(engineId);

  if (!kernel) {
    throw new Error(`Unknown engineId: ${String(engineId)}`);
  }

  return createWorkbenchCanonicalChatEngine(CHAT_ENGINE_FACTORIES[kernel.id](), {
    engineId: kernel.id,
    defaultModelId: kernel.descriptor.defaultModelId,
    descriptor: kernel.descriptor,
  });
}

export function listWorkbenchChatEngineIds(): readonly WorkbenchCodeEngineId[] {
  return Object.keys(CHAT_ENGINE_FACTORIES) as WorkbenchCodeEngineId[];
}
