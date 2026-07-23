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

class BirdCoderApplicationDescriptor {
  final String apiVersion;
  final BirdCoderApiGatewaySummary gateway;
  final String hostMode;
  final String moduleId;
  final String openApiPath;
  final List<String> surfaces;

  BirdCoderApplicationDescriptor({
    required this.apiVersion,
    required this.gateway,
    required this.hostMode,
    required this.moduleId,
    required this.openApiPath,
    required this.surfaces
  });

  factory BirdCoderApplicationDescriptor.fromJson(Map<String, dynamic> json) {
    return BirdCoderApplicationDescriptor(
      apiVersion: (() {
        final value = json['apiVersion']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApplicationDescriptor.apiVersion is required');
        }
        return value;
      })(),
      gateway: (() {
        final map = _sdkworkAsMap(json['gateway']);
        if (map == null) {
          throw FormatException('BirdCoderApplicationDescriptor.gateway is required');
        }
        return BirdCoderApiGatewaySummary.fromJson(map);
      })(),
      hostMode: (() {
        final value = json['hostMode']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApplicationDescriptor.hostMode is required');
        }
        return value;
      })(),
      moduleId: (() {
        final value = json['moduleId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApplicationDescriptor.moduleId is required');
        }
        return value;
      })(),
      openApiPath: (() {
        final value = json['openApiPath']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApplicationDescriptor.openApiPath is required');
        }
        return value;
      })(),
      surfaces: (() {
        final list = _sdkworkAsList(json['surfaces']);
        if (list == null) {
          throw FormatException('BirdCoderApplicationDescriptor.surfaces is required');
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

class BirdCoderApplicationDescriptorEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderApplicationDescriptorEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderApplicationDescriptorEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderApplicationDescriptorEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderApplicationDescriptorEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderApplicationDescriptorEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderApplicationDescriptorEnvelope.traceId is required');
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

class BirdCoderCommitProjectGitChangesRequest {
  final String runtimeLocationId;
  final bool? includeUnstaged;
  final String message;

  BirdCoderCommitProjectGitChangesRequest({
    required this.runtimeLocationId,
    this.includeUnstaged,
    required this.message
  });

  factory BirdCoderCommitProjectGitChangesRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCommitProjectGitChangesRequest(
      runtimeLocationId: (() {
        final value = json['runtimeLocationId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCommitProjectGitChangesRequest.runtimeLocationId is required');
        }
        return value;
      })(),
      includeUnstaged: json['includeUnstaged'] is bool ? json['includeUnstaged'] : null,
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
      'runtimeLocationId': runtimeLocationId,
      'includeUnstaged': includeUnstaged,
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

class BirdCoderCreateProjectDocumentBindingRequest {
  final String documentId;
  final String bindingKind;

  BirdCoderCreateProjectDocumentBindingRequest({
    required this.documentId,
    required this.bindingKind
  });

  factory BirdCoderCreateProjectDocumentBindingRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateProjectDocumentBindingRequest(
      documentId: (() {
        final value = json['documentId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateProjectDocumentBindingRequest.documentId is required');
        }
        return value;
      })(),
      bindingKind: (() {
        final value = json['bindingKind']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateProjectDocumentBindingRequest.bindingKind is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'documentId': documentId,
      'bindingKind': bindingKind,
    };
  }
}

class BirdCoderCreateProjectGitBranchRequest {
  final String runtimeLocationId;
  final String branchName;

  BirdCoderCreateProjectGitBranchRequest({
    required this.runtimeLocationId,
    required this.branchName
  });

  factory BirdCoderCreateProjectGitBranchRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateProjectGitBranchRequest(
      runtimeLocationId: (() {
        final value = json['runtimeLocationId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateProjectGitBranchRequest.runtimeLocationId is required');
        }
        return value;
      })(),
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
      'runtimeLocationId': runtimeLocationId,
      'branchName': branchName,
    };
  }
}

class BirdCoderCreateProjectGitWorktreeRequest {
  final String runtimeLocationId;
  final String branchName;

  BirdCoderCreateProjectGitWorktreeRequest({
    required this.runtimeLocationId,
    required this.branchName
  });

  factory BirdCoderCreateProjectGitWorktreeRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateProjectGitWorktreeRequest(
      runtimeLocationId: (() {
        final value = json['runtimeLocationId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateProjectGitWorktreeRequest.runtimeLocationId is required');
        }
        return value;
      })(),
      branchName: (() {
        final value = json['branchName']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateProjectGitWorktreeRequest.branchName is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'runtimeLocationId': runtimeLocationId,
      'branchName': branchName,
    };
  }
}

class BirdCoderCreateProjectRequest {
  final String workspaceId;
  final String name;
  final String? description;
  final String? code;
  final String? projectKind;
  final String? defaultAgentProjectId;

  BirdCoderCreateProjectRequest({
    required this.workspaceId,
    required this.name,
    this.description,
    this.code,
    this.projectKind,
    this.defaultAgentProjectId
  });

  factory BirdCoderCreateProjectRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateProjectRequest(
      workspaceId: (() {
        final value = json['workspaceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateProjectRequest.workspaceId is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateProjectRequest.name is required');
        }
        return value;
      })(),
      description: json['description']?.toString(),
      code: json['code']?.toString(),
      projectKind: json['projectKind']?.toString(),
      defaultAgentProjectId: json['defaultAgentProjectId']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'workspaceId': workspaceId,
      'name': name,
      'description': description,
      'code': code,
      'projectKind': projectKind,
      'defaultAgentProjectId': defaultAgentProjectId,
    };
  }
}

