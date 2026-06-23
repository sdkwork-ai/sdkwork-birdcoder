import 'package:sdkwork_birdcoder_flutter_mobile_app_sdk_consumer/sdkwork_birdcoder_flutter_mobile_app_sdk_consumer.dart';

import 'auth_oauth_deep_link.dart';
import 'iam_runtime.dart';
import 'token_manager.dart';

class BirdCoderIamAuthException implements Exception {
  BirdCoderIamAuthException(this.message);

  final String message;

  @override
  String toString() => message;
}

class BirdCoderIamAuthService {
  const BirdCoderIamAuthService();

  Future<void> signInWithPassword({
    required String apiBaseUrl,
    required BirdCoderIamRuntime iamRuntime,
    required String username,
    required String password,
  }) async {
    final account = username.trim();
    if (account.isEmpty || password.isEmpty) {
      throw BirdCoderIamAuthException('Account and password are required.');
    }

    final client = _createClient(apiBaseUrl);
    final envelope = await client.auth.sessionsCreate(
      BirdCoderIamCreateSessionRequest(
        grantType: 'password',
        username: account,
        password: password,
      ),
    );

    await _commitSession(iamRuntime, envelope?.data);
  }

  Future<void> registerWithPassword({
    required String apiBaseUrl,
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

    final client = _createClient(apiBaseUrl);
    final envelope = await client.auth.registrationsCreate(
      BirdCoderIamRegistrationCreateRequest(
        username: account,
        password: password,
        confirmPassword: confirmPassword,
        email: email?.trim().isEmpty ?? true ? null : email?.trim(),
      ),
    );

    await _commitSession(iamRuntime, envelope?.data);
  }

  Future<void> requestPasswordReset({
    required String apiBaseUrl,
    required String account,
    String channel = 'email',
  }) async {
    final normalizedAccount = account.trim();
    if (normalizedAccount.isEmpty) {
      throw BirdCoderIamAuthException('Account is required.');
    }

    final client = _createClient(apiBaseUrl);
    final envelope = await client.auth.passwordResetRequestsCreate(
      BirdCoderIamPasswordResetRequestCreateRequest(
        account: normalizedAccount,
        channel: channel,
      ),
    );

    if (envelope?.data.success != true) {
      throw BirdCoderIamAuthException('Password reset request failed.');
    }
  }

  Future<void> resetPassword({
    required String apiBaseUrl,
    required String account,
    required String code,
    required String newPassword,
    required String confirmPassword,
  }) async {
    final normalizedAccount = account.trim();
    final normalizedCode = code.trim();
    if (normalizedAccount.isEmpty || normalizedCode.isEmpty || newPassword.isEmpty) {
      throw BirdCoderIamAuthException('Account, verification code, and password are required.');
    }
    if (newPassword != confirmPassword) {
      throw BirdCoderIamAuthException('Passwords do not match.');
    }

    final client = _createClient(apiBaseUrl);
    final envelope = await client.auth.passwordResetsCreate(
      BirdCoderIamPasswordResetCreateRequest(
        account: normalizedAccount,
        code: normalizedCode,
        newPassword: newPassword,
        confirmPassword: confirmPassword,
      ),
    );

    if (envelope?.data.success != true) {
      throw BirdCoderIamAuthException('Password reset failed.');
    }
  }

  Future<void> completeOAuthCallback({
    required String apiBaseUrl,
    required BirdCoderIamRuntime iamRuntime,
    required String code,
    required String provider,
    String? state,
  }) async {
    final normalizedCode = code.trim();
    final normalizedProvider = provider.trim();
    if (normalizedCode.isEmpty || normalizedProvider.isEmpty) {
      throw BirdCoderIamAuthException('OAuth callback is missing required parameters.');
    }

    final client = _createClient(apiBaseUrl);
    final envelope = await client.oauth.sessionsCreate(
      BirdCoderIamOAuthSessionCreateRequest(
        code: normalizedCode,
        provider: normalizedProvider,
        state: state?.trim().isEmpty ?? true ? null : state?.trim(),
        deviceType: 'mobile',
      ),
    );

    await _commitSession(iamRuntime, envelope?.data);
  }

  Future<BirdCoderIamRuntimeSettingsSummary> fetchIamRuntimeSettings({
    required String apiBaseUrl,
  }) async {
    final client = _createClient(apiBaseUrl);
    final envelope = await client.system.iamRuntimeRetrieve();
    final summary = envelope?.data;
    if (summary == null) {
      throw BirdCoderIamAuthException('IAM runtime settings response was empty.');
    }
    return summary;
  }

  Future<String> resolveOAuthAuthorizationUrl({
    required String apiBaseUrl,
    required String provider,
    String? redirectUri,
    String? state,
    String? scope,
  }) async {
    final normalizedProvider = provider.trim();
    if (normalizedProvider.isEmpty) {
      throw BirdCoderIamAuthException('OAuth provider is required.');
    }

    final client = _createClient(apiBaseUrl);
    final envelope = await client.oauth.authorizationUrlsCreate(
      BirdCoderIamOAuthAuthorizationCreateRequest(
        provider: normalizedProvider,
        redirectUri: redirectUri ?? buildBirdCoderOAuthCallbackReturnUrl(),
        scope: scope,
        state: state,
      ),
    );
    final authUrl = envelope?.data.authUrl;
    if (authUrl == null || authUrl.isEmpty) {
      throw BirdCoderIamAuthException('OAuth authorization URL response was empty.');
    }
    return authUrl;
  }

  Future<BirdCoderIamDeviceAuthorizationSummary> createQrLoginAuthorization({
    required String apiBaseUrl,
    String purpose = 'login',
  }) async {
    final client = _createClient(apiBaseUrl);
    final envelope = await client.oauth.deviceAuthorizationsCreate(
      BirdCoderIamDeviceAuthorizationCreateRequest(purpose: purpose),
    );
    final summary = envelope?.data;
    if (summary == null) {
      throw BirdCoderIamAuthException('QR login authorization response was empty.');
    }
    return summary;
  }

  Future<BirdCoderIamDeviceAuthorizationSummary> retrieveQrLoginAuthorization({
    required String apiBaseUrl,
    required String deviceAuthorizationId,
  }) async {
    final normalizedId = deviceAuthorizationId.trim();
    if (normalizedId.isEmpty) {
      throw BirdCoderIamAuthException('QR login authorization id is required.');
    }

    final client = _createClient(apiBaseUrl);
    final envelope = await client.oauth.deviceAuthorizationsRetrieve(normalizedId);
    final summary = envelope?.data;
    if (summary == null) {
      throw BirdCoderIamAuthException('QR login authorization status response was empty.');
    }
    return summary;
  }

  Future<void> exchangeQrLoginSession({
    required String apiBaseUrl,
    required BirdCoderIamRuntime iamRuntime,
    required String deviceAuthorizationId,
    required String pollSecret,
  }) async {
    final normalizedId = deviceAuthorizationId.trim();
    final normalizedSecret = pollSecret.trim();
    if (normalizedId.isEmpty || normalizedSecret.isEmpty) {
      throw BirdCoderIamAuthException('QR login exchange requires authorization id and poll secret.');
    }

    final client = _createClient(apiBaseUrl);
    final envelope = await client.oauth.deviceAuthorizationsSessionExchangesCreate(
      normalizedId,
      BirdCoderIamDeviceAuthorizationSessionExchangeRequest(
        pollSecret: normalizedSecret,
      ),
    );

    await _commitSession(iamRuntime, envelope?.data);
  }

  Future<void> signOut({
    required String apiBaseUrl,
    required BirdCoderIamRuntime iamRuntime,
  }) async {
    final tokenManager = getBirdCoderGlobalTokenManager();
    if (tokenManager.hasAccessToken) {
      try {
        final client = createBirdCoderAppSdkConsumer(
          apiBaseUrl: apiBaseUrl,
          authToken: tokenManager.authToken ?? tokenManager.accessToken,
          accessToken: tokenManager.accessToken,
        ).createClient();
        await client.auth.sessionsCurrentDelete();
      } catch (_) {
        // Local logout must still succeed when remote revoke is unavailable.
      }
    }

    await iamRuntime.logout();
  }

  SdkworkAppClient _createClient(String apiBaseUrl) {
    return createBirdCoderAppSdkConsumer(apiBaseUrl: apiBaseUrl).createClient();
  }

  Future<void> _commitSession(
    BirdCoderIamRuntime iamRuntime,
    BirdCoderIamSessionSummary? session,
  ) async {
    if (session == null) {
      throw BirdCoderIamAuthException('IAM session response was empty.');
    }

    await iamRuntime.login(
      accessToken: session.accessToken,
      authToken: session.authToken,
      refreshToken: session.refreshToken,
      sessionId: session.sessionId,
      expiresAt: _parseExpiresAt(session.expiresAt),
    );
  }
}

int? _parseExpiresAt(String? value) {
  if (value == null || value.isEmpty) {
    return null;
  }

  final parsed = int.tryParse(value);
  if (parsed != null) {
    return parsed;
  }

  final date = DateTime.tryParse(value);
  return date == null ? null : date.millisecondsSinceEpoch ~/ 1000;
}

const birdCoderIamAuthService = BirdCoderIamAuthService();
