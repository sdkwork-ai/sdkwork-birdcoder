export const H5_CORE_VERSION = '0.1.0';

export interface H5CoreConfig {
  apiBaseUrl: string;
  appVersion: string;
  environment: string;
}

export function createDefaultH5CoreConfig(): H5CoreConfig {
  return {
    apiBaseUrl: 'http://localhost:3000',
    appVersion: '0.1.0',
    environment: 'development',
  };
}

export { resolveBirdCoderH5Environment } from './bootstrap/environment.ts';
export {
  normalizeBirdCoderServerBaseUrl,
  readStoredBirdCoderServerBaseUrl,
  resolveBirdCoderBootstrapServerBaseUrl,
} from './bootstrap/serverBaseUrl.ts';
export { waitForBirdCoderApiReady } from './bootstrap/apiReady.ts';
export {
  bindBirdCoderH5AppSessionPersistence,
  hydrateBirdCoderH5AppSessionPersistence,
} from './bootstrap/appSessionPersistenceBinding.ts';
export { startBirdCoderAuthDeepLinkRouting } from './bootstrap/authDeepLinkBootstrap.ts';
export {
  BIRDCODER_H5_OAUTH_CALLBACK_AUTHORITY,
  BIRDCODER_H5_OAUTH_CALLBACK_PATH,
  BIRDCODER_H5_OAUTH_SCHEME,
  buildBirdCoderH5OAuthCallbackReturnUrl,
  normalizeBirdCoderH5AuthDeepLinkPath,
} from './bootstrap/authOAuthDeepLink.ts';
export { bootstrapShellRuntime } from './bootstrap/shellRuntime.ts';
export {
  createBirdCoderIamRuntime,
  createBirdCoderIamRuntimeComposition,
  getBirdCoderIamRuntime,
  resetBirdCoderIamRuntime,
} from './bootstrap/iamRuntime.ts';
export {
  getBirdCoderGlobalTokenManager,
  type BirdCoderTokenManager,
} from './bootstrap/tokenManager.ts';
export {
  createBirdCoderH5AppSdkClient,
  type BirdCoderH5AppSdkClient,
} from './sdk/appSdkClient.ts';
export {
  BIRDCODER_AUTH_BASE_PATH,
  createBirdCoderAuthRouteCatalog,
  createBirdCoderH5RouteCatalog,
  type BirdCoderH5RouteDefinition,
} from './routes/routeCatalog.ts';
export {
  createDefaultHostAdapters,
  createHostAdapters,
  type HostAdapters,
} from './host/hostAdapters.ts';
export {
  bindBirdCoderDeepLinkAdapter,
  createBrowserDeepLinkAdapter,
  createUnavailableDeepLinkAdapter,
  getBirdCoderDeepLinkAdapter,
  resetBirdCoderDeepLinkAdapter,
  type DeepLinkHostAdapter,
} from './host/deepLinkAdapter.ts';
export {
  APP_SESSION_STORAGE_KEY,
  bindBirdCoderSecureStorageAdapter,
  createBrowserSecureStorageAdapter,
  getBirdCoderSecureStorageAdapter,
  resetBirdCoderSecureStorageAdapter,
  SecureStorageHostError,
  type SecureStorageErrorCode,
  type SecureStorageHostAdapter,
} from './host/secureStorageAdapter.ts';
export {
  BIRDCODER_AUTH_SESSION_KEY,
  clearBirdCoderSessionRecord,
  readBirdCoderSessionRecord,
  writeBirdCoderSessionRecord,
  type BirdCoderSessionRecord,
} from './session/birdCoderSessionStorage.ts';
