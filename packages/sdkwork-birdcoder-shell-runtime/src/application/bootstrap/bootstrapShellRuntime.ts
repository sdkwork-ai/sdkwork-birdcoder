import type { BirdHostDescriptor } from '@sdkwork/birdcoder-host-core';
import type {
  BirdCoderAppSdkApiClient,
  BirdCoderBackendSdkApiClient,
} from '@sdkwork/birdcoder-infrastructure-runtime';

export interface BootstrapShellRuntimeOptions {
  appClient?: BirdCoderAppSdkApiClient;
  apiBaseUrl?: string;
  backendClient?: BirdCoderBackendSdkApiClient;
  host?: BirdHostDescriptor;
}

export async function bootstrapShellRuntime(
  options: BootstrapShellRuntimeOptions = {},
): Promise<void> {
  const module = await import('./loadBootstrapShellRuntimeImpl.ts');
  const implementation = await module.loadBootstrapShellRuntimeImpl();
  await implementation.bootstrapShellRuntimeImpl(options);
}
