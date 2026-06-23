import 'package:flutter/foundation.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_app_sdk_consumer/sdkwork_birdcoder_flutter_mobile_app_sdk_consumer.dart';

import 'token_manager.dart';

class BirdCoderIamRuntime extends ChangeNotifier {
  BirdCoderIamRuntime({
    required BirdCoderTokenManager tokenManager,
    String? apiBaseUrl,
  }) : _tokenManager = tokenManager,
        _apiBaseUrl = apiBaseUrl;

  final BirdCoderTokenManager _tokenManager;
  String? _apiBaseUrl;
  bool _initialized = false;
  bool _sessionValidated = false;

  bool get initialized => _initialized;
  bool get sessionPresent => _tokenManager.hasAccessToken;
  bool get sessionValidated => _sessionValidated;

  void bindApiBaseUrl(String apiBaseUrl) {
    _apiBaseUrl = apiBaseUrl;
  }

  Future<void> bootstrap() async {
    if (_initialized) {
      return;
    }

    await syncBirdCoderGlobalTokenManagerFromStorage();

    if (_tokenManager.hasAccessToken) {
      await validateStoredSession();
    }

    _initialized = true;
    notifyListeners();
  }

  Future<void> validateStoredSession() async {
    if (!_tokenManager.hasAccessToken) {
      _sessionValidated = false;
      notifyListeners();
      return;
    }

    final apiBaseUrl = _apiBaseUrl;
    if (apiBaseUrl == null || apiBaseUrl.isEmpty) {
      _sessionValidated = false;
      await _tokenManager.clearTokens();
      notifyListeners();
      return;
    }

    final accessToken = _tokenManager.accessToken;
    final authToken = _tokenManager.authToken ?? accessToken;
    if (accessToken == null || accessToken.isEmpty) {
      _sessionValidated = false;
      notifyListeners();
      return;
    }

    final valid = await _probeSessionWithGeneratedSdk(
      apiBaseUrl: apiBaseUrl,
      accessToken: accessToken,
      authToken: authToken,
    );

    if (!valid) {
      await _tokenManager.clearTokens();
      _sessionValidated = false;
      notifyListeners();
      return;
    }

    _sessionValidated = true;
    notifyListeners();
  }

  Future<void> login({
    required String accessToken,
    required String authToken,
    String? refreshToken,
    String? sessionId,
    int? expiresAt,
  }) async {
    await _tokenManager.setTokens(
      accessToken: accessToken,
      authToken: authToken,
      refreshToken: refreshToken,
      sessionId: sessionId,
      expiresAt: expiresAt,
    );
    _sessionValidated = true;
    notifyListeners();
  }

  Future<void> logout() async {
    await _tokenManager.clearTokens();
    _sessionValidated = false;
    notifyListeners();
  }

  Future<void> refreshToken() async {
    if (!_tokenManager.hasAccessToken) {
      await logout();
      return;
    }

    await validateStoredSession();
  }
}

Future<bool> _probeSessionWithGeneratedSdk({
  required String apiBaseUrl,
  required String accessToken,
  String? authToken,
  int requestTimeoutMs = 800,
}) async {
  final client = createBirdCoderAppSdkConsumer(
    apiBaseUrl: apiBaseUrl,
    authToken: authToken ?? accessToken,
    accessToken: accessToken,
  ).createClient();

  try {
    final runtime = await client.system
        .iamRuntimeRetrieve()
        .timeout(Duration(milliseconds: requestTimeoutMs));
    return runtime != null;
  } catch (_) {
    return false;
  }
}

BirdCoderIamRuntime createBirdCoderIamRuntime({
  BirdCoderTokenManager? tokenManager,
  String? apiBaseUrl,
}) {
  return BirdCoderIamRuntime(
    tokenManager: tokenManager ?? getBirdCoderGlobalTokenManager(),
    apiBaseUrl: apiBaseUrl,
  );
}
