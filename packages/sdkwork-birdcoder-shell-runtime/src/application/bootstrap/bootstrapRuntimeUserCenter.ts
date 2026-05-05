import type { BirdCoderRuntimeUserCenterProviderKind } from '@sdkwork/birdcoder-core';

export async function resolveBirdCoderBootstrapRuntimeUserCenterProviderKind(): Promise<
  BirdCoderRuntimeUserCenterProviderKind
> {
  const coreModule = await import('@sdkwork/birdcoder-core');
  return coreModule.resolveBirdCoderRuntimeUserCenterProviderKind();
}
