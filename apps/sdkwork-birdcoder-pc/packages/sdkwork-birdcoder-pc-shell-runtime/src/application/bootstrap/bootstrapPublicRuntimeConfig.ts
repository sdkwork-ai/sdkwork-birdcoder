import { normalizeBirdCoderServerBaseUrl } from './bootstrapServerBaseUrl.ts';
import type { BirdCoderRealtimeTransportPreference } from './bootstrapShellRuntime.ts';

export interface BirdCoderPublicRuntimeEnv {
  DEV?: string;
  MODE?: string;
  VITE_BIRDCODER_API_BASE_URL?: string;
  VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL?: string;
  VITE_SDKWORK_BIRDCODER_REALTIME_TRANSPORT?: string;
}

interface BirdCoderPublicRuntimeGlobal {
  __SDKWORK_PC_REACT_ENV__?: BirdCoderPublicRuntimeEnv;
}

function readBirdCoderPublicRuntimeEnv(): BirdCoderPublicRuntimeEnv | undefined {
  const runtimeGlobal = globalThis as typeof globalThis & BirdCoderPublicRuntimeGlobal;
  return runtimeGlobal.__SDKWORK_PC_REACT_ENV__;
}

export function isBirdCoderDevelopmentBrowserRuntime(): boolean {
  const runtimeEnv = readBirdCoderPublicRuntimeEnv();
  const mode = runtimeEnv?.MODE?.trim().toLowerCase();
  return runtimeEnv?.DEV === 'true' || mode === 'development' || mode === 'test';
}

export function readConfiguredBirdCoderApiBaseUrl(): string | undefined {
  const runtimeEnv = readBirdCoderPublicRuntimeEnv();
  return normalizeBirdCoderServerBaseUrl(
    runtimeEnv?.VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL
      ?? runtimeEnv?.VITE_BIRDCODER_API_BASE_URL,
  );
}

export function readConfiguredBirdCoderRealtimeTransport(): BirdCoderRealtimeTransportPreference {
  const configuredValue = readBirdCoderPublicRuntimeEnv()
    ?.VITE_SDKWORK_BIRDCODER_REALTIME_TRANSPORT
    ?.trim()
    .toLowerCase();
  return configuredValue === 'sse' || configuredValue === 'websocket'
    ? configuredValue
    : 'auto';
}
