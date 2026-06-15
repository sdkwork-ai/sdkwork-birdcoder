class TokenManager {
  // One global token-manager equivalent per authenticated session
  // Follows APP_SDK_INTEGRATION_SPEC.md
  String? _accessToken;
  String? _refreshToken;

  String? get accessToken => _accessToken;
  String? get refreshToken => _refreshToken;

  void setTokens({required String accessToken, String? refreshToken}) {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
  }

  void clearTokens() {
    _accessToken = null;
    _refreshToken = null;
  }

  static TokenManager create() {
    return TokenManager();
  }
}
