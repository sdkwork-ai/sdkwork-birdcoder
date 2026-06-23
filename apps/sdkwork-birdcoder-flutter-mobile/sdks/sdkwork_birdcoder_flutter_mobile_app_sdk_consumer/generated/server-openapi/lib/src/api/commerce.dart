import '../http/client.dart';
import '../models.dart';

import 'paths.dart';
import 'response_helpers.dart';


class CommerceApi {
  final HttpClient _client;

  CommerceApi(this._client);

  /// Get current SDKWork commerce membership
  Future<BirdCoderCommerceMembershipCurrentEnvelope?> membershipsCurrentRetrieve() async {
    final response = await _client.get(ApiPaths.appPath('/memberships/current'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderCommerceMembershipCurrentEnvelope.fromJson(map);
    })();
  }

  /// List SDKWork commerce membership package groups
  Future<BirdCoderCommerceMembershipPackageGroupSummaryListEnvelope?> membershipsPackageGroupsList() async {
    final response = await _client.get(ApiPaths.appPath('/memberships/package_groups'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderCommerceMembershipPackageGroupSummaryListEnvelope.fromJson(map);
    })();
  }
}
