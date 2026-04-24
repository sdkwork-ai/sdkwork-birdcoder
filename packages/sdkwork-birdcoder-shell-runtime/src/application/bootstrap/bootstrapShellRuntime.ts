import type { BirdHostDescriptor } from '@sdkwork/birdcoder-host-core';
import type { BirdCoderAppAdminApiClient } from '@sdkwork/birdcoder-types';
import type { BirdCoderRuntimeUserCenterBindingConfig } from '@sdkwork/birdcoder-infrastructure-runtime';

export interface BootstrapShellRuntimeOptions {
  appAdminClient?: BirdCoderAppAdminApiClient;
  apiBaseUrl?: string;
  host?: BirdHostDescriptor;
  userCenter?: BirdCoderRuntimeUserCenterBindingConfig;
}

export async function bootstrapShellRuntime(
  options: BootstrapShellRuntimeOptions = {},
): Promise<void> {
  const module = await import('./loadBootstrapShellRuntimeImpl.ts');
  const implementation = await module.loadBootstrapShellRuntimeImpl();
  await implementation.bootstrapShellRuntimeImpl(options);
}
