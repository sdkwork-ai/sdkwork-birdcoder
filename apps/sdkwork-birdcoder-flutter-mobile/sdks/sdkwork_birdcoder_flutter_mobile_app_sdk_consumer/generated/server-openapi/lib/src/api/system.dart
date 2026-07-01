import '../http/client.dart';
import '../models.dart';

import 'paths.dart';
import 'response_helpers.dart';


class SystemApi {
  final HttpClient _client;

  SystemApi(this._client);

  /// Get coding-server descriptor
  Future<BirdCoderCodingServerDescriptorEnvelope?> descriptorRetrieve() async {
    final response = await _client.get(ApiPaths.appPath('/system/descriptor'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderCodingServerDescriptorEnvelope.fromJson(map);
    })();
  }

  /// Get coding-server health
  Future<BirdCoderCoreHealthSummaryEnvelope?> healthRetrieve() async {
    final response = await _client.get(ApiPaths.appPath('/system/health'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderCoreHealthSummaryEnvelope.fromJson(map);
    })();
  }

  /// Get operation status
  Future<BirdCoderOperationDescriptorEnvelope?> operationsRetrieve(String operationId) async {
    final response = await _client.get(ApiPaths.appPath('/operations/${serializePathParameter(operationId, const PathParameterSpec('operationId', 'simple', false))}'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderOperationDescriptorEnvelope.fromJson(map);
    })();
  }

  /// List unified API routes
  Future<BirdCoderApiRouteCatalogEntryListEnvelope?> routesList() async {
    final response = await _client.get(ApiPaths.appPath('/system/routes'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderApiRouteCatalogEntryListEnvelope.fromJson(map);
    })();
  }

  /// Get runtime metadata
  Future<BirdCoderCoreRuntimeSummaryEnvelope?> runtimeRetrieve() async {
    final response = await _client.get(ApiPaths.appPath('/system/runtime'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderCoreRuntimeSummaryEnvelope.fromJson(map);
    })();
  }

  /// Get SDKWork IAM runtime metadata
  Future<BirdCoderIamRuntimeSettingsEnvelope?> iamRuntimeRetrieve() async {
    final response = await _client.get(ApiPaths.appPath('/system/iam/runtime'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamRuntimeSettingsEnvelope.fromJson(map);
    })();
  }

  /// Get SDKWork IAM verification policy
  Future<BirdCoderIamVerificationPolicyEnvelope?> iamVerificationPolicyRetrieve() async {
    final response = await _client.get(ApiPaths.appPath('/system/iam/verification_policy'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamVerificationPolicyEnvelope.fromJson(map);
    })();
  }

  /// List chat conversations
  Future<BirdCoderChatConversationSummaryListEnvelope?> chatConversationsList() async {
    final response = await _client.get(ApiPaths.appPath('/chat/conversations'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderChatConversationSummaryListEnvelope.fromJson(map);
    })();
  }

  /// Create chat conversation
  Future<BirdCoderChatConversationSummaryEnvelope?> chatConversationsCreate(BirdCoderCreateChatConversationRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.appPath('/chat/conversations'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderChatConversationSummaryEnvelope.fromJson(map);
    })();
  }

  /// Get chat conversation
  Future<BirdCoderChatConversationSummaryEnvelope?> chatConversationsRetrieve(String conversationId) async {
    final response = await _client.get(ApiPaths.appPath('/chat/conversations/${serializePathParameter(conversationId, const PathParameterSpec('conversationId', 'simple', false))}'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderChatConversationSummaryEnvelope.fromJson(map);
    })();
  }

  /// Delete chat conversation
  Future<BirdCoderDeleteChatConversationEnvelope?> chatConversationsDelete(String conversationId) async {
    final response = await _client.delete(ApiPaths.appPath('/chat/conversations/${serializePathParameter(conversationId, const PathParameterSpec('conversationId', 'simple', false))}'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderDeleteChatConversationEnvelope.fromJson(map);
    })();
  }

  /// List chat messages
  Future<BirdCoderChatMessageSummaryListEnvelope?> chatConversationsMessagesList(String conversationId) async {
    final response = await _client.get(ApiPaths.appPath('/chat/conversations/${serializePathParameter(conversationId, const PathParameterSpec('conversationId', 'simple', false))}/messages'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderChatMessageSummaryListEnvelope.fromJson(map);
    })();
  }

  /// Create chat message
  Future<BirdCoderChatMessageSummaryEnvelope?> chatConversationsMessagesCreate(String conversationId, BirdCoderCreateChatMessageRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.appPath('/chat/conversations/${serializePathParameter(conversationId, const PathParameterSpec('conversationId', 'simple', false))}/messages'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderChatMessageSummaryEnvelope.fromJson(map);
    })();
  }
}

class PathParameterSpec {
  final String name;
  final String style;
  final bool explode;

  const PathParameterSpec(this.name, this.style, this.explode);
}

String serializePathParameter(dynamic value, PathParameterSpec spec) {
  if (value == null) return '';
  final style = spec.style.trim().isEmpty ? 'simple' : spec.style;
  if (value is Iterable) {
    return serializePathArray(spec.name, value, style, spec.explode);
  }
  if (value is Map) {
    return serializePathObject(spec.name, value, style, spec.explode);
  }
  return pathPrimitivePrefix(spec.name, style) + Uri.encodeComponent(value.toString());
}

String serializePathArray(String name, Iterable values, String style, bool explode) {
  final serialized = values.where((item) => item != null).map((item) => Uri.encodeComponent(item.toString())).toList();
  if (serialized.isEmpty) return pathPrefix(name, style);
  if (style == 'matrix') {
    if (explode) {
      return serialized.map((item) => ';$name=$item').join();
    }
    return ';$name=${serialized.join(',')}';
  }
  final separator = explode ? '.' : ',';
  return pathPrefix(name, style) + serialized.join(separator);
}

String serializePathObject(String name, Map values, String style, bool explode) {
  final entries = <String>[];
  final exploded = <String>[];
  values.forEach((key, value) {
    if (value == null) return;
    final escapedKey = Uri.encodeComponent(key.toString());
    final escapedValue = Uri.encodeComponent(value.toString());
    if (explode) {
      if (style == 'matrix') {
        exploded.add(';$escapedKey=$escapedValue');
      } else {
        exploded.add('$escapedKey=$escapedValue');
      }
    } else {
      entries.add(escapedKey);
      entries.add(escapedValue);
    }
  });
  if (style == 'matrix') {
    if (explode) return exploded.join();
    return ';$name=${entries.join(',')}';
  }
  if (explode) {
    final separator = style == 'label' ? '.' : ',';
    return pathPrefix(name, style) + exploded.join(separator);
  }
  return pathPrefix(name, style) + entries.join(',');
}

String pathPrefix(String name, String style) {
  if (style == 'label') return '.';
  if (style == 'matrix') return ';$name';
  return '';
}

String pathPrimitivePrefix(String name, String style) {
  return style == 'matrix' ? ';$name=' : pathPrefix(name, style);
}
