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

class BirdCoderApiGatewaySummary {
  final String docsPath;
  final String liveOpenApiPath;
  final String openApiPath;
  final String routeCatalogPath;
  final int routeCount;
  final Map<String, dynamic> routesBySurface;
  final List<BirdCoderApiGatewaySurfaceSummary> surfaces;

  BirdCoderApiGatewaySummary({
    required this.docsPath,
    required this.liveOpenApiPath,
    required this.openApiPath,
    required this.routeCatalogPath,
    required this.routeCount,
    required this.routesBySurface,
    required this.surfaces
  });

  factory BirdCoderApiGatewaySummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderApiGatewaySummary(
      docsPath: (() {
        final value = json['docsPath']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApiGatewaySummary.docsPath is required');
        }
        return value;
      })(),
      liveOpenApiPath: (() {
        final value = json['liveOpenApiPath']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApiGatewaySummary.liveOpenApiPath is required');
        }
        return value;
      })(),
      openApiPath: (() {
        final value = json['openApiPath']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApiGatewaySummary.openApiPath is required');
        }
        return value;
      })(),
      routeCatalogPath: (() {
        final value = json['routeCatalogPath']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApiGatewaySummary.routeCatalogPath is required');
        }
        return value;
      })(),
      routeCount: (() {
        final value = json['routeCount'];
        if (value is! int) {
          throw FormatException('BirdCoderApiGatewaySummary.routeCount is required');
        }
        return value;
      })(),
      routesBySurface: (() {
        final map = _sdkworkAsMap(json['routesBySurface']);
        if (map == null) {
          throw FormatException('BirdCoderApiGatewaySummary.routesBySurface is required');
        }
        return map;
      })(),
      surfaces: (() {
        final list = _sdkworkAsList(json['surfaces']);
        if (list == null) {
          throw FormatException('BirdCoderApiGatewaySummary.surfaces is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderApiGatewaySurfaceSummary.fromJson(map);
      })())
            .whereType<BirdCoderApiGatewaySurfaceSummary>()
            .toList();
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'docsPath': docsPath,
      'liveOpenApiPath': liveOpenApiPath,
      'openApiPath': openApiPath,
      'routeCatalogPath': routeCatalogPath,
      'routeCount': routeCount,
      'routesBySurface': routesBySurface,
      'surfaces': surfaces.map((item) => item.toJson()).toList(),
    };
  }
}

class BirdCoderApiGatewaySurfaceSummary {
  final String authMode;
  final String basePath;
  final String description;
  final String name;
  final int routeCount;

  BirdCoderApiGatewaySurfaceSummary({
    required this.authMode,
    required this.basePath,
    required this.description,
    required this.name,
    required this.routeCount
  });

  factory BirdCoderApiGatewaySurfaceSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderApiGatewaySurfaceSummary(
      authMode: (() {
        final value = json['authMode']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApiGatewaySurfaceSummary.authMode is required');
        }
        return value;
      })(),
      basePath: (() {
        final value = json['basePath']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApiGatewaySurfaceSummary.basePath is required');
        }
        return value;
      })(),
      description: (() {
        final value = json['description']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApiGatewaySurfaceSummary.description is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApiGatewaySurfaceSummary.name is required');
        }
        return value;
      })(),
      routeCount: (() {
        final value = json['routeCount'];
        if (value is! int) {
          throw FormatException('BirdCoderApiGatewaySurfaceSummary.routeCount is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'authMode': authMode,
      'basePath': basePath,
      'description': description,
      'name': name,
      'routeCount': routeCount,
    };
  }
}

class BirdCoderApiRouteCatalogEntry {
  final String authMode;
  final String method;
  final String path;
  final String surface;
  final String summary;
  final String openApiPath;
  final String operationId;

  BirdCoderApiRouteCatalogEntry({
    required this.authMode,
    required this.method,
    required this.path,
    required this.surface,
    required this.summary,
    required this.openApiPath,
    required this.operationId
  });

  factory BirdCoderApiRouteCatalogEntry.fromJson(Map<String, dynamic> json) {
    return BirdCoderApiRouteCatalogEntry(
      authMode: (() {
        final value = json['authMode']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApiRouteCatalogEntry.authMode is required');
        }
        return value;
      })(),
      method: (() {
        final value = json['method']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApiRouteCatalogEntry.method is required');
        }
        return value;
      })(),
      path: (() {
        final value = json['path']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApiRouteCatalogEntry.path is required');
        }
        return value;
      })(),
      surface: (() {
        final value = json['surface']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApiRouteCatalogEntry.surface is required');
        }
        return value;
      })(),
      summary: (() {
        final value = json['summary']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApiRouteCatalogEntry.summary is required');
        }
        return value;
      })(),
      openApiPath: (() {
        final value = json['openApiPath']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApiRouteCatalogEntry.openApiPath is required');
        }
        return value;
      })(),
      operationId: (() {
        final value = json['operationId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApiRouteCatalogEntry.operationId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'authMode': authMode,
      'method': method,
      'path': path,
      'surface': surface,
      'summary': summary,
      'openApiPath': openApiPath,
      'operationId': operationId,
    };
  }
}

class BirdCoderApiRouteCatalogEntryListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderApiRouteCatalogEntryListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderApiRouteCatalogEntryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderApiRouteCatalogEntryListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderApiRouteCatalogEntryListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderApiRouteCatalogEntryListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApiRouteCatalogEntryListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderAppTemplateSummary {
  final String id;
  final String? uuid;
  final String? tenantId;
  final String? organizationId;
  final String? createdAt;
  final String updatedAt;
  final String slug;
  final String name;
  final String description;
  final String? icon;
  final String? author;
  final String versionId;
  final String versionLabel;
  final String presetKey;
  final String category;
  final List<String> tags;
  final List<String> targetProfiles;
  final int? downloads;
  final int? stars;
  final String status;

  BirdCoderAppTemplateSummary({
    required this.id,
    this.uuid,
    this.tenantId,
    this.organizationId,
    this.createdAt,
    required this.updatedAt,
    required this.slug,
    required this.name,
    required this.description,
    this.icon,
    this.author,
    required this.versionId,
    required this.versionLabel,
    required this.presetKey,
    required this.category,
    required this.tags,
    required this.targetProfiles,
    this.downloads,
    this.stars,
    required this.status
  });

  factory BirdCoderAppTemplateSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderAppTemplateSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderAppTemplateSummary.id is required');
        }
        return value;
      })(),
      uuid: json['uuid']?.toString(),
      tenantId: json['tenantId']?.toString(),
      organizationId: json['organizationId']?.toString(),
      createdAt: json['createdAt']?.toString(),
      updatedAt: (() {
        final value = json['updatedAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderAppTemplateSummary.updatedAt is required');
        }
        return value;
      })(),
      slug: (() {
        final value = json['slug']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderAppTemplateSummary.slug is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderAppTemplateSummary.name is required');
        }
        return value;
      })(),
      description: (() {
        final value = json['description']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderAppTemplateSummary.description is required');
        }
        return value;
      })(),
      icon: json['icon']?.toString(),
      author: json['author']?.toString(),
      versionId: (() {
        final value = json['versionId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderAppTemplateSummary.versionId is required');
        }
        return value;
      })(),
      versionLabel: (() {
        final value = json['versionLabel']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderAppTemplateSummary.versionLabel is required');
        }
        return value;
      })(),
      presetKey: (() {
        final value = json['presetKey']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderAppTemplateSummary.presetKey is required');
        }
        return value;
      })(),
      category: (() {
        final value = json['category']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderAppTemplateSummary.category is required');
        }
        return value;
      })(),
      tags: (() {
        final list = _sdkworkAsList(json['tags']);
        if (list == null) {
          throw FormatException('BirdCoderAppTemplateSummary.tags is required');
        }
        return list
            .map((item) => item?.toString())
            .whereType<String>()
            .toList();
      })(),
      targetProfiles: (() {
        final list = _sdkworkAsList(json['targetProfiles']);
        if (list == null) {
          throw FormatException('BirdCoderAppTemplateSummary.targetProfiles is required');
        }
        return list
            .map((item) => item?.toString())
            .whereType<String>()
            .toList();
      })(),
      downloads: json['downloads'] is int ? json['downloads'] : null,
      stars: json['stars'] is int ? json['stars'] : null,
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderAppTemplateSummary.status is required');
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
      'slug': slug,
      'name': name,
      'description': description,
      'icon': icon,
      'author': author,
      'versionId': versionId,
      'versionLabel': versionLabel,
      'presetKey': presetKey,
      'category': category,
      'tags': tags.map((item) => item).toList(),
      'targetProfiles': targetProfiles.map((item) => item).toList(),
      'downloads': downloads,
      'stars': stars,
      'status': status,
    };
  }
}

class BirdCoderAppTemplateSummaryListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderAppTemplateSummaryListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderAppTemplateSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderAppTemplateSummaryListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderAppTemplateSummaryListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderAppTemplateSummaryListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderAppTemplateSummaryListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderApprovalDecisionResult {
  final String approvalId;
  final String checkpointId;
  final String codingSessionId;
  final String decision;
  final String decidedAt;
  final String? operationId;
  final String operationStatus;
  final String? reason;
  final String? runtimeId;
  final String runtimeStatus;
  final String? turnId;

  BirdCoderApprovalDecisionResult({
    required this.approvalId,
    required this.checkpointId,
    required this.codingSessionId,
    required this.decision,
    required this.decidedAt,
    this.operationId,
    required this.operationStatus,
    this.reason,
    this.runtimeId,
    required this.runtimeStatus,
    this.turnId
  });

  factory BirdCoderApprovalDecisionResult.fromJson(Map<String, dynamic> json) {
    return BirdCoderApprovalDecisionResult(
      approvalId: (() {
        final value = json['approvalId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApprovalDecisionResult.approvalId is required');
        }
        return value;
      })(),
      checkpointId: (() {
        final value = json['checkpointId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApprovalDecisionResult.checkpointId is required');
        }
        return value;
      })(),
      codingSessionId: (() {
        final value = json['codingSessionId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApprovalDecisionResult.codingSessionId is required');
        }
        return value;
      })(),
      decision: (() {
        final value = json['decision']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApprovalDecisionResult.decision is required');
        }
        return value;
      })(),
      decidedAt: (() {
        final value = json['decidedAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApprovalDecisionResult.decidedAt is required');
        }
        return value;
      })(),
      operationId: json['operationId']?.toString(),
      operationStatus: (() {
        final value = json['operationStatus']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApprovalDecisionResult.operationStatus is required');
        }
        return value;
      })(),
      reason: json['reason']?.toString(),
      runtimeId: json['runtimeId']?.toString(),
      runtimeStatus: (() {
        final value = json['runtimeStatus']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApprovalDecisionResult.runtimeStatus is required');
        }
        return value;
      })(),
      turnId: json['turnId']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'approvalId': approvalId,
      'checkpointId': checkpointId,
      'codingSessionId': codingSessionId,
      'decision': decision,
      'decidedAt': decidedAt,
      'operationId': operationId,
      'operationStatus': operationStatus,
      'reason': reason,
      'runtimeId': runtimeId,
      'runtimeStatus': runtimeStatus,
      'turnId': turnId,
    };
  }
}

class BirdCoderApprovalDecisionResultEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderApprovalDecisionResultEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderApprovalDecisionResultEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderApprovalDecisionResultEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderApprovalDecisionResultEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderApprovalDecisionResultEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApprovalDecisionResultEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderAuthenticatedUserSummary {
  final String id;
  final String uuid;
  final String? tenantId;
  final String? organizationId;
  final String createdAt;
  final String updatedAt;
  final String name;
  final String email;
  final String? avatarUrl;

  BirdCoderAuthenticatedUserSummary({
    required this.id,
    required this.uuid,
    this.tenantId,
    this.organizationId,
    required this.createdAt,
    required this.updatedAt,
    required this.name,
    required this.email,
    this.avatarUrl
  });

  factory BirdCoderAuthenticatedUserSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderAuthenticatedUserSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderAuthenticatedUserSummary.id is required');
        }
        return value;
      })(),
      uuid: (() {
        final value = json['uuid']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderAuthenticatedUserSummary.uuid is required');
        }
        return value;
      })(),
      tenantId: json['tenantId']?.toString(),
      organizationId: json['organizationId']?.toString(),
      createdAt: (() {
        final value = json['createdAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderAuthenticatedUserSummary.createdAt is required');
        }
        return value;
      })(),
      updatedAt: (() {
        final value = json['updatedAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderAuthenticatedUserSummary.updatedAt is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderAuthenticatedUserSummary.name is required');
        }
        return value;
      })(),
      email: (() {
        final value = json['email']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderAuthenticatedUserSummary.email is required');
        }
        return value;
      })(),
      avatarUrl: json['avatarUrl']?.toString()
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
      'name': name,
      'email': email,
      'avatarUrl': avatarUrl,
    };
  }
}

class BirdCoderBooleanSuccessEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderBooleanSuccessEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderBooleanSuccessEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderBooleanSuccessEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderBooleanSuccessEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderBooleanSuccessEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderBooleanSuccessEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
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

class BirdCoderChatConversationSummary {
  final String id;
  final String title;
  final String ownerUserId;
  final String createdAt;
  final String updatedAt;

  BirdCoderChatConversationSummary({
    required this.id,
    required this.title,
    required this.ownerUserId,
    required this.createdAt,
    required this.updatedAt
  });

  factory BirdCoderChatConversationSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderChatConversationSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderChatConversationSummary.id is required');
        }
        return value;
      })(),
      title: (() {
        final value = json['title']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderChatConversationSummary.title is required');
        }
        return value;
      })(),
      ownerUserId: (() {
        final value = json['ownerUserId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderChatConversationSummary.ownerUserId is required');
        }
        return value;
      })(),
      createdAt: (() {
        final value = json['createdAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderChatConversationSummary.createdAt is required');
        }
        return value;
      })(),
      updatedAt: (() {
        final value = json['updatedAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderChatConversationSummary.updatedAt is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'title': title,
      'ownerUserId': ownerUserId,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}

class BirdCoderChatConversationSummaryEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderChatConversationSummaryEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderChatConversationSummaryEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderChatConversationSummaryEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderChatConversationSummaryEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderChatConversationSummaryEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderChatConversationSummaryEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderChatConversationSummaryListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderChatConversationSummaryListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderChatConversationSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderChatConversationSummaryListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderChatConversationSummaryListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderChatConversationSummaryListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderChatConversationSummaryListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderChatMessageSummary {
  final String id;
  final String conversationId;
  final String role;
  final String content;
  final String createdAt;

  BirdCoderChatMessageSummary({
    required this.id,
    required this.conversationId,
    required this.role,
    required this.content,
    required this.createdAt
  });

  factory BirdCoderChatMessageSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderChatMessageSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderChatMessageSummary.id is required');
        }
        return value;
      })(),
      conversationId: (() {
        final value = json['conversationId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderChatMessageSummary.conversationId is required');
        }
        return value;
      })(),
      role: (() {
        final value = json['role']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderChatMessageSummary.role is required');
        }
        return value;
      })(),
      content: (() {
        final value = json['content']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderChatMessageSummary.content is required');
        }
        return value;
      })(),
      createdAt: (() {
        final value = json['createdAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderChatMessageSummary.createdAt is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'conversationId': conversationId,
      'role': role,
      'content': content,
      'createdAt': createdAt,
    };
  }
}

class BirdCoderChatMessageSummaryEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderChatMessageSummaryEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderChatMessageSummaryEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderChatMessageSummaryEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderChatMessageSummaryEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderChatMessageSummaryEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderChatMessageSummaryEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderChatMessageSummaryListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderChatMessageSummaryListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderChatMessageSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderChatMessageSummaryListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderChatMessageSummaryListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderChatMessageSummaryListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderChatMessageSummaryListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderCodeEngineModelConfig {
  final int schemaVersion;
  final String source;
  final String version;
  final String updatedAt;
  final Map<String, BirdCoderCodeEngineModelConfigEngine> engines;

  BirdCoderCodeEngineModelConfig({
    required this.schemaVersion,
    required this.source,
    required this.version,
    required this.updatedAt,
    required this.engines
  });

  factory BirdCoderCodeEngineModelConfig.fromJson(Map<String, dynamic> json) {
    return BirdCoderCodeEngineModelConfig(
      schemaVersion: (() {
        final value = json['schemaVersion'];
        if (value is! int) {
          throw FormatException('BirdCoderCodeEngineModelConfig.schemaVersion is required');
        }
        return value;
      })(),
      source: (() {
        final value = json['source']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodeEngineModelConfig.source is required');
        }
        return value;
      })(),
      version: (() {
        final value = json['version']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodeEngineModelConfig.version is required');
        }
        return value;
      })(),
      updatedAt: (() {
        final value = json['updatedAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodeEngineModelConfig.updatedAt is required');
        }
        return value;
      })(),
      engines: (() {
        final map = _sdkworkAsMap(json['engines']);
        if (map == null) {
          throw FormatException('BirdCoderCodeEngineModelConfig.engines is required');
        }
        final result = <String, BirdCoderCodeEngineModelConfigEngine>{};
        map.forEach((key, item) {
          final deserialized = (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderCodeEngineModelConfigEngine.fromJson(map);
      })();
          if (deserialized is BirdCoderCodeEngineModelConfigEngine) {
            result[key] = deserialized;
          }
        });
        return result;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'schemaVersion': schemaVersion,
      'source': source,
      'version': version,
      'updatedAt': updatedAt,
      'engines': engines.map((key, item) => MapEntry(key, item.toJson())),
    };
  }
}

class BirdCoderCodeEngineModelConfigCustomModel {
  final String id;
  final String label;

  BirdCoderCodeEngineModelConfigCustomModel({
    required this.id,
    required this.label
  });

  factory BirdCoderCodeEngineModelConfigCustomModel.fromJson(Map<String, dynamic> json) {
    return BirdCoderCodeEngineModelConfigCustomModel(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodeEngineModelConfigCustomModel.id is required');
        }
        return value;
      })(),
      label: (() {
        final value = json['label']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodeEngineModelConfigCustomModel.label is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'label': label,
    };
  }
}

class BirdCoderCodeEngineModelConfigEngine {
  final String engineId;
  final String defaultModelId;
  final String selectedModelId;
  final List<BirdCoderCodeEngineModelConfigCustomModel> customModels;
  final List<BirdCoderModelCatalogEntry> models;

  BirdCoderCodeEngineModelConfigEngine({
    required this.engineId,
    required this.defaultModelId,
    required this.selectedModelId,
    required this.customModels,
    required this.models
  });

  factory BirdCoderCodeEngineModelConfigEngine.fromJson(Map<String, dynamic> json) {
    return BirdCoderCodeEngineModelConfigEngine(
      engineId: (() {
        final value = json['engineId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodeEngineModelConfigEngine.engineId is required');
        }
        return value;
      })(),
      defaultModelId: (() {
        final value = json['defaultModelId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodeEngineModelConfigEngine.defaultModelId is required');
        }
        return value;
      })(),
      selectedModelId: (() {
        final value = json['selectedModelId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodeEngineModelConfigEngine.selectedModelId is required');
        }
        return value;
      })(),
      customModels: (() {
        final list = _sdkworkAsList(json['customModels']);
        if (list == null) {
          throw FormatException('BirdCoderCodeEngineModelConfigEngine.customModels is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderCodeEngineModelConfigCustomModel.fromJson(map);
      })())
            .whereType<BirdCoderCodeEngineModelConfigCustomModel>()
            .toList();
      })(),
      models: (() {
        final list = _sdkworkAsList(json['models']);
        if (list == null) {
          throw FormatException('BirdCoderCodeEngineModelConfigEngine.models is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderModelCatalogEntry.fromJson(map);
      })())
            .whereType<BirdCoderModelCatalogEntry>()
            .toList();
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'engineId': engineId,
      'defaultModelId': defaultModelId,
      'selectedModelId': selectedModelId,
      'customModels': customModels.map((item) => item.toJson()).toList(),
      'models': models.map((item) => item.toJson()).toList(),
    };
  }
}

class BirdCoderCodeEngineModelConfigEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderCodeEngineModelConfigEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderCodeEngineModelConfigEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderCodeEngineModelConfigEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderCodeEngineModelConfigEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderCodeEngineModelConfigEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodeEngineModelConfigEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderCodeEngineModelConfigSyncResult {
  final String action;
  final String authoritativeSource;
  final BirdCoderCodeEngineModelConfig config;
  final bool shouldWriteLocal;
  final bool shouldWriteServer;

  BirdCoderCodeEngineModelConfigSyncResult({
    required this.action,
    required this.authoritativeSource,
    required this.config,
    required this.shouldWriteLocal,
    required this.shouldWriteServer
  });