class BirdCoderCreateProjectRuntimeLocationRequest {
  final String runtimeTargetId;
  final String runtimeTargetKind;
  final String locationKind;
  final String pathFlavor;
  final String absolutePath;
  final String? displayName;

  BirdCoderCreateProjectRuntimeLocationRequest({
    required this.runtimeTargetId,
    required this.runtimeTargetKind,
    required this.locationKind,
    required this.pathFlavor,
    required this.absolutePath,
    this.displayName
  });

  factory BirdCoderCreateProjectRuntimeLocationRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateProjectRuntimeLocationRequest(
      runtimeTargetId: (() {
        final value = json['runtimeTargetId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateProjectRuntimeLocationRequest.runtimeTargetId is required');
        }
        return value;
      })(),
      runtimeTargetKind: (() {
        final value = json['runtimeTargetKind']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateProjectRuntimeLocationRequest.runtimeTargetKind is required');
        }
        return value;
      })(),
      locationKind: (() {
        final value = json['locationKind']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateProjectRuntimeLocationRequest.locationKind is required');
        }
        return value;
      })(),
      pathFlavor: (() {
        final value = json['pathFlavor']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateProjectRuntimeLocationRequest.pathFlavor is required');
        }
        return value;
      })(),
      absolutePath: (() {
        final value = json['absolutePath']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateProjectRuntimeLocationRequest.absolutePath is required');
        }
        return value;
      })(),
      displayName: json['displayName']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'runtimeTargetId': runtimeTargetId,
      'runtimeTargetKind': runtimeTargetKind,
      'locationKind': locationKind,
      'pathFlavor': pathFlavor,
      'absolutePath': absolutePath,
      'displayName': displayName,
    };
  }
}

class BirdCoderCreateWorkspaceRequest {
  final String name;
  final String? description;
  final String? code;
  final String? iconUrl;
  final String? color;
  final String? visibility;

  BirdCoderCreateWorkspaceRequest({
    required this.name,
    this.description,
    this.code,
    this.iconUrl,
    this.color,
    this.visibility
  });

  factory BirdCoderCreateWorkspaceRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderCreateWorkspaceRequest(
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderCreateWorkspaceRequest.name is required');
        }
        return value;
      })(),
      description: json['description']?.toString(),
      code: json['code']?.toString(),
      iconUrl: json['iconUrl']?.toString(),
      color: json['color']?.toString(),
      visibility: json['visibility']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'name': name,
      'description': description,
      'code': code,
      'iconUrl': iconUrl,
      'color': color,
      'visibility': visibility,
    };
  }
}

class BirdCoderGitBranchSummary {
  final bool isCurrent;
  final bool isRemote;
  final String name;

  BirdCoderGitBranchSummary({
    required this.isCurrent,
    required this.isRemote,
    required this.name
  });

