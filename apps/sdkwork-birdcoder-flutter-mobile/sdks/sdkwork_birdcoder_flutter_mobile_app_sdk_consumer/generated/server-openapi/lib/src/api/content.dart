import '../http/client.dart';
import '../models.dart';

import 'paths.dart';
import 'response_helpers.dart';


class ContentApi {
  final HttpClient _client;

  ContentApi(this._client);

  /// List project documents
  Future<BirdCoderProjectDocumentSummaryListEnvelope?> documentsList() async {
    final response = await _client.get(ApiPaths.appPath('/documents'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderProjectDocumentSummaryListEnvelope.fromJson(map);
    })();
  }
}
