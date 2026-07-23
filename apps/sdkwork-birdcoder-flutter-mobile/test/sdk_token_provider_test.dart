import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_host/sdkwork_birdcoder_flutter_mobile_host.dart';

void main() {
  test('app, Agents, and IAM SDK clients read one shared live token manager',
      () async {
    final requests = <Map<String, String?>>[];
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final subscription = server.listen((request) async {
      requests.add({
        'path': request.uri.path,
        'authorization': request.headers.value(HttpHeaders.authorizationHeader),
        'accessToken': request.headers.value('Access-Token'),
      });
      request.response.headers.contentType = ContentType.json;
      request.response.write(
        '{"code":0,"data":{"items":[]},"traceId":"test-trace"}',
      );
      await request.response.close();
    });
    addTearDown(() async {
      await subscription.cancel();
      await server.close(force: true);
    });

    final tokenManager = BirdCoderTokenManager(
      sessionStorage: MemoryBirdCoderSessionStorage(),
    );
    final clients = createBirdCoderFlutterSdkClients(
      apiBaseUrl: 'http://127.0.0.1:${server.port}',
      tokenManager: tokenManager,
    );

    await clients.appSdk.system.healthRetrieve();
    await clients.agentsSdk.ai.agentsSessionsList('agent.birdcoder');
    await clients.iamSdk.auth.sessionsCurrentRetrieve();
    await tokenManager.setTokens(
      accessToken: 'access-2',
      authToken: 'auth-2',
    );
    await clients.appSdk.system.healthRetrieve();
    await clients.agentsSdk.ai.agentsSessionsList('agent.birdcoder');
    await clients.iamSdk.auth.sessionsCurrentRetrieve();

    expect(requests, hasLength(6));
    expect(requests[0]['authorization'], isNull);
    expect(requests[0]['accessToken'], isNull);
    expect(requests[1]['authorization'], isNull);
    expect(requests[1]['accessToken'], isNull);
    expect(requests[2]['authorization'], isNull);
    expect(requests[2]['accessToken'], isNull);
    expect(requests[3]['authorization'], 'Bearer auth-2');
    expect(requests[3]['accessToken'], 'access-2');
    expect(requests[4]['authorization'], 'Bearer auth-2');
    expect(requests[4]['accessToken'], 'access-2');
    expect(requests[5]['authorization'], 'Bearer auth-2');
    expect(requests[5]['accessToken'], 'access-2');
    expect(requests[0]['path'], '/app/v3/api/system/health');
    expect(
      requests[1]['path'],
      '/app/v3/api/ai/agents/agent.birdcoder/sessions',
    );
    expect(requests[2]['path'], '/app/v3/api/auth/sessions/current');
    expect(requests[5]['path'], '/app/v3/api/auth/sessions/current');
  });

  test('normalizes one App API surface prefix', () {
    expect(
      normalizeBirdCoderAppApiBaseUrl('https://api.example.com/'),
      'https://api.example.com/app/v3/api',
    );
    expect(
      resolveBirdCoderAppApiTransportBaseUrl(
        'https://api.example.com/app/v3/api',
      ),
      'https://api.example.com',
    );
    expect(
      () => normalizeBirdCoderAppApiBaseUrl(
        'https://api.example.com/app/v3/api/app/v3/api',
      ),
      throwsArgumentError,
    );
  });
}
