import type {
  ChatCanonicalEvent,
  ChatMessage,
  ChatOptions,
} from '@sdkwork/birdcoder-pc-projection';
import {
  buildDefaultBirdCoderCodeEngineModelConfig,
  createBirdCoderCodeEngineModelConfigSyncPlan,
  getBirdCoderCodeEngineCapabilities,
  getBirdCoderCodeEngineDescriptor,
  listBirdCoderCodeEngineNativeSessionProviders,
  listBirdCoderCodeEngineDescriptors,
  listBirdCoderCodeEngineModels,
} from '@sdkwork/birdcoder-pc-codeengine';
import { createWorkbenchServerSessionEngineBinding } from '@sdkwork/birdcoder-pc-codeengine/serverRuntime';
import {
  resolveTransportKindForRuntimeMode,
} from '@sdkwork/birdcoder-pc-projection';
import {
  BIRDCODER_DEFAULT_LOCAL_API_BASE_URL,
  BIRDCODER_DEFAULT_LOCAL_API_HOST,
  BIRDCODER_DEFAULT_LOCAL_API_PORT,
  createBirdHostDescriptorFromDistribution,
  type BirdHostDescriptor,
} from '@sdkwork/birdcoder-pc-host-core';
import {
  SDKWORK_IAM_HEADERS,
  SDKWORK_IAM_OPERATION_IDS,
} from '@sdkwork/iam-contracts';
import type {
  BirdCoderApiEnvelope,
  BirdCoderApiGatewaySummary,
  BirdCoderApiRouteCatalogEntry,
  BirdCoderApiRouteDefinition,
  BirdCoderBackendApiContract,
  BirdCoderApiSurface,
  BirdCoderAppApiContract,
  BirdCoderApprovalDecisionResult,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineDescriptor,
  BirdCoderCodingServerDescriptor,
  BirdCoderCodeEngineModelConfig,
  BirdCoderCodeEngineModelConfigSyncResult,
  BirdCoderAppRuntimeApiContract,
  BirdCoderModelCatalogEntry,
  BirdCoderNativeSessionProviderSummary,
  BirdCoderOperationDescriptor,
  BirdCoderCodingSessionArtifact,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionRuntime,
  BirdCoderHostMode,
  BirdCoderUserQuestionAnswerResult,
} from '@sdkwork/birdcoder-pc-types';
import type {
  BirdCoderAppSdkApiClient,
  BirdCoderBackendSdkApiClient,
} from '@sdkwork/birdcoder-pc-infrastructure/services/sdkClients';
import { createBirdCoderServerRequestId } from './serverRequestId.ts';
import {
  BIRDCODER_CODING_SERVER_API_VERSION as BIRDCODER_CODING_SERVER_API_VERSION_VALUE,
  BIRDCODER_CODING_SESSION_ARTIFACT_KINDS,
  BIRDCODER_CODING_SESSION_EVENT_KINDS,
  BIRDCODER_CODING_SESSION_MESSAGE_ROLES,
  BIRDCODER_CODING_SESSION_RUNTIME_STATUSES,
  BIRDCODER_CODING_SESSION_STATUSES,
  BIRDCODER_DATA_SCOPES,
  BIRDCODER_ENGINE_INTEGRATION_CLASSES,
  BIRDCODER_ENGINE_RUNTIME_MODES,
  BIRDCODER_HOST_MODES,
  stringifyBirdCoderLongInteger,
} from '@sdkwork/birdcoder-pc-types';
import {
  BIRDCODER_API_AUTH_MODES,
  BIRDCODER_API_HTTP_METHODS,
  BIRDCODER_API_SURFACE_NAMES,
  BIRDCODER_APPROVAL_DECISIONS,
  BIRDCODER_CODING_SESSION_ARTIFACT_STATUSES,
  BIRDCODER_CODING_SESSION_CHECKPOINT_KINDS,
  BIRDCODER_CODING_SESSION_TURN_REQUEST_KINDS,
  BIRDCODER_CODING_SESSION_TURN_STATUSES,
  BIRDCODER_CODING_SERVER_API_VERSION,
  BIRDCODER_CODING_SERVER_DOCS_PATH,
  BIRDCODER_CODING_SERVER_LIVE_OPENAPI_PATH,
  BIRDCODER_CODING_SERVER_OPENAPI_PATH,
  BIRDCODER_CODING_SERVER_ROUTE_CATALOG_PATH,
  BIRDCODER_COLLABORATION_ROLES,
  BIRDCODER_COLLABORATION_STATUSES,
  BIRDCODER_DEPLOYMENT_RECORD_STATUSES,
  BIRDCODER_DOCUMENT_KINDS,
  BIRDCODER_DOCUMENT_STATUSES,
  BIRDCODER_GIT_OVERVIEW_STATUSES,
  BIRDCODER_IAM_DEVICE_TYPES,
  BIRDCODER_IAM_LOGIN_METHODS,
  BIRDCODER_IAM_PASSWORD_RESET_CHANNELS,
  BIRDCODER_IAM_QR_AUTH_STATUSES,
  BIRDCODER_IAM_RECOVERY_METHODS,
  BIRDCODER_IAM_REGISTER_METHODS,
  BIRDCODER_IAM_VERIFY_SCENES,
  BIRDCODER_IAM_VERIFY_TYPES,
  BIRDCODER_MODEL_STATUSES,
  BIRDCODER_OPERATION_STATUSES,
  BIRDCODER_RELEASE_KINDS,
  BIRDCODER_RELEASE_STATUSES,
  BIRDCODER_STREAM_KINDS,
  BIRDCODER_WORKSPACE_RESOURCE_STATUSES,
  type BirdServerDistributionId,
} from './serverConstants.ts';
import type {
  BirdCoderCodingServerOpenApiDocument,
  BirdCoderOpenApiOperationDefinition,
  BirdCoderOpenApiParameterObject,
  BirdCoderOpenApiRequestBodyObject,
  BirdCoderOpenApiResponseObject,
  BirdCoderOpenApiSchema,
} from './openApiDocumentTypes.ts';
import {
  buildOpenApiOperationDescription,
  buildOpenApiOperationSecurity,
  buildOpenApiGovernanceMetadata,
  getOpenApiTagDescription,
  getOpenApiTagForOperationId,
  getOperationIdForRoute,
  toOpenApiPathTemplate,
} from './serverRuntime.ts';
import {
  buildBirdCoderApiGatewaySummary,
  listBirdCoderCodingServerRoutes,
} from './routeCatalog.ts';
import { listBirdCoderCodingServerEngines } from './domainQueries.ts';

export function createOpenApiSchemaReference(schemaName: string): BirdCoderOpenApiSchema {
  return {
    $ref: `#/components/schemas/${schemaName}`,
  };
}

export function createOpenApiJsonContent(schema: BirdCoderOpenApiSchema) {
  return {
    'application/json': {
      schema,
    },
  } as const;
}

export function createOpenApiProblemJsonContent(schema: BirdCoderOpenApiSchema) {
  return {
    'application/problem+json': {
      schema,
    },
  } as const;
}

export function createOpenApiResponse(
  description: string,
  schema?: BirdCoderOpenApiSchema,
): BirdCoderOpenApiResponseObject {
  return schema
    ? {
        description,
        content: createOpenApiJsonContent(schema),
      }
    : {
        description,
      };
}

export function createOpenApiRequestBody(
  schema: BirdCoderOpenApiSchema,
  required = true,
): BirdCoderOpenApiRequestBodyObject {
  return {
    required,
    content: createOpenApiJsonContent(schema),
  };
}

export function createOpenApiObjectSchema(
  properties: Record<string, BirdCoderOpenApiSchema>,
  options: {
    additionalProperties?: BirdCoderOpenApiSchema | boolean;
    description?: string;
    required?: readonly string[];
  } = {},
): BirdCoderOpenApiSchema {
  return {
    type: 'object',
    properties,
    ...(options.required && options.required.length > 0
      ? { required: [...options.required] }
      : {}),
    ...(options.description ? { description: options.description } : {}),
    ...(options.additionalProperties === undefined
      ? { additionalProperties: false }
      : { additionalProperties: options.additionalProperties }),
  };
}

export function createOpenApiStringSchema(description?: string): BirdCoderOpenApiSchema {
  return {
    type: 'string',
    ...(description ? { description } : {}),
  };
}

export function createOpenApiLongIntegerStringSchema(description?: string): BirdCoderOpenApiSchema {
  return createOpenApiStringSchema(
    description ?? 'Java Long/BIGINT value serialized as an exact decimal string.',
  );
}

export function createOpenApiDateTimeSchema(description?: string): BirdCoderOpenApiSchema {
  return {
    type: 'string',
    format: 'date-time',
    ...(description ? { description } : {}),
  };
}

export function createOpenApiNullableSchema(
  schema: BirdCoderOpenApiSchema,
  description?: string,
): BirdCoderOpenApiSchema {
  return {
    anyOf: [schema, { type: 'null' }],
    ...(description ? { description } : {}),
  };
}

export function createOpenApiNullableStringSchema(description?: string): BirdCoderOpenApiSchema {
  return createOpenApiNullableSchema({ type: 'string' }, description);
}

export function createOpenApiIntegerSchema(minimum?: number): BirdCoderOpenApiSchema {
  return {
    type: 'integer',
    ...(typeof minimum === 'number' ? { minimum } : {}),
  };
}

export function createOpenApiNumberSchema(description?: string): BirdCoderOpenApiSchema {
  return {
    type: 'number',
    ...(description ? { description } : {}),
  };
}

export function createOpenApiBooleanSchema(description?: string): BirdCoderOpenApiSchema {
  return {
    type: 'boolean',
    ...(description ? { description } : {}),
  };
}

export function createOpenApiStringEnumSchema(
  values: readonly string[],
  description?: string,
): BirdCoderOpenApiSchema {
  const enumValues = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return enumValues.length > 0
    ? {
        type: 'string',
        enum: enumValues,
        ...(description ? { description } : {}),
      }
    : createOpenApiStringSchema(description);
}

export function createOpenApiDataScopeSchema(): BirdCoderOpenApiSchema {
  return createOpenApiStringEnumSchema(
    BIRDCODER_DATA_SCOPES,
    'DATABASE_SPEC.md standard data scope.',
  );
}

export function createOpenApiArraySchema(
  items: BirdCoderOpenApiSchema,
  description?: string,
): BirdCoderOpenApiSchema {
  return {
    type: 'array',
    items,
    ...(description ? { description } : {}),
  };
}

export function createOpenApiEnvelopeSchema(dataSchema: BirdCoderOpenApiSchema): BirdCoderOpenApiSchema {
  return createOpenApiObjectSchema(
    {
      data: dataSchema,
      meta: createOpenApiSchemaReference('BirdCoderApiMeta'),
      requestId: createOpenApiStringSchema('Server-generated request correlation identifier.'),
      timestamp: createOpenApiDateTimeSchema('Response emission timestamp.'),
    },
    {
      required: ['requestId', 'timestamp', 'data', 'meta'],
    },
  );
}

export function createOpenApiListEnvelopeSchema(itemSchema: BirdCoderOpenApiSchema): BirdCoderOpenApiSchema {
  return createOpenApiObjectSchema(
    {
      items: createOpenApiArraySchema(itemSchema),
      meta: createOpenApiSchemaReference('BirdCoderApiListMeta'),
      requestId: createOpenApiStringSchema('Server-generated request correlation identifier.'),
      timestamp: createOpenApiDateTimeSchema('Response emission timestamp.'),
    },
    {
      required: ['requestId', 'timestamp', 'items', 'meta'],
    },
  );
}

export function createOpenApiPathParameter(
  name: string,
  description: string,
): BirdCoderOpenApiParameterObject {
  return {
    name,
    in: 'path',
    required: true,
    description,
    schema: createOpenApiStringSchema(),
  };
}

export function createOpenApiQueryParameter(
  name: string,
  description: string,
  schema: BirdCoderOpenApiSchema,
): BirdCoderOpenApiParameterObject {
  return {
    name,
    in: 'query',
    description,
    schema,
  };
}

export function createProblemResponse(description: string): BirdCoderOpenApiResponseObject {
  return {
    description,
    content: createOpenApiProblemJsonContent(
      createOpenApiSchemaReference('BirdCoderProblemEnvelope'),
    ),
  };
}

export function buildOpenApiResponses(
  options?: Partial<{
    defaultDescription: string;
    extraResponses: Record<string, BirdCoderOpenApiResponseObject>;
    successDescription: string;
    successSchema: BirdCoderOpenApiSchema;
    successStatus: string;
  }>,
): Record<string, BirdCoderOpenApiResponseObject> {
  const responses: Record<string, BirdCoderOpenApiResponseObject> = {};
  if (options?.successSchema && options.successStatus) {
    responses[options.successStatus] = createOpenApiResponse(
      options.successDescription ?? 'Successful response',
      options.successSchema,
    );
  } else {
    responses['200'] = createOpenApiResponse('Successful response');
  }

  if (options?.extraResponses) {
    Object.assign(responses, options.extraResponses);
  }

  if (!('default' in responses)) {
    responses.default = createProblemResponse(
      options?.defaultDescription ?? 'Problem response envelope.',
    );
  }

  return responses;
}

