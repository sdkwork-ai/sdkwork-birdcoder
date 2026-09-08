import { resolveBaseUrl } from '@sdkwork/sdk-common';

const BIRDCODER_APPLICATION_HTTP_ENV =
  'VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL';
const BIRDCODER_PLATFORM_HTTP_ENV =
  'VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL';
const BIRDCODER_DEPLOYMENT_PROFILE_ENV =
  'VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE';
/** Single shared API base-url key resolved through `@sdkwork/sdk-common`. */
const SDKWORK_API_BASE_URL_ENV = 'SDKWORK_API_BASE_URL';
const GENERATED_APP_API_PATH = '/app/v3/api';
const FORBIDDEN_BROWSER_PROXY_SELECTOR_PATH = /^\/(?:__sdkwork|proxy|gateway|platform)(?:\/|$)/u;

interface BirdCoderRuntimeEnvGlobal {
  __BIRDCODER_ENV__?: Record<string, unknown>;
  __SDKWORK_H5_REACT_ENV__?: Record<string, unknown>;
  __SDKWORK_PC_REACT_ENV__?: Record<string, unknown>;
}

export interface ResolveBirdCoderDependencySdkBaseUrlOptions {
  dependencyApiBaseUrl?: string;
  overrideEnvNames?: readonly string[];
  platformApiGatewayBaseUrl?: string;
}

function readNonBlankString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized || undefined;
}

function readRuntimeEnvFromWindow(name: string): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const runtimeWindow = window as Window & BirdCoderRuntimeEnvGlobal;
  return readNonBlankString(
    runtimeWindow.__BIRDCODER_ENV__?.[name]
      ?? runtimeWindow.__SDKWORK_H5_REACT_ENV__?.[name]
      ?? runtimeWindow.__SDKWORK_PC_REACT_ENV__?.[name],
  );
}

export function readBirdCoderRuntimeEnv(name: string): string | undefined {
  const windowValue = readRuntimeEnvFromWindow(name);
  if (windowValue) {
    return windowValue;
  }

  const meta = import.meta as ImportMeta & {
    env?: Record<string, string | boolean | undefined>;
  };
  return readNonBlankString(meta.env?.[name]);
}

/**
 * Resolve the shared SDK API base url through `@sdkwork/sdk-common`.
 *
 * `SDKWORK_API_BASE_URL` is the single supported base-url key; the per-app
 * `VITE_SDKWORK_<APP>_APP_API_BASE_URL` keys are deprecated and only survive
 * as a lower-priority fallback. The shared resolver picks the API host that
 * matches the current page environment + brand, preferring the current
 * protocol, and returns a bare gateway origin — generated SDK clients append
 * `/app/v3/api` themselves, so path preservation stays off.
 *
 * Returns `undefined` when the shared key is not configured so callers keep
 * their explicit "base url is required" error instead of inventing a host.
 */
export function resolveBirdCoderSharedSdkBaseUrl(): string | undefined {
  if (!readBirdCoderRuntimeEnv(SDKWORK_API_BASE_URL_ENV)) {
    return undefined;
  }

  const { url } = resolveBaseUrl({
    envKey: SDKWORK_API_BASE_URL_ENV,
    readEnv: readBirdCoderRuntimeEnv,
  });
  return url || undefined;
}

