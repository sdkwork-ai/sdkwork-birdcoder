import '../http/client.dart';
import '../models.dart';

import 'paths.dart';
import 'response_helpers.dart';


class RuntimeApi {
  final HttpClient _client;

  RuntimeApi(this._client);

  /// Get runtime capabilities for one engine
  Future<BirdCoderEngineCapabilityMatrixEnvelope?> enginesCapabilitiesRetrieve(String engineKey) async {
    final response = await _client.get(ApiPaths.appPath('/engines/${serializePathParameter(engineKey, const PathParameterSpec('engineKey', 'simple', false))}/capabilities'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderEngineCapabilityMatrixEnvelope.fromJson(map);
    })();
  }

  /// List available engines
  Future<BirdCoderEngineDescriptorListEnvelope?> enginesList() async {
    final response = await _client.get(ApiPaths.appPath('/engines'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderEngineDescriptorListEnvelope.fromJson(map);
    })();
  }

  /// List registered native engine session providers
  Future<BirdCoderNativeSessionProviderSummaryListEnvelope?> nativeSessionProvidersList() async {
    final response = await _client.get(ApiPaths.appPath('/native_session_providers'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderNativeSessionProviderSummaryListEnvelope.fromJson(map);
    })();
  }

  /// Get code engine model configuration
  Future<BirdCoderCodeEngineModelConfigEnvelope?> modelConfigRetrieve() async {
    final response = await _client.get(ApiPaths.appPath('/model_config'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderCodeEngineModelConfigEnvelope.fromJson(map);
    })();
  }

  /// Sync code engine model configuration
  Future<BirdCoderCodeEngineModelConfigSyncResultEnvelope?> modelConfigUpdate(BirdCoderSyncCodeEngineModelConfigRequest body) async {
    final payload = body.toJson();
    final response = await _client.put(ApiPaths.appPath('/model_config'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderCodeEngineModelConfigSyncResultEnvelope.fromJson(map);
    })();
  }

  /// List model catalog
  Future<BirdCoderModelCatalogEntryListEnvelope?> modelsList() async {
    final response = await _client.get(ApiPaths.appPath('/models'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderModelCatalogEntryListEnvelope.fromJson(map);
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