export function buildBirdCoderCodingServerOpenApiSchemas(): Record<string, BirdCoderOpenApiSchema> {
  const engineDescriptors = listBirdCoderCodingServerEngines();
  const engineKeys = engineDescriptors.map((descriptor) => descriptor.engineKey);
  const engineInstallationKinds = [
    ...new Set(engineDescriptors.map((descriptor) => descriptor.installationKind)),
  ];
  const engineTransportKinds = [
    ...new Set(
      engineDescriptors.flatMap((descriptor) => [...descriptor.transportKinds]).filter(Boolean),
    ),
  ];
  const engineAccessStrategyKinds = [
    ...new Set(
      engineDescriptors.flatMap((descriptor) =>
        descriptor.accessPlan?.lanes.map((lane) => lane.strategyKind) ?? [],
      ),
    ),
  ];
  const engineRuntimeOwners = [
    ...new Set(
      engineDescriptors.flatMap((descriptor) =>
        descriptor.accessPlan?.lanes.map((lane) => lane.runtimeOwner) ?? [],
      ),
    ),
  ];
  const engineBridgeProtocols = [
    ...new Set(
      engineDescriptors.flatMap((descriptor) =>
        descriptor.accessPlan?.lanes.map((lane) => lane.bridgeProtocol) ?? [],
      ),
    ),
  ];
  const engineIntegrationClasses = [
    ...new Set([
      ...BIRDCODER_ENGINE_INTEGRATION_CLASSES,
      ...engineDescriptors.flatMap((descriptor) =>
        descriptor.officialIntegration?.integrationClass
          ? [descriptor.officialIntegration.integrationClass]
          : [],
      ),
    ]),
  ];
  const engineRuntimeModes = [
    ...new Set([
      ...BIRDCODER_ENGINE_RUNTIME_MODES,
      ...engineDescriptors.flatMap((descriptor) =>
        descriptor.officialIntegration?.runtimeMode
          ? [descriptor.officialIntegration.runtimeMode]
          : [],
      ),
    ]),
  ];
  const engineAccessLaneStatuses = [
    ...new Set(
      engineDescriptors.flatMap((descriptor) =>
        descriptor.accessPlan?.lanes.map((lane) => lane.status) ?? [],
      ),
    ),
  ];
  const engineCapabilityMatrixProperties = {
    chat: createOpenApiBooleanSchema(),
    streaming: createOpenApiBooleanSchema(),
    structuredOutput: createOpenApiBooleanSchema(),
    toolCalls: createOpenApiBooleanSchema(),
    planning: createOpenApiBooleanSchema(),
    patchArtifacts: createOpenApiBooleanSchema(),
    commandArtifacts: createOpenApiBooleanSchema(),
    todoArtifacts: createOpenApiBooleanSchema(),
    ptyArtifacts: createOpenApiBooleanSchema(),
    previewArtifacts: createOpenApiBooleanSchema(),
    testArtifacts: createOpenApiBooleanSchema(),
    approvalCheckpoints: createOpenApiBooleanSchema(),
    sessionResume: createOpenApiBooleanSchema(),
    remoteBridge: createOpenApiBooleanSchema(),
    mcp: createOpenApiBooleanSchema(),
  } satisfies Record<string, BirdCoderOpenApiSchema>;
  const codingSessionSummaryProperties = {
    id: createOpenApiStringSchema(),
    workspaceId: createOpenApiStringSchema(),
    projectId: createOpenApiStringSchema(),
    title: createOpenApiStringSchema(),
    status: createOpenApiStringEnumSchema(BIRDCODER_CODING_SESSION_STATUSES),
    hostMode: createOpenApiStringEnumSchema(BIRDCODER_HOST_MODES),
    engineId: createOpenApiStringEnumSchema(engineKeys),
    modelId: createOpenApiStringSchema(),
    nativeSessionId: createOpenApiStringSchema(),
    createdAt: createOpenApiDateTimeSchema(),
    updatedAt: createOpenApiDateTimeSchema(),
    lastTurnAt: createOpenApiDateTimeSchema(),
    sortTimestamp: createOpenApiLongIntegerStringSchema(
      'Normalized activity timestamp in epoch milliseconds used for sorting.',
    ),
    transcriptUpdatedAt: createOpenApiNullableStringSchema(
      'Most recent transcript mutation timestamp, when available.',
    ),
  } satisfies Record<string, BirdCoderOpenApiSchema>;

  return {
    BirdCoderApiMeta: createOpenApiObjectSchema(
      {
        page: createOpenApiIntegerSchema(1),
        pageSize: createOpenApiIntegerSchema(1),
        total: createOpenApiIntegerSchema(0),
        version: createOpenApiStringSchema(),
      },
      {
        required: ['version'],
      },
    ),
    BirdCoderApiListMeta: createOpenApiObjectSchema(
      {
        page: createOpenApiIntegerSchema(1),
        pageSize: createOpenApiIntegerSchema(1),
        total: createOpenApiIntegerSchema(0),
        version: createOpenApiStringSchema(),
      },
      {
        required: ['page', 'pageSize', 'total', 'version'],
      },
    ),
    BirdCoderApiProblemDetails: createOpenApiObjectSchema(
      {
        code: createOpenApiStringSchema(),
        message: createOpenApiStringSchema(),
        detail: createOpenApiStringSchema(),
        retryable: createOpenApiBooleanSchema(),
        fieldErrors: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
        },
      },
      {
        required: ['code', 'message', 'retryable'],
      },
    ),
    BirdCoderProblemEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderApiProblemDetails'),
    ),
    BirdCoderApiRouteDefinition: createOpenApiObjectSchema(
      {
        authMode: createOpenApiStringEnumSchema(BIRDCODER_API_AUTH_MODES),
        method: createOpenApiStringEnumSchema(BIRDCODER_API_HTTP_METHODS),
        path: createOpenApiStringSchema(),
        surface: createOpenApiStringEnumSchema(BIRDCODER_API_SURFACE_NAMES),
        summary: createOpenApiStringSchema(),
      },
      {
        required: ['authMode', 'method', 'path', 'surface', 'summary'],
      },
    ),
    BirdCoderApiRouteCatalogEntry: createOpenApiObjectSchema(
      {
        authMode: createOpenApiStringEnumSchema(BIRDCODER_API_AUTH_MODES),
        method: createOpenApiStringEnumSchema(BIRDCODER_API_HTTP_METHODS),
        path: createOpenApiStringSchema(),
        surface: createOpenApiStringEnumSchema(BIRDCODER_API_SURFACE_NAMES),
        summary: createOpenApiStringSchema(),
        openApiPath: createOpenApiStringSchema(),
        operationId: createOpenApiStringSchema(),
      },
      {
        required: ['authMode', 'method', 'path', 'surface', 'summary', 'openApiPath', 'operationId'],
      },
    ),
    BirdCoderApiGatewaySurfaceSummary: createOpenApiObjectSchema(
      {
        authMode: createOpenApiStringEnumSchema(BIRDCODER_API_AUTH_MODES),
        basePath: createOpenApiStringSchema(),
        description: createOpenApiStringSchema(),
        name: createOpenApiStringEnumSchema(BIRDCODER_API_SURFACE_NAMES),
        routeCount: createOpenApiIntegerSchema(0),
      },
      {
        required: ['authMode', 'basePath', 'description', 'name', 'routeCount'],
      },
    ),
    BirdCoderApiGatewaySummary: createOpenApiObjectSchema(
      {
        docsPath: createOpenApiStringSchema(),
        liveOpenApiPath: createOpenApiStringSchema(),
        openApiPath: createOpenApiStringSchema(),
        routeCatalogPath: createOpenApiStringSchema(),
        routeCount: createOpenApiIntegerSchema(0),
        routesBySurface: createOpenApiObjectSchema(
          {
            app: createOpenApiIntegerSchema(0),
            backend: createOpenApiIntegerSchema(0),
          },
          {
            required: ['app', 'backend'],
          },
        ),
        surfaces: createOpenApiArraySchema(
          createOpenApiSchemaReference('BirdCoderApiGatewaySurfaceSummary'),
        ),
      },
      {
        required: ['docsPath', 'liveOpenApiPath', 'openApiPath', 'routeCatalogPath', 'routeCount', 'routesBySurface', 'surfaces'],
      },
    ),
    BirdCoderCodingServerDescriptor: createOpenApiObjectSchema(
      {
        apiVersion: createOpenApiStringSchema(),
        gateway: createOpenApiSchemaReference('BirdCoderApiGatewaySummary'),
        hostMode: createOpenApiStringEnumSchema(BIRDCODER_HOST_MODES),
        moduleId: createOpenApiStringEnumSchema(['coding-server']),
        openApiPath: createOpenApiStringSchema(),
        surfaces: createOpenApiArraySchema(
          createOpenApiStringEnumSchema(BIRDCODER_API_SURFACE_NAMES),
        ),
      },
      {
        required: ['apiVersion', 'gateway', 'hostMode', 'moduleId', 'openApiPath', 'surfaces'],
      },
    ),
    BirdCoderEngineCapabilityMatrix: createOpenApiObjectSchema(engineCapabilityMatrixProperties, {
      required: Object.keys(engineCapabilityMatrixProperties),
    }),
    BirdCoderEngineAccessLane: createOpenApiObjectSchema(
      {
        laneId: createOpenApiStringSchema(),
        label: createOpenApiStringSchema(),
        strategyKind: createOpenApiStringEnumSchema(engineAccessStrategyKinds),
        runtimeOwner: createOpenApiStringEnumSchema(engineRuntimeOwners),
        bridgeProtocol: createOpenApiStringEnumSchema(engineBridgeProtocols),
        transportKind: createOpenApiStringEnumSchema(engineTransportKinds),
        status: createOpenApiStringEnumSchema(engineAccessLaneStatuses),
        enabledByDefault: createOpenApiBooleanSchema(),
        hostModes: createOpenApiArraySchema(
          createOpenApiStringEnumSchema(BIRDCODER_HOST_MODES),
        ),
        description: createOpenApiStringSchema(),
      },
      {
        required: [
          'laneId',
          'label',
          'strategyKind',
          'runtimeOwner',
          'bridgeProtocol',
          'transportKind',
          'status',
          'enabledByDefault',
          'hostModes',
          'description',
        ],
      },
    ),
    BirdCoderEngineAccessPlan: createOpenApiObjectSchema(
      {
        primaryLaneId: createOpenApiStringSchema(),
        fallbackLaneIds: createOpenApiArraySchema(createOpenApiStringSchema()),
        lanes: createOpenApiArraySchema(
          createOpenApiSchemaReference('BirdCoderEngineAccessLane'),
        ),
      },
      {
        required: ['primaryLaneId', 'fallbackLaneIds', 'lanes'],
      },
    ),
    BirdCoderEngineOfficialEntry: createOpenApiObjectSchema(
      {
        packageName: createOpenApiStringSchema(),
        packageVersion: createOpenApiStringSchema(),
        sdkPath: createOpenApiNullableStringSchema(),
        cliPackageName: createOpenApiNullableStringSchema(),
        sourceMirrorPath: createOpenApiNullableStringSchema(),
        supplementalLanes: createOpenApiArraySchema(createOpenApiStringSchema()),
      },
      {
        required: ['packageName'],
      },
    ),
    BirdCoderEngineOfficialIntegration: createOpenApiObjectSchema(
      {
        integrationClass: createOpenApiStringEnumSchema(engineIntegrationClasses),
        runtimeMode: createOpenApiStringEnumSchema(engineRuntimeModes),
        officialEntry: createOpenApiSchemaReference('BirdCoderEngineOfficialEntry'),
        notes: createOpenApiStringSchema(),
      },
      {
        required: ['integrationClass', 'runtimeMode', 'officialEntry'],
      },
    ),
    BirdCoderEngineDescriptor: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        uuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
        engineKey: createOpenApiStringEnumSchema(engineKeys),
        displayName: createOpenApiStringSchema(),
        vendor: createOpenApiStringSchema(),
        installationKind: createOpenApiStringEnumSchema(engineInstallationKinds),
        defaultModelId: createOpenApiStringSchema(),
        homepage: createOpenApiStringSchema(),
        supportedHostModes: createOpenApiArraySchema(
          createOpenApiStringEnumSchema(BIRDCODER_HOST_MODES),
        ),
        transportKinds: createOpenApiArraySchema(
          createOpenApiStringEnumSchema(engineTransportKinds),
        ),
        capabilityMatrix: createOpenApiSchemaReference('BirdCoderEngineCapabilityMatrix'),
        status: createOpenApiStringEnumSchema(BIRDCODER_MODEL_STATUSES),
        accessPlan: createOpenApiSchemaReference('BirdCoderEngineAccessPlan'),
        officialIntegration: createOpenApiSchemaReference('BirdCoderEngineOfficialIntegration'),
      },
      {
        required: [
          'id',
          'uuid',
          'createdAt',
          'updatedAt',
          'engineKey',
          'displayName',
          'vendor',
          'installationKind',
          'defaultModelId',
          'supportedHostModes',
          'transportKinds',
          'capabilityMatrix',
          'status',
        ],
      },
    ),
    BirdCoderModelCatalogEntry: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        uuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
        engineKey: createOpenApiStringEnumSchema(engineKeys),
        modelId: createOpenApiStringSchema(),
        displayName: createOpenApiStringSchema(),
        providerId: createOpenApiStringSchema(),
        status: createOpenApiStringEnumSchema(BIRDCODER_MODEL_STATUSES),
        defaultForEngine: createOpenApiBooleanSchema(),
        transportKinds: createOpenApiArraySchema(
          createOpenApiStringEnumSchema(engineTransportKinds),
        ),
        capabilityMatrix: createOpenApiObjectSchema(engineCapabilityMatrixProperties),
      },
      {
        required: [
          'id',
          'uuid',
          'createdAt',
          'updatedAt',
          'engineKey',
          'modelId',
          'displayName',
          'status',
          'defaultForEngine',
          'transportKinds',
          'capabilityMatrix',
        ],
      },
    ),
    BirdCoderCodeEngineModelConfigCustomModel: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        label: createOpenApiStringSchema(),
      },
      {
        required: ['id', 'label'],
      },
    ),
    BirdCoderCodeEngineModelConfigEngine: createOpenApiObjectSchema(
      {
        engineId: createOpenApiStringEnumSchema(engineKeys),
        defaultModelId: createOpenApiStringSchema(),
        selectedModelId: createOpenApiStringSchema(),
        customModels: createOpenApiArraySchema(
          createOpenApiSchemaReference('BirdCoderCodeEngineModelConfigCustomModel'),
        ),
        models: createOpenApiArraySchema(
          createOpenApiSchemaReference('BirdCoderModelCatalogEntry'),
        ),
      },
      {
        required: [
          'engineId',
          'defaultModelId',
          'selectedModelId',
          'customModels',
          'models',
        ],
      },
    ),
    BirdCoderCodeEngineModelConfig: createOpenApiObjectSchema(
      {
        schemaVersion: createOpenApiIntegerSchema(1),
        source: createOpenApiStringSchema(),
        version: createOpenApiStringSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
        engines: createOpenApiObjectSchema(
          {},
          {
            additionalProperties: createOpenApiSchemaReference(
              'BirdCoderCodeEngineModelConfigEngine',
            ),
          },
        ),
      },
      {
        required: ['schemaVersion', 'source', 'version', 'updatedAt', 'engines'],
      },
    ),
    BirdCoderSyncCodeEngineModelConfigRequest: createOpenApiObjectSchema(
      {
        localConfig: createOpenApiSchemaReference('BirdCoderCodeEngineModelConfig'),
      },
      {
        required: ['localConfig'],
      },
    ),
    BirdCoderCodeEngineModelConfigSyncResult: createOpenApiObjectSchema(
      {
        action: createOpenApiStringEnumSchema(['noop', 'overwrite-local', 'push-local']),
        authoritativeSource: createOpenApiStringEnumSchema(['equal', 'local', 'server']),
        config: createOpenApiSchemaReference('BirdCoderCodeEngineModelConfig'),
        shouldWriteLocal: createOpenApiBooleanSchema(),
        shouldWriteServer: createOpenApiBooleanSchema(),
      },
      {
        required: [
          'action',
          'authoritativeSource',
          'config',
          'shouldWriteLocal',
          'shouldWriteServer',
        ],
      },
    ),
    BirdCoderOperationDescriptor: createOpenApiObjectSchema(
      {
        operationId: createOpenApiStringSchema(),
        status: createOpenApiStringEnumSchema(BIRDCODER_OPERATION_STATUSES),
        artifactRefs: createOpenApiArraySchema(createOpenApiStringSchema()),
        streamUrl: createOpenApiStringSchema(),
        streamKind: createOpenApiStringEnumSchema(BIRDCODER_STREAM_KINDS),
      },
      {
        required: ['operationId', 'status', 'artifactRefs'],
      },
    ),
    BirdCoderSubmitApprovalDecisionRequest: createOpenApiObjectSchema(
      {
        decision: createOpenApiStringEnumSchema(BIRDCODER_APPROVAL_DECISIONS),
        reason: createOpenApiStringSchema(),
      },
      {
        required: ['decision'],
      },
    ),
    BirdCoderApprovalDecisionResult: createOpenApiObjectSchema(
      {
        approvalId: createOpenApiStringSchema(),
        checkpointId: createOpenApiStringSchema(),
        codingSessionId: createOpenApiStringSchema(),
        decision: createOpenApiStringEnumSchema(BIRDCODER_APPROVAL_DECISIONS),
        decidedAt: createOpenApiDateTimeSchema(),
        operationId: createOpenApiStringSchema(),
        operationStatus: createOpenApiStringEnumSchema(BIRDCODER_OPERATION_STATUSES),
        reason: createOpenApiStringSchema(),
        runtimeId: createOpenApiStringSchema(),
        runtimeStatus: createOpenApiStringEnumSchema(BIRDCODER_CODING_SESSION_RUNTIME_STATUSES),
        turnId: createOpenApiStringSchema(),
      },
      {
        required: [
          'approvalId',
          'checkpointId',
          'codingSessionId',
          'decision',
          'decidedAt',
          'operationStatus',
          'runtimeStatus',
        ],
      },
    ),
    BirdCoderSubmitUserQuestionAnswerRequest: createOpenApiObjectSchema(
      {
        answer: createOpenApiStringSchema(),
        optionId: createOpenApiStringSchema(),
        optionLabel: createOpenApiStringSchema(),
        rejected: createOpenApiBooleanSchema(),
      },
    ),
    BirdCoderUserQuestionAnswerResult: createOpenApiObjectSchema(
      {
        questionId: createOpenApiStringSchema(),
        codingSessionId: createOpenApiStringSchema(),
        answer: createOpenApiStringSchema(),
        answeredAt: createOpenApiDateTimeSchema(),
        optionId: createOpenApiStringSchema(),
        optionLabel: createOpenApiStringSchema(),
        rejected: createOpenApiBooleanSchema(),
        runtimeId: createOpenApiStringSchema(),
        runtimeStatus: createOpenApiStringEnumSchema(BIRDCODER_CODING_SESSION_RUNTIME_STATUSES),
        turnId: createOpenApiStringSchema(),
      },
      {
        required: [
          'questionId',
          'codingSessionId',
          'answeredAt',
          'rejected',
          'runtimeStatus',
        ],
      },
    ),
    BirdCoderCoreHealthSummary: createOpenApiObjectSchema(
      {
        status: createOpenApiStringSchema(),
      },
      {
        required: ['status'],
      },
    ),
    BirdCoderCoreRuntimeSummary: createOpenApiObjectSchema(
      {
        host: createOpenApiStringSchema(),
        port: createOpenApiIntegerSchema(0),
        configFileName: createOpenApiStringSchema(),
      },
      {
        required: ['host', 'port', 'configFileName'],
      },
    ),
    BirdCoderCodingSessionSummary: createOpenApiObjectSchema(codingSessionSummaryProperties, {
      required: [
        'id',
        'workspaceId',
        'projectId',
        'title',
        'status',
        'hostMode',
        'engineId',
        'modelId',
        'createdAt',
        'updatedAt',
      ],
    }),
    BirdCoderCodingSessionTurn: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        codingSessionId: createOpenApiStringSchema(),
        runtimeId: createOpenApiStringSchema(),
        requestKind: createOpenApiStringEnumSchema(BIRDCODER_CODING_SESSION_TURN_REQUEST_KINDS),
        status: createOpenApiStringEnumSchema(BIRDCODER_CODING_SESSION_TURN_STATUSES),
        inputSummary: createOpenApiStringSchema(),
        startedAt: createOpenApiDateTimeSchema(),
        completedAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'codingSessionId', 'requestKind', 'status', 'inputSummary'],
      },
    ),
    BirdCoderCodingSessionEvent: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        codingSessionId: createOpenApiStringSchema(),
        turnId: createOpenApiStringSchema(),
        runtimeId: createOpenApiStringSchema(),
        kind: createOpenApiStringEnumSchema(BIRDCODER_CODING_SESSION_EVENT_KINDS),
        sequence: createOpenApiLongIntegerStringSchema(
          'Event sequence number serialized as an exact decimal string.',
        ),
        payload: {
          type: 'object',
          additionalProperties: true,
        },
        createdAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'codingSessionId', 'kind', 'sequence', 'payload', 'createdAt'],
      },
    ),
    BirdCoderCodingSessionArtifact: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        codingSessionId: createOpenApiStringSchema(),
        turnId: createOpenApiStringSchema(),
        kind: createOpenApiStringEnumSchema(BIRDCODER_CODING_SESSION_ARTIFACT_KINDS),
        status: createOpenApiStringEnumSchema(BIRDCODER_CODING_SESSION_ARTIFACT_STATUSES),
        title: createOpenApiStringSchema(),
        blobRef: createOpenApiStringSchema(),
        metadata: {
          type: 'object',
          additionalProperties: true,
        },
        createdAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'codingSessionId', 'kind', 'title', 'createdAt'],
      },
    ),
    BirdCoderCodingSessionCheckpoint: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        codingSessionId: createOpenApiStringSchema(),
        runtimeId: createOpenApiStringSchema(),
        checkpointKind: createOpenApiStringEnumSchema(BIRDCODER_CODING_SESSION_CHECKPOINT_KINDS),
        resumable: createOpenApiBooleanSchema(),
        state: {
          type: 'object',
          additionalProperties: true,
        },
        createdAt: createOpenApiDateTimeSchema(),
      },
      {
        required: [
          'id',
          'codingSessionId',
          'checkpointKind',
          'resumable',
          'state',
          'createdAt',
        ],
      },
    ),
    BirdCoderNativeSessionCommand: createOpenApiObjectSchema(
      {
        command: createOpenApiStringSchema(),
        status: createOpenApiStringEnumSchema(['running', 'success', 'error']),
        output: createOpenApiStringSchema(),
        kind: createOpenApiStringEnumSchema([
          'approval',
          'command',
          'file_change',
          'task',
          'tool',
          'user_question',
        ]),
        toolName: createOpenApiStringSchema(),
        toolCallId: createOpenApiStringSchema(),
        runtimeStatus: createOpenApiStringEnumSchema(BIRDCODER_CODING_SESSION_RUNTIME_STATUSES),
        requiresApproval: createOpenApiBooleanSchema(),
        requiresReply: createOpenApiBooleanSchema(),
      },
      {
        required: ['command', 'status'],
      },
    ),
    BirdCoderNativeSessionMessage: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        codingSessionId: createOpenApiStringSchema(),
        turnId: createOpenApiStringSchema(),
        role: createOpenApiStringEnumSchema(BIRDCODER_CODING_SESSION_MESSAGE_ROLES),
        content: createOpenApiStringSchema(),
        commands: createOpenApiArraySchema(createOpenApiSchemaReference('BirdCoderNativeSessionCommand')),
        tool_calls: createOpenApiArraySchema({
          type: 'object',
          additionalProperties: true,
        }),
        tool_call_id: createOpenApiStringSchema(),
        fileChanges: createOpenApiArraySchema(
          createOpenApiObjectSchema(
            {
              path: createOpenApiStringSchema(),
              additions: createOpenApiIntegerSchema(0),
              deletions: createOpenApiIntegerSchema(0),
              content: createOpenApiStringSchema(),
              originalContent: createOpenApiStringSchema(),
            },
            {
              required: ['path', 'additions', 'deletions'],
            },
          ),
        ),
        taskProgress: createOpenApiObjectSchema(
          {
            total: createOpenApiIntegerSchema(0),
            completed: createOpenApiIntegerSchema(0),
          },
          {
            required: ['total', 'completed'],
          },
        ),
        metadata: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
        },
        createdAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'codingSessionId', 'role', 'content', 'createdAt'],
      },
    ),
    BirdCoderNativeSessionSummary: createOpenApiObjectSchema(
      {
        ...codingSessionSummaryProperties,
        kind: createOpenApiStringEnumSchema(['coding']),
        nativeCwd: createOpenApiNullableStringSchema(),
        sortTimestamp: createOpenApiLongIntegerStringSchema(
          'Normalized activity timestamp in epoch milliseconds used for sorting.',
        ),
        transcriptUpdatedAt: createOpenApiNullableStringSchema(
          'Most recent transcript mutation timestamp, when available.',
        ),
      },
      {
        required: [
          'id',
          'workspaceId',
          'projectId',
          'title',
          'status',
          'hostMode',
          'engineId',
          'createdAt',
          'updatedAt',
          'kind',
          'sortTimestamp',
        ],
      },
    ),
    BirdCoderNativeSessionDetail: createOpenApiObjectSchema(
      {
        summary: createOpenApiSchemaReference('BirdCoderNativeSessionSummary'),
        messages: createOpenApiArraySchema(createOpenApiSchemaReference('BirdCoderNativeSessionMessage')),
      },
      {
        required: ['summary', 'messages'],
      },
    ),
    BirdCoderNativeSessionProviderSummary: createOpenApiObjectSchema(
      {
        engineId: createOpenApiStringEnumSchema(engineKeys),
        displayName: createOpenApiStringSchema(),
        nativeSessionIdPrefix: createOpenApiStringSchema(),
        transportKinds: createOpenApiArraySchema(
          createOpenApiStringEnumSchema(engineTransportKinds),
        ),
        discoveryMode: createOpenApiStringEnumSchema(
          ['explicit-only', 'passive-global'],
          'Discovery mode for native engine session inventory.',
        ),
      },
      {
        required: [
          'engineId',
          'displayName',
          'nativeSessionIdPrefix',
          'transportKinds',
          'discoveryMode',
        ],
      },
    ),
    BirdCoderCodingSessionTurnCurrentFileContext: createOpenApiObjectSchema(
      {
        path: createOpenApiStringSchema(),
        content: createOpenApiStringSchema(),
        language: createOpenApiStringSchema(),
      },
      {
        required: ['path'],
      },
    ),
    BirdCoderCodingSessionTurnIdeContext: createOpenApiObjectSchema({
      workspaceId: createOpenApiStringSchema(),
      projectId: createOpenApiStringSchema(),
      sessionId: createOpenApiStringSchema(),
      currentFile: createOpenApiSchemaReference('BirdCoderCodingSessionTurnCurrentFileContext'),
    }),
    BirdCoderCodingSessionTurnOptions: createOpenApiObjectSchema({
      temperature: createOpenApiNumberSchema(
        'Sampling temperature. Values are sanitized by the runtime boundary.',
      ),
      topP: createOpenApiNumberSchema(
        'Nucleus sampling value. Values are sanitized by the runtime boundary.',
      ),
      maxTokens: createOpenApiIntegerSchema(1),
    }),
    BirdCoderCreateCodingSessionRequest: createOpenApiObjectSchema(
      {
        workspaceId: createOpenApiStringSchema(),
        projectId: createOpenApiStringSchema(),
        title: createOpenApiStringSchema(),
        hostMode: createOpenApiStringEnumSchema(BIRDCODER_HOST_MODES),
        engineId: createOpenApiStringEnumSchema(engineKeys),
        modelId: createOpenApiStringSchema(),
      },
      {
        required: ['workspaceId', 'projectId', 'engineId', 'modelId'],
      },
    ),
    BirdCoderUpdateCodingSessionRequest: createOpenApiObjectSchema({
      title: createOpenApiStringSchema(),
      status: createOpenApiStringEnumSchema(BIRDCODER_CODING_SESSION_STATUSES),
      hostMode: createOpenApiStringEnumSchema(BIRDCODER_HOST_MODES),
    }),
    BirdCoderForkCodingSessionRequest: createOpenApiObjectSchema({
      title: createOpenApiStringSchema(),
    }),
    BirdCoderEditCodingSessionMessageRequest: createOpenApiObjectSchema(
      {
        content: createOpenApiStringSchema(),
      },
      {
        required: ['content'],
      },
    ),
    BirdCoderCreateCodingSessionTurnRequest: createOpenApiObjectSchema(
      {
        runtimeId: createOpenApiStringSchema(),
        engineId: createOpenApiStringSchema(),
        modelId: createOpenApiStringSchema(),
        requestKind: createOpenApiStringEnumSchema(BIRDCODER_CODING_SESSION_TURN_REQUEST_KINDS),
        inputSummary: createOpenApiStringSchema(),
        stream: createOpenApiBooleanSchema(
          'Whether the turn should stream message.delta events. Defaults to true.',
        ),
        ideContext: createOpenApiSchemaReference('BirdCoderCodingSessionTurnIdeContext'),
        options: createOpenApiSchemaReference('BirdCoderCodingSessionTurnOptions'),
      },
      {
        required: ['requestKind', 'inputSummary'],
      },
    ),
    BirdCoderDeletedResourceResult: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
      },
      {
        required: ['id'],
      },
    ),
    BirdCoderDeleteCodingSessionMessageResult: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        codingSessionId: createOpenApiStringSchema(),
      },
      {
        required: ['id', 'codingSessionId'],
      },
    ),
    BirdCoderEditCodingSessionMessageResult: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        codingSessionId: createOpenApiStringSchema(),
        content: createOpenApiStringSchema(),
      },
      {
        required: ['id', 'codingSessionId', 'content'],
      },
    ),
    BirdCoderBooleanSuccessResult: createOpenApiObjectSchema(
      {
        success: createOpenApiBooleanSchema(),
      },
      {
        required: ['success'],
      },
    ),
    BirdCoderAuthenticatedUserSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        uuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
        name: createOpenApiStringSchema(),
        email: createOpenApiStringSchema(),
        avatarUrl: createOpenApiStringSchema(),
      },
      {
        required: ['id', 'uuid', 'createdAt', 'updatedAt', 'name', 'email'],
      },
    ),
    BirdCoderIamVerificationPolicySummary: createOpenApiObjectSchema(
      {
        emailCodeLoginEnabled: createOpenApiBooleanSchema(),
        emailRegistrationVerificationRequired: createOpenApiBooleanSchema(),
        phoneCodeLoginEnabled: createOpenApiBooleanSchema(),
        phoneRegistrationVerificationRequired: createOpenApiBooleanSchema(),
      },
      {
        required: [
          'emailCodeLoginEnabled',
          'emailRegistrationVerificationRequired',
          'phoneCodeLoginEnabled',
          'phoneRegistrationVerificationRequired',
        ],
      },
    ),
    BirdCoderIamRuntimeSettingsSummary: createOpenApiObjectSchema(
      {
        leftRailMode: createOpenApiStringEnumSchema(['auto', 'highlights-only', 'qr-only']),
        loginMethods: createOpenApiArraySchema(
          createOpenApiStringEnumSchema(BIRDCODER_IAM_LOGIN_METHODS),
        ),
        oauthLoginEnabled: createOpenApiBooleanSchema(),
        oauthProviders: createOpenApiArraySchema(createOpenApiStringSchema()),
        qrLoginEnabled: createOpenApiBooleanSchema(),
        qrLoginType: createOpenApiStringEnumSchema(['web', 'official', 'mini']),
        recoveryMethods: createOpenApiArraySchema(
          createOpenApiStringEnumSchema(BIRDCODER_IAM_RECOVERY_METHODS),
        ),
        registerMethods: createOpenApiArraySchema(
          createOpenApiStringEnumSchema(BIRDCODER_IAM_REGISTER_METHODS),
        ),
        verificationPolicy: createOpenApiSchemaReference('BirdCoderIamVerificationPolicySummary'),
      },
      {
        required: [
          'leftRailMode',
          'loginMethods',
          'oauthLoginEnabled',
          'oauthProviders',
          'qrLoginEnabled',
          'qrLoginType',
          'recoveryMethods',
          'registerMethods',
          'verificationPolicy',
        ],
      },
    ),
    BirdCoderIamSessionSummary: createOpenApiObjectSchema(
      {
        accessToken: createOpenApiStringSchema(),
        authToken: createOpenApiStringSchema(),
        context: createOpenApiObjectSchema({}, { additionalProperties: true }),
        expiresAt: createOpenApiDateTimeSchema(),
        refreshToken: createOpenApiStringSchema(),
        sessionId: createOpenApiStringSchema(),
        user: createOpenApiSchemaReference('BirdCoderAuthenticatedUserSummary'),
      },
      {
        required: ['accessToken', 'authToken'],
      },
    ),
    BirdCoderIamCreateSessionRequest: createOpenApiObjectSchema(
      {
        account: createOpenApiStringSchema(),
        appVersion: createOpenApiStringSchema(),
        code: createOpenApiStringSchema(),
        deviceId: createOpenApiStringSchema(),
        deviceName: createOpenApiStringSchema(),
        deviceType: createOpenApiStringEnumSchema(BIRDCODER_IAM_DEVICE_TYPES),
        email: createOpenApiStringSchema(),
        grantType: createOpenApiStringEnumSchema([
          'password',
          'email_code',
          'phone_code',
          'session_bridge',
        ]),
        loginMethod: createOpenApiStringEnumSchema(BIRDCODER_IAM_LOGIN_METHODS),
        password: createOpenApiStringSchema(),
        phone: createOpenApiStringSchema(),
        username: createOpenApiStringSchema(),
      },
    ),
    BirdCoderIamUpdateCurrentSessionRequest: createOpenApiObjectSchema(
      {
        deviceId: createOpenApiStringSchema(),
        deviceName: createOpenApiStringSchema(),
        trusted: createOpenApiBooleanSchema(),
      },
    ),
    BirdCoderIamRefreshSessionRequest: createOpenApiObjectSchema(
      {
        refreshToken: createOpenApiStringSchema(),
      },
      {
        required: ['refreshToken'],
      },
    ),
    BirdCoderIamRegistrationCreateRequest: createOpenApiObjectSchema(
      {
        channel: createOpenApiStringEnumSchema(BIRDCODER_IAM_VERIFY_TYPES),
        confirmPassword: createOpenApiStringSchema(),
        email: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        password: createOpenApiStringSchema(),
        phone: createOpenApiStringSchema(),
        username: createOpenApiStringSchema(),
        verificationCode: createOpenApiStringSchema(),
      },
    ),
    BirdCoderIamVerificationCodeCreateRequest: createOpenApiObjectSchema(
      {
        scene: createOpenApiStringEnumSchema(BIRDCODER_IAM_VERIFY_SCENES),
        target: createOpenApiStringSchema(),
        verifyType: createOpenApiStringEnumSchema(BIRDCODER_IAM_VERIFY_TYPES),
      },
      {
        required: ['scene', 'target', 'verifyType'],
      },
    ),
    BirdCoderIamVerificationCodeVerifyRequest: createOpenApiObjectSchema(
      {
        code: createOpenApiStringSchema(),
        scene: createOpenApiStringEnumSchema(BIRDCODER_IAM_VERIFY_SCENES),
        target: createOpenApiStringSchema(),
        verifyType: createOpenApiStringEnumSchema(BIRDCODER_IAM_VERIFY_TYPES),
      },
      {
        required: ['code', 'scene', 'target', 'verifyType'],
      },
    ),
    BirdCoderIamPasswordResetRequestCreateRequest: createOpenApiObjectSchema(
      {
        account: createOpenApiStringSchema(),
        channel: createOpenApiStringEnumSchema(BIRDCODER_IAM_PASSWORD_RESET_CHANNELS),
      },
      {
        required: ['account', 'channel'],
      },
    ),
    BirdCoderIamPasswordResetCreateRequest: createOpenApiObjectSchema(
      {
        account: createOpenApiStringSchema(),
        code: createOpenApiStringSchema(),
        confirmPassword: createOpenApiStringSchema(),
        newPassword: createOpenApiStringSchema(),
      },
      {
        required: ['account', 'code', 'newPassword'],
      },
    ),
    BirdCoderIamOAuthSessionCreateRequest: createOpenApiObjectSchema(
      {
        code: createOpenApiStringSchema(),
        deviceId: createOpenApiStringSchema(),
        deviceType: createOpenApiStringEnumSchema(BIRDCODER_IAM_DEVICE_TYPES),
        provider: createOpenApiStringSchema(),
        state: createOpenApiStringSchema(),
      },
      {
        required: ['code', 'provider'],
      },
    ),
    BirdCoderIamOAuthAuthorizationSummary: createOpenApiObjectSchema(
      {
        authUrl: createOpenApiStringSchema(),
      },
      {
        required: ['authUrl'],
      },
    ),
    BirdCoderIamOAuthAuthorizationCreateRequest: createOpenApiObjectSchema(
      {
        provider: createOpenApiStringSchema(),
        redirectUri: createOpenApiStringSchema(),
        scope: createOpenApiStringSchema(),
        state: createOpenApiStringSchema(),
      },
      {
        required: ['provider', 'redirectUri'],
      },
    ),
    BirdCoderIamDeviceAuthorizationCreateRequest: createOpenApiObjectSchema(
      {
        purpose: createOpenApiStringEnumSchema(['login', 'register']),
        redirectUri: createOpenApiStringSchema(),
      },
      {
        required: ['purpose'],
      },
    ),
    BirdCoderIamDeviceAuthorizationSummary: createOpenApiObjectSchema(
      {
        deviceAuthorizationId: createOpenApiStringSchema(),
        expiresAt: createOpenApiDateTimeSchema(),
        pollSecret: createOpenApiStringSchema(),
        qrContent: createOpenApiStringSchema(),
        qrUrl: createOpenApiStringSchema(),
        sessionReady: createOpenApiBooleanSchema(),
        status: createOpenApiStringEnumSchema(BIRDCODER_IAM_QR_AUTH_STATUSES),
      },
      {
        required: ['deviceAuthorizationId', 'status'],
      },
    ),
    BirdCoderIamDeviceAuthorizationSessionExchangeRequest: createOpenApiObjectSchema(
      {
        pollSecret: createOpenApiStringSchema(),
      },
      {
        required: ['pollSecret'],
      },
    ),
    BirdCoderIamDeviceAuthorizationScanRequest: createOpenApiObjectSchema({
      scanSource: createOpenApiStringSchema(),
    }),
    BirdCoderIamDeviceAuthorizationPasswordCompletionRequest: createOpenApiObjectSchema(
      {
        password: createOpenApiStringSchema(),
        username: createOpenApiStringSchema(),
      },
      {
        required: ['password', 'username'],
      },
    ),
    BirdCoderIamQrAuthSessionCreateRequest: createOpenApiObjectSchema(
      {
        purpose: createOpenApiStringEnumSchema(['login', 'register']),
        redirectUri: createOpenApiStringSchema(),
      },
      {
        required: ['purpose'],
      },
    ),
    BirdCoderIamQrAuthSessionSummary: createOpenApiObjectSchema(
      {
        expiresAt: createOpenApiDateTimeSchema(),
        qrContent: createOpenApiStringSchema(),
        qrUrl: createOpenApiStringSchema(),
        sessionKey: createOpenApiStringSchema(),
        status: createOpenApiStringEnumSchema(BIRDCODER_IAM_QR_AUTH_STATUSES),
      },
      {
        required: ['sessionKey', 'status'],
      },
    ),
    BirdCoderIamQrAuthSessionScanRequest: createOpenApiObjectSchema(
      {
        scanSource: createOpenApiStringSchema(),
      },
    ),
    BirdCoderIamQrAuthSessionPasswordRequest: createOpenApiObjectSchema(
      {
        password: createOpenApiStringSchema(),
        username: createOpenApiStringSchema(),
      },
      {
        required: ['password', 'username'],
      },
    ),
    BirdCoderIamUserProfileSummary: createOpenApiObjectSchema(
      {
        uuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
        avatarUrl: createOpenApiStringSchema(),
        bio: createOpenApiStringSchema(),
        company: createOpenApiStringSchema(),
        displayName: createOpenApiStringSchema(),
        email: createOpenApiStringSchema(),
        userId: createOpenApiStringSchema(),
        location: createOpenApiStringSchema(),
        website: createOpenApiStringSchema(),
      },
      {
        required: [
          'uuid',
          'createdAt',
          'updatedAt',
          'bio',
          'company',
          'displayName',
          'email',
          'userId',
          'location',
          'website',
        ],
      },
    ),
    BirdCoderIamUserSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        uuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        username: createOpenApiStringSchema(),
        email: createOpenApiStringSchema(),
        phone: createOpenApiStringSchema(),
        displayName: createOpenApiStringSchema(),
        avatarUrl: createOpenApiStringSchema(),
        status: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'uuid', 'tenantId', 'email', 'displayName', 'status'],
      },
    ),
    BirdCoderIamUserRoleSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        userId: createOpenApiStringSchema(),
        roleId: createOpenApiStringSchema(),
        roleCode: createOpenApiStringSchema(),
        status: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'tenantId', 'userId', 'roleId', 'roleCode', 'status'],
      },
    ),
    BirdCoderUpdateCurrentUserProfileRequest: createOpenApiObjectSchema({
      avatarUrl: createOpenApiStringSchema(),
      bio: createOpenApiStringSchema(),
      company: createOpenApiStringSchema(),
      displayName: createOpenApiStringSchema(),
      location: createOpenApiStringSchema(),
      website: createOpenApiStringSchema(),
    }),
    BirdCoderCommerceMembershipBenefitSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        benefitKey: createOpenApiStringSchema(),
        type: createOpenApiStringSchema(),
        description: createOpenApiStringSchema(),
        icon: createOpenApiStringSchema(),
        claimed: createOpenApiBooleanSchema(),
        usageLimit: createOpenApiLongIntegerStringSchema(),
        usedCount: createOpenApiLongIntegerStringSchema(),
      },
      {
        required: ['id', 'name', 'claimed'],
      },
    ),
    BirdCoderCommerceMembershipCurrentSummary: createOpenApiObjectSchema(
      {
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        ownerUserId: createOpenApiStringSchema(),
        planId: createOpenApiNullableStringSchema(),
        planName: createOpenApiStringSchema(),
        status: createOpenApiStringSchema(),
        startedAt: createOpenApiNullableStringSchema(),
        expiresAt: createOpenApiNullableStringSchema(),
        remainingDays: createOpenApiLongIntegerStringSchema(),
        totalDays: createOpenApiLongIntegerStringSchema(),
        totalSpent: createOpenApiLongIntegerStringSchema(),
        points: createOpenApiLongIntegerStringSchema(),
        growthValue: createOpenApiLongIntegerStringSchema(),
        upgradeGrowthValue: createOpenApiLongIntegerStringSchema(),
        benefits: createOpenApiArraySchema(
          createOpenApiSchemaReference('BirdCoderCommerceMembershipBenefitSummary'),
        ),
      },
      {
        required: [
          'ownerUserId',
          'planName',
          'status',
          'totalSpent',
          'points',
          'growthValue',
          'upgradeGrowthValue',
          'benefits',
        ],
      },
    ),
    BirdCoderCommerceMembershipPackageSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        description: createOpenApiStringSchema(),
        price: createOpenApiLongIntegerStringSchema(),
        originalPrice: createOpenApiLongIntegerStringSchema(),
        pointAmount: createOpenApiLongIntegerStringSchema(),
        durationDays: createOpenApiLongIntegerStringSchema(),
        planName: createOpenApiStringSchema(),
        sortWeight: createOpenApiLongIntegerStringSchema(),
        recommended: createOpenApiBooleanSchema(),
        tags: createOpenApiArraySchema(createOpenApiStringSchema()),
      },
      {
        required: [
          'id',
          'name',
          'price',
          'pointAmount',
          'durationDays',
          'sortWeight',
          'recommended',
          'tags',
        ],
      },
    ),
    BirdCoderCommerceMembershipPackageGroupSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        description: createOpenApiStringSchema(),
        sortWeight: createOpenApiLongIntegerStringSchema(),
        packages: createOpenApiArraySchema(
          createOpenApiSchemaReference('BirdCoderCommerceMembershipPackageSummary'),
        ),
      },
      {
        required: ['id', 'name', 'sortWeight', 'packages'],
      },
    ),
    BirdCoderWorkspaceSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        uuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        dataScope: createOpenApiDataScopeSchema(),
        code: createOpenApiStringSchema(),
        title: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        description: createOpenApiStringSchema(),
        icon: createOpenApiStringSchema(),
        color: createOpenApiStringSchema(),
        ownerId: createOpenApiStringSchema(),
        leaderId: createOpenApiStringSchema(),
        createdByUserId: createOpenApiStringSchema(),
        type: createOpenApiStringSchema(),
        startTime: createOpenApiStringSchema(),
        endTime: createOpenApiStringSchema(),
        maxMembers: createOpenApiIntegerSchema(0),
        currentMembers: createOpenApiIntegerSchema(0),
        memberCount: createOpenApiIntegerSchema(0),
        maxStorage: createOpenApiLongIntegerStringSchema(),
        usedStorage: createOpenApiLongIntegerStringSchema(),
        settings: createOpenApiObjectSchema({}, { additionalProperties: true }),
        isPublic: createOpenApiBooleanSchema(),
        isTemplate: createOpenApiBooleanSchema(),
        status: createOpenApiStringEnumSchema(BIRDCODER_WORKSPACE_RESOURCE_STATUSES),
        viewerRole: createOpenApiStringEnumSchema(BIRDCODER_COLLABORATION_ROLES),
      },
      {
        required: ['id', 'name', 'status'],
      },
    ),
    BirdCoderCreateWorkspaceRequest: createOpenApiObjectSchema(
      {
        description: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        dataScope: createOpenApiDataScopeSchema(),
        code: createOpenApiStringSchema(),
        title: createOpenApiStringSchema(),
        ownerId: createOpenApiStringSchema(),
        leaderId: createOpenApiStringSchema(),
        createdByUserId: createOpenApiStringSchema(),
        icon: createOpenApiStringSchema(),
        color: createOpenApiStringSchema(),
        type: createOpenApiStringSchema(),
        startTime: createOpenApiStringSchema(),
        endTime: createOpenApiStringSchema(),
        maxMembers: createOpenApiIntegerSchema(0),
        currentMembers: createOpenApiIntegerSchema(0),
        memberCount: createOpenApiIntegerSchema(0),
        maxStorage: createOpenApiLongIntegerStringSchema(),
        usedStorage: createOpenApiLongIntegerStringSchema(),
        settings: createOpenApiObjectSchema({}, { additionalProperties: true }),
        isPublic: createOpenApiBooleanSchema(),
        isTemplate: createOpenApiBooleanSchema(),
      },
      {
        required: ['name'],
      },
    ),
    BirdCoderUpdateWorkspaceRequest: createOpenApiObjectSchema({
      description: createOpenApiStringSchema(),
      dataScope: createOpenApiDataScopeSchema(),
      code: createOpenApiStringSchema(),
      title: createOpenApiStringSchema(),
      name: createOpenApiStringSchema(),
      ownerId: createOpenApiStringSchema(),
      leaderId: createOpenApiStringSchema(),
      createdByUserId: createOpenApiStringSchema(),
      icon: createOpenApiStringSchema(),
      color: createOpenApiStringSchema(),
      type: createOpenApiStringSchema(),
      startTime: createOpenApiStringSchema(),
      endTime: createOpenApiStringSchema(),
      maxMembers: createOpenApiIntegerSchema(0),
      currentMembers: createOpenApiIntegerSchema(0),
      memberCount: createOpenApiIntegerSchema(0),
      maxStorage: createOpenApiLongIntegerStringSchema(),
      usedStorage: createOpenApiLongIntegerStringSchema(),
      settings: createOpenApiObjectSchema({}, { additionalProperties: true }),
      isPublic: createOpenApiBooleanSchema(),
      isTemplate: createOpenApiBooleanSchema(),
      status: createOpenApiStringEnumSchema(BIRDCODER_WORKSPACE_RESOURCE_STATUSES),
    }),
    BirdCoderProjectSummary: createOpenApiObjectSchema(
      {
        createdAt: createOpenApiDateTimeSchema(),
        id: createOpenApiStringSchema(),
        uuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        dataScope: createOpenApiDataScopeSchema(),
        workspaceId: createOpenApiStringSchema(),
        workspaceUuid: createOpenApiStringSchema(),
        userId: createOpenApiStringSchema(),
        parentId: createOpenApiStringSchema(),
        parentUuid: createOpenApiStringSchema(),
        parentMetadata: createOpenApiObjectSchema({}, { additionalProperties: true }),
        code: createOpenApiStringSchema(),
        title: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        description: createOpenApiStringSchema(),
        rootPath: createOpenApiStringSchema(),
        sitePath: createOpenApiStringSchema(),
        domainPrefix: createOpenApiStringSchema(),
        ownerId: createOpenApiStringSchema(),
        leaderId: createOpenApiStringSchema(),
        createdByUserId: createOpenApiStringSchema(),
        author: createOpenApiStringSchema(),
        fileId: createOpenApiStringSchema(),
        conversationId: createOpenApiStringSchema(),
        type: createOpenApiStringSchema(),
        startTime: createOpenApiStringSchema(),
        endTime: createOpenApiStringSchema(),
        budgetAmount: createOpenApiLongIntegerStringSchema(),
        coverImage: createOpenApiObjectSchema({}, { additionalProperties: true }),
        isTemplate: createOpenApiBooleanSchema(),
        collaboratorCount: createOpenApiIntegerSchema(0),
        status: createOpenApiStringEnumSchema(BIRDCODER_WORKSPACE_RESOURCE_STATUSES),
        updatedAt: createOpenApiDateTimeSchema(),
        viewerRole: createOpenApiStringEnumSchema(BIRDCODER_COLLABORATION_ROLES),
      },
      {
        required: ['createdAt', 'id', 'workspaceId', 'name', 'status', 'updatedAt'],
      },
    ),
    BirdCoderGitStatusCounts: createOpenApiObjectSchema(
      {
        conflicted: createOpenApiIntegerSchema(0),
        deleted: createOpenApiIntegerSchema(0),
        modified: createOpenApiIntegerSchema(0),
        staged: createOpenApiIntegerSchema(0),
        untracked: createOpenApiIntegerSchema(0),
      },
      {
        required: ['conflicted', 'deleted', 'modified', 'staged', 'untracked'],
      },
    ),
    BirdCoderGitBranchSummary: createOpenApiObjectSchema(
      {
        ahead: createOpenApiIntegerSchema(0),
        behind: createOpenApiIntegerSchema(0),
        isCurrent: createOpenApiBooleanSchema(),
        kind: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        upstreamName: createOpenApiStringSchema(),
      },
      {
        required: ['ahead', 'behind', 'isCurrent', 'kind', 'name'],
      },
    ),
    BirdCoderGitWorktreeSummary: createOpenApiObjectSchema(
      {
        branch: createOpenApiStringSchema(),
        head: createOpenApiStringSchema(),
        id: createOpenApiStringSchema(),
        isCurrent: createOpenApiBooleanSchema(),
        isDetached: createOpenApiBooleanSchema(),
        isLocked: createOpenApiBooleanSchema(),
        isPrunable: createOpenApiBooleanSchema(),
        label: createOpenApiStringSchema(),
        lockedReason: createOpenApiStringSchema(),
        path: createOpenApiStringSchema(),
        prunableReason: createOpenApiStringSchema(),
      },
      {
        required: [
          'id',
          'isCurrent',
          'isDetached',
          'isLocked',
          'isPrunable',
          'label',
          'path',
        ],
      },
    ),
    BirdCoderProjectGitOverview: createOpenApiObjectSchema(
      {
        branches: createOpenApiArraySchema(
          createOpenApiSchemaReference('BirdCoderGitBranchSummary'),
        ),
        currentBranch: createOpenApiStringSchema(),
        currentRevision: createOpenApiStringSchema(),
        currentWorktreePath: createOpenApiStringSchema(),
        detachedHead: createOpenApiBooleanSchema(),
        repositoryRootPath: createOpenApiStringSchema(),
        status: createOpenApiStringEnumSchema(BIRDCODER_GIT_OVERVIEW_STATUSES),
        statusCounts: createOpenApiSchemaReference('BirdCoderGitStatusCounts'),
        worktrees: createOpenApiArraySchema(
          createOpenApiSchemaReference('BirdCoderGitWorktreeSummary'),
        ),
      },
      {
        required: [
          'branches',
          'detachedHead',
          'status',
          'statusCounts',
          'worktrees',
        ],
      },
    ),
    BirdCoderCreateProjectGitBranchRequest: createOpenApiObjectSchema(
      {
        branchName: createOpenApiStringSchema(),
      },
      {
        required: ['branchName'],
      },
    ),
    BirdCoderSwitchProjectGitBranchRequest: createOpenApiObjectSchema(
      {
        branchName: createOpenApiStringSchema(),
      },
      {
        required: ['branchName'],
      },
    ),
    BirdCoderCommitProjectGitChangesRequest: createOpenApiObjectSchema(
      {
        message: createOpenApiStringSchema(),
      },
      {
        required: ['message'],
      },
    ),
    BirdCoderPushProjectGitBranchRequest: createOpenApiObjectSchema({
      branchName: createOpenApiStringSchema(),
      remoteName: createOpenApiStringSchema(),
    }),
    BirdCoderCreateProjectGitWorktreeRequest: createOpenApiObjectSchema(
      {
        branchName: createOpenApiStringSchema(),
        path: createOpenApiStringSchema(),
      },
      {
        required: ['branchName', 'path'],
      },
    ),
    BirdCoderRemoveProjectGitWorktreeRequest: createOpenApiObjectSchema(
      {
        force: createOpenApiBooleanSchema(),
        path: createOpenApiStringSchema(),
      },
      {
        required: ['path'],
      },
    ),
    BirdCoderCreateProjectRequest: createOpenApiObjectSchema(
      {
        description: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        workspaceUuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        dataScope: createOpenApiDataScopeSchema(),
        userId: createOpenApiStringSchema(),
        parentId: createOpenApiStringSchema(),
        parentUuid: createOpenApiStringSchema(),
        parentMetadata: createOpenApiObjectSchema({}, { additionalProperties: true }),
        code: createOpenApiStringSchema(),
        title: createOpenApiStringSchema(),
        ownerId: createOpenApiStringSchema(),
        leaderId: createOpenApiStringSchema(),
        createdByUserId: createOpenApiStringSchema(),
        author: createOpenApiStringSchema(),
        type: createOpenApiStringSchema(),
        rootPath: createOpenApiStringSchema(),
        sitePath: createOpenApiStringSchema(),
        domainPrefix: createOpenApiStringSchema(),
        fileId: createOpenApiStringSchema(),
        conversationId: createOpenApiStringSchema(),
        startTime: createOpenApiStringSchema(),
        endTime: createOpenApiStringSchema(),
        budgetAmount: createOpenApiLongIntegerStringSchema(),
        coverImage: createOpenApiObjectSchema({}, { additionalProperties: true }),
        isTemplate: createOpenApiBooleanSchema(),
        appTemplateVersionId: createOpenApiStringSchema(),
        templatePresetKey: createOpenApiStringSchema(),
        status: createOpenApiStringEnumSchema(BIRDCODER_WORKSPACE_RESOURCE_STATUSES),
        workspaceId: createOpenApiStringSchema(),
      },
      {
        required: ['name', 'workspaceId'],
      },
    ),
    BirdCoderUpdateProjectRequest: createOpenApiObjectSchema({
      description: createOpenApiStringSchema(),
      dataScope: createOpenApiDataScopeSchema(),
      userId: createOpenApiStringSchema(),
      parentId: createOpenApiStringSchema(),
      parentUuid: createOpenApiStringSchema(),
      parentMetadata: createOpenApiObjectSchema({}, { additionalProperties: true }),
      code: createOpenApiStringSchema(),
      title: createOpenApiStringSchema(),
      name: createOpenApiStringSchema(),
      ownerId: createOpenApiStringSchema(),
      leaderId: createOpenApiStringSchema(),
      createdByUserId: createOpenApiStringSchema(),
      author: createOpenApiStringSchema(),
      type: createOpenApiStringSchema(),
      rootPath: createOpenApiStringSchema(),
      sitePath: createOpenApiStringSchema(),
      domainPrefix: createOpenApiStringSchema(),
      fileId: createOpenApiStringSchema(),
      conversationId: createOpenApiStringSchema(),
      startTime: createOpenApiStringSchema(),
      endTime: createOpenApiStringSchema(),
      budgetAmount: createOpenApiLongIntegerStringSchema(),
      coverImage: createOpenApiObjectSchema({}, { additionalProperties: true }),
      isTemplate: createOpenApiBooleanSchema(),
      status: createOpenApiStringEnumSchema(BIRDCODER_WORKSPACE_RESOURCE_STATUSES),
    }),
    BirdCoderSkillCatalogEntrySummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        packageId: createOpenApiStringSchema(),
        slug: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        description: createOpenApiStringSchema(),
        icon: createOpenApiStringSchema(),
        author: createOpenApiStringSchema(),
        versionId: createOpenApiStringSchema(),
        versionLabel: createOpenApiStringSchema(),
        installCount: createOpenApiLongIntegerStringSchema(),
        longDescription: createOpenApiStringSchema(),
        tags: createOpenApiArraySchema(createOpenApiStringSchema()),
        license: createOpenApiStringSchema(),
        repositoryUrl: createOpenApiStringSchema(),
        lastUpdated: createOpenApiDateTimeSchema(),
        readme: createOpenApiStringSchema(),
        capabilityKeys: createOpenApiArraySchema(createOpenApiStringSchema()),
        installed: createOpenApiBooleanSchema(),
      },
      {
        required: [
          'id',
          'packageId',
          'slug',
          'name',
          'description',
          'versionId',
          'versionLabel',
          'tags',
          'capabilityKeys',
          'installed',
        ],
      },
    ),
    BirdCoderSkillPackageSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        uuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
        slug: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        description: createOpenApiStringSchema(),
        icon: createOpenApiStringSchema(),
        author: createOpenApiStringSchema(),
        versionId: createOpenApiStringSchema(),
        versionLabel: createOpenApiStringSchema(),
        installCount: createOpenApiLongIntegerStringSchema(),
        longDescription: createOpenApiStringSchema(),
        sourceUri: createOpenApiStringSchema(),
        installed: createOpenApiBooleanSchema(),
        skills: createOpenApiArraySchema(createOpenApiSchemaReference('BirdCoderSkillCatalogEntrySummary')),
      },
      {
        required: [
          'id',
          'slug',
          'name',
          'description',
          'versionId',
          'versionLabel',
          'installed',
          'skills',
        ],
      },
    ),
    BirdCoderInstallSkillPackageRequest: createOpenApiObjectSchema(
      {
        scopeId: createOpenApiStringSchema(),
        scopeType: createOpenApiStringEnumSchema(['workspace', 'project']),
      },
      {
        required: ['scopeId', 'scopeType'],
      },
    ),
    BirdCoderSkillInstallationSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        uuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
        packageId: createOpenApiStringSchema(),
        scopeId: createOpenApiStringSchema(),
        scopeType: createOpenApiStringEnumSchema(['workspace', 'project']),
        status: createOpenApiStringSchema('Known values include active and archived.'),
        versionId: createOpenApiStringSchema(),
        installedAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'packageId', 'scopeId', 'scopeType', 'status', 'versionId', 'installedAt'],
      },
    ),
    BirdCoderAppTemplateSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        uuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
        slug: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        description: createOpenApiStringSchema(),
        icon: createOpenApiStringSchema(),
        author: createOpenApiStringSchema(),
        versionId: createOpenApiStringSchema(),
        versionLabel: createOpenApiStringSchema(),
        presetKey: createOpenApiStringSchema(),
        category: createOpenApiStringSchema('Known values include community, saas, and mine.'),
        tags: createOpenApiArraySchema(createOpenApiStringSchema()),
        targetProfiles: createOpenApiArraySchema(createOpenApiStringSchema()),
        downloads: createOpenApiIntegerSchema(0),
        stars: createOpenApiIntegerSchema(0),
        status: createOpenApiStringSchema('Known values include active and archived.'),
      },
      {
        required: [
          'id',
          'slug',
          'name',
          'description',
          'versionId',
          'versionLabel',
          'presetKey',
          'category',
          'tags',
          'targetProfiles',
          'status',
          'updatedAt',
        ],
      },
    ),
    BirdCoderProjectDocumentSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        uuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
        projectId: createOpenApiStringSchema(),
        documentKind: createOpenApiStringEnumSchema(BIRDCODER_DOCUMENT_KINDS),
        title: createOpenApiStringSchema(),
        slug: createOpenApiStringSchema(),
        bodyRef: createOpenApiStringSchema(),
        status: createOpenApiStringEnumSchema(BIRDCODER_DOCUMENT_STATUSES),
      },
      {
        required: ['id', 'projectId', 'documentKind', 'title', 'slug', 'status'],
      },
    ),
    BirdCoderTeamSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        uuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
        workspaceId: createOpenApiStringSchema(),
        code: createOpenApiStringSchema(),
        title: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        description: createOpenApiStringSchema(),
        ownerId: createOpenApiStringSchema(),
        leaderId: createOpenApiStringSchema(),
        createdByUserId: createOpenApiStringSchema(),
        metadata: createOpenApiObjectSchema({}, { additionalProperties: true }),
        status: createOpenApiStringEnumSchema(BIRDCODER_WORKSPACE_RESOURCE_STATUSES),
      },
      {
        required: ['id', 'workspaceId', 'name', 'status'],
      },
    ),
    BirdCoderTeamMemberSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        uuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        teamId: createOpenApiStringSchema(),
        userId: createOpenApiStringSchema(),
        role: createOpenApiStringEnumSchema(BIRDCODER_COLLABORATION_ROLES),
        status: createOpenApiStringEnumSchema(BIRDCODER_COLLABORATION_STATUSES),
        createdByUserId: createOpenApiStringSchema(),
        grantedByUserId: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'teamId', 'userId', 'role', 'status'],
      },
    ),
    BirdCoderWorkspaceMemberSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        uuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        workspaceId: createOpenApiStringSchema(),
        userId: createOpenApiStringSchema(),
        userEmail: createOpenApiStringSchema(),
        userDisplayName: createOpenApiStringSchema(),
        userAvatarUrl: createOpenApiStringSchema(),
        teamId: createOpenApiStringSchema(),
        role: createOpenApiStringEnumSchema(BIRDCODER_COLLABORATION_ROLES),
        status: createOpenApiStringEnumSchema(BIRDCODER_COLLABORATION_STATUSES),
        createdByUserId: createOpenApiStringSchema(),
        grantedByUserId: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'workspaceId', 'userId', 'role', 'status'],
      },
    ),
    BirdCoderProjectCollaboratorSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        uuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        projectId: createOpenApiStringSchema(),
        workspaceId: createOpenApiStringSchema(),
        userId: createOpenApiStringSchema(),
        userEmail: createOpenApiStringSchema(),
        userDisplayName: createOpenApiStringSchema(),
        userAvatarUrl: createOpenApiStringSchema(),
        teamId: createOpenApiStringSchema(),
        role: createOpenApiStringEnumSchema(BIRDCODER_COLLABORATION_ROLES),
        status: createOpenApiStringEnumSchema(BIRDCODER_COLLABORATION_STATUSES),
        createdByUserId: createOpenApiStringSchema(),
        grantedByUserId: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'projectId', 'workspaceId', 'userId', 'role', 'status'],
      },
    ),
    BirdCoderUpsertWorkspaceMemberRequest: {
      ...createOpenApiObjectSchema({
        userId: createOpenApiStringSchema(),
        email: createOpenApiStringSchema(),
        teamId: createOpenApiStringSchema(),
        role: createOpenApiStringEnumSchema(BIRDCODER_COLLABORATION_ROLES),
        status: createOpenApiStringEnumSchema(BIRDCODER_COLLABORATION_STATUSES),
        createdByUserId: createOpenApiStringSchema(),
        grantedByUserId: createOpenApiStringSchema(),
      }),
      oneOf: [{ required: ['userId'] }, { required: ['email'] }],
    },
    BirdCoderUpsertProjectCollaboratorRequest: {
      ...createOpenApiObjectSchema({
        userId: createOpenApiStringSchema(),
        email: createOpenApiStringSchema(),
        teamId: createOpenApiStringSchema(),
        role: createOpenApiStringEnumSchema(BIRDCODER_COLLABORATION_ROLES),
        status: createOpenApiStringEnumSchema(BIRDCODER_COLLABORATION_STATUSES),
        createdByUserId: createOpenApiStringSchema(),
        grantedByUserId: createOpenApiStringSchema(),
      }),
      oneOf: [{ required: ['userId'] }, { required: ['email'] }],
    },
    BirdCoderDeploymentTargetSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        uuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
        projectId: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        environmentKey: createOpenApiStringSchema(
          'Known values include dev, test, staging, and prod.',
        ),
        runtime: createOpenApiStringSchema(
          'Known values include web, desktop, server, container, and kubernetes.',
        ),
        status: createOpenApiStringEnumSchema(BIRDCODER_WORKSPACE_RESOURCE_STATUSES),
      },
      {
        required: ['id', 'projectId', 'name', 'environmentKey', 'runtime', 'status'],
      },
    ),
    BirdCoderDeploymentRecordSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        uuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
        projectId: createOpenApiStringSchema(),
        targetId: createOpenApiStringSchema(),
        releaseRecordId: createOpenApiStringSchema(),
        status: createOpenApiStringEnumSchema(BIRDCODER_DEPLOYMENT_RECORD_STATUSES),
        endpointUrl: createOpenApiStringSchema(),
        startedAt: createOpenApiDateTimeSchema(),
        completedAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'projectId', 'targetId', 'status'],
      },
    ),
    BirdCoderReleaseSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        uuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
        releaseVersion: createOpenApiStringSchema(),
        releaseKind: createOpenApiStringSchema(
          `Known values include ${BIRDCODER_RELEASE_KINDS.join(', ')}.`,
        ),
        rolloutStage: createOpenApiStringSchema(),
        manifest: createOpenApiObjectSchema({}, { additionalProperties: true }),
        status: createOpenApiStringSchema(
          `Known values include ${BIRDCODER_RELEASE_STATUSES.join(', ')}.`,
        ),
      },
      {
        required: ['id', 'releaseVersion', 'releaseKind', 'rolloutStage', 'status'],
      },
    ),
    BirdCoderPublishProjectRequest: createOpenApiObjectSchema({
      endpointUrl: createOpenApiStringSchema(),
      environmentKey: createOpenApiStringSchema(),
      releaseKind: createOpenApiStringSchema(),
      releaseVersion: createOpenApiStringSchema(),
      rolloutStage: createOpenApiStringSchema(),
      runtime: createOpenApiStringSchema(),
      targetId: createOpenApiStringSchema(),
      targetName: createOpenApiStringSchema(),
    }),
    BirdCoderProjectPublishResult: createOpenApiObjectSchema(
      {
        deployment: createOpenApiSchemaReference('BirdCoderDeploymentRecordSummary'),
        release: createOpenApiSchemaReference('BirdCoderReleaseSummary'),
        target: createOpenApiSchemaReference('BirdCoderDeploymentTargetSummary'),
      },
      {
        required: ['deployment', 'release', 'target'],
      },
    ),
    BirdCoderIamApiKeySummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        userId: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        permissionScopes: createOpenApiArraySchema(createOpenApiStringSchema()),
        status: createOpenApiStringSchema(),
        expiresAt: createOpenApiDateTimeSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'tenantId', 'userId', 'name', 'permissionScopes', 'status'],
      },
    ),
    BirdCoderIamAuditEventSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        actorUserId: createOpenApiStringSchema(),
        action: createOpenApiStringSchema(),
        resourceType: createOpenApiStringSchema(),
        resourceId: createOpenApiStringSchema(),
        requestId: createOpenApiStringSchema(),
        appId: createOpenApiStringSchema(),
        environment: createOpenApiStringSchema(),
        shardingKey: createOpenApiStringSchema(),
        detail: createOpenApiObjectSchema({}, { additionalProperties: true }),
        createdAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'tenantId', 'action', 'resourceType', 'resourceId', 'detail', 'createdAt'],
      },
    ),
    BirdCoderIamOrganizationSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        parentId: createOpenApiStringSchema(),
        code: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        path: createOpenApiStringSchema(),
        status: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'tenantId', 'code', 'name', 'path', 'status'],
      },
    ),
    BirdCoderIamOrganizationMemberSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        userId: createOpenApiStringSchema(),
        roleCode: createOpenApiStringSchema(),
        status: createOpenApiStringSchema(),
        joinedAt: createOpenApiDateTimeSchema(),
        leftAt: createOpenApiDateTimeSchema(),
        remark: createOpenApiStringSchema(),
      },
      {
        required: ['id', 'tenantId', 'organizationId', 'userId', 'roleCode', 'status'],
      },
    ),
    BirdCoderIamPermissionSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        code: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        resource: createOpenApiStringSchema(),
        action: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'code', 'name', 'resource', 'action'],
      },
    ),
    BirdCoderIamPolicySummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        code: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        policy: createOpenApiObjectSchema({}, { additionalProperties: true }),
        status: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'tenantId', 'code', 'name', 'policy', 'status'],
      },
    ),
    BirdCoderIamRoleSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        code: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        status: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'tenantId', 'code', 'name', 'status'],
      },
    ),
    BirdCoderIamRolePermissionSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        roleId: createOpenApiStringSchema(),
        permissionId: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'tenantId', 'roleId', 'permissionId'],
      },
    ),
    BirdCoderIamSecurityEventSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        userId: createOpenApiStringSchema(),
        sessionId: createOpenApiStringSchema(),
        eventType: createOpenApiStringSchema(),
        severity: createOpenApiStringSchema(),
        detail: createOpenApiObjectSchema({}, { additionalProperties: true }),
        createdAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'tenantId', 'eventType', 'severity', 'detail', 'createdAt'],
      },
    ),
    BirdCoderIamTenantSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        code: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        status: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'code', 'name', 'status'],
      },
    ),
    BirdCoderIamTenantMemberSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        userId: createOpenApiStringSchema(),
        roleCode: createOpenApiStringSchema(),
        status: createOpenApiStringSchema(),
        joinedAt: createOpenApiDateTimeSchema(),
        leftAt: createOpenApiDateTimeSchema(),
        remark: createOpenApiStringSchema(),
      },
      {
        required: ['id', 'tenantId', 'userId', 'roleCode', 'status'],
      },
    ),
    BirdCoderCreateIamOrganizationRequest: createOpenApiObjectSchema(
      {
        code: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        parentId: createOpenApiStringSchema(),
      },
      {
        required: ['code', 'name'],
      },
    ),
    BirdCoderUpdateIamOrganizationRequest: createOpenApiObjectSchema({
      code: createOpenApiStringSchema(),
      name: createOpenApiStringSchema(),
      parentId: createOpenApiStringSchema(),
      status: createOpenApiStringSchema(),
    }),
    BirdCoderCreateIamOrganizationMemberRequest: createOpenApiObjectSchema(
      {
        userId: createOpenApiStringSchema(),
        roleCode: createOpenApiStringSchema(),
        remark: createOpenApiStringSchema(),
      },
      {
        required: ['userId', 'roleCode'],
      },
    ),
    BirdCoderUpdateIamOrganizationMemberRequest: createOpenApiObjectSchema({
      roleCode: createOpenApiStringSchema(),
      status: createOpenApiStringSchema(),
      remark: createOpenApiStringSchema(),
    }),
    BirdCoderCreateIamPermissionRequest: createOpenApiObjectSchema(
      {
        code: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        resource: createOpenApiStringSchema(),
        action: createOpenApiStringSchema(),
      },
      {
        required: ['code', 'name', 'resource', 'action'],
      },
    ),
    BirdCoderUpdateIamPermissionRequest: createOpenApiObjectSchema({
      name: createOpenApiStringSchema(),
      resource: createOpenApiStringSchema(),
      action: createOpenApiStringSchema(),
    }),
    BirdCoderCreateIamPolicyRequest: createOpenApiObjectSchema(
      {
        code: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        policy: createOpenApiObjectSchema({}, { additionalProperties: true }),
      },
      {
        required: ['code', 'name', 'policy'],
      },
    ),
    BirdCoderUpdateIamPolicyRequest: createOpenApiObjectSchema({
      name: createOpenApiStringSchema(),
      policy: createOpenApiObjectSchema({}, { additionalProperties: true }),
      status: createOpenApiStringSchema(),
    }),
    BirdCoderCreateIamRoleRequest: createOpenApiObjectSchema(
      {
        code: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
      },
      {
        required: ['code', 'name'],
      },
    ),
    BirdCoderUpdateIamRoleRequest: createOpenApiObjectSchema({
      name: createOpenApiStringSchema(),
      status: createOpenApiStringSchema(),
    }),
    BirdCoderCreateIamRolePermissionRequest: createOpenApiObjectSchema(
      {
        permissionId: createOpenApiStringSchema(),
      },
      {
        required: ['permissionId'],
      },
    ),
    BirdCoderCreateIamTenantRequest: createOpenApiObjectSchema(
      {
        code: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
      },
      {
        required: ['code', 'name'],
      },
    ),
    BirdCoderUpdateIamTenantRequest: createOpenApiObjectSchema({
      code: createOpenApiStringSchema(),
      name: createOpenApiStringSchema(),
      status: createOpenApiStringSchema(),
    }),
    BirdCoderCreateIamTenantMemberRequest: createOpenApiObjectSchema(
      {
        userId: createOpenApiStringSchema(),
        roleCode: createOpenApiStringSchema(),
        remark: createOpenApiStringSchema(),
      },
      {
        required: ['userId', 'roleCode'],
      },
    ),
    BirdCoderUpdateIamTenantMemberRequest: createOpenApiObjectSchema({
      roleCode: createOpenApiStringSchema(),
      status: createOpenApiStringSchema(),
      remark: createOpenApiStringSchema(),
    }),
    BirdCoderCreateIamUserRequest: createOpenApiObjectSchema(
      {
        username: createOpenApiStringSchema(),
        email: createOpenApiStringSchema(),
        phone: createOpenApiStringSchema(),
        password: createOpenApiStringSchema(),
        displayName: createOpenApiStringSchema(),
        avatarUrl: createOpenApiStringSchema(),
      },
      {
        required: ['email', 'password'],
      },
    ),
    BirdCoderUpdateIamUserRequest: createOpenApiObjectSchema({
      username: createOpenApiStringSchema(),
      email: createOpenApiStringSchema(),
      phone: createOpenApiStringSchema(),
      displayName: createOpenApiStringSchema(),
      avatarUrl: createOpenApiStringSchema(),
      status: createOpenApiStringSchema(),
    }),
    BirdCoderCreateIamUserRoleRequest: createOpenApiObjectSchema(
      {
        roleId: createOpenApiStringSchema(),
        roleCode: createOpenApiStringSchema(),
      },
      {
        required: ['roleId'],
      },
    ),
    BirdCoderCodingSessionSummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCodingSessionSummary'),
    ),
    BirdCoderCodingSessionSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCodingSessionSummary'),
    ),
    BirdCoderCodingSessionTurnEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCodingSessionTurn'),
    ),
    BirdCoderCodingSessionEventListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCodingSessionEvent'),
    ),
    BirdCoderCodingSessionArtifactListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCodingSessionArtifact'),
    ),
    BirdCoderCodingSessionCheckpointListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCodingSessionCheckpoint'),
    ),
    BirdCoderNativeSessionSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderNativeSessionSummary'),
    ),
    BirdCoderNativeSessionDetailEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderNativeSessionDetail'),
    ),
    BirdCoderNativeSessionProviderSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderNativeSessionProviderSummary'),
    ),
    BirdCoderCodingServerDescriptorEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCodingServerDescriptor'),
    ),
    BirdCoderApiRouteCatalogEntryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderApiRouteCatalogEntry'),
    ),
    BirdCoderEngineDescriptorListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderEngineDescriptor'),
    ),
    BirdCoderEngineCapabilityMatrixEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderEngineCapabilityMatrix'),
    ),
    BirdCoderModelCatalogEntryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderModelCatalogEntry'),
    ),
    BirdCoderCodeEngineModelConfigEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCodeEngineModelConfig'),
    ),
    BirdCoderCodeEngineModelConfigSyncResultEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCodeEngineModelConfigSyncResult'),
    ),
    BirdCoderOperationDescriptorEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderOperationDescriptor'),
    ),
    BirdCoderApprovalDecisionResultEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderApprovalDecisionResult'),
    ),
    BirdCoderUserQuestionAnswerResultEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderUserQuestionAnswerResult'),
    ),
    BirdCoderCoreHealthSummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCoreHealthSummary'),
    ),
    BirdCoderCoreRuntimeSummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCoreRuntimeSummary'),
    ),
    BirdCoderDeletedResourceEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderDeletedResourceResult'),
    ),
    BirdCoderDeleteCodingSessionMessageResultEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderDeleteCodingSessionMessageResult'),
    ),
    BirdCoderEditCodingSessionMessageResultEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderEditCodingSessionMessageResult'),
    ),
    BirdCoderBooleanSuccessEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderBooleanSuccessResult'),
    ),
    BirdCoderIamRuntimeSettingsEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamRuntimeSettingsSummary'),
    ),
    BirdCoderIamVerificationPolicyEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamVerificationPolicySummary'),
    ),
    BirdCoderIamSessionEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamSessionSummary'),
    ),
    BirdCoderIamOAuthAuthorizationEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamOAuthAuthorizationSummary'),
    ),
    BirdCoderIamDeviceAuthorizationEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamDeviceAuthorizationSummary'),
    ),
    BirdCoderIamQrAuthSessionEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamQrAuthSessionSummary'),
    ),
    BirdCoderIamUserProfileEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamUserProfileSummary'),
    ),
    BirdCoderIamUserSummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamUserSummary'),
    ),
    BirdCoderIamUserSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamUserSummary'),
    ),
    BirdCoderIamUserRoleSummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamUserRoleSummary'),
    ),
    BirdCoderIamUserRoleSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamUserRoleSummary'),
    ),
    BirdCoderCommerceMembershipCurrentEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCommerceMembershipCurrentSummary'),
    ),
    BirdCoderCommerceMembershipPackageGroupSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCommerceMembershipPackageGroupSummary'),
    ),
    BirdCoderWorkspaceSummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderWorkspaceSummary'),
    ),
    BirdCoderWorkspaceSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderWorkspaceSummary'),
    ),
    BirdCoderProjectSummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderProjectSummary'),
    ),
    BirdCoderProjectGitOverviewEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderProjectGitOverview'),
    ),
    BirdCoderProjectSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderProjectSummary'),
    ),
    BirdCoderSkillPackageSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderSkillPackageSummary'),
    ),
    BirdCoderSkillInstallationSummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderSkillInstallationSummary'),
    ),
    BirdCoderAppTemplateSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderAppTemplateSummary'),
    ),
    BirdCoderProjectDocumentSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderProjectDocumentSummary'),
    ),
    BirdCoderTeamSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderTeamSummary'),
    ),
    BirdCoderTeamMemberSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderTeamMemberSummary'),
    ),
    BirdCoderWorkspaceMemberSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderWorkspaceMemberSummary'),
    ),
    BirdCoderWorkspaceMemberSummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderWorkspaceMemberSummary'),
    ),
    BirdCoderProjectCollaboratorSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderProjectCollaboratorSummary'),
    ),
    BirdCoderProjectCollaboratorSummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderProjectCollaboratorSummary'),
    ),
    BirdCoderDeploymentTargetSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderDeploymentTargetSummary'),
    ),
    BirdCoderDeploymentRecordSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderDeploymentRecordSummary'),
    ),
    BirdCoderReleaseSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderReleaseSummary'),
    ),
    BirdCoderProjectPublishResultEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderProjectPublishResult'),
    ),
    BirdCoderIamApiKeySummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamApiKeySummary'),
    ),
    BirdCoderIamAuditEventSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamAuditEventSummary'),
    ),
    BirdCoderIamOrganizationSummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamOrganizationSummary'),
    ),
    BirdCoderIamOrganizationSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamOrganizationSummary'),
    ),
    BirdCoderIamOrganizationMemberSummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamOrganizationMemberSummary'),
    ),
    BirdCoderIamOrganizationMemberSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamOrganizationMemberSummary'),
    ),
    BirdCoderIamPermissionSummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamPermissionSummary'),
    ),
    BirdCoderIamPermissionSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamPermissionSummary'),
    ),
    BirdCoderIamPolicySummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamPolicySummary'),
    ),
    BirdCoderIamPolicySummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamPolicySummary'),
    ),
    BirdCoderIamRoleSummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamRoleSummary'),
    ),
    BirdCoderIamRoleSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamRoleSummary'),
    ),
    BirdCoderIamRolePermissionSummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamRolePermissionSummary'),
    ),
    BirdCoderIamRolePermissionSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamRolePermissionSummary'),
    ),
    BirdCoderIamSecurityEventSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamSecurityEventSummary'),
    ),
    BirdCoderIamTenantSummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamTenantSummary'),
    ),
    BirdCoderIamTenantSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamTenantSummary'),
    ),
    BirdCoderIamTenantMemberSummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamTenantMemberSummary'),
    ),
    BirdCoderIamTenantMemberSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderIamTenantMemberSummary'),
    ),
  };
}