  factory BirdCoderGitBranchSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderGitBranchSummary(
      isCurrent: (() {
        final value = json['isCurrent'];
        if (value is! bool) {
          throw FormatException('BirdCoderGitBranchSummary.isCurrent is required');
        }
        return value;
      })(),
      isRemote: (() {
        final value = json['isRemote'];
        if (value is! bool) {
          throw FormatException('BirdCoderGitBranchSummary.isRemote is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderGitBranchSummary.name is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'isCurrent': isCurrent,
      'isRemote': isRemote,
      'name': name,
    };
  }
}

class BirdCoderGitStatusCounts {
  final int staged;
  final int unstaged;
  final int untracked;

  BirdCoderGitStatusCounts({
    required this.staged,
    required this.unstaged,
    required this.untracked
  });

  factory BirdCoderGitStatusCounts.fromJson(Map<String, dynamic> json) {
    return BirdCoderGitStatusCounts(
      staged: (() {
        final value = json['staged'];
        if (value is! int) {
          throw FormatException('BirdCoderGitStatusCounts.staged is required');
        }
        return value;
      })(),
      unstaged: (() {
        final value = json['unstaged'];
        if (value is! int) {
          throw FormatException('BirdCoderGitStatusCounts.unstaged is required');
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
      'staged': staged,
      'unstaged': unstaged,
      'untracked': untracked,
    };
  }
}

class BirdCoderGitWorktreeSummary {
  final String? branch;
  final String? head;
  final bool isCurrent;
  final String? prunableReason;
  final String? worktreeKey;

  BirdCoderGitWorktreeSummary({
    this.branch,
    this.head,
    required this.isCurrent,
    this.prunableReason,
    this.worktreeKey
  });

  factory BirdCoderGitWorktreeSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderGitWorktreeSummary(
      branch: json['branch']?.toString(),
      head: json['head']?.toString(),
      isCurrent: (() {
        final value = json['isCurrent'];
        if (value is! bool) {
          throw FormatException('BirdCoderGitWorktreeSummary.isCurrent is required');
        }
        return value;
      })(),
      prunableReason: json['prunableReason']?.toString(),
      worktreeKey: json['worktreeKey']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'branch': branch,
      'head': head,
      'isCurrent': isCurrent,
      'prunableReason': prunableReason,
      'worktreeKey': worktreeKey,
    };
  }
}

class BirdCoderProjectDocumentBinding {
  final String id;
  final String uuid;
  final String projectId;
  final String documentId;
  final String bindingKind;
  final String version;
  final String createdAt;
  final String updatedAt;

  BirdCoderProjectDocumentBinding({
    required this.id,
    required this.uuid,
    required this.projectId,
    required this.documentId,
    required this.bindingKind,
    required this.version,
    required this.createdAt,
    required this.updatedAt
  });

  factory BirdCoderProjectDocumentBinding.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectDocumentBinding(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectDocumentBinding.id is required');
        }
        return value;
      })(),
      uuid: (() {
        final value = json['uuid']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectDocumentBinding.uuid is required');
        }
        return value;
      })(),
      projectId: (() {
        final value = json['projectId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectDocumentBinding.projectId is required');
        }
        return value;
      })(),
      documentId: (() {
        final value = json['documentId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectDocumentBinding.documentId is required');
        }
        return value;
      })(),
      bindingKind: (() {
        final value = json['bindingKind']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectDocumentBinding.bindingKind is required');
        }
        return value;
      })(),
      version: (() {
        final value = json['version']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectDocumentBinding.version is required');
        }
        return value;
      })(),
      createdAt: (() {
        final value = json['createdAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectDocumentBinding.createdAt is required');
        }
        return value;
      })(),
      updatedAt: (() {
        final value = json['updatedAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectDocumentBinding.updatedAt is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'uuid': uuid,
      'projectId': projectId,
      'documentId': documentId,
      'bindingKind': bindingKind,
      'version': version,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}

class BirdCoderProjectDocumentBindingEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderProjectDocumentBindingEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderProjectDocumentBindingEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectDocumentBindingEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderProjectDocumentBindingEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderProjectDocumentBindingEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectDocumentBindingEnvelope.traceId is required');
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

class BirdCoderProjectDocumentBindingListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderProjectDocumentBindingListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderProjectDocumentBindingListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectDocumentBindingListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderProjectDocumentBindingListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderProjectDocumentBindingListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectDocumentBindingListEnvelope.traceId is required');
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

class BirdCoderProjectGitDiff {
  final String patch;
  final bool truncated;

  BirdCoderProjectGitDiff({
    required this.patch,
    required this.truncated
  });

  factory BirdCoderProjectGitDiff.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectGitDiff(
      patch: (() {
        final value = json['patch']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectGitDiff.patch is required');
        }
        return value;
      })(),
      truncated: (() {
        final value = json['truncated'];
        if (value is! bool) {
          throw FormatException('BirdCoderProjectGitDiff.truncated is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'patch': patch,
      'truncated': truncated,
    };
  }
}

class BirdCoderProjectGitDiffEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderProjectGitDiffEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderProjectGitDiffEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectGitDiffEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderProjectGitDiffEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderProjectGitDiffEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectGitDiffEnvelope.traceId is required');
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
  final bool detachedHead;
  final String status;
  final BirdCoderGitStatusCounts statusCounts;
  final List<BirdCoderGitWorktreeSummary> worktrees;

  BirdCoderProjectGitOverview({
    required this.branches,
    this.currentBranch,
    this.currentRevision,
    required this.detachedHead,
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
      detachedHead: (() {
        final value = json['detachedHead'];
        if (value is! bool) {
          throw FormatException('BirdCoderProjectGitOverview.detachedHead is required');
        }
        return value;
      })(),
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
      'detachedHead': detachedHead,
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

class BirdCoderProjectRuntimeLocation {
  final String id;
  final String uuid;
  final String projectId;
  final String runtimeTargetId;
  final String runtimeTargetKind;
  final String locationKind;
  final String pathFlavor;
  final String displayName;
  final bool terminalAvailable;
  final bool gitAvailable;
  final bool buildAvailable;
  final bool filesystemAvailable;
  final String healthStatus;
  final String? lastVerifiedAt;
  final String? lastSeenAt;
  final String version;
  final String createdAt;
  final String updatedAt;

  BirdCoderProjectRuntimeLocation({
    required this.id,
    required this.uuid,
    required this.projectId,
    required this.runtimeTargetId,
    required this.runtimeTargetKind,
    required this.locationKind,
    required this.pathFlavor,
    required this.displayName,
    required this.terminalAvailable,
    required this.gitAvailable,
    required this.buildAvailable,
    required this.filesystemAvailable,
    required this.healthStatus,
    this.lastVerifiedAt,
    this.lastSeenAt,
    required this.version,
    required this.createdAt,
    required this.updatedAt
  });

  factory BirdCoderProjectRuntimeLocation.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectRuntimeLocation(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocation.id is required');
        }
        return value;
      })(),
      uuid: (() {
        final value = json['uuid']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocation.uuid is required');
        }
        return value;
      })(),
      projectId: (() {
        final value = json['projectId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocation.projectId is required');
        }
        return value;
      })(),
      runtimeTargetId: (() {
        final value = json['runtimeTargetId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocation.runtimeTargetId is required');
        }
        return value;
      })(),
      runtimeTargetKind: (() {
        final value = json['runtimeTargetKind']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocation.runtimeTargetKind is required');
        }
        return value;
      })(),
      locationKind: (() {
        final value = json['locationKind']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocation.locationKind is required');
        }
        return value;
      })(),
      pathFlavor: (() {
        final value = json['pathFlavor']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocation.pathFlavor is required');
        }
        return value;
      })(),
      displayName: (() {
        final value = json['displayName']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocation.displayName is required');
        }
        return value;
      })(),
      terminalAvailable: (() {
        final value = json['terminalAvailable'];
        if (value is! bool) {
          throw FormatException('BirdCoderProjectRuntimeLocation.terminalAvailable is required');
        }
        return value;
      })(),
      gitAvailable: (() {
        final value = json['gitAvailable'];
        if (value is! bool) {
          throw FormatException('BirdCoderProjectRuntimeLocation.gitAvailable is required');
        }
        return value;
      })(),
      buildAvailable: (() {
        final value = json['buildAvailable'];
        if (value is! bool) {
          throw FormatException('BirdCoderProjectRuntimeLocation.buildAvailable is required');
        }
        return value;
      })(),
      filesystemAvailable: (() {
        final value = json['filesystemAvailable'];
        if (value is! bool) {
          throw FormatException('BirdCoderProjectRuntimeLocation.filesystemAvailable is required');
        }
        return value;
      })(),
      healthStatus: (() {
        final value = json['healthStatus']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocation.healthStatus is required');
        }
        return value;
      })(),
      lastVerifiedAt: json['lastVerifiedAt']?.toString(),
      lastSeenAt: json['lastSeenAt']?.toString(),
      version: (() {
        final value = json['version']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocation.version is required');
        }
        return value;
      })(),
      createdAt: (() {
        final value = json['createdAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocation.createdAt is required');
        }
        return value;
      })(),
      updatedAt: (() {
        final value = json['updatedAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocation.updatedAt is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'uuid': uuid,
      'projectId': projectId,
      'runtimeTargetId': runtimeTargetId,
      'runtimeTargetKind': runtimeTargetKind,
      'locationKind': locationKind,
      'pathFlavor': pathFlavor,
      'displayName': displayName,
      'terminalAvailable': terminalAvailable,
      'gitAvailable': gitAvailable,
      'buildAvailable': buildAvailable,
      'filesystemAvailable': filesystemAvailable,
      'healthStatus': healthStatus,
      'lastVerifiedAt': lastVerifiedAt,
      'lastSeenAt': lastSeenAt,
      'version': version,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}

class BirdCoderProjectRuntimeLocationCommandAccepted {
  final bool accepted;
  final String resourceId;
  final String status;

  BirdCoderProjectRuntimeLocationCommandAccepted({
    required this.accepted,
    required this.resourceId,
    required this.status
  });

  factory BirdCoderProjectRuntimeLocationCommandAccepted.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectRuntimeLocationCommandAccepted(
      accepted: (() {
        final value = json['accepted'];
        if (value is! bool) {
          throw FormatException('BirdCoderProjectRuntimeLocationCommandAccepted.accepted is required');
        }
        return value;
      })(),
      resourceId: (() {
        final value = json['resourceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocationCommandAccepted.resourceId is required');
        }
        return value;
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocationCommandAccepted.status is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'accepted': accepted,
      'resourceId': resourceId,
      'status': status,
    };
  }
}

class BirdCoderProjectRuntimeLocationCommandEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderProjectRuntimeLocationCommandEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderProjectRuntimeLocationCommandEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectRuntimeLocationCommandEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderProjectRuntimeLocationCommandEnvelope.code is required');
        }
        return value;
      })(),
      data: json['data'],
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocationCommandEnvelope.traceId is required');
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

class BirdCoderProjectRuntimeLocationEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderProjectRuntimeLocationEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderProjectRuntimeLocationEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectRuntimeLocationEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderProjectRuntimeLocationEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderProjectRuntimeLocationEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocationEnvelope.traceId is required');
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

class BirdCoderProjectRuntimeLocationListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderProjectRuntimeLocationListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderProjectRuntimeLocationListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectRuntimeLocationListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderProjectRuntimeLocationListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderProjectRuntimeLocationListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocationListEnvelope.traceId is required');
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

class BirdCoderProjectRuntimeLocationPreference {
  final String id;
  final String projectId;
  final String subjectUserId;
  final String capability;
  final String runtimeLocationId;
  final String version;
  final String createdAt;
  final String updatedAt;

  BirdCoderProjectRuntimeLocationPreference({
    required this.id,
    required this.projectId,
    required this.subjectUserId,
    required this.capability,
    required this.runtimeLocationId,
    required this.version,
    required this.createdAt,
    required this.updatedAt
  });

  factory BirdCoderProjectRuntimeLocationPreference.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectRuntimeLocationPreference(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocationPreference.id is required');
        }
        return value;
      })(),
      projectId: (() {
        final value = json['projectId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocationPreference.projectId is required');
        }
        return value;
      })(),
      subjectUserId: (() {
        final value = json['subjectUserId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocationPreference.subjectUserId is required');
        }
        return value;
      })(),
      capability: (() {
        final value = json['capability']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocationPreference.capability is required');
        }
        return value;
      })(),
      runtimeLocationId: (() {
        final value = json['runtimeLocationId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocationPreference.runtimeLocationId is required');
        }
        return value;
      })(),
      version: (() {
        final value = json['version']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocationPreference.version is required');
        }
        return value;
      })(),
      createdAt: (() {
        final value = json['createdAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocationPreference.createdAt is required');
        }
        return value;
      })(),
      updatedAt: (() {
        final value = json['updatedAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocationPreference.updatedAt is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'projectId': projectId,
      'subjectUserId': subjectUserId,
      'capability': capability,
      'runtimeLocationId': runtimeLocationId,
      'version': version,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}

class BirdCoderProjectRuntimeLocationPreferenceEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderProjectRuntimeLocationPreferenceEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderProjectRuntimeLocationPreferenceEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectRuntimeLocationPreferenceEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderProjectRuntimeLocationPreferenceEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderProjectRuntimeLocationPreferenceEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocationPreferenceEnvelope.traceId is required');
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

class BirdCoderProjectRuntimeLocationPreferenceListEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderProjectRuntimeLocationPreferenceListEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderProjectRuntimeLocationPreferenceListEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectRuntimeLocationPreferenceListEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderProjectRuntimeLocationPreferenceListEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderProjectRuntimeLocationPreferenceListEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectRuntimeLocationPreferenceListEnvelope.traceId is required');
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

class BirdCoderProjectSandboxBinding {
  final String id;
  final String projectId;
  final String sandboxId;
  final String rootEntryId;
  final String logicalPath;
  final String status;
  final String version;
  final String createdAt;
  final String updatedAt;

  BirdCoderProjectSandboxBinding({
    required this.id,
    required this.projectId,
    required this.sandboxId,
    required this.rootEntryId,
    required this.logicalPath,
    required this.status,
    required this.version,
    required this.createdAt,
    required this.updatedAt
  });

  factory BirdCoderProjectSandboxBinding.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectSandboxBinding(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSandboxBinding.id is required');
        }
        return value;
      })(),
      projectId: (() {
        final value = json['projectId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSandboxBinding.projectId is required');
        }
        return value;
      })(),
      sandboxId: (() {
        final value = json['sandboxId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSandboxBinding.sandboxId is required');
        }
        return value;
      })(),
      rootEntryId: (() {
        final value = json['rootEntryId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSandboxBinding.rootEntryId is required');
        }
        return value;
      })(),
      logicalPath: (() {
        final value = json['logicalPath']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSandboxBinding.logicalPath is required');
        }
        return value;
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSandboxBinding.status is required');
        }
        return value;
      })(),
      version: (() {
        final value = json['version']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSandboxBinding.version is required');
        }
        return value;
      })(),
      createdAt: (() {
        final value = json['createdAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSandboxBinding.createdAt is required');
        }
        return value;
      })(),
      updatedAt: (() {
        final value = json['updatedAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSandboxBinding.updatedAt is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'projectId': projectId,
      'sandboxId': sandboxId,
      'rootEntryId': rootEntryId,
      'logicalPath': logicalPath,
      'status': status,
      'version': version,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}

class BirdCoderProjectSandboxBindingEnvelope {
  final int code;
  final dynamic data;
  final String traceId;

  BirdCoderProjectSandboxBindingEnvelope({
    required this.code,
    required this.data,
    required this.traceId
  });

  factory BirdCoderProjectSandboxBindingEnvelope.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectSandboxBindingEnvelope(
      code: (() {
        final value = json['code'];
        if (value is! int) {
          throw FormatException('BirdCoderProjectSandboxBindingEnvelope.code is required');
        }
        return value;
      })(),
      data: (() {
        final map = _sdkworkAsMap(json['data']);
        if (map == null) {
          throw FormatException('BirdCoderProjectSandboxBindingEnvelope.data is required');
        }
        return map;
      })(),
      traceId: (() {
        final value = json['traceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSandboxBindingEnvelope.traceId is required');
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
  final String id;
  final String uuid;
  final String tenantId;
  final String organizationId;
  final String workspaceId;
  final String ownerUserId;
  final String createdByUserId;
  final String code;
  final String name;
  final String description;
  final String projectKind;
  final String defaultAgentProjectId;
  final String status;
  final String version;
  final String createdAt;
  final String updatedAt;

  BirdCoderProjectSummary({
    required this.id,
    required this.uuid,
    required this.tenantId,
    required this.organizationId,
    required this.workspaceId,
    required this.ownerUserId,
    required this.createdByUserId,
    required this.code,
    required this.name,
    required this.description,
    required this.projectKind,
    required this.defaultAgentProjectId,
    required this.status,
    required this.version,
    required this.createdAt,
    required this.updatedAt
  });

  factory BirdCoderProjectSummary.fromJson(Map<String, dynamic> json) {
    return BirdCoderProjectSummary(
      id: (() {
        final value = json['id']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummary.id is required');
        }
        return value;
      })(),
      uuid: (() {
        final value = json['uuid']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummary.uuid is required');
        }
        return value;
      })(),
      tenantId: (() {
        final value = json['tenantId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummary.tenantId is required');
        }
        return value;
      })(),
      organizationId: (() {
        final value = json['organizationId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummary.organizationId is required');
        }
        return value;
      })(),
      workspaceId: (() {
        final value = json['workspaceId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummary.workspaceId is required');
        }
        return value;
      })(),
      ownerUserId: (() {
        final value = json['ownerUserId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummary.ownerUserId is required');
        }
        return value;
      })(),
      createdByUserId: (() {
        final value = json['createdByUserId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummary.createdByUserId is required');
        }
        return value;
      })(),
      code: (() {
        final value = json['code']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummary.code is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummary.name is required');
        }
        return value;
      })(),
      description: (() {
        final value = json['description']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummary.description is required');
        }
        return value;
      })(),
      projectKind: (() {
        final value = json['projectKind']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummary.projectKind is required');
        }
        return value;
      })(),
      defaultAgentProjectId: (() {
        final value = json['defaultAgentProjectId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummary.defaultAgentProjectId is required');
        }
        return value;
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummary.status is required');
        }
        return value;
      })(),
      version: (() {
        final value = json['version']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummary.version is required');
        }
        return value;
      })(),
      createdAt: (() {
        final value = json['createdAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummary.createdAt is required');
        }
        return value;
      })(),
      updatedAt: (() {
        final value = json['updatedAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderProjectSummary.updatedAt is required');
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
      'workspaceId': workspaceId,
      'ownerUserId': ownerUserId,
      'createdByUserId': createdByUserId,
      'code': code,
      'name': name,
      'description': description,
      'projectKind': projectKind,
      'defaultAgentProjectId': defaultAgentProjectId,
      'status': status,
      'version': version,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
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

class BirdCoderPruneProjectGitWorktreesRequest {
  final String runtimeLocationId;

  BirdCoderPruneProjectGitWorktreesRequest({
    required this.runtimeLocationId
  });

  factory BirdCoderPruneProjectGitWorktreesRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderPruneProjectGitWorktreesRequest(
      runtimeLocationId: (() {
        final value = json['runtimeLocationId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderPruneProjectGitWorktreesRequest.runtimeLocationId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'runtimeLocationId': runtimeLocationId,
    };
  }
}

class BirdCoderPushProjectGitBranchRequest {
  final String runtimeLocationId;
  final String? branchName;
  final String? remoteName;

  BirdCoderPushProjectGitBranchRequest({
    required this.runtimeLocationId,
    this.branchName,
    this.remoteName
  });

  factory BirdCoderPushProjectGitBranchRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderPushProjectGitBranchRequest(
      runtimeLocationId: (() {
        final value = json['runtimeLocationId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderPushProjectGitBranchRequest.runtimeLocationId is required');
        }
        return value;
      })(),
      branchName: json['branchName']?.toString(),
      remoteName: json['remoteName']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'runtimeLocationId': runtimeLocationId,
      'branchName': branchName,
      'remoteName': remoteName,
    };
  }
}

class BirdCoderRebindProjectRuntimeLocationRequest {
  final String pathFlavor;
  final String absolutePath;
  final String? displayName;

  BirdCoderRebindProjectRuntimeLocationRequest({
    required this.pathFlavor,
    required this.absolutePath,
    this.displayName
  });

  factory BirdCoderRebindProjectRuntimeLocationRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderRebindProjectRuntimeLocationRequest(
      pathFlavor: (() {
        final value = json['pathFlavor']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderRebindProjectRuntimeLocationRequest.pathFlavor is required');
        }
        return value;
      })(),
      absolutePath: (() {
        final value = json['absolutePath']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderRebindProjectRuntimeLocationRequest.absolutePath is required');
        }
        return value;
      })(),
      displayName: json['displayName']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'pathFlavor': pathFlavor,
      'absolutePath': absolutePath,
      'displayName': displayName,
    };
  }
}

