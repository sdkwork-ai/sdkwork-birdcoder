import type { IChatEngine } from '@sdkwork/birdcoder-pc-chat';

import { createChatEngineById } from './engines.ts';
import {
  getWorkbenchCodeEngineKernel,
  type WorkbenchCodeEngineId,
  type WorkbenchCodeEngineKernel,
} from './kernel.ts';
import { assertWorkbenchServerImplementedEngineId } from './serverSupport.ts';

export interface WorkbenchServerSessionEngineBinding {
  engineId: WorkbenchCodeEngineId;
  kernel: WorkbenchCodeEngineKernel;
  chatEngine: IChatEngine;
}

export function createWorkbenchServerSessionEngineBinding(
  engineId: string | null | undefined,
): WorkbenchServerSessionEngineBinding {
  assertWorkbenchServerImplementedEngineId(engineId);
  const kernel = getWorkbenchCodeEngineKernel(engineId);

  return {
    engineId: kernel.id,
    kernel,
    chatEngine: createChatEngineById(kernel.id),
  };
}
