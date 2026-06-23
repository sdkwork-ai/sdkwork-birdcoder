import 'package:sdkwork_birdcoder_flutter_mobile_host/sdkwork_birdcoder_flutter_mobile_host.dart';

class BirdCoderTokenManager {
  BirdCoderTokenManager({
    BirdCoderSessionStorage? sessionStorage,
  }) : _sessionStorage = sessionStorage ?? getBirdCoderSessionStorage();

  final BirdCoderSessionStorage _sessionStorage;
  String? _accessToken;
  String? _authToken;
  String? _refreshToken;
  String? _sessionId;
  bool _hydrated = false;

  String? get accessToken => _accessToken;
  String? get authToken => _authToken;
  String? get refreshToken => _refreshToken;
  String? get sessionId => _sessionId;

  bool get hasAccessToken => _accessToken != null && _accessToken!.isNotEmpty;

  Future<void> hydrateFromStorage() async {
    if (_hydrated) {
      return;
    }

    final record = await _sessionStorage.read();
    if (record != null) {
      _accessToken = record.accessToken;
      _authToken = record.authToken;
      _refreshToken = record.refreshToken;
      _sessionId = record.sessionId;
    }
    _hydrated = true;
  }

  Future<void> setTokens({
    required String accessToken,
    required String authToken,
    String? refreshToken,
    String? sessionId,
    int? expiresAt,
  }) async {
    _accessToken = accessToken;
    _authToken = authToken;
    _refreshToken = refreshToken;
    _sessionId = sessionId;
    _hydrated = true;
    await _sessionStorage.write(
      BirdCoderSessionRecord(
        accessToken: accessToken,
        authToken: authToken,
        refreshToken: refreshToken,
        sessionId: sessionId,
        expiresAt: expiresAt,
        storedAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
      ),
    );
  }

  Future<void> clearTokens() async {
    _accessToken = null;
    _authToken = null;
    _refreshToken = null;
    _sessionId = null;
    _hydrated = true;
    await _sessionStorage.clear();
  }
}

BirdCoderTokenManager? _globalTokenManager;

BirdCoderTokenManager getBirdCoderGlobalTokenManager() {
  return _globalTokenManager ??= BirdCoderTokenManager();
}

Future<void> syncBirdCoderGlobalTokenManagerFromStorage() async {
  await getBirdCoderGlobalTokenManager().hydrateFromStorage();
}