class BirdCoderRemoveProjectGitWorktreeRequest {
  final String runtimeLocationId;
  final bool? force;
  final String worktreeKey;

  BirdCoderRemoveProjectGitWorktreeRequest({
    required this.runtimeLocationId,
    this.force,
    required this.worktreeKey
  });

  factory BirdCoderRemoveProjectGitWorktreeRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderRemoveProjectGitWorktreeRequest(
      runtimeLocationId: (() {
        final value = json['runtimeLocationId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderRemoveProjectGitWorktreeRequest.runtimeLocationId is required');
        }
        return value;
      })(),
      force: json['force'] is bool ? json['force'] : null,
      worktreeKey: (() {
        final value = json['worktreeKey']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderRemoveProjectGitWorktreeRequest.worktreeKey is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'runtimeLocationId': runtimeLocationId,
      'force': force,
      'worktreeKey': worktreeKey,
    };
  }
}

class BirdCoderSetProjectRuntimeLocationPreferenceRequest {
  final String runtimeLocationId;

  BirdCoderSetProjectRuntimeLocationPreferenceRequest({
    required this.runtimeLocationId
  });

  factory BirdCoderSetProjectRuntimeLocationPreferenceRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderSetProjectRuntimeLocationPreferenceRequest(
      runtimeLocationId: (() {
        final value = json['runtimeLocationId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSetProjectRuntimeLocationPreferenceRequest.runtimeLocationId is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'runtimeLocationId': runtimeLocationId,
    };
  }
}

class BirdCoderSwitchProjectGitBranchRequest {
  final String runtimeLocationId;
  final String branchName;

  BirdCoderSwitchProjectGitBranchRequest({
    required this.runtimeLocationId,
    required this.branchName
  });

  factory BirdCoderSwitchProjectGitBranchRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderSwitchProjectGitBranchRequest(
      runtimeLocationId: (() {
        final value = json['runtimeLocationId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderSwitchProjectGitBranchRequest.runtimeLocationId is required');
        }
        return value;
      })(),
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
      'runtimeLocationId': runtimeLocationId,
      'branchName': branchName,
    };
  }
}

