import 'dart:convert';
import '../http/client.dart';
import '../models.dart';

import 'paths.dart';
import 'response_helpers.dart';


class IamApi {
  final HttpClient _client;

  IamApi(this._client);

  /// List SDKWork IAM API keys
  Future<BirdCoderIamApiKeySummaryListEnvelope?> apiKeysList() async {
    final response = await _client.get(ApiPaths.backendPath('/iam/api_keys'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamApiKeySummaryListEnvelope.fromJson(map);
    })();
  }

  /// Revoke SDKWork IAM API key
  Future<BirdCoderBooleanSuccessEnvelope?> apiKeysRevoke(String apiKeyId) async {
    final response = await _client.post(ApiPaths.backendPath('/iam/api_keys/${serializePathParameter(apiKeyId, const PathParameterSpec('apiKeyId', 'simple', false))}/revoke'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderBooleanSuccessEnvelope.fromJson(map);
    })();
  }

  /// List SDKWork IAM audit events
  Future<BirdCoderIamAuditEventSummaryListEnvelope?> auditEventsList() async {
    final response = await _client.get(ApiPaths.backendPath('/iam/audit_events'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamAuditEventSummaryListEnvelope.fromJson(map);
    })();
  }

  /// Get SDKWork IAM organization
  Future<BirdCoderIamOrganizationSummaryEnvelope?> organizationsRetrieve(String organizationId) async {
    final response = await _client.get(ApiPaths.backendPath('/iam/organizations/${serializePathParameter(organizationId, const PathParameterSpec('organizationId', 'simple', false))}'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamOrganizationSummaryEnvelope.fromJson(map);
    })();
  }

  /// Update SDKWork IAM organization
  Future<BirdCoderIamOrganizationSummaryEnvelope?> organizationsUpdate(String organizationId, BirdCoderUpdateIamOrganizationRequest body) async {
    final payload = body.toJson();
    final response = await _client.patch(ApiPaths.backendPath('/iam/organizations/${serializePathParameter(organizationId, const PathParameterSpec('organizationId', 'simple', false))}'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamOrganizationSummaryEnvelope.fromJson(map);
    })();
  }

  /// Delete SDKWork IAM organization
  Future<BirdCoderDeletedResourceEnvelope?> organizationsDelete(String organizationId) async {
    final response = await _client.delete(ApiPaths.backendPath('/iam/organizations/${serializePathParameter(organizationId, const PathParameterSpec('organizationId', 'simple', false))}'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderDeletedResourceEnvelope.fromJson(map);
    })();
  }

