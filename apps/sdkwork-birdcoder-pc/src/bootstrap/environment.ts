import { getDefaultBirdCoderIdeServicesRuntimeConfig } from '@sdkwork/birdcoder-pc-infrastructure/services/defaultIdeServicesRuntime';

interface BirdCoderPublicRuntimeEnv {
  VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL?: string;
  VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL?: string;
  VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE?: string;
  VITE_SDKWORK_DEPLOYMENT_PROFILE?: string;
  VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET?: string;
  VITE_SDKWORK_RUNTIME_TARGET?: string;
}

export function resolveEnvironment() {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  const mode = import.meta.env.MODE || 'development';
  const runtimeGlobal = globalThis as typeof globalThis & {
    __SDKWORK_PC_REACT_ENV__?: BirdCoderPublicRuntimeEnv;
  };
  const publicRuntimeEnv = runtimeGlobal.__SDKWORK_PC_REACT_ENV__;

  return {
    applicationApiBaseUrl:
      runtimeConfig.applicationApiBaseUrl
      ?? publicRuntimeEnv?.VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL,
    deploymentProfile:
      publicRuntimeEnv?.VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE
      ?? publicRuntimeEnv?.VITE_SDKWORK_DEPLOYMENT_PROFILE
      ?? 'cloud',
    environment: mode,
    executionAuthorityMode: runtimeConfig.executionAuthorityMode ?? 'auto',
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD,
    mode,
    platformApiGatewayBaseUrl:
      runtimeConfig.platformApiGatewayBaseUrl
      ?? publicRuntimeEnv?.VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL,
    runtimeTarget:
      publicRuntimeEnv?.VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET
      ?? publicRuntimeEnv?.VITE_SDKWORK_RUNTIME_TARGET
      ?? 'browser',
  };
}
