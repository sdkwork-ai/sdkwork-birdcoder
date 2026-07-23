import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:sdkwork_agents_app_sdk/sdkwork_agents_app_sdk.dart';
import 'package:uuid/uuid.dart';

import 'sdk_clients.dart';

const String birdCoderAssistantAgentId = 'agent.birdcoder';
const int birdCoderAssistantSessionPageSize = 20;

const Uuid _uuid = Uuid();

class BirdCoderAssistantSessionView {
  const BirdCoderAssistantSessionView({
    required this.sessionId,
    required this.itemCount,
  });

  final String sessionId;
  final int itemCount;
}

class BirdCoderAgentSessionItemView {
  const BirdCoderAgentSessionItemView({
    required this.itemId,
    required this.sessionId,
    required this.kind,
    required this.role,
    required this.content,
    required this.sequence,
    required this.createdAt,
  });

  final String itemId;
  final String sessionId;
  final String kind;
  final String role;
  final String content;
  final BigInt sequence;
  final DateTime createdAt;
}

Map<String, dynamic>? _asMap(dynamic value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return value.map((key, item) => MapEntry(key.toString(), item));
  }
  return null;
}

Map<String, dynamic> _readEnvelopeData(
  int code,
  dynamic data,
  String operation,
) {
  if (code != 0) {
    throw StateError('$operation failed with response code $code.');
  }
  final mapped = _asMap(data);
  if (mapped == null) {
    throw StateError('$operation returned no response data.');
  }
  return mapped;
}

List<T> _readRecords<T>(
  Iterable<dynamic> values,
  T Function(Map<String, dynamic>) fromJson,
) {
  return values
      .map(_asMap)
      .whereType<Map<String, dynamic>>()
      .map(fromJson)
      .toList(growable: false);
}

List<AgentSessionRecord> _readSessions(AgentSessionListResponse? response) {
  if (response == null) {
    throw StateError('Agents session list response is empty.');
  }
  final page = SdkWorkPageData.fromJson(
    _readEnvelopeData(response.code, response.data, 'List Agents sessions'),
  );
  return _readRecords(page.items, AgentSessionRecord.fromJson);
}

AgentSessionRecord _readSession(AgentSessionResponse? response) {
  if (response == null) {
    throw StateError('Agents session response is empty.');
  }
  final resource = SdkWorkResourceData.fromJson(
    _readEnvelopeData(response.code, response.data, 'Create Agents session'),
  );
  final item = _asMap(resource.item);
  if (item == null) {
    throw StateError('Agents session response is missing item.');
  }
  return AgentSessionRecord.fromJson(item);
}

List<AgentSessionItemRecord> _readSessionItems(
  AgentSessionItemListResponse? response,
) {
  if (response == null) {
    throw StateError('Agents SessionItem list response is empty.');
  }
  final page = SdkWorkPageData.fromJson(
    _readEnvelopeData(
      response.code,
      response.data,
      'List Agents SessionItems',
    ),
  );
  return _readRecords(page.items, AgentSessionItemRecord.fromJson);
}

List<AgentSessionItemRecord> _readCompletedTurnItems(
  AgentTurnExecutionResponse response,
) {
  final resource = SdkWorkResourceData.fromJson(
    _readEnvelopeData(response.code, response.data, 'Complete Agents turn'),
  );
  final item = _asMap(resource.item);
  final values = item?['items'];
  if (values is! List) {
    throw StateError('Completed Agents turn is missing SessionItems.');
  }
  return _readRecords(values, AgentSessionItemRecord.fromJson);
}

String _payloadHash(Object? value) {
  final serialized = value is String ? value : jsonEncode(value);
  return 'sha256:${sha256.convert(utf8.encode(serialized))}';
}

int _parseItemCount(String value) {
  final itemCount = int.tryParse(value);
  if (itemCount == null || itemCount < 0) {
    throw StateError('Agents session returned an invalid itemCount.');
  }
  return itemCount;
}

String _resolveItemRole(String kind) {
  if (kind == 'user_input') {
    return 'user';
  }
  if (kind == 'system_instruction' ||
      kind == 'status_notice' ||
      kind == 'error_notice') {
    return 'system';
  }
  return 'assistant';
}

String _resolveItemContent(AgentSessionItemRecord item) {
  final content = item.content?.trim();
  if (content != null && content.isNotEmpty) {
    return content;
  }
  final toolName = item.toolName?.trim();
  if (toolName != null && toolName.isNotEmpty) {
    return toolName;
  }
  final structuredContent = item.toolResult ?? item.toolArguments;
  return structuredContent == null
      ? ''
      : const JsonEncoder.withIndent('  ').convert(structuredContent);
}

BirdCoderAssistantSessionView _toSessionView(AgentSessionRecord session) {
  final sessionId = session.sessionId.trim();
  if (sessionId.isEmpty) {
    throw StateError('Agents session response is missing sessionId.');
  }
  return BirdCoderAssistantSessionView(
    sessionId: sessionId,
    itemCount: _parseItemCount(session.itemCount),
  );
}

