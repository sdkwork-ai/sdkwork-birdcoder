export function createRuntime() {
  return {
    apiBaseUrl: resolveApiBaseUrl(),
  };
}

function resolveApiBaseUrl(): string {
  return import.meta.env.VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL
    || import.meta.env.VITE_BIRDCODER_API_BASE_URL
    || 'http://localhost:3000';
}
