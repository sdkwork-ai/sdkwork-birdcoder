export function createRuntime() {
  return {
    apiBaseUrl: resolveApiBaseUrl(),
  };
}

function resolveApiBaseUrl(): string {
  return import.meta.env.VITE_BIRDCODER_API_BASE_URL || 'http://localhost:3000';
}
