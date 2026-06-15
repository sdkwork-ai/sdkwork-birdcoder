class IamRuntime {
  final bool initialized;

  IamRuntime({required this.initialized});

  static IamRuntime create() {
    // IAM runtime wiring follows APP_SDK_INTEGRATION_SPEC.md and IAM_LOGIN_INTEGRATION_SPEC.md
    // Appbase IAM runtime owns login/session/refresh/logout
    return IamRuntime(initialized: true);
  }

  Future<void> login() async {}
  Future<void> logout() async {}
  Future<void> refreshToken() async {}
}
