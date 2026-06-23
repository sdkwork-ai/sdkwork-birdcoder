import '../http/client.dart';
import '../models.dart';

import 'paths.dart';
import 'response_helpers.dart';


class IamApi {
  final HttpClient _client;

  IamApi(this._client);

  /// Get current SDKWork IAM user
  Future<BirdCoderIamUserProfileEnvelope?> usersCurrentRetrieve() async {
    final response = await _client.get(ApiPaths.appPath('/iam/users/current'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamUserProfileEnvelope.fromJson(map);
    })();
  }

  /// Update current SDKWork IAM user profile
  Future<BirdCoderIamUserProfileEnvelope?> usersCurrentUpdate(BirdCoderUpdateCurrentUserProfileRequest body) async {
    final payload = body.toJson();
    final response = await _client.patch(ApiPaths.appPath('/iam/users/current'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamUserProfileEnvelope.fromJson(map);
    })();
  }

  /// Upsert workspace member
  Future<BirdCoderWorkspaceMemberSummaryEnvelope?> workspacesMembersUpsert(String workspaceId, BirdCoderUpsertWorkspaceMemberRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.appPath('/workspaces/${serializePathParameter(workspaceId, const PathParameterSpec('workspaceId', 'simple', false))}/members'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderWorkspaceMemberSummaryEnvelope.fromJson(map);
    })();
  }

  /// List workspace members
  Future<BirdCoderWorkspaceMemberSummaryListEnvelope?> workspacesMembersList(String workspaceId) async {
    final response = await _client.get(ApiPaths.appPath('/workspaces/${serializePathParameter(workspaceId, const PathParameterSpec('workspaceId', 'simple', false))}/members'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderWorkspaceMemberSummaryListEnvelope.fromJson(map);
    })();
  }

  /// List SDKWork IAM organizations
  Future<BirdCoderIamOrganizationSummaryListEnvelope?> organizationsList() async {
    final response = await _client.get(ApiPaths.appPath('/iam/organizations'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamOrganizationSummaryListEnvelope.fromJson(map);
    })();
  }

  /// Get SDKWork IAM organization tree
  Future<BirdCoderIamOrganizationSummaryListEnvelope?> organizationsTreeRetrieve() async {
    final response = await _client.get(ApiPaths.appPath('/iam/organizations/tree'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamOrganizationSummaryListEnvelope.fromJson(map);
    })();
  }

  /// List SDKWork IAM organization memberships
  Future<BirdCoderIamOrganizationMemberSummaryListEnvelope?> organizationMembershipsList() async {
    final response = await _client.get(ApiPaths.appPath('/iam/organization_memberships'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamOrganizationMemberSummaryListEnvelope.fromJson(map);
    })();
  }

  /// List SDKWork IAM user role bindings
  Future<BirdCoderIamUserRoleSummaryListEnvelope?> roleBindingsList() async {
    final response = await _client.get(ApiPaths.appPath('/iam/role_bindings'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamUserRoleSummaryListEnvelope.fromJson(map);
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