  factory BirdCoderCodeEngineModelConfigSyncResult.fromJson(Map<String, dynamic> json) {
    return BirdCoderCodeEngineModelConfigSyncResult(
      action: (() {
        final value = json['action']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodeEngineModelConfigSyncResult.action is required');
        }
        return value;
      })(),
      authoritativeSource: (() {
        final value = json['authoritativeSource']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodeEngineModelConfigSyncResult.authoritativeSource is required');
        }
        return value;
      })(),
      config: (() {
        final map = _sdkworkAsMap(json['config']);
        if (map == null) {
          throw FormatException('BirdCoderCodeEngineModelConfigSyncResult.config is required');
        }
        return BirdCoderCodeEngineModelConfig.fromJson(map);
      })(),
      shouldWriteLocal: (() {
        final value = json['shouldWriteLocal'];
        if (value is! bool) {
          throw FormatException('BirdCoderCodeEngineModelConfigSyncResult.shouldWriteLocal is required');
        }
        return value;
      })(),
      shouldWriteServer: (() {
        final value = json['shouldWriteServer'];
        if (value is! bool) {
          throw FormatException('BirdCoderCodeEngineModelConfigSyncResult.shouldWriteServer is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'action': action,
      'authoritativeSource': authoritativeSource,
      'config': config.toJson(),
      'shouldWriteLocal': shouldWriteLocal,
      'shouldWriteServer': shouldWriteServer,
    };
  }
}

class BirdCoderCodeEngineModelConfigSyncResultEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderCodeEngineModelConfigSyncResultEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderCodeEngineModelConfigSyncResultEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderCodeEngineModelConfigSyncResultEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderCodeEngineModelConfigSyncResultEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderCodeEngineModelConfigSyncResultEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodeEngineModelConfigSyncResultEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderCodingServerDescriptor {
  final String apiVersion;
  final BirdCoderApiGatewaySummary gateway;
  final String hostMode;
  final String moduleId;
  final String openApiPath;
  final List<String> surfaces;

  BirdCoderCodingServerDescriptor({
    required this.apiVersion,
    required this.gateway,
    required this.hostMode,
    required this.moduleId,
    required this.openApiPath,
    required this.surfaces
  });

  factory BirdCoderCodingServerDescriptor.fromJson(Map<String, dynamic> json) {
    return BirdCoderCodingServerDescriptor(
      apiVersion: (() {
        final value = json['apiVersion']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingServerDescriptor.apiVersion is required');
        }
        return value;
      })(),
      gateway: (() {
        final map = _sdkworkAsMap(json['gateway']);
        if (map == null) {
          throw FormatException('BirdCoderCodingServerDescriptor.gateway is required');
        }
        return BirdCoderApiGatewaySummary.fromJson(map);
      })(),
      hostMode: (() {
        final value = json['hostMode']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingServerDescriptor.hostMode is required');
        }
        return value;
      })(),
      moduleId: (() {
        final value = json['moduleId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingServerDescriptor.moduleId is required');
        }
        return value;
      })(),
      openApiPath: (() {
        final value = json['openApiPath']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingServerDescriptor.openApiPath is required');
        }
        return value;
      })(),
      surfaces: (() {
        final list = _sdkworkAsList(json['surfaces']);
        if (list == null) {
          throw FormatException('BirdCoderCodingServerDescriptor.surfaces is required');
        }
        return list
            .map((item) => item?.toString())
            .whereType<String>()
            .toList();
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'apiVersion': apiVersion,
      'gateway': gateway.toJson(),
      'hostMode': hostMode,
      'moduleId': moduleId,
      'openApiPath': openApiPath,
      'surfaces': surfaces.map((item) => item).toList(),
    };
  }
}

class BirdCoderCodingServerDescriptorEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderCodingServerDescriptorEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderCodingServerDescriptorEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderCodingServerDescriptorEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderCodingServerDescriptorEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderCodingServerDescriptorEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingServerDescriptorEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderCodingSessionArtifact {
  final String id;
  final String codingSessionId;
  final String? turnId;
  final String kind;
  final String? status;
  final String title;
  final String? blobRef;
  final Map<String, dynamic>? metadata;
  final String createdAt;

  BirdCoderCodingSessionArtifact({
    required this.id,
    required this.codingSessionId,
    this.turnId,
    required this.kind,
    this.status,
    required this.title,
    this.blobRef,
    this.metadata,
    required this.createdAt
  });

  factory BirdCoderCodingSessionArtifact.fromJson(Map<String, dynamic> json) {
    return BirdCoderCodingSessionArtifact(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionArtifact.id is required');
        }
        return value;
      })(),
      codingSessionId: (() {
        final value = json['codingSessionId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionArtifact.codingSessionId is required');
        }
        return value;
      })(),
      turnId: json['turnId']?.toString(),
      kind: (() {
        final value = json['kind']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionArtifact.kind is required');
        }
        return value;
      })(),
      status: json['status']?.toString(),
      title: (() {
        final value = json['title']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionArtifact.title is required');
        }
        return value;
      })(),
      blobRef: json['blobRef']?.toString(),
      metadata: _sdkworkAsMap(json['metadata']),
      createdAt: (() {
        final value = json['createdAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionArtifact.createdAt is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'codingSessionId': codingSessionId,
      'turnId': turnId,
      'kind': kind,
      'status': status,
      'title': title,
      'blobRef': blobRef,
      'metadata': metadata,
      'createdAt': createdAt,
    };
  }
}

class BirdCoderCodingSessionArtifactListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderCodingSessionArtifactListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderCodingSessionArtifactListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderCodingSessionArtifactListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderCodingSessionArtifactListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderCodingSessionArtifactListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionArtifactListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderCodingSessionCheckpoint {
  final String id;
  final String codingSessionId;
  final String? runtimeId;
  final String checkpointKind;
  final bool resumable;
  final Map<String, dynamic> state;
  final String createdAt;

  BirdCoderCodingSessionCheckpoint({
    required this.id,
    required this.codingSessionId,
    this.runtimeId,
    required this.checkpointKind,
    required this.resumable,
    required this.state,
    required this.createdAt
  });

  factory BirdCoderCodingSessionCheckpoint.fromJson(Map<String, dynamic> json) {
    return BirdCoderCodingSessionCheckpoint(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionCheckpoint.id is required');
        }
        return value;
      })(),
      codingSessionId: (() {
        final value = json['codingSessionId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionCheckpoint.codingSessionId is required');
        }
        return value;
      })(),
      runtimeId: json['runtimeId']?.toString(),
      checkpointKind: (() {
        final value = json['checkpointKind']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionCheckpoint.checkpointKind is required');
        }
        return value;
      })(),
      resumable: (() {
        final value = json['resumable'];
        if (value is! bool) {
          throw FormatException('BirdCoderCodingSessionCheckpoint.resumable is required');
        }
        return value;
      })(),
      state: (() {
        final map = _sdkworkAsMap(json['state']);
        if (map == null) {
          throw FormatException('BirdCoderCodingSessionCheckpoint.state is required');
        }
        return map;
      })(),
      createdAt: (() {
        final value = json['createdAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionCheckpoint.createdAt is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'codingSessionId': codingSessionId,
      'runtimeId': runtimeId,
      'checkpointKind': checkpointKind,
      'resumable': resumable,
      'state': state,
      'createdAt': createdAt,
    };
  }
}

class BirdCoderCodingSessionCheckpointListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderCodingSessionCheckpointListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderCodingSessionCheckpointListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderCodingSessionCheckpointListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderCodingSessionCheckpointListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderCodingSessionCheckpointListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionCheckpointListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderCodingSessionEvent {
  final String id;
  final String codingSessionId;
  final String? turnId;
  final String? runtimeId;
  final String kind;
  final String sequence;
  final Map<String, dynamic> payload;
  final String createdAt;

  BirdCoderCodingSessionEvent({
    required this.id,
    required this.codingSessionId,
    this.turnId,
    this.runtimeId,
    required this.kind,
    required this.sequence,
    required this.payload,
    required this.createdAt
  });

  factory BirdCoderCodingSessionEvent.fromJson(Map<String, dynamic> json) {
    return BirdCoderCodingSessionEvent(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionEvent.id is required');
        }
        return value;
      })(),
      codingSessionId: (() {
        final value = json['codingSessionId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionEvent.codingSessionId is required');
        }
        return value;
      })(),
      turnId: json['turnId']?.toString(),
      runtimeId: json['runtimeId']?.toString(),
      kind: (() {
        final value = json['kind']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionEvent.kind is required');
        }
        return value;
      })(),
      sequence: (() {
        final value = json['sequence']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionEvent.sequence is required');
        }
        return value;
      })(),
      payload: (() {
        final map = _sdkworkAsMap(json['payload']);
        if (map == null) {
          throw FormatException('BirdCoderCodingSessionEvent.payload is required');
        }
        return map;
      })(),
      createdAt: (() {
        final value = json['createdAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionEvent.createdAt is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'codingSessionId': codingSessionId,
      'turnId': turnId,
      'runtimeId': runtimeId,
      'kind': kind,
      'sequence': sequence,
      'payload': payload,
      'createdAt': createdAt,
    };
  }
}

class BirdCoderCodingSessionEventListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderCodingSessionEventListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderCodingSessionEventListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderCodingSessionEventListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderCodingSessionEventListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderCodingSessionEventListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionEventListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderCodingSessionSummary {
  final String id;
  final String workspaceId;
  final String projectId;
  final String title;
  final String status;
  final String hostMode;
  final String engineId;
  final String modelId;
  final String? nativeSessionId;
  final String createdAt;
  final String updatedAt;
  final String? lastTurnAt;
  final String? sortTimestamp;
  final String? transcriptUpdatedAt;

  BirdCoderCodingSessionSummary({
    required this.id,
    required this.workspaceId,
    required this.projectId,
    required this.title,
    required this.status,
    required this.hostMode,
    required this.engineId,
    required this.modelId,
    this.nativeSessionId,
    required this.createdAt,
    required this.updatedAt,
    this.lastTurnAt,
    this.sortTimestamp,
    this.transcriptUpdatedAt
  });

  factory BirdCoderCodingSessionSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderCodingSessionSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionSummary.id is required');
        }
        return value;
      })(),
      workspaceId: (() {
        final value = json['workspaceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionSummary.workspaceId is required');
        }
        return value;
      })(),
      projectId: (() {
        final value = json['projectId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionSummary.projectId is required');
        }
        return value;
      })(),
      title: (() {
        final value = json['title']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionSummary.title is required');
        }
        return value;
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionSummary.status is required');
        }
        return value;
      })(),
      hostMode: (() {
        final value = json['hostMode']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionSummary.hostMode is required');
        }
        return value;
      })(),
      engineId: (() {
        final value = json['engineId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionSummary.engineId is required');
        }
        return value;
      })(),
      modelId: (() {
        final value = json['modelId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionSummary.modelId is required');
        }
        return value;
      })(),
      nativeSessionId: json['nativeSessionId']?.toString(),
      createdAt: (() {
        final value = json['createdAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionSummary.createdAt is required');
        }
        return value;
      })(),
      updatedAt: (() {
        final value = json['updatedAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionSummary.updatedAt is required');
        }
        return value;
      })(),
      lastTurnAt: json['lastTurnAt']?.toString(),
      sortTimestamp: json['sortTimestamp']?.toString(),
      transcriptUpdatedAt: json['transcriptUpdatedAt']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'workspaceId': workspaceId,
      'projectId': projectId,
      'title': title,
      'status': status,
      'hostMode': hostMode,
      'engineId': engineId,
      'modelId': modelId,
      'nativeSessionId': nativeSessionId,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
      'lastTurnAt': lastTurnAt,
      'sortTimestamp': sortTimestamp,
      'transcriptUpdatedAt': transcriptUpdatedAt,
    };
  }
}

class BirdCoderCodingSessionSummaryEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderCodingSessionSummaryEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderCodingSessionSummaryEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderCodingSessionSummaryEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderCodingSessionSummaryEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderCodingSessionSummaryEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionSummaryEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderCodingSessionSummaryListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderCodingSessionSummaryListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderCodingSessionSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderCodingSessionSummaryListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderCodingSessionSummaryListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderCodingSessionSummaryListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionSummaryListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderCodingSessionTurn {
  final String id;
  final String codingSessionId;
  final String? runtimeId;
  final String requestKind;
  final String status;
  final String inputSummary;
  final String? startedAt;
  final String? completedAt;

  BirdCoderCodingSessionTurn({
    required this.id,
    required this.codingSessionId,
    this.runtimeId,
    required this.requestKind,
    required this.status,
    required this.inputSummary,
    this.startedAt,
    this.completedAt
  });

  factory BirdCoderCodingSessionTurn.fromJson(Map<String, dynamic> json) {
    return BirdCoderCodingSessionTurn(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionTurn.id is required');
        }
        return value;
      })(),
      codingSessionId: (() {
        final value = json['codingSessionId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionTurn.codingSessionId is required');
        }
        return value;
      })(),
      runtimeId: json['runtimeId']?.toString(),
      requestKind: (() {
        final value = json['requestKind']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionTurn.requestKind is required');
        }
        return value;
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionTurn.status is required');
        }
        return value;
      })(),
      inputSummary: (() {
        final value = json['inputSummary']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionTurn.inputSummary is required');
        }
        return value;
      })(),
      startedAt: json['startedAt']?.toString(),
      completedAt: json['completedAt']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'codingSessionId': codingSessionId,
      'runtimeId': runtimeId,
      'requestKind': requestKind,
      'status': status,
      'inputSummary': inputSummary,
      'startedAt': startedAt,
      'completedAt': completedAt,
    };
  }
}

class BirdCoderCodingSessionTurnCurrentFileContext {
  final String path;
  final String? content;
  final String? language;

  BirdCoderCodingSessionTurnCurrentFileContext({
    required this.path,
    this.content,
    this.language
  });

  factory BirdCoderCodingSessionTurnCurrentFileContext.fromJson(Map<String, dynamic> json) {
    return BirdCoderCodingSessionTurnCurrentFileContext(
      path: (() {
        final value = json['path']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionTurnCurrentFileContext.path is required');
        }
        return value;
      })(),
      content: json['content']?.toString(),
      language: json['language']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'path': path,
      'content': content,
      'language': language,
    };
  }
}

class BirdCoderCodingSessionTurnEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderCodingSessionTurnEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderCodingSessionTurnEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderCodingSessionTurnEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderCodingSessionTurnEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderCodingSessionTurnEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCodingSessionTurnEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderCodingSessionTurnIdeContext {
  final String? workspaceId;
  final String? projectId;
  final String? sessionId;
  final BirdCoderCodingSessionTurnCurrentFileContext? currentFile;

  BirdCoderCodingSessionTurnIdeContext({
    this.workspaceId,
    this.projectId,
    this.sessionId,
    this.currentFile
  });

  factory BirdCoderCodingSessionTurnIdeContext.fromJson(Map<String, dynamic> json) {
    return BirdCoderCodingSessionTurnIdeContext(
      workspaceId: json['workspaceId']?.toString(),
      projectId: json['projectId']?.toString(),
      sessionId: json['sessionId']?.toString(),
      currentFile: (() {
        final map = _sdkworkAsMap(json['currentFile']);
        return map == null ? null : BirdCoderCodingSessionTurnCurrentFileContext.fromJson(map);
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'workspaceId': workspaceId,
      'projectId': projectId,
      'sessionId': sessionId,
      'currentFile': currentFile?.toJson(),
    };
  }
}

class BirdCoderCodingSessionTurnOptions {
  final double? temperature;
  final double? topP;
  final int? maxTokens;

  BirdCoderCodingSessionTurnOptions({
    this.temperature,
    this.topP,
    this.maxTokens
  });

  factory BirdCoderCodingSessionTurnOptions.fromJson(Map<String, dynamic> json) {
    return BirdCoderCodingSessionTurnOptions(
      temperature: json['temperature'] is num ? json['temperature'].toDouble() : null,
      topP: json['topP'] is num ? json['topP'].toDouble() : null,
      maxTokens: json['maxTokens'] is int ? json['maxTokens'] : null
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'temperature': temperature,
      'topP': topP,
      'maxTokens': maxTokens,
    };
  }
}

class BirdCoderCommerceMembershipBenefitSummary {
  final String id;
  final String name;
  final String? benefitKey;
  final String? type;
  final String? description;
  final String? icon;
  final bool claimed;
  final String? usageLimit;
  final String? usedCount;

  BirdCoderCommerceMembershipBenefitSummary({
    required this.id,
    required this.name,
    this.benefitKey,
    this.type,
    this.description,
    this.icon,
    required this.claimed,
    this.usageLimit,
    this.usedCount
  });

  factory BirdCoderCommerceMembershipBenefitSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderCommerceMembershipBenefitSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCommerceMembershipBenefitSummary.id is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCommerceMembershipBenefitSummary.name is required');
        }
        return value;
      })(),
      benefitKey: json['benefitKey']?.toString(),
      type: json['type']?.toString(),
      description: json['description']?.toString(),
      icon: json['icon']?.toString(),
      claimed: (() {
        final value = json['claimed'];
        if (value is! bool) {
          throw FormatException('BirdCoderCommerceMembershipBenefitSummary.claimed is required');
        }
        return value;
      })(),
      usageLimit: json['usageLimit']?.toString(),
      usedCount: json['usedCount']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'name': name,
      'benefitKey': benefitKey,
      'type': type,
      'description': description,
      'icon': icon,
      'claimed': claimed,
      'usageLimit': usageLimit,
      'usedCount': usedCount,
    };
  }
}

class BirdCoderCommerceMembershipCurrentEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderCommerceMembershipCurrentEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderCommerceMembershipCurrentEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderCommerceMembershipCurrentEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderCommerceMembershipCurrentEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderCommerceMembershipCurrentEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCommerceMembershipCurrentEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderCommerceMembershipCurrentSummary {
  final String? tenantId;
  final String? organizationId;
  final String ownerUserId;
  final String? planId;
  final String planName;
  final String status;
  final String? startedAt;
  final String? expiresAt;
  final String? remainingDays;
  final String? totalDays;
  final String totalSpent;
  final String points;
  final String growthValue;
  final String upgradeGrowthValue;
  final List<BirdCoderCommerceMembershipBenefitSummary> benefits;

  BirdCoderCommerceMembershipCurrentSummary({
    this.tenantId,
    this.organizationId,
    required this.ownerUserId,
    this.planId,
    required this.planName,
    required this.status,
    this.startedAt,
    this.expiresAt,
    this.remainingDays,
    this.totalDays,
    required this.totalSpent,
    required this.points,
    required this.growthValue,
    required this.upgradeGrowthValue,
    required this.benefits
  });

  factory BirdCoderCommerceMembershipCurrentSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderCommerceMembershipCurrentSummary(
      tenantId: json['tenantId']?.toString(),
      organizationId: json['organizationId']?.toString(),
      ownerUserId: (() {
        final value = json['ownerUserId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCommerceMembershipCurrentSummary.ownerUserId is required');
        }
        return value;
      })(),
      planId: json['planId']?.toString(),
      planName: (() {
        final value = json['planName']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCommerceMembershipCurrentSummary.planName is required');
        }
        return value;
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCommerceMembershipCurrentSummary.status is required');
        }
        return value;
      })(),
      startedAt: json['startedAt']?.toString(),
      expiresAt: json['expiresAt']?.toString(),
      remainingDays: json['remainingDays']?.toString(),
      totalDays: json['totalDays']?.toString(),
      totalSpent: (() {
        final value = json['totalSpent']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCommerceMembershipCurrentSummary.totalSpent is required');
        }
        return value;
      })(),
      points: (() {
        final value = json['points']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCommerceMembershipCurrentSummary.points is required');
        }
        return value;
      })(),
      growthValue: (() {
        final value = json['growthValue']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCommerceMembershipCurrentSummary.growthValue is required');
        }
        return value;
      })(),
      upgradeGrowthValue: (() {
        final value = json['upgradeGrowthValue']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCommerceMembershipCurrentSummary.upgradeGrowthValue is required');
        }
        return value;
      })(),
      benefits: (() {
        final list = _sdkworkAsList(json['benefits']);
        if (list == null) {
          throw FormatException('BirdCoderCommerceMembershipCurrentSummary.benefits is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderCommerceMembershipBenefitSummary.fromJson(map);
      })())
            .whereType<BirdCoderCommerceMembershipBenefitSummary>()
            .toList();
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'tenantId': tenantId,
      'organizationId': organizationId,
      'ownerUserId': ownerUserId,
      'planId': planId,
      'planName': planName,
      'status': status,
      'startedAt': startedAt,
      'expiresAt': expiresAt,
      'remainingDays': remainingDays,
      'totalDays': totalDays,
      'totalSpent': totalSpent,
      'points': points,
      'growthValue': growthValue,
      'upgradeGrowthValue': upgradeGrowthValue,
      'benefits': benefits.map((item) => item.toJson()).toList(),
    };
  }
}

class BirdCoderCommerceMembershipPackageGroupSummary {
  final String id;
  final String name;
  final String? description;
  final String sortWeight;
  final List<BirdCoderCommerceMembershipPackageSummary> packages;

  BirdCoderCommerceMembershipPackageGroupSummary({
    required this.id,
    required this.name,
    this.description,
    required this.sortWeight,
    required this.packages
  });

