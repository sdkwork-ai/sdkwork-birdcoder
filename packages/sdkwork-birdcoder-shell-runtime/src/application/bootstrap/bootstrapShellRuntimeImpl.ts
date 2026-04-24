import type { BirdHostDescriptor } from '@sdkwork/birdcoder-host-core';
import type { BirdCoderAppAdminApiClient } from '@sdkwork/birdcoder-types';
import {
  bindDefaultBirdCoderIdeServicesRuntime,
  type BirdCoderRuntimeUserCenterBindingConfig,
} from '@sdkwork/birdcoder-infrastructure-runtime';
import { bootstrapShellUserState } from './bootstrapShellUserState.ts';

let bootstrapped = false;

export interface BootstrapShellRuntimeOptions {
  appAdminClient?: BirdCoderAppAdminApiClient;
  apiBaseUrl?: string;
  host?: BirdHostDescriptor;
  userCenter?: BirdCoderRuntimeUserCenterBindingConfig;
}

export async function bootstrapShellRuntimeImpl(
  options: BootstrapShellRuntimeOptions = {},
): Promise<void> {
  bindDefaultBirdCoderIdeServicesRuntime(options);

  if (bootstrapped) {
    return;
  }

  await bootstrapShellUserState();
  bootstrapped = true;
}
