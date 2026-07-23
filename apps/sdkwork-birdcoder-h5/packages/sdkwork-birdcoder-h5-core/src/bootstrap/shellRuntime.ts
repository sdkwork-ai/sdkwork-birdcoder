import {
  bindBirdCoderH5RuntimeConfig,
  type BirdCoderH5RuntimeConfig,
} from './runtimeConfig.ts';

export type BootstrapShellRuntimeOptions = BirdCoderH5RuntimeConfig;

export async function bootstrapShellRuntime(
  options: BootstrapShellRuntimeOptions = {},
): Promise<void> {
  bindBirdCoderH5RuntimeConfig(options);
}
