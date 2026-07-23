import 'package:flutter/foundation.dart';

import 'sdk_clients.dart';
import 'token_manager.dart';

class BirdCoderIamRuntime extends ChangeNotifier {
  BirdCoderIamRuntime({
    required BirdCoderFlutterSdkClients sdkClients,
  })  : _sdkClients = sdkClients,
        _tokenManager = sdkClients.tokenManager;

  final BirdCoderFlutterSdkClients _sdkClients;
  final BirdCoderTokenManager _tokenManager;
  bool _initialized = false;
  bool _sessionValidated = false;

  bool get initialized => _initialized;
  bool get sessionPresent => _tokenManager.hasAccessToken;
  bool get sessionValidated => _sessionValidated;

  Future<void> bootstrap() async {
    if (_initialized) {
      return;
    }

    await _tokenManager.hydrateFromStorage();
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

    final valid = await _probeCurrentSessionWithIamSdk(_sdkClients);
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
    try {
      await _tokenManager.clearTokens();
    } finally {
      _sessionValidated = false;
      notifyListeners();
    }
  }
}

Future<bool> _probeCurrentSessionWithIamSdk(
  BirdCoderFlutterSdkClients sdkClients, {
  int requestTimeoutMs = 800,
}) async {
  try {
    final response = await sdkClients.iamSdk.auth
        .sessionsCurrentRetrieve()
        .timeout(Duration(milliseconds: requestTimeoutMs));
    if (response == null || response.code != 0) {
      return false;
    }
    final data = response.data;
    if (data is! Map) {
      return false;
    }
    return data['item'] is Map;
  } catch (_) {
    return false;
  }
}

BirdCoderIamRuntime createBirdCoderIamRuntime({
  required BirdCoderFlutterSdkClients sdkClients,
}) {
  return BirdCoderIamRuntime(sdkClients: sdkClients);
}
