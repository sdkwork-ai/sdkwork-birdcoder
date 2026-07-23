import { normalizeBirdCoderSdkBaseUrl } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

export interface BirdCoderPublicRuntimeEnv {
  DEV?: string;
  MODE?: string;
  VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL?: string;
  VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL?: string;
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

export function readConfiguredBirdCoderApplicationApiBaseUrl(): string | undefined {
  return normalizeBirdCoderSdkBaseUrl(
    readBirdCoderPublicRuntimeEnv()
      ?.VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL,
    'BirdCoder application SDK base URL',
  );
}

export function readConfiguredBirdCoderPlatformApiGatewayBaseUrl(): string | undefined {
  return normalizeBirdCoderSdkBaseUrl(
    readBirdCoderPublicRuntimeEnv()
      ?.VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL,
    'SDKWork platform API gateway base URL',
  );
}
