import type {
  BirdCoderMiniProgramRuntimeConfig,
  BirdCoderSdkPorts,
} from '@sdkwork/birdcoder-mp-core';
import type { BirdCoderWeixinHost } from '@sdkwork/birdcoder-mp-host';

export interface BirdCoderMiniProgramRuntime {
  readonly config: BirdCoderMiniProgramRuntimeConfig;
  readonly sdkPorts: BirdCoderSdkPorts;
  readonly host: BirdCoderWeixinHost;
}
