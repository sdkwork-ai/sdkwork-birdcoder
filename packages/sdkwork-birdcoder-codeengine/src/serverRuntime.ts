import type { IChatEngine } from '@sdkwork/birdcoder-chat';
import {
  getWorkbenchCodeEngineKernel,
  type WorkbenchCodeEngineId,
  type WorkbenchCodeEngineKernelDefinition,
} from './kernel.ts';
import { createChatEngineById } from './engines.ts';
import { assertWorkbenchServerImplementedEngineId } from './serverSupport.ts';

export interface WorkbenchServerSessionEngineBinding {
  engineId: WorkbenchCodeEngineId;
  kernel: WorkbenchCodeEngineKernelDefinition;
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
