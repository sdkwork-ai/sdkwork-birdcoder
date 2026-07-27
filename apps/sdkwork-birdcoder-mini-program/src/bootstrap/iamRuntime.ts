import {
  BirdCoderSessionScope,
  type BirdCoderSessionClearReason,
} from '@sdkwork/birdcoder-mp-core';
import type { BirdCoderWeixinHost } from '@sdkwork/birdcoder-mp-host';

export interface BirdCoderIamSessionRuntimeDependencies {
  readonly host: BirdCoderWeixinHost;
  readonly tokenManager: { clearTokens(): void };
  readonly contextStore: { clear(): void };
  readonly caches?: readonly { clear(): void }[];
  readonly sensitiveState?: readonly { clear(reason: BirdCoderSessionClearReason): void }[];
}

export function createBirdCoderIamSessionScope(
  dependencies: BirdCoderIamSessionRuntimeDependencies,
): BirdCoderSessionScope {
  return new BirdCoderSessionScope({
    storage: dependencies.host.storage,
    tokenManager: dependencies.tokenManager,
    contextStore: dependencies.contextStore,
    caches: dependencies.caches ?? [],
    sensitiveState: dependencies.sensitiveState ?? [],
  });
}
