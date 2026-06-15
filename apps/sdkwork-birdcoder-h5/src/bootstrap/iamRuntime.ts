export interface IamRuntime {
  initialized: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

export function createIamRuntime(): IamRuntime {
  // IAM runtime wiring follows APP_SDK_INTEGRATION_SPEC.md and IAM_LOGIN_INTEGRATION_SPEC.md
  // Appbase IAM runtime owns login/session/refresh/logout
  return {
    initialized: true,
    login: async () => {},
    logout: async () => {},
    refreshToken: async () => {},
  };
}