class BirdCoderUpdateProjectRequest {
  final String? name;
  final String? description;
  final String? code;
  final String? projectKind;
  final String? defaultAgentProjectId;
  final String? status;

  BirdCoderUpdateProjectRequest({
    this.name,
    this.description,
    this.code,
    this.projectKind,
    this.defaultAgentProjectId,
    this.status
  });

  factory BirdCoderUpdateProjectRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderUpdateProjectRequest(
      name: json['name']?.toString(),
      description: json['description']?.toString(),
      code: json['code']?.toString(),
      projectKind: json['projectKind']?.toString(),
      defaultAgentProjectId: json['defaultAgentProjectId']?.toString(),
      status: json['status']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'name': name,
      'description': description,
      'code': code,
      'projectKind': projectKind,
      'defaultAgentProjectId': defaultAgentProjectId,
      'status': status,
    };
  }
}

class BirdCoderUpdateProjectRuntimeLocationRequest {
  final String? displayName;

  BirdCoderUpdateProjectRuntimeLocationRequest({
    this.displayName
  });

  factory BirdCoderUpdateProjectRuntimeLocationRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderUpdateProjectRuntimeLocationRequest(
      displayName: json['displayName']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'displayName': displayName,
    };
  }
}

class BirdCoderUpdateWorkspaceRequest {
  final String? name;
  final String? description;
  final String? code;
  final String? iconUrl;
  final String? color;
  final String? visibility;
  final String? status;

