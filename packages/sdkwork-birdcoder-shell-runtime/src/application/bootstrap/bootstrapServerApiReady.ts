const DEFAULT_API_READY_MAX_ATTEMPTS = 30;
const DEFAULT_API_READY_REQUEST_TIMEOUT_MS = 800;
const DEFAULT_API_READY_RETRY_DELAY_MS = 150;
const DEFAULT_API_READY_PATHS = ['/api/core/v1/health', '/api/app/v1/auth/config'] as const;
const LOCAL_RUNTIME_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'tauri.localhost']);

export interface WaitForBirdCoderApiReadyOptions {
  maxAttempts?: number;
  paths?: readonly string[];
  requestTimeoutMs?: number;
  retryDelayMs?: number;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, milliseconds);
  });
}

function normalizePositiveInteger(value: number | undefined, fallbackValue: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallbackValue;
  }

  return Math.floor(value);
}

function resolveReadinessPaths(paths?: readonly string[]): readonly string[] {
  if (!paths || paths.length === 0) {
    return DEFAULT_API_READY_PATHS;
  }

  return paths
    .map((path) => path.trim())
    .filter((path) => path.length > 0);
}

function hasFetchSupport(): boolean {
  return typeof globalThis.fetch === 'function';
}

export function isBirdCoderLocalRuntimeApiBaseUrl(apiBaseUrl: string): boolean {
  try {
    const parsedUrl = new URL(apiBaseUrl);
    return LOCAL_RUNTIME_HOSTNAMES.has(parsedUrl.hostname);
  } catch {
    return false;
  }
}

export async function waitForBirdCoderApiReady(
  apiBaseUrl?: string,
  options: WaitForBirdCoderApiReadyOptions = {},
): Promise<void> {
  if (!apiBaseUrl || !isBirdCoderLocalRuntimeApiBaseUrl(apiBaseUrl) || !hasFetchSupport()) {
    return;
  }

  const readinessPaths = resolveReadinessPaths(options.paths);
  if (readinessPaths.length === 0) {
    return;
  }

  const readinessUrls = readinessPaths.map((path) => new URL(path, apiBaseUrl).toString());
  const maxAttempts = normalizePositiveInteger(options.maxAttempts, DEFAULT_API_READY_MAX_ATTEMPTS);
  const requestTimeoutMs = normalizePositiveInteger(
    options.requestTimeoutMs,
    DEFAULT_API_READY_REQUEST_TIMEOUT_MS,
  );
  const retryDelayMs = normalizePositiveInteger(
    options.retryDelayMs,
    DEFAULT_API_READY_RETRY_DELAY_MS,
  );

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const responses = await Promise.all(
        readinessUrls.map(async (url) => {
          const abortController =
            typeof AbortController === 'function' ? new AbortController() : undefined;
          const timeoutHandle = globalThis.setTimeout(() => {
            abortController?.abort();
          }, requestTimeoutMs);

          try {
            return await globalThis.fetch(url, {
              cache: 'no-store',
              signal: abortController?.signal,
            });
          } finally {
            globalThis.clearTimeout(timeoutHandle);
          }
        }),
      );

      if (responses.every((response) => response.ok)) {
        return;
      }
    } catch {
      // Local desktop/web runtimes can publish the gateway base URL slightly before the
      // embedded HTTP server begins serving traffic.
    }

    await delay(retryDelayMs);
  }
}
