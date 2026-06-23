Map<String, dynamic>? _sdkworkAsMap(dynamic value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return value.map((key, item) => MapEntry(key.toString(), item));
  }
  return null;
}

List<dynamic>? _sdkworkAsList(dynamic value) {
  return value is List ? value : null;
}

class BirdCoderApiListMeta {
  final int page;
  final int pageSize;
  final int total;
  final String version;

  BirdCoderApiListMeta({
    required this.page,
    required this.pageSize,
    required this.total,
    required this.version
  });

  factory BirdCoderApiListMeta.fromJson(Map<String, dynamic> json) {
    return BirdCoderApiListMeta(
      page: (() {
        final value = json['page'];
        if (value is! int) {
          throw FormatException('BirdCoderApiListMeta.page is required');
        }
        return value;
      })(),
      pageSize: (() {
        final value = json['pageSize'];
        if (value is! int) {
          throw FormatException('BirdCoderApiListMeta.pageSize is required');
        }
        return value;
      })(),
      total: (() {
        final value = json['total'];
        if (value is! int) {
          throw FormatException('BirdCoderApiListMeta.total is required');
        }
        return value;
      })(),
      version: (() {
        final value = json['version']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApiListMeta.version is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'page': page,
      'pageSize': pageSize,
      'total': total,
      'version': version,
    };
  }
}

class BirdCoderApiMeta {
  final int? page;
  final int? pageSize;
  final int? total;
  final String version;

  BirdCoderApiMeta({
    this.page,
    this.pageSize,
    this.total,
    required this.version
  });

  factory BirdCoderApiMeta.fromJson(Map<String, dynamic> json) {
    return BirdCoderApiMeta(
      page: json['page'] is int ? json['page'] : null,
      pageSize: json['pageSize'] is int ? json['pageSize'] : null,
      total: json['total'] is int ? json['total'] : null,
      version: (() {
        final value = json['version']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApiMeta.version is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'page': page,
      'pageSize': pageSize,
      'total': total,
      'version': version,
    };
  }
}

class BirdCoderApiProblemDetails {
  final String code;
  final String message;
  final String? detail;
  final bool retryable;
  final Map<String, String>? fieldErrors;

  BirdCoderApiProblemDetails({
    required this.code,
    required this.message,
    this.detail,
    required this.retryable,
    this.fieldErrors
  });

  factory BirdCoderApiProblemDetails.fromJson(Map<String, dynamic> json) {
    return BirdCoderApiProblemDetails(
      code: (() {
        final value = json['code']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApiProblemDetails.code is required');
        }
        return value;
      })(),
      message: (() {
        final value = json['message']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApiProblemDetails.message is required');
        }
        return value;
      })(),
      detail: json['detail']?.toString(),
      retryable: (() {
        final value = json['retryable'];
        if (value is! bool) {
          throw FormatException('BirdCoderApiProblemDetails.retryable is required');
        }
        return value;
      })(),
      fieldErrors: (() {
        final map = _sdkworkAsMap(json['fieldErrors']);
        if (map == null) {
          return null;
        }
        final result = <String, String>{};
        map.forEach((key, item) {
          final deserialized = item?.toString();
          if (deserialized is String) {
            result[key] = deserialized;
          }
        });
        return result;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'message': message,
      'detail': detail,
      'retryable': retryable,
      'fieldErrors': fieldErrors?.map((key, item) => MapEntry(key, item)),
    };
  }
}

class BirdCoderBooleanSuccessEnvelope {
  final BirdCoderBooleanSuccessResult data;
  final BirdCoderApiMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderBooleanSuccessEnvelope({
    required this.data,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderBooleanSuccessEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderBooleanSuccessEnvelope(
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderBooleanSuccessEnvelope.data is required');
        }
        return BirdCoderBooleanSuccessResult.fromJson(map);
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderBooleanSuccessEnvelope.meta is required');
        }
        return BirdCoderApiMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderBooleanSuccessEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderBooleanSuccessEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'data': data.toJson(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderBooleanSuccessResult {
  final bool success;

  BirdCoderBooleanSuccessResult({
    required this.success
  });

  factory BirdCoderBooleanSuccessResult.fromJson(Map<String, dynamic> json) {
    return BirdCoderBooleanSuccessResult(
      success: (() {
        final value = json['success'];
        if (value is! bool) {
          throw FormatException('BirdCoderBooleanSuccessResult.success is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'success': success,
    };
  }
}

class BirdCoderCreateIamOrganizationMemberRequest {
  final String userId;
  final String roleCode;
  final String? remark;

  BirdCoderCreateIamOrganizationMemberRequest({
    required this.userId,
    required this.roleCode,
    this.remark
  });

  factory BirdCoderCreateIamOrganizationMemberRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateIamOrganizationMemberRequest(
      userId: (() {
        final value = json['userId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateIamOrganizationMemberRequest.userId is required');
        }
        return value;
      })(),
      roleCode: (() {
        final value = json['roleCode']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateIamOrganizationMemberRequest.roleCode is required');
        }
        return value;
      })(),
      remark: json['remark']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'userId': userId,
      'roleCode': roleCode,
      'remark': remark,
    };
  }
}

class BirdCoderCreateIamOrganizationRequest {
  final String code;
  final String name;
  final String? parentId;

  BirdCoderCreateIamOrganizationRequest({
    required this.code,
    required this.name,
    this.parentId
  });

  factory BirdCoderCreateIamOrganizationRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateIamOrganizationRequest(
      code: (() {
        final value = json['code']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateIamOrganizationRequest.code is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateIamOrganizationRequest.name is required');
        }
        return value;
      })(),
      parentId: json['parentId']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'name': name,
      'parentId': parentId,
    };
  }
}

class BirdCoderCreateIamPermissionRequest {
  final String code;
  final String name;
  final String resource;
  final String action;

  BirdCoderCreateIamPermissionRequest({
    required this.code,
    required this.name,
    required this.resource,
    required this.action
  });

  factory BirdCoderCreateIamPermissionRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateIamPermissionRequest(
      code: (() {
        final value = json['code']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateIamPermissionRequest.code is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateIamPermissionRequest.name is required');
        }
        return value;
      })(),
      resource: (() {
        final value = json['resource']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateIamPermissionRequest.resource is required');
        }
        return value;
      })(),
      action: (() {
        final value = json['action']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateIamPermissionRequest.action is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'name': name,
      'resource': resource,
      'action': action,
    };
  }
}

class BirdCoderCreateIamPolicyRequest {
  final String code;
  final String name;
  final Map<String, dynamic> policy;

  BirdCoderCreateIamPolicyRequest({
    required this.code,
    required this.name,
    required this.policy
  });

  factory BirdCoderCreateIamPolicyRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateIamPolicyRequest(
      code: (() {
        final value = json['code']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateIamPolicyRequest.code is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateIamPolicyRequest.name is required');
        }
        return value;
      })(),
      policy: (() {
        final map = _sdkworkAsMap(json['policy']);
        if (map == null) {
          throw FormatException('BirdCoderCreateIamPolicyRequest.policy is required');
        }
        return map;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'name': name,
      'policy': policy,
    };
  }
}

class BirdCoderCreateIamRolePermissionRequest {
  final String permissionId;

  BirdCoderCreateIamRolePermissionRequest({
    required this.permissionId
  });

  factory BirdCoderCreateIamRolePermissionRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateIamRolePermissionRequest(
      permissionId: (() {
        final value = json['permissionId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateIamRolePermissionRequest.permissionId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'permissionId': permissionId,
    };
  }
}

class BirdCoderCreateIamRoleRequest {
  final String code;
  final String name;

  BirdCoderCreateIamRoleRequest({
    required this.code,
    required this.name
  });

  factory BirdCoderCreateIamRoleRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateIamRoleRequest(
      code: (() {
        final value = json['code']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateIamRoleRequest.code is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateIamRoleRequest.name is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'name': name,
    };
  }
}

class BirdCoderCreateIamTenantMemberRequest {
  final String userId;
  final String roleCode;
  final String? remark;

  BirdCoderCreateIamTenantMemberRequest({
    required this.userId,
    required this.roleCode,
    this.remark
  });

  factory BirdCoderCreateIamTenantMemberRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateIamTenantMemberRequest(
      userId: (() {
        final value = json['userId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateIamTenantMemberRequest.userId is required');
        }
        return value;
      })(),
      roleCode: (() {
        final value = json['roleCode']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateIamTenantMemberRequest.roleCode is required');
        }
        return value;
      })(),
      remark: json['remark']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'userId': userId,
      'roleCode': roleCode,
      'remark': remark,
    };
  }
}

class BirdCoderCreateIamTenantRequest {
  final String code;
  final String name;

  BirdCoderCreateIamTenantRequest({
    required this.code,
    required this.name
  });

  factory BirdCoderCreateIamTenantRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateIamTenantRequest(
      code: (() {
        final value = json['code']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateIamTenantRequest.code is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateIamTenantRequest.name is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'name': name,
    };
  }
}

class BirdCoderCreateIamUserRequest {
  final String? username;
  final String email;
  final String? phone;
  final String password;
  final String? displayName;
  final String? avatarUrl;

  BirdCoderCreateIamUserRequest({
    this.username,
    required this.email,
    this.phone,
    required this.password,
    this.displayName,
    this.avatarUrl
  });

  factory BirdCoderCreateIamUserRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateIamUserRequest(
      username: json['username']?.toString(),
      email: (() {
        final value = json['email']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateIamUserRequest.email is required');
        }
        return value;
      })(),
      phone: json['phone']?.toString(),
      password: (() {
        final value = json['password']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateIamUserRequest.password is required');
        }
        return value;
      })(),
      displayName: json['displayName']?.toString(),
      avatarUrl: json['avatarUrl']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'username': username,
      'email': email,
      'phone': phone,
      'password': password,
      'displayName': displayName,
      'avatarUrl': avatarUrl,
    };
  }
}

class BirdCoderCreateIamUserRoleRequest {
  final String roleId;
  final String? roleCode;

  BirdCoderCreateIamUserRoleRequest({
    required this.roleId,
    this.roleCode
  });

  factory BirdCoderCreateIamUserRoleRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateIamUserRoleRequest(
      roleId: (() {
        final value = json['roleId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateIamUserRoleRequest.roleId is required');
        }
        return value;
      })(),
      roleCode: json['roleCode']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'roleId': roleId,
      'roleCode': roleCode,
    };
  }
}

class BirdCoderDeletedResourceEnvelope {
  final BirdCoderDeletedResourceResult data;
  final BirdCoderApiMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderDeletedResourceEnvelope({
    required this.data,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderDeletedResourceEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderDeletedResourceEnvelope(
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderDeletedResourceEnvelope.data is required');
        }
        return BirdCoderDeletedResourceResult.fromJson(map);
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderDeletedResourceEnvelope.meta is required');
        }
        return BirdCoderApiMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeletedResourceEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeletedResourceEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'data': data.toJson(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderDeletedResourceResult {
  final String id;

  BirdCoderDeletedResourceResult({
    required this.id
  });

  factory BirdCoderDeletedResourceResult.fromJson(Map<String, dynamic> json) {
    return BirdCoderDeletedResourceResult(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeletedResourceResult.id is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
    };
  }
}

class BirdCoderDeploymentRecordSummary {
  final String id;
  final String? uuid;
  final String? tenantId;
  final String? organizationId;
  final String? createdAt;
  final String? updatedAt;
  final String projectId;
  final String targetId;
  final String? releaseRecordId;
  final String status;
  final String? endpointUrl;
  final String? startedAt;
  final String? completedAt;

  BirdCoderDeploymentRecordSummary({
    required this.id,
    this.uuid,
    this.tenantId,
    this.organizationId,
    this.createdAt,
    this.updatedAt,
    required this.projectId,
    required this.targetId,
    this.releaseRecordId,
    required this.status,
    this.endpointUrl,
    this.startedAt,
    this.completedAt
  });

  factory BirdCoderDeploymentRecordSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderDeploymentRecordSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeploymentRecordSummary.id is required');
        }
        return value;
      })(),
      uuid: json['uuid']?.toString(),
      tenantId: json['tenantId']?.toString(),
      organizationId: json['organizationId']?.toString(),
      createdAt: json['createdAt']?.toString(),
      updatedAt: json['updatedAt']?.toString(),
      projectId: (() {
        final value = json['projectId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeploymentRecordSummary.projectId is required');
        }
        return value;
      })(),
      targetId: (() {
        final value = json['targetId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeploymentRecordSummary.targetId is required');
        }
        return value;
      })(),
      releaseRecordId: json['releaseRecordId']?.toString(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeploymentRecordSummary.status is required');
        }
        return value;
      })(),
      endpointUrl: json['endpointUrl']?.toString(),
      startedAt: json['startedAt']?.toString(),
      completedAt: json['completedAt']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'uuid': uuid,
      'tenantId': tenantId,
      'organizationId': organizationId,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
      'projectId': projectId,
      'targetId': targetId,
      'releaseRecordId': releaseRecordId,
      'status': status,
      'endpointUrl': endpointUrl,
      'startedAt': startedAt,
      'completedAt': completedAt,
    };
  }
}