  BirdCoderUpdateWorkspaceRequest({
    this.name,
    this.description,
    this.code,
    this.iconUrl,
    this.color,
    this.visibility,
    this.status
  });

  factory BirdCoderUpdateWorkspaceRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderUpdateWorkspaceRequest(
      name: json['name']?.toString(),
      description: json['description']?.toString(),
      code: json['code']?.toString(),
      iconUrl: json['iconUrl']?.toString(),
      color: json['color']?.toString(),
      visibility: json['visibility']?.toString(),
      status: json['status']?.toString()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'name': name,
      'description': description,
      'code': code,
      'iconUrl': iconUrl,
      'color': color,
      'visibility': visibility,
      'status': status,
    };
  }
}

class BirdCoderUpsertProjectSandboxBindingRequest {
  final String sandboxId;
  final String rootEntryId;
  final String logicalPath;

  BirdCoderUpsertProjectSandboxBindingRequest({
    required this.sandboxId,
    required this.rootEntryId,
    required this.logicalPath
  });

  factory BirdCoderUpsertProjectSandboxBindingRequest.fromJson(Map<String, dynamic> json) {
    return BirdCoderUpsertProjectSandboxBindingRequest(
      sandboxId: (() {
        final value = json['sandboxId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderUpsertProjectSandboxBindingRequest.sandboxId is required');
        }
        return value;
      })(),
      rootEntryId: (() {
        final value = json['rootEntryId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderUpsertProjectSandboxBindingRequest.rootEntryId is required');
        }
        return value;
      })(),
      logicalPath: (() {
        final value = json['logicalPath']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderUpsertProjectSandboxBindingRequest.logicalPath is required');
        }
        return value;
      })()
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'sandboxId': sandboxId,
      'rootEntryId': rootEntryId,
      'logicalPath': logicalPath,
    };
  }
}