export function buildBirdCoderOpenApiOperationDefinitions(): Record<
  string,
  BirdCoderOpenApiOperationDefinition
> {
  const engineQuerySchema = createOpenApiStringEnumSchema(
    listBirdCoderCodingServerEngines().map((descriptor) => descriptor.engineKey),
  );
  const workspaceIdParameter = createOpenApiQueryParameter(
    'workspaceId',
    'Filter resources to a single workspace.',
    createOpenApiStringSchema(),
  );
  const rootPathParameter = createOpenApiQueryParameter(
    'rootPath',
    'Filter projects to a single absolute root path.',
    createOpenApiStringSchema(),
  );
  const projectIdParameter = createOpenApiQueryParameter(
    'projectId',
    'Filter resources to a single project.',
    createOpenApiStringSchema(),
  );
  const engineIdParameter = createOpenApiQueryParameter(
    'engineId',
    'Filter resources to a single code engine.',
    engineQuerySchema,
  );
  const limitParameter = createOpenApiQueryParameter(
    'limit',
    'Maximum number of items to return.',
    createOpenApiIntegerSchema(1),
  );
  const offsetParameter = createOpenApiQueryParameter(
    'offset',
    'Zero-based starting offset used for incremental loading.',
    createOpenApiIntegerSchema(0),
  );
  const codingSessionIdPathParameter = createOpenApiPathParameter(
    'sessionId',
    'BirdCoder coding session identifier.',
  );
  const messageIdPathParameter = createOpenApiPathParameter(
    'messageId',
    'BirdCoder coding session message identifier.',
  );
  const checkpointIdPathParameter = createOpenApiPathParameter(
    'checkpointId',
    'Approval checkpoint identifier.',
  );
  const engineKeyPathParameter = createOpenApiPathParameter(
    'engineKey',
    'BirdCoder engine key.',
  );
  const operationIdPathParameter = createOpenApiPathParameter(
    'operationId',
    'Operation identifier.',
  );
  const userIdParameter = createOpenApiQueryParameter(
    'userId',
    'Filter resources to a single user principal.',
    createOpenApiStringSchema(),
  );
  const workspaceIdPathParameter = createOpenApiPathParameter(
    'workspaceId',
    'BirdCoder workspace identifier.',
  );
  const sessionIdQueryParameter = createOpenApiQueryParameter(
    'sessionId',
    'Runtime SDKWork IAM session id used to authorize the websocket upgrade.',
    createOpenApiStringSchema(),
  );
  const projectIdPathParameter = createOpenApiPathParameter(
    'projectId',
    'BirdCoder project identifier.',
  );
  const teamIdPathParameter = createOpenApiPathParameter('teamId', 'BirdCoder team identifier.');
  const packageIdPathParameter = createOpenApiPathParameter(
    'packageId',
    'Skill package identifier.',
  );
  const qrSessionKeyPathParameter = createOpenApiPathParameter(
    'sessionKey',
    'SDKWork IAM QR auth session key.',
  );
  const deviceAuthorizationIdPathParameter = createOpenApiPathParameter(
    'deviceAuthorizationId',
    'SDKWork IAM OAuth device authorization identifier.',
  );
  const apiKeyIdPathParameter = createOpenApiPathParameter(
    'apiKeyId',
    'SDKWork IAM API key identifier.',
  );
  const organizationIdPathParameter = createOpenApiPathParameter(
    'organizationId',
    'SDKWork IAM organization identifier.',
  );
  const membershipIdPathParameter = createOpenApiPathParameter(
    'membershipId',
    'SDKWork IAM organization membership identifier.',
  );
  const roleBindingIdPathParameter = createOpenApiPathParameter(
    'roleBindingId',
    'SDKWork IAM role binding identifier.',
  );
  const permissionIdPathParameter = createOpenApiPathParameter(
    'permissionId',
    'SDKWork IAM permission identifier.',
  );
  const policyIdPathParameter = createOpenApiPathParameter(
    'policyId',
    'SDKWork IAM policy identifier.',
  );
  const roleIdPathParameter = createOpenApiPathParameter(
    'roleId',
    'SDKWork IAM role identifier.',
  );
  const tenantIdPathParameter = createOpenApiPathParameter(
    'tenantId',
    'SDKWork IAM tenant identifier.',
  );
  const iamUserIdPathParameter = createOpenApiPathParameter(
    'userId',
    'SDKWork IAM user identifier.',
  );

  return {
    'descriptor.retrieve': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Coding server descriptor returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCodingServerDescriptorEnvelope'),
      }),
    },
    'routes.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Unified route catalog returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderApiRouteCatalogEntryListEnvelope'),
      }),
    },
    'engines.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Engine catalog returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderEngineDescriptorListEnvelope'),
      }),
    },
    'codingSessions.list': {
      parameters: [
        workspaceIdParameter,
        projectIdParameter,
        engineIdParameter,
        limitParameter,
        offsetParameter,
      ],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Unified coding session inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCodingSessionSummaryListEnvelope'),
        extraResponses: {
          '500': createProblemResponse('Unified coding session inventory could not be read.'),
        },
      }),
    },
    'codingSessions.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateCodingSessionRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Coding session created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCodingSessionSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Coding session creation request is invalid.'),
          '500': createProblemResponse('Coding session could not be created.'),
        },
      }),
    },
    'codingSessions.retrieve': {
      parameters: [codingSessionIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Coding session summary returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCodingSessionSummaryEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Coding session was not found.'),
          '500': createProblemResponse('Coding session summary could not be read.'),
        },
      }),
    },
    'codingSessions.update': {
      parameters: [codingSessionIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateCodingSessionRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Coding session updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCodingSessionSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Coding session update request is invalid.'),
          '404': createProblemResponse('Coding session was not found.'),
          '500': createProblemResponse('Coding session could not be updated.'),
        },
      }),
    },
    'codingSessions.delete': {
      parameters: [codingSessionIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Coding session deleted successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderDeletedResourceEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Coding session was not found.'),
          '500': createProblemResponse('Coding session could not be deleted.'),
        },
      }),
    },
    'codingSessions.forks.create': {
      parameters: [codingSessionIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderForkCodingSessionRequest'),
        false,
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Coding session forked successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCodingSessionSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Coding session fork request is invalid.'),
          '404': createProblemResponse('Coding session was not found.'),
          '500': createProblemResponse('Coding session could not be forked.'),
        },
      }),
    },
    'codingSessions.turns.create': {
      parameters: [codingSessionIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateCodingSessionTurnRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Coding session turn created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCodingSessionTurnEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Coding session turn request is invalid.'),
          '404': createProblemResponse('Coding session was not found.'),
          '500': createProblemResponse('Coding session turn could not be created.'),
        },
      }),
    },
    'codingSessions.messages.update': {
      parameters: [codingSessionIdPathParameter, messageIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderEditCodingSessionMessageRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Coding session message edited successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderEditCodingSessionMessageResultEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Coding session message edit request is invalid.'),
          '404': createProblemResponse('Coding session message was not found.'),
          '500': createProblemResponse('Coding session message could not be edited.'),
        },
      }),
    },
    'codingSessions.messages.delete': {
      parameters: [codingSessionIdPathParameter, messageIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Coding session message deleted successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderDeleteCodingSessionMessageResultEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Coding session message was not found.'),
          '500': createProblemResponse('Coding session message could not be deleted.'),
        },
      }),
    },
    'codingSessions.events.list': {
      parameters: [codingSessionIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Coding session event stream returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCodingSessionEventListEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Coding session was not found.'),
          '500': createProblemResponse('Coding session events could not be read.'),
        },
      }),
    },
    'nativeSessions.list': {
      parameters: [
        workspaceIdParameter,
        projectIdParameter,
        engineIdParameter,
        limitParameter,
        offsetParameter,
      ],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Native engine session inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderNativeSessionSummaryListEnvelope'),
        extraResponses: {
          '500': createProblemResponse('Native engine session inventory could not be read.'),
        },
      }),
    },
    'nativeSessionProviders.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Native engine session provider catalog returned successfully.',
        successSchema: createOpenApiSchemaReference(
          'BirdCoderNativeSessionProviderSummaryListEnvelope',
        ),
        extraResponses: {
          '500': createProblemResponse(
            'Native engine session provider catalog could not be read.',
          ),
        },
      }),
    },
    'nativeSessions.retrieve': {
      parameters: [
        codingSessionIdPathParameter,
        workspaceIdParameter,
        projectIdParameter,
        engineIdParameter,
      ],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Native engine session detail returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderNativeSessionDetailEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Native engine session was not found.'),
          '500': createProblemResponse('Native engine session detail could not be read.'),
        },
      }),
    },
    'engines.capabilities.retrieve': {
      parameters: [engineKeyPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Engine capability matrix returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderEngineCapabilityMatrixEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Engine capability matrix was not found.'),
        },
      }),
    },
    'models.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Model catalog returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderModelCatalogEntryListEnvelope'),
      }),
    },
    'modelConfig.retrieve': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Code engine model configuration returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCodeEngineModelConfigEnvelope'),
      }),
    },
    'modelConfig.sync': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderSyncCodeEngineModelConfigRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Code engine model configuration synchronized successfully.',
        successSchema: createOpenApiSchemaReference(
          'BirdCoderCodeEngineModelConfigSyncResultEnvelope',
        ),
      }),
    },
    'runtime.retrieve': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Runtime metadata returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCoreRuntimeSummaryEnvelope'),
      }),
    },
    'health.retrieve': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Runtime health returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCoreHealthSummaryEnvelope'),
      }),
    },
    'operations.retrieve': {
      parameters: [operationIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Operation descriptor returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderOperationDescriptorEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Operation was not found.'),
        },
      }),
    },
    'codingSessions.checkpoints.approval.create': {
      parameters: [codingSessionIdPathParameter, checkpointIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderSubmitApprovalDecisionRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Approval decision applied successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderApprovalDecisionResultEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Approval decision request is invalid.'),
          '404': createProblemResponse('Approval checkpoint was not found.'),
        },
      }),
    },
    'codingSessions.questions.answers.create': {
      parameters: [
        codingSessionIdPathParameter,
        createOpenApiPathParameter(
          'questionId',
          'User-question request identifier.',
        ),
      ],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderSubmitUserQuestionAnswerRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'User-question answer applied successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderUserQuestionAnswerResultEnvelope'),
        extraResponses: {
          '400': createProblemResponse('User-question answer request is invalid.'),
          '404': createProblemResponse('User-question checkpoint was not found.'),
        },
      }),
    },
    'codingSessions.artifacts.list': {
      parameters: [codingSessionIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Coding session artifacts returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCodingSessionArtifactListEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Coding session was not found.'),
        },
      }),
    },
    'codingSessions.checkpoints.list': {
      parameters: [codingSessionIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Coding session checkpoints returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCodingSessionCheckpointListEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Coding session was not found.'),
        },
      }),
    },
    'iam.runtime.retrieve': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM runtime settings returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamRuntimeSettingsEnvelope'),
      }),
    },
    'iam.verificationPolicy.retrieve': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM verification policy returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamVerificationPolicyEnvelope'),
      }),
    },
    'sessions.current.retrieve': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Current SDKWork IAM session returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamSessionEnvelope'),
      }),
    },
    'sessions.current.update': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamUpdateCurrentSessionRequest'),
        false,
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Current SDKWork IAM session updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamSessionEnvelope'),
      }),
    },
    'oauth.authorizationUrls.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamOAuthAuthorizationCreateRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'OAuth authorization URL resolved successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamOAuthAuthorizationEnvelope'),
        extraResponses: {
          '400': createProblemResponse('OAuth authorization request is invalid.'),
        },
      }),
    },
    'oauth.sessions.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamOAuthSessionCreateRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM session created successfully with OAuth authorization.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamSessionEnvelope'),
        extraResponses: {
          '400': createProblemResponse('OAuth login request is invalid.'),
          '401': createProblemResponse('OAuth authorization code was rejected.'),
        },
      }),
    },
    'oauth.deviceAuthorizations.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamDeviceAuthorizationCreateRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM OAuth device authorization created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamDeviceAuthorizationEnvelope'),
        extraResponses: {
          '400': createProblemResponse('OAuth device authorization request is invalid.'),
        },
      }),
    },
    'oauth.deviceAuthorizations.retrieve': {
      parameters: [deviceAuthorizationIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM OAuth device authorization returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamDeviceAuthorizationEnvelope'),
        extraResponses: {
          '404': createProblemResponse('OAuth device authorization was not found.'),
        },
      }),
    },
    'oauth.deviceAuthorizations.scans.create': {
      parameters: [deviceAuthorizationIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamDeviceAuthorizationScanRequest'),
        false,
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM OAuth device authorization scan accepted successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderBooleanSuccessEnvelope'),
        extraResponses: {
          '404': createProblemResponse('OAuth device authorization was not found.'),
        },
      }),
    },
    'oauth.deviceAuthorizations.passwordCompletions.create': {
      parameters: [deviceAuthorizationIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamDeviceAuthorizationPasswordCompletionRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription:
          'SDKWork IAM OAuth device authorization completed with password successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamSessionEnvelope'),
        extraResponses: {
          '400': createProblemResponse('OAuth device authorization password completion is invalid.'),
          '404': createProblemResponse('OAuth device authorization was not found.'),
        },
      }),
    },
    'oauth.deviceAuthorizations.sessionExchanges.create': {
      parameters: [deviceAuthorizationIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamDeviceAuthorizationSessionExchangeRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription:
          'SDKWork IAM OAuth device authorization session exchanged successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamSessionEnvelope'),
        extraResponses: {
          '400': createProblemResponse('OAuth device authorization session exchange is invalid.'),
          '401': createProblemResponse('OAuth device authorization poll secret was rejected.'),
          '404': createProblemResponse('OAuth device authorization was not found.'),
          '409': createProblemResponse('OAuth device authorization session is not ready for exchange.'),
        },
      }),
    },
    'sessions.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamCreateSessionRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM session created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamSessionEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM login request is invalid.'),
          '401': createProblemResponse('SDKWork IAM credentials were rejected.'),
        },
      }),
    },
    'registrations.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamRegistrationCreateRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM user registered successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamSessionEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM registration request is invalid.'),
        },
      }),
    },
    'passwordResetRequests.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamPasswordResetRequestCreateRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Password reset challenge accepted successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderBooleanSuccessEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Password reset challenge request is invalid.'),
        },
      }),
    },
    'passwordResets.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamPasswordResetCreateRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Password reset completed successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderBooleanSuccessEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Password reset request is invalid.'),
          '401': createProblemResponse('Password reset verification failed.'),
        },
      }),
    },
    'sessions.current.delete': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM session revoked successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderBooleanSuccessEnvelope'),
      }),
    },
    'sessions.refresh': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamRefreshSessionRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM session refreshed successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamSessionEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM session refresh request is invalid.'),
          '401': createProblemResponse('SDKWork IAM refresh token was rejected.'),
        },
      }),
    },
    'users.current.retrieve': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Current user profile returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamUserProfileEnvelope'),
      }),
    },
    'users.current.update': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateCurrentUserProfileRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Current user profile updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamUserProfileEnvelope'),
      }),
    },
    'memberships.current.retrieve': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Current SDKWork commerce membership returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCommerceMembershipCurrentEnvelope'),
      }),
    },
    'memberships.packageGroups.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork commerce membership package groups returned successfully.',
        successSchema: createOpenApiSchemaReference(
          'BirdCoderCommerceMembershipPackageGroupSummaryListEnvelope',
        ),
      }),
    },
    'workspaces.list': {
      parameters: [userIdParameter, limitParameter, offsetParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Workspace inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderWorkspaceSummaryListEnvelope'),
      }),
    },
    'workspaces.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateWorkspaceRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Workspace created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderWorkspaceSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Workspace creation request is invalid.'),
        },
      }),
    },
    'workspaces.retrieve': {
      parameters: [workspaceIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Workspace returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderWorkspaceSummaryEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Workspace was not found.'),
        },
      }),
    },
    'workspaces.update': {
      parameters: [workspaceIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateWorkspaceRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Workspace updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderWorkspaceSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Workspace update request is invalid.'),
          '404': createProblemResponse('Workspace was not found.'),
        },
      }),
    },
    'workspaces.delete': {
      parameters: [workspaceIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Workspace removed successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderDeletedResourceEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Workspace was not found.'),
        },
      }),
    },
    'workspaces.realtime.subscribe': {
      parameters: [workspaceIdPathParameter, sessionIdQueryParameter],
      streamKind: 'websocket',
      responses: {
        '101': createOpenApiResponse(
          'WebSocket upgrade accepted for workspace realtime delivery.',
        ),
        '400': createProblemResponse('Workspace realtime subscription request is invalid.'),
        '401': createProblemResponse('A valid SDKWork IAM session is required.'),
        '404': createProblemResponse('Workspace was not found.'),
        default: createProblemResponse('Problem response envelope.'),
      },
    },
    'projects.list': {
      parameters: [
        userIdParameter,
        workspaceIdParameter,
        rootPathParameter,
        limitParameter,
        offsetParameter,
      ],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectSummaryListEnvelope'),
      }),
    },
    'projects.retrieve': {
      parameters: [projectIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectSummaryEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'projects.git.overview.retrieve': {
      parameters: [projectIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project Git overview returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectGitOverviewEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'projects.git.branches.create': {
      parameters: [projectIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateProjectGitBranchRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project Git branch created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectGitOverviewEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Project Git branch creation request is invalid.'),
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'projects.git.branchSwitch.create': {
      parameters: [projectIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderSwitchProjectGitBranchRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project Git branch switched successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectGitOverviewEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Project Git branch switch request is invalid.'),
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'projects.git.commits.create': {
      parameters: [projectIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCommitProjectGitChangesRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project Git changes committed successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectGitOverviewEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Project Git commit request is invalid.'),
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'projects.git.pushes.create': {
      parameters: [projectIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderPushProjectGitBranchRequest'),
        false,
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project Git branch pushed successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectGitOverviewEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Project Git push request is invalid.'),
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'projects.git.worktrees.create': {
      parameters: [projectIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateProjectGitWorktreeRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project Git worktree created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectGitOverviewEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Project Git worktree creation request is invalid.'),
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'projects.git.worktreeRemovals.create': {
      parameters: [projectIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderRemoveProjectGitWorktreeRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project Git worktree removed successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectGitOverviewEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Project Git worktree removal request is invalid.'),
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'projects.git.worktreePrune.create': {
      parameters: [projectIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project Git worktrees pruned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectGitOverviewEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Project Git worktree prune request is invalid.'),
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'projects.collaborators.list': {
      parameters: [projectIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project collaborators returned successfully.',
        successSchema: createOpenApiSchemaReference(
          'BirdCoderProjectCollaboratorSummaryListEnvelope',
        ),
        extraResponses: {
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'projects.collaborators.upsert': {
      parameters: [projectIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpsertProjectCollaboratorRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project collaborator updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectCollaboratorSummaryEnvelope'),
        extraResponses: {
          '201': createOpenApiResponse(
            'Project collaborator created successfully.',
            createOpenApiSchemaReference('BirdCoderProjectCollaboratorSummaryEnvelope'),
          ),
          '400': createProblemResponse('Project collaborator request is invalid.'),
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'projects.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateProjectRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Project created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Project creation request is invalid.'),
          '404': createProblemResponse('Workspace was not found.'),
        },
      }),
    },
    'projects.update': {
      parameters: [projectIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateProjectRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Project update request is invalid.'),
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'projects.delete': {
      parameters: [projectIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project removed successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderDeletedResourceEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'skillPackages.list': {
      parameters: [userIdParameter, workspaceIdParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Skill package catalog returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderSkillPackageSummaryListEnvelope'),
      }),
    },
    'skillPackages.installations.create': {
      parameters: [packageIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderInstallSkillPackageRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Skill package installed successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderSkillInstallationSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Skill package installation request is invalid.'),
          '404': createProblemResponse('Skill package was not found.'),
        },
      }),
    },
    'appTemplates.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'App template catalog returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderAppTemplateSummaryListEnvelope'),
      }),
    },
    'documents.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project documents returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectDocumentSummaryListEnvelope'),
      }),
    },
    'workspaceTeams.list': {
      parameters: [userIdParameter, workspaceIdParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Workspace team inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderTeamSummaryListEnvelope'),
      }),
    },
    'workspaces.members.list': {
      parameters: [workspaceIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Workspace members returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderWorkspaceMemberSummaryListEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Workspace was not found.'),
        },
      }),
    },
    'workspaces.members.upsert': {
      parameters: [workspaceIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpsertWorkspaceMemberRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Workspace member updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderWorkspaceMemberSummaryEnvelope'),
        extraResponses: {
          '201': createOpenApiResponse(
            'Workspace member created successfully.',
            createOpenApiSchemaReference('BirdCoderWorkspaceMemberSummaryEnvelope'),
          ),
          '400': createProblemResponse('Workspace member request is invalid.'),
          '404': createProblemResponse('Workspace was not found.'),
        },
      }),
    },
    'projects.publish.create': {
      parameters: [projectIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderPublishProjectRequest'),
        false,
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project release flow started successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectPublishResultEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'deployments.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Deployment inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderDeploymentRecordSummaryListEnvelope'),
      }),
    },
    'apiKeys.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM API keys returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamApiKeySummaryListEnvelope'),
      }),
    },
    'apiKeys.revoke': {
      parameters: [apiKeyIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM API key revoked successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderBooleanSuccessEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM API key was not found.'),
        },
      }),
    },
    'auditEvents.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM audit events returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamAuditEventSummaryListEnvelope'),
      }),
    },
    'organizations.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM organizations returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamOrganizationSummaryListEnvelope'),
      }),
    },
    'organizations.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateIamOrganizationRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM organization created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamOrganizationSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM organization request is invalid.'),
        },
      }),
    },
    'organizations.retrieve': {
      parameters: [organizationIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM organization returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamOrganizationSummaryEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM organization was not found.'),
        },
      }),
    },
    'organizations.update': {
      parameters: [organizationIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateIamOrganizationRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM organization updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamOrganizationSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM organization update request is invalid.'),
          '404': createProblemResponse('SDKWork IAM organization was not found.'),
        },
      }),
    },
    'organizations.delete': {
      parameters: [organizationIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM organization deleted successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderDeletedResourceEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM organization was not found.'),
        },
      }),
    },
    'organizations.tree.retrieve': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM organization tree returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamOrganizationSummaryListEnvelope'),
      }),
    },
    'organizationMemberships.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM organization memberships returned successfully.',
        successSchema: createOpenApiSchemaReference(
          'BirdCoderIamOrganizationMemberSummaryListEnvelope',
        ),
      }),
    },
    'organizationMemberships.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateIamOrganizationMemberRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM organization membership created successfully.',
        successSchema: createOpenApiSchemaReference(
          'BirdCoderIamOrganizationMemberSummaryEnvelope',
        ),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM organization membership request is invalid.'),
        },
      }),
    },
    'organizationMemberships.update': {
      parameters: [membershipIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateIamOrganizationMemberRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM organization membership updated successfully.',
        successSchema: createOpenApiSchemaReference(
          'BirdCoderIamOrganizationMemberSummaryEnvelope',
        ),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM organization membership update request is invalid.'),
          '404': createProblemResponse('SDKWork IAM organization membership was not found.'),
        },
      }),
    },
    'permissions.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM permissions returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamPermissionSummaryListEnvelope'),
      }),
    },
    'permissions.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateIamPermissionRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM permission created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamPermissionSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM permission request is invalid.'),
        },
      }),
    },
    'permissions.retrieve': {
      parameters: [permissionIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM permission returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamPermissionSummaryEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM permission was not found.'),
        },
      }),
    },
    'permissions.update': {
      parameters: [permissionIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateIamPermissionRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM permission updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamPermissionSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM permission update request is invalid.'),
          '404': createProblemResponse('SDKWork IAM permission was not found.'),
        },
      }),
    },
    'permissions.delete': {
      parameters: [permissionIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM permission deleted successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderDeletedResourceEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM permission was not found.'),
        },
      }),
    },
    'policies.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM policies returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamPolicySummaryListEnvelope'),
      }),
    },
    'policies.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateIamPolicyRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM policy created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamPolicySummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM policy request is invalid.'),
        },
      }),
    },
    'policies.retrieve': {
      parameters: [policyIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM policy returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamPolicySummaryEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM policy was not found.'),
        },
      }),
    },
    'policies.update': {
      parameters: [policyIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateIamPolicyRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM policy updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamPolicySummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM policy update request is invalid.'),
          '404': createProblemResponse('SDKWork IAM policy was not found.'),
        },
      }),
    },
    'policies.delete': {
      parameters: [policyIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM policy deleted successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderDeletedResourceEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM policy was not found.'),
        },
      }),
    },
    'roles.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM roles returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamRoleSummaryListEnvelope'),
      }),
    },
    'roles.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateIamRoleRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM role created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamRoleSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM role request is invalid.'),
        },
      }),
    },
    'roles.retrieve': {
      parameters: [roleIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM role returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamRoleSummaryEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM role was not found.'),
        },
      }),
    },
    'roles.update': {
      parameters: [roleIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateIamRoleRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM role updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamRoleSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM role update request is invalid.'),
          '404': createProblemResponse('SDKWork IAM role was not found.'),
        },
      }),
    },
    'roles.delete': {
      parameters: [roleIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM role deleted successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderDeletedResourceEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM role was not found.'),
        },
      }),
    },
    'roles.permissions.list': {
      parameters: [roleIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM role permissions returned successfully.',
        successSchema: createOpenApiSchemaReference(
          'BirdCoderIamRolePermissionSummaryListEnvelope',
        ),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM role was not found.'),
        },
      }),
    },
    'roles.permissions.create': {
      parameters: [roleIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateIamRolePermissionRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM role permission created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamRolePermissionSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM role permission request is invalid.'),
          '404': createProblemResponse('SDKWork IAM role was not found.'),
        },
      }),
    },
    'roles.permissions.delete': {
      parameters: [roleIdPathParameter, permissionIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM role permission deleted successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderBooleanSuccessEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM role permission was not found.'),
        },
      }),
    },
    'securityEvents.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM security events returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamSecurityEventSummaryListEnvelope'),
      }),
    },
    'tenants.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM tenants returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamTenantSummaryListEnvelope'),
      }),
    },
    'tenants.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateIamTenantRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM tenant created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamTenantSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM tenant request is invalid.'),
        },
      }),
    },
    'tenants.retrieve': {
      parameters: [tenantIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM tenant returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamTenantSummaryEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM tenant was not found.'),
        },
      }),
    },
    'tenants.update': {
      parameters: [tenantIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateIamTenantRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM tenant updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamTenantSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM tenant update request is invalid.'),
          '404': createProblemResponse('SDKWork IAM tenant was not found.'),
        },
      }),
    },
    'tenants.delete': {
      parameters: [tenantIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM tenant deleted successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderDeletedResourceEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM tenant was not found.'),
        },
      }),
    },
    'tenants.members.list': {
      parameters: [tenantIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM tenant members returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamTenantMemberSummaryListEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM tenant was not found.'),
        },
      }),
    },
    'tenants.members.create': {
      parameters: [tenantIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateIamTenantMemberRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM tenant member created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamTenantMemberSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM tenant member request is invalid.'),
          '404': createProblemResponse('SDKWork IAM tenant was not found.'),
        },
      }),
    },
    'tenants.members.update': {
      parameters: [tenantIdPathParameter, iamUserIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateIamTenantMemberRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM tenant member updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamTenantMemberSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM tenant member update request is invalid.'),
          '404': createProblemResponse('SDKWork IAM tenant member was not found.'),
        },
      }),
    },
    'tenants.members.delete': {
      parameters: [tenantIdPathParameter, iamUserIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM tenant member deleted successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderBooleanSuccessEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM tenant member was not found.'),
        },
      }),
    },
    'users.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM users returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamUserSummaryListEnvelope'),
      }),
    },
    'users.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateIamUserRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM user created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamUserSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM user request is invalid.'),
        },
      }),
    },
    'users.retrieve': {
      parameters: [iamUserIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM user returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamUserSummaryEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM user was not found.'),
        },
      }),
    },
    'users.update': {
      parameters: [iamUserIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateIamUserRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM user updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamUserSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM user update request is invalid.'),
          '404': createProblemResponse('SDKWork IAM user was not found.'),
        },
      }),
    },
    'users.delete': {
      parameters: [iamUserIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM user deleted successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderDeletedResourceEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM user was not found.'),
        },
      }),
    },
    'roleBindings.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM user role bindings returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamUserRoleSummaryListEnvelope'),
      }),
    },
    'roleBindings.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateIamUserRoleRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM user role binding created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamUserRoleSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM user role binding request is invalid.'),
        },
      }),
    },
    'roleBindings.delete': {
      parameters: [roleBindingIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM user role binding deleted successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderBooleanSuccessEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM user role binding was not found.'),
        },
      }),
    },
    'teams.list': {
      parameters: [userIdParameter, workspaceIdParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Admin team inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderTeamSummaryListEnvelope'),
      }),
    },
    'teams.members.list': {
      parameters: [teamIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Team members returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderTeamMemberSummaryListEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Team was not found.'),
        },
      }),
    },
    'projects.deploymentTargets.list': {
      parameters: [projectIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Deployment targets returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderDeploymentTargetSummaryListEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'releases.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Release inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderReleaseSummaryListEnvelope'),
      }),
    },
    'deploymentGovernance.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Admin deployment inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderDeploymentRecordSummaryListEnvelope'),
      }),
    },
  };
}