class BirdCoderDeploymentRecordSummaryListEnvelope {
  final List<BirdCoderDeploymentRecordSummary> items;
  final BirdCoderApiListMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderDeploymentRecordSummaryListEnvelope({
    required this.items,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderDeploymentRecordSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderDeploymentRecordSummaryListEnvelope(
      items: (() {
        final list = _sdkworkAsList(json['items']);
        if (list == null) {
          throw FormatException('BirdCoderDeploymentRecordSummaryListEnvelope.items is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderDeploymentRecordSummary.fromJson(map);
      })())
            .whereType<BirdCoderDeploymentRecordSummary>()
            .toList();
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderDeploymentRecordSummaryListEnvelope.meta is required');
        }
        return BirdCoderApiListMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeploymentRecordSummaryListEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeploymentRecordSummaryListEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'items': items.map((item) => item.toJson()).toList(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderDeploymentTargetSummary {
  final String id;
  final String? uuid;
  final String? tenantId;
  final String? organizationId;
  final String? createdAt;
  final String? updatedAt;
  final String projectId;
  final String name;
  final String environmentKey;
  final String runtime;
  final String status;

  BirdCoderDeploymentTargetSummary({
    required this.id,
    this.uuid,
    this.tenantId,
    this.organizationId,
    this.createdAt,
    this.updatedAt,
    required this.projectId,
    required this.name,
    required this.environmentKey,
    required this.runtime,
    required this.status
  });

  factory BirdCoderDeploymentTargetSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderDeploymentTargetSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeploymentTargetSummary.id is required');
        }
        return value;
      })(),
      uuid: json['uuid']?.toString(),
      tenantId: json['tenantId']?.toString(),
      organizationId: json['organizationId']?.toString(),
      createdAt: json['createdAt']?.toString(),
      updatedAt: json['updatedAt']?.toString(),
      projectId: (() {
        final value = json['projectId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeploymentTargetSummary.projectId is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeploymentTargetSummary.name is required');
        }
        return value;
      })(),
      environmentKey: (() {
        final value = json['environmentKey']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeploymentTargetSummary.environmentKey is required');
        }
        return value;
      })(),
      runtime: (() {
        final value = json['runtime']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeploymentTargetSummary.runtime is required');
        }
        return value;
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeploymentTargetSummary.status is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'uuid': uuid,
      'tenantId': tenantId,
      'organizationId': organizationId,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
      'projectId': projectId,
      'name': name,
      'environmentKey': environmentKey,
      'runtime': runtime,
      'status': status,
    };
  }
}