  /// Create SDKWork IAM organization
  Future<BirdCoderIamOrganizationSummaryEnvelope?> organizationsCreate(BirdCoderCreateIamOrganizationRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.backendPath('/iam/organizations'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamOrganizationSummaryEnvelope.fromJson(map);
    })();
  }

  /// Create SDKWork IAM organization membership
  Future<BirdCoderIamOrganizationMemberSummaryEnvelope?> organizationMembershipsCreate(BirdCoderCreateIamOrganizationMemberRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.backendPath('/iam/organization_memberships'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamOrganizationMemberSummaryEnvelope.fromJson(map);
    })();
  }

  /// Update SDKWork IAM organization membership
  Future<BirdCoderIamOrganizationMemberSummaryEnvelope?> organizationMembershipsUpdate(String membershipId, BirdCoderUpdateIamOrganizationMemberRequest body) async {
    final payload = body.toJson();
    final response = await _client.patch(ApiPaths.backendPath('/iam/organization_memberships/${serializePathParameter(membershipId, const PathParameterSpec('membershipId', 'simple', false))}'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamOrganizationMemberSummaryEnvelope.fromJson(map);
    })();
  }

  /// List SDKWork IAM permissions
  Future<BirdCoderIamPermissionSummaryListEnvelope?> permissionsList() async {
    final response = await _client.get(ApiPaths.backendPath('/iam/permissions'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamPermissionSummaryListEnvelope.fromJson(map);
    })();
  }

  /// Create SDKWork IAM permission
  Future<BirdCoderIamPermissionSummaryEnvelope?> permissionsCreate(BirdCoderCreateIamPermissionRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.backendPath('/iam/permissions'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamPermissionSummaryEnvelope.fromJson(map);
    })();
  }

  /// Get SDKWork IAM permission
  Future<BirdCoderIamPermissionSummaryEnvelope?> permissionsRetrieve(String permissionId) async {
    final response = await _client.get(ApiPaths.backendPath('/iam/permissions/${serializePathParameter(permissionId, const PathParameterSpec('permissionId', 'simple', false))}'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamPermissionSummaryEnvelope.fromJson(map);
    })();
  }

  /// Update SDKWork IAM permission
  Future<BirdCoderIamPermissionSummaryEnvelope?> permissionsUpdate(String permissionId, BirdCoderUpdateIamPermissionRequest body) async {
    final payload = body.toJson();
    final response = await _client.patch(ApiPaths.backendPath('/iam/permissions/${serializePathParameter(permissionId, const PathParameterSpec('permissionId', 'simple', false))}'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamPermissionSummaryEnvelope.fromJson(map);
    })();
  }

  /// Delete SDKWork IAM permission
  Future<BirdCoderDeletedResourceEnvelope?> permissionsDelete(String permissionId) async {
    final response = await _client.delete(ApiPaths.backendPath('/iam/permissions/${serializePathParameter(permissionId, const PathParameterSpec('permissionId', 'simple', false))}'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderDeletedResourceEnvelope.fromJson(map);
    })();
  }

  /// List SDKWork IAM policies
  Future<BirdCoderIamPolicySummaryListEnvelope?> policiesList() async {
    final response = await _client.get(ApiPaths.backendPath('/iam/policies'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamPolicySummaryListEnvelope.fromJson(map);
    })();
  }

  /// Create SDKWork IAM policy
  Future<BirdCoderIamPolicySummaryEnvelope?> policiesCreate(BirdCoderCreateIamPolicyRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.backendPath('/iam/policies'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamPolicySummaryEnvelope.fromJson(map);
    })();
  }

  /// Get SDKWork IAM policy
  Future<BirdCoderIamPolicySummaryEnvelope?> policiesRetrieve(String policyId) async {
    final response = await _client.get(ApiPaths.backendPath('/iam/policies/${serializePathParameter(policyId, const PathParameterSpec('policyId', 'simple', false))}'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamPolicySummaryEnvelope.fromJson(map);
    })();
  }

  /// Update SDKWork IAM policy
  Future<BirdCoderIamPolicySummaryEnvelope?> policiesUpdate(String policyId, BirdCoderUpdateIamPolicyRequest body) async {
    final payload = body.toJson();
    final response = await _client.patch(ApiPaths.backendPath('/iam/policies/${serializePathParameter(policyId, const PathParameterSpec('policyId', 'simple', false))}'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamPolicySummaryEnvelope.fromJson(map);
    })();
  }

  /// Delete SDKWork IAM policy
  Future<BirdCoderDeletedResourceEnvelope?> policiesDelete(String policyId) async {
    final response = await _client.delete(ApiPaths.backendPath('/iam/policies/${serializePathParameter(policyId, const PathParameterSpec('policyId', 'simple', false))}'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderDeletedResourceEnvelope.fromJson(map);
    })();
  }

  /// List SDKWork IAM roles
  Future<BirdCoderIamRoleSummaryListEnvelope?> rolesList() async {
    final response = await _client.get(ApiPaths.backendPath('/iam/roles'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamRoleSummaryListEnvelope.fromJson(map);
    })();
  }

  /// Create SDKWork IAM role
  Future<BirdCoderIamRoleSummaryEnvelope?> rolesCreate(BirdCoderCreateIamRoleRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.backendPath('/iam/roles'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamRoleSummaryEnvelope.fromJson(map);
    })();
  }

  /// Get SDKWork IAM role
  Future<BirdCoderIamRoleSummaryEnvelope?> rolesRetrieve(String roleId) async {
    final response = await _client.get(ApiPaths.backendPath('/iam/roles/${serializePathParameter(roleId, const PathParameterSpec('roleId', 'simple', false))}'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamRoleSummaryEnvelope.fromJson(map);
    })();
  }

  /// Update SDKWork IAM role
  Future<BirdCoderIamRoleSummaryEnvelope?> rolesUpdate(String roleId, BirdCoderUpdateIamRoleRequest body) async {
    final payload = body.toJson();
    final response = await _client.patch(ApiPaths.backendPath('/iam/roles/${serializePathParameter(roleId, const PathParameterSpec('roleId', 'simple', false))}'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamRoleSummaryEnvelope.fromJson(map);
    })();
  }

  /// Delete SDKWork IAM role
  Future<BirdCoderDeletedResourceEnvelope?> rolesDelete(String roleId) async {
    final response = await _client.delete(ApiPaths.backendPath('/iam/roles/${serializePathParameter(roleId, const PathParameterSpec('roleId', 'simple', false))}'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderDeletedResourceEnvelope.fromJson(map);
    })();
  }

  /// List SDKWork IAM role permissions
  Future<BirdCoderIamRolePermissionSummaryListEnvelope?> rolesPermissionsList(String roleId) async {
    final response = await _client.get(ApiPaths.backendPath('/iam/roles/${serializePathParameter(roleId, const PathParameterSpec('roleId', 'simple', false))}/permissions'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamRolePermissionSummaryListEnvelope.fromJson(map);
    })();
  }

  /// Create SDKWork IAM role permission
  Future<BirdCoderIamRolePermissionSummaryEnvelope?> rolesPermissionsCreate(String roleId, BirdCoderCreateIamRolePermissionRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.backendPath('/iam/roles/${serializePathParameter(roleId, const PathParameterSpec('roleId', 'simple', false))}/permissions'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamRolePermissionSummaryEnvelope.fromJson(map);
    })();
  }

  /// Delete SDKWork IAM role permission
  Future<BirdCoderBooleanSuccessEnvelope?> rolesPermissionsDelete(String roleId, String permissionId) async {
    final response = await _client.delete(ApiPaths.backendPath('/iam/roles/${serializePathParameter(roleId, const PathParameterSpec('roleId', 'simple', false))}/permissions/${serializePathParameter(permissionId, const PathParameterSpec('permissionId', 'simple', false))}'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderBooleanSuccessEnvelope.fromJson(map);
    })();
  }

  /// List SDKWork IAM security events
  Future<BirdCoderIamSecurityEventSummaryListEnvelope?> securityEventsList() async {
    final response = await _client.get(ApiPaths.backendPath('/iam/security_events'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamSecurityEventSummaryListEnvelope.fromJson(map);
    })();
  }

  /// List SDKWork IAM tenants
  Future<BirdCoderIamTenantSummaryListEnvelope?> tenantsList() async {
    final response = await _client.get(ApiPaths.backendPath('/iam/tenants'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamTenantSummaryListEnvelope.fromJson(map);
    })();
  }

  /// Create SDKWork IAM tenant
  Future<BirdCoderIamTenantSummaryEnvelope?> tenantsCreate(BirdCoderCreateIamTenantRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.backendPath('/iam/tenants'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamTenantSummaryEnvelope.fromJson(map);
    })();
  }

  /// Get SDKWork IAM tenant
  Future<BirdCoderIamTenantSummaryEnvelope?> tenantsRetrieve(String tenantId) async {
    final response = await _client.get(ApiPaths.backendPath('/iam/tenants/${serializePathParameter(tenantId, const PathParameterSpec('tenantId', 'simple', false))}'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamTenantSummaryEnvelope.fromJson(map);
    })();
  }

  /// Update SDKWork IAM tenant
  Future<BirdCoderIamTenantSummaryEnvelope?> tenantsUpdate(String tenantId, BirdCoderUpdateIamTenantRequest body) async {
    final payload = body.toJson();
    final response = await _client.patch(ApiPaths.backendPath('/iam/tenants/${serializePathParameter(tenantId, const PathParameterSpec('tenantId', 'simple', false))}'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamTenantSummaryEnvelope.fromJson(map);
    })();
  }

  /// Delete SDKWork IAM tenant
  Future<BirdCoderDeletedResourceEnvelope?> tenantsDelete(String tenantId) async {
    final response = await _client.delete(ApiPaths.backendPath('/iam/tenants/${serializePathParameter(tenantId, const PathParameterSpec('tenantId', 'simple', false))}'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderDeletedResourceEnvelope.fromJson(map);
    })();
  }

  /// List SDKWork IAM tenant members
  Future<BirdCoderIamTenantMemberSummaryListEnvelope?> tenantsMembersList(String tenantId) async {
    final response = await _client.get(ApiPaths.backendPath('/iam/tenants/${serializePathParameter(tenantId, const PathParameterSpec('tenantId', 'simple', false))}/members'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamTenantMemberSummaryListEnvelope.fromJson(map);
    })();
  }

  /// Create SDKWork IAM tenant member
  Future<BirdCoderIamTenantMemberSummaryEnvelope?> tenantsMembersCreate(String tenantId, BirdCoderCreateIamTenantMemberRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.backendPath('/iam/tenants/${serializePathParameter(tenantId, const PathParameterSpec('tenantId', 'simple', false))}/members'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamTenantMemberSummaryEnvelope.fromJson(map);
    })();
  }

  /// Update SDKWork IAM tenant member
  Future<BirdCoderIamTenantMemberSummaryEnvelope?> tenantsMembersUpdate(String tenantId, String userId, BirdCoderUpdateIamTenantMemberRequest body) async {
    final payload = body.toJson();
    final response = await _client.patch(ApiPaths.backendPath('/iam/tenants/${serializePathParameter(tenantId, const PathParameterSpec('tenantId', 'simple', false))}/members/${serializePathParameter(userId, const PathParameterSpec('userId', 'simple', false))}'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamTenantMemberSummaryEnvelope.fromJson(map);
    })();
  }

  /// Delete SDKWork IAM tenant member
  Future<BirdCoderBooleanSuccessEnvelope?> tenantsMembersDelete(String tenantId, String userId) async {
    final response = await _client.delete(ApiPaths.backendPath('/iam/tenants/${serializePathParameter(tenantId, const PathParameterSpec('tenantId', 'simple', false))}/members/${serializePathParameter(userId, const PathParameterSpec('userId', 'simple', false))}'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderBooleanSuccessEnvelope.fromJson(map);
    })();
  }

  /// List SDKWork IAM users
  Future<BirdCoderIamUserSummaryListEnvelope?> usersList() async {
    final response = await _client.get(ApiPaths.backendPath('/iam/users'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamUserSummaryListEnvelope.fromJson(map);
    })();
  }

  /// Create SDKWork IAM user
  Future<BirdCoderIamUserSummaryEnvelope?> usersCreate(BirdCoderCreateIamUserRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.backendPath('/iam/users'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamUserSummaryEnvelope.fromJson(map);
    })();
  }

  /// Get SDKWork IAM user
  Future<BirdCoderIamUserSummaryEnvelope?> usersRetrieve(String userId) async {
    final response = await _client.get(ApiPaths.backendPath('/iam/users/${serializePathParameter(userId, const PathParameterSpec('userId', 'simple', false))}'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamUserSummaryEnvelope.fromJson(map);
    })();
  }

  /// Update SDKWork IAM user
  Future<BirdCoderIamUserSummaryEnvelope?> usersUpdate(String userId, BirdCoderUpdateIamUserRequest body) async {
    final payload = body.toJson();
    final response = await _client.patch(ApiPaths.backendPath('/iam/users/${serializePathParameter(userId, const PathParameterSpec('userId', 'simple', false))}'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamUserSummaryEnvelope.fromJson(map);
    })();
  }

  /// Delete SDKWork IAM user
  Future<BirdCoderDeletedResourceEnvelope?> usersDelete(String userId) async {
    final response = await _client.delete(ApiPaths.backendPath('/iam/users/${serializePathParameter(userId, const PathParameterSpec('userId', 'simple', false))}'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderDeletedResourceEnvelope.fromJson(map);
    })();
  }

  /// Create SDKWork IAM user role binding
  Future<BirdCoderIamUserRoleSummaryEnvelope?> roleBindingsCreate(BirdCoderCreateIamUserRoleRequest body) async {
    final payload = body.toJson();
    final response = await _client.post(ApiPaths.backendPath('/iam/role_bindings'), body: payload, contentType: 'application/json');
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderIamUserRoleSummaryEnvelope.fromJson(map);
    })();
  }

  /// Delete SDKWork IAM user role binding
  Future<BirdCoderBooleanSuccessEnvelope?> roleBindingsDelete(String roleBindingId) async {
    final response = await _client.delete(ApiPaths.backendPath('/iam/role_bindings/${serializePathParameter(roleBindingId, const PathParameterSpec('roleBindingId', 'simple', false))}'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderBooleanSuccessEnvelope.fromJson(map);
    })();
  }

  /// List team members
  Future<BirdCoderTeamMemberSummaryListEnvelope?> teamsMembersList(String teamId) async {
    final response = await _client.get(ApiPaths.backendPath('/iam/teams/${serializePathParameter(teamId, const PathParameterSpec('teamId', 'simple', false))}/members'));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderTeamMemberSummaryListEnvelope.fromJson(map);
    })();
  }

  /// List teams
  Future<BirdCoderTeamSummaryListEnvelope?> teamsList([String? userId, String? workspaceId]) async {
    final query = buildQueryString([
      QueryParameterSpec('userId', userId, 'form', true, false, null),
      QueryParameterSpec('workspaceId', workspaceId, 'form', true, false, null)
    ]);
    final response = await _client.get(ApiPaths.appendQueryString(ApiPaths.backendPath('/iam/teams'), query));
    return (() {
      final map = sdkworkResponseAsMap(response);
      return map == null ? null : BirdCoderTeamSummaryListEnvelope.fromJson(map);
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
