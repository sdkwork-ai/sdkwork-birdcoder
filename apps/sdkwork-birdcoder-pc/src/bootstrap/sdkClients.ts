export interface SdkClients {
  appSdk: unknown;
  backendSdk: unknown;
}

export function createSdkClients(): SdkClients {
  // SDK clients are constructed here per APP_SDK_INTEGRATION_SPEC.md
  // Generated SDK clients are injected through service/runtime boundaries
  return {
    appSdk: null,
    backendSdk: null,
  };
}
