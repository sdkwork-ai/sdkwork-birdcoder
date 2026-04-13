import { initCore } from '@sdkwork/birdcoder-core';
import { bindDefaultBirdCoderIdeServicesRuntime } from '@sdkwork/birdcoder-infrastructure';
import type { BirdHostDescriptor } from '@sdkwork/birdcoder-host-core';
import type { BirdCoderAppAdminApiClient } from '@sdkwork/birdcoder-types';

let bootstrapped = false;

export interface BootstrapShellRuntimeOptions {
  appAdminClient?: BirdCoderAppAdminApiClient;
  apiBaseUrl?: string;
  host?: BirdHostDescriptor;
}

export function bootstrapShellRuntime(options: BootstrapShellRuntimeOptions = {}) {
  bindDefaultBirdCoderIdeServicesRuntime(options);

  if (bootstrapped) {
    return;
  }

  initCore();
  bootstrapped = true;
}