export function buildOpenApiDefaultResponses(): Record<string, BirdCoderOpenApiResponseObject> {
  return {
    '200': {
      description: 'Successful response',
    },
    default: {
      ...createProblemResponse('Problem response envelope.'),
    },
  };
}

export function buildBirdCoderCodingServerOpenApiDocument(
  distributionId: BirdServerDistributionId = 'global',
): BirdCoderCodingServerOpenApiDocument {
  void distributionId;
  const routes = listBirdCoderCodingServerRoutes();
  const gateway = buildBirdCoderApiGatewaySummary();
  const operationDefinitions = buildBirdCoderOpenApiOperationDefinitions();
  const schemas = buildBirdCoderCodingServerOpenApiSchemas();

  const paths: BirdCoderCodingServerOpenApiDocument['paths'] = {};
  for (const route of routes) {
    const method = route.method.toLowerCase() as Lowercase<BirdCoderApiRouteDefinition['method']>;
    const openApiPath = toOpenApiPathTemplate(route.path);
    const operationId = getOperationIdForRoute(route);
    const security = buildOpenApiOperationSecurity(route, operationId);
    const governanceMetadata = buildOpenApiGovernanceMetadata(route, operationId);
    const operationDefinition = operationDefinitions[operationId];
    paths[openApiPath] = {
      ...(paths[openApiPath] ?? {}),
      [method]: {
        operationId,
        summary: route.summary,
        description: buildOpenApiOperationDescription(route),
        tags: [getOpenApiTagForOperationId(operationId)],
        ...(operationDefinition?.parameters ? { parameters: operationDefinition.parameters } : {}),
        ...(operationDefinition?.requestBody
          ? { requestBody: operationDefinition.requestBody }
          : {}),
        responses: operationDefinition?.responses ?? buildOpenApiDefaultResponses(),
        security,
        'x-sdkwork-auth-mode': route.authMode,
        'x-sdkwork-data-scope': governanceMetadata.dataScope,
        'x-sdkwork-deployment': governanceMetadata.deployment,
        'x-sdkwork-domain': governanceMetadata.domain,
        ...(governanceMetadata.permission
          ? { 'x-sdkwork-permission': governanceMetadata.permission }
          : {}),
        'x-sdkwork-public': governanceMetadata.isPublic,
        'x-sdkwork-resource': governanceMetadata.resource,
        'x-sdkwork-surface': route.surface,
        ...(operationDefinition?.streamKind
          ? { 'x-sdkwork-stream-kind': operationDefinition.streamKind }
          : {}),
        'x-sdkwork-tenant-scope': governanceMetadata.tenantScope,
      },
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'SDKWork BirdCoder Coding Server API',
      version: BIRDCODER_CODING_SERVER_API_VERSION,
      description:
        'OpenAPI 3.1 schema generated from the live BirdCoder unified same-port API gateway.',
    },
    servers: [
      {
        url: '/',
        description: 'Unified same-port BirdCoder API gateway.',
      },
    ],
    tags: Array.from(
      new Set(
        Object.values(paths).flatMap((methodMap) =>
          Object.values(methodMap ?? {}).flatMap((operation) => operation?.tags ?? []),
        ),
      ),
    )
      .sort((left, right) => left.localeCompare(right))
      .map((tag) => ({ name: tag, description: getOpenApiTagDescription(tag) })),
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'Bearer token',
        },
        sdkworkAccessToken: {
          type: 'apiKey',
          in: 'header',
          name: SDKWORK_IAM_HEADERS.accessToken,
        },
      },
      schemas,
    },
    paths,
    'x-sdkwork-api-cloud-gateway': {
      versionedOpenApiPaths: [BIRDCODER_CODING_SERVER_OPENAPI_PATH],
      docsPath: BIRDCODER_CODING_SERVER_DOCS_PATH,
      liveOpenApiPath: BIRDCODER_CODING_SERVER_LIVE_OPENAPI_PATH,
      routeCatalogPath: BIRDCODER_CODING_SERVER_ROUTE_CATALOG_PATH,
      routeCount: gateway.routeCount,
      routesBySurface: gateway.routesBySurface,
      surfaces: [...gateway.surfaces],
    },
  };
}

