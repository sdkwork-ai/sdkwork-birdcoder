export function createRuntime() {
  return {
    apiBaseUrl: resolveApiBaseUrl(),
  };
}

function resolveApiBaseUrl(): string {
  const global = globalThis as Record<string, unknown>;
  const env = global.__SDKWORK_PC_REACT_ENV__ as Record<string, string> | undefined;
  return (
    env?.VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL
    || env?.VITE_BIRDCODER_API_BASE_URL
    || 'http://localhost:10240'
  );
}