class BirdCoderDeploymentTargetSummaryListEnvelope {
  final List<BirdCoderDeploymentTargetSummary> items;
  final BirdCoderApiListMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderDeploymentTargetSummaryListEnvelope({
    required this.items,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderDeploymentTargetSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderDeploymentTargetSummaryListEnvelope(
      items: (() {
        final list = _sdkworkAsList(json['items']);
        if (list == null) {
          throw FormatException('BirdCoderDeploymentTargetSummaryListEnvelope.items is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderDeploymentTargetSummary.fromJson(map);
      })())
            .whereType<BirdCoderDeploymentTargetSummary>()
            .toList();
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderDeploymentTargetSummaryListEnvelope.meta is required');
        }
        return BirdCoderApiListMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeploymentTargetSummaryListEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeploymentTargetSummaryListEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'items': items.map((item) => item.toJson()).toList(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderIamApiKeySummary {
  final String id;
  final String tenantId;
  final String userId;
  final String name;
  final List<String> permissionScopes;
  final String status;
  final String? expiresAt;
  final String? createdAt;
  final String? updatedAt;

  BirdCoderIamApiKeySummary({
    required this.id,
    required this.tenantId,
    required this.userId,
    required this.name,
    required this.permissionScopes,
    required this.status,
    this.expiresAt,
    this.createdAt,
    this.updatedAt
  });

  factory BirdCoderIamApiKeySummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamApiKeySummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamApiKeySummary.id is required');
        }
        return value;
      })(),
      tenantId: (() {
        final value = json['tenantId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamApiKeySummary.tenantId is required');
        }
        return value;
      })(),
      userId: (() {
        final value = json['userId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamApiKeySummary.userId is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamApiKeySummary.name is required');
        }
        return value;
      })(),
      permissionScopes: (() {
        final list = _sdkworkAsList(json['permissionScopes']);
        if (list == null) {
          throw FormatException('BirdCoderIamApiKeySummary.permissionScopes is required');
        }
        return list
            .map((item) => item?.toString())
            .whereType<String>()
            .toList();
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamApiKeySummary.status is required');
        }
        return value;
      })(),
      expiresAt: json['expiresAt']?.toString(),
      createdAt: json['createdAt']?.toString(),
      updatedAt: json['updatedAt']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'tenantId': tenantId,
      'userId': userId,
      'name': name,
      'permissionScopes': permissionScopes.map((item) => item).toList(),
      'status': status,
      'expiresAt': expiresAt,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}

class BirdCoderIamApiKeySummaryListEnvelope {
  final List<BirdCoderIamApiKeySummary> items;
  final BirdCoderApiListMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderIamApiKeySummaryListEnvelope({
    required this.items,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderIamApiKeySummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamApiKeySummaryListEnvelope(
      items: (() {
        final list = _sdkworkAsList(json['items']);
        if (list == null) {
          throw FormatException('BirdCoderIamApiKeySummaryListEnvelope.items is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderIamApiKeySummary.fromJson(map);
      })())
            .whereType<BirdCoderIamApiKeySummary>()
            .toList();
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderIamApiKeySummaryListEnvelope.meta is required');
        }
        return BirdCoderApiListMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamApiKeySummaryListEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamApiKeySummaryListEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'items': items.map((item) => item.toJson()).toList(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderIamAuditEventSummary {
  final String id;
  final String tenantId;
  final String? organizationId;
  final String? actorUserId;
  final String action;
  final String resourceType;
  final String resourceId;
  final String? requestId;
  final String? appId;
  final String? environment;
  final String? shardingKey;
  final Map<String, dynamic> detail;
  final String createdAt;

  BirdCoderIamAuditEventSummary({
    required this.id,
    required this.tenantId,
    this.organizationId,
    this.actorUserId,
    required this.action,
    required this.resourceType,
    required this.resourceId,
    this.requestId,
    this.appId,
    this.environment,
    this.shardingKey,
    required this.detail,
    required this.createdAt
  });

  factory BirdCoderIamAuditEventSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamAuditEventSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamAuditEventSummary.id is required');
        }
        return value;
      })(),
      tenantId: (() {
        final value = json['tenantId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamAuditEventSummary.tenantId is required');
        }
        return value;
      })(),
      organizationId: json['organizationId']?.toString(),
      actorUserId: json['actorUserId']?.toString(),
      action: (() {
        final value = json['action']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamAuditEventSummary.action is required');
        }
        return value;
      })(),
      resourceType: (() {
        final value = json['resourceType']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamAuditEventSummary.resourceType is required');
        }
        return value;
      })(),
      resourceId: (() {
        final value = json['resourceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamAuditEventSummary.resourceId is required');
        }
        return value;
      })(),
      requestId: json['requestId']?.toString(),
      appId: json['appId']?.toString(),
      environment: json['environment']?.toString(),
      shardingKey: json['shardingKey']?.toString(),
      detail: (() {
        final map = _sdkworkAsMap(json['detail']);
        if (map == null) {
          throw FormatException('BirdCoderIamAuditEventSummary.detail is required');
        }
        return map;
      })(),
      createdAt: (() {
        final value = json['createdAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamAuditEventSummary.createdAt is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'tenantId': tenantId,
      'organizationId': organizationId,
      'actorUserId': actorUserId,
      'action': action,
      'resourceType': resourceType,
      'resourceId': resourceId,
      'requestId': requestId,
      'appId': appId,
      'environment': environment,
      'shardingKey': shardingKey,
      'detail': detail,
      'createdAt': createdAt,
    };
  }
}

class BirdCoderIamAuditEventSummaryListEnvelope {
  final List<BirdCoderIamAuditEventSummary> items;
  final BirdCoderApiListMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderIamAuditEventSummaryListEnvelope({
    required this.items,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderIamAuditEventSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamAuditEventSummaryListEnvelope(
      items: (() {
        final list = _sdkworkAsList(json['items']);
        if (list == null) {
          throw FormatException('BirdCoderIamAuditEventSummaryListEnvelope.items is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderIamAuditEventSummary.fromJson(map);
      })())
            .whereType<BirdCoderIamAuditEventSummary>()
            .toList();
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderIamAuditEventSummaryListEnvelope.meta is required');
        }
        return BirdCoderApiListMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamAuditEventSummaryListEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamAuditEventSummaryListEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'items': items.map((item) => item.toJson()).toList(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderIamOrganizationMemberSummary {
  final String id;
  final String tenantId;
  final String organizationId;
  final String userId;
  final String roleCode;
  final String status;
  final String? joinedAt;
  final String? leftAt;
  final String? remark;

  BirdCoderIamOrganizationMemberSummary({
    required this.id,
    required this.tenantId,
    required this.organizationId,
    required this.userId,
    required this.roleCode,
    required this.status,
    this.joinedAt,
    this.leftAt,
    this.remark
  });

  factory BirdCoderIamOrganizationMemberSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamOrganizationMemberSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOrganizationMemberSummary.id is required');
        }
        return value;
      })(),
      tenantId: (() {
        final value = json['tenantId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOrganizationMemberSummary.tenantId is required');
        }
        return value;
      })(),
      organizationId: (() {
        final value = json['organizationId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOrganizationMemberSummary.organizationId is required');
        }
        return value;
      })(),
      userId: (() {
        final value = json['userId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOrganizationMemberSummary.userId is required');
        }
        return value;
      })(),
      roleCode: (() {
        final value = json['roleCode']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOrganizationMemberSummary.roleCode is required');
        }
        return value;
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOrganizationMemberSummary.status is required');
        }
        return value;
      })(),
      joinedAt: json['joinedAt']?.toString(),
      leftAt: json['leftAt']?.toString(),
      remark: json['remark']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'tenantId': tenantId,
      'organizationId': organizationId,
      'userId': userId,
      'roleCode': roleCode,
      'status': status,
      'joinedAt': joinedAt,
      'leftAt': leftAt,
      'remark': remark,
    };
  }
}

