import 'dart:convert';
import '../http/client.dart';
import '../models.dart';

import 'paths.dart';
import 'response_helpers.dart';


class PlatformApi {
  final HttpClient _client;

  PlatformApi(this._client);

  /// Create project
  Future<BirdCoderProjectSummaryEnvelope?> projectsCreate(BirdCoderCreateProjectRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.appPath('/projects'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderProjectSummaryEnvelope.fromJson(map);
    })();
  }

  /// List projects
  Future<BirdCoderProjectSummaryListEnvelope?> projectsList([String? userId, String? workspaceId, String? rootPath, int? limit, int? offset]) async {
    final query = buildQueryString([
      QueryParameterSpec('userId', userId, 'form', true, false, null),
      QueryParameterSpec('workspaceId', workspaceId, 'form', true, false, null),
      QueryParameterSpec('rootPath', rootPath, 'form', true, false, null),
      QueryParameterSpec('limit', limit, 'form', true, false, null),
      QueryParameterSpec('offset', offset, 'form', true, false, null)
    ]);
    final response = await _client.get(ApiPaths.appendQueryString(ApiPaths.appPath('/projects'), query));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderProjectSummaryListEnvelope.fromJson(map);
    })();
  }

  /// Upsert project collaborator
  Future<BirdCoderProjectCollaboratorSummaryEnvelope?> projectsCollaboratorsUpsert(String projectId, BirdCoderUpsertProjectCollaboratorRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.appPath('/projects/${serializePathParameter(projectId, const PathParameterSpec('projectId', 'simple', false))}/collaborators'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderProjectCollaboratorSummaryEnvelope.fromJson(map);
    })();
  }

  /// List project collaborators
  Future<BirdCoderProjectCollaboratorSummaryListEnvelope?> projectsCollaboratorsList(String projectId) async {
    final response = await _client.get(ApiPaths.appPath('/projects/${serializePathParameter(projectId, const PathParameterSpec('projectId', 'simple', false))}/collaborators'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderProjectCollaboratorSummaryListEnvelope.fromJson(map);
    })();
  }

  /// Create workspace
  Future<BirdCoderWorkspaceSummaryEnvelope?> workspacesCreate(BirdCoderCreateWorkspaceRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.appPath('/workspaces'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderWorkspaceSummaryEnvelope.fromJson(map);
    })();
  }

  /// List workspaces
  Future<BirdCoderWorkspaceSummaryListEnvelope?> workspacesList([String? userId, int? limit, int? offset]) async {
    final query = buildQueryString([
      QueryParameterSpec('userId', userId, 'form', true, false, null),
      QueryParameterSpec('limit', limit, 'form', true, false, null),
      QueryParameterSpec('offset', offset, 'form', true, false, null)
    ]);
    final response = await _client.get(ApiPaths.appendQueryString(ApiPaths.appPath('/workspaces'), query));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderWorkspaceSummaryListEnvelope.fromJson(map);
    })();
  }

  /// Delete project
  Future<BirdCoderDeletedResourceEnvelope?> projectsDelete(String projectId) async {
    final response = await _client.delete(ApiPaths.appPath('/projects/${serializePathParameter(projectId, const PathParameterSpec('projectId', 'simple', false))}'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderDeletedResourceEnvelope.fromJson(map);
    })();
  }

  /// Get project
  Future<BirdCoderProjectSummaryEnvelope?> projectsRetrieve(String projectId) async {
    final response = await _client.get(ApiPaths.appPath('/projects/${serializePathParameter(projectId, const PathParameterSpec('projectId', 'simple', false))}'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderProjectSummaryEnvelope.fromJson(map);
    })();
  }

  /// Update project
  Future<BirdCoderProjectSummaryEnvelope?> projectsUpdate(String projectId, BirdCoderUpdateProjectRequest body) async {
    final payload = body.toJson();
    final response = await _client.patch(ApiPaths.appPath('/projects/${serializePathParameter(projectId, const PathParameterSpec('projectId', 'simple', false))}'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderProjectSummaryEnvelope.fromJson(map);
    })();
  }

  /// Delete workspace
  Future<BirdCoderDeletedResourceEnvelope?> workspacesDelete(String workspaceId) async {
    final response = await _client.delete(ApiPaths.appPath('/workspaces/${serializePathParameter(workspaceId, const PathParameterSpec('workspaceId', 'simple', false))}'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderDeletedResourceEnvelope.fromJson(map);
    })();
  }

  /// Get workspace
  Future<BirdCoderWorkspaceSummaryEnvelope?> workspacesRetrieve(String workspaceId) async {
    final response = await _client.get(ApiPaths.appPath('/workspaces/${serializePathParameter(workspaceId, const PathParameterSpec('workspaceId', 'simple', false))}'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderWorkspaceSummaryEnvelope.fromJson(map);
    })();
  }

  /// Update workspace
  Future<BirdCoderWorkspaceSummaryEnvelope?> workspacesUpdate(String workspaceId, BirdCoderUpdateWorkspaceRequest body) async {
    final payload = body.toJson();
    final response = await _client.patch(ApiPaths.appPath('/workspaces/${serializePathParameter(workspaceId, const PathParameterSpec('workspaceId', 'simple', false))}'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderWorkspaceSummaryEnvelope.fromJson(map);
    })();
  }

  /// Subscribe to workspace realtime invalidation events
  Future<ProblemDetail?> workspacesRealtimeSubscribe(String workspaceId, [String? sessionId]) async {
    final query = buildQueryString([
      QueryParameterSpec('sessionId', sessionId, 'form', true, false, null)
    ]);
    final response = await _client.get(ApiPaths.appendQueryString(ApiPaths.appPath('/workspaces/${serializePathParameter(workspaceId, const PathParameterSpec('workspaceId', 'simple', false))}/realtime'), query));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : ProblemDetail.fromJson(map);
    })();
  }

  /// List deployments
  Future<BirdCoderDeploymentRecordSummaryListEnvelope?> deploymentsList() async {
    final response = await _client.get(ApiPaths.appPath('/deployments'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderDeploymentRecordSummaryListEnvelope.fromJson(map);
    })();
  }

  /// List project deployment targets
  Future<BirdCoderDeploymentTargetSummaryListEnvelope?> projectsDeploymentTargetsList(String projectId) async {
    final response = await _client.get(ApiPaths.appPath('/projects/${serializePathParameter(projectId, const PathParameterSpec('projectId', 'simple', false))}/deployment_targets'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderDeploymentTargetSummaryListEnvelope.fromJson(map);
    })();
  }

  /// Get project Git overview
  Future<BirdCoderProjectGitOverviewEnvelope?> projectsGitOverviewRetrieve(String projectId) async {
    final response = await _client.get(ApiPaths.appPath('/projects/${serializePathParameter(projectId, const PathParameterSpec('projectId', 'simple', false))}/git/overview'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderProjectGitOverviewEnvelope.fromJson(map);
    })();
  }

  /// Create project Git branch
  Future<BirdCoderProjectGitOverviewEnvelope?> projectsGitBranchesCreate(String projectId, BirdCoderCreateProjectGitBranchRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.appPath('/projects/${serializePathParameter(projectId, const PathParameterSpec('projectId', 'simple', false))}/git/branches'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderProjectGitOverviewEnvelope.fromJson(map);
    })();
  }

  /// Switch project Git branch
  Future<BirdCoderProjectGitOverviewEnvelope?> projectsGitBranchSwitchCreate(String projectId, BirdCoderSwitchProjectGitBranchRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.appPath('/projects/${serializePathParameter(projectId, const PathParameterSpec('projectId', 'simple', false))}/git/branch_switch'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderProjectGitOverviewEnvelope.fromJson(map);
    })();
  }

  /// Commit project Git changes
  Future<BirdCoderProjectGitOverviewEnvelope?> projectsGitCommitsCreate(String projectId, BirdCoderCommitProjectGitChangesRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.appPath('/projects/${serializePathParameter(projectId, const PathParameterSpec('projectId', 'simple', false))}/git/commits'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderProjectGitOverviewEnvelope.fromJson(map);
    })();
  }

  /// Push project Git branch
  Future<BirdCoderProjectGitOverviewEnvelope?> projectsGitPushesCreate(String projectId, [BirdCoderPushProjectGitBranchRequest? body]) async {
    final payload = body?.toJson();
    final response = await _client.post(ApiPaths.appPath('/projects/${serializePathParameter(projectId, const PathParameterSpec('projectId', 'simple', false))}/git/pushes'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderProjectGitOverviewEnvelope.fromJson(map);
    })();
  }

  /// Create project Git worktree
  Future<BirdCoderProjectGitOverviewEnvelope?> projectsGitWorktreesCreate(String projectId, BirdCoderCreateProjectGitWorktreeRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.appPath('/projects/${serializePathParameter(projectId, const PathParameterSpec('projectId', 'simple', false))}/git/worktrees'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderProjectGitOverviewEnvelope.fromJson(map);
    })();
  }

  /// Remove project Git worktree
  Future<BirdCoderProjectGitOverviewEnvelope?> projectsGitWorktreeRemovalsCreate(String projectId, BirdCoderRemoveProjectGitWorktreeRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.appPath('/projects/${serializePathParameter(projectId, const PathParameterSpec('projectId', 'simple', false))}/git/worktree_removals'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderProjectGitOverviewEnvelope.fromJson(map);
    })();
  }

  /// Prune project Git worktrees
  Future<BirdCoderProjectGitOverviewEnvelope?> projectsGitWorktreePruneCreate(String projectId) async {
    final response = await _client.post(ApiPaths.appPath('/projects/${serializePathParameter(projectId, const PathParameterSpec('projectId', 'simple', false))}/git/worktree_prune'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderProjectGitOverviewEnvelope.fromJson(map);
    })();
  }

  /// Publish project release flow
  Future<BirdCoderProjectPublishResultEnvelope?> projectsPublishCreate(String projectId, [BirdCoderPublishProjectRequest? body]) async {
    final payload = body?.toJson();
    final response = await _client.post(ApiPaths.appPath('/projects/${serializePathParameter(projectId, const PathParameterSpec('projectId', 'simple', false))}/publish'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderProjectPublishResultEnvelope.fromJson(map);
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
class QueryParameterSpec {
  final String name;
  final dynamic value;
  final String style;
  final bool explode;
  final bool allowReserved;
  final String? contentType;

  const QueryParameterSpec(
    this.name,
    this.value,
    this.style,
    this.explode,
    this.allowReserved,
    this.contentType,
  );
}

String buildQueryString(List<QueryParameterSpec> parameters) {
  final pairs = <String>[];
  for (final parameter in parameters) {
    appendSerializedParameter(pairs, parameter);
  }
  return pairs.join('&');
}

void appendSerializedParameter(List<String> pairs, QueryParameterSpec parameter) {
  final value = parameter.value;
  if (value == null) return;

  final contentType = parameter.contentType;
  if (contentType != null && contentType.trim().isNotEmpty) {
    pairs.add('${urlEncode(parameter.name)}=${encodeQueryValue(jsonEncode(value), parameter.allowReserved)}');
    return;
  }

  final style = parameter.style.trim().isEmpty ? 'form' : parameter.style;
  if (style == 'deepObject' && value is Map) {
    appendDeepObjectParameter(pairs, parameter.name, value, parameter.allowReserved);
    return;
  }
  if (value is Iterable) {
    appendArrayParameter(pairs, parameter.name, value, style, parameter.explode, parameter.allowReserved);
    return;
  }
  if (value is Map) {
    appendObjectParameter(pairs, parameter.name, value, style, parameter.explode, parameter.allowReserved);
    return;
  }
  pairs.add('${urlEncode(parameter.name)}=${encodeQueryValue(value.toString(), parameter.allowReserved)}');
}

void appendArrayParameter(
  List<String> pairs,
  String name,
  Iterable values,
  String style,
  bool explode,
  bool allowReserved,
) {
  final serialized = values.where((item) => item != null).map((item) => item.toString()).toList();
  if (serialized.isEmpty) return;
  if (style == 'form' && explode) {
    for (final item in serialized) {
      pairs.add('${urlEncode(name)}=${encodeQueryValue(item, allowReserved)}');
    }
    return;
  }
  pairs.add('${urlEncode(name)}=${encodeQueryValue(serialized.join(','), allowReserved)}');
}

void appendObjectParameter(
  List<String> pairs,
  String name,
  Map values,
  String style,
  bool explode,
  bool allowReserved,
) {
  final serialized = <String>[];
  values.forEach((key, value) {
    if (value == null) return;
    if (style == 'form' && explode) {
      pairs.add('${urlEncode(key.toString())}=${encodeQueryValue(value.toString(), allowReserved)}');
      return;
    }
    serialized.add(key.toString());
    serialized.add(value.toString());
  });
  if (serialized.isNotEmpty) {
    pairs.add('${urlEncode(name)}=${encodeQueryValue(serialized.join(','), allowReserved)}');
  }
}

void appendDeepObjectParameter(List<String> pairs, String name, Map values, bool allowReserved) {
  values.forEach((key, value) {
    if (value != null) {
      pairs.add('${urlEncode('$name[$key]')}=${encodeQueryValue(value.toString(), allowReserved)}');
    }
  });
}

String encodeQueryValue(String value, bool allowReserved) {
  var encoded = urlEncode(value);
  if (!allowReserved) return encoded;
  const replacements = <String, String>{
    '%3A': ':',
    '%2F': '/',
    '%3F': '?',
    '%23': '#',
    '%5B': '[',
    '%5D': ']',
    '%40': '@',
    '%21': '!',
    '%24': r'$',
    '%26': '&',
    '%27': "'",
    '%28': '(',
    '%29': ')',
    '%2A': '*',
    '%2B': '+',
    '%2C': ',',
    '%3B': ';',
    '%3D': '=',
  };
  replacements.forEach((escaped, reserved) {
    encoded = encoded.replaceAll(escaped, reserved);
  });
  return encoded;
}

String urlEncode(String value) => Uri.encodeQueryComponent(value);
