import 'package:sdkwork_birdcoder_flutter_mobile_app_sdk_consumer/sdkwork_birdcoder_flutter_mobile_app_sdk_consumer.dart';

import 'sdk_clients.dart';

Map<String, dynamic>? _asMap(dynamic value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return value.map((key, item) => MapEntry(key.toString(), item));
  }
  return null;
}

List<BirdCoderChatConversationSummary> _readConversations(
  BirdCoderChatConversationSummaryListEnvelope? envelope,
) {
  if (envelope == null) {
    return const [];
  }
  final data = _asMap(envelope.data);
  final rawItems = data?['items'];
  if (rawItems is! List) {
    return const [];
  }
  return rawItems
      .map(
        (entry) => BirdCoderChatConversationSummary.fromJson(_asMap(entry)!),
      )
      .toList();
}

BirdCoderChatConversationSummary _readConversation(
  BirdCoderChatConversationSummaryEnvelope? envelope,
) {
  if (envelope == null) {
    throw StateError('Chat conversation response is empty.');
  }
  final data = _asMap(envelope.data);
  final item = _asMap(data?['item']) ?? data;
  if (item == null) {
    throw StateError('Chat conversation item is missing.');
  }
  return BirdCoderChatConversationSummary.fromJson(item);
}

List<BirdCoderChatMessageSummary> _readMessages(
  BirdCoderChatMessageSummaryListEnvelope? envelope,
) {
  if (envelope == null) {
    return const [];
  }
  final data = _asMap(envelope.data);
  final rawItems = data?['items'];
  if (rawItems is! List) {
    return const [];
  }
  return rawItems
      .map((entry) => BirdCoderChatMessageSummary.fromJson(_asMap(entry)!))
      .toList();
}

BirdCoderChatMessageSummary _readMessage(
  BirdCoderChatMessageSummaryEnvelope? envelope,
) {
  if (envelope == null) {
    throw StateError('Chat message response is empty.');
  }
  final data = _asMap(envelope.data);
  final item = _asMap(data?['item']) ?? data;
  if (item == null) {
    throw StateError('Chat message item is missing.');
  }
  return BirdCoderChatMessageSummary.fromJson(item);
}

class BirdCoderMobileChatMessageRecord {
  const BirdCoderMobileChatMessageRecord({
    required this.id,
    required this.role,
    required this.content,
    required this.createdAt,
  });

  final String id;
  final String role;
  final String content;
  final String createdAt;

  static BirdCoderMobileChatMessageRecord fromSummary(
    BirdCoderChatMessageSummary summary,
  ) {
    return BirdCoderMobileChatMessageRecord(
      id: summary.id,
      role: summary.role,
      content: summary.content,
      createdAt: summary.createdAt,
    );
  }
}

Future<String> ensureBirdCoderMobileChatConversation(
  BirdCoderFlutterSdkClients clients,
) async {
  final sdk = clients.appSdk;
  final listed = await sdk.system.chatConversationsList();
  final conversations = _readConversations(listed);
  if (conversations.isNotEmpty) {
    return conversations.first.id;
  }
  final created = await sdk.system.chatConversationsCreate(
    BirdCoderCreateChatConversationRequest(),
  );
  return _readConversation(created).id;
}

Future<List<BirdCoderMobileChatMessageRecord>> listBirdCoderMobileChatMessages(
  BirdCoderFlutterSdkClients clients,
  String conversationId,
) async {
  final listed = await clients.appSdk.system.chatConversationsMessagesList(
    conversationId,
  );
  return _readMessages(listed)
      .map(BirdCoderMobileChatMessageRecord.fromSummary)
      .toList();
}

Future<BirdCoderMobileChatMessageRecord> sendBirdCoderMobileChatMessage(
  BirdCoderFlutterSdkClients clients,
  String conversationId,
  String content,
) async {
  final created = await clients.appSdk.system.chatConversationsMessagesCreate(
    conversationId,
    BirdCoderCreateChatMessageRequest(role: 'user', content: content),
  );
  return BirdCoderMobileChatMessageRecord.fromSummary(_readMessage(created));
}
