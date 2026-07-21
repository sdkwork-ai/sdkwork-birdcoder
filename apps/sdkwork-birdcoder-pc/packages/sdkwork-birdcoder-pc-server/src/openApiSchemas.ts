// Cohesion note (per TYPESCRIPT_CODE_SPEC.md §2):
// This file defines all OpenAPI schemas for the BirdCoder Coding Server API.
// Schemas are interdependent (cross-references, shared types) and reviewed together.
// Splitting would fragment API contract knowledge and harm schema visibility.
// All parts change together when the API contract evolves.

import {
  buildDefaultBirdCoderCodeEngineModelConfig,
  createBirdCoderCodeEngineModelConfigSyncPlan,
  getBirdCoderCodeEngineCapabilities,
  getBirdCoderCodeEngineDescriptor,
  listBirdCoderCodeEngineNativeSessionProviders,
  listBirdCoderCodeEngineDescriptors,
  listBirdCoderCodeEngineModels,
} from '@sdkwork/birdcoder-pc-codeengine';
import type {
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineDescriptor,
  BirdCoderCodeEngineModelConfig,
  BirdCoderCodeEngineModelConfigSyncResult,
  BirdCoderModelCatalogEntry,
  BirdCoderNativeSessionProviderSummary,
  BirdCoderOperationDescriptor,
  BirdCoderApprovalDecisionResult,
  BirdCoderUserQuestionAnswerResult,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  BIRDCODER_CODING_SESSION_ARTIFACT_KINDS,
  BIRDCODER_CODING_SESSION_EVENT_KINDS,
  BIRDCODER_CODING_SESSION_MESSAGE_ROLES,
  BIRDCODER_CODING_SESSION_RUNTIME_STATUSES,
  BIRDCODER_CODING_SESSION_STATUSES,
  BIRDCODER_DATA_SCOPES,
  BIRDCODER_ENGINE_INTEGRATION_CLASSES,
  BIRDCODER_ENGINE_RUNTIME_MODES,
  BIRDCODER_HOST_MODES,
} from '@sdkwork/birdcoder-pc-contracts-commons';
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
} from './serverConstants.ts';

const BIRDCODER_PROJECT_COLLABORATOR_MUTATION_STATUSES = [
  'invited',
  'active',
  'suspended',
] as const;
import type { BirdCoderOpenApiSchema } from './openApiDocumentTypes.ts';
import { listBirdCoderCodingServerEngines } from './domainQueries.ts';
import {
  createOpenApiArraySchema,
  createOpenApiBooleanSchema,
  createOpenApiCommandEnvelopeSchema,
  createOpenApiDataScopeSchema,
  createOpenApiDateTimeSchema,
  createOpenApiEnvelopeSchema,
  createOpenApiIntegerSchema,
  createOpenApiListEnvelopeSchema,
  createOpenApiLongIntegerStringSchema,
  createOpenApiNullableSchema,
  createOpenApiNullableStringSchema,
  createOpenApiNumberSchema,
  createOpenApiObjectSchema,
  createOpenApiSchemaReference,
  createOpenApiStringEnumSchema,
  createOpenApiStringSchema,
  createSdkWorkEnvelopeComponentSchemas,
} from './openApiBuilders.ts';

const BIRDCODER_RUNTIME_LOCATION_CAPABILITIES = [
  'terminal',
  'git',
  'build',
  'file_system',
] as const;

const BIRDCODER_RUNTIME_LOCATION_HEALTH_STATUSES = [
  'pending_verification',
  'local_observed',
  'healthy',
  'degraded',
  'unavailable',
  'revoked',
] as const;

const BIRDCODER_RUNTIME_LOCATION_KINDS = [
  'desktop_checkout',
  'server_workspace',
  'runner_worktree',
  'container_volume',
  'remote_workspace',
] as const;

const BIRDCODER_RUNTIME_LOCATION_PATH_FLAVORS = ['windows', 'posix'] as const;

const BIRDCODER_RUNTIME_TARGET_KINDS = [
  'desktop_device',
  'server',
  'runner',
  'container',
  'remote_workspace',
] as const;

const BIRDCODER_RUNTIME_TARGET_LOCATION_PAIRS = [
  ['desktop_device', 'desktop_checkout'],
  ['server', 'server_workspace'],
  ['runner', 'runner_worktree'],
  ['container', 'container_volume'],
  ['remote_workspace', 'remote_workspace'],
] as const;

