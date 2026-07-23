import 'package:sdkwork_iam_app_sdk/sdkwork_iam_app_sdk.dart' as iam_sdk;

import 'auth_oauth_deep_link.dart';
import 'iam_runtime.dart';
import 'sdk_clients.dart';

class BirdCoderIamAuthException implements Exception {
  BirdCoderIamAuthException(this.message, {this.traceId});

  final String message;
  final String? traceId;

  @override
  String toString() => message;
}

class BirdCoderIamAuthOptions {
  const BirdCoderIamAuthOptions({
    required this.oauthLoginEnabled,
    required this.oauthProviders,
  });

  final bool oauthLoginEnabled;
  final List<String> oauthProviders;
}

class BirdCoderIamDeviceAuthorization {
  const BirdCoderIamDeviceAuthorization({
    required this.deviceAuthorizationId,
    required this.status,
    required this.sessionReady,
    this.expiresAt,
    this.pollSecret,
    this.qrContent,
    this.qrUrl,
  });

  final String deviceAuthorizationId;
  final String status;
  final bool sessionReady;
  final String? expiresAt;
  final String? pollSecret;
  final String? qrContent;
  final String? qrUrl;
}

class _BirdCoderIamSession {
  const _BirdCoderIamSession({
    required this.accessToken,
    required this.authToken,
    this.refreshToken,
    this.sessionId,
    this.expiresAt,
  });

  final String accessToken;
  final String authToken;
  final String? refreshToken;
  final String? sessionId;
  final int? expiresAt;
}

class BirdCoderIamAuthService {
  const BirdCoderIamAuthService({
    required BirdCoderFlutterSdkClients sdkClients,
  }) : _sdkClients = sdkClients;

  final BirdCoderFlutterSdkClients _sdkClients;

  Future<void> signInWithPassword({
    required BirdCoderIamRuntime iamRuntime,
    required String username,
    required String password,
  }) async {
    final account = username.trim();
    if (account.isEmpty || password.isEmpty) {
      throw BirdCoderIamAuthException('Account and password are required.');
    }

    final response = await _sdkClients.anonymousIamSdk.auth.sessionsCreate(
      iam_sdk.AppbaseSessionCreateCommand(
        username: account,
        password: password,
      ),
    );
    await _commitSession(iamRuntime, response, 'password sign-in');
  }

  Future<void> registerWithPassword({
    required BirdCoderIamRuntime iamRuntime,
    required String username,
    required String password,
    required String confirmPassword,
    String? email,
  }) async {
    final account = username.trim();
    if (account.isEmpty || password.isEmpty) {
      throw BirdCoderIamAuthException('Account and password are required.');
    }
    if (password != confirmPassword) {
      throw BirdCoderIamAuthException('Passwords do not match.');
    }

    final response = await _sdkClients.anonymousIamSdk.auth.registrationsCreate(
      <String, dynamic>{
        'username': account,
        'password': password,
        'confirmPassword': confirmPassword,
        if (_normalizeOptionalString(email) case final value?) 'email': value,
      },
    );
    await _commitSession(iamRuntime, response, 'registration');
  }

  Future<void> requestPasswordReset({
    required String account,
    String channel = 'email',
  }) async {
    final normalizedAccount = account.trim();
    if (normalizedAccount.isEmpty) {
      throw BirdCoderIamAuthException('Account is required.');
    }

    final response = await _sdkClients.anonymousIamSdk.auth
        .passwordResetRequestsCreate(<String, dynamic>{
      'account': normalizedAccount,
      'channel': channel,
    });
    _requireResourceItem(response, 'password reset request');
  }

  Future<void> resetPassword({
    required String account,
    required String code,
    required String newPassword,
    required String confirmPassword,
  }) async {
    final normalizedAccount = account.trim();
    final normalizedCode = code.trim();
    if (normalizedAccount.isEmpty ||
        normalizedCode.isEmpty ||
        newPassword.isEmpty) {
      throw BirdCoderIamAuthException(
        'Account, verification code, and password are required.',
      );
    }
    if (newPassword != confirmPassword) {
      throw BirdCoderIamAuthException('Passwords do not match.');
    }

    final response = await _sdkClients.anonymousIamSdk.auth
        .passwordResetsCreate(<String, dynamic>{
      'account': normalizedAccount,
      'code': normalizedCode,
      'newPassword': newPassword,
      'confirmPassword': confirmPassword,
    });
    _requireResourceItem(response, 'password reset');
  }

