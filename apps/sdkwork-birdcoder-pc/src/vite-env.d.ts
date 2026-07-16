/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BIRDCODER_API_BASE_URL?: string;
  readonly VITE_SDKWORK_BIRDCODER_REALTIME_TRANSPORT?: 'auto' | 'sse' | 'websocket';
}