class BirdCoderIamOrganizationMemberSummaryEnvelope {
  final BirdCoderIamOrganizationMemberSummary data;
  final BirdCoderApiMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderIamOrganizationMemberSummaryEnvelope({
    required this.data,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderIamOrganizationMemberSummaryEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamOrganizationMemberSummaryEnvelope(
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderIamOrganizationMemberSummaryEnvelope.data is required');
        }
        return BirdCoderIamOrganizationMemberSummary.fromJson(map);
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderIamOrganizationMemberSummaryEnvelope.meta is required');
        }
        return BirdCoderApiMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOrganizationMemberSummaryEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOrganizationMemberSummaryEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'data': data.toJson(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderIamOrganizationSummary {
  final String id;
  final String tenantId;
  final String? parentId;
  final String code;
  final String name;
  final String path;
  final String status;
  final String? createdAt;
  final String? updatedAt;

  BirdCoderIamOrganizationSummary({
    required this.id,
    required this.tenantId,
    this.parentId,
    required this.code,
    required this.name,
    required this.path,
    required this.status,
    this.createdAt,
    this.updatedAt
  });

  factory BirdCoderIamOrganizationSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamOrganizationSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOrganizationSummary.id is required');
        }
        return value;
      })(),
      tenantId: (() {
        final value = json['tenantId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOrganizationSummary.tenantId is required');
        }
        return value;
      })(),
      parentId: json['parentId']?.toString(),
      code: (() {
        final value = json['code']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOrganizationSummary.code is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOrganizationSummary.name is required');
        }
        return value;
      })(),
      path: (() {
        final value = json['path']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOrganizationSummary.path is required');
        }
        return value;
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOrganizationSummary.status is required');
        }
        return value;
      })(),
      createdAt: json['createdAt']?.toString(),
      updatedAt: json['updatedAt']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'tenantId': tenantId,
      'parentId': parentId,
      'code': code,
      'name': name,
      'path': path,
      'status': status,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}

class BirdCoderIamOrganizationSummaryEnvelope {
  final BirdCoderIamOrganizationSummary data;
  final BirdCoderApiMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderIamOrganizationSummaryEnvelope({
    required this.data,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderIamOrganizationSummaryEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamOrganizationSummaryEnvelope(
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderIamOrganizationSummaryEnvelope.data is required');
        }
        return BirdCoderIamOrganizationSummary.fromJson(map);
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderIamOrganizationSummaryEnvelope.meta is required');
        }
        return BirdCoderApiMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOrganizationSummaryEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOrganizationSummaryEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'data': data.toJson(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderIamPermissionSummary {
  final String id;
  final String code;
  final String name;
  final String resource;
  final String action;
  final String? createdAt;

  BirdCoderIamPermissionSummary({
    required this.id,
    required this.code,
    required this.name,
    required this.resource,
    required this.action,
    this.createdAt
  });

  factory BirdCoderIamPermissionSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamPermissionSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamPermissionSummary.id is required');
        }
        return value;
      })(),
      code: (() {
        final value = json['code']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamPermissionSummary.code is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamPermissionSummary.name is required');
        }
        return value;
      })(),
      resource: (() {
        final value = json['resource']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamPermissionSummary.resource is required');
        }
        return value;
      })(),
      action: (() {
        final value = json['action']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamPermissionSummary.action is required');
        }
        return value;
      })(),
      createdAt: json['createdAt']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'code': code,
      'name': name,
      'resource': resource,
      'action': action,
      'createdAt': createdAt,
    };
  }
}