  factory BirdCoderCommerceMembershipPackageGroupSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderCommerceMembershipPackageGroupSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCommerceMembershipPackageGroupSummary.id is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCommerceMembershipPackageGroupSummary.name is required');
        }
        return value;
      })(),
      description: json['description']?.toString(),
      sortWeight: (() {
        final value = json['sortWeight']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCommerceMembershipPackageGroupSummary.sortWeight is required');
        }
        return value;
      })(),
      packages: (() {
        final list = _sdkworkAsList(json['packages']);
        if (list == null) {
          throw FormatException('BirdCoderCommerceMembershipPackageGroupSummary.packages is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderCommerceMembershipPackageSummary.fromJson(map);
      })())
            .whereType<BirdCoderCommerceMembershipPackageSummary>()
            .toList();
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'name': name,
      'description': description,
      'sortWeight': sortWeight,
      'packages': packages.map((item) => item.toJson()).toList(),
    };
  }
}

class BirdCoderCommerceMembershipPackageGroupSummaryListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderCommerceMembershipPackageGroupSummaryListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderCommerceMembershipPackageGroupSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderCommerceMembershipPackageGroupSummaryListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderCommerceMembershipPackageGroupSummaryListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderCommerceMembershipPackageGroupSummaryListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCommerceMembershipPackageGroupSummaryListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderCommerceMembershipPackageSummary {
  final String id;
  final String name;
  final String? description;
  final String price;
  final String? originalPrice;
  final String pointAmount;
  final String durationDays;
  final String? planName;
  final String sortWeight;
  final bool recommended;
  final List<String> tags;

  BirdCoderCommerceMembershipPackageSummary({
    required this.id,
    required this.name,
    this.description,
    required this.price,
    this.originalPrice,
    required this.pointAmount,
    required this.durationDays,
    this.planName,
    required this.sortWeight,
    required this.recommended,
    required this.tags
  });

  factory BirdCoderCommerceMembershipPackageSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderCommerceMembershipPackageSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCommerceMembershipPackageSummary.id is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCommerceMembershipPackageSummary.name is required');
        }
        return value;
      })(),
      description: json['description']?.toString(),
      price: (() {
        final value = json['price']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCommerceMembershipPackageSummary.price is required');
        }
        return value;
      })(),
      originalPrice: json['originalPrice']?.toString(),
      pointAmount: (() {
        final value = json['pointAmount']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCommerceMembershipPackageSummary.pointAmount is required');
        }
        return value;
      })(),
      durationDays: (() {
        final value = json['durationDays']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCommerceMembershipPackageSummary.durationDays is required');
        }
        return value;
      })(),
      planName: json['planName']?.toString(),
      sortWeight: (() {
        final value = json['sortWeight']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCommerceMembershipPackageSummary.sortWeight is required');
        }
        return value;
      })(),
      recommended: (() {
        final value = json['recommended'];
        if (value is! bool) {
          throw FormatException('BirdCoderCommerceMembershipPackageSummary.recommended is required');
        }
        return value;
      })(),
      tags: (() {
        final list = _sdkworkAsList(json['tags']);
        if (list == null) {
          throw FormatException('BirdCoderCommerceMembershipPackageSummary.tags is required');
        }
        return list
            .map((item) => item?.toString())
            .whereType<String>()
            .toList();
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'name': name,
      'description': description,
      'price': price,
      'originalPrice': originalPrice,
      'pointAmount': pointAmount,
      'durationDays': durationDays,
      'planName': planName,
      'sortWeight': sortWeight,
      'recommended': recommended,
      'tags': tags.map((item) => item).toList(),
    };
  }
}

class BirdCoderCommitProjectGitChangesRequest {
  final String message;

  BirdCoderCommitProjectGitChangesRequest({
    required this.message
  });

  factory BirdCoderCommitProjectGitChangesRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCommitProjectGitChangesRequest(
      message: (() {
        final value = json['message']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCommitProjectGitChangesRequest.message is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'message': message,
    };
  }
}

class BirdCoderCoreHealthSummary {
  final String status;

  BirdCoderCoreHealthSummary({
    required this.status
  });

  factory BirdCoderCoreHealthSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderCoreHealthSummary(
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCoreHealthSummary.status is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'status': status,
    };
  }
}

class BirdCoderCoreHealthSummaryEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderCoreHealthSummaryEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderCoreHealthSummaryEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderCoreHealthSummaryEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderCoreHealthSummaryEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderCoreHealthSummaryEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCoreHealthSummaryEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderCoreRuntimeSummary {
  final String host;
  final int port;
  final String configFileName;

  BirdCoderCoreRuntimeSummary({
    required this.host,
    required this.port,
    required this.configFileName
  });

  factory BirdCoderCoreRuntimeSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderCoreRuntimeSummary(
      host: (() {
        final value = json['host']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCoreRuntimeSummary.host is required');
        }
        return value;
      })(),
      port: (() {
        final value = json['port'];
        if (value is! int) {
          throw FormatException('BirdCoderCoreRuntimeSummary.port is required');
        }
        return value;
      })(),
      configFileName: (() {
        final value = json['configFileName']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCoreRuntimeSummary.configFileName is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'host': host,
      'port': port,
      'configFileName': configFileName,
    };
  }
}

class BirdCoderCoreRuntimeSummaryEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderCoreRuntimeSummaryEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderCoreRuntimeSummaryEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderCoreRuntimeSummaryEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderCoreRuntimeSummaryEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderCoreRuntimeSummaryEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCoreRuntimeSummaryEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderCreateChatConversationRequest {
  final String? title;

  BirdCoderCreateChatConversationRequest({
    this.title
  });

  factory BirdCoderCreateChatConversationRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateChatConversationRequest(
      title: json['title']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'title': title,
    };
  }
}

class BirdCoderCreateChatMessageRequest {
  final String role;
  final String content;

  BirdCoderCreateChatMessageRequest({
    required this.role,
    required this.content
  });

  factory BirdCoderCreateChatMessageRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateChatMessageRequest(
      role: (() {
        final value = json['role']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateChatMessageRequest.role is required');
        }
        return value;
      })(),
      content: (() {
        final value = json['content']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateChatMessageRequest.content is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'role': role,
      'content': content,
    };
  }
}

class BirdCoderCreateCodingSessionRequest {
  final String workspaceId;
  final String projectId;
  final String? title;
  final String? hostMode;
  final String engineId;
  final String modelId;

  BirdCoderCreateCodingSessionRequest({
    required this.workspaceId,
    required this.projectId,
    this.title,
    this.hostMode,
    required this.engineId,
    required this.modelId
  });

  factory BirdCoderCreateCodingSessionRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateCodingSessionRequest(
      workspaceId: (() {
        final value = json['workspaceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateCodingSessionRequest.workspaceId is required');
        }
        return value;
      })(),
      projectId: (() {
        final value = json['projectId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateCodingSessionRequest.projectId is required');
        }
        return value;
      })(),
      title: json['title']?.toString(),
      hostMode: json['hostMode']?.toString(),
      engineId: (() {
        final value = json['engineId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateCodingSessionRequest.engineId is required');
        }
        return value;
      })(),
      modelId: (() {
        final value = json['modelId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateCodingSessionRequest.modelId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'workspaceId': workspaceId,
      'projectId': projectId,
      'title': title,
      'hostMode': hostMode,
      'engineId': engineId,
      'modelId': modelId,
    };
  }
}

class BirdCoderCreateCodingSessionTurnRequest {
  final String? runtimeId;
  final String? engineId;
  final String? modelId;
  final String requestKind;
  final String inputSummary;
  final bool? stream;
  final BirdCoderCodingSessionTurnIdeContext? ideContext;
  final BirdCoderCodingSessionTurnOptions? options;

  BirdCoderCreateCodingSessionTurnRequest({
    this.runtimeId,
    this.engineId,
    this.modelId,
    required this.requestKind,
    required this.inputSummary,
    this.stream,
    this.ideContext,
    this.options
  });

  factory BirdCoderCreateCodingSessionTurnRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateCodingSessionTurnRequest(
      runtimeId: json['runtimeId']?.toString(),
      engineId: json['engineId']?.toString(),
      modelId: json['modelId']?.toString(),
      requestKind: (() {
        final value = json['requestKind']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateCodingSessionTurnRequest.requestKind is required');
        }
        return value;
      })(),
      inputSummary: (() {
        final value = json['inputSummary']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateCodingSessionTurnRequest.inputSummary is required');
        }
        return value;
      })(),
      stream: json['stream'] is bool ? json['stream'] : null,
      ideContext: (() {
        final map = _sdkworkAsMap(json['ideContext']);
        return map == null ? null : BirdCoderCodingSessionTurnIdeContext.fromJson(map);
      })(),
      options: (() {
        final map = _sdkworkAsMap(json['options']);
        return map == null ? null : BirdCoderCodingSessionTurnOptions.fromJson(map);
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'runtimeId': runtimeId,
      'engineId': engineId,
      'modelId': modelId,
      'requestKind': requestKind,
      'inputSummary': inputSummary,
      'stream': stream,
      'ideContext': ideContext?.toJson(),
      'options': options?.toJson(),
    };
  }
}

class BirdCoderCreateProjectGitBranchRequest {
  final String branchName;

  BirdCoderCreateProjectGitBranchRequest({
    required this.branchName
  });

  factory BirdCoderCreateProjectGitBranchRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateProjectGitBranchRequest(
      branchName: (() {
        final value = json['branchName']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateProjectGitBranchRequest.branchName is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'branchName': branchName,
    };
  }
}

class BirdCoderCreateProjectGitWorktreeRequest {
  final String branchName;
  final String path;

  BirdCoderCreateProjectGitWorktreeRequest({
    required this.branchName,
    required this.path
  });

  factory BirdCoderCreateProjectGitWorktreeRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateProjectGitWorktreeRequest(
      branchName: (() {
        final value = json['branchName']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateProjectGitWorktreeRequest.branchName is required');
        }
        return value;
      })(),
      path: (() {
        final value = json['path']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateProjectGitWorktreeRequest.path is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'branchName': branchName,
      'path': path,
    };
  }
}

class BirdCoderCreateProjectRequest {
  final String? description;
  final String name;
  final String? workspaceUuid;
  final String? tenantId;
  final String? organizationId;
  final String? dataScope;
  final String? userId;
  final String? parentId;
  final String? parentUuid;
  final Map<String, dynamic>? parentMetadata;
  final String? code;
  final String? title;
  final String? ownerId;
  final String? leaderId;
  final String? createdByUserId;
  final String? author;
  final String? type;
  final String? rootPath;
  final String? sitePath;
  final String? domainPrefix;
  final String? fileId;
  final String? conversationId;
  final String? startTime;
  final String? endTime;
  final String? budgetAmount;
  final Map<String, dynamic>? coverImage;
  final bool? isTemplate;
  final String? appTemplateVersionId;
  final String? templatePresetKey;
  final String? status;
  final String workspaceId;

  BirdCoderCreateProjectRequest({
    this.description,
    required this.name,
    this.workspaceUuid,
    this.tenantId,
    this.organizationId,
    this.dataScope,
    this.userId,
    this.parentId,
    this.parentUuid,
    this.parentMetadata,
    this.code,
    this.title,
    this.ownerId,
    this.leaderId,
    this.createdByUserId,
    this.author,
    this.type,
    this.rootPath,
    this.sitePath,
    this.domainPrefix,
    this.fileId,
    this.conversationId,
    this.startTime,
    this.endTime,
    this.budgetAmount,
    this.coverImage,
    this.isTemplate,
    this.appTemplateVersionId,
    this.templatePresetKey,
    this.status,
    required this.workspaceId
  });

  factory BirdCoderCreateProjectRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateProjectRequest(
      description: json['description']?.toString(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateProjectRequest.name is required');
        }
        return value;
      })(),
      workspaceUuid: json['workspaceUuid']?.toString(),
      tenantId: json['tenantId']?.toString(),
      organizationId: json['organizationId']?.toString(),
      dataScope: json['dataScope']?.toString(),
      userId: json['userId']?.toString(),
      parentId: json['parentId']?.toString(),
      parentUuid: json['parentUuid']?.toString(),
      parentMetadata: _sdkworkAsMap(json['parentMetadata']),
      code: json['code']?.toString(),
      title: json['title']?.toString(),
      ownerId: json['ownerId']?.toString(),
      leaderId: json['leaderId']?.toString(),
      createdByUserId: json['createdByUserId']?.toString(),
      author: json['author']?.toString(),
      type: json['type']?.toString(),
      rootPath: json['rootPath']?.toString(),
      sitePath: json['sitePath']?.toString(),
      domainPrefix: json['domainPrefix']?.toString(),
      fileId: json['fileId']?.toString(),
      conversationId: json['conversationId']?.toString(),
      startTime: json['startTime']?.toString(),
      endTime: json['endTime']?.toString(),
      budgetAmount: json['budgetAmount']?.toString(),
      coverImage: _sdkworkAsMap(json['coverImage']),
      isTemplate: json['isTemplate'] is bool ? json['isTemplate'] : null,
      appTemplateVersionId: json['appTemplateVersionId']?.toString(),
      templatePresetKey: json['templatePresetKey']?.toString(),
      status: json['status']?.toString(),
      workspaceId: (() {
        final value = json['workspaceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateProjectRequest.workspaceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'description': description,
      'name': name,
      'workspaceUuid': workspaceUuid,
      'tenantId': tenantId,
      'organizationId': organizationId,
      'dataScope': dataScope,
      'userId': userId,
      'parentId': parentId,
      'parentUuid': parentUuid,
      'parentMetadata': parentMetadata,
      'code': code,
      'title': title,
      'ownerId': ownerId,
      'leaderId': leaderId,
      'createdByUserId': createdByUserId,
      'author': author,
      'type': type,
      'rootPath': rootPath,
      'sitePath': sitePath,
      'domainPrefix': domainPrefix,
      'fileId': fileId,
      'conversationId': conversationId,
      'startTime': startTime,
      'endTime': endTime,
      'budgetAmount': budgetAmount,
      'coverImage': coverImage,
      'isTemplate': isTemplate,
      'appTemplateVersionId': appTemplateVersionId,
      'templatePresetKey': templatePresetKey,
      'status': status,
      'workspaceId': workspaceId,
    };
  }
}

class BirdCoderCreateWorkspaceRequest {
  final String? description;
  final String name;
  final String? tenantId;
  final String? organizationId;
  final String? dataScope;
  final String? code;
  final String? title;
  final String? ownerId;
  final String? leaderId;
  final String? createdByUserId;
  final String? icon;
  final String? color;
  final String? type;
  final String? startTime;
  final String? endTime;
  final int? maxMembers;
  final int? currentMembers;
  final int? memberCount;
  final String? maxStorage;
  final String? usedStorage;
  final Map<String, dynamic>? settings;
  final bool? isPublic;
  final bool? isTemplate;

  BirdCoderCreateWorkspaceRequest({
    this.description,
    required this.name,
    this.tenantId,
    this.organizationId,
    this.dataScope,
    this.code,
    this.title,
    this.ownerId,
    this.leaderId,
    this.createdByUserId,
    this.icon,
    this.color,
    this.type,
    this.startTime,
    this.endTime,
    this.maxMembers,
    this.currentMembers,
    this.memberCount,
    this.maxStorage,
    this.usedStorage,
    this.settings,
    this.isPublic,
    this.isTemplate
  });

  factory BirdCoderCreateWorkspaceRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateWorkspaceRequest(
      description: json['description']?.toString(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateWorkspaceRequest.name is required');
        }
        return value;
      })(),
      tenantId: json['tenantId']?.toString(),
      organizationId: json['organizationId']?.toString(),
      dataScope: json['dataScope']?.toString(),
      code: json['code']?.toString(),
      title: json['title']?.toString(),
      ownerId: json['ownerId']?.toString(),
      leaderId: json['leaderId']?.toString(),
      createdByUserId: json['createdByUserId']?.toString(),
      icon: json['icon']?.toString(),
      color: json['color']?.toString(),
      type: json['type']?.toString(),
      startTime: json['startTime']?.toString(),
      endTime: json['endTime']?.toString(),
      maxMembers: json['maxMembers'] is int ? json['maxMembers'] : null,
      currentMembers: json['currentMembers'] is int ? json['currentMembers'] : null,
      memberCount: json['memberCount'] is int ? json['memberCount'] : null,
      maxStorage: json['maxStorage']?.toString(),
      usedStorage: json['usedStorage']?.toString(),
      settings: _sdkworkAsMap(json['settings']),
      isPublic: json['isPublic'] is bool ? json['isPublic'] : null,
      isTemplate: json['isTemplate'] is bool ? json['isTemplate'] : null
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'description': description,
      'name': name,
      'tenantId': tenantId,
      'organizationId': organizationId,
      'dataScope': dataScope,
      'code': code,
      'title': title,
      'ownerId': ownerId,
      'leaderId': leaderId,
      'createdByUserId': createdByUserId,
      'icon': icon,
      'color': color,
      'type': type,
      'startTime': startTime,
      'endTime': endTime,
      'maxMembers': maxMembers,
      'currentMembers': currentMembers,
      'memberCount': memberCount,
      'maxStorage': maxStorage,
      'usedStorage': usedStorage,
      'settings': settings,
      'isPublic': isPublic,
      'isTemplate': isTemplate,
    };
  }
}

class BirdCoderDeleteChatConversationEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderDeleteChatConversationEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderDeleteChatConversationEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderDeleteChatConversationEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderDeleteChatConversationEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderDeleteChatConversationEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeleteChatConversationEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderDeleteChatConversationResult {
  final String id;

  BirdCoderDeleteChatConversationResult({
    required this.id
  });

  factory BirdCoderDeleteChatConversationResult.fromJson(Map<String, dynamic> json) {
    return BirdCoderDeleteChatConversationResult(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeleteChatConversationResult.id is required');
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

class BirdCoderDeleteCodingSessionMessageResult {
  final String id;
  final String codingSessionId;

  BirdCoderDeleteCodingSessionMessageResult({
    required this.id,
    required this.codingSessionId
  });

  factory BirdCoderDeleteCodingSessionMessageResult.fromJson(Map<String, dynamic> json) {
    return BirdCoderDeleteCodingSessionMessageResult(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeleteCodingSessionMessageResult.id is required');
        }
        return value;
      })(),
      codingSessionId: (() {
        final value = json['codingSessionId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeleteCodingSessionMessageResult.codingSessionId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'codingSessionId': codingSessionId,
    };
  }
}

class BirdCoderDeleteCodingSessionMessageResultEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderDeleteCodingSessionMessageResultEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderDeleteCodingSessionMessageResultEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderDeleteCodingSessionMessageResultEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderDeleteCodingSessionMessageResultEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderDeleteCodingSessionMessageResultEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeleteCodingSessionMessageResultEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderDeletedResourceEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderDeletedResourceEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderDeletedResourceEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderDeletedResourceEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderDeletedResourceEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderDeletedResourceEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeletedResourceEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
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
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderDeploymentRecordSummaryListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderDeploymentRecordSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderDeploymentRecordSummaryListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderDeploymentRecordSummaryListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderDeploymentRecordSummaryListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeploymentRecordSummaryListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
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
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderDeploymentTargetSummaryListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderDeploymentTargetSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderDeploymentTargetSummaryListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderDeploymentTargetSummaryListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderDeploymentTargetSummaryListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderDeploymentTargetSummaryListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderEditCodingSessionMessageRequest {
  final String content;

  BirdCoderEditCodingSessionMessageRequest({
    required this.content
  });

  factory BirdCoderEditCodingSessionMessageRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderEditCodingSessionMessageRequest(
      content: (() {
        final value = json['content']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEditCodingSessionMessageRequest.content is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'content': content,
    };
  }
}

class BirdCoderEditCodingSessionMessageResult {
  final String id;
  final String codingSessionId;
  final String content;

  BirdCoderEditCodingSessionMessageResult({
    required this.id,
    required this.codingSessionId,
    required this.content
  });

  factory BirdCoderEditCodingSessionMessageResult.fromJson(Map<String, dynamic> json) {
    return BirdCoderEditCodingSessionMessageResult(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEditCodingSessionMessageResult.id is required');
        }
        return value;
      })(),
      codingSessionId: (() {
        final value = json['codingSessionId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEditCodingSessionMessageResult.codingSessionId is required');
        }
        return value;
      })(),
      content: (() {
        final value = json['content']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEditCodingSessionMessageResult.content is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'codingSessionId': codingSessionId,
      'content': content,
    };
  }
}

class BirdCoderEditCodingSessionMessageResultEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderEditCodingSessionMessageResultEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderEditCodingSessionMessageResultEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderEditCodingSessionMessageResultEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderEditCodingSessionMessageResultEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderEditCodingSessionMessageResultEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEditCodingSessionMessageResultEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderEngineAccessLane {
  final String laneId;
  final String label;
  final String strategyKind;
  final String runtimeOwner;
  final String bridgeProtocol;
  final String transportKind;
  final String status;
  final bool enabledByDefault;
  final List<String> hostModes;
  final String description;

  BirdCoderEngineAccessLane({
    required this.laneId,
    required this.label,
    required this.strategyKind,
    required this.runtimeOwner,
    required this.bridgeProtocol,
    required this.transportKind,
    required this.status,
    required this.enabledByDefault,
    required this.hostModes,
    required this.description
  });

  factory BirdCoderEngineAccessLane.fromJson(Map<String, dynamic> json) {
    return BirdCoderEngineAccessLane(
      laneId: (() {
        final value = json['laneId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineAccessLane.laneId is required');
        }
        return value;
      })(),
      label: (() {
        final value = json['label']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineAccessLane.label is required');
        }
        return value;
      })(),
      strategyKind: (() {
        final value = json['strategyKind']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineAccessLane.strategyKind is required');
        }
        return value;
      })(),
      runtimeOwner: (() {
        final value = json['runtimeOwner']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineAccessLane.runtimeOwner is required');
        }
        return value;
      })(),
      bridgeProtocol: (() {
        final value = json['bridgeProtocol']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineAccessLane.bridgeProtocol is required');
        }
        return value;
      })(),
      transportKind: (() {
        final value = json['transportKind']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineAccessLane.transportKind is required');
        }
        return value;
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineAccessLane.status is required');
        }
        return value;
      })(),
      enabledByDefault: (() {
        final value = json['enabledByDefault'];
        if (value is! bool) {
          throw FormatException('BirdCoderEngineAccessLane.enabledByDefault is required');
        }
        return value;
      })(),
      hostModes: (() {
        final list = _sdkworkAsList(json['hostModes']);
        if (list == null) {
          throw FormatException('BirdCoderEngineAccessLane.hostModes is required');
        }
        return list
            .map((item) => item?.toString())
            .whereType<String>()
            .toList();
      })(),
      description: (() {
        final value = json['description']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineAccessLane.description is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'laneId': laneId,
      'label': label,
      'strategyKind': strategyKind,
      'runtimeOwner': runtimeOwner,
      'bridgeProtocol': bridgeProtocol,
      'transportKind': transportKind,
      'status': status,
      'enabledByDefault': enabledByDefault,
      'hostModes': hostModes.map((item) => item).toList(),
      'description': description,
    };
  }
}

