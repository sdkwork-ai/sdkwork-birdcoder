import '../http/client.dart';
import '../models.dart';

import 'paths.dart';
import 'response_helpers.dart';


class TemplatesApi {
  final HttpClient _client;

  TemplatesApi(this._client);

  /// List app templates
  Future<BirdCoderAppTemplateSummaryListEnvelope?> appTemplatesList() async {
    final response = await _client.get(ApiPaths.appPath('/app_templates'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderAppTemplateSummaryListEnvelope.fromJson(map);
    })();
  }
}
