const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const READY_PATH = '/readyz';

export interface WaitForBirdCoderApiReadyOptions {
  maxAttempts?: number;
  requestTimeoutMs?: number;
  retryDelayMs?: number;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

function isLocalApi(baseUrl: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(baseUrl).hostname);
  } catch {
    return false;
  }
}

export async function waitForBirdCoderApiReady(
  apiBaseUrl?: string,
  options: WaitForBirdCoderApiReadyOptions = {},
): Promise<void> {
  if (!apiBaseUrl || !isLocalApi(apiBaseUrl) || typeof globalThis.fetch !== 'function') {
    return;
  }
  const maxAttempts = positiveInteger(options.maxAttempts, 30);
  const requestTimeoutMs = positiveInteger(options.requestTimeoutMs, 800);
  const retryDelayMs = positiveInteger(options.retryDelayMs, 150);
  const readyUrl = new URL(READY_PATH, `${apiBaseUrl.replace(/\/+$/u, '')}/`).toString();
  let lastFailure = 'readiness request did not complete';

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await globalThis.fetch(readyUrl, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (response.ok) {
        return;
      }
      lastFailure = `HTTP ${response.status}`;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : 'request failed';
    } finally {
      globalThis.clearTimeout(timeout);
    }
    await delay(retryDelayMs);
  }
  throw new Error(`BirdCoder H5 API is unavailable at ${apiBaseUrl}: ${lastFailure}.`);
}