class BirdCoderIamPermissionSummaryEnvelope {
  final BirdCoderIamPermissionSummary data;
  final BirdCoderApiMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderIamPermissionSummaryEnvelope({
    required this.data,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderIamPermissionSummaryEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamPermissionSummaryEnvelope(
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderIamPermissionSummaryEnvelope.data is required');
        }
        return BirdCoderIamPermissionSummary.fromJson(map);
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderIamPermissionSummaryEnvelope.meta is required');
        }
        return BirdCoderApiMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamPermissionSummaryEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamPermissionSummaryEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'data': data.toJson(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderIamPermissionSummaryListEnvelope {
  final List<BirdCoderIamPermissionSummary> items;
  final BirdCoderApiListMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderIamPermissionSummaryListEnvelope({
    required this.items,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderIamPermissionSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamPermissionSummaryListEnvelope(
      items: (() {
        final list = _sdkworkAsList(json['items']);
        if (list == null) {
          throw FormatException('BirdCoderIamPermissionSummaryListEnvelope.items is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderIamPermissionSummary.fromJson(map);
      })())
            .whereType<BirdCoderIamPermissionSummary>()
            .toList();
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderIamPermissionSummaryListEnvelope.meta is required');
        }
        return BirdCoderApiListMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamPermissionSummaryListEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamPermissionSummaryListEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'items': items.map((item) => item.toJson()).toList(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderIamPolicySummary {
  final String id;
  final String tenantId;
  final String code;
  final String name;
  final Map<String, dynamic> policy;
  final String status;
  final String? createdAt;
  final String? updatedAt;

  BirdCoderIamPolicySummary({
    required this.id,
    required this.tenantId,
    required this.code,
    required this.name,
    required this.policy,
    required this.status,
    this.createdAt,
    this.updatedAt
  });

  factory BirdCoderIamPolicySummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamPolicySummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamPolicySummary.id is required');
        }
        return value;
      })(),
      tenantId: (() {
        final value = json['tenantId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamPolicySummary.tenantId is required');
        }
        return value;
      })(),
      code: (() {
        final value = json['code']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamPolicySummary.code is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamPolicySummary.name is required');
        }
        return value;
      })(),
      policy: (() {
        final map = _sdkworkAsMap(json['policy']);
        if (map == null) {
          throw FormatException('BirdCoderIamPolicySummary.policy is required');
        }
        return map;
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamPolicySummary.status is required');
        }
        return value;
      })(),
      createdAt: json['createdAt']?.toString(),
      updatedAt: json['updatedAt']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'tenantId': tenantId,
      'code': code,
      'name': name,
      'policy': policy,
      'status': status,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}

class BirdCoderIamPolicySummaryEnvelope {
  final BirdCoderIamPolicySummary data;
  final BirdCoderApiMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderIamPolicySummaryEnvelope({
    required this.data,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderIamPolicySummaryEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamPolicySummaryEnvelope(
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderIamPolicySummaryEnvelope.data is required');
        }
        return BirdCoderIamPolicySummary.fromJson(map);
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderIamPolicySummaryEnvelope.meta is required');
        }
        return BirdCoderApiMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamPolicySummaryEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamPolicySummaryEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'data': data.toJson(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderIamPolicySummaryListEnvelope {
  final List<BirdCoderIamPolicySummary> items;
  final BirdCoderApiListMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderIamPolicySummaryListEnvelope({
    required this.items,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderIamPolicySummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamPolicySummaryListEnvelope(
      items: (() {
        final list = _sdkworkAsList(json['items']);
        if (list == null) {
          throw FormatException('BirdCoderIamPolicySummaryListEnvelope.items is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderIamPolicySummary.fromJson(map);
      })())
            .whereType<BirdCoderIamPolicySummary>()
            .toList();
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderIamPolicySummaryListEnvelope.meta is required');
        }
        return BirdCoderApiListMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamPolicySummaryListEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamPolicySummaryListEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'items': items.map((item) => item.toJson()).toList(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderIamRolePermissionSummary {
  final String id;
  final String tenantId;
  final String roleId;
  final String permissionId;
  final String? createdAt;

  BirdCoderIamRolePermissionSummary({
    required this.id,
    required this.tenantId,
    required this.roleId,
    required this.permissionId,
    this.createdAt
  });

  factory BirdCoderIamRolePermissionSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamRolePermissionSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamRolePermissionSummary.id is required');
        }
        return value;
      })(),
      tenantId: (() {
        final value = json['tenantId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamRolePermissionSummary.tenantId is required');
        }
        return value;
      })(),
      roleId: (() {
        final value = json['roleId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamRolePermissionSummary.roleId is required');
        }
        return value;
      })(),
      permissionId: (() {
        final value = json['permissionId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamRolePermissionSummary.permissionId is required');
        }
        return value;
      })(),
      createdAt: json['createdAt']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'tenantId': tenantId,
      'roleId': roleId,
      'permissionId': permissionId,
      'createdAt': createdAt,
    };
  }
}

class BirdCoderIamRolePermissionSummaryEnvelope {
  final BirdCoderIamRolePermissionSummary data;
  final BirdCoderApiMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderIamRolePermissionSummaryEnvelope({
    required this.data,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderIamRolePermissionSummaryEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamRolePermissionSummaryEnvelope(
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderIamRolePermissionSummaryEnvelope.data is required');
        }
        return BirdCoderIamRolePermissionSummary.fromJson(map);
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderIamRolePermissionSummaryEnvelope.meta is required');
        }
        return BirdCoderApiMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamRolePermissionSummaryEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamRolePermissionSummaryEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'data': data.toJson(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderIamRolePermissionSummaryListEnvelope {
  final List<BirdCoderIamRolePermissionSummary> items;
  final BirdCoderApiListMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderIamRolePermissionSummaryListEnvelope({
    required this.items,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderIamRolePermissionSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamRolePermissionSummaryListEnvelope(
      items: (() {
        final list = _sdkworkAsList(json['items']);
        if (list == null) {
          throw FormatException('BirdCoderIamRolePermissionSummaryListEnvelope.items is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderIamRolePermissionSummary.fromJson(map);
      })())
            .whereType<BirdCoderIamRolePermissionSummary>()
            .toList();
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderIamRolePermissionSummaryListEnvelope.meta is required');
        }
        return BirdCoderApiListMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamRolePermissionSummaryListEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamRolePermissionSummaryListEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'items': items.map((item) => item.toJson()).toList(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderIamRoleSummary {
  final String id;
  final String tenantId;
  final String code;
  final String name;
  final String status;
  final String? createdAt;
  final String? updatedAt;

  BirdCoderIamRoleSummary({
    required this.id,
    required this.tenantId,
    required this.code,
    required this.name,
    required this.status,
    this.createdAt,
    this.updatedAt
  });

  factory BirdCoderIamRoleSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamRoleSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamRoleSummary.id is required');
        }
        return value;
      })(),
      tenantId: (() {
        final value = json['tenantId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamRoleSummary.tenantId is required');
        }
        return value;
      })(),
      code: (() {
        final value = json['code']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamRoleSummary.code is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamRoleSummary.name is required');
        }
        return value;
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamRoleSummary.status is required');
        }
        return value;
      })(),
      createdAt: json['createdAt']?.toString(),
      updatedAt: json['updatedAt']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'tenantId': tenantId,
      'code': code,
      'name': name,
      'status': status,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}

class BirdCoderIamRoleSummaryEnvelope {
  final BirdCoderIamRoleSummary data;
  final BirdCoderApiMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderIamRoleSummaryEnvelope({
    required this.data,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderIamRoleSummaryEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamRoleSummaryEnvelope(
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderIamRoleSummaryEnvelope.data is required');
        }
        return BirdCoderIamRoleSummary.fromJson(map);
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderIamRoleSummaryEnvelope.meta is required');
        }
        return BirdCoderApiMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamRoleSummaryEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamRoleSummaryEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'data': data.toJson(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderIamRoleSummaryListEnvelope {
  final List<BirdCoderIamRoleSummary> items;
  final BirdCoderApiListMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderIamRoleSummaryListEnvelope({
    required this.items,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderIamRoleSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamRoleSummaryListEnvelope(
      items: (() {
        final list = _sdkworkAsList(json['items']);
        if (list == null) {
          throw FormatException('BirdCoderIamRoleSummaryListEnvelope.items is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderIamRoleSummary.fromJson(map);
      })())
            .whereType<BirdCoderIamRoleSummary>()
            .toList();
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderIamRoleSummaryListEnvelope.meta is required');
        }
        return BirdCoderApiListMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamRoleSummaryListEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamRoleSummaryListEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'items': items.map((item) => item.toJson()).toList(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderIamSecurityEventSummary {
  final String id;
  final String tenantId;
  final String? userId;
  final String? sessionId;
  final String eventType;
  final String severity;
  final Map<String, dynamic> detail;
  final String createdAt;

  BirdCoderIamSecurityEventSummary({
    required this.id,
    required this.tenantId,
    this.userId,
    this.sessionId,
    required this.eventType,
    required this.severity,
    required this.detail,
    required this.createdAt
  });

  factory BirdCoderIamSecurityEventSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamSecurityEventSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamSecurityEventSummary.id is required');
        }
        return value;
      })(),
      tenantId: (() {
        final value = json['tenantId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamSecurityEventSummary.tenantId is required');
        }
        return value;
      })(),
      userId: json['userId']?.toString(),
      sessionId: json['sessionId']?.toString(),
      eventType: (() {
        final value = json['eventType']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamSecurityEventSummary.eventType is required');
        }
        return value;
      })(),
      severity: (() {
        final value = json['severity']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamSecurityEventSummary.severity is required');
        }
        return value;
      })(),
      detail: (() {
        final map = _sdkworkAsMap(json['detail']);
        if (map == null) {
          throw FormatException('BirdCoderIamSecurityEventSummary.detail is required');
        }
        return map;
      })(),
      createdAt: (() {
        final value = json['createdAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamSecurityEventSummary.createdAt is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'tenantId': tenantId,
      'userId': userId,
      'sessionId': sessionId,
      'eventType': eventType,
      'severity': severity,
      'detail': detail,
      'createdAt': createdAt,
    };
  }
}

class BirdCoderIamSecurityEventSummaryListEnvelope {
  final List<BirdCoderIamSecurityEventSummary> items;
  final BirdCoderApiListMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderIamSecurityEventSummaryListEnvelope({
    required this.items,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderIamSecurityEventSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamSecurityEventSummaryListEnvelope(
      items: (() {
        final list = _sdkworkAsList(json['items']);
        if (list == null) {
          throw FormatException('BirdCoderIamSecurityEventSummaryListEnvelope.items is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderIamSecurityEventSummary.fromJson(map);
      })())
            .whereType<BirdCoderIamSecurityEventSummary>()
            .toList();
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderIamSecurityEventSummaryListEnvelope.meta is required');
        }
        return BirdCoderApiListMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamSecurityEventSummaryListEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamSecurityEventSummaryListEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'items': items.map((item) => item.toJson()).toList(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderIamTenantMemberSummary {
  final String id;
  final String tenantId;
  final String userId;
  final String roleCode;
  final String status;
  final String? joinedAt;
  final String? leftAt;
  final String? remark;

  BirdCoderIamTenantMemberSummary({
    required this.id,
    required this.tenantId,
    required this.userId,
    required this.roleCode,
    required this.status,
    this.joinedAt,
    this.leftAt,
    this.remark
  });

  factory BirdCoderIamTenantMemberSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamTenantMemberSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamTenantMemberSummary.id is required');
        }
        return value;
      })(),
      tenantId: (() {
        final value = json['tenantId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamTenantMemberSummary.tenantId is required');
        }
        return value;
      })(),
      userId: (() {
        final value = json['userId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamTenantMemberSummary.userId is required');
        }
        return value;
      })(),
      roleCode: (() {
        final value = json['roleCode']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamTenantMemberSummary.roleCode is required');
        }
        return value;
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamTenantMemberSummary.status is required');
        }
        return value;
      })(),
      joinedAt: json['joinedAt']?.toString(),
      leftAt: json['leftAt']?.toString(),
      remark: json['remark']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'tenantId': tenantId,
      'userId': userId,
      'roleCode': roleCode,
      'status': status,
      'joinedAt': joinedAt,
      'leftAt': leftAt,
      'remark': remark,
    };
  }
}

class BirdCoderIamTenantMemberSummaryEnvelope {
  final BirdCoderIamTenantMemberSummary data;
  final BirdCoderApiMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderIamTenantMemberSummaryEnvelope({
    required this.data,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderIamTenantMemberSummaryEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamTenantMemberSummaryEnvelope(
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderIamTenantMemberSummaryEnvelope.data is required');
        }
        return BirdCoderIamTenantMemberSummary.fromJson(map);
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderIamTenantMemberSummaryEnvelope.meta is required');
        }
        return BirdCoderApiMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamTenantMemberSummaryEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamTenantMemberSummaryEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'data': data.toJson(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderIamTenantMemberSummaryListEnvelope {
  final List<BirdCoderIamTenantMemberSummary> items;
  final BirdCoderApiListMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderIamTenantMemberSummaryListEnvelope({
    required this.items,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderIamTenantMemberSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamTenantMemberSummaryListEnvelope(
      items: (() {
        final list = _sdkworkAsList(json['items']);
        if (list == null) {
          throw FormatException('BirdCoderIamTenantMemberSummaryListEnvelope.items is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderIamTenantMemberSummary.fromJson(map);
      })())
            .whereType<BirdCoderIamTenantMemberSummary>()
            .toList();
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderIamTenantMemberSummaryListEnvelope.meta is required');
        }
        return BirdCoderApiListMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamTenantMemberSummaryListEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamTenantMemberSummaryListEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'items': items.map((item) => item.toJson()).toList(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderIamTenantSummary {
  final String id;
  final String code;
  final String name;
  final String status;
  final String? createdAt;
  final String? updatedAt;

  BirdCoderIamTenantSummary({
    required this.id,
    required this.code,
    required this.name,
    required this.status,
    this.createdAt,
    this.updatedAt
  });

  factory BirdCoderIamTenantSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamTenantSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamTenantSummary.id is required');
        }
        return value;
      })(),
      code: (() {
        final value = json['code']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamTenantSummary.code is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamTenantSummary.name is required');
        }
        return value;
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamTenantSummary.status is required');
        }
        return value;
      })(),
      createdAt: json['createdAt']?.toString(),
      updatedAt: json['updatedAt']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'code': code,
      'name': name,
      'status': status,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}

class BirdCoderIamTenantSummaryEnvelope {
  final BirdCoderIamTenantSummary data;
  final BirdCoderApiMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderIamTenantSummaryEnvelope({
    required this.data,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderIamTenantSummaryEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamTenantSummaryEnvelope(
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderIamTenantSummaryEnvelope.data is required');
        }
        return BirdCoderIamTenantSummary.fromJson(map);
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderIamTenantSummaryEnvelope.meta is required');
        }
        return BirdCoderApiMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamTenantSummaryEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamTenantSummaryEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'data': data.toJson(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderIamTenantSummaryListEnvelope {
  final List<BirdCoderIamTenantSummary> items;
  final BirdCoderApiListMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderIamTenantSummaryListEnvelope({
    required this.items,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderIamTenantSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamTenantSummaryListEnvelope(
      items: (() {
        final list = _sdkworkAsList(json['items']);
        if (list == null) {
          throw FormatException('BirdCoderIamTenantSummaryListEnvelope.items is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderIamTenantSummary.fromJson(map);
      })())
            .whereType<BirdCoderIamTenantSummary>()
            .toList();
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderIamTenantSummaryListEnvelope.meta is required');
        }
        return BirdCoderApiListMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamTenantSummaryListEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamTenantSummaryListEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'items': items.map((item) => item.toJson()).toList(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderIamUserRoleSummary {
  final String id;
  final String tenantId;
  final String userId;
  final String roleId;
  final String roleCode;
  final String status;
  final String? createdAt;

  BirdCoderIamUserRoleSummary({
    required this.id,
    required this.tenantId,
    required this.userId,
    required this.roleId,
    required this.roleCode,
    required this.status,
    this.createdAt
  });

  factory BirdCoderIamUserRoleSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamUserRoleSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserRoleSummary.id is required');
        }
        return value;
      })(),
      tenantId: (() {
        final value = json['tenantId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserRoleSummary.tenantId is required');
        }
        return value;
      })(),
      userId: (() {
        final value = json['userId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserRoleSummary.userId is required');
        }
        return value;
      })(),
      roleId: (() {
        final value = json['roleId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserRoleSummary.roleId is required');
        }
        return value;
      })(),
      roleCode: (() {
        final value = json['roleCode']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserRoleSummary.roleCode is required');
        }
        return value;
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserRoleSummary.status is required');
        }
        return value;
      })(),
      createdAt: json['createdAt']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'tenantId': tenantId,
      'userId': userId,
      'roleId': roleId,
      'roleCode': roleCode,
      'status': status,
      'createdAt': createdAt,
    };
  }
}

class BirdCoderIamUserRoleSummaryEnvelope {
  final BirdCoderIamUserRoleSummary data;
  final BirdCoderApiMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderIamUserRoleSummaryEnvelope({
    required this.data,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderIamUserRoleSummaryEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamUserRoleSummaryEnvelope(
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderIamUserRoleSummaryEnvelope.data is required');
        }
        return BirdCoderIamUserRoleSummary.fromJson(map);
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderIamUserRoleSummaryEnvelope.meta is required');
        }
        return BirdCoderApiMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserRoleSummaryEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserRoleSummaryEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'data': data.toJson(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderIamUserSummary {
  final String id;
  final String uuid;
  final String tenantId;
  final String? organizationId;
  final String? username;
  final String email;
  final String? phone;
  final String displayName;
  final String? avatarUrl;
  final String status;
  final String? createdAt;
  final String? updatedAt;

  BirdCoderIamUserSummary({
    required this.id,
    required this.uuid,
    required this.tenantId,
    this.organizationId,
    this.username,
    required this.email,
    this.phone,
    required this.displayName,
    this.avatarUrl,
    required this.status,
    this.createdAt,
    this.updatedAt
  });

  factory BirdCoderIamUserSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamUserSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserSummary.id is required');
        }
        return value;
      })(),
      uuid: (() {
        final value = json['uuid']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserSummary.uuid is required');
        }
        return value;
      })(),
      tenantId: (() {
        final value = json['tenantId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserSummary.tenantId is required');
        }
        return value;
      })(),
      organizationId: json['organizationId']?.toString(),
      username: json['username']?.toString(),
      email: (() {
        final value = json['email']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserSummary.email is required');
        }
        return value;
      })(),
      phone: json['phone']?.toString(),
      displayName: (() {
        final value = json['displayName']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserSummary.displayName is required');
        }
        return value;
      })(),
      avatarUrl: json['avatarUrl']?.toString(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserSummary.status is required');
        }
        return value;
      })(),
      createdAt: json['createdAt']?.toString(),
      updatedAt: json['updatedAt']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'uuid': uuid,
      'tenantId': tenantId,
      'organizationId': organizationId,
      'username': username,
      'email': email,
      'phone': phone,
      'displayName': displayName,
      'avatarUrl': avatarUrl,
      'status': status,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}