class BirdCoderWorkspaceSummary {
  final String id;
  final String uuid;
  final String tenantId;
  final String organizationId;
  final String ownerUserId;
  final String createdByUserId;
  final String code;
  final String name;
  final String description;
  final String iconUrl;
  final String color;
  final String visibility;
  final String status;
  final String version;
  final String createdAt;
  final String updatedAt;

  BirdCoderWorkspaceSummary({
    required this.id,
    required this.uuid,
    required this.tenantId,
    required this.organizationId,
    required this.ownerUserId,
    required this.createdByUserId,
    required this.code,
    required this.name,
    required this.description,
    required this.iconUrl,
    required this.color,
    required this.visibility,
    required this.status,
    required this.version,
    required this.createdAt,
    required this.updatedAt
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
      uuid: (() {
        final value = json['uuid']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceSummary.uuid is required');
        }
        return value;
      })(),
      tenantId: (() {
        final value = json['tenantId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceSummary.tenantId is required');
        }
        return value;
      })(),
      organizationId: (() {
        final value = json['organizationId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceSummary.organizationId is required');
        }
        return value;
      })(),
      ownerUserId: (() {
        final value = json['ownerUserId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceSummary.ownerUserId is required');
        }
        return value;
      })(),
      createdByUserId: (() {
        final value = json['createdByUserId']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceSummary.createdByUserId is required');
        }
        return value;
      })(),
      code: (() {
        final value = json['code']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceSummary.code is required');
        }
        return value;
      })(),
      name: (() {
        final value = json['name']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceSummary.name is required');
        }
        return value;
      })(),
      description: (() {
        final value = json['description']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceSummary.description is required');
        }
        return value;
      })(),
      iconUrl: (() {
        final value = json['iconUrl']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceSummary.iconUrl is required');
        }
        return value;
      })(),
      color: (() {
        final value = json['color']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceSummary.color is required');
        }
        return value;
      })(),
      visibility: (() {
        final value = json['visibility']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceSummary.visibility is required');
        }
        return value;
      })(),
      status: (() {
        final value = json['status']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceSummary.status is required');
        }
        return value;
      })(),
      version: (() {
        final value = json['version']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceSummary.version is required');
        }
        return value;
      })(),
      createdAt: (() {
        final value = json['createdAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceSummary.createdAt is required');
        }
        return value;
      })(),
      updatedAt: (() {
        final value = json['updatedAt']?.toString();
        if (value == null) {
          throw FormatException('BirdCoderWorkspaceSummary.updatedAt is required');
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
      'ownerUserId': ownerUserId,
      'createdByUserId': createdByUserId,
      'code': code,
      'name': name,
      'description': description,
      'iconUrl': iconUrl,
      'color': color,
      'visibility': visibility,
      'status': status,
      'version': version,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
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
