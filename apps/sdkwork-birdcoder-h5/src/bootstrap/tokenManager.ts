export interface TokenManager {
  accessToken: string | null;
  refreshToken: string | null;
  setTokens: (access: string, refresh?: string) => void;
  clearTokens: () => void;
}

export function createTokenManager(): TokenManager {
  // One global TokenManager per authenticated session
  // Follows APP_SDK_INTEGRATION_SPEC.md
  let accessToken: string | null = null;
  let refreshToken: string | null = null;

  return {
    get accessToken() { return accessToken; },
    get refreshToken() { return refreshToken; },
    setTokens(access: string, refresh?: string) {
      accessToken = access;
      refreshToken = refresh ?? null;
    },
    clearTokens() {
      accessToken = null;
      refreshToken = null;
    },
  };
}