class BirdCoderEngineAccessPlan {
  final String primaryLaneId;
  final List<String> fallbackLaneIds;
  final List<BirdCoderEngineAccessLane> lanes;

  BirdCoderEngineAccessPlan({
    required this.primaryLaneId,
    required this.fallbackLaneIds,
    required this.lanes
  });

  factory BirdCoderEngineAccessPlan.fromJson(Map<String, dynamic> json) {
    return BirdCoderEngineAccessPlan(
      primaryLaneId: (() {
        final value = json['primaryLaneId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineAccessPlan.primaryLaneId is required');
        }
        return value;
      })(),
      fallbackLaneIds: (() {
        final list = _sdkworkAsList(json['fallbackLaneIds']);
        if (list == null) {
          throw FormatException('BirdCoderEngineAccessPlan.fallbackLaneIds is required');
        }
        return list
            .map((item) => item?.toString())
            .whereType<String>()
            .toList();
      })(),
      lanes: (() {
        final list = _sdkworkAsList(json['lanes']);
        if (list == null) {
          throw FormatException('BirdCoderEngineAccessPlan.lanes is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderEngineAccessLane.fromJson(map);
      })())
            .whereType<BirdCoderEngineAccessLane>()
            .toList();
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'primaryLaneId': primaryLaneId,
      'fallbackLaneIds': fallbackLaneIds.map((item) => item).toList(),
      'lanes': lanes.map((item) => item.toJson()).toList(),
    };
  }
}

class BirdCoderEngineCapabilityMatrix {
  final bool chat;
  final bool streaming;
  final bool structuredOutput;
  final bool toolCalls;
  final bool planning;
  final bool patchArtifacts;
  final bool commandArtifacts;
  final bool todoArtifacts;
  final bool ptyArtifacts;
  final bool previewArtifacts;
  final bool testArtifacts;
  final bool approvalCheckpoints;
  final bool sessionResume;
  final bool remoteBridge;
  final bool mcp;

  BirdCoderEngineCapabilityMatrix({
    required this.chat,
    required this.streaming,
    required this.structuredOutput,
    required this.toolCalls,
    required this.planning,
    required this.patchArtifacts,
    required this.commandArtifacts,
    required this.todoArtifacts,
    required this.ptyArtifacts,
    required this.previewArtifacts,
    required this.testArtifacts,
    required this.approvalCheckpoints,
    required this.sessionResume,
    required this.remoteBridge,
    required this.mcp
  });

  factory BirdCoderEngineCapabilityMatrix.fromJson(Map<String, dynamic> json) {
    return BirdCoderEngineCapabilityMatrix(
      chat: (() {
        final value = json['chat'];
        if (value is! bool) {
          throw FormatException('BirdCoderEngineCapabilityMatrix.chat is required');
        }
        return value;
      })(),
      streaming: (() {
        final value = json['streaming'];
        if (value is! bool) {
          throw FormatException('BirdCoderEngineCapabilityMatrix.streaming is required');
        }
        return value;
      })(),
      structuredOutput: (() {
        final value = json['structuredOutput'];
        if (value is! bool) {
          throw FormatException('BirdCoderEngineCapabilityMatrix.structuredOutput is required');
        }
        return value;
      })(),
      toolCalls: (() {
        final value = json['toolCalls'];
        if (value is! bool) {
          throw FormatException('BirdCoderEngineCapabilityMatrix.toolCalls is required');
        }
        return value;
      })(),
      planning: (() {
        final value = json['planning'];
        if (value is! bool) {
          throw FormatException('BirdCoderEngineCapabilityMatrix.planning is required');
        }
        return value;
      })(),
      patchArtifacts: (() {
        final value = json['patchArtifacts'];
        if (value is! bool) {
          throw FormatException('BirdCoderEngineCapabilityMatrix.patchArtifacts is required');
        }
        return value;
      })(),
      commandArtifacts: (() {
        final value = json['commandArtifacts'];
        if (value is! bool) {
          throw FormatException('BirdCoderEngineCapabilityMatrix.commandArtifacts is required');
        }
        return value;
      })(),
      todoArtifacts: (() {
        final value = json['todoArtifacts'];
        if (value is! bool) {
          throw FormatException('BirdCoderEngineCapabilityMatrix.todoArtifacts is required');
        }
        return value;
      })(),
      ptyArtifacts: (() {
        final value = json['ptyArtifacts'];
        if (value is! bool) {
          throw FormatException('BirdCoderEngineCapabilityMatrix.ptyArtifacts is required');
        }
        return value;
      })(),
      previewArtifacts: (() {
        final value = json['previewArtifacts'];
        if (value is! bool) {
          throw FormatException('BirdCoderEngineCapabilityMatrix.previewArtifacts is required');
        }
        return value;
      })(),
      testArtifacts: (() {
        final value = json['testArtifacts'];
        if (value is! bool) {
          throw FormatException('BirdCoderEngineCapabilityMatrix.testArtifacts is required');
        }
        return value;
      })(),
      approvalCheckpoints: (() {
        final value = json['approvalCheckpoints'];
        if (value is! bool) {
          throw FormatException('BirdCoderEngineCapabilityMatrix.approvalCheckpoints is required');
        }
        return value;
      })(),
      sessionResume: (() {
        final value = json['sessionResume'];
        if (value is! bool) {
          throw FormatException('BirdCoderEngineCapabilityMatrix.sessionResume is required');
        }
        return value;
      })(),
      remoteBridge: (() {
        final value = json['remoteBridge'];
        if (value is! bool) {
          throw FormatException('BirdCoderEngineCapabilityMatrix.remoteBridge is required');
        }
        return value;
      })(),
      mcp: (() {
        final value = json['mcp'];
        if (value is! bool) {
          throw FormatException('BirdCoderEngineCapabilityMatrix.mcp is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'chat': chat,
      'streaming': streaming,
      'structuredOutput': structuredOutput,
      'toolCalls': toolCalls,
      'planning': planning,
      'patchArtifacts': patchArtifacts,
      'commandArtifacts': commandArtifacts,
      'todoArtifacts': todoArtifacts,
      'ptyArtifacts': ptyArtifacts,
      'previewArtifacts': previewArtifacts,
      'testArtifacts': testArtifacts,
      'approvalCheckpoints': approvalCheckpoints,
      'sessionResume': sessionResume,
      'remoteBridge': remoteBridge,
      'mcp': mcp,
    };
  }
}

class BirdCoderEngineCapabilityMatrixEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderEngineCapabilityMatrixEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderEngineCapabilityMatrixEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderEngineCapabilityMatrixEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderEngineCapabilityMatrixEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderEngineCapabilityMatrixEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineCapabilityMatrixEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderEngineDescriptor {
  final String id;
  final String uuid;
  final String? tenantId;
  final String? organizationId;
  final String createdAt;
  final String updatedAt;
  final String engineKey;
  final String displayName;
  final String vendor;
  final String installationKind;
  final String defaultModelId;
  final String? homepage;
  final List<String> supportedHostModes;
  final List<String> transportKinds;
  final BirdCoderEngineCapabilityMatrix capabilityMatrix;
  final String status;
  final BirdCoderEngineAccessPlan? accessPlan;
  final BirdCoderEngineOfficialIntegration? officialIntegration;

  BirdCoderEngineDescriptor({
    required this.id,
    required this.uuid,
    this.tenantId,
    this.organizationId,
    required this.createdAt,
    required this.updatedAt,
    required this.engineKey,
    required this.displayName,
    required this.vendor,
    required this.installationKind,
    required this.defaultModelId,
    this.homepage,
    required this.supportedHostModes,
    required this.transportKinds,
    required this.capabilityMatrix,
    required this.status,
    this.accessPlan,
    this.officialIntegration
  });

  factory BirdCoderEngineDescriptor.fromJson(Map<String, dynamic> json) {
    return BirdCoderEngineDescriptor(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineDescriptor.id is required');
        }
        return value;
      })(),
      uuid: (() {
        final value = json['uuid']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineDescriptor.uuid is required');
        }
        return value;
      })(),
      tenantId: json['tenantId']?.toString(),
      organizationId: json['organizationId']?.toString(),
      createdAt: (() {
        final value = json['createdAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineDescriptor.createdAt is required');
        }
        return value;
      })(),
      updatedAt: (() {
        final value = json['updatedAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineDescriptor.updatedAt is required');
        }
        return value;
      })(),
      engineKey: (() {
        final value = json['engineKey']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineDescriptor.engineKey is required');
        }
        return value;
      })(),
      displayName: (() {
        final value = json['displayName']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineDescriptor.displayName is required');
        }
        return value;
      })(),
      vendor: (() {
        final value = json['vendor']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineDescriptor.vendor is required');
        }
        return value;
      })(),
      installationKind: (() {
        final value = json['installationKind']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineDescriptor.installationKind is required');
        }
        return value;
      })(),
      defaultModelId: (() {
        final value = json['defaultModelId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineDescriptor.defaultModelId is required');
        }
        return value;
      })(),
      homepage: json['homepage']?.toString(),
      supportedHostModes: (() {
        final list = _sdkworkAsList(json['supportedHostModes']);
        if (list == null) {
          throw FormatException('BirdCoderEngineDescriptor.supportedHostModes is required');
        }
        return list
            .map((item) => item?.toString())
            .whereType<String>()
            .toList();
      })(),
      transportKinds: (() {
        final list = _sdkworkAsList(json['transportKinds']);
        if (list == null) {
          throw FormatException('BirdCoderEngineDescriptor.transportKinds is required');
        }
        return list
            .map((item) => item?.toString())
            .whereType<String>()
            .toList();
      })(),
      capabilityMatrix: (() {
        final map = _sdkworkAsMap(json['capabilityMatrix']);
        if (map == null) {
          throw FormatException('BirdCoderEngineDescriptor.capabilityMatrix is required');
        }
        return BirdCoderEngineCapabilityMatrix.fromJson(map);
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineDescriptor.status is required');
        }
        return value;
      })(),
      accessPlan: (() {
        final map = _sdkworkAsMap(json['accessPlan']);
        return map == null ? null : BirdCoderEngineAccessPlan.fromJson(map);
      })(),
      officialIntegration: (() {
        final map = _sdkworkAsMap(json['officialIntegration']);
        return map == null ? null : BirdCoderEngineOfficialIntegration.fromJson(map);
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
      'engineKey': engineKey,
      'displayName': displayName,
      'vendor': vendor,
      'installationKind': installationKind,
      'defaultModelId': defaultModelId,
      'homepage': homepage,
      'supportedHostModes': supportedHostModes.map((item) => item).toList(),
      'transportKinds': transportKinds.map((item) => item).toList(),
      'capabilityMatrix': capabilityMatrix.toJson(),
      'status': status,
      'accessPlan': accessPlan?.toJson(),
      'officialIntegration': officialIntegration?.toJson(),
    };
  }
}

class BirdCoderEngineDescriptorListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderEngineDescriptorListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderEngineDescriptorListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderEngineDescriptorListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderEngineDescriptorListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderEngineDescriptorListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineDescriptorListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderEngineOfficialEntry {
  final String packageName;
  final String? packageVersion;
  final String? sdkPath;
  final String? cliPackageName;
  final String? sourceMirrorPath;
  final List<String>? supplementalLanes;

  BirdCoderEngineOfficialEntry({
    required this.packageName,
    this.packageVersion,
    this.sdkPath,
    this.cliPackageName,
    this.sourceMirrorPath,
    this.supplementalLanes
  });

  factory BirdCoderEngineOfficialEntry.fromJson(Map<String, dynamic> json) {
    return BirdCoderEngineOfficialEntry(
      packageName: (() {
        final value = json['packageName']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineOfficialEntry.packageName is required');
        }
        return value;
      })(),
      packageVersion: json['packageVersion']?.toString(),
      sdkPath: json['sdkPath']?.toString(),
      cliPackageName: json['cliPackageName']?.toString(),
      sourceMirrorPath: json['sourceMirrorPath']?.toString(),
      supplementalLanes: (() {
        final list = _sdkworkAsList(json['supplementalLanes']);
        if (list == null) {
          return null;
        }
        return list
            .map((item) => item?.toString())
            .whereType<String>()
            .toList();
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'packageName': packageName,
      'packageVersion': packageVersion,
      'sdkPath': sdkPath,
      'cliPackageName': cliPackageName,
      'sourceMirrorPath': sourceMirrorPath,
      'supplementalLanes': supplementalLanes?.map((item) => item).toList(),
    };
  }
}

class BirdCoderEngineOfficialIntegration {
  final String integrationClass;
  final String runtimeMode;
  final BirdCoderEngineOfficialEntry officialEntry;
  final String? notes;

  BirdCoderEngineOfficialIntegration({
    required this.integrationClass,
    required this.runtimeMode,
    required this.officialEntry,
    this.notes
  });

  factory BirdCoderEngineOfficialIntegration.fromJson(Map<String, dynamic> json) {
    return BirdCoderEngineOfficialIntegration(
      integrationClass: (() {
        final value = json['integrationClass']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineOfficialIntegration.integrationClass is required');
        }
        return value;
      })(),
      runtimeMode: (() {
        final value = json['runtimeMode']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderEngineOfficialIntegration.runtimeMode is required');
        }
        return value;
      })(),
      officialEntry: (() {
        final map = _sdkworkAsMap(json['officialEntry']);
        if (map == null) {
          throw FormatException('BirdCoderEngineOfficialIntegration.officialEntry is required');
        }
        return BirdCoderEngineOfficialEntry.fromJson(map);
      })(),
      notes: json['notes']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'integrationClass': integrationClass,
      'runtimeMode': runtimeMode,
      'officialEntry': officialEntry.toJson(),
      'notes': notes,
    };
  }
}

class BirdCoderForkCodingSessionRequest {
  final String? title;

  BirdCoderForkCodingSessionRequest({
    this.title
  });

  factory BirdCoderForkCodingSessionRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderForkCodingSessionRequest(
      title: json['title']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'title': title,
    };
  }
}

class BirdCoderGitBranchSummary {
  final int ahead;
  final int behind;
  final bool isCurrent;
  final String kind;
  final String name;
  final String? upstreamName;

  BirdCoderGitBranchSummary({
    required this.ahead,
    required this.behind,
    required this.isCurrent,
    required this.kind,
    required this.name,
    this.upstreamName
  });

  factory BirdCoderGitBranchSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderGitBranchSummary(
      ahead: (() {
        final value = json['ahead'];
        if (value is! int) {
          throw FormatException('BirdCoderGitBranchSummary.ahead is required');
        }
        return value;
      })(),
      behind: (() {
        final value = json['behind'];
        if (value is! int) {
          throw FormatException('BirdCoderGitBranchSummary.behind is required');
        }
        return value;
      })(),
      isCurrent: (() {
        final value = json['isCurrent'];
        if (value is! bool) {
          throw FormatException('BirdCoderGitBranchSummary.isCurrent is required');
        }
        return value;
      })(),
      kind: (() {
        final value = json['kind']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderGitBranchSummary.kind is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderGitBranchSummary.name is required');
        }
        return value;
      })(),
      upstreamName: json['upstreamName']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'ahead': ahead,
      'behind': behind,
      'isCurrent': isCurrent,
      'kind': kind,
      'name': name,
      'upstreamName': upstreamName,
    };
  }
}

class BirdCoderGitStatusCounts {
  final int conflicted;
  final int deleted;
  final int modified;
  final int staged;
  final int untracked;

  BirdCoderGitStatusCounts({
    required this.conflicted,
    required this.deleted,
    required this.modified,
    required this.staged,
    required this.untracked
  });

  factory BirdCoderGitStatusCounts.fromJson(Map<String, dynamic> json) {
    return BirdCoderGitStatusCounts(
      conflicted: (() {
        final value = json['conflicted'];
        if (value is! int) {
          throw FormatException('BirdCoderGitStatusCounts.conflicted is required');
        }
        return value;
      })(),
      deleted: (() {
        final value = json['deleted'];
        if (value is! int) {
          throw FormatException('BirdCoderGitStatusCounts.deleted is required');
        }
        return value;
      })(),
      modified: (() {
        final value = json['modified'];
        if (value is! int) {
          throw FormatException('BirdCoderGitStatusCounts.modified is required');
        }
        return value;
      })(),
      staged: (() {
        final value = json['staged'];
        if (value is! int) {
          throw FormatException('BirdCoderGitStatusCounts.staged is required');
        }
        return value;
      })(),
      untracked: (() {
        final value = json['untracked'];
        if (value is! int) {
          throw FormatException('BirdCoderGitStatusCounts.untracked is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'conflicted': conflicted,
      'deleted': deleted,
      'modified': modified,
      'staged': staged,
      'untracked': untracked,
    };
  }
}

class BirdCoderGitWorktreeSummary {
  final String? branch;
  final String? head;
  final String id;
  final bool isCurrent;
  final bool isDetached;
  final bool isLocked;
  final bool isPrunable;
  final String label;
  final String? lockedReason;
  final String? prunableReason;
  final String path;

  BirdCoderGitWorktreeSummary({
    this.branch,
    this.head,
    required this.id,
    required this.isCurrent,
    required this.isDetached,
    required this.isLocked,
    required this.isPrunable,
    required this.label,
    this.lockedReason,
    this.prunableReason,
    required this.path
  });

  factory BirdCoderGitWorktreeSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderGitWorktreeSummary(
      branch: json['branch']?.toString(),
      head: json['head']?.toString(),
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderGitWorktreeSummary.id is required');
        }
        return value;
      })(),
      isCurrent: (() {
        final value = json['isCurrent'];
        if (value is! bool) {
          throw FormatException('BirdCoderGitWorktreeSummary.isCurrent is required');
        }
        return value;
      })(),
      isDetached: (() {
        final value = json['isDetached'];
        if (value is! bool) {
          throw FormatException('BirdCoderGitWorktreeSummary.isDetached is required');
        }
        return value;
      })(),
      isLocked: (() {
        final value = json['isLocked'];
        if (value is! bool) {
          throw FormatException('BirdCoderGitWorktreeSummary.isLocked is required');
        }
        return value;
      })(),
      isPrunable: (() {
        final value = json['isPrunable'];
        if (value is! bool) {
          throw FormatException('BirdCoderGitWorktreeSummary.isPrunable is required');
        }
        return value;
      })(),
      label: (() {
        final value = json['label']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderGitWorktreeSummary.label is required');
        }
        return value;
      })(),
      lockedReason: json['lockedReason']?.toString(),
      prunableReason: json['prunableReason']?.toString(),
      path: (() {
        final value = json['path']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderGitWorktreeSummary.path is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'branch': branch,
      'head': head,
      'id': id,
      'isCurrent': isCurrent,
      'isDetached': isDetached,
      'isLocked': isLocked,
      'isPrunable': isPrunable,
      'label': label,
      'lockedReason': lockedReason,
      'prunableReason': prunableReason,
      'path': path,
    };
  }
}

class BirdCoderIamCreateSessionRequest {
  final String? account;
  final String? appVersion;
  final String? code;
  final String? deviceId;
  final String? deviceName;
  final String? deviceType;
  final String? email;
  final String? grantType;
  final String? loginMethod;
  final String? password;
  final String? phone;
  final String? username;

  BirdCoderIamCreateSessionRequest({
    this.account,
    this.appVersion,
    this.code,
    this.deviceId,
    this.deviceName,
    this.deviceType,
    this.email,
    this.grantType,
    this.loginMethod,
    this.password,
    this.phone,
    this.username
  });

  factory BirdCoderIamCreateSessionRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamCreateSessionRequest(
      account: json['account']?.toString(),
      appVersion: json['appVersion']?.toString(),
      code: json['code']?.toString(),
      deviceId: json['deviceId']?.toString(),
      deviceName: json['deviceName']?.toString(),
      deviceType: json['deviceType']?.toString(),
      email: json['email']?.toString(),
      grantType: json['grantType']?.toString(),
      loginMethod: json['loginMethod']?.toString(),
      password: json['password']?.toString(),
      phone: json['phone']?.toString(),
      username: json['username']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'account': account,
      'appVersion': appVersion,
      'code': code,
      'deviceId': deviceId,
      'deviceName': deviceName,
      'deviceType': deviceType,
      'email': email,
      'grantType': grantType,
      'loginMethod': loginMethod,
      'password': password,
      'phone': phone,
      'username': username,
    };
  }
}

class BirdCoderIamDeviceAuthorizationCreateRequest {
  final String purpose;
  final String? redirectUri;

  BirdCoderIamDeviceAuthorizationCreateRequest({
    required this.purpose,
    this.redirectUri
  });

  factory BirdCoderIamDeviceAuthorizationCreateRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamDeviceAuthorizationCreateRequest(
      purpose: (() {
        final value = json['purpose']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamDeviceAuthorizationCreateRequest.purpose is required');
        }
        return value;
      })(),
      redirectUri: json['redirectUri']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'purpose': purpose,
      'redirectUri': redirectUri,
    };
  }
}

class BirdCoderIamDeviceAuthorizationEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderIamDeviceAuthorizationEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderIamDeviceAuthorizationEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamDeviceAuthorizationEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderIamDeviceAuthorizationEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderIamDeviceAuthorizationEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamDeviceAuthorizationEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderIamDeviceAuthorizationPasswordCompletionRequest {
  final String password;
  final String username;

  BirdCoderIamDeviceAuthorizationPasswordCompletionRequest({
    required this.password,
    required this.username
  });

  factory BirdCoderIamDeviceAuthorizationPasswordCompletionRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamDeviceAuthorizationPasswordCompletionRequest(
      password: (() {
        final value = json['password']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamDeviceAuthorizationPasswordCompletionRequest.password is required');
        }
        return value;
      })(),
      username: (() {
        final value = json['username']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamDeviceAuthorizationPasswordCompletionRequest.username is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'password': password,
      'username': username,
    };
  }
}

class BirdCoderIamDeviceAuthorizationScanRequest {
  final String? scanSource;

  BirdCoderIamDeviceAuthorizationScanRequest({
    this.scanSource
  });

  factory BirdCoderIamDeviceAuthorizationScanRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamDeviceAuthorizationScanRequest(
      scanSource: json['scanSource']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'scanSource': scanSource,
    };
  }
}

class BirdCoderIamDeviceAuthorizationSessionExchangeRequest {
  final String pollSecret;

  BirdCoderIamDeviceAuthorizationSessionExchangeRequest({
    required this.pollSecret
  });

  factory BirdCoderIamDeviceAuthorizationSessionExchangeRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamDeviceAuthorizationSessionExchangeRequest(
      pollSecret: (() {
        final value = json['pollSecret']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamDeviceAuthorizationSessionExchangeRequest.pollSecret is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'pollSecret': pollSecret,
    };
  }
}

class BirdCoderIamDeviceAuthorizationSummary {
  final String deviceAuthorizationId;
  final String? expiresAt;
  final String? pollSecret;
  final String? qrContent;
  final String? qrUrl;
  final bool? sessionReady;
  final String status;

  BirdCoderIamDeviceAuthorizationSummary({
    required this.deviceAuthorizationId,
    this.expiresAt,
    this.pollSecret,
    this.qrContent,
    this.qrUrl,
    this.sessionReady,
    required this.status
  });

  factory BirdCoderIamDeviceAuthorizationSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamDeviceAuthorizationSummary(
      deviceAuthorizationId: (() {
        final value = json['deviceAuthorizationId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamDeviceAuthorizationSummary.deviceAuthorizationId is required');
        }
        return value;
      })(),
      expiresAt: json['expiresAt']?.toString(),
      pollSecret: json['pollSecret']?.toString(),
      qrContent: json['qrContent']?.toString(),
      qrUrl: json['qrUrl']?.toString(),
      sessionReady: json['sessionReady'] is bool ? json['sessionReady'] : null,
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamDeviceAuthorizationSummary.status is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'deviceAuthorizationId': deviceAuthorizationId,
      'expiresAt': expiresAt,
      'pollSecret': pollSecret,
      'qrContent': qrContent,
      'qrUrl': qrUrl,
      'sessionReady': sessionReady,
      'status': status,
    };
  }
}

class BirdCoderIamOAuthAuthorizationCreateRequest {
  final String provider;
  final String redirectUri;
  final String? scope;
  final String? state;

  BirdCoderIamOAuthAuthorizationCreateRequest({
    required this.provider,
    required this.redirectUri,
    this.scope,
    this.state
  });

  factory BirdCoderIamOAuthAuthorizationCreateRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamOAuthAuthorizationCreateRequest(
      provider: (() {
        final value = json['provider']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOAuthAuthorizationCreateRequest.provider is required');
        }
        return value;
      })(),
      redirectUri: (() {
        final value = json['redirectUri']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOAuthAuthorizationCreateRequest.redirectUri is required');
        }
        return value;
      })(),
      scope: json['scope']?.toString(),
      state: json['state']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'provider': provider,
      'redirectUri': redirectUri,
      'scope': scope,
      'state': state,
    };
  }
}

class BirdCoderIamOAuthAuthorizationEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderIamOAuthAuthorizationEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderIamOAuthAuthorizationEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamOAuthAuthorizationEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderIamOAuthAuthorizationEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderIamOAuthAuthorizationEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOAuthAuthorizationEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderIamOAuthAuthorizationSummary {
  final String authUrl;

  BirdCoderIamOAuthAuthorizationSummary({
    required this.authUrl
  });

  factory BirdCoderIamOAuthAuthorizationSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamOAuthAuthorizationSummary(
      authUrl: (() {
        final value = json['authUrl']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOAuthAuthorizationSummary.authUrl is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'authUrl': authUrl,
    };
  }
}

class BirdCoderIamOAuthSessionCreateRequest {
  final String code;
  final String? deviceId;
  final String? deviceType;
  final String provider;
  final String? state;

  BirdCoderIamOAuthSessionCreateRequest({
    required this.code,
    this.deviceId,
    this.deviceType,
    required this.provider,
    this.state
  });

  factory BirdCoderIamOAuthSessionCreateRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamOAuthSessionCreateRequest(
      code: (() {
        final value = json['code']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOAuthSessionCreateRequest.code is required');
        }
        return value;
      })(),
      deviceId: json['deviceId']?.toString(),
      deviceType: json['deviceType']?.toString(),
      provider: (() {
        final value = json['provider']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOAuthSessionCreateRequest.provider is required');
        }
        return value;
      })(),
      state: json['state']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'deviceId': deviceId,
      'deviceType': deviceType,
      'provider': provider,
      'state': state,
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

class BirdCoderIamOrganizationMemberSummaryListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderIamOrganizationMemberSummaryListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderIamOrganizationMemberSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamOrganizationMemberSummaryListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderIamOrganizationMemberSummaryListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderIamOrganizationMemberSummaryListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOrganizationMemberSummaryListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
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

class BirdCoderIamOrganizationSummaryListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderIamOrganizationSummaryListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderIamOrganizationSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamOrganizationSummaryListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderIamOrganizationSummaryListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderIamOrganizationSummaryListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamOrganizationSummaryListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderIamPasswordResetCreateRequest {
  final String account;
  final String code;
  final String? confirmPassword;
  final String newPassword;

  BirdCoderIamPasswordResetCreateRequest({
    required this.account,
    required this.code,
    this.confirmPassword,
    required this.newPassword
  });

  factory BirdCoderIamPasswordResetCreateRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamPasswordResetCreateRequest(
      account: (() {
        final value = json['account']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamPasswordResetCreateRequest.account is required');
        }
        return value;
      })(),
      code: (() {
        final value = json['code']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamPasswordResetCreateRequest.code is required');
        }
        return value;
      })(),
      confirmPassword: json['confirmPassword']?.toString(),
      newPassword: (() {
        final value = json['newPassword']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamPasswordResetCreateRequest.newPassword is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'account': account,
      'code': code,
      'confirmPassword': confirmPassword,
      'newPassword': newPassword,
    };
  }
}

class BirdCoderIamPasswordResetRequestCreateRequest {
  final String account;
  final String channel;

  BirdCoderIamPasswordResetRequestCreateRequest({
    required this.account,
    required this.channel
  });

  factory BirdCoderIamPasswordResetRequestCreateRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamPasswordResetRequestCreateRequest(
      account: (() {
        final value = json['account']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamPasswordResetRequestCreateRequest.account is required');
        }
        return value;
      })(),
      channel: (() {
        final value = json['channel']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamPasswordResetRequestCreateRequest.channel is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'account': account,
      'channel': channel,
    };
  }
}

class BirdCoderIamRefreshSessionRequest {
  final String refreshToken;

  BirdCoderIamRefreshSessionRequest({
    required this.refreshToken
  });

  factory BirdCoderIamRefreshSessionRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamRefreshSessionRequest(
      refreshToken: (() {
        final value = json['refreshToken']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamRefreshSessionRequest.refreshToken is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'refreshToken': refreshToken,
    };
  }
}

class BirdCoderIamRegistrationCreateRequest {
  final String? channel;
  final String? confirmPassword;
  final String? email;
  final String? name;
  final String? password;
  final String? phone;
  final String? username;
  final String? verificationCode;

  BirdCoderIamRegistrationCreateRequest({
    this.channel,
    this.confirmPassword,
    this.email,
    this.name,
    this.password,
    this.phone,
    this.username,
    this.verificationCode
  });

  factory BirdCoderIamRegistrationCreateRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamRegistrationCreateRequest(
      channel: json['channel']?.toString(),
      confirmPassword: json['confirmPassword']?.toString(),
      email: json['email']?.toString(),
      name: json['name']?.toString(),
      password: json['password']?.toString(),
      phone: json['phone']?.toString(),
      username: json['username']?.toString(),
      verificationCode: json['verificationCode']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'channel': channel,
      'confirmPassword': confirmPassword,
      'email': email,
      'name': name,
      'password': password,
      'phone': phone,
      'username': username,
      'verificationCode': verificationCode,
    };
  }
}

class BirdCoderIamRuntimeSettingsEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderIamRuntimeSettingsEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderIamRuntimeSettingsEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamRuntimeSettingsEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderIamRuntimeSettingsEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderIamRuntimeSettingsEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamRuntimeSettingsEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderIamRuntimeSettingsSummary {
  final String leftRailMode;
  final List<String> loginMethods;
  final bool oauthLoginEnabled;
  final List<String> oauthProviders;
  final bool qrLoginEnabled;
  final String qrLoginType;
  final List<String> recoveryMethods;
  final List<String> registerMethods;
  final BirdCoderIamVerificationPolicySummary verificationPolicy;

  BirdCoderIamRuntimeSettingsSummary({
    required this.leftRailMode,
    required this.loginMethods,
    required this.oauthLoginEnabled,
    required this.oauthProviders,
    required this.qrLoginEnabled,
    required this.qrLoginType,
    required this.recoveryMethods,
    required this.registerMethods,
    required this.verificationPolicy
  });

  factory BirdCoderIamRuntimeSettingsSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamRuntimeSettingsSummary(
      leftRailMode: (() {
        final value = json['leftRailMode']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamRuntimeSettingsSummary.leftRailMode is required');
        }
        return value;
      })(),
      loginMethods: (() {
        final list = _sdkworkAsList(json['loginMethods']);
        if (list == null) {
          throw FormatException('BirdCoderIamRuntimeSettingsSummary.loginMethods is required');
        }
        return list
            .map((item) => item?.toString())
            .whereType<String>()
            .toList();
      })(),
      oauthLoginEnabled: (() {
        final value = json['oauthLoginEnabled'];
        if (value is! bool) {
          throw FormatException('BirdCoderIamRuntimeSettingsSummary.oauthLoginEnabled is required');
        }
        return value;
      })(),
      oauthProviders: (() {
        final list = _sdkworkAsList(json['oauthProviders']);
        if (list == null) {
          throw FormatException('BirdCoderIamRuntimeSettingsSummary.oauthProviders is required');
        }
        return list
            .map((item) => item?.toString())
            .whereType<String>()
            .toList();
      })(),
      qrLoginEnabled: (() {
        final value = json['qrLoginEnabled'];
        if (value is! bool) {
          throw FormatException('BirdCoderIamRuntimeSettingsSummary.qrLoginEnabled is required');
        }
        return value;
      })(),
      qrLoginType: (() {
        final value = json['qrLoginType']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamRuntimeSettingsSummary.qrLoginType is required');
        }
        return value;
      })(),
      recoveryMethods: (() {
        final list = _sdkworkAsList(json['recoveryMethods']);
        if (list == null) {
          throw FormatException('BirdCoderIamRuntimeSettingsSummary.recoveryMethods is required');
        }
        return list
            .map((item) => item?.toString())
            .whereType<String>()
            .toList();
      })(),
      registerMethods: (() {
        final list = _sdkworkAsList(json['registerMethods']);
        if (list == null) {
          throw FormatException('BirdCoderIamRuntimeSettingsSummary.registerMethods is required');
        }
        return list
            .map((item) => item?.toString())
            .whereType<String>()
            .toList();
      })(),
      verificationPolicy: (() {
        final map = _sdkworkAsMap(json['verificationPolicy']);
        if (map == null) {
          throw FormatException('BirdCoderIamRuntimeSettingsSummary.verificationPolicy is required');
        }
        return BirdCoderIamVerificationPolicySummary.fromJson(map);
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'leftRailMode': leftRailMode,
      'loginMethods': loginMethods.map((item) => item).toList(),
      'oauthLoginEnabled': oauthLoginEnabled,
      'oauthProviders': oauthProviders.map((item) => item).toList(),
      'qrLoginEnabled': qrLoginEnabled,
      'qrLoginType': qrLoginType,
      'recoveryMethods': recoveryMethods.map((item) => item).toList(),
      'registerMethods': registerMethods.map((item) => item).toList(),
      'verificationPolicy': verificationPolicy.toJson(),
    };
  }
}

class BirdCoderIamSessionEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderIamSessionEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderIamSessionEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamSessionEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderIamSessionEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderIamSessionEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamSessionEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderIamSessionSummary {
  final String accessToken;
  final String authToken;
  final Map<String, dynamic>? context;
  final String? expiresAt;
  final String? refreshToken;
  final String? sessionId;
  final BirdCoderAuthenticatedUserSummary? user;

  BirdCoderIamSessionSummary({
    required this.accessToken,
    required this.authToken,
    this.context,
    this.expiresAt,
    this.refreshToken,
    this.sessionId,
    this.user
  });

  factory BirdCoderIamSessionSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamSessionSummary(
      accessToken: (() {
        final value = json['accessToken']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamSessionSummary.accessToken is required');
        }
        return value;
      })(),
      authToken: (() {
        final value = json['authToken']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamSessionSummary.authToken is required');
        }
        return value;
      })(),
      context: _sdkworkAsMap(json['context']),
      expiresAt: json['expiresAt']?.toString(),
      refreshToken: json['refreshToken']?.toString(),
      sessionId: json['sessionId']?.toString(),
      user: (() {
        final map = _sdkworkAsMap(json['user']);
        return map == null ? null : BirdCoderAuthenticatedUserSummary.fromJson(map);
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'accessToken': accessToken,
      'authToken': authToken,
      'context': context,
      'expiresAt': expiresAt,
      'refreshToken': refreshToken,
      'sessionId': sessionId,
      'user': user?.toJson(),
    };
  }
}

class BirdCoderIamUpdateCurrentSessionRequest {
  final String? deviceId;
  final String? deviceName;
  final bool? trusted;

  BirdCoderIamUpdateCurrentSessionRequest({
    this.deviceId,
    this.deviceName,
    this.trusted
  });

  factory BirdCoderIamUpdateCurrentSessionRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamUpdateCurrentSessionRequest(
      deviceId: json['deviceId']?.toString(),
      deviceName: json['deviceName']?.toString(),
      trusted: json['trusted'] is bool ? json['trusted'] : null
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'deviceId': deviceId,
      'deviceName': deviceName,
      'trusted': trusted,
    };
  }
}

class BirdCoderIamUserProfileEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderIamUserProfileEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderIamUserProfileEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamUserProfileEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderIamUserProfileEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderIamUserProfileEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserProfileEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderIamUserProfileSummary {
  final String uuid;
  final String? tenantId;
  final String? organizationId;
  final String createdAt;
  final String updatedAt;
  final String? avatarUrl;
  final String bio;
  final String company;
  final String displayName;
  final String email;
  final String userId;
  final String location;
  final String website;

  BirdCoderIamUserProfileSummary({
    required this.uuid,
    this.tenantId,
    this.organizationId,
    required this.createdAt,
    required this.updatedAt,
    this.avatarUrl,
    required this.bio,
    required this.company,
    required this.displayName,
    required this.email,
    required this.userId,
    required this.location,
    required this.website
  });

  factory BirdCoderIamUserProfileSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamUserProfileSummary(
      uuid: (() {
        final value = json['uuid']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserProfileSummary.uuid is required');
        }
        return value;
      })(),
      tenantId: json['tenantId']?.toString(),
      organizationId: json['organizationId']?.toString(),
      createdAt: (() {
        final value = json['createdAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserProfileSummary.createdAt is required');
        }
        return value;
      })(),
      updatedAt: (() {
        final value = json['updatedAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserProfileSummary.updatedAt is required');
        }
        return value;
      })(),
      avatarUrl: json['avatarUrl']?.toString(),
      bio: (() {
        final value = json['bio']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserProfileSummary.bio is required');
        }
        return value;
      })(),
      company: (() {
        final value = json['company']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserProfileSummary.company is required');
        }
        return value;
      })(),
      displayName: (() {
        final value = json['displayName']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserProfileSummary.displayName is required');
        }
        return value;
      })(),
      email: (() {
        final value = json['email']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserProfileSummary.email is required');
        }
        return value;
      })(),
      userId: (() {
        final value = json['userId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserProfileSummary.userId is required');
        }
        return value;
      })(),
      location: (() {
        final value = json['location']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserProfileSummary.location is required');
        }
        return value;
      })(),
      website: (() {
        final value = json['website']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserProfileSummary.website is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'uuid': uuid,
      'tenantId': tenantId,
      'organizationId': organizationId,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
      'avatarUrl': avatarUrl,
      'bio': bio,
      'company': company,
      'displayName': displayName,
      'email': email,
      'userId': userId,
      'location': location,
      'website': website,
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

class BirdCoderIamUserRoleSummaryListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderIamUserRoleSummaryListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderIamUserRoleSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamUserRoleSummaryListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderIamUserRoleSummaryListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderIamUserRoleSummaryListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamUserRoleSummaryListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderIamVerificationPolicyEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderIamVerificationPolicyEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderIamVerificationPolicyEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamVerificationPolicyEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderIamVerificationPolicyEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderIamVerificationPolicyEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderIamVerificationPolicyEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderIamVerificationPolicySummary {
  final bool emailCodeLoginEnabled;
  final bool emailRegistrationVerificationRequired;
  final bool phoneCodeLoginEnabled;
  final bool phoneRegistrationVerificationRequired;

  BirdCoderIamVerificationPolicySummary({
    required this.emailCodeLoginEnabled,
    required this.emailRegistrationVerificationRequired,
    required this.phoneCodeLoginEnabled,
    required this.phoneRegistrationVerificationRequired
  });

  factory BirdCoderIamVerificationPolicySummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderIamVerificationPolicySummary(
      emailCodeLoginEnabled: (() {
        final value = json['emailCodeLoginEnabled'];
        if (value is! bool) {
          throw FormatException('BirdCoderIamVerificationPolicySummary.emailCodeLoginEnabled is required');
        }
        return value;
      })(),
      emailRegistrationVerificationRequired: (() {
        final value = json['emailRegistrationVerificationRequired'];
        if (value is! bool) {
          throw FormatException('BirdCoderIamVerificationPolicySummary.emailRegistrationVerificationRequired is required');
        }
        return value;
      })(),
      phoneCodeLoginEnabled: (() {
        final value = json['phoneCodeLoginEnabled'];
        if (value is! bool) {
          throw FormatException('BirdCoderIamVerificationPolicySummary.phoneCodeLoginEnabled is required');
        }
        return value;
      })(),
      phoneRegistrationVerificationRequired: (() {
        final value = json['phoneRegistrationVerificationRequired'];
        if (value is! bool) {
          throw FormatException('BirdCoderIamVerificationPolicySummary.phoneRegistrationVerificationRequired is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'emailCodeLoginEnabled': emailCodeLoginEnabled,
      'emailRegistrationVerificationRequired': emailRegistrationVerificationRequired,
      'phoneCodeLoginEnabled': phoneCodeLoginEnabled,
      'phoneRegistrationVerificationRequired': phoneRegistrationVerificationRequired,
    };
  }
}

class BirdCoderInstallSkillPackageRequest {
  final String scopeId;
  final String scopeType;

  BirdCoderInstallSkillPackageRequest({
    required this.scopeId,
    required this.scopeType
  });

  factory BirdCoderInstallSkillPackageRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderInstallSkillPackageRequest(
      scopeId: (() {
        final value = json['scopeId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderInstallSkillPackageRequest.scopeId is required');
        }
        return value;
      })(),
      scopeType: (() {
        final value = json['scopeType']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderInstallSkillPackageRequest.scopeType is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'scopeId': scopeId,
      'scopeType': scopeType,
    };
  }
}

class BirdCoderModelCatalogEntry {
  final String id;
  final String uuid;
  final String? tenantId;
  final String? organizationId;
  final String createdAt;
  final String updatedAt;
  final String engineKey;
  final String modelId;
  final String displayName;
  final String? providerId;
  final String status;
  final bool defaultForEngine;
  final List<String> transportKinds;
  final Map<String, dynamic> capabilityMatrix;

  BirdCoderModelCatalogEntry({
    required this.id,
    required this.uuid,
    this.tenantId,
    this.organizationId,
    required this.createdAt,
    required this.updatedAt,
    required this.engineKey,
    required this.modelId,
    required this.displayName,
    this.providerId,
    required this.status,
    required this.defaultForEngine,
    required this.transportKinds,
    required this.capabilityMatrix
  });

  factory BirdCoderModelCatalogEntry.fromJson(Map<String, dynamic> json) {
    return BirdCoderModelCatalogEntry(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderModelCatalogEntry.id is required');
        }
        return value;
      })(),
      uuid: (() {
        final value = json['uuid']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderModelCatalogEntry.uuid is required');
        }
        return value;
      })(),
      tenantId: json['tenantId']?.toString(),
      organizationId: json['organizationId']?.toString(),
      createdAt: (() {
        final value = json['createdAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderModelCatalogEntry.createdAt is required');
        }
        return value;
      })(),
      updatedAt: (() {
        final value = json['updatedAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderModelCatalogEntry.updatedAt is required');
        }
        return value;
      })(),
      engineKey: (() {
        final value = json['engineKey']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderModelCatalogEntry.engineKey is required');
        }
        return value;
      })(),
      modelId: (() {
        final value = json['modelId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderModelCatalogEntry.modelId is required');
        }
        return value;
      })(),
      displayName: (() {
        final value = json['displayName']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderModelCatalogEntry.displayName is required');
        }
        return value;
      })(),
      providerId: json['providerId']?.toString(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderModelCatalogEntry.status is required');
        }
        return value;
      })(),
      defaultForEngine: (() {
        final value = json['defaultForEngine'];
        if (value is! bool) {
          throw FormatException('BirdCoderModelCatalogEntry.defaultForEngine is required');
        }
        return value;
      })(),
      transportKinds: (() {
        final list = _sdkworkAsList(json['transportKinds']);
        if (list == null) {
          throw FormatException('BirdCoderModelCatalogEntry.transportKinds is required');
        }
        return list
            .map((item) => item?.toString())
            .whereType<String>()
            .toList();
      })(),
      capabilityMatrix: (() {
        final map = _sdkworkAsMap(json['capabilityMatrix']);
        if (map == null) {
          throw FormatException('BirdCoderModelCatalogEntry.capabilityMatrix is required');
        }
        return map;
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
      'engineKey': engineKey,
      'modelId': modelId,
      'displayName': displayName,
      'providerId': providerId,
      'status': status,
      'defaultForEngine': defaultForEngine,
      'transportKinds': transportKinds.map((item) => item).toList(),
      'capabilityMatrix': capabilityMatrix,
    };
  }
}

class BirdCoderModelCatalogEntryListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderModelCatalogEntryListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderModelCatalogEntryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderModelCatalogEntryListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderModelCatalogEntryListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderModelCatalogEntryListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderModelCatalogEntryListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderNativeSessionCommand {
  final String command;
  final String status;
  final String? output;
  final String? kind;
  final String? toolName;
  final String? toolCallId;
  final String? runtimeStatus;
  final bool? requiresApproval;
  final bool? requiresReply;

  BirdCoderNativeSessionCommand({
    required this.command,
    required this.status,
    this.output,
    this.kind,
    this.toolName,
    this.toolCallId,
    this.runtimeStatus,
    this.requiresApproval,
    this.requiresReply
  });

  factory BirdCoderNativeSessionCommand.fromJson(Map<String, dynamic> json) {
    return BirdCoderNativeSessionCommand(
      command: (() {
        final value = json['command']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionCommand.command is required');
        }
        return value;
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionCommand.status is required');
        }
        return value;
      })(),
      output: json['output']?.toString(),
      kind: json['kind']?.toString(),
      toolName: json['toolName']?.toString(),
      toolCallId: json['toolCallId']?.toString(),
      runtimeStatus: json['runtimeStatus']?.toString(),
      requiresApproval: json['requiresApproval'] is bool ? json['requiresApproval'] : null,
      requiresReply: json['requiresReply'] is bool ? json['requiresReply'] : null
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'command': command,
      'status': status,
      'output': output,
      'kind': kind,
      'toolName': toolName,
      'toolCallId': toolCallId,
      'runtimeStatus': runtimeStatus,
      'requiresApproval': requiresApproval,
      'requiresReply': requiresReply,
    };
  }
}

class BirdCoderNativeSessionDetail {
  final BirdCoderNativeSessionSummary summary;
  final List<BirdCoderNativeSessionMessage> messages;

  BirdCoderNativeSessionDetail({
    required this.summary,
    required this.messages
  });

  factory BirdCoderNativeSessionDetail.fromJson(Map<String, dynamic> json) {
    return BirdCoderNativeSessionDetail(
      summary: (() {
        final map = _sdkworkAsMap(json['summary']);
        if (map == null) {
          throw FormatException('BirdCoderNativeSessionDetail.summary is required');
        }
        return BirdCoderNativeSessionSummary.fromJson(map);
      })(),
      messages: (() {
        final list = _sdkworkAsList(json['messages']);
        if (list == null) {
          throw FormatException('BirdCoderNativeSessionDetail.messages is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderNativeSessionMessage.fromJson(map);
      })())
            .whereType<BirdCoderNativeSessionMessage>()
            .toList();
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'summary': summary.toJson(),
      'messages': messages.map((item) => item.toJson()).toList(),
    };
  }
}

class BirdCoderNativeSessionDetailEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderNativeSessionDetailEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderNativeSessionDetailEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderNativeSessionDetailEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderNativeSessionDetailEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderNativeSessionDetailEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionDetailEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderNativeSessionMessage {
  final String id;
  final String codingSessionId;
  final String? turnId;
  final String role;
  final String content;
  final List<BirdCoderNativeSessionCommand>? commands;
  final List<Map<String, dynamic>>? toolCalls;
  final String? toolCallId;
  final List<Map<String, dynamic>>? fileChanges;
  final Map<String, dynamic>? taskProgress;
  final Map<String, String>? metadata;
  final String createdAt;

  BirdCoderNativeSessionMessage({
    required this.id,
    required this.codingSessionId,
    this.turnId,
    required this.role,
    required this.content,
    this.commands,
    this.toolCalls,
    this.toolCallId,
    this.fileChanges,
    this.taskProgress,
    this.metadata,
    required this.createdAt
  });

  factory BirdCoderNativeSessionMessage.fromJson(Map<String, dynamic> json) {
    return BirdCoderNativeSessionMessage(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionMessage.id is required');
        }
        return value;
      })(),
      codingSessionId: (() {
        final value = json['codingSessionId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionMessage.codingSessionId is required');
        }
        return value;
      })(),
      turnId: json['turnId']?.toString(),
      role: (() {
        final value = json['role']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionMessage.role is required');
        }
        return value;
      })(),
      content: (() {
        final value = json['content']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionMessage.content is required');
        }
        return value;
      })(),
      commands: (() {
        final list = _sdkworkAsList(json['commands']);
        if (list == null) {
          return null;
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderNativeSessionCommand.fromJson(map);
      })())
            .whereType<BirdCoderNativeSessionCommand>()
            .toList();
      })(),
      toolCalls: (() {
        final list = _sdkworkAsList(json['tool_calls']);
        if (list == null) {
          return null;
        }
        return list
            .map((item) => _sdkworkAsMap(item))
            .whereType<Map<String, dynamic>>()
            .toList();
      })(),
      toolCallId: json['tool_call_id']?.toString(),
      fileChanges: (() {
        final list = _sdkworkAsList(json['fileChanges']);
        if (list == null) {
          return null;
        }
        return list
            .map((item) => _sdkworkAsMap(item))
            .whereType<Map<String, dynamic>>()
            .toList();
      })(),
      taskProgress: _sdkworkAsMap(json['taskProgress']),
      metadata: (() {
        final map = _sdkworkAsMap(json['metadata']);
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
      })(),
      createdAt: (() {
        final value = json['createdAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionMessage.createdAt is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'codingSessionId': codingSessionId,
      'turnId': turnId,
      'role': role,
      'content': content,
      'commands': commands?.map((item) => item.toJson()).toList(),
      'tool_calls': toolCalls?.map((item) => item).toList(),
      'tool_call_id': toolCallId,
      'fileChanges': fileChanges?.map((item) => item).toList(),
      'taskProgress': taskProgress,
      'metadata': metadata?.map((key, item) => MapEntry(key, item)),
      'createdAt': createdAt,
    };
  }
}

class BirdCoderNativeSessionProviderSummary {
  final String engineId;
  final String displayName;
  final String nativeSessionIdPrefix;
  final List<String> transportKinds;
  final String discoveryMode;

  BirdCoderNativeSessionProviderSummary({
    required this.engineId,
    required this.displayName,
    required this.nativeSessionIdPrefix,
    required this.transportKinds,
    required this.discoveryMode
  });

  factory BirdCoderNativeSessionProviderSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderNativeSessionProviderSummary(
      engineId: (() {
        final value = json['engineId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionProviderSummary.engineId is required');
        }
        return value;
      })(),
      displayName: (() {
        final value = json['displayName']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionProviderSummary.displayName is required');
        }
        return value;
      })(),
      nativeSessionIdPrefix: (() {
        final value = json['nativeSessionIdPrefix']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionProviderSummary.nativeSessionIdPrefix is required');
        }
        return value;
      })(),
      transportKinds: (() {
        final list = _sdkworkAsList(json['transportKinds']);
        if (list == null) {
          throw FormatException('BirdCoderNativeSessionProviderSummary.transportKinds is required');
        }
        return list
            .map((item) => item?.toString())
            .whereType<String>()
            .toList();
      })(),
      discoveryMode: (() {
        final value = json['discoveryMode']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionProviderSummary.discoveryMode is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'engineId': engineId,
      'displayName': displayName,
      'nativeSessionIdPrefix': nativeSessionIdPrefix,
      'transportKinds': transportKinds.map((item) => item).toList(),
      'discoveryMode': discoveryMode,
    };
  }
}

class BirdCoderNativeSessionProviderSummaryListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderNativeSessionProviderSummaryListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderNativeSessionProviderSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderNativeSessionProviderSummaryListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderNativeSessionProviderSummaryListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderNativeSessionProviderSummaryListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionProviderSummaryListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderNativeSessionSummary {
  final String id;
  final String workspaceId;
  final String projectId;
  final String title;
  final String status;
  final String hostMode;
  final String engineId;
  final String? modelId;
  final String? nativeSessionId;
  final String createdAt;
  final String updatedAt;
  final String? lastTurnAt;
  final String sortTimestamp;
  final String? transcriptUpdatedAt;
  final String kind;
  final String? nativeCwd;

  BirdCoderNativeSessionSummary({
    required this.id,
    required this.workspaceId,
    required this.projectId,
    required this.title,
    required this.status,
    required this.hostMode,
    required this.engineId,
    this.modelId,
    this.nativeSessionId,
    required this.createdAt,
    required this.updatedAt,
    this.lastTurnAt,
    required this.sortTimestamp,
    this.transcriptUpdatedAt,
    required this.kind,
    this.nativeCwd
  });

  factory BirdCoderNativeSessionSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderNativeSessionSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionSummary.id is required');
        }
        return value;
      })(),
      workspaceId: (() {
        final value = json['workspaceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionSummary.workspaceId is required');
        }
        return value;
      })(),
      projectId: (() {
        final value = json['projectId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionSummary.projectId is required');
        }
        return value;
      })(),
      title: (() {
        final value = json['title']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionSummary.title is required');
        }
        return value;
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionSummary.status is required');
        }
        return value;
      })(),
      hostMode: (() {
        final value = json['hostMode']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionSummary.hostMode is required');
        }
        return value;
      })(),
      engineId: (() {
        final value = json['engineId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionSummary.engineId is required');
        }
        return value;
      })(),
      modelId: json['modelId']?.toString(),
      nativeSessionId: json['nativeSessionId']?.toString(),
      createdAt: (() {
        final value = json['createdAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionSummary.createdAt is required');
        }
        return value;
      })(),
      updatedAt: (() {
        final value = json['updatedAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionSummary.updatedAt is required');
        }
        return value;
      })(),
      lastTurnAt: json['lastTurnAt']?.toString(),
      sortTimestamp: (() {
        final value = json['sortTimestamp']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionSummary.sortTimestamp is required');
        }
        return value;
      })(),
      transcriptUpdatedAt: json['transcriptUpdatedAt']?.toString(),
      kind: (() {
        final value = json['kind']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionSummary.kind is required');
        }
        return value;
      })(),
      nativeCwd: json['nativeCwd']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'workspaceId': workspaceId,
      'projectId': projectId,
      'title': title,
      'status': status,
      'hostMode': hostMode,
      'engineId': engineId,
      'modelId': modelId,
      'nativeSessionId': nativeSessionId,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
      'lastTurnAt': lastTurnAt,
      'sortTimestamp': sortTimestamp,
      'transcriptUpdatedAt': transcriptUpdatedAt,
      'kind': kind,
      'nativeCwd': nativeCwd,
    };
  }
}

class BirdCoderNativeSessionSummaryListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderNativeSessionSummaryListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderNativeSessionSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderNativeSessionSummaryListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderNativeSessionSummaryListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderNativeSessionSummaryListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderNativeSessionSummaryListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderOperationDescriptor {
  final String operationId;
  final String status;
  final List<String> artifactRefs;
  final String? streamUrl;
  final String? streamKind;

  BirdCoderOperationDescriptor({
    required this.operationId,
    required this.status,
    required this.artifactRefs,
    this.streamUrl,
    this.streamKind
  });

  factory BirdCoderOperationDescriptor.fromJson(Map<String, dynamic> json) {
    return BirdCoderOperationDescriptor(
      operationId: (() {
        final value = json['operationId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderOperationDescriptor.operationId is required');
        }
        return value;
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderOperationDescriptor.status is required');
        }
        return value;
      })(),
      artifactRefs: (() {
        final list = _sdkworkAsList(json['artifactRefs']);
        if (list == null) {
          throw FormatException('BirdCoderOperationDescriptor.artifactRefs is required');
        }
        return list
            .map((item) => item?.toString())
            .whereType<String>()
            .toList();
      })(),
      streamUrl: json['streamUrl']?.toString(),
      streamKind: json['streamKind']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'operationId': operationId,
      'status': status,
      'artifactRefs': artifactRefs.map((item) => item).toList(),
      'streamUrl': streamUrl,
      'streamKind': streamKind,
    };
  }
}

class BirdCoderOperationDescriptorEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderOperationDescriptorEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderOperationDescriptorEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderOperationDescriptorEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderOperationDescriptorEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderOperationDescriptorEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderOperationDescriptorEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderProjectCollaboratorSummary {
  final String id;
  final String? uuid;
  final String? tenantId;
  final String? organizationId;
  final String projectId;
  final String workspaceId;
  final String userId;
  final String? userEmail;
  final String? userDisplayName;
  final String? userAvatarUrl;
  final String? teamId;
  final String role;
  final String status;
  final String? createdByUserId;
  final String? grantedByUserId;
  final String? createdAt;
  final String? updatedAt;

  BirdCoderProjectCollaboratorSummary({
    required this.id,
    this.uuid,
    this.tenantId,
    this.organizationId,
    required this.projectId,
    required this.workspaceId,
    required this.userId,
    this.userEmail,
    this.userDisplayName,
    this.userAvatarUrl,
    this.teamId,
    required this.role,
    required this.status,
    this.createdByUserId,
    this.grantedByUserId,
    this.createdAt,
    this.updatedAt
  });

  factory BirdCoderProjectCollaboratorSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectCollaboratorSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectCollaboratorSummary.id is required');
        }
        return value;
      })(),
      uuid: json['uuid']?.toString(),
      tenantId: json['tenantId']?.toString(),
      organizationId: json['organizationId']?.toString(),
      projectId: (() {
        final value = json['projectId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectCollaboratorSummary.projectId is required');
        }
        return value;
      })(),
      workspaceId: (() {
        final value = json['workspaceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectCollaboratorSummary.workspaceId is required');
        }
        return value;
      })(),
      userId: (() {
        final value = json['userId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectCollaboratorSummary.userId is required');
        }
        return value;
      })(),
      userEmail: json['userEmail']?.toString(),
      userDisplayName: json['userDisplayName']?.toString(),
      userAvatarUrl: json['userAvatarUrl']?.toString(),
      teamId: json['teamId']?.toString(),
      role: (() {
        final value = json['role']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectCollaboratorSummary.role is required');
        }
        return value;
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectCollaboratorSummary.status is required');
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
      'projectId': projectId,
      'workspaceId': workspaceId,
      'userId': userId,
      'userEmail': userEmail,
      'userDisplayName': userDisplayName,
      'userAvatarUrl': userAvatarUrl,
      'teamId': teamId,
      'role': role,
      'status': status,
      'createdByUserId': createdByUserId,
      'grantedByUserId': grantedByUserId,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}

class BirdCoderProjectCollaboratorSummaryEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderProjectCollaboratorSummaryEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderProjectCollaboratorSummaryEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectCollaboratorSummaryEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderProjectCollaboratorSummaryEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderProjectCollaboratorSummaryEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectCollaboratorSummaryEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderProjectCollaboratorSummaryListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderProjectCollaboratorSummaryListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderProjectCollaboratorSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectCollaboratorSummaryListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderProjectCollaboratorSummaryListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderProjectCollaboratorSummaryListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectCollaboratorSummaryListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderProjectDocumentSummary {
  final String id;
  final String? uuid;
  final String? tenantId;
  final String? organizationId;
  final String? createdAt;
  final String? updatedAt;
  final String projectId;
  final String documentKind;
  final String title;
  final String slug;
  final String? bodyRef;
  final String status;

  BirdCoderProjectDocumentSummary({
    required this.id,
    this.uuid,
    this.tenantId,
    this.organizationId,
    this.createdAt,
    this.updatedAt,
    required this.projectId,
    required this.documentKind,
    required this.title,
    required this.slug,
    this.bodyRef,
    required this.status
  });

  factory BirdCoderProjectDocumentSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectDocumentSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectDocumentSummary.id is required');
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
          throw FormatException('BirdCoderProjectDocumentSummary.projectId is required');
        }
        return value;
      })(),
      documentKind: (() {
        final value = json['documentKind']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectDocumentSummary.documentKind is required');
        }
        return value;
      })(),
      title: (() {
        final value = json['title']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectDocumentSummary.title is required');
        }
        return value;
      })(),
      slug: (() {
        final value = json['slug']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectDocumentSummary.slug is required');
        }
        return value;
      })(),
      bodyRef: json['bodyRef']?.toString(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectDocumentSummary.status is required');
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
      'documentKind': documentKind,
      'title': title,
      'slug': slug,
      'bodyRef': bodyRef,
      'status': status,
    };
  }
}

class BirdCoderProjectDocumentSummaryListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderProjectDocumentSummaryListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderProjectDocumentSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectDocumentSummaryListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderProjectDocumentSummaryListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderProjectDocumentSummaryListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectDocumentSummaryListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderProjectGitOverview {
  final List<BirdCoderGitBranchSummary> branches;
  final String? currentBranch;
  final String? currentRevision;
  final String? currentWorktreePath;
  final bool detachedHead;
  final String? repositoryRootPath;
  final String status;
  final BirdCoderGitStatusCounts statusCounts;
  final List<BirdCoderGitWorktreeSummary> worktrees;

  BirdCoderProjectGitOverview({
    required this.branches,
    this.currentBranch,
    this.currentRevision,
    this.currentWorktreePath,
    required this.detachedHead,
    this.repositoryRootPath,
    required this.status,
    required this.statusCounts,
    required this.worktrees
  });