class BirdCoderIamUserSummaryEnvelope {
  final BirdCoderIamUserSummary data;
  final BirdCoderApiMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderIamUserSummaryEnvelope({
    required this.data,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderIamUserSummaryEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamUserSummaryEnvelope(
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderIamUserSummaryEnvelope.data is required');
        }
        return BirdCoderIamUserSummary.fromJson(map);
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderIamUserSummaryEnvelope.meta is required');
        }
        return BirdCoderApiMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserSummaryEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserSummaryEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'data': data.toJson(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderIamUserSummaryListEnvelope {
  final List<BirdCoderIamUserSummary> items;
  final BirdCoderApiListMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderIamUserSummaryListEnvelope({
    required this.items,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderIamUserSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamUserSummaryListEnvelope(
      items: (() {
        final list = _sdkworkAsList(json['items']);
        if (list == null) {
          throw FormatException('BirdCoderIamUserSummaryListEnvelope.items is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderIamUserSummary.fromJson(map);
      })())
            .whereType<BirdCoderIamUserSummary>()
            .toList();
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderIamUserSummaryListEnvelope.meta is required');
        }
        return BirdCoderApiListMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserSummaryListEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserSummaryListEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'items': items.map((item) => item.toJson()).toList(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderProblemEnvelope {
  final BirdCoderApiProblemDetails data;
  final BirdCoderApiMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderProblemEnvelope({
    required this.data,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderProblemEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderProblemEnvelope(
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderProblemEnvelope.data is required');
        }
        return BirdCoderApiProblemDetails.fromJson(map);
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderProblemEnvelope.meta is required');
        }
        return BirdCoderApiMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProblemEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProblemEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'data': data.toJson(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderReleaseSummary {
  final String id;
  final String? uuid;
  final String? tenantId;
  final String? organizationId;
  final String? createdAt;
  final String? updatedAt;
  final String releaseVersion;
  final String releaseKind;
  final String rolloutStage;
  final Map<String, dynamic>? manifest;
  final String status;

  BirdCoderReleaseSummary({
    required this.id,
    this.uuid,
    this.tenantId,
    this.organizationId,
    this.createdAt,
    this.updatedAt,
    required this.releaseVersion,
    required this.releaseKind,
    required this.rolloutStage,
    this.manifest,
    required this.status
  });

  factory BirdCoderReleaseSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderReleaseSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderReleaseSummary.id is required');
        }
        return value;
      })(),
      uuid: json['uuid']?.toString(),
      tenantId: json['tenantId']?.toString(),
      organizationId: json['organizationId']?.toString(),
      createdAt: json['createdAt']?.toString(),
      updatedAt: json['updatedAt']?.toString(),
      releaseVersion: (() {
        final value = json['releaseVersion']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderReleaseSummary.releaseVersion is required');
        }
        return value;
      })(),
      releaseKind: (() {
        final value = json['releaseKind']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderReleaseSummary.releaseKind is required');
        }
        return value;
      })(),
      rolloutStage: (() {
        final value = json['rolloutStage']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderReleaseSummary.rolloutStage is required');
        }
        return value;
      })(),
      manifest: _sdkworkAsMap(json['manifest']),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderReleaseSummary.status is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'uuid': uuid,
      'tenantId': tenantId,
      'organizationId': organizationId,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
      'releaseVersion': releaseVersion,
      'releaseKind': releaseKind,
      'rolloutStage': rolloutStage,
      'manifest': manifest,
      'status': status,
    };
  }
}

class BirdCoderReleaseSummaryListEnvelope {
  final List<BirdCoderReleaseSummary> items;
  final BirdCoderApiListMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderReleaseSummaryListEnvelope({
    required this.items,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderReleaseSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderReleaseSummaryListEnvelope(
      items: (() {
        final list = _sdkworkAsList(json['items']);
        if (list == null) {
          throw FormatException('BirdCoderReleaseSummaryListEnvelope.items is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderReleaseSummary.fromJson(map);
      })())
            .whereType<BirdCoderReleaseSummary>()
            .toList();
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderReleaseSummaryListEnvelope.meta is required');
        }
        return BirdCoderApiListMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderReleaseSummaryListEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderReleaseSummaryListEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'items': items.map((item) => item.toJson()).toList(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderTeamMemberSummary {
  final String id;
  final String? uuid;
  final String? tenantId;
  final String? organizationId;
  final String teamId;
  final String userId;
  final String role;
  final String status;
  final String? createdByUserId;
  final String? grantedByUserId;
  final String? createdAt;
  final String? updatedAt;

  BirdCoderTeamMemberSummary({
    required this.id,
    this.uuid,
    this.tenantId,
    this.organizationId,
    required this.teamId,
    required this.userId,
    required this.role,
    required this.status,
    this.createdByUserId,
    this.grantedByUserId,
    this.createdAt,
    this.updatedAt
  });

  factory BirdCoderTeamMemberSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderTeamMemberSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderTeamMemberSummary.id is required');
        }
        return value;
      })(),
      uuid: json['uuid']?.toString(),
      tenantId: json['tenantId']?.toString(),
      organizationId: json['organizationId']?.toString(),
      teamId: (() {
        final value = json['teamId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderTeamMemberSummary.teamId is required');
        }
        return value;
      })(),
      userId: (() {
        final value = json['userId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderTeamMemberSummary.userId is required');
        }
        return value;
      })(),
      role: (() {
        final value = json['role']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderTeamMemberSummary.role is required');
        }
        return value;
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderTeamMemberSummary.status is required');
        }
        return value;
      })(),
      createdByUserId: json['createdByUserId']?.toString(),
      grantedByUserId: json['grantedByUserId']?.toString(),
      createdAt: json['createdAt']?.toString(),
      updatedAt: json['updatedAt']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'uuid': uuid,
      'tenantId': tenantId,
      'organizationId': organizationId,
      'teamId': teamId,
      'userId': userId,
      'role': role,
      'status': status,
      'createdByUserId': createdByUserId,
      'grantedByUserId': grantedByUserId,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}

class BirdCoderTeamMemberSummaryListEnvelope {
  final List<BirdCoderTeamMemberSummary> items;
  final BirdCoderApiListMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderTeamMemberSummaryListEnvelope({
    required this.items,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderTeamMemberSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderTeamMemberSummaryListEnvelope(
      items: (() {
        final list = _sdkworkAsList(json['items']);
        if (list == null) {
          throw FormatException('BirdCoderTeamMemberSummaryListEnvelope.items is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderTeamMemberSummary.fromJson(map);
      })())
            .whereType<BirdCoderTeamMemberSummary>()
            .toList();
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderTeamMemberSummaryListEnvelope.meta is required');
        }
        return BirdCoderApiListMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderTeamMemberSummaryListEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderTeamMemberSummaryListEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'items': items.map((item) => item.toJson()).toList(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderTeamSummary {
  final String id;
  final String? uuid;
  final String? tenantId;
  final String? organizationId;
  final String? createdAt;
  final String? updatedAt;
  final String workspaceId;
  final String? code;
  final String? title;
  final String name;
  final String? description;
  final String? ownerId;
  final String? leaderId;
  final String? createdByUserId;
  final Map<String, dynamic>? metadata;
  final String status;

  BirdCoderTeamSummary({
    required this.id,
    this.uuid,
    this.tenantId,
    this.organizationId,
    this.createdAt,
    this.updatedAt,
    required this.workspaceId,
    this.code,
    this.title,
    required this.name,
    this.description,
    this.ownerId,
    this.leaderId,
    this.createdByUserId,
    this.metadata,
    required this.status
  });

  factory BirdCoderTeamSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderTeamSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderTeamSummary.id is required');
        }
        return value;
      })(),
      uuid: json['uuid']?.toString(),
      tenantId: json['tenantId']?.toString(),
      organizationId: json['organizationId']?.toString(),
      createdAt: json['createdAt']?.toString(),
      updatedAt: json['updatedAt']?.toString(),
      workspaceId: (() {
        final value = json['workspaceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderTeamSummary.workspaceId is required');
        }
        return value;
      })(),
      code: json['code']?.toString(),
      title: json['title']?.toString(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderTeamSummary.name is required');
        }
        return value;
      })(),
      description: json['description']?.toString(),
      ownerId: json['ownerId']?.toString(),
      leaderId: json['leaderId']?.toString(),
      createdByUserId: json['createdByUserId']?.toString(),
      metadata: _sdkworkAsMap(json['metadata']),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderTeamSummary.status is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'uuid': uuid,
      'tenantId': tenantId,
      'organizationId': organizationId,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
      'workspaceId': workspaceId,
      'code': code,
      'title': title,
      'name': name,
      'description': description,
      'ownerId': ownerId,
      'leaderId': leaderId,
      'createdByUserId': createdByUserId,
      'metadata': metadata,
      'status': status,
    };
  }
}

