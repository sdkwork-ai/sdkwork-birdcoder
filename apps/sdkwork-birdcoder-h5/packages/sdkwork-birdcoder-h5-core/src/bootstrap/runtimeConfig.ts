export interface BirdCoderH5RuntimeConfig {
  agentsAppApiBaseUrl?: string;
  apiBaseUrl?: string;
  appbaseAppApiBaseUrl?: string;
  driveAppApiBaseUrl?: string;
  executionAuthorityMode?: 'auto' | 'remote-required';
}

interface BirdCoderPublicRuntimeEnv {
  VITE_BIRDCODER_API_BASE_URL?: string;
  VITE_SDKWORK_AGENTS_APP_API_BASE_URL?: string;
  VITE_SDKWORK_APPBASE_APP_API_BASE_URL?: string;
  VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL?: string;
  VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL?: string;
  VITE_SDKWORK_DRIVE_APP_API_BASE_URL?: string;
  VITE_SDKWORK_IAM_APP_API_BASE_URL?: string;
}

let boundRuntimeConfig: BirdCoderH5RuntimeConfig = {};

function readPublicRuntimeEnv(): BirdCoderPublicRuntimeEnv {
  const host = globalThis as typeof globalThis & {
    __SDKWORK_H5_REACT_ENV__?: BirdCoderPublicRuntimeEnv;
  };
  return host.__SDKWORK_H5_REACT_ENV__ ?? {};
}

function firstNonBlank(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      return normalized.replace(/\/+$/u, '');
    }
  }
  return undefined;
}

function defaultBrowserOrigin(): string | undefined {
  return typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : undefined;
}

function resolveRequiredDependencyApiBaseUrl(
  dependencyName: string,
  ...values: Array<string | undefined>
): string {
  const value = firstNonBlank(...values);
  if (!value) {
    throw new Error(
      `${dependencyName} H5 API base URL is required. Configure its SDK URL or the platform API gateway URL.`,
    );
  }
  return value;
}

export function bindBirdCoderH5RuntimeConfig(config: BirdCoderH5RuntimeConfig): void {
  boundRuntimeConfig = {
    ...boundRuntimeConfig,
    ...config,
  };
}

export function getBirdCoderH5RuntimeConfig(): BirdCoderH5RuntimeConfig {
  return { ...boundRuntimeConfig };
}

export function resolveBirdCoderH5ApplicationApiBaseUrl(): string {
  const env = readPublicRuntimeEnv();
  const value = firstNonBlank(
    boundRuntimeConfig.apiBaseUrl,
    env.VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL,
    env.VITE_BIRDCODER_API_BASE_URL,
    defaultBrowserOrigin(),
  );
  if (!value) {
    throw new Error('BirdCoder H5 application API base URL is required.');
  }
  return value;
}

export function resolveBirdCoderH5AgentsAppApiBaseUrl(): string {
  const env = readPublicRuntimeEnv();
  const configured = resolveRequiredDependencyApiBaseUrl(
    'Agents',
    boundRuntimeConfig.agentsAppApiBaseUrl,
    env.VITE_SDKWORK_AGENTS_APP_API_BASE_URL,
    env.VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL,
  );
  return configured.endsWith('/app/v3/api')
    ? configured
    : `${configured}/app/v3/api`;
}

export function resolveBirdCoderH5DriveAppApiBaseUrl(): string {
  const env = readPublicRuntimeEnv();
  return resolveRequiredDependencyApiBaseUrl(
    'Drive',
    boundRuntimeConfig.driveAppApiBaseUrl,
    env.VITE_SDKWORK_DRIVE_APP_API_BASE_URL,
    env.VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL,
  );
}

export function resolveBirdCoderH5AppbaseAppApiBaseUrl(): string {
  const env = readPublicRuntimeEnv();
  return resolveRequiredDependencyApiBaseUrl(
    'IAM',
    boundRuntimeConfig.appbaseAppApiBaseUrl,
    env.VITE_SDKWORK_APPBASE_APP_API_BASE_URL,
    env.VITE_SDKWORK_IAM_APP_API_BASE_URL,
    env.VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL,
  );
}