function createRuntimeTargetLocationPairSchema(): BirdCoderOpenApiSchema {
  return {
    oneOf: BIRDCODER_RUNTIME_TARGET_LOCATION_PAIRS.map(
      ([runtimeTargetKind, locationKind]) => ({
        type: 'object',
        properties: {
          runtimeTargetKind: {
            const: runtimeTargetKind,
          },
          locationKind: {
            const: locationKind,
          },
        },
        required: ['runtimeTargetKind', 'locationKind'],
      }),
    ),
  };
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
    runtimeLocationId: createOpenApiStringSchema(
      'Verified runtime-location identifier bound when the coding session was created. Legacy sessions may omit this field and cannot execute or trigger native-session discovery.',
    ),
    title: createOpenApiStringSchema(),
    status: createOpenApiStringEnumSchema(BIRDCODER_CODING_SESSION_STATUSES),
    hostMode: createOpenApiStringEnumSchema(BIRDCODER_HOST_MODES),
    engineId: createOpenApiStringEnumSchema(engineKeys),
    modelId: createOpenApiStringSchema(),
    nativeSessionId: createOpenApiStringSchema(),
    nativeAttributes: createOpenApiSchemaReference('BirdCoderNativeSessionAttributes'),
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
  const flexibleMetadataSchema = createOpenApiObjectSchema(
    {},
    {
      additionalProperties: true,
      description: 'Free-form JSON metadata owned by the caller and validated by the service.',
    },
  );

  return {
    ...createSdkWorkEnvelopeComponentSchemas(),
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
    BirdCoderCodeEngineModelConfigEngine: createOpenApiObjectSchema(
      {
        engineId: createOpenApiStringEnumSchema(engineKeys),
        defaultModelId: createOpenApiStringSchema(),
        selectedModelId: createOpenApiStringSchema(),
        models: createOpenApiArraySchema(
          createOpenApiSchemaReference('BirdCoderModelCatalogEntry'),
        ),
      },
      {
        required: [
          'engineId',
          'defaultModelId',
          'selectedModelId',
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
    BirdCoderNativeSessionAttributes: createOpenApiObjectSchema(
      {
        schemaVersion: createOpenApiIntegerSchema(1),
        sessionTreeId: createOpenApiStringSchema(),
        parentSessionId: createOpenApiStringSchema(),
        forkedFromSessionId: createOpenApiStringSchema(),
        title: createOpenApiStringSchema(),
        preview: createOpenApiStringSchema(),
        source: createOpenApiStringSchema(),
        providerVersion: createOpenApiStringSchema(),
        modelProvider: createOpenApiStringSchema(),
        projectId: createOpenApiStringSchema(),
        gitBranch: createOpenApiStringSchema(),
        gitCommit: createOpenApiStringSchema(),
        gitRepositoryUrl: createOpenApiStringSchema(),
        agentName: createOpenApiStringSchema(),
        agentRole: createOpenApiStringSchema(),
        isEphemeral: createOpenApiBooleanSchema(),
        isSidechain: createOpenApiBooleanSchema(),
        metadata: createOpenApiObjectSchema({}, { additionalProperties: true }),
      },
      {
        required: ['schemaVersion', 'isEphemeral', 'isSidechain', 'metadata'],
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
    BirdCoderChatMessageReasoningItem: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        summary: createOpenApiStringSchema(),
        title: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        startedAt: createOpenApiDateTimeSchema(),
        completedAt: createOpenApiDateTimeSchema(),
        durationMs: createOpenApiIntegerSchema(0),
      },
      { required: ['id', 'summary'] },
    ),
    BirdCoderChatMessageResourceOrigin: createOpenApiObjectSchema(
      {
        kind: createOpenApiStringEnumSchema(['file', 'symbol', 'resource']),
        name: createOpenApiStringSchema(),
        path: createOpenApiStringSchema(),
        uri: createOpenApiStringSchema(),
        clientName: createOpenApiStringSchema(),
        lineStart: createOpenApiIntegerSchema(0),
        lineEnd: createOpenApiIntegerSchema(0),
        columnStart: createOpenApiIntegerSchema(0),
        columnEnd: createOpenApiIntegerSchema(0),
        excerpt: createOpenApiStringSchema(),
      },
      { required: ['kind'] },
    ),
    BirdCoderChatMessageResourceCitation: createOpenApiObjectSchema({
      lineStart: createOpenApiIntegerSchema(0),
      lineEnd: createOpenApiIntegerSchema(0),
      note: createOpenApiStringSchema(),
      threadIds: createOpenApiArraySchema(createOpenApiStringSchema()),
    }),
    BirdCoderChatMessageResource: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        kind: createOpenApiStringEnumSchema([
          'file',
          'image',
          'audio',
          'uri',
          'citation',
          'skill',
          'mention',
        ]),
        name: createOpenApiStringSchema(),
        path: createOpenApiStringSchema(),
        uri: createOpenApiStringSchema(),
        mediaSource: createOpenApiStringSchema(),
        mimeType: createOpenApiStringSchema(),
        description: createOpenApiStringSchema(),
        origin: createOpenApiSchemaReference('BirdCoderChatMessageResourceOrigin'),
        citation: createOpenApiSchemaReference('BirdCoderChatMessageResourceCitation'),
      },
      { required: ['id', 'kind'] },
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
        reasoning: createOpenApiArraySchema(
          createOpenApiSchemaReference('BirdCoderChatMessageReasoningItem'),
        ),
        resources: createOpenApiArraySchema(
          createOpenApiSchemaReference('BirdCoderChatMessageResource'),
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
        runtimeLocationId: createOpenApiStringSchema(
          'Verified project runtime-location identifier required for coding-session execution.',
        ),
        title: createOpenApiStringSchema(),
        hostMode: createOpenApiStringEnumSchema(BIRDCODER_HOST_MODES),
        engineId: createOpenApiStringEnumSchema(engineKeys),
        modelId: createOpenApiStringSchema(),
      },
      {
        required: ['workspaceId', 'projectId', 'runtimeLocationId', 'engineId', 'modelId'],
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
    BirdCoderCreateCommerceNotificationRequest: createOpenApiObjectSchema(
      {
        notificationType: createOpenApiStringSchema(),
        title: createOpenApiStringSchema(),
        content: createOpenApiStringSchema(),
        workspaceId: createOpenApiStringSchema(),
        metadata: flexibleMetadataSchema,
      },
      {
        required: ['notificationType', 'title', 'content'],
      },
    ),
    BirdCoderCommerceNotificationSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        notificationType: createOpenApiStringSchema(),
        title: createOpenApiStringSchema(),
        content: createOpenApiStringSchema(),
        status: createOpenApiStringSchema(),
        readAt: createOpenApiNullableStringSchema(),
        sentAt: createOpenApiNullableStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
      },
      {
        required: [
          'id',
          'notificationType',
          'title',
          'content',
          'status',
          'createdAt',
          'updatedAt',
        ],
      },
    ),
    BirdCoderCommerceNotificationCreated: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        notificationType: createOpenApiStringSchema(),
        title: createOpenApiStringSchema(),
        status: createOpenApiStringSchema(),
        sentAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'notificationType', 'title', 'status', 'sentAt'],
      },
    ),
    BirdCoderCommerceNotificationRead: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        status: createOpenApiStringSchema(),
        readAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'status', 'readAt'],
      },
    ),
    BirdCoderCommerceMarkAllRead: createOpenApiObjectSchema(
      {
        updated: createOpenApiLongIntegerStringSchema(),
        status: createOpenApiStringSchema(),
      },
      {
        required: ['updated', 'status'],
      },
    ),
    BirdCoderCommerceUnreadCount: createOpenApiObjectSchema(
      {
        unreadCount: createOpenApiLongIntegerStringSchema(),
      },
      {
        required: ['unreadCount'],
      },
    ),
    BirdCoderRecordCommerceUsageRequest: createOpenApiObjectSchema(
      {
        metricType: createOpenApiStringSchema(),
        metricValue: createOpenApiLongIntegerStringSchema(),
        workspaceId: createOpenApiStringSchema(),
        metadata: flexibleMetadataSchema,
      },
      {
        required: ['metricType', 'metricValue'],
      },
    ),
    BirdCoderCommerceMetricTotal: createOpenApiObjectSchema(
      {
        metricType: createOpenApiStringSchema(),
        total: createOpenApiLongIntegerStringSchema(),
      },
      {
        required: ['metricType', 'total'],
      },
    ),
    BirdCoderCommerceUsageHistoryBucket: createOpenApiObjectSchema(
      {
        period: createOpenApiStringSchema(),
        metricType: createOpenApiStringSchema(),
        total: createOpenApiLongIntegerStringSchema(),
      },
      {
        required: ['period', 'metricType', 'total'],
      },
    ),
    BirdCoderCommerceCurrentPeriodUsage: createOpenApiObjectSchema(
      {
        periodStart: createOpenApiDateTimeSchema(),
        periodEnd: createOpenApiDateTimeSchema(),
        metrics: createOpenApiArraySchema(createOpenApiSchemaReference('BirdCoderCommerceMetricTotal')),
      },
      {
        required: ['periodStart', 'periodEnd', 'metrics'],
      },
    ),
    BirdCoderCommerceUsageBreakdown: createOpenApiObjectSchema(
      {
        periodStart: createOpenApiDateTimeSchema(),
        periodEnd: createOpenApiDateTimeSchema(),
        metrics: createOpenApiArraySchema(createOpenApiSchemaReference('BirdCoderCommerceMetricTotal')),
      },
      {
        required: ['periodStart', 'periodEnd', 'metrics'],
      },
    ),
    BirdCoderCommerceQuotaStatus: createOpenApiObjectSchema(
      {
        metricType: createOpenApiStringSchema(),
        used: createOpenApiLongIntegerStringSchema(),
        limit: createOpenApiLongIntegerStringSchema(),
        remaining: createOpenApiLongIntegerStringSchema(),
        percentage: createOpenApiNumberSchema(),
        periodStart: createOpenApiDateTimeSchema(),
        periodEnd: createOpenApiDateTimeSchema(),
      },
      {
        required: [
          'metricType',
          'used',
          'limit',
          'remaining',
          'percentage',
          'periodStart',
          'periodEnd',
        ],
      },
    ),
    BirdCoderCommerceRecordUsage: createOpenApiObjectSchema(
      {
        recorded: createOpenApiBooleanSchema(),
        metricType: createOpenApiStringSchema(),
        metricValue: createOpenApiLongIntegerStringSchema(),
      },
      {
        required: ['recorded', 'metricType', 'metricValue'],
      },
    ),
    BirdCoderCreateCommerceOrderRequest: createOpenApiObjectSchema(
      {
        packageId: createOpenApiStringSchema(),
        amount: createOpenApiStringSchema(),
        currency: createOpenApiStringSchema(),
        workspaceId: createOpenApiStringSchema(),
        metadata: createOpenApiStringSchema(),
      },
      {
        required: ['packageId', 'amount'],
      },
    ),
    BirdCoderCreateCommercePaymentRequest: createOpenApiObjectSchema(
      {
        orderId: createOpenApiStringSchema(),
        channel: createOpenApiStringSchema(),
        amount: createOpenApiStringSchema(),
        channelTransactionId: createOpenApiStringSchema(),
        metadata: createOpenApiStringSchema(),
      },
      {
        required: ['orderId', 'channel'],
      },
    ),
    BirdCoderConfirmCommercePaymentRequest: createOpenApiObjectSchema(
      {
        channelTransactionId: createOpenApiStringSchema(),
      },
      {
        required: ['channelTransactionId'],
      },
    ),
    BirdCoderCommerceOrderSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        workspaceId: createOpenApiNullableStringSchema(),
        orderNo: createOpenApiStringSchema(),
        userId: createOpenApiStringSchema(),
        packageId: createOpenApiStringSchema(),
        amount: createOpenApiStringSchema(),
        currency: createOpenApiStringSchema(),
        status: createOpenApiStringSchema(),
        paidAt: createOpenApiNullableStringSchema(),
        refundAt: createOpenApiNullableStringSchema(),
        metadata: createOpenApiStringSchema(),
        createdAt: createOpenApiStringSchema(),
        updatedAt: createOpenApiStringSchema(),
      },
      {
        required: [
          'id',
          'orderNo',
          'userId',
          'packageId',
          'amount',
          'currency',
          'status',
          'metadata',
          'createdAt',
          'updatedAt',
        ],
      },
    ),
    BirdCoderCommerceInvoiceSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        invoiceNo: createOpenApiStringSchema(),
        orderId: createOpenApiStringSchema(),
        userId: createOpenApiStringSchema(),
        amount: createOpenApiStringSchema(),
        tax: createOpenApiStringSchema(),
        status: createOpenApiStringSchema(),
        issuedAt: createOpenApiNullableStringSchema(),
        pdfUrl: createOpenApiNullableStringSchema(),
        createdAt: createOpenApiStringSchema(),
        updatedAt: createOpenApiStringSchema(),
      },
      {
        required: [
          'id',
          'invoiceNo',
          'orderId',
          'userId',
          'amount',
          'tax',
          'status',
          'createdAt',
          'updatedAt',
        ],
      },
    ),
    BirdCoderCommercePaymentSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        paymentNo: createOpenApiStringSchema(),
        orderId: createOpenApiStringSchema(),
        userId: createOpenApiStringSchema(),
        channel: createOpenApiStringSchema(),
        channelTransactionId: createOpenApiNullableStringSchema(),
        amount: createOpenApiStringSchema(),
        status: createOpenApiStringSchema(),
        paidAt: createOpenApiNullableStringSchema(),
        refundAt: createOpenApiNullableStringSchema(),
        metadata: createOpenApiStringSchema(),
        createdAt: createOpenApiStringSchema(),
        updatedAt: createOpenApiStringSchema(),
      },
      {
        required: [
          'id',
          'paymentNo',
          'orderId',
          'userId',
          'channel',
          'amount',
          'status',
          'metadata',
          'createdAt',
          'updatedAt',
        ],
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
    BirdCoderProjectWorkspaceBinding: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema('Opaque BirdCoder workspace-binding identifier.'),
        projectId: createOpenApiStringSchema(),
        sandboxId: createOpenApiStringSchema(
          'Opaque Drive sandbox identifier. This reference does not grant Drive access.',
        ),
        rootEntryId: createOpenApiStringSchema(
          'Opaque Drive entry identifier selected as the project root.',
        ),
        logicalPath: {
          ...createOpenApiStringSchema(
            'Canonical sandbox-relative path using forward-slash segments. Empty means the sandbox root.',
          ),
          maxLength: 4096,
          pattern:
            '^(?:$|(?!/)(?!.*//)(?!.*(?:^|/)\\.{1,2}(?:/|$))(?!.*\\\\)(?!.*[\\u0000-\\u001F\\u007F])[^/]{1,255}(?:/[^/]{1,255})*)$',
        },
        lifecycleStatus: createOpenApiStringEnumSchema(['active']),
        version: createOpenApiLongIntegerStringSchema(
          'Optimistic concurrency version used with the If-Match request header.',
        ),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
      },
      {
        description:
          'BirdCoder-owned binding to a Drive sandbox directory. Physical paths, provider roots, browser handles, and Tauri paths are never stored or returned. Every filesystem operation must authorize against Drive again.',
        required: [
          'createdAt',
          'id',
          'lifecycleStatus',
          'logicalPath',
          'projectId',
          'rootEntryId',
          'sandboxId',
          'updatedAt',
          'version',
        ],
      },
    ),
    BirdCoderUpsertProjectWorkspaceBindingRequest: createOpenApiObjectSchema(
      {
        sandboxId: {
          ...createOpenApiStringSchema('Opaque Drive sandbox identifier.'),
          minLength: 1,
          maxLength: 512,
          pattern: '^(?!\\s)(?!.*\\s$)[^\\u0000-\\u001F\\u007F]+$',
        },
        rootEntryId: {
          ...createOpenApiStringSchema('Opaque Drive directory-entry identifier.'),
          minLength: 1,
          maxLength: 512,
          pattern: '^(?!\\s)(?!.*\\s$)[^\\u0000-\\u001F\\u007F]+$',
        },
        logicalPath: {
          ...createOpenApiStringSchema(
            'Canonical sandbox-relative path using forward-slash segments. Empty means the sandbox root.',
          ),
          maxLength: 4096,
          pattern:
            '^(?:$|(?!/)(?!.*//)(?!.*(?:^|/)\\.{1,2}(?:/|$))(?!.*\\\\)(?!.*[\\u0000-\\u001F\\u007F])[^/]{1,255}(?:/[^/]{1,255})*)$',
        },
      },
      {
        required: ['logicalPath', 'rootEntryId', 'sandboxId'],
      },
    ),
    BirdCoderProjectRuntimeLocation: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        uuid: createOpenApiStringSchema(),
        projectId: createOpenApiStringSchema(),
        runtimeTargetId: createOpenApiStringSchema(),
        runtimeTargetKind: createOpenApiStringEnumSchema(
          BIRDCODER_RUNTIME_TARGET_KINDS,
        ),
        locationKind: createOpenApiStringEnumSchema(BIRDCODER_RUNTIME_LOCATION_KINDS),
        pathFlavor: createOpenApiStringEnumSchema(BIRDCODER_RUNTIME_LOCATION_PATH_FLAVORS),
        rootLocator: {
          ...createOpenApiStringSchema(
            'Opaque, path-free runtime target locator. It is not a filesystem path.',
          ),
          maxLength: 160,
          minLength: 1,
          pattern: '^(?!.*\\.\\.)[A-Za-z0-9][A-Za-z0-9._:-]*$',
        },
        displayName: createOpenApiStringSchema('Safe display label for this location.'),
        hasAbsolutePath: createOpenApiBooleanSchema(
          'Whether encrypted absolute path material is registered. The path itself is never returned.',
        ),
        terminalAvailable: createOpenApiBooleanSchema(),
        gitAvailable: createOpenApiBooleanSchema(),
        buildAvailable: createOpenApiBooleanSchema(),
        fileSystemAvailable: createOpenApiBooleanSchema(),
        healthStatus: createOpenApiStringEnumSchema(BIRDCODER_RUNTIME_LOCATION_HEALTH_STATUSES),
        lastVerifiedAt: createOpenApiDateTimeSchema(),
        lastSeenAt: createOpenApiDateTimeSchema(),
        gitRepositoryUrl: createOpenApiStringSchema(
          'Credential-free sanitized Git repository URL reported by a trusted target.',
        ),
        gitRemoteName: createOpenApiStringSchema(),
        gitBranch: createOpenApiStringSchema(),
        gitCommit: createOpenApiStringSchema(),
        gitWorktreeKey: createOpenApiStringSchema(),
        version: createOpenApiLongIntegerStringSchema(
          'Optimistic concurrency version used with the If-Match request header.',
        ),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
      },
      {
        required: [
          'buildAvailable',
          'createdAt',
          'displayName',
          'fileSystemAvailable',
          'gitAvailable',
          'hasAbsolutePath',
          'healthStatus',
          'id',
          'locationKind',
          'pathFlavor',
          'projectId',
          'rootLocator',
          'runtimeTargetId',
          'runtimeTargetKind',
          'terminalAvailable',
          'updatedAt',
          'version',
        ],
      },
    ),
    BirdCoderProjectRuntimeLocationPreference: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        projectId: createOpenApiStringSchema(),
        subjectUserId: createOpenApiStringSchema(),
        capability: createOpenApiStringEnumSchema(BIRDCODER_RUNTIME_LOCATION_CAPABILITIES),
        runtimeLocationId: createOpenApiStringSchema(),
        version: createOpenApiLongIntegerStringSchema(
          'Optimistic concurrency version used with the If-Match request header.',
        ),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
      },
      {
        required: [
          'capability',
          'createdAt',
          'id',
          'projectId',
          'runtimeLocationId',
          'subjectUserId',
          'updatedAt',
          'version',
        ],
      },
    ),
    BirdCoderCreateProjectRuntimeLocationRequest: {
      allOf: [
        createOpenApiObjectSchema(
          {
            runtimeTargetId: createOpenApiStringSchema(),
            runtimeTargetKind: createOpenApiStringEnumSchema(
              BIRDCODER_RUNTIME_TARGET_KINDS,
            ),
            locationKind: createOpenApiStringEnumSchema(BIRDCODER_RUNTIME_LOCATION_KINDS),
            pathFlavor: createOpenApiStringEnumSchema(BIRDCODER_RUNTIME_LOCATION_PATH_FLAVORS),
            rootLocator: {
              ...createOpenApiStringSchema(
                'Opaque, path-free target locator. Do not provide a relative or absolute filesystem path.',
              ),
              maxLength: 160,
              minLength: 1,
              pattern: '^(?!.*\\.\\.)[A-Za-z0-9][A-Za-z0-9._:-]*$',
            },
            absolutePath: {
              ...createOpenApiStringSchema(
                'Write-only absolute path for encrypted-at-rest registration. It is never returned.',
              ),
              maxLength: 4096,
              minLength: 1,
              writeOnly: true,
            },
            displayName: {
              ...createOpenApiStringSchema('Safe display label for the registered location.'),
              maxLength: 160,
              minLength: 1,
            },
          },
          {
            required: [
              'absolutePath',
              'locationKind',
              'pathFlavor',
              'rootLocator',
              'runtimeTargetId',
              'runtimeTargetKind',
            ],
          },
        ),
        createRuntimeTargetLocationPairSchema(),
      ],
    },
    BirdCoderUpdateProjectRuntimeLocationRequest: {
      ...createOpenApiObjectSchema({
        displayName: {
          ...createOpenApiStringSchema('Safe display label for the runtime location.'),
          maxLength: 160,
          minLength: 1,
        },
      }),
      minProperties: 1,
    },
    BirdCoderRebindProjectRuntimeLocationRequest: createOpenApiObjectSchema(
      {
        pathFlavor: createOpenApiStringEnumSchema(BIRDCODER_RUNTIME_LOCATION_PATH_FLAVORS),
        rootLocator: {
          ...createOpenApiStringSchema(
            'Opaque, path-free target locator. Do not provide a relative or absolute filesystem path.',
          ),
          maxLength: 160,
          minLength: 1,
          pattern: '^(?!.*\\.\\.)[A-Za-z0-9][A-Za-z0-9._:-]*$',
        },
        absolutePath: {
          ...createOpenApiStringSchema(
            'Write-only replacement absolute path for encrypted-at-rest registration. It is never returned.',
          ),
          maxLength: 4096,
          minLength: 1,
          writeOnly: true,
        },
        displayName: {
          ...createOpenApiStringSchema('Safe display label for the rebound location.'),
          maxLength: 160,
          minLength: 1,
        },
      },
      {
        required: ['absolutePath', 'pathFlavor', 'rootLocator'],
      },
    ),
    BirdCoderSetProjectRuntimeLocationPreferenceRequest: createOpenApiObjectSchema(
      {
        runtimeLocationId: createOpenApiStringSchema(),
      },
      {
        required: ['runtimeLocationId'],
      },
    ),
    BirdCoderProjectRuntimeLocationCommandAccepted: createOpenApiObjectSchema(
      {
        accepted: {
          type: 'boolean',
          const: true,
        },
        resourceId: createOpenApiStringSchema(),
        status: createOpenApiStringEnumSchema(BIRDCODER_RUNTIME_LOCATION_HEALTH_STATUSES),
      },
      {
        required: ['accepted', 'resourceId', 'status'],
      },
    ),
    BirdCoderGitStatusCounts: createOpenApiObjectSchema(
      {
        staged: createOpenApiIntegerSchema(0),
        unstaged: createOpenApiIntegerSchema(0),
        untracked: createOpenApiIntegerSchema(0),
      },
      {
        required: ['staged', 'unstaged', 'untracked'],
      },
    ),
    BirdCoderGitBranchSummary: createOpenApiObjectSchema(
      {
        isCurrent: createOpenApiBooleanSchema(),
        isRemote: createOpenApiBooleanSchema(),
        name: createOpenApiStringSchema(),
      },
      {
        required: ['isCurrent', 'isRemote', 'name'],
      },
    ),
    BirdCoderGitWorktreeSummary: createOpenApiObjectSchema(
      {
        branch: createOpenApiStringSchema(),
        head: createOpenApiStringSchema(),
        isCurrent: createOpenApiBooleanSchema(),
        prunableReason: createOpenApiStringSchema(),
        worktreeKey: createOpenApiStringSchema(),
      },
      {
        required: ['isCurrent'],
      },
    ),
    BirdCoderProjectGitOverview: createOpenApiObjectSchema(
      {
        branches: createOpenApiArraySchema(
          createOpenApiSchemaReference('BirdCoderGitBranchSummary'),
        ),
        currentBranch: createOpenApiStringSchema(),
        currentRevision: createOpenApiStringSchema(),
        detachedHead: createOpenApiBooleanSchema(),
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
    BirdCoderProjectGitDiff: createOpenApiObjectSchema(
      {
        patch: createOpenApiStringSchema(),
        truncated: createOpenApiBooleanSchema(),
      },
      {
        required: ['patch', 'truncated'],
      },
    ),
    BirdCoderCreateProjectGitBranchRequest: createOpenApiObjectSchema(
      {
        runtimeLocationId: createOpenApiStringSchema(
          'Verified project runtime-location identifier used for Git execution.',
        ),
        branchName: createOpenApiStringSchema(),
      },
      {
        required: ['branchName', 'runtimeLocationId'],
      },
    ),
    BirdCoderSwitchProjectGitBranchRequest: createOpenApiObjectSchema(
      {
        runtimeLocationId: createOpenApiStringSchema(
          'Verified project runtime-location identifier used for Git execution.',
        ),
        branchName: createOpenApiStringSchema(),
      },
      {
        required: ['branchName', 'runtimeLocationId'],
      },
    ),
    BirdCoderCommitProjectGitChangesRequest: createOpenApiObjectSchema(
      {
        runtimeLocationId: createOpenApiStringSchema(
          'Verified project runtime-location identifier used for Git execution.',
        ),
        includeUnstaged: createOpenApiBooleanSchema(),
        message: {
          ...createOpenApiStringSchema('Required non-blank Git commit message.'),
          maxLength: 500,
          minLength: 1,
          pattern: '\\S',
        },
      },
      {
        required: ['message', 'runtimeLocationId'],
      },
    ),
    BirdCoderPushProjectGitBranchRequest: createOpenApiObjectSchema(
      {
        runtimeLocationId: createOpenApiStringSchema(
          'Verified project runtime-location identifier used for Git execution.',
        ),
        branchName: createOpenApiStringSchema(),
        remoteName: createOpenApiStringSchema(),
      },
      {
        required: ['runtimeLocationId'],
      },
    ),
    BirdCoderCreateProjectGitWorktreeRequest: createOpenApiObjectSchema(
      {
        runtimeLocationId: createOpenApiStringSchema(
          'Verified project runtime-location identifier used for Git execution.',
        ),
        branchName: createOpenApiStringSchema(),
      },
      {
        required: ['branchName', 'runtimeLocationId'],
      },
    ),
    BirdCoderRemoveProjectGitWorktreeRequest: createOpenApiObjectSchema(
      {
        runtimeLocationId: createOpenApiStringSchema(
          'Verified project runtime-location identifier used for Git execution.',
        ),
        force: createOpenApiBooleanSchema(),
        worktreeKey: createOpenApiStringSchema(),
      },
      {
        required: ['runtimeLocationId', 'worktreeKey'],
      },
    ),
    BirdCoderPruneProjectGitWorktreesRequest: createOpenApiObjectSchema(
      {
        runtimeLocationId: createOpenApiStringSchema(
          'Verified project runtime-location identifier used for Git execution.',
        ),
      },
      {
        required: ['runtimeLocationId'],
      },
    ),
    BirdCoderCreateProjectRequest: createOpenApiObjectSchema(
      {
        description: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        workspaceId: createOpenApiStringSchema(),
      },
      {
        required: ['name', 'workspaceId'],
      },
    ),
    BirdCoderUpdateProjectRequest: createOpenApiObjectSchema({
      description: createOpenApiStringSchema(),
      name: createOpenApiStringSchema(),
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
    BirdCoderChatConversationSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        title: createOpenApiStringSchema(),
        ownerUserId: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'title', 'ownerUserId', 'createdAt', 'updatedAt'],
      },
    ),
    BirdCoderChatMessageSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        conversationId: createOpenApiStringSchema(),
        role: createOpenApiStringSchema(),
        content: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
      },
      {
        required: ['id', 'conversationId', 'role', 'content', 'createdAt'],
      },
    ),
    BirdCoderCreateChatConversationRequest: createOpenApiObjectSchema(
      {
        title: createOpenApiStringSchema(),
      },
      {},
    ),
    BirdCoderCreateChatMessageRequest: createOpenApiObjectSchema(
      {
        role: createOpenApiStringSchema(),
        content: createOpenApiStringSchema(),
      },
      {
        required: ['role', 'content'],
      },
    ),
    BirdCoderDeleteChatConversationResult: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
      },
      {
        required: ['id'],
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
    BirdCoderUpsertProjectCollaboratorRequest: createOpenApiObjectSchema(
      {
        userId: createOpenApiStringSchema(),
        role: createOpenApiStringEnumSchema(BIRDCODER_COLLABORATION_ROLES),
        status: createOpenApiStringEnumSchema(BIRDCODER_PROJECT_COLLABORATOR_MUTATION_STATUSES),
      },
      {
        required: ['userId'],
      },
    ),
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
        traceId: createOpenApiStringSchema(),
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
    BirdCoderCommerceNotificationSummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCommerceNotificationSummary'),
    ),
    BirdCoderCommerceNotificationSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCommerceNotificationSummary'),
    ),
    BirdCoderCommerceNotificationCreatedEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCommerceNotificationCreated'),
    ),
    BirdCoderCommerceNotificationReadEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCommerceNotificationRead'),
    ),
    BirdCoderCommerceMarkAllReadEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCommerceMarkAllRead'),
    ),
    BirdCoderCommerceUnreadCountEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCommerceUnreadCount'),
    ),
    BirdCoderCommerceRecordUsageEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCommerceRecordUsage'),
    ),
    BirdCoderCommerceCurrentPeriodUsageEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCommerceCurrentPeriodUsage'),
    ),
    BirdCoderCommerceUsageHistoryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCommerceUsageHistoryBucket'),
    ),
    BirdCoderCommerceUsageBreakdownEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCommerceUsageBreakdown'),
    ),
    BirdCoderCommerceQuotaStatusEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCommerceQuotaStatus'),
    ),
    BirdCoderCommerceOrderSummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCommerceOrderSummary'),
    ),
    BirdCoderCommerceOrderSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCommerceOrderSummary'),
    ),
    BirdCoderCommerceInvoiceSummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCommerceInvoiceSummary'),
    ),
    BirdCoderCommerceInvoiceSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCommerceInvoiceSummary'),
    ),
    BirdCoderCommercePaymentSummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCommercePaymentSummary'),
    ),
    BirdCoderCommercePaymentSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderCommercePaymentSummary'),
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
    BirdCoderProjectWorkspaceBindingEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderProjectWorkspaceBinding'),
    ),
    BirdCoderProjectRuntimeLocationEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderProjectRuntimeLocation'),
    ),
    BirdCoderProjectRuntimeLocationListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderProjectRuntimeLocation'),
    ),
    BirdCoderProjectRuntimeLocationCommandEnvelope: createOpenApiCommandEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderProjectRuntimeLocationCommandAccepted'),
    ),
    BirdCoderProjectRuntimeLocationPreferenceEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderProjectRuntimeLocationPreference'),
    ),
    BirdCoderProjectRuntimeLocationPreferenceListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderProjectRuntimeLocationPreference'),
    ),
    BirdCoderProjectGitOverviewEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderProjectGitOverview'),
    ),
    BirdCoderProjectGitDiffEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderProjectGitDiff'),
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
    BirdCoderChatConversationSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderChatConversationSummary'),
    ),
    BirdCoderChatConversationSummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderChatConversationSummary'),
    ),
    BirdCoderChatMessageSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderChatMessageSummary'),
    ),
    BirdCoderChatMessageSummaryEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderChatMessageSummary'),
    ),
    BirdCoderDeleteChatConversationEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderDeleteChatConversationResult'),
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