  factory BirdCoderProjectGitOverview.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectGitOverview(
      branches: (() {
        final list = _sdkworkAsList(json['branches']);
        if (list == null) {
          throw FormatException('BirdCoderProjectGitOverview.branches is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderGitBranchSummary.fromJson(map);
      })())
            .whereType<BirdCoderGitBranchSummary>()
            .toList();
      })(),
      currentBranch: json['currentBranch']?.toString(),
      currentRevision: json['currentRevision']?.toString(),
      currentWorktreePath: json['currentWorktreePath']?.toString(),
      detachedHead: (() {
        final value = json['detachedHead'];
        if (value is! bool) {
          throw FormatException('BirdCoderProjectGitOverview.detachedHead is required');
        }
        return value;
      })(),
      repositoryRootPath: json['repositoryRootPath']?.toString(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectGitOverview.status is required');
        }
        return value;
      })(),
      statusCounts: (() {
        final map = _sdkworkAsMap(json['statusCounts']);
        if (map == null) {
          throw FormatException('BirdCoderProjectGitOverview.statusCounts is required');
        }
        return BirdCoderGitStatusCounts.fromJson(map);
      })(),
      worktrees: (() {
        final list = _sdkworkAsList(json['worktrees']);
        if (list == null) {
          throw FormatException('BirdCoderProjectGitOverview.worktrees is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderGitWorktreeSummary.fromJson(map);
      })())
            .whereType<BirdCoderGitWorktreeSummary>()
            .toList();
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'branches': branches.map((item) => item.toJson()).toList(),
      'currentBranch': currentBranch,
      'currentRevision': currentRevision,
      'currentWorktreePath': currentWorktreePath,
      'detachedHead': detachedHead,
      'repositoryRootPath': repositoryRootPath,
      'status': status,
      'statusCounts': statusCounts.toJson(),
      'worktrees': worktrees.map((item) => item.toJson()).toList(),
    };
  }
}

class BirdCoderProjectGitOverviewEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderProjectGitOverviewEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderProjectGitOverviewEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectGitOverviewEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderProjectGitOverviewEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderProjectGitOverviewEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectGitOverviewEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderProjectPublishResult {
  final BirdCoderDeploymentRecordSummary deployment;
  final BirdCoderReleaseSummary release;
  final BirdCoderDeploymentTargetSummary target;

  BirdCoderProjectPublishResult({
    required this.deployment,
    required this.release,
    required this.target
  });

  factory BirdCoderProjectPublishResult.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectPublishResult(
      deployment: (() {
        final map = _sdkworkAsMap(json['deployment']);
        if (map == null) {
          throw FormatException('BirdCoderProjectPublishResult.deployment is required');
        }
        return BirdCoderDeploymentRecordSummary.fromJson(map);
      })(),
      release: (() {
        final map = _sdkworkAsMap(json['release']);
        if (map == null) {
          throw FormatException('BirdCoderProjectPublishResult.release is required');
        }
        return BirdCoderReleaseSummary.fromJson(map);
      })(),
      target: (() {
        final map = _sdkworkAsMap(json['target']);
        if (map == null) {
          throw FormatException('BirdCoderProjectPublishResult.target is required');
        }
        return BirdCoderDeploymentTargetSummary.fromJson(map);
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'deployment': deployment.toJson(),
      'release': release.toJson(),
      'target': target.toJson(),
    };
  }
}

class BirdCoderProjectPublishResultEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderProjectPublishResultEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderProjectPublishResultEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectPublishResultEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderProjectPublishResultEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderProjectPublishResultEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectPublishResultEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderProjectSummary {
  final String createdAt;
  final String id;
  final String? uuid;
  final String? tenantId;
  final String? organizationId;
  final String? dataScope;
  final String workspaceId;
  final String? workspaceUuid;
  final String? userId;
  final String? parentId;
  final String? parentUuid;
  final Map<String, dynamic>? parentMetadata;
  final String? code;
  final String? title;
  final String name;
  final String? description;
  final String? rootPath;
  final String? sitePath;
  final String? domainPrefix;
  final String? ownerId;
  final String? leaderId;
  final String? createdByUserId;
  final String? author;
  final String? fileId;
  final String? conversationId;
  final String? type;
  final String? startTime;
  final String? endTime;
  final String? budgetAmount;
  final Map<String, dynamic>? coverImage;
  final bool? isTemplate;
  final int? collaboratorCount;
  final String status;
  final String updatedAt;
  final String? viewerRole;

  BirdCoderProjectSummary({
    required this.createdAt,
    required this.id,
    this.uuid,
    this.tenantId,
    this.organizationId,
    this.dataScope,
    required this.workspaceId,
    this.workspaceUuid,
    this.userId,
    this.parentId,
    this.parentUuid,
    this.parentMetadata,
    this.code,
    this.title,
    required this.name,
    this.description,
    this.rootPath,
    this.sitePath,
    this.domainPrefix,
    this.ownerId,
    this.leaderId,
    this.createdByUserId,
    this.author,
    this.fileId,
    this.conversationId,
    this.type,
    this.startTime,
    this.endTime,
    this.budgetAmount,
    this.coverImage,
    this.isTemplate,
    this.collaboratorCount,
    required this.status,
    required this.updatedAt,
    this.viewerRole
  });

  factory BirdCoderProjectSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectSummary(
      createdAt: (() {
        final value = json['createdAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummary.createdAt is required');
        }
        return value;
      })(),
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummary.id is required');
        }
        return value;
      })(),
      uuid: json['uuid']?.toString(),
      tenantId: json['tenantId']?.toString(),
      organizationId: json['organizationId']?.toString(),
      dataScope: json['dataScope']?.toString(),
      workspaceId: (() {
        final value = json['workspaceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummary.workspaceId is required');
        }
        return value;
      })(),
      workspaceUuid: json['workspaceUuid']?.toString(),
      userId: json['userId']?.toString(),
      parentId: json['parentId']?.toString(),
      parentUuid: json['parentUuid']?.toString(),
      parentMetadata: _sdkworkAsMap(json['parentMetadata']),
      code: json['code']?.toString(),
      title: json['title']?.toString(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummary.name is required');
        }
        return value;
      })(),
      description: json['description']?.toString(),
      rootPath: json['rootPath']?.toString(),
      sitePath: json['sitePath']?.toString(),
      domainPrefix: json['domainPrefix']?.toString(),
      ownerId: json['ownerId']?.toString(),
      leaderId: json['leaderId']?.toString(),
      createdByUserId: json['createdByUserId']?.toString(),
      author: json['author']?.toString(),
      fileId: json['fileId']?.toString(),
      conversationId: json['conversationId']?.toString(),
      type: json['type']?.toString(),
      startTime: json['startTime']?.toString(),
      endTime: json['endTime']?.toString(),
      budgetAmount: json['budgetAmount']?.toString(),
      coverImage: _sdkworkAsMap(json['coverImage']),
      isTemplate: json['isTemplate'] is bool ? json['isTemplate'] : null,
      collaboratorCount: json['collaboratorCount'] is int ? json['collaboratorCount'] : null,
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummary.status is required');
        }
        return value;
      })(),
      updatedAt: (() {
        final value = json['updatedAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummary.updatedAt is required');
        }
        return value;
      })(),
      viewerRole: json['viewerRole']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'createdAt': createdAt,
      'id': id,
      'uuid': uuid,
      'tenantId': tenantId,
      'organizationId': organizationId,
      'dataScope': dataScope,
      'workspaceId': workspaceId,
      'workspaceUuid': workspaceUuid,
      'userId': userId,
      'parentId': parentId,
      'parentUuid': parentUuid,
      'parentMetadata': parentMetadata,
      'code': code,
      'title': title,
      'name': name,
      'description': description,
      'rootPath': rootPath,
      'sitePath': sitePath,
      'domainPrefix': domainPrefix,
      'ownerId': ownerId,
      'leaderId': leaderId,
      'createdByUserId': createdByUserId,
      'author': author,
      'fileId': fileId,
      'conversationId': conversationId,
      'type': type,
      'startTime': startTime,
      'endTime': endTime,
      'budgetAmount': budgetAmount,
      'coverImage': coverImage,
      'isTemplate': isTemplate,
      'collaboratorCount': collaboratorCount,
      'status': status,
      'updatedAt': updatedAt,
      'viewerRole': viewerRole,
    };
  }
}

class BirdCoderProjectSummaryEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderProjectSummaryEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderProjectSummaryEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectSummaryEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderProjectSummaryEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderProjectSummaryEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummaryEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderProjectSummaryListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderProjectSummaryListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderProjectSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectSummaryListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderProjectSummaryListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderProjectSummaryListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummaryListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderPublishProjectRequest {
  final String? endpointUrl;
  final String? environmentKey;
  final String? releaseKind;
  final String? releaseVersion;
  final String? rolloutStage;
  final String? runtime;
  final String? targetId;
  final String? targetName;

  BirdCoderPublishProjectRequest({
    this.endpointUrl,
    this.environmentKey,
    this.releaseKind,
    this.releaseVersion,
    this.rolloutStage,
    this.runtime,
    this.targetId,
    this.targetName
  });

  factory BirdCoderPublishProjectRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderPublishProjectRequest(
      endpointUrl: json['endpointUrl']?.toString(),
      environmentKey: json['environmentKey']?.toString(),
      releaseKind: json['releaseKind']?.toString(),
      releaseVersion: json['releaseVersion']?.toString(),
      rolloutStage: json['rolloutStage']?.toString(),
      runtime: json['runtime']?.toString(),
      targetId: json['targetId']?.toString(),
      targetName: json['targetName']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'endpointUrl': endpointUrl,
      'environmentKey': environmentKey,
      'releaseKind': releaseKind,
      'releaseVersion': releaseVersion,
      'rolloutStage': rolloutStage,
      'runtime': runtime,
      'targetId': targetId,
      'targetName': targetName,
    };
  }
}

class BirdCoderPushProjectGitBranchRequest {
  final String? branchName;
  final String? remoteName;

  BirdCoderPushProjectGitBranchRequest({
    this.branchName,
    this.remoteName
  });

  factory BirdCoderPushProjectGitBranchRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderPushProjectGitBranchRequest(
      branchName: json['branchName']?.toString(),
      remoteName: json['remoteName']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'branchName': branchName,
      'remoteName': remoteName,
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

class BirdCoderRemoveProjectGitWorktreeRequest {
  final bool? force;
  final String path;

  BirdCoderRemoveProjectGitWorktreeRequest({
    this.force,
    required this.path
  });

  factory BirdCoderRemoveProjectGitWorktreeRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderRemoveProjectGitWorktreeRequest(
      force: json['force'] is bool ? json['force'] : null,
      path: (() {
        final value = json['path']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderRemoveProjectGitWorktreeRequest.path is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'force': force,
      'path': path,
    };
  }
}

class BirdCoderSkillCatalogEntrySummary {
  final String id;
  final String packageId;
  final String slug;
  final String name;
  final String description;
  final String? icon;
  final String? author;
  final String versionId;
  final String versionLabel;
  final String? installCount;
  final String? longDescription;
  final List<String> tags;
  final String? license;
  final String? repositoryUrl;
  final String? lastUpdated;
  final String? readme;
  final List<String> capabilityKeys;
  final bool installed;

  BirdCoderSkillCatalogEntrySummary({
    required this.id,
    required this.packageId,
    required this.slug,
    required this.name,
    required this.description,
    this.icon,
    this.author,
    required this.versionId,
    required this.versionLabel,
    this.installCount,
    this.longDescription,
    required this.tags,
    this.license,
    this.repositoryUrl,
    this.lastUpdated,
    this.readme,
    required this.capabilityKeys,
    required this.installed
  });

  factory BirdCoderSkillCatalogEntrySummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderSkillCatalogEntrySummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSkillCatalogEntrySummary.id is required');
        }
        return value;
      })(),
      packageId: (() {
        final value = json['packageId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSkillCatalogEntrySummary.packageId is required');
        }
        return value;
      })(),
      slug: (() {
        final value = json['slug']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSkillCatalogEntrySummary.slug is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSkillCatalogEntrySummary.name is required');
        }
        return value;
      })(),
      description: (() {
        final value = json['description']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSkillCatalogEntrySummary.description is required');
        }
        return value;
      })(),
      icon: json['icon']?.toString(),
      author: json['author']?.toString(),
      versionId: (() {
        final value = json['versionId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSkillCatalogEntrySummary.versionId is required');
        }
        return value;
      })(),
      versionLabel: (() {
        final value = json['versionLabel']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSkillCatalogEntrySummary.versionLabel is required');
        }
        return value;
      })(),
      installCount: json['installCount']?.toString(),
      longDescription: json['longDescription']?.toString(),
      tags: (() {
        final list = _sdkworkAsList(json['tags']);
        if (list == null) {
          throw FormatException('BirdCoderSkillCatalogEntrySummary.tags is required');
        }
        return list
            .map((item) => item?.toString())
            .whereType<String>()
            .toList();
      })(),
      license: json['license']?.toString(),
      repositoryUrl: json['repositoryUrl']?.toString(),
      lastUpdated: json['lastUpdated']?.toString(),
      readme: json['readme']?.toString(),
      capabilityKeys: (() {
        final list = _sdkworkAsList(json['capabilityKeys']);
        if (list == null) {
          throw FormatException('BirdCoderSkillCatalogEntrySummary.capabilityKeys is required');
        }
        return list
            .map((item) => item?.toString())
            .whereType<String>()
            .toList();
      })(),
      installed: (() {
        final value = json['installed'];
        if (value is! bool) {
          throw FormatException('BirdCoderSkillCatalogEntrySummary.installed is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'packageId': packageId,
      'slug': slug,
      'name': name,
      'description': description,
      'icon': icon,
      'author': author,
      'versionId': versionId,
      'versionLabel': versionLabel,
      'installCount': installCount,
      'longDescription': longDescription,
      'tags': tags.map((item) => item).toList(),
      'license': license,
      'repositoryUrl': repositoryUrl,
      'lastUpdated': lastUpdated,
      'readme': readme,
      'capabilityKeys': capabilityKeys.map((item) => item).toList(),
      'installed': installed,
    };
  }
}

class BirdCoderSkillInstallationSummary {
  final String id;
  final String? uuid;
  final String? tenantId;
  final String? organizationId;
  final String? createdAt;
  final String? updatedAt;
  final String packageId;
  final String scopeId;
  final String scopeType;
  final String status;
  final String versionId;
  final String installedAt;

  BirdCoderSkillInstallationSummary({
    required this.id,
    this.uuid,
    this.tenantId,
    this.organizationId,
    this.createdAt,
    this.updatedAt,
    required this.packageId,
    required this.scopeId,
    required this.scopeType,
    required this.status,
    required this.versionId,
    required this.installedAt
  });

  factory BirdCoderSkillInstallationSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderSkillInstallationSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSkillInstallationSummary.id is required');
        }
        return value;
      })(),
      uuid: json['uuid']?.toString(),
      tenantId: json['tenantId']?.toString(),
      organizationId: json['organizationId']?.toString(),
      createdAt: json['createdAt']?.toString(),
      updatedAt: json['updatedAt']?.toString(),
      packageId: (() {
        final value = json['packageId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSkillInstallationSummary.packageId is required');
        }
        return value;
      })(),
      scopeId: (() {
        final value = json['scopeId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSkillInstallationSummary.scopeId is required');
        }
        return value;
      })(),
      scopeType: (() {
        final value = json['scopeType']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSkillInstallationSummary.scopeType is required');
        }
        return value;
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSkillInstallationSummary.status is required');
        }
        return value;
      })(),
      versionId: (() {
        final value = json['versionId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSkillInstallationSummary.versionId is required');
        }
        return value;
      })(),
      installedAt: (() {
        final value = json['installedAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSkillInstallationSummary.installedAt is required');
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
      'packageId': packageId,
      'scopeId': scopeId,
      'scopeType': scopeType,
      'status': status,
      'versionId': versionId,
      'installedAt': installedAt,
    };
  }
}

class BirdCoderSkillInstallationSummaryEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderSkillInstallationSummaryEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderSkillInstallationSummaryEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderSkillInstallationSummaryEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderSkillInstallationSummaryEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderSkillInstallationSummaryEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSkillInstallationSummaryEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderSkillPackageSummary {
  final String id;
  final String? uuid;
  final String? tenantId;
  final String? organizationId;
  final String? createdAt;
  final String? updatedAt;
  final String slug;
  final String name;
  final String description;
  final String? icon;
  final String? author;
  final String versionId;
  final String versionLabel;
  final String? installCount;
  final String? longDescription;
  final String? sourceUri;
  final bool installed;
  final List<BirdCoderSkillCatalogEntrySummary> skills;

  BirdCoderSkillPackageSummary({
    required this.id,
    this.uuid,
    this.tenantId,
    this.organizationId,
    this.createdAt,
    this.updatedAt,
    required this.slug,
    required this.name,
    required this.description,
    this.icon,
    this.author,
    required this.versionId,
    required this.versionLabel,
    this.installCount,
    this.longDescription,
    this.sourceUri,
    required this.installed,
    required this.skills
  });

  factory BirdCoderSkillPackageSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderSkillPackageSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSkillPackageSummary.id is required');
        }
        return value;
      })(),
      uuid: json['uuid']?.toString(),
      tenantId: json['tenantId']?.toString(),
      organizationId: json['organizationId']?.toString(),
      createdAt: json['createdAt']?.toString(),
      updatedAt: json['updatedAt']?.toString(),
      slug: (() {
        final value = json['slug']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSkillPackageSummary.slug is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSkillPackageSummary.name is required');
        }
        return value;
      })(),
      description: (() {
        final value = json['description']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSkillPackageSummary.description is required');
        }
        return value;
      })(),
      icon: json['icon']?.toString(),
      author: json['author']?.toString(),
      versionId: (() {
        final value = json['versionId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSkillPackageSummary.versionId is required');
        }
        return value;
      })(),
      versionLabel: (() {
        final value = json['versionLabel']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSkillPackageSummary.versionLabel is required');
        }
        return value;
      })(),
      installCount: json['installCount']?.toString(),
      longDescription: json['longDescription']?.toString(),
      sourceUri: json['sourceUri']?.toString(),
      installed: (() {
        final value = json['installed'];
        if (value is! bool) {
          throw FormatException('BirdCoderSkillPackageSummary.installed is required');
        }
        return value;
      })(),
      skills: (() {
        final list = _sdkworkAsList(json['skills']);
        if (list == null) {
          throw FormatException('BirdCoderSkillPackageSummary.skills is required');
        }
        return list
            .map((item) => (() {
        final map = _sdkworkAsMap(item);
        return map == null ? null : BirdCoderSkillCatalogEntrySummary.fromJson(map);
      })())
            .whereType<BirdCoderSkillCatalogEntrySummary>()
            .toList();
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
      'slug': slug,
      'name': name,
      'description': description,
      'icon': icon,
      'author': author,
      'versionId': versionId,
      'versionLabel': versionLabel,
      'installCount': installCount,
      'longDescription': longDescription,
      'sourceUri': sourceUri,
      'installed': installed,
      'skills': skills.map((item) => item.toJson()).toList(),
    };
  }
}

class BirdCoderSkillPackageSummaryListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderSkillPackageSummaryListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderSkillPackageSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderSkillPackageSummaryListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderSkillPackageSummaryListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderSkillPackageSummaryListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSkillPackageSummaryListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderSubmitApprovalDecisionRequest {
  final String decision;
  final String? reason;

  BirdCoderSubmitApprovalDecisionRequest({
    required this.decision,
    this.reason
  });

  factory BirdCoderSubmitApprovalDecisionRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderSubmitApprovalDecisionRequest(
      decision: (() {
        final value = json['decision']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSubmitApprovalDecisionRequest.decision is required');
        }
        return value;
      })(),
      reason: json['reason']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'decision': decision,
      'reason': reason,
    };
  }
}

class BirdCoderSubmitUserQuestionAnswerRequest {
  final String? answer;
  final String? optionId;
  final String? optionLabel;
  final bool? rejected;

  BirdCoderSubmitUserQuestionAnswerRequest({
    this.answer,
    this.optionId,
    this.optionLabel,
    this.rejected
  });

  factory BirdCoderSubmitUserQuestionAnswerRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderSubmitUserQuestionAnswerRequest(
      answer: json['answer']?.toString(),
      optionId: json['optionId']?.toString(),
      optionLabel: json['optionLabel']?.toString(),
      rejected: json['rejected'] is bool ? json['rejected'] : null
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'answer': answer,
      'optionId': optionId,
      'optionLabel': optionLabel,
      'rejected': rejected,
    };
  }
}

class BirdCoderSwitchProjectGitBranchRequest {
  final String branchName;

  BirdCoderSwitchProjectGitBranchRequest({
    required this.branchName
  });

  factory BirdCoderSwitchProjectGitBranchRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderSwitchProjectGitBranchRequest(
      branchName: (() {
        final value = json['branchName']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSwitchProjectGitBranchRequest.branchName is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'branchName': branchName,
    };
  }
}

class BirdCoderSyncCodeEngineModelConfigRequest {
  final BirdCoderCodeEngineModelConfig localConfig;

  BirdCoderSyncCodeEngineModelConfigRequest({
    required this.localConfig
  });