  Future<void> completeOAuthCallback({
    required BirdCoderIamRuntime iamRuntime,
    required String code,
    required String provider,
    String? state,
  }) async {
    final normalizedCode = code.trim();
    final normalizedProvider = provider.trim();
    if (normalizedCode.isEmpty || normalizedProvider.isEmpty) {
      throw BirdCoderIamAuthException(
        'OAuth callback is missing required parameters.',
      );
    }

    final response = await _sdkClients.anonymousIamSdk.oauth.sessionsCreate(
      <String, dynamic>{
        'code': normalizedCode,
        'provider': normalizedProvider,
        if (_normalizeOptionalString(state) case final value?) 'state': value,
        'deviceType': 'mobile',
      },
    );
    await _commitSession(iamRuntime, response, 'OAuth sign-in');
  }

  Future<BirdCoderIamAuthOptions> fetchIamRuntimeSettings() async {
    final response =
        await _sdkClients.anonymousIamSdk.system.iamRuntimeRetrieve();
    final item = _requireResourceItem(response, 'IAM runtime settings');
    final oauthLoginEnabled = item['oauthLoginEnabled'];
    if (oauthLoginEnabled is! bool) {
      throw BirdCoderIamAuthException(
        'IAM runtime settings omitted oauthLoginEnabled.',
        traceId: response?.traceId,
      );
    }

    final providers = item['oauthProviders'];
    if (providers is! List) {
      throw BirdCoderIamAuthException(
        'IAM runtime settings omitted oauthProviders.',
        traceId: response?.traceId,
      );
    }

    return BirdCoderIamAuthOptions(
      oauthLoginEnabled: oauthLoginEnabled,
      oauthProviders: List<String>.unmodifiable(
        providers
            .whereType<String>()
            .map((provider) => provider.trim())
            .where((provider) => provider.isNotEmpty),
      ),
    );
  }

  Future<String> resolveOAuthAuthorizationUrl({
    required String provider,
    String? redirectUri,
    String? state,
    String? scope,
  }) async {
    final normalizedProvider = provider.trim();
    if (normalizedProvider.isEmpty) {
      throw BirdCoderIamAuthException('OAuth provider is required.');
    }

    final response =
        await _sdkClients.anonymousIamSdk.oauth.authorizationUrlsCreate(
      <String, dynamic>{
        'provider': normalizedProvider,
        'redirectUri': redirectUri ?? buildBirdCoderOAuthCallbackReturnUrl(),
        if (_normalizeOptionalString(scope) case final value?) 'scope': value,
        if (_normalizeOptionalString(state) case final value?) 'state': value,
      },
    );
    final item = _requireResourceItem(response, 'OAuth authorization URL');
    return _requireNonBlankString(
      item,
      'authUrl',
      'OAuth authorization URL',
      response?.traceId,
    );
  }

  Future<BirdCoderIamDeviceAuthorization> createQrLoginAuthorization({
    String purpose = 'login',
  }) async {
    final response =
        await _sdkClients.anonymousIamSdk.oauth.deviceAuthorizationsCreate(
      <String, dynamic>{'purpose': purpose},
    );
    return _parseDeviceAuthorization(response, 'QR login authorization');
  }

  Future<BirdCoderIamDeviceAuthorization> retrieveQrLoginAuthorization({
    required String deviceAuthorizationId,
  }) async {
    final normalizedId = deviceAuthorizationId.trim();
    if (normalizedId.isEmpty) {
      throw BirdCoderIamAuthException(
        'QR login authorization id is required.',
      );
    }

    final response = await _sdkClients.anonymousIamSdk.oauth
        .deviceAuthorizationsRetrieve(normalizedId);
    return _parseDeviceAuthorization(
      response,
      'QR login authorization status',
    );
  }

  Future<void> exchangeQrLoginSession({
    required BirdCoderIamRuntime iamRuntime,
    required String deviceAuthorizationId,
    required String pollSecret,
  }) async {
    final normalizedId = deviceAuthorizationId.trim();
    final normalizedSecret = pollSecret.trim();
    if (normalizedId.isEmpty || normalizedSecret.isEmpty) {
      throw BirdCoderIamAuthException(
        'QR login exchange requires authorization id and poll secret.',
      );
    }

    final response = await _sdkClients.anonymousIamSdk.oauth
        .deviceAuthorizationsSessionExchangesCreate(
      normalizedId,
      <String, dynamic>{'pollSecret': normalizedSecret},
    );
    await _commitSession(iamRuntime, response, 'QR login session exchange');
  }

