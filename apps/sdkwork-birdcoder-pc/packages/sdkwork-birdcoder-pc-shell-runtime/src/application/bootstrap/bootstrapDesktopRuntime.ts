import { normalizeBirdCoderServerBaseUrl } from './bootstrapServerBaseUrl.ts';
import { readConfiguredBirdCoderApiBaseUrl } from './bootstrapPublicRuntimeConfig.ts';
import {
  resolveBirdCoderRuntimeTopology,
  type BirdCoderDeploymentProfile,
  type BirdCoderExecutionLocation,
  type BirdCoderRuntimeTopology,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime/runtimeTopology';

type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
type TauriWindow = Window &
  typeof globalThis & {
    __TAURI__?: {
      core?: {
        invoke?: TauriInvoke;
      };
    };
    __TAURI_INTERNALS__?: {
      invoke?: TauriInvoke;
    };
  };

type BirdCoderRuntimeGlobal = typeof globalThis & {
  __SDKWORK_PC_REACT_ENV__?: Record<string, string>;
};

export interface DesktopEmbeddedRuntimeConfig {
  apiBaseUrl: string;
}

export interface DesktopRuntimeConfig extends BirdCoderRuntimeTopology {
  apiBaseUrl: string;
}

export interface ReadDesktopRuntimeConfigOptions {
  configuredApiBaseUrl?: string;
  deploymentProfile?: BirdCoderDeploymentProfile;
  executionLocation?: BirdCoderExecutionLocation;
}

function resolveBootstrapTauriInvokeFromWindow(): TauriInvoke | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const tauriWindow = window as TauriWindow;
  const invoke =
    tauriWindow.__TAURI__?.core?.invoke ?? tauriWindow.__TAURI_INTERNALS__?.invoke ?? null;
  return typeof invoke === 'function' ? invoke : null;
}

async function resolveBootstrapTauriInvoke(): Promise<TauriInvoke | null> {
  const directInvoke = resolveBootstrapTauriInvokeFromWindow();
  if (directInvoke) {
    return directInvoke;
  }

  try {
    const module = await import('@tauri-apps/api/core');
    return typeof module.invoke === 'function' ? module.invoke : null;
  } catch {
    return null;
  }
}

export function isBirdCoderDesktopTauriRuntime(): boolean {
  return resolveBootstrapTauriInvokeFromWindow() !== null;
}

export function publishBirdCoderRuntimeEnvPatch(
  patch: Record<string, string>,
): void {
  const runtimeGlobal = globalThis as BirdCoderRuntimeGlobal;
  runtimeGlobal.__SDKWORK_PC_REACT_ENV__ = Object.freeze({
    ...(runtimeGlobal.__SDKWORK_PC_REACT_ENV__ ?? {}),
    ...patch,
  });
}

export function publishBirdCoderEmbeddedSdkRuntimeEnv(apiBaseUrl: string): void {
  publishBirdCoderDesktopSdkRuntimeEnv({
    apiBaseUrl,
    deploymentProfile: 'standalone',
    executionLocation: 'local-host',
    runtimeTarget: 'desktop',
  });
}

export function publishBirdCoderDesktopSdkRuntimeEnv(
  config: DesktopRuntimeConfig,
): void {
  publishBirdCoderRuntimeEnvPatch({
    VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL: config.apiBaseUrl,
    VITE_BIRDCODER_API_BASE_URL: config.apiBaseUrl,
    VITE_BIRDCODER_APP_API_BASE_URL: config.apiBaseUrl,
    VITE_BIRDCODER_BACKEND_API_BASE_URL: config.apiBaseUrl,
    VITE_SDKWORK_BIRDCODER_APP_API_BASE_URL: config.apiBaseUrl,
    VITE_SDKWORK_BIRDCODER_BACKEND_API_BASE_URL: config.apiBaseUrl,
    VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE: config.deploymentProfile,
    VITE_SDKWORK_BIRDCODER_EXECUTION_LOCATION: config.executionLocation,
    VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET: 'desktop',
    VITE_SDKWORK_DEPLOYMENT_PROFILE: config.deploymentProfile,
    VITE_SDKWORK_RUNTIME_TARGET: 'desktop',
    ...(config.executionLocation === 'local-host'
      ? {
          VITE_SDKWORK_APP_API_BASE_URL: config.apiBaseUrl,
          VITE_SDKWORK_APPBASE_APP_API_BASE_URL: config.apiBaseUrl,
          VITE_SDKWORK_BACKEND_API_BASE_URL: config.apiBaseUrl,
        }
      : {}),
  });
}

export async function readDesktopEmbeddedRuntimeConfig(): Promise<DesktopEmbeddedRuntimeConfig> {
  const invoke = await resolveBootstrapTauriInvoke();
  if (!invoke) {
    throw new Error(
      'BirdCoder desktop runtime is unavailable. Launch the desktop app with "pnpm dev:desktop" so Tauri can start the embedded local API and expose desktop_runtime_config.',
    );
  }

  try {
    const runtimeConfig = await invoke<{ apiBaseUrl?: string | null }>('desktop_runtime_config');
    const apiBaseUrl = normalizeBirdCoderServerBaseUrl(runtimeConfig?.apiBaseUrl);
    if (!apiBaseUrl) {
      throw new Error('BirdCoder desktop runtime config did not provide an API base URL.');
    }

    return { apiBaseUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to resolve BirdCoder desktop runtime API base URL: ${message}`,
    );
  }
}

export async function readDesktopRuntimeConfig(
  options: ReadDesktopRuntimeConfigOptions = {},
): Promise<DesktopRuntimeConfig> {
  const topology = resolveBirdCoderRuntimeTopology({
    deploymentProfile: options.deploymentProfile,
    executionLocation: options.executionLocation,
    runtimeTarget: 'desktop',
  });
  if (topology.executionLocation === 'cloud-workspace') {
    const apiBaseUrl = normalizeBirdCoderServerBaseUrl(
      options.configuredApiBaseUrl ?? readConfiguredBirdCoderApiBaseUrl(),
    );
    if (!apiBaseUrl) {
      throw new Error(
        'BirdCoder remote desktop requires a configured application API base URL.',
      );
    }
    return { ...topology, apiBaseUrl };
  }

  const embeddedRuntime = await readDesktopEmbeddedRuntimeConfig();
  return { ...topology, apiBaseUrl: embeddedRuntime.apiBaseUrl };
}