class BirdCoderTeamSummaryListEnvelope {
  final List<BirdCoderTeamSummary> items;
  final BirdCoderApiListMeta meta;
  final String requestId;
  final String timestamp;

  BirdCoderTeamSummaryListEnvelope({
    required this.items,
    required this.meta,
    required this.requestId,
    required this.timestamp
  });

  factory BirdCoderTeamSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderTeamSummaryListEnvelope(
      items: (() {
        final list = _sdkworkAsList(json['items']);
        if (list == null) {
          throw FormatException('BirdCoderTeamSummaryListEnvelope.items is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderTeamSummary.fromJson(map);
      })())
            .whereType<BirdCoderTeamSummary>()
            .toList();
      })(),
      meta: (() {
        final map = _sdkworkAsMap(json['meta']);
        if (map == null) {
          throw FormatException('BirdCoderTeamSummaryListEnvelope.meta is required');
        }
        return BirdCoderApiListMeta.fromJson(map);
      })(),
      requestId: (() {
        final value = json['requestId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderTeamSummaryListEnvelope.requestId is required');
        }
        return value;
      })(),
      timestamp: (() {
        final value = json['timestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderTeamSummaryListEnvelope.timestamp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'items': items.map((item) => item.toJson()).toList(),
      'meta': meta.toJson(),
      'requestId': requestId,
      'timestamp': timestamp,
    };
  }
}

