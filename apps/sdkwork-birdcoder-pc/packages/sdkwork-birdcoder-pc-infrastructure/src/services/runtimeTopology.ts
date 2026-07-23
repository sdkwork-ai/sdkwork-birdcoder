export type BirdCoderDeploymentProfile = 'standalone' | 'cloud';
export type BirdCoderExecutionLocation = 'local-host' | 'cloud-workspace';
export type BirdCoderRuntimeTarget = 'browser' | 'desktop' | 'tablet-ipados' | 'tablet-android' | 'server' | 'test-runner';

export interface BirdCoderRuntimeTopology {
  deploymentProfile: BirdCoderDeploymentProfile;
  executionLocation: BirdCoderExecutionLocation;
  runtimeTarget: BirdCoderRuntimeTarget;
}

export interface ResolveBirdCoderRuntimeTopologyOptions {
  deploymentProfile?: BirdCoderDeploymentProfile;
  executionLocation?: BirdCoderExecutionLocation;
  runtimeTarget?: BirdCoderRuntimeTarget;
}

type RuntimeEnvHost = typeof globalThis & {
  __BIRDCODER_ENV__?: Record<string, unknown>;
  __SDKWORK_H5_REACT_ENV__?: Record<string, unknown>;
  __SDKWORK_PC_REACT_ENV__?: Record<string, unknown>;
};

const RUNTIME_TARGETS = new Set<BirdCoderRuntimeTarget>([
  'browser',
  'desktop',
  'tablet-ipados',
  'tablet-android',
  'server',
  'test-runner',
]);

function readText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function readBirdCoderRuntimePublicEnv(name: string): string | undefined {
  const host = globalThis as RuntimeEnvHost;
  const runtimeValue = readText(
    host.__BIRDCODER_ENV__?.[name]
    ?? host.__SDKWORK_H5_REACT_ENV__?.[name]
    ?? host.__SDKWORK_PC_REACT_ENV__?.[name],
  );
  if (runtimeValue) {
    return runtimeValue;
  }
  const meta = import.meta as ImportMeta & { env?: Record<string, unknown> };
  return readText(meta.env?.[name]);
}

function normalizeDeploymentProfile(value: string | undefined): BirdCoderDeploymentProfile | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.toLowerCase();
  if (normalized === 'standalone' || normalized === 'cloud') {
    return normalized;
  }
  throw new Error('BirdCoder deploymentProfile must be standalone or cloud.');
}

function normalizeExecutionLocation(value: string | undefined): BirdCoderExecutionLocation | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.toLowerCase();
  if (normalized === 'local-host' || normalized === 'cloud-workspace') {
    return normalized;
  }
  throw new Error('BirdCoder executionLocation must be local-host or cloud-workspace.');
}

function normalizeRuntimeTarget(value: string | undefined): BirdCoderRuntimeTarget | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.toLowerCase() as BirdCoderRuntimeTarget;
  if (RUNTIME_TARGETS.has(normalized)) {
    return normalized;
  }
  throw new Error(`BirdCoder runtimeTarget is unsupported: ${value}.`);
}

export function resolveBirdCoderRuntimeTopology(
  options: ResolveBirdCoderRuntimeTopologyOptions = {},
): BirdCoderRuntimeTopology {
  const runtimeTarget = normalizeRuntimeTarget(options.runtimeTarget)
    ?? normalizeRuntimeTarget(
      readBirdCoderRuntimePublicEnv('VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET')
      ?? readBirdCoderRuntimePublicEnv('VITE_SDKWORK_RUNTIME_TARGET'),
    )
    ?? 'browser';
  const deploymentProfile = normalizeDeploymentProfile(options.deploymentProfile)
    ?? normalizeDeploymentProfile(
      readBirdCoderRuntimePublicEnv('VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE')
      ?? readBirdCoderRuntimePublicEnv('VITE_SDKWORK_DEPLOYMENT_PROFILE'),
    )
    ?? 'cloud';
  const executionLocation = normalizeExecutionLocation(options.executionLocation)
    ?? normalizeExecutionLocation(
      readBirdCoderRuntimePublicEnv('VITE_SDKWORK_BIRDCODER_EXECUTION_LOCATION'),
    )
    ?? (
      runtimeTarget === 'desktop' && deploymentProfile === 'standalone'
        ? 'local-host'
        : 'cloud-workspace'
    );
  return { deploymentProfile, executionLocation, runtimeTarget };
}
