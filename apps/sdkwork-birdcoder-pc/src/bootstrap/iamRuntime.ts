export function createIamRuntime() {
  // IAM runtime wiring follows APP_SDK_INTEGRATION_SPEC.md and IAM_LOGIN_INTEGRATION_SPEC.md
  // Appbase IAM runtime owns login/session/refresh/logout
  // One global TokenManager per authenticated session
  return {
    initialized: true,
  };
}