function parseBirdCoderSdkBaseUrl(value: string, label: string): URL {
  if (value.startsWith('/')) {
    if (FORBIDDEN_BROWSER_PROXY_SELECTOR_PATH.test(value)) {
      throw new Error(
        `${label} must preserve canonical API paths; browser-visible proxy selector paths are forbidden.`,
      );
    }
    if (typeof window === 'undefined' || !window.location?.origin) {
      throw new Error(`${label} cannot use a browser-relative URL outside a browser runtime.`);
    }
    return new URL(value, window.location.origin);
  }

  try {
    return new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute HTTP(S) gateway URL.`);
  }
}

/** Validates a gateway root without rewriting an API path or selecting a fallback. */
export function normalizeBirdCoderSdkBaseUrl(
  value: string | null | undefined,
  label = 'SDK base URL',
): string | undefined {
  const normalizedValue = readNonBlankString(value);
  if (!normalizedValue) {
    return undefined;
  }

  const parsedUrl = parseBirdCoderSdkBaseUrl(normalizedValue, label);
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(`${label} must use the HTTP or HTTPS protocol.`);
  }
  if (parsedUrl.username || parsedUrl.password) {
    throw new Error(`${label} must not contain embedded credentials.`);
  }
  if (parsedUrl.search || parsedUrl.hash) {
    throw new Error(`${label} must not contain a query string or fragment.`);
  }

  const pathname = parsedUrl.pathname.replace(/\/+$/u, '');
  if (FORBIDDEN_BROWSER_PROXY_SELECTOR_PATH.test(pathname)) {
    throw new Error(
      `${label} must preserve canonical API paths; browser-visible proxy selector paths are forbidden.`,
    );
  }
  if (pathname.endsWith(GENERATED_APP_API_PATH)) {
    throw new Error(
      `${label} must identify the gateway root; generated SDKs append ${GENERATED_APP_API_PATH}.`,
    );
  }

  return pathname && pathname !== '/'
    ? `${parsedUrl.origin}${pathname}`
    : parsedUrl.origin;
}

function requireBirdCoderSdkBaseUrl(
  value: string | null | undefined,
  label: string,
  envNames: readonly string[],
): string {
  const normalized = normalizeBirdCoderSdkBaseUrl(value, label);
  if (normalized) {
    return normalized;
  }

  throw new Error(
    `${label} is required. Configure ${envNames.join(' or ')} before SDK bootstrap.`,
  );
}

export function resolveBirdCoderApplicationSdkBaseUrl(explicit?: string): string {
  return requireBirdCoderSdkBaseUrl(
    explicit
      ?? resolveBirdCoderSharedSdkBaseUrl()
      ?? readBirdCoderRuntimeEnv(BIRDCODER_APPLICATION_HTTP_ENV),
    'BirdCoder application SDK base URL',
    [SDKWORK_API_BASE_URL_ENV, BIRDCODER_APPLICATION_HTTP_ENV],
  );
}

export function resolveBirdCoderPlatformSdkBaseUrl(explicit?: string): string {
  if (readBirdCoderRuntimeEnv(BIRDCODER_DEPLOYMENT_PROFILE_ENV) === 'standalone') {
    return resolveBirdCoderApplicationSdkBaseUrl();
  }
  return requireBirdCoderSdkBaseUrl(
    explicit
      ?? resolveBirdCoderSharedSdkBaseUrl()
      ?? readBirdCoderRuntimeEnv(BIRDCODER_PLATFORM_HTTP_ENV),
    'SDKWork platform API gateway base URL',
    [SDKWORK_API_BASE_URL_ENV, BIRDCODER_PLATFORM_HTTP_ENV],
  );
}

export function resolveBirdCoderDependencySdkBaseUrl(
  dependencyName: string,
  options: ResolveBirdCoderDependencySdkBaseUrlOptions = {},
): string {
  if (readBirdCoderRuntimeEnv(BIRDCODER_DEPLOYMENT_PROFILE_ENV) === 'standalone') {
    return resolveBirdCoderApplicationSdkBaseUrl();
  }

  const overrideEnvNames = options.overrideEnvNames ?? [];
  const overrideFromEnv = overrideEnvNames
    .map((envName) => readBirdCoderRuntimeEnv(envName))
    .find((value): value is string => Boolean(value));
  const dependencyOverride = options.dependencyApiBaseUrl
    ?? resolveBirdCoderSharedSdkBaseUrl()
    ?? overrideFromEnv;
  if (dependencyOverride) {
    return requireBirdCoderSdkBaseUrl(
      dependencyOverride,
      `${dependencyName} app SDK base URL`,
      [SDKWORK_API_BASE_URL_ENV, ...overrideEnvNames],
    );
  }

  return requireBirdCoderSdkBaseUrl(
    options.platformApiGatewayBaseUrl
      ?? resolveBirdCoderSharedSdkBaseUrl()
      ?? readBirdCoderRuntimeEnv(BIRDCODER_PLATFORM_HTTP_ENV),
    `${dependencyName} app SDK base URL`,
    [SDKWORK_API_BASE_URL_ENV, ...overrideEnvNames, BIRDCODER_PLATFORM_HTTP_ENV],
  );
}
