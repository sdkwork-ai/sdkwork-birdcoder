import { getDefaultBirdCoderIdeServicesRuntimeConfig } from '@sdkwork/birdcoder-pc-infrastructure';

interface BirdCoderPublicRuntimeEnv {
  VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL?: string;
  VITE_BIRDCODER_API_BASE_URL?: string;
  VITE_SDKWORK_DEPLOYMENT_PROFILE?: string;
  VITE_SDKWORK_RUNTIME_TARGET?: string;
}

export function resolveBirdCoderH5Environment() {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  const mode = import.meta.env.MODE || 'development';
  const runtimeGlobal = globalThis as typeof globalThis & {
    __SDKWORK_H5_REACT_ENV__?: BirdCoderPublicRuntimeEnv;
  };
  const publicRuntimeEnv = runtimeGlobal.__SDKWORK_H5_REACT_ENV__;

  return {
    apiBaseUrl:
      runtimeConfig.apiBaseUrl
      ?? publicRuntimeEnv?.VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL
      ?? publicRuntimeEnv?.VITE_BIRDCODER_API_BASE_URL,
    deploymentProfile: publicRuntimeEnv?.VITE_SDKWORK_DEPLOYMENT_PROFILE ?? 'cloud',
    environment: mode,
    executionAuthorityMode: runtimeConfig.executionAuthorityMode ?? 'auto',
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD,
    mode,
    runtimeTarget: publicRuntimeEnv?.VITE_SDKWORK_RUNTIME_TARGET ?? 'h5',
  };
}