  factory BirdCoderSyncCodeEngineModelConfigRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderSyncCodeEngineModelConfigRequest(
      localConfig: (() {
        final map = _sdkworkAsMap(json['localConfig']);
        if (map == null) {
          throw FormatException('BirdCoderSyncCodeEngineModelConfigRequest.localConfig is required');
        }
        return BirdCoderCodeEngineModelConfig.fromJson(map);
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'localConfig': localConfig.toJson(),
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
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderTeamSummaryListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderTeamSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderTeamSummaryListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderTeamSummaryListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderTeamSummaryListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderTeamSummaryListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderUpdateCodingSessionRequest {
  final String? title;
  final String? status;
  final String? hostMode;

  BirdCoderUpdateCodingSessionRequest({
    this.title,
    this.status,
    this.hostMode
  });

  factory BirdCoderUpdateCodingSessionRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderUpdateCodingSessionRequest(
      title: json['title']?.toString(),
      status: json['status']?.toString(),
      hostMode: json['hostMode']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'title': title,
      'status': status,
      'hostMode': hostMode,
    };
  }
}

class BirdCoderUpdateCurrentUserProfileRequest {
  final String? avatarUrl;
  final String? bio;
  final String? company;
  final String? displayName;
  final String? location;
  final String? website;

  BirdCoderUpdateCurrentUserProfileRequest({
    this.avatarUrl,
    this.bio,
    this.company,
    this.displayName,
    this.location,
    this.website
  });

  factory BirdCoderUpdateCurrentUserProfileRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderUpdateCurrentUserProfileRequest(
      avatarUrl: json['avatarUrl']?.toString(),
      bio: json['bio']?.toString(),
      company: json['company']?.toString(),
      displayName: json['displayName']?.toString(),
      location: json['location']?.toString(),
      website: json['website']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'avatarUrl': avatarUrl,
      'bio': bio,
      'company': company,
      'displayName': displayName,
      'location': location,
      'website': website,
    };
  }
}

class BirdCoderUpdateProjectRequest {
  final String? description;
  final String? dataScope;
  final String? userId;
  final String? parentId;
  final String? parentUuid;
  final Map<String, dynamic>? parentMetadata;
  final String? code;
  final String? title;
  final String? name;
  final String? ownerId;
  final String? leaderId;
  final String? createdByUserId;
  final String? author;
  final String? type;
  final String? rootPath;
  final String? sitePath;
  final String? domainPrefix;
  final String? fileId;
  final String? conversationId;
  final String? startTime;
  final String? endTime;
  final String? budgetAmount;
  final Map<String, dynamic>? coverImage;
  final bool? isTemplate;
  final String? status;

  BirdCoderUpdateProjectRequest({
    this.description,
    this.dataScope,
    this.userId,
    this.parentId,
    this.parentUuid,
    this.parentMetadata,
    this.code,
    this.title,
    this.name,
    this.ownerId,
    this.leaderId,
    this.createdByUserId,
    this.author,
    this.type,
    this.rootPath,
    this.sitePath,
    this.domainPrefix,
    this.fileId,
    this.conversationId,
    this.startTime,
    this.endTime,
    this.budgetAmount,
    this.coverImage,
    this.isTemplate,
    this.status
  });

  factory BirdCoderUpdateProjectRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderUpdateProjectRequest(
      description: json['description']?.toString(),
      dataScope: json['dataScope']?.toString(),
      userId: json['userId']?.toString(),
      parentId: json['parentId']?.toString(),
      parentUuid: json['parentUuid']?.toString(),
      parentMetadata: _sdkworkAsMap(json['parentMetadata']),
      code: json['code']?.toString(),
      title: json['title']?.toString(),
      name: json['name']?.toString(),
      ownerId: json['ownerId']?.toString(),
      leaderId: json['leaderId']?.toString(),
      createdByUserId: json['createdByUserId']?.toString(),
      author: json['author']?.toString(),
      type: json['type']?.toString(),
      rootPath: json['rootPath']?.toString(),
      sitePath: json['sitePath']?.toString(),
      domainPrefix: json['domainPrefix']?.toString(),
      fileId: json['fileId']?.toString(),
      conversationId: json['conversationId']?.toString(),
      startTime: json['startTime']?.toString(),
      endTime: json['endTime']?.toString(),
      budgetAmount: json['budgetAmount']?.toString(),
      coverImage: _sdkworkAsMap(json['coverImage']),
      isTemplate: json['isTemplate'] is bool ? json['isTemplate'] : null,
      status: json['status']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'description': description,
      'dataScope': dataScope,
      'userId': userId,
      'parentId': parentId,
      'parentUuid': parentUuid,
      'parentMetadata': parentMetadata,
      'code': code,
      'title': title,
      'name': name,
      'ownerId': ownerId,
      'leaderId': leaderId,
      'createdByUserId': createdByUserId,
      'author': author,
      'type': type,
      'rootPath': rootPath,
      'sitePath': sitePath,
      'domainPrefix': domainPrefix,
      'fileId': fileId,
      'conversationId': conversationId,
      'startTime': startTime,
      'endTime': endTime,
      'budgetAmount': budgetAmount,
      'coverImage': coverImage,
      'isTemplate': isTemplate,
      'status': status,
    };
  }
}

class BirdCoderUpdateWorkspaceRequest {
  final String? description;
  final String? dataScope;
  final String? code;
  final String? title;
  final String? name;
  final String? ownerId;
  final String? leaderId;
  final String? createdByUserId;
  final String? icon;
  final String? color;
  final String? type;
  final String? startTime;
  final String? endTime;
  final int? maxMembers;
  final int? currentMembers;
  final int? memberCount;
  final String? maxStorage;
  final String? usedStorage;
  final Map<String, dynamic>? settings;
  final bool? isPublic;
  final bool? isTemplate;
  final String? status;

  BirdCoderUpdateWorkspaceRequest({
    this.description,
    this.dataScope,
    this.code,
    this.title,
    this.name,
    this.ownerId,
    this.leaderId,
    this.createdByUserId,
    this.icon,
    this.color,
    this.type,
    this.startTime,
    this.endTime,
    this.maxMembers,
    this.currentMembers,
    this.memberCount,
    this.maxStorage,
    this.usedStorage,
    this.settings,
    this.isPublic,
    this.isTemplate,
    this.status
  });

  factory BirdCoderUpdateWorkspaceRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderUpdateWorkspaceRequest(
      description: json['description']?.toString(),
      dataScope: json['dataScope']?.toString(),
      code: json['code']?.toString(),
      title: json['title']?.toString(),
      name: json['name']?.toString(),
      ownerId: json['ownerId']?.toString(),
      leaderId: json['leaderId']?.toString(),
      createdByUserId: json['createdByUserId']?.toString(),
      icon: json['icon']?.toString(),
      color: json['color']?.toString(),
      type: json['type']?.toString(),
      startTime: json['startTime']?.toString(),
      endTime: json['endTime']?.toString(),
      maxMembers: json['maxMembers'] is int ? json['maxMembers'] : null,
      currentMembers: json['currentMembers'] is int ? json['currentMembers'] : null,
      memberCount: json['memberCount'] is int ? json['memberCount'] : null,
      maxStorage: json['maxStorage']?.toString(),
      usedStorage: json['usedStorage']?.toString(),
      settings: _sdkworkAsMap(json['settings']),
      isPublic: json['isPublic'] is bool ? json['isPublic'] : null,
      isTemplate: json['isTemplate'] is bool ? json['isTemplate'] : null,
      status: json['status']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'description': description,
      'dataScope': dataScope,
      'code': code,
      'title': title,
      'name': name,
      'ownerId': ownerId,
      'leaderId': leaderId,
      'createdByUserId': createdByUserId,
      'icon': icon,
      'color': color,
      'type': type,
      'startTime': startTime,
      'endTime': endTime,
      'maxMembers': maxMembers,
      'currentMembers': currentMembers,
      'memberCount': memberCount,
      'maxStorage': maxStorage,
      'usedStorage': usedStorage,
      'settings': settings,
      'isPublic': isPublic,
      'isTemplate': isTemplate,
      'status': status,
    };
  }
}

class BirdCoderUpsertProjectCollaboratorRequest {
  final String? userId;
  final String? email;
  final String? teamId;
  final String? role;
  final String? status;
  final String? createdByUserId;
  final String? grantedByUserId;

  BirdCoderUpsertProjectCollaboratorRequest({
    this.userId,
    this.email,
    this.teamId,
    this.role,
    this.status,
    this.createdByUserId,
    this.grantedByUserId
  });

  factory BirdCoderUpsertProjectCollaboratorRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderUpsertProjectCollaboratorRequest(
      userId: json['userId']?.toString(),
      email: json['email']?.toString(),
      teamId: json['teamId']?.toString(),
      role: json['role']?.toString(),
      status: json['status']?.toString(),
      createdByUserId: json['createdByUserId']?.toString(),
      grantedByUserId: json['grantedByUserId']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'userId': userId,
      'email': email,
      'teamId': teamId,
      'role': role,
      'status': status,
      'createdByUserId': createdByUserId,
      'grantedByUserId': grantedByUserId,
    };
  }
}

class BirdCoderUpsertWorkspaceMemberRequest {
  final String? userId;
  final String? email;
  final String? teamId;
  final String? role;
  final String? status;
  final String? createdByUserId;
  final String? grantedByUserId;

  BirdCoderUpsertWorkspaceMemberRequest({
    this.userId,
    this.email,
    this.teamId,
    this.role,
    this.status,
    this.createdByUserId,
    this.grantedByUserId
  });

  factory BirdCoderUpsertWorkspaceMemberRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderUpsertWorkspaceMemberRequest(
      userId: json['userId']?.toString(),
      email: json['email']?.toString(),
      teamId: json['teamId']?.toString(),
      role: json['role']?.toString(),
      status: json['status']?.toString(),
      createdByUserId: json['createdByUserId']?.toString(),
      grantedByUserId: json['grantedByUserId']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'userId': userId,
      'email': email,
      'teamId': teamId,
      'role': role,
      'status': status,
      'createdByUserId': createdByUserId,
      'grantedByUserId': grantedByUserId,
    };
  }
}

class BirdCoderUserQuestionAnswerResult {
  final String questionId;
  final String codingSessionId;
  final String? answer;
  final String answeredAt;
  final String? optionId;
  final String? optionLabel;
  final bool rejected;
  final String? runtimeId;
  final String runtimeStatus;
  final String? turnId;

  BirdCoderUserQuestionAnswerResult({
    required this.questionId,
    required this.codingSessionId,
    this.answer,
    required this.answeredAt,
    this.optionId,
    this.optionLabel,
    required this.rejected,
    this.runtimeId,
    required this.runtimeStatus,
    this.turnId
  });

  factory BirdCoderUserQuestionAnswerResult.fromJson(Map<String, dynamic> json) {
    return BirdCoderUserQuestionAnswerResult(
      questionId: (() {
        final value = json['questionId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderUserQuestionAnswerResult.questionId is required');
        }
        return value;
      })(),
      codingSessionId: (() {
        final value = json['codingSessionId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderUserQuestionAnswerResult.codingSessionId is required');
        }
        return value;
      })(),
      answer: json['answer']?.toString(),
      answeredAt: (() {
        final value = json['answeredAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderUserQuestionAnswerResult.answeredAt is required');
        }
        return value;
      })(),
      optionId: json['optionId']?.toString(),
      optionLabel: json['optionLabel']?.toString(),
      rejected: (() {
        final value = json['rejected'];
        if (value is! bool) {
          throw FormatException('BirdCoderUserQuestionAnswerResult.rejected is required');
        }
        return value;
      })(),
      runtimeId: json['runtimeId']?.toString(),
      runtimeStatus: (() {
        final value = json['runtimeStatus']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderUserQuestionAnswerResult.runtimeStatus is required');
        }
        return value;
      })(),
      turnId: json['turnId']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'questionId': questionId,
      'codingSessionId': codingSessionId,
      'answer': answer,
      'answeredAt': answeredAt,
      'optionId': optionId,
      'optionLabel': optionLabel,
      'rejected': rejected,
      'runtimeId': runtimeId,
      'runtimeStatus': runtimeStatus,
      'turnId': turnId,
    };
  }
}

class BirdCoderUserQuestionAnswerResultEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderUserQuestionAnswerResultEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderUserQuestionAnswerResultEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderUserQuestionAnswerResultEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderUserQuestionAnswerResultEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderUserQuestionAnswerResultEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderUserQuestionAnswerResultEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderWorkspaceMemberSummary {
  final String id;
  final String? uuid;
  final String? tenantId;
  final String? organizationId;
  final String workspaceId;
  final String userId;
  final String? userEmail;
  final String? userDisplayName;
  final String? userAvatarUrl;
  final String? teamId;
  final String role;
  final String status;
  final String? createdByUserId;
  final String? grantedByUserId;
  final String? createdAt;
  final String? updatedAt;

  BirdCoderWorkspaceMemberSummary({
    required this.id,
    this.uuid,
    this.tenantId,
    this.organizationId,
    required this.workspaceId,
    required this.userId,
    this.userEmail,
    this.userDisplayName,
    this.userAvatarUrl,
    this.teamId,
    required this.role,
    required this.status,
    this.createdByUserId,
    this.grantedByUserId,
    this.createdAt,
    this.updatedAt
  });

  factory BirdCoderWorkspaceMemberSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderWorkspaceMemberSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceMemberSummary.id is required');
        }
        return value;
      })(),
      uuid: json['uuid']?.toString(),
      tenantId: json['tenantId']?.toString(),
      organizationId: json['organizationId']?.toString(),
      workspaceId: (() {
        final value = json['workspaceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceMemberSummary.workspaceId is required');
        }
        return value;
      })(),
      userId: (() {
        final value = json['userId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceMemberSummary.userId is required');
        }
        return value;
      })(),
      userEmail: json['userEmail']?.toString(),
      userDisplayName: json['userDisplayName']?.toString(),
      userAvatarUrl: json['userAvatarUrl']?.toString(),
      teamId: json['teamId']?.toString(),
      role: (() {
        final value = json['role']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceMemberSummary.role is required');
        }
        return value;
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceMemberSummary.status is required');
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
      'workspaceId': workspaceId,
      'userId': userId,
      'userEmail': userEmail,
      'userDisplayName': userDisplayName,
      'userAvatarUrl': userAvatarUrl,
      'teamId': teamId,
      'role': role,
      'status': status,
      'createdByUserId': createdByUserId,
      'grantedByUserId': grantedByUserId,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}

class BirdCoderWorkspaceMemberSummaryEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderWorkspaceMemberSummaryEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderWorkspaceMemberSummaryEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderWorkspaceMemberSummaryEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderWorkspaceMemberSummaryEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderWorkspaceMemberSummaryEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceMemberSummaryEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderWorkspaceMemberSummaryListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderWorkspaceMemberSummaryListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderWorkspaceMemberSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderWorkspaceMemberSummaryListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderWorkspaceMemberSummaryListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderWorkspaceMemberSummaryListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceMemberSummaryListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderWorkspaceSummary {
  final String id;
  final String? uuid;
  final String? tenantId;
  final String? organizationId;
  final String? dataScope;
  final String? code;
  final String? title;
  final String name;
  final String? description;
  final String? icon;
  final String? color;
  final String? ownerId;
  final String? leaderId;
  final String? createdByUserId;
  final String? type;
  final String? startTime;
  final String? endTime;
  final int? maxMembers;
  final int? currentMembers;
  final int? memberCount;
  final String? maxStorage;
  final String? usedStorage;
  final Map<String, dynamic>? settings;
  final bool? isPublic;
  final bool? isTemplate;
  final String status;
  final String? viewerRole;

  BirdCoderWorkspaceSummary({
    required this.id,
    this.uuid,
    this.tenantId,
    this.organizationId,
    this.dataScope,
    this.code,
    this.title,
    required this.name,
    this.description,
    this.icon,
    this.color,
    this.ownerId,
    this.leaderId,
    this.createdByUserId,
    this.type,
    this.startTime,
    this.endTime,
    this.maxMembers,
    this.currentMembers,
    this.memberCount,
    this.maxStorage,
    this.usedStorage,
    this.settings,
    this.isPublic,
    this.isTemplate,
    required this.status,
    this.viewerRole
  });

  factory BirdCoderWorkspaceSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderWorkspaceSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceSummary.id is required');
        }
        return value;
      })(),
      uuid: json['uuid']?.toString(),
      tenantId: json['tenantId']?.toString(),
      organizationId: json['organizationId']?.toString(),
      dataScope: json['dataScope']?.toString(),
      code: json['code']?.toString(),
      title: json['title']?.toString(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceSummary.name is required');
        }
        return value;
      })(),
      description: json['description']?.toString(),
      icon: json['icon']?.toString(),
      color: json['color']?.toString(),
      ownerId: json['ownerId']?.toString(),
      leaderId: json['leaderId']?.toString(),
      createdByUserId: json['createdByUserId']?.toString(),
      type: json['type']?.toString(),
      startTime: json['startTime']?.toString(),
      endTime: json['endTime']?.toString(),
      maxMembers: json['maxMembers'] is int ? json['maxMembers'] : null,
      currentMembers: json['currentMembers'] is int ? json['currentMembers'] : null,
      memberCount: json['memberCount'] is int ? json['memberCount'] : null,
      maxStorage: json['maxStorage']?.toString(),
      usedStorage: json['usedStorage']?.toString(),
      settings: _sdkworkAsMap(json['settings']),
      isPublic: json['isPublic'] is bool ? json['isPublic'] : null,
      isTemplate: json['isTemplate'] is bool ? json['isTemplate'] : null,
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceSummary.status is required');
        }
        return value;
      })(),
      viewerRole: json['viewerRole']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'uuid': uuid,
      'tenantId': tenantId,
      'organizationId': organizationId,
      'dataScope': dataScope,
      'code': code,
      'title': title,
      'name': name,
      'description': description,
      'icon': icon,
      'color': color,
      'ownerId': ownerId,
      'leaderId': leaderId,
      'createdByUserId': createdByUserId,
      'type': type,
      'startTime': startTime,
      'endTime': endTime,
      'maxMembers': maxMembers,
      'currentMembers': currentMembers,
      'memberCount': memberCount,
      'maxStorage': maxStorage,
      'usedStorage': usedStorage,
      'settings': settings,
      'isPublic': isPublic,
      'isTemplate': isTemplate,
      'status': status,
      'viewerRole': viewerRole,
    };
  }
}

class BirdCoderWorkspaceSummaryEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderWorkspaceSummaryEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderWorkspaceSummaryEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderWorkspaceSummaryEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderWorkspaceSummaryEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderWorkspaceSummaryEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceSummaryEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class BirdCoderWorkspaceSummaryListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderWorkspaceSummaryListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderWorkspaceSummaryListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderWorkspaceSummaryListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderWorkspaceSummaryListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderWorkspaceSummaryListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceSummaryListEnvelope.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}

class PageInfo {
  final String mode;
  final int? page;
  final int? pageSize;
  final String? totalItems;
  final int? totalPages;
  final String? nextCursor;
  final bool? hasMore;

  PageInfo({
    required this.mode,
    this.page,
    this.pageSize,
    this.totalItems,
    this.totalPages,
    this.nextCursor,
    this.hasMore
  });

  factory PageInfo.fromJson(Map<String, dynamic> json) {
    return PageInfo(
      mode: (() {
        final value = json['mode']?.toString();
        if (value == null) {
          throw FormatException('PageInfo.mode is required');
        }
        return value;
      })(),
      page: json['page'] is int ? json['page'] : null,
      pageSize: json['pageSize'] is int ? json['pageSize'] : null,
      totalItems: json['totalItems']?.toString(),
      totalPages: json['totalPages'] is int ? json['totalPages'] : null,
      nextCursor: json['nextCursor']?.toString(),
      hasMore: json['hasMore'] is bool ? json['hasMore'] : null
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'mode': mode,
      'page': page,
      'pageSize': pageSize,
      'totalItems': totalItems,
      'totalPages': totalPages,
      'nextCursor': nextCursor,
      'hasMore': hasMore,
    };
  }
}

class ProblemDetail {
  final String type;
  final String title;
  final int status;
  final String? detail;
  final String? instance;
  final int code;
  final String traceId;

  ProblemDetail({
    required this.type,
    required this.title,
    required this.status,
    this.detail,
    this.instance,
    required this.code,
    required this.traceId
  });

  factory ProblemDetail.fromJson(Map<String, dynamic> json) {
    return ProblemDetail(
      type: (() {
        final value = json['type']?.toString();
        if (value == null) {
          throw FormatException('ProblemDetail.type is required');
        }
        return value;
      })(),
      title: (() {
        final value = json['title']?.toString();
        if (value == null) {
          throw FormatException('ProblemDetail.title is required');
        }
        return value;
      })(),
      status: (() {
        final value = json['status'];
        if (value is! int) {
          throw FormatException('ProblemDetail.status is required');
        }
        return value;
      })(),
      detail: json['detail']?.toString(),
      instance: json['instance']?.toString(),
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('ProblemDetail.code is required');
        }
        return value;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('ProblemDetail.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'type': type,
      'title': title,
      'status': status,
      'detail': detail,
      'instance': instance,
      'code': code,
      'traceId': traceId,
    };
  }
}

class SdkWorkApiResponse {
  final int code;
  final dynamic data;
  final String traceId;

  SdkWorkApiResponse({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory SdkWorkApiResponse.fromJson(Map<String, dynamic> json) {
    return SdkWorkApiResponse(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('SdkWorkApiResponse.code is required');
        }
        return value;
      })(),
      data: json['data'],
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('SdkWorkApiResponse.traceId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'code': code,
      'data': data,
      'traceId': traceId,
    };
  }
}
