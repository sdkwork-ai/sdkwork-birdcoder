import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_host/sdkwork_birdcoder_flutter_mobile_host.dart';

class _FailingWriteSessionStorage implements BirdCoderSessionStorage {
  @override
  Future<void> clear() async {}

  @override
  Future<BirdCoderSessionRecord?> read() async => null;

  @override
  Future<void> write(BirdCoderSessionRecord record) {
    throw StateError('secure storage unavailable');
  }
}

void main() {
  test('password sign-in uses anonymous IAM SDK and atomically commits tokens',
      () async {
    Map<String, dynamic>? requestBody;
    String? authorization;
    String? accessTokenHeader;
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final subscription = server.listen((request) async {
      authorization = request.headers.value(HttpHeaders.authorizationHeader);
      accessTokenHeader = request.headers.value('Access-Token');
      requestBody = jsonDecode(await utf8.decoder.bind(request).join())
          as Map<String, dynamic>;
      request.response.headers.contentType = ContentType.json;
      request.response.write(jsonEncode(<String, dynamic>{
        'code': 0,
        'data': <String, dynamic>{
          'item': <String, dynamic>{
            'accessToken': 'new-access-token',
            'authToken': 'new-auth-token',
            'refreshToken': 'new-refresh-token',
            'sessionId': 'iam-session-2',
            'expiresAt': '2026-07-24T00:00:00Z',
          },
        },
        'traceId': 'trace-login',
      }));
      await request.response.close();
    });
    addTearDown(() async {
      await subscription.cancel();
      await server.close(force: true);
    });

    final storage = MemoryBirdCoderSessionStorage();
    final tokenManager = BirdCoderTokenManager(sessionStorage: storage);
    await tokenManager.setTokens(
      accessToken: 'stale-access-token',
      authToken: 'stale-auth-token',
      refreshToken: 'stale-refresh-token',
    );
    final clients = createBirdCoderFlutterSdkClients(
      apiBaseUrl: 'http://127.0.0.1:${server.port}',
      tokenManager: tokenManager,
    );
    final runtime = createBirdCoderIamRuntime(sdkClients: clients);
    addTearDown(runtime.dispose);
    final service = BirdCoderIamAuthService(sdkClients: clients);

    await service.signInWithPassword(
      iamRuntime: runtime,
      username: ' birdcoder-user ',
      password: 'secret-value',
    );

    expect(authorization, isNull);
    expect(accessTokenHeader, isNull);
    expect(requestBody, <String, dynamic>{
      'email': null,
      'username': 'birdcoder-user',
      'phone': null,
      'password': 'secret-value',
      'externalToken': null,
      'providerKey': null,
      'tenantId': null,
      'organizationId': null,
    });
    expect(tokenManager.accessToken, 'new-access-token');
    expect(tokenManager.authToken, 'new-auth-token');
    expect(tokenManager.refreshToken, 'new-refresh-token');
    expect(tokenManager.sessionId, 'iam-session-2');
    expect(runtime.sessionValidated, isTrue);
    expect((await storage.read())?.accessToken, 'new-access-token');
  });

  test('stored IAM session validation uses authenticated current-session API',
      () async {
    String? requestPath;
    String? authorization;
    String? accessTokenHeader;
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final subscription = server.listen((request) async {
      requestPath = request.uri.path;
      authorization = request.headers.value(HttpHeaders.authorizationHeader);
      accessTokenHeader = request.headers.value('Access-Token');
      request.response.headers.contentType = ContentType.json;
      request.response.write(
        '{"code":0,"data":{"item":{"sessionId":"iam-session-1"}},'
        '"traceId":"trace-session"}',
      );
      await request.response.close();
    });
    addTearDown(() async {
      await subscription.cancel();
      await server.close(force: true);
    });

    final storage = MemoryBirdCoderSessionStorage();
    await storage.write(const BirdCoderSessionRecord(
      accessToken: 'stored-access-token',
      authToken: 'stored-auth-token',
      refreshToken: 'stored-refresh-token',
      sessionId: 'iam-session-1',
      storedAt: 1,
    ));
    final tokenManager = BirdCoderTokenManager(sessionStorage: storage);
    final clients = createBirdCoderFlutterSdkClients(
      apiBaseUrl: 'http://127.0.0.1:${server.port}',
      tokenManager: tokenManager,
    );
    final runtime = createBirdCoderIamRuntime(sdkClients: clients);
    addTearDown(runtime.dispose);

    await runtime.bootstrap();

    expect(requestPath, '/app/v3/api/auth/sessions/current');
    expect(authorization, 'Bearer stored-auth-token');
    expect(accessTokenHeader, 'stored-access-token');
    expect(runtime.sessionPresent, isTrue);
    expect(runtime.sessionValidated, isTrue);
  });

  test('failed remote sign-out still clears local IAM session state', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final subscription = server.listen((request) async {
      request.response.statusCode = HttpStatus.serviceUnavailable;
      request.response.headers.contentType = ContentType.json;
      request.response.write(
        '{"code":50301,"detail":"unavailable","traceId":"trace-logout"}',
      );
      await request.response.close();
    });
    addTearDown(() async {
      await subscription.cancel();
      await server.close(force: true);
    });

    final storage = MemoryBirdCoderSessionStorage();
    final tokenManager = BirdCoderTokenManager(sessionStorage: storage);
    await tokenManager.setTokens(
      accessToken: 'access-token',
      authToken: 'auth-token',
      refreshToken: 'refresh-token',
    );
    final clients = createBirdCoderFlutterSdkClients(
      apiBaseUrl: 'http://127.0.0.1:${server.port}',
      tokenManager: tokenManager,
    );
    final runtime = createBirdCoderIamRuntime(sdkClients: clients);
    addTearDown(runtime.dispose);
    final service = BirdCoderIamAuthService(sdkClients: clients);

    await service.signOut(iamRuntime: runtime);

    expect(tokenManager.hasAccessToken, isFalse);
    expect(tokenManager.authToken, isNull);
    expect(tokenManager.refreshToken, isNull);
    expect(await storage.read(), isNull);
    expect(runtime.sessionValidated, isFalse);
  });

  test('token persistence failure never exposes uncommitted credentials',
      () async {
    final tokenManager = BirdCoderTokenManager(
      sessionStorage: _FailingWriteSessionStorage(),
    );

    await expectLater(
      tokenManager.setTokens(
        accessToken: 'uncommitted-access-token',
        authToken: 'uncommitted-auth-token',
      ),
      throwsStateError,
    );

    expect(tokenManager.accessToken, isNull);
    expect(tokenManager.authToken, isNull);
    expect(tokenManager.hasAccessToken, isFalse);
  });
}
