class BirdCoderSessionRecord {
  final String accessToken;
  final String authToken;
  final String? refreshToken;
  final String? sessionId;
  final int? expiresAt;
  final int storedAt;

  const BirdCoderSessionRecord({
    required this.accessToken,
    required this.authToken,
    required this.storedAt,
    this.refreshToken,
    this.sessionId,
    this.expiresAt,
  });

  Map<String, dynamic> toJson() {
    return {
      'accessToken': accessToken,
      'authToken': authToken,
      if (refreshToken != null) 'refreshToken': refreshToken,
      if (sessionId != null) 'sessionId': sessionId,
      if (expiresAt != null) 'expiresAt': expiresAt,
      'storedAt': storedAt,
    };
  }

  static BirdCoderSessionRecord? fromJson(Object? value) {
    if (value is! Map) {
      return null;
    }

    final accessToken = value['accessToken'];
    if (accessToken is! String || accessToken.isEmpty) {
      return null;
    }

    final authTokenRaw = value['authToken'];
    final authToken = authTokenRaw is String && authTokenRaw.isNotEmpty
        ? authTokenRaw
        : accessToken;

    final storedAt = value['storedAt'];
    final expiresAt = value['expiresAt'];
    return BirdCoderSessionRecord(
      accessToken: accessToken,
      authToken: authToken,
      storedAt: storedAt is int ? storedAt : DateTime.now().millisecondsSinceEpoch ~/ 1000,
      refreshToken: value['refreshToken'] is String ? value['refreshToken'] as String : null,
      sessionId: value['sessionId'] is String ? value['sessionId'] as String : null,
      expiresAt: expiresAt is int ? expiresAt : null,
    );
  }
}