BirdCoderAgentSessionItemView _toSessionItemView(
  AgentSessionItemRecord item,
) {
  final sequence = BigInt.tryParse(item.sequence);
  final createdAt = DateTime.tryParse(item.createdAt);
  if (sequence == null || createdAt == null) {
    throw StateError('Agents SessionItem returned invalid ordering metadata.');
  }
  return BirdCoderAgentSessionItemView(
    itemId: item.itemId,
    sessionId: item.sessionId,
    kind: item.kind,
    role: _resolveItemRole(item.kind),
    content: _resolveItemContent(item),
    sequence: sequence,
    createdAt: createdAt,
  );
}

List<BirdCoderAgentSessionItemView> _toVisibleSessionItems(
  Iterable<AgentSessionItemRecord> items,
) {
  return items
      .map(_toSessionItemView)
      .where((item) => item.content.isNotEmpty)
      .toList(growable: false);
}

String _requireNonBlank(String value, String name) {
  final normalized = value.trim();
  if (normalized.isEmpty) {
    throw ArgumentError.value(value, name, 'must not be blank');
  }
  return normalized;
}

void _validatePage(int page, int pageSize) {
  if (page < 1) {
    throw RangeError.range(page, 1, null, 'page');
  }
  if (pageSize < 1 || pageSize > 200) {
    throw RangeError.range(pageSize, 1, 200, 'pageSize');
  }
}

Future<BirdCoderAssistantSessionView> ensureBirdCoderAssistantSession(
  BirdCoderFlutterSdkClients clients, {
  String agentId = birdCoderAssistantAgentId,
}) async {
  final normalizedAgentId = _requireNonBlank(agentId, 'agentId');
  final listed = await clients.agentsSdk.ai.agentsSessionsList(
    normalizedAgentId,
    1,
    birdCoderAssistantSessionPageSize,
  );
  final sessions = _readSessions(listed);
  for (final session in sessions) {
    if (session.sessionKind == 'assistant' &&
        (session.status == 'active' || session.status == 'idle')) {
      return _toSessionView(session);
    }
  }

  const sessionPayload = <String, String>{
    'sessionKind': 'assistant',
    'entrySurface': 'flutter',
    'sourceModule': 'sdkwork-birdcoder',
  };
  final created = await clients.agentsSdk.ai.agentsSessionsCreate(
    normalizedAgentId,
    CreateAgentSessionRequest(
      sessionKind: sessionPayload['sessionKind']!,
      entrySurface: sessionPayload['entrySurface']!,
      sourceModule: sessionPayload['sourceModule'],
      idempotencyKey: _uuid.v4(),
      payloadHash: _payloadHash(sessionPayload),
      requestedAt: DateTime.now().toUtc().toIso8601String(),
    ),
  );
  return _toSessionView(_readSession(created));
}

Future<List<BirdCoderAgentSessionItemView>> listBirdCoderAssistantSessionItems(
  BirdCoderFlutterSdkClients clients,
  String sessionId, {
  int page = 1,
  int pageSize = birdCoderAssistantSessionPageSize,
  String agentId = birdCoderAssistantAgentId,
}) async {
  final normalizedAgentId = _requireNonBlank(agentId, 'agentId');
  final normalizedSessionId = _requireNonBlank(sessionId, 'sessionId');
  _validatePage(page, pageSize);
  final listed = await clients.agentsSdk.ai.agentsSessionItemsList(
    normalizedAgentId,
    normalizedSessionId,
    page,
    pageSize,
  );
  return _toVisibleSessionItems(_readSessionItems(listed));
}

Future<List<BirdCoderAgentSessionItemView>> submitBirdCoderAssistantTurn(
  BirdCoderFlutterSdkClients clients,
  String sessionId,
  String content, {
  String agentId = birdCoderAssistantAgentId,
}) async {
  final normalizedAgentId = _requireNonBlank(agentId, 'agentId');
  final normalizedSessionId = _requireNonBlank(sessionId, 'sessionId');
  final normalizedContent = _requireNonBlank(content, 'content');
  final idempotencyKey = _uuid.v4();
  AgentTurnExecutionResponse? completion;

  final events = clients.agentsSdk.ai.agentsTurnsStream(
    normalizedAgentId,
    normalizedSessionId,
    CreateAgentTurnRequest(
      content: normalizedContent,
      contentType: 'text/plain',
      turnMode: 'interactive',
      idempotencyKey: idempotencyKey,
      payloadHash: _payloadHash(<String, String>{
        'content': normalizedContent,
        'turnMode': 'interactive',
      }),
      clientRequestId: idempotencyKey,
      requestedAt: DateTime.now().toUtc().toIso8601String(),
    ),
    false,
  );
  await for (final event in events) {
    if (event.eventType == 'completion' && event.response != null) {
      completion = event.response;
    }
  }
  if (completion == null) {
    throw StateError('Agents turn completed without a completion response.');
  }
  return _toVisibleSessionItems(_readCompletedTurnItems(completion));
}
