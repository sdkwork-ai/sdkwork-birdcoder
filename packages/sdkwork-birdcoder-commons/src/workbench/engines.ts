import type { IChatEngine } from '../../../sdkwork-birdcoder-chat/src/index.ts';
import { createWorkbenchChatEngine } from './kernel.ts';

export function createChatEngineById(engineId: string): IChatEngine {
  return createWorkbenchChatEngine(engineId);
}
