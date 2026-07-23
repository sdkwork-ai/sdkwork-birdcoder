import '../http/client.dart';
import '../models.dart';

import 'paths.dart';
import 'response_helpers.dart';


class SystemApi {
  final HttpClient _client;

  SystemApi(this._client);

  /// Get BirdCoder application descriptor
  Future<BirdCoderApplicationDescriptorEnvelope?> descriptorRetrieve() async {
    final response = await _client.get(ApiPaths.appPath('/system/descriptor'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderApplicationDescriptorEnvelope.fromJson(map);
    })();
  }

  /// Get BirdCoder application health
  Future<BirdCoderCoreHealthSummaryEnvelope?> healthRetrieve() async {
    final response = await _client.get(ApiPaths.appPath('/system/health'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderCoreHealthSummaryEnvelope.fromJson(map);
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
}
