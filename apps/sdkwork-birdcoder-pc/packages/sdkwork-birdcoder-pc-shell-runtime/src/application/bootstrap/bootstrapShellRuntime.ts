import type { BirdHostDescriptor } from '@sdkwork/birdcoder-pc-host-core';
import type {
  BirdCoderAppSdkApiClient,
  BirdCoderBackendSdkApiClient,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';

export type BirdCoderRealtimeTransportPreference = 'auto' | 'sse' | 'websocket';

export interface BootstrapShellRuntimeOptions {
  appClient?: BirdCoderAppSdkApiClient;
  apiBaseUrl?: string;
  backendClient?: BirdCoderBackendSdkApiClient;
  host?: BirdHostDescriptor;
  realtimeTransport?: BirdCoderRealtimeTransportPreference;
}

export async function bootstrapShellRuntime(
  options: BootstrapShellRuntimeOptions = {},
): Promise<void> {
  const module = await import('./loadBootstrapShellRuntimeImpl.ts');
  const implementation = await module.loadBootstrapShellRuntimeImpl();
  await implementation.bootstrapShellRuntimeImpl(options);
}

