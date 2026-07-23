import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_host/sdkwork_birdcoder_flutter_mobile_host.dart';

const String _timestamp = '2026-07-23T00:00:00Z';

Map<String, dynamic> _sessionRecord() => <String, dynamic>{
      'sessionId': 'session-1',
      'tenantId': '100001',
      'organizationId': '0',
      'agentId': birdCoderAssistantAgentId,
      'ownerUserId': '42',
      'sessionKind': 'assistant',
      'entrySurface': 'flutter',
      'status': 'active',
      'itemCount': '1',
      'lastItemSequence': '1',
      'totalInputTokens': '2',
      'totalOutputTokens': '3',
      'createdBy': '42',
      'updatedBy': '42',
      'version': '1',
      'createdAt': _timestamp,
      'updatedAt': _timestamp,
    };

Map<String, dynamic> _sessionItem({
  required String itemId,
  required String kind,
  required String content,
  required String sequence,
}) =>
    <String, dynamic>{
      'tenantId': '100001',
      'organizationId': '0',
      'sessionId': 'session-1',
      'itemId': itemId,
      'kind': kind,
      'content': content,
      'contentType': 'text/plain',
      'status': 'completed',
      'sequence': sequence,
      'inputTokens': '0',
      'outputTokens': '0',
      'driveRefs': <dynamic>[],
      'createdBy': '42',
      'version': '1',
      'createdAt': _timestamp,
      'updatedAt': _timestamp,
    };

Map<String, dynamic> _pageData(List<Map<String, dynamic>> items) =>
    <String, dynamic>{
      'items': items,
      'pageInfo': <String, dynamic>{
        'mode': 'offset',
        'page': 1,
        'pageSize': birdCoderAssistantSessionPageSize,
        'totalItems': items.length.toString(),
        'totalPages': 1,
        'hasMore': false,
      },
    };

void main() {
  test('uses Agents Session, SessionItem, and Turn contracts end to end',
      () async {
    final requests = <HttpRequest>[];
    Map<String, dynamic>? turnBody;
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final subscription = server.listen((request) async {
      requests.add(request);
      final path = request.uri.path;
      if (request.method == 'GET' && path.endsWith('/sessions')) {
        request.response.headers.contentType = ContentType.json;
        request.response.write(jsonEncode(<String, dynamic>{
          'code': 0,
          'data': _pageData(<Map<String, dynamic>>[_sessionRecord()]),
          'traceId': 'trace-sessions',
        }));
      } else if (request.method == 'GET' && path.endsWith('/items')) {
        request.response.headers.contentType = ContentType.json;
        request.response.write(jsonEncode(<String, dynamic>{
          'code': 0,
          'data': _pageData(<Map<String, dynamic>>[
            _sessionItem(
              itemId: 'item-1',
              kind: 'user_input',
              content: 'existing input',
              sequence: '1',
            ),
          ]),
          'traceId': 'trace-items',
        }));
      } else if (request.method == 'POST' && path.endsWith('/turns')) {
        turnBody = jsonDecode(await utf8.decoder.bind(request).join())
            as Map<String, dynamic>;
        request.response.headers.contentType =
            ContentType('text', 'event-stream', charset: 'utf-8');
        request.response.write('data: ${jsonEncode(<String, dynamic>{
              'eventType': 'completion',
              'response': <String, dynamic>{
                'code': 0,
                'data': <String, dynamic>{
                  'item': <String, dynamic>{
                    'items': <Map<String, dynamic>>[
                      _sessionItem(
                        itemId: 'item-2',
                        kind: 'user_input',
                        content: 'new input',
                        sequence: '2',
                      ),
                      _sessionItem(
                        itemId: 'item-3',
                        kind: 'assistant_output',
                        content: 'assistant output',
                        sequence: '3',
                      ),
                    ],
                  },
                },
                'traceId': 'trace-turn',
              },
            })}\n\n');
        request.response.write('data: [DONE]\n\n');
      } else {
        request.response.statusCode = HttpStatus.notFound;
      }
      await request.response.close();
    });
    addTearDown(() async {
      await subscription.cancel();
      await server.close(force: true);
    });

    final tokenManager = BirdCoderTokenManager(
      sessionStorage: MemoryBirdCoderSessionStorage(),
    );
    await tokenManager.setTokens(
      accessToken: 'access-token',
      authToken: 'auth-token',
    );
    final clients = createBirdCoderFlutterSdkClients(
      apiBaseUrl: 'http://127.0.0.1:${server.port}',
      tokenManager: tokenManager,
    );

    final session = await ensureBirdCoderAssistantSession(clients);
    final existingItems = await listBirdCoderAssistantSessionItems(
      clients,
      session.sessionId,
    );
    final completedItems = await submitBirdCoderAssistantTurn(
      clients,
      session.sessionId,
      'new input',
    );

    expect(session.sessionId, 'session-1');
    expect(session.itemCount, 1);
    expect(existingItems.single.role, 'user');
    expect(completedItems.map((item) => item.role), <String>[
      'user',
      'assistant',
    ]);
    expect(
      requests.map((request) => request.uri.path),
      everyElement(startsWith('/app/v3/api/ai/agents/')),
    );
    expect(
      requests.map(
        (request) => request.headers.value(HttpHeaders.authorizationHeader),
      ),
      everyElement('Bearer auth-token'),
    );
    expect(turnBody?['turnMode'], 'interactive');
    expect(turnBody?['content'], 'new input');
    expect(
      turnBody?['payloadHash'],
      matches(RegExp(r'^sha256:[a-f0-9]{64}$')),
    );
    expect(turnBody?['idempotencyKey'], turnBody?['clientRequestId']);
  });
}