class BirdCoderUpdateIamOrganizationMemberRequest {
  final String? roleCode;
  final String? status;
  final String? remark;

  BirdCoderUpdateIamOrganizationMemberRequest({
    this.roleCode,
    this.status,
    this.remark
  });

  factory BirdCoderUpdateIamOrganizationMemberRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderUpdateIamOrganizationMemberRequest(
      roleCode: json['roleCode']?.toString(),
      status: json['status']?.toString(),
      remark: json['remark']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'roleCode': roleCode,
      'status': status,
      'remark': remark,
    };
  }
}

class BirdCoderUpdateIamOrganizationRequest {
  final String? code;
  final String? name;
  final String? parentId;
  final String? status;

  BirdCoderUpdateIamOrganizationRequest({
    this.code,
    this.name,
    this.parentId,
    this.status
  });

  factory BirdCoderUpdateIamOrganizationRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderUpdateIamOrganizationRequest(
      code: json['code']?.toString(),
      name: json['name']?.toString(),
      parentId: json['parentId']?.toString(),
      status: json['status']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'name': name,
      'parentId': parentId,
      'status': status,
    };
  }
}

class BirdCoderUpdateIamPermissionRequest {
  final String? name;
  final String? resource;
  final String? action;

  BirdCoderUpdateIamPermissionRequest({
    this.name,
    this.resource,
    this.action
  });

  factory BirdCoderUpdateIamPermissionRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderUpdateIamPermissionRequest(
      name: json['name']?.toString(),
      resource: json['resource']?.toString(),
      action: json['action']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'name': name,
      'resource': resource,
      'action': action,
    };
  }
}

class BirdCoderUpdateIamPolicyRequest {
  final String? name;
  final Map<String, dynamic>? policy;
  final String? status;

  BirdCoderUpdateIamPolicyRequest({
    this.name,
    this.policy,
    this.status
  });

  factory BirdCoderUpdateIamPolicyRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderUpdateIamPolicyRequest(
      name: json['name']?.toString(),
      policy: _sdkworkAsMap(json['policy']),
      status: json['status']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'name': name,
      'policy': policy,
      'status': status,
    };
  }
}

class BirdCoderUpdateIamRoleRequest {
  final String? name;
  final String? status;

  BirdCoderUpdateIamRoleRequest({
    this.name,
    this.status
  });

  factory BirdCoderUpdateIamRoleRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderUpdateIamRoleRequest(
      name: json['name']?.toString(),
      status: json['status']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'name': name,
      'status': status,
    };
  }
}

class BirdCoderUpdateIamTenantMemberRequest {
  final String? roleCode;
  final String? status;
  final String? remark;

  BirdCoderUpdateIamTenantMemberRequest({
    this.roleCode,
    this.status,
    this.remark
  });

  factory BirdCoderUpdateIamTenantMemberRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderUpdateIamTenantMemberRequest(
      roleCode: json['roleCode']?.toString(),
      status: json['status']?.toString(),
      remark: json['remark']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'roleCode': roleCode,
      'status': status,
      'remark': remark,
    };
  }
}

class BirdCoderUpdateIamTenantRequest {
  final String? code;
  final String? name;
  final String? status;

  BirdCoderUpdateIamTenantRequest({
    this.code,
    this.name,
    this.status
  });

  factory BirdCoderUpdateIamTenantRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderUpdateIamTenantRequest(
      code: json['code']?.toString(),
      name: json['name']?.toString(),
      status: json['status']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'name': name,
      'status': status,
    };
  }
}

class BirdCoderUpdateIamUserRequest {
  final String? username;
  final String? email;
  final String? phone;
  final String? displayName;
  final String? avatarUrl;
  final String? status;

  BirdCoderUpdateIamUserRequest({
    this.username,
    this.email,
    this.phone,
    this.displayName,
    this.avatarUrl,
    this.status
  });

  factory BirdCoderUpdateIamUserRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderUpdateIamUserRequest(
      username: json['username']?.toString(),
      email: json['email']?.toString(),
      phone: json['phone']?.toString(),
      displayName: json['displayName']?.toString(),
      avatarUrl: json['avatarUrl']?.toString(),
      status: json['status']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'username': username,
      'email': email,
      'phone': phone,
      'displayName': displayName,
      'avatarUrl': avatarUrl,
      'status': status,
    };
  }
}
