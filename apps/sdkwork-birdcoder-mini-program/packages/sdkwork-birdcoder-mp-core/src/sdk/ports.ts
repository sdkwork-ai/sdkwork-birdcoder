import type { BirdCoderMiniProgramRuntimeConfig } from '../config/runtimeConfig.ts';

export interface BirdCoderSystemDescriptor {
  readonly name: string;
  readonly version: string;
  readonly status: 'ready' | 'degraded' | 'unavailable';
}

export interface BirdCoderWorkbenchSdkPort {
  loadSystemDescriptor(
    runtime: BirdCoderMiniProgramRuntimeConfig,
  ): Promise<BirdCoderSystemDescriptor | null>;
}

export interface BirdCoderSdkPorts {
  readonly birdCoder: BirdCoderWorkbenchSdkPort;
  readonly agents?: unknown;
  readonly iam?: unknown;
  readonly drive?: unknown;
}

export function createUnconfiguredBirdCoderSdkPorts(): BirdCoderSdkPorts {
  return {
    birdCoder: {
      async loadSystemDescriptor() {
        return null;
      },
    },
  };
}
