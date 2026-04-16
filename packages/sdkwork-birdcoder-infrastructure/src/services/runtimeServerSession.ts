const RUNTIME_SERVER_SESSION_STORAGE_KEY = 'birdcoder.server.user-center.session.v1';
const RUNTIME_SERVER_SESSION_HEADER_NAME = 'x-birdcoder-session-id';

let runtimeServerSessionIdMemory: string | null = null;

function getLocalStorage(): Storage | null {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    return null;
  }

  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function normalizeSessionId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function getRuntimeServerSessionHeaderName(): string {
  return RUNTIME_SERVER_SESSION_HEADER_NAME;
}

export function readRuntimeServerSessionId(): string | null {
  const storage = getLocalStorage();
  const storedValue = storage?.getItem(RUNTIME_SERVER_SESSION_STORAGE_KEY);
  const normalizedStoredValue = normalizeSessionId(storedValue);
  if (normalizedStoredValue) {
    runtimeServerSessionIdMemory = normalizedStoredValue;
    return normalizedStoredValue;
  }

  return runtimeServerSessionIdMemory;
}

export function writeRuntimeServerSessionId(sessionId: string): string {
  const normalizedSessionId = normalizeSessionId(sessionId);
  if (!normalizedSessionId) {
    throw new Error('Runtime server session id must not be empty.');
  }

  runtimeServerSessionIdMemory = normalizedSessionId;
  getLocalStorage()?.setItem(RUNTIME_SERVER_SESSION_STORAGE_KEY, normalizedSessionId);
  return normalizedSessionId;
}

export function clearRuntimeServerSessionId(): void {
  runtimeServerSessionIdMemory = null;
  getLocalStorage()?.removeItem(RUNTIME_SERVER_SESSION_STORAGE_KEY);
}

export function resolveRuntimeServerSessionHeaders(): Record<string, string | undefined> {
  return {
    [RUNTIME_SERVER_SESSION_HEADER_NAME]: readRuntimeServerSessionId() ?? undefined,
  };
}
