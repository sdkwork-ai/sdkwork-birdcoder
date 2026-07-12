import {
  bindDefaultBirdCoderIdeServicesRuntime,
  type BindDefaultBirdCoderIdeServicesRuntimeOptions,
} from '@sdkwork/birdcoder-pc-infrastructure/services/defaultIdeServicesRuntime';

export type BootstrapShellRuntimeOptions = BindDefaultBirdCoderIdeServicesRuntimeOptions;

/**
 * H5 only needs to bind the shared API runtime. PC workbench hydration is a
 * desktop concern and would pull the terminal/workbench graph into the mobile
 * renderer during typecheck and bundling.
 */
export async function bootstrapShellRuntime(
  options: BootstrapShellRuntimeOptions = {},
): Promise<void> {
  bindDefaultBirdCoderIdeServicesRuntime(options);
}
