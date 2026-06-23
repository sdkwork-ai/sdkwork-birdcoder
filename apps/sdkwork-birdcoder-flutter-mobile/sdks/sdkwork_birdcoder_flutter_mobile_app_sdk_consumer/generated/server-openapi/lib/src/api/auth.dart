import '../http/client.dart';
import '../models.dart';

import 'paths.dart';
import 'response_helpers.dart';


class AuthApi {
  final HttpClient _client;

  AuthApi(this._client);

  /// Create SDKWork IAM password reset request
  Future<BirdCoderBooleanSuccessEnvelope?> passwordResetRequestsCreate(BirdCoderIamPasswordResetRequestCreateRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.appPath('/auth/password_reset_requests'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderBooleanSuccessEnvelope.fromJson(map);
    })();
  }

  /// Reset SDKWork IAM password
  Future<BirdCoderBooleanSuccessEnvelope?> passwordResetsCreate(BirdCoderIamPasswordResetCreateRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.appPath('/auth/password_resets'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderBooleanSuccessEnvelope.fromJson(map);
    })();
  }

  /// Register SDKWork IAM user
  Future<BirdCoderIamSessionEnvelope?> registrationsCreate(BirdCoderIamRegistrationCreateRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.appPath('/auth/registrations'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamSessionEnvelope.fromJson(map);
    })();
  }

  /// Create SDKWork IAM session
  Future<BirdCoderIamSessionEnvelope?> sessionsCreate(BirdCoderIamCreateSessionRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.appPath('/auth/sessions'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamSessionEnvelope.fromJson(map);
    })();
  }

  /// Get current SDKWork IAM session
  Future<BirdCoderIamSessionEnvelope?> sessionsCurrentRetrieve() async {
    final response = await _client.get(ApiPaths.appPath('/auth/sessions/current'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamSessionEnvelope.fromJson(map);
    })();
  }

  /// Update current SDKWork IAM session
  Future<BirdCoderIamSessionEnvelope?> sessionsCurrentUpdate([BirdCoderIamUpdateCurrentSessionRequest? body]) async {
    final payload = body?.toJson();
    final response = await _client.patch(ApiPaths.appPath('/auth/sessions/current'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamSessionEnvelope.fromJson(map);
    })();
  }

  /// Delete current SDKWork IAM session
  Future<BirdCoderBooleanSuccessEnvelope?> sessionsCurrentDelete() async {
    final response = await _client.delete(ApiPaths.appPath('/auth/sessions/current'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderBooleanSuccessEnvelope.fromJson(map);
    })();
  }

  /// Refresh SDKWork IAM session
  Future<BirdCoderIamSessionEnvelope?> sessionsRefresh(BirdCoderIamRefreshSessionRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.appPath('/auth/sessions/refresh'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamSessionEnvelope.fromJson(map);
    })();
  }
}
