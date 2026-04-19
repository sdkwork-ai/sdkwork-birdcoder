function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export function isBirdCoderTransientApiError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('timed out') ||
    error.message.includes('Failed to fetch') ||
    error.message.includes('fetch failed') ||
    error.message.includes('NetworkError') ||
    error.message.includes(' -> 502') ||
    error.message.includes(' -> 503') ||
    error.message.includes(' -> 504')
  );
}

export interface RetryBirdCoderTransientApiTaskOptions {
  attempts?: number;
  factor?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

export async function retryBirdCoderTransientApiTask<T>(
  task: () => Promise<T>,
  options: RetryBirdCoderTransientApiTaskOptions = {},
): Promise<T> {
  const attempts = Math.max(1, Math.floor(options.attempts ?? 4));
  const factor = Math.max(1, options.factor ?? 2);
  const maxDelayMs = Math.max(0, Math.floor(options.maxDelayMs ?? 1_200));
  let nextDelayMs = Math.max(0, Math.floor(options.initialDelayMs ?? 150));
  const shouldRetry = options.shouldRetry ?? isBirdCoderTransientApiError;

  for (let attemptIndex = 0; attemptIndex < attempts; attemptIndex += 1) {
    try {
      return await task();
    } catch (error) {
      const isLastAttempt = attemptIndex >= attempts - 1;
      if (isLastAttempt || !shouldRetry(error)) {
        throw error;
      }

      if (nextDelayMs > 0) {
        await delay(nextDelayMs);
      }
      nextDelayMs = Math.min(maxDelayMs, nextDelayMs * factor);
    }
  }

  throw new Error('BirdCoder transient retry task exhausted without returning a result.');
}
