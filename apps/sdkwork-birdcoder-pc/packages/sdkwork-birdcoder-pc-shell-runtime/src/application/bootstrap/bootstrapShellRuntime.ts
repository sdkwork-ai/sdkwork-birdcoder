import type { BirdHostDescriptor } from '@sdkwork/birdcoder-pc-host-core';
import type {
  BirdCoderAppSdkApiClient,
  BirdCoderDeploymentProfile,
  BirdCoderExecutionLocation,
  BirdCoderRuntimeTarget,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';

export interface BootstrapShellRuntimeOptions {
  applicationApiBaseUrl?: string;
  appClient?: BirdCoderAppSdkApiClient;
  deploymentProfile?: BirdCoderDeploymentProfile;
  executionLocation?: BirdCoderExecutionLocation;
  host?: BirdHostDescriptor;
  platformApiGatewayBaseUrl?: string;
  runtimeTarget?: BirdCoderRuntimeTarget;
}

export async function bootstrapShellRuntime(
  options: BootstrapShellRuntimeOptions = {},
): Promise<void> {
  const module = await import('./loadBootstrapShellRuntimeImpl.ts');
  const implementation = await module.loadBootstrapShellRuntimeImpl();
  await implementation.bootstrapShellRuntimeImpl(options);
}
