import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_host/sdkwork_birdcoder_flutter_mobile_host.dart';

void main() {
  test('app SDK clients read the current global token for each client',
      () async {
    final requests = <Map<String, String?>>[];
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final subscription = server.listen((request) async {
      requests.add({
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

    await clients.appSdk.system.chatConversationsList();
    await tokenManager.setTokens(
      accessToken: 'access-2',
      authToken: 'auth-2',
    );
    await clients.appSdk.system.chatConversationsList();

    expect(requests, hasLength(2));
    expect(requests[0]['authorization'], isNull);
    expect(requests[0]['accessToken'], isNull);
    expect(requests[1]['authorization'], 'Bearer auth-2');
    expect(requests[1]['accessToken'], 'access-2');
  });
}