  Future<void> signOut({required BirdCoderIamRuntime iamRuntime}) async {
    try {
      if (_sdkClients.tokenManager.hasAccessToken) {
        await _sdkClients.iamSdk.auth.sessionsCurrentDelete();
      }
    } catch (_) {
      // Clearing local credentials is mandatory even when remote revoke fails.
    } finally {
      await iamRuntime.logout();
    }
  }

  Future<void> _commitSession(
    BirdCoderIamRuntime iamRuntime,
    iam_sdk.SdkWorkResourceResponse? response,
    String operation,
  ) async {
    final item = _requireResourceItem(response, operation);
    final session = _BirdCoderIamSession(
      accessToken: _requireNonBlankString(
        item,
        'accessToken',
        operation,
        response?.traceId,
      ),
      authToken: _requireNonBlankString(
        item,
        'authToken',
        operation,
        response?.traceId,
      ),
      refreshToken: _normalizeOptionalString(item['refreshToken']),
      sessionId: _normalizeOptionalString(item['sessionId']),
      expiresAt: _parseExpiresAt(item['expiresAt']),
    );

    await iamRuntime.login(
      accessToken: session.accessToken,
      authToken: session.authToken,
      refreshToken: session.refreshToken,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
    );
  }

  BirdCoderIamDeviceAuthorization _parseDeviceAuthorization(
    iam_sdk.SdkWorkResourceResponse? response,
    String operation,
  ) {
    final item = _requireResourceItem(response, operation);
    final sessionReady = item['sessionReady'];
    if (sessionReady != null && sessionReady is! bool) {
      throw BirdCoderIamAuthException(
        '$operation returned an invalid sessionReady value.',
        traceId: response?.traceId,
      );
    }
    return BirdCoderIamDeviceAuthorization(
      deviceAuthorizationId: _requireNonBlankString(
        item,
        'deviceAuthorizationId',
        operation,
        response?.traceId,
      ),
      status: _requireNonBlankString(
        item,
        'status',
        operation,
        response?.traceId,
      ),
      sessionReady: sessionReady == true,
      expiresAt: _normalizeOptionalString(item['expiresAt']),
      pollSecret: _normalizeOptionalString(item['pollSecret']),
      qrContent: _normalizeOptionalString(item['qrContent']),
      qrUrl: _normalizeOptionalString(item['qrUrl']),
    );
  }
}

Map<String, dynamic> _requireResourceItem(
  iam_sdk.SdkWorkResourceResponse? response,
  String operation,
) {
  if (response == null) {
    throw BirdCoderIamAuthException('$operation returned an empty response.');
  }
  if (response.code != 0) {
    throw BirdCoderIamAuthException(
      '$operation failed.',
      traceId: response.traceId,
    );
  }

  final data = _asStringKeyedMap(response.data);
  final item = _asStringKeyedMap(data?['item']);
  if (item == null) {
    throw BirdCoderIamAuthException(
      '$operation returned an invalid resource payload.',
      traceId: response.traceId,
    );
  }
  return item;
}

Map<String, dynamic>? _asStringKeyedMap(Object? value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return value.map(
      (key, item) => MapEntry(key.toString(), item),
    );
  }
  return null;
}

String _requireNonBlankString(
  Map<String, dynamic> source,
  String key,
  String operation,
  String? traceId,
) {
  final value = _normalizeOptionalString(source[key]);
  if (value == null) {
    throw BirdCoderIamAuthException(
      '$operation omitted $key.',
      traceId: traceId,
    );
  }
  return value;
}

String? _normalizeOptionalString(Object? value) {
  if (value == null) {
    return null;
  }
  final normalized = value.toString().trim();
  return normalized.isEmpty ? null : normalized;
}

int? _parseExpiresAt(Object? value) {
  final normalized = _normalizeOptionalString(value);
  if (normalized == null) {
    return null;
  }

  final parsed = int.tryParse(normalized);
  if (parsed != null) {
    return parsed;
  }

  final date = DateTime.tryParse(normalized);
  return date == null ? null : date.millisecondsSinceEpoch ~/ 1000;
}
