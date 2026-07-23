import {
  BIRDCODER_PLATFORM_DEV_PROXY_PATH,
  normalizeBirdCoderSdkBaseUrl,
  resolveBirdCoderPlatformSdkBaseUrl,
  resolveBirdCoderRuntimeTopology,
  type BirdCoderDeploymentProfile,
  type BirdCoderExecutionLocation,
  type BirdCoderRuntimeTopology,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import {
  readConfiguredBirdCoderApplicationApiBaseUrl,
  readConfiguredBirdCoderPlatformApiGatewayBaseUrl,
} from './bootstrapPublicRuntimeConfig.ts';

type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
type TauriWindow = Window & typeof globalThis & {
  __TAURI__?: { core?: { invoke?: TauriInvoke } };
  __TAURI_INTERNALS__?: { invoke?: TauriInvoke };
};

type BirdCoderRuntimeGlobal = typeof globalThis & {
  __SDKWORK_PC_REACT_ENV__?: Record<string, string>;
};

export interface DesktopEmbeddedRuntimeConfig {
  applicationApiBaseUrl: string;
}

export interface DesktopRuntimeConfig extends BirdCoderRuntimeTopology {
  applicationApiBaseUrl: string;
  platformApiGatewayBaseUrl: string;
}

export interface ReadDesktopRuntimeConfigOptions {
  configuredApplicationApiBaseUrl?: string;
  configuredPlatformApiGatewayBaseUrl?: string;
  deploymentProfile?: BirdCoderDeploymentProfile;
  executionLocation?: BirdCoderExecutionLocation;
}

function resolveBootstrapTauriInvokeFromWindow(): TauriInvoke | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const tauriWindow = window as TauriWindow;
  const invoke = tauriWindow.__TAURI__?.core?.invoke
    ?? tauriWindow.__TAURI_INTERNALS__?.invoke
    ?? null;
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

export function publishBirdCoderDesktopSdkRuntimeEnv(
  config: DesktopRuntimeConfig,
): void {
  publishBirdCoderRuntimeEnvPatch({
    VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL:
      config.applicationApiBaseUrl,
    VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL:
      config.platformApiGatewayBaseUrl,
    VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE: config.deploymentProfile,
    VITE_SDKWORK_BIRDCODER_EXECUTION_LOCATION: config.executionLocation,
    VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET: config.runtimeTarget,
  });
}

export async function readDesktopEmbeddedRuntimeConfig(): Promise<DesktopEmbeddedRuntimeConfig> {
  const invoke = await resolveBootstrapTauriInvoke();
  if (!invoke) {
    throw new Error(
      'BirdCoder desktop runtime is unavailable. Launch the desktop app with "pnpm dev:desktop" so Tauri can expose desktop_runtime_config.',
    );
  }

  try {
    const runtimeConfig = await invoke<{ apiBaseUrl?: string | null }>(
      'desktop_runtime_config',
    );
    const applicationApiBaseUrl = normalizeBirdCoderSdkBaseUrl(
      runtimeConfig?.apiBaseUrl,
      'BirdCoder embedded application SDK base URL',
    );
    if (!applicationApiBaseUrl) {
      throw new Error(
        'BirdCoder desktop runtime config did not provide an application API base URL.',
      );
    }
    return { applicationApiBaseUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to resolve BirdCoder desktop application API base URL: ${message}`,
    );
  }
}

function resolveDesktopPlatformApiGatewayBaseUrl(
  configuredBaseUrl?: string,
): string {
  const platformApiGatewayBaseUrl = resolveBirdCoderPlatformSdkBaseUrl(
    configuredBaseUrl ?? readConfiguredBirdCoderPlatformApiGatewayBaseUrl(),
  );
  if (new URL(platformApiGatewayBaseUrl).pathname.startsWith(
    BIRDCODER_PLATFORM_DEV_PROXY_PATH,
  )) {
    throw new Error(
      'BirdCoder desktop requires a direct SDKWork platform API gateway URL, not the browser development proxy.',
    );
  }
  return platformApiGatewayBaseUrl;
}

export async function readDesktopRuntimeConfig(
  options: ReadDesktopRuntimeConfigOptions = {},
): Promise<DesktopRuntimeConfig> {
  const topology = resolveBirdCoderRuntimeTopology({
    deploymentProfile: options.deploymentProfile,
    executionLocation: options.executionLocation,
    runtimeTarget: 'desktop',
  });
  const platformApiGatewayBaseUrl = resolveDesktopPlatformApiGatewayBaseUrl(
    options.configuredPlatformApiGatewayBaseUrl,
  );

  if (topology.executionLocation === 'cloud-workspace') {
    const applicationApiBaseUrl = normalizeBirdCoderSdkBaseUrl(
      options.configuredApplicationApiBaseUrl
        ?? readConfiguredBirdCoderApplicationApiBaseUrl(),
      'BirdCoder remote application SDK base URL',
    );
    if (!applicationApiBaseUrl) {
      throw new Error(
        'BirdCoder remote desktop requires a configured application API base URL.',
      );
    }
    return {
      ...topology,
      applicationApiBaseUrl,
      platformApiGatewayBaseUrl,
    };
  }

  const embeddedRuntime = await readDesktopEmbeddedRuntimeConfig();
  return {
    ...topology,
    applicationApiBaseUrl: embeddedRuntime.applicationApiBaseUrl,
    platformApiGatewayBaseUrl,
  };
}
