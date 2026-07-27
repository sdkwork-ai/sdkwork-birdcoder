import type { BirdCoderMiniProgramRuntimeConfig } from '@sdkwork/birdcoder-mp-core';
import type { WeixinMiniProgramApi } from '@sdkwork/birdcoder-mp-host';

import { registerBirdCoderMiniProgramHostAdapters } from './hostAdapters.ts';
import { createBirdCoderMiniProgramSdkPorts } from './sdkClients.ts';
import type { BirdCoderMiniProgramRuntime } from './runtimeTypes.ts';

export function createBirdCoderMiniProgramRuntime(
  config: BirdCoderMiniProgramRuntimeConfig,
  api?: WeixinMiniProgramApi,
): BirdCoderMiniProgramRuntime {
  return {
    config,
    sdkPorts: createBirdCoderMiniProgramSdkPorts(),
    host: registerBirdCoderMiniProgramHostAdapters(api),
  };
}
