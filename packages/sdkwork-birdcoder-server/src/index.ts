import type {
  ChatCanonicalEvent,
  ChatMessage,
  ChatOptions,
} from '../../sdkwork-birdcoder-chat/src/index.ts';
import {
  createWorkbenchServerSessionEngineBinding,
  getBirdCoderCodeEngineCapabilities,
  getBirdCoderCodeEngineDescriptor,
  listBirdCoderCodeEngineNativeSessionProviders,
  listBirdCoderCodeEngineDescriptors,
  listBirdCoderCodeEngineModels,
} from '../../sdkwork-birdcoder-codeengine/src/index.ts';
import {
  resolveTransportKindForRuntimeMode,
} from '../../sdkwork-birdcoder-chat/src/index.ts';
import {
  BIRDCODER_DEFAULT_LOCAL_API_BASE_URL,
  BIRDCODER_DEFAULT_LOCAL_API_HOST,
  BIRDCODER_DEFAULT_LOCAL_API_PORT,
  createBirdHostDescriptorFromDistribution,
  type BirdHostDescriptor,
} from '../../sdkwork-birdcoder-host-core/src/index.ts';
import {
  createUserCenterBridgeConfig,
} from '../../../../sdkwork-appbase/packages/pc-react/identity/sdkwork-user-center-core-pc-react/src/domain/userCenterBridge.ts';
import {
  createUserCenterStandardAppRouteProjection,
  type CreateUserCenterStandardAppRouteProjectionOptions,
} from '../../../../sdkwork-appbase/packages/pc-react/identity/sdkwork-user-center-core-pc-react/src/domain/userCenterStandardAppRoutes.ts';
import type {
  BirdCoderApiEnvelope,
  BirdCoderApiGatewaySummary,
  BirdCoderApiRouteCatalogEntry,
  BirdCoderApiRouteDefinition,
  BirdCoderAdminApiContract,
  BirdCoderApiSurface,
  BirdCoderAppApiContract,
  BirdCoderApprovalDecisionResult,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineDescriptor,
  BirdCoderCodingServerDescriptor,
  BirdCoderCoreApiContract,
  BirdCoderModelCatalogEntry,
  BirdCoderNativeSessionProviderSummary,
  BirdCoderOperationDescriptor,
  BirdCoderCodingSessionArtifact,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionRuntime,
  BirdCoderHostMode,
  BirdCoderAppAdminApiClient,
} from '../../sdkwork-birdcoder-types/src/index.ts';
import {
  BIRDCODER_CODING_SERVER_API_VERSION as BIRDCODER_CODING_SERVER_API_VERSION_VALUE,
  BIRDCODER_CODING_SESSION_ARTIFACT_KINDS,
  BIRDCODER_CODING_SESSION_EVENT_KINDS,
  BIRDCODER_CODING_SESSION_MESSAGE_ROLES,
  BIRDCODER_CODING_SESSION_RUNTIME_STATUSES,
  BIRDCODER_CODING_SESSION_STATUSES,
  BIRDCODER_ENGINE_INTEGRATION_CLASSES,
  BIRDCODER_ENGINE_RUNTIME_MODES,
  BIRDCODER_HOST_MODES,
} from '../../sdkwork-birdcoder-types/src/index.ts';

export const BIRD_SERVER_DEFAULT_HOST = BIRDCODER_DEFAULT_LOCAL_API_HOST;
export const BIRD_SERVER_DEFAULT_PORT = BIRDCODER_DEFAULT_LOCAL_API_PORT;
export const BIRD_SERVER_DEFAULT_CONFIG_FILE_NAME = 'bird-server.config.json';
export const BIRDCODER_CODING_SERVER_API_VERSION = BIRDCODER_CODING_SERVER_API_VERSION_VALUE;
export const BIRDCODER_CODING_SERVER_OPENAPI_PATH = '/openapi/coding-server-v1.json';
export const BIRDCODER_CODING_SERVER_LIVE_OPENAPI_PATH = '/openapi.json';
export const BIRDCODER_CODING_SERVER_DOCS_PATH = '/docs';
export const BIRDCODER_CODING_SERVER_GATEWAY_BASE_PATH = '/api';
export const BIRDCODER_CODING_SERVER_ROUTE_CATALOG_PATH = '/api/core/v1/routes';

export type BirdServerDistributionId = 'cn' | 'global';

export interface BirdCoderCoreSessionRunRequest {
  sessionId: string;
  runtimeId: string;
  turnId: string;
  engineId: string;
  modelId: string;
  hostMode?: BirdCoderHostMode;
  messages: ChatMessage[];
  options?: ChatOptions;
}

export interface BirdCoderCoreSessionRunProjection {
  runtime: BirdCoderCodingSessionRuntime;
  events: BirdCoderCodingSessionEvent[];
  artifacts: BirdCoderCodingSessionArtifact[];
  operation: BirdCoderOperationDescriptor;
}

export interface BirdCoderCoreSessionProjectionSnapshot {
  codingSessionId: string;
  runtime: BirdCoderCodingSessionRuntime | null;
  events: BirdCoderCodingSessionEvent[];
  artifacts: BirdCoderCodingSessionArtifact[];
  operations: BirdCoderOperationDescriptor[];
}

export interface BirdCoderCoreSessionProjectionStore {
  getSessionSnapshot(codingSessionId: string): Promise<BirdCoderCoreSessionProjectionSnapshot>;
  persistRunProjection(
    projection: BirdCoderCoreSessionRunProjection,
  ): Promise<BirdCoderCoreSessionProjectionSnapshot>;
}

type BirdCoderOpenApiSchema = Record<string, unknown>;

interface BirdCoderOpenApiParameterObject {
  name: string;
  in: 'path' | 'query';
  required?: boolean;
  description?: string;
  schema: BirdCoderOpenApiSchema;
}

interface BirdCoderOpenApiRequestBodyObject {
  required?: boolean;
  content: {
    'application/json': {
      schema: BirdCoderOpenApiSchema;
    };
  };
}

interface BirdCoderOpenApiResponseObject {
  description: string;
  content?: {
    'application/json': {
      schema: BirdCoderOpenApiSchema;
    };
  };
}

interface BirdCoderOpenApiOperationObject {
  operationId: string;
  summary: string;
  description: string;
  tags: BirdCoderApiSurface[];
  parameters?: BirdCoderOpenApiParameterObject[];
  requestBody?: BirdCoderOpenApiRequestBodyObject;
  responses: Record<string, BirdCoderOpenApiResponseObject>;
  security?: Array<{ bearerAuth: [] }>;
  'x-sdkwork-auth-mode': BirdCoderApiRouteDefinition['authMode'];
  'x-sdkwork-surface': BirdCoderApiSurface;
  'x-sdkwork-stream-kind'?: (typeof BIRDCODER_STREAM_KINDS)[number];
}

export interface BirdCoderCodingServerOpenApiDocumentSeed {
  openapi: '3.1.0';
  info: {
    title: 'SDKWork BirdCoder Coding Server API';
    version: typeof BIRDCODER_CODING_SERVER_API_VERSION;
    description: string;
  };
  servers: Array<{ url: string; description: string }>;
  tags: Array<{ name: BirdCoderApiSurface; description: string }>;
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http';
        scheme: 'bearer';
        bearerFormat: 'Bearer token';
      };
    };
    schemas?: Record<string, BirdCoderOpenApiSchema>;
  };
  paths: Record<
    string,
    Partial<
      Record<
        Lowercase<BirdCoderApiRouteDefinition['method']>,
        BirdCoderOpenApiOperationObject
      >
    >
  >;
  'x-sdkwork-api-gateway': {
    basePath: typeof BIRDCODER_CODING_SERVER_GATEWAY_BASE_PATH;
    versionedOpenApiPaths: string[];
    docsPath: typeof BIRDCODER_CODING_SERVER_DOCS_PATH;
    liveOpenApiPath: typeof BIRDCODER_CODING_SERVER_LIVE_OPENAPI_PATH;
    routeCatalogPath: typeof BIRDCODER_CODING_SERVER_ROUTE_CATALOG_PATH;
    routeCount: number;
    routesBySurface: Record<BirdCoderApiSurface, number>;
    surfaces: Array<{
      authMode: BirdCoderApiRouteDefinition['authMode'];
      basePath: string;
      description: string;
      name: BirdCoderApiSurface;
      routeCount: number;
    }>;
  };
}

const BIRD_SERVER_DISTRIBUTIONS = {
  global: {
    id: 'global',
    appId: 'sdkwork-birdcoder',
    appName: 'SDKWork BirdCoder',
    apiBaseUrl: BIRDCODER_DEFAULT_LOCAL_API_BASE_URL,
  },
  cn: {
    id: 'cn',
    appId: 'sdkwork-birdcoder-cn',
    appName: 'SDKWork BirdCoder',
    apiBaseUrl: BIRDCODER_DEFAULT_LOCAL_API_BASE_URL,
  },
} as const;

const BIRD_SERVER_RUNTIME_TRANSPORT_BASE_URLS: Record<BirdServerDistributionId, string> = {
  global: BIRDCODER_DEFAULT_LOCAL_API_BASE_URL,
  cn: 'https://cn.sdkwork.local/birdcoder',
};

const BIRDCODER_CODING_SESSION_TURN_REQUEST_KINDS = [
  'chat',
  'plan',
  'tool',
  'review',
  'apply',
] as const;

const BIRDCODER_CODING_SESSION_TURN_STATUSES = [
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;

const BIRDCODER_WORKSPACE_RESOURCE_STATUSES = ['active', 'archived'] as const;

const BIRDCODER_COLLABORATION_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;

const BIRDCODER_COLLABORATION_STATUSES = ['invited', 'active', 'suspended', 'removed'] as const;

const BIRDCODER_GIT_OVERVIEW_STATUSES = ['ready', 'not_repository'] as const;

const BIRDCODER_DOCUMENT_KINDS = [
  'prd',
  'architecture',
  'step',
  'release',
  'test-plan',
  'custom',
] as const;

const BIRDCODER_DOCUMENT_STATUSES = ['draft', 'active', 'archived'] as const;

const BIRDCODER_USER_CENTER_MODES = [
  'builtin-local',
  'sdkwork-cloud-app-api',
  'external-user-center',
] as const;

const BIRDCODER_USER_CENTER_LOGIN_METHODS = [
  'emailCode',
  'password',
  'phoneCode',
  'sessionBridge',
] as const;

const BIRDCODER_USER_CENTER_REGISTER_METHODS = ['email', 'phone'] as const;

const BIRDCODER_USER_CENTER_RECOVERY_METHODS = ['email', 'phone'] as const;

const BIRDCODER_USER_CENTER_VERIFY_TYPES = ['EMAIL', 'PHONE'] as const;

const BIRDCODER_USER_CENTER_VERIFY_SCENES = [
  'LOGIN',
  'REGISTER',
  'RESET_PASSWORD',
] as const;

const BIRDCODER_USER_CENTER_PASSWORD_RESET_CHANNELS = ['EMAIL', 'SMS'] as const;

const BIRDCODER_USER_CENTER_DEVICE_TYPES = ['android', 'desktop', 'ios', 'web'] as const;

const BIRDCODER_USER_CENTER_LOGIN_QR_STATUSES = [
  'pending',
  'scanned',
  'confirmed',
  'expired',
] as const;

const BIRDCODER_DEPLOYMENT_RECORD_STATUSES = [
  'planned',
  'running',
  'succeeded',
  'failed',
  'rolled_back',
] as const;

const BIRDCODER_RELEASE_KINDS = ['formal', 'canary', 'hotfix', 'rollback'] as const;

const BIRDCODER_RELEASE_STATUSES = [
  'pending',
  'ready',
  'running',
  'succeeded',
  'failed',
  'rolled_back',
] as const;

const BIRDCODER_APPROVAL_POLICIES = ['AutoAllow', 'OnRequest', 'Restricted', 'ReleaseOnly'] as const;

const BIRDCODER_API_AUTH_MODES = ['host', 'user', 'admin'] as const;

const BIRDCODER_API_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

const BIRDCODER_API_SURFACE_NAMES = ['core', 'app', 'admin'] as const;

const BIRDCODER_OPERATION_STATUSES = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'rolled_back',
] as const;

const BIRDCODER_STREAM_KINDS = ['sse', 'websocket'] as const;

const BIRDCODER_APPROVAL_DECISIONS = ['approved', 'denied', 'blocked'] as const;

const BIRDCODER_CODING_SESSION_ARTIFACT_STATUSES = ['draft', 'sealed', 'archived'] as const;

const BIRDCODER_CODING_SESSION_CHECKPOINT_KINDS = [
  'resume',
  'approval',
  'handoff',
  'snapshot',
] as const;

const BIRDCODER_MODEL_STATUSES = ['active', 'preview', 'deprecated', 'disabled'] as const;
const BIRDCODER_SERVER_USER_CENTER_NAMESPACE = 'sdkwork-birdcoder';
const BIRDCODER_SERVER_USER_CENTER_LOCAL_API_BASE_PATH = '/api/app/v1';
const BIRDCODER_SERVER_USER_CENTER_ROUTES = Object.freeze({
  authBasePath: '/auth',
  userRoutePath: '/user',
  vipRoutePath: '/vip',
});

export interface BirdServerRuntime extends BirdHostDescriptor {
  host: string;
  port: number;
  configFileName: string;
}

export interface BindBirdCoderServerRuntimeTransportOptions {
  apiBaseUrl?: string;
  appAdminClient?: BirdCoderAppAdminApiClient;
  distributionId?: BirdServerDistributionId;
  host?: BirdServerRuntime;
}

interface BirdCoderCoreSessionProjectionState {
  runtime: BirdCoderCodingSessionRuntime | null;
  events: BirdCoderCodingSessionEvent[];
  artifacts: BirdCoderCodingSessionArtifact[];
  operationsById: Map<string, BirdCoderOperationDescriptor>;
}

interface BirdCoderInfrastructureRuntimeModule {
  bindDefaultBirdCoderIdeServicesRuntime(options: {
    apiBaseUrl?: string;
    appAdminClient?: BirdCoderAppAdminApiClient;
    host?: BirdHostDescriptor;
  }): void;
}

let birdCoderInfrastructureRuntimeModulePromise:
  | Promise<BirdCoderInfrastructureRuntimeModule>
  | null = null;

function createBirdCoderServerUserCenterAppRouteProjection<
  TProjectedRoute,
  TSurface extends string = 'app',
  TAuthMode extends string = 'user',
>(
  options: CreateUserCenterStandardAppRouteProjectionOptions<
    TProjectedRoute,
    TSurface,
    TAuthMode
  >,
) {
  return createUserCenterStandardAppRouteProjection(
    createUserCenterBridgeConfig({
      localApiBasePath: BIRDCODER_SERVER_USER_CENTER_LOCAL_API_BASE_PATH,
      namespace: BIRDCODER_SERVER_USER_CENTER_NAMESPACE,
      provider: {
        kind: 'builtin-local',
      },
      routes: BIRDCODER_SERVER_USER_CENTER_ROUTES,
    }),
    options,
  );
}

function createRoute(
  surface: BirdCoderApiSurface,
  authMode: BirdCoderApiRouteDefinition['authMode'],
  method: BirdCoderApiRouteDefinition['method'],
  path: string,
  summary: string,
): BirdCoderApiRouteDefinition {
  return {
    authMode,
    method,
    path,
    surface,
    summary,
  };
}

function toBirdCoderApiRouteDefinition(
  route: Pick<BirdCoderApiRouteDefinition, 'authMode' | 'method' | 'path' | 'summary' | 'surface'>,
): BirdCoderApiRouteDefinition {
  return {
    authMode: route.authMode,
    method: route.method,
    path: route.path,
    surface: route.surface,
    summary: route.summary,
  };
}

async function loadBirdCoderInfrastructureRuntimeModule(): Promise<BirdCoderInfrastructureRuntimeModule> {
  if (!birdCoderInfrastructureRuntimeModulePromise) {
    birdCoderInfrastructureRuntimeModulePromise = import(
      '@sdkwork/birdcoder-infrastructure'
    ).then(({ bindDefaultBirdCoderIdeServicesRuntime }) => ({
      bindDefaultBirdCoderIdeServicesRuntime,
    }));
  }

  return birdCoderInfrastructureRuntimeModulePromise;
}

const BIRDCODER_USER_CENTER_APP_EXTRA_OPERATION_ENTRIES = [
  ['POST /api/app/v1/auth/oauth/url', 'app.getOAuthAuthorizationUrl'],
  ['POST /api/app/v1/auth/oauth/login', 'app.loginWithOAuth'],
  ['POST /api/app/v1/auth/qr/generate', 'app.generateLoginQrCode'],
  ['GET /api/app/v1/auth/qr/status/:qrKey', 'app.checkLoginQrCodeStatus'],
] as const;

let birdCoderUserCenterAppRouteProjection:
  | ReturnType<typeof createBirdCoderServerUserCenterAppRouteProjection<BirdCoderApiRouteDefinition>>
  | null = null;
let birdCoderAppApiContract: BirdCoderAppApiContract | null = null;

function getBirdCoderUserCenterAppRouteProjection() {
  birdCoderUserCenterAppRouteProjection ??= createBirdCoderServerUserCenterAppRouteProjection(
    {
      authMode: 'user',
      mapRoute: (route) => toBirdCoderApiRouteDefinition(route),
      surface: 'app',
    },
  );
  return birdCoderUserCenterAppRouteProjection;
}

function getBirdCoderUserCenterAppRouteOperationEntries() {
  return getBirdCoderUserCenterAppRouteProjection().operationEntries;
}

function getSurfaceDescription(surface: BirdCoderApiSurface): string {
  switch (surface) {
    case 'core':
      return 'Core coding runtime, engine catalog, session execution, and operation control.';
    case 'app':
      return 'Application-facing workspace, project, collaboration, and user-center routes.';
    case 'admin':
      return 'Administrative governance, audit, release, deployment, and team-management routes.';
    default:
      return 'Unified BirdCoder API surface.';
  }
}

function toOpenApiPathTemplate(path: string): string {
  const normalizedPath = path.trim();
  if (!normalizedPath.startsWith('/')) {
    return normalizedPath;
  }

  return normalizedPath
    .split('/')
    .map((segment) => {
      if (!segment.startsWith(':')) {
        return segment;
      }

      const parameterName = segment.slice(1).trim();
      return parameterName ? `{${parameterName}}` : segment;
    })
    .join('/');
}

function createOpenApiSchemaReference(schemaName: string): BirdCoderOpenApiSchema {
  return {
    $ref: `#/components/schemas/${schemaName}`,
  };
}

function createOpenApiJsonContent(schema: BirdCoderOpenApiSchema) {
  return {
    'application/json': {
      schema,
    },
  } as const;
}

function createOpenApiResponse(
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

function createOpenApiRequestBody(
  schema: BirdCoderOpenApiSchema,
  required = true,
): BirdCoderOpenApiRequestBodyObject {
  return {
    required,
    content: createOpenApiJsonContent(schema),
  };
}

function createOpenApiObjectSchema(
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

function createOpenApiStringSchema(description?: string): BirdCoderOpenApiSchema {
  return {
    type: 'string',
    ...(description ? { description } : {}),
  };
}

function createOpenApiDateTimeSchema(description?: string): BirdCoderOpenApiSchema {
  return {
    type: 'string',
    format: 'date-time',
    ...(description ? { description } : {}),
  };
}

function createOpenApiNullableSchema(
  schema: BirdCoderOpenApiSchema,
  description?: string,
): BirdCoderOpenApiSchema {
  return {
    anyOf: [schema, { type: 'null' }],
    ...(description ? { description } : {}),
  };
}

function createOpenApiNullableStringSchema(description?: string): BirdCoderOpenApiSchema {
  return createOpenApiNullableSchema({ type: 'string' }, description);
}

function createOpenApiIntegerSchema(minimum?: number): BirdCoderOpenApiSchema {
  return {
    type: 'integer',
    ...(typeof minimum === 'number' ? { minimum } : {}),
  };
}

function createOpenApiNumberSchema(description?: string): BirdCoderOpenApiSchema {
  return {
    type: 'number',
    ...(description ? { description } : {}),
  };
}

function createOpenApiBooleanSchema(description?: string): BirdCoderOpenApiSchema {
  return {
    type: 'boolean',
    ...(description ? { description } : {}),
  };
}

function createOpenApiStringEnumSchema(
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

function createOpenApiArraySchema(
  items: BirdCoderOpenApiSchema,
  description?: string,
): BirdCoderOpenApiSchema {
  return {
    type: 'array',
    items,
    ...(description ? { description } : {}),
  };
}

function createOpenApiEnvelopeSchema(dataSchema: BirdCoderOpenApiSchema): BirdCoderOpenApiSchema {
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

function createOpenApiListEnvelopeSchema(itemSchema: BirdCoderOpenApiSchema): BirdCoderOpenApiSchema {
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

function createOpenApiPathParameter(
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

function createOpenApiQueryParameter(
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

function createProblemResponse(description: string): BirdCoderOpenApiResponseObject {
  return createOpenApiResponse(description, createOpenApiSchemaReference('BirdCoderProblemEnvelope'));
}

function buildOpenApiResponses(
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

function buildBirdCoderCodingServerOpenApiSchemas(): Record<string, BirdCoderOpenApiSchema> {
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
    createdAt: createOpenApiDateTimeSchema(),
    updatedAt: createOpenApiDateTimeSchema(),
    lastTurnAt: createOpenApiDateTimeSchema(),
    sortTimestamp: createOpenApiNumberSchema(
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
        basePath: createOpenApiStringSchema(),
        docsPath: createOpenApiStringSchema(),
        liveOpenApiPath: createOpenApiStringSchema(),
        openApiPath: createOpenApiStringSchema(),
        routeCatalogPath: createOpenApiStringSchema(),
        routeCount: createOpenApiIntegerSchema(0),
        routesBySurface: createOpenApiObjectSchema(
          {
            core: createOpenApiIntegerSchema(0),
            app: createOpenApiIntegerSchema(0),
            admin: createOpenApiIntegerSchema(0),
          },
          {
            required: ['core', 'app', 'admin'],
          },
        ),
        surfaces: createOpenApiArraySchema(
          createOpenApiSchemaReference('BirdCoderApiGatewaySurfaceSummary'),
        ),
      },
      {
        required: [
          'basePath',
          'docsPath',
          'liveOpenApiPath',
          'openApiPath',
          'routeCatalogPath',
          'routeCount',
          'routesBySurface',
          'surfaces',
        ],
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
        sequence: createOpenApiIntegerSchema(0),
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
        sortTimestamp: createOpenApiNumberSchema(
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
    BirdCoderCreateCodingSessionTurnRequest: createOpenApiObjectSchema(
      {
        runtimeId: createOpenApiStringSchema(),
        requestKind: createOpenApiStringEnumSchema(BIRDCODER_CODING_SESSION_TURN_REQUEST_KINDS),
        inputSummary: createOpenApiStringSchema(),
        ideContext: createOpenApiSchemaReference('BirdCoderCodingSessionTurnIdeContext'),
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
    BirdCoderUserCenterMetadataSummary: createOpenApiObjectSchema(
      {
        integrationKind: createOpenApiStringSchema(),
        loginMethods: createOpenApiArraySchema(
          createOpenApiStringEnumSchema(BIRDCODER_USER_CENTER_LOGIN_METHODS),
        ),
        mode: createOpenApiStringEnumSchema(BIRDCODER_USER_CENTER_MODES),
        oauthLoginEnabled: createOpenApiBooleanSchema(),
        oauthProviders: createOpenApiArraySchema(createOpenApiStringSchema()),
        providerKey: createOpenApiStringSchema(),
        qrLoginEnabled: createOpenApiBooleanSchema(),
        recoveryMethods: createOpenApiArraySchema(
          createOpenApiStringEnumSchema(BIRDCODER_USER_CENTER_RECOVERY_METHODS),
        ),
        registerMethods: createOpenApiArraySchema(
          createOpenApiStringEnumSchema(BIRDCODER_USER_CENTER_REGISTER_METHODS),
        ),
        sessionHeaderName: createOpenApiStringSchema(),
        supportsLocalCredentials: createOpenApiBooleanSchema(),
        supportsMembershipWrite: createOpenApiBooleanSchema(),
        supportsProfileWrite: createOpenApiBooleanSchema(),
        supportsSessionExchange: createOpenApiBooleanSchema(),
        upstreamBaseUrl: createOpenApiStringSchema(),
      },
      {
        required: [
          'loginMethods',
          'mode',
          'oauthLoginEnabled',
          'oauthProviders',
          'providerKey',
          'qrLoginEnabled',
          'recoveryMethods',
          'registerMethods',
          'sessionHeaderName',
          'supportsLocalCredentials',
          'supportsMembershipWrite',
          'supportsProfileWrite',
          'supportsSessionExchange',
        ],
      },
    ),
    BirdCoderUserCenterSessionSummary: createOpenApiObjectSchema(
      {
        uuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        accessToken: createOpenApiStringSchema(),
        authToken: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        providerKey: createOpenApiStringSchema(),
        providerMode: createOpenApiStringEnumSchema(BIRDCODER_USER_CENTER_MODES),
        refreshToken: createOpenApiStringSchema(),
        sessionId: createOpenApiStringSchema(),
        tokenType: createOpenApiStringSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
        user: createOpenApiSchemaReference('BirdCoderAuthenticatedUserSummary'),
      },
      {
        required: [
          'uuid',
          'accessToken',
          'authToken',
          'createdAt',
          'providerKey',
          'providerMode',
          'sessionId',
          'tokenType',
          'updatedAt',
          'user',
        ],
      },
    ),
    BirdCoderUserCenterLoginRequest: createOpenApiObjectSchema(
      {
        account: createOpenApiStringSchema(),
        email: createOpenApiStringSchema(),
        password: createOpenApiStringSchema(),
      },
    ),
    BirdCoderUserCenterRegisterRequest: createOpenApiObjectSchema(
      {
        channel: createOpenApiStringEnumSchema(BIRDCODER_USER_CENTER_VERIFY_TYPES),
        confirmPassword: createOpenApiStringSchema(),
        email: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        password: createOpenApiStringSchema(),
        phone: createOpenApiStringSchema(),
        username: createOpenApiStringSchema(),
        verificationCode: createOpenApiStringSchema(),
      },
    ),
    BirdCoderUserCenterSendVerifyCodeRequest: createOpenApiObjectSchema(
      {
        scene: createOpenApiStringEnumSchema(BIRDCODER_USER_CENTER_VERIFY_SCENES),
        target: createOpenApiStringSchema(),
        verifyType: createOpenApiStringEnumSchema(BIRDCODER_USER_CENTER_VERIFY_TYPES),
      },
      {
        required: ['scene', 'target', 'verifyType'],
      },
    ),
    BirdCoderUserCenterEmailCodeLoginRequest: createOpenApiObjectSchema(
      {
        appVersion: createOpenApiStringSchema(),
        code: createOpenApiStringSchema(),
        deviceId: createOpenApiStringSchema(),
        deviceName: createOpenApiStringSchema(),
        deviceType: createOpenApiStringEnumSchema(BIRDCODER_USER_CENTER_DEVICE_TYPES),
        email: createOpenApiStringSchema(),
      },
      {
        required: ['code', 'email'],
      },
    ),
    BirdCoderUserCenterPhoneCodeLoginRequest: createOpenApiObjectSchema(
      {
        appVersion: createOpenApiStringSchema(),
        code: createOpenApiStringSchema(),
        deviceId: createOpenApiStringSchema(),
        deviceName: createOpenApiStringSchema(),
        deviceType: createOpenApiStringEnumSchema(BIRDCODER_USER_CENTER_DEVICE_TYPES),
        phone: createOpenApiStringSchema(),
      },
      {
        required: ['code', 'phone'],
      },
    ),
    BirdCoderUserCenterPasswordResetChallengeRequest: createOpenApiObjectSchema(
      {
        account: createOpenApiStringSchema(),
        channel: createOpenApiStringEnumSchema(BIRDCODER_USER_CENTER_PASSWORD_RESET_CHANNELS),
      },
      {
        required: ['account', 'channel'],
      },
    ),
    BirdCoderUserCenterPasswordResetRequest: createOpenApiObjectSchema(
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
    BirdCoderUserCenterOAuthAuthorizationRequest: createOpenApiObjectSchema(
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
    BirdCoderUserCenterOAuthLoginRequest: createOpenApiObjectSchema(
      {
        code: createOpenApiStringSchema(),
        deviceId: createOpenApiStringSchema(),
        deviceType: createOpenApiStringEnumSchema(BIRDCODER_USER_CENTER_DEVICE_TYPES),
        provider: createOpenApiStringSchema(),
        state: createOpenApiStringSchema(),
      },
      {
        required: ['code', 'provider'],
      },
    ),
    BirdCoderUserCenterOAuthAuthorizationSummary: createOpenApiObjectSchema(
      {
        authUrl: createOpenApiStringSchema(),
      },
      {
        required: ['authUrl'],
      },
    ),
    BirdCoderUserCenterSessionExchangeRequest: createOpenApiObjectSchema(
      {
        avatarUrl: createOpenApiStringSchema(),
        email: createOpenApiStringSchema(),
        userId: createOpenApiStringSchema(),
        name: createOpenApiStringSchema(),
        providerKey: createOpenApiStringSchema(),
        subject: createOpenApiStringSchema(),
      },
      {
        required: ['email'],
      },
    ),
    BirdCoderUserCenterLoginQrCodeSummary: createOpenApiObjectSchema(
      {
        description: createOpenApiStringSchema(),
        expireTime: createOpenApiIntegerSchema(0),
        qrContent: createOpenApiStringSchema(),
        qrKey: createOpenApiStringSchema(),
        qrUrl: createOpenApiStringSchema(),
        title: createOpenApiStringSchema(),
        type: createOpenApiStringSchema(),
      },
      {
        required: ['qrKey'],
      },
    ),
    BirdCoderUserCenterLoginQrStatusSummary: createOpenApiObjectSchema(
      {
        session: createOpenApiSchemaReference('BirdCoderUserCenterSessionSummary'),
        status: createOpenApiStringEnumSchema(BIRDCODER_USER_CENTER_LOGIN_QR_STATUSES),
        user: createOpenApiSchemaReference('BirdCoderAuthenticatedUserSummary'),
      },
      {
        required: ['status'],
      },
    ),
    BirdCoderUserCenterProfileSummary: createOpenApiObjectSchema(
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
    BirdCoderUpdateCurrentUserProfileRequest: createOpenApiObjectSchema({
      avatarUrl: createOpenApiStringSchema(),
      bio: createOpenApiStringSchema(),
      company: createOpenApiStringSchema(),
      displayName: createOpenApiStringSchema(),
      location: createOpenApiStringSchema(),
      website: createOpenApiStringSchema(),
    }),
    BirdCoderUserCenterMembershipSummary: createOpenApiObjectSchema(
      {
        uuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
        creditsPerMonth: createOpenApiNumberSchema(),
        userId: createOpenApiStringSchema(),
        planId: createOpenApiStringSchema(),
        planTitle: createOpenApiStringSchema(),
        renewAt: createOpenApiStringSchema(),
        seats: createOpenApiNumberSchema(),
        status: createOpenApiStringSchema(),
      },
      {
        required: [
          'uuid',
          'createdAt',
          'updatedAt',
          'creditsPerMonth',
          'userId',
          'planId',
          'planTitle',
          'seats',
          'status',
        ],
      },
    ),
    BirdCoderUpdateCurrentUserMembershipRequest: createOpenApiObjectSchema({
      creditsPerMonth: createOpenApiNumberSchema(),
      planId: createOpenApiStringSchema(),
      planTitle: createOpenApiStringSchema(),
      renewAt: createOpenApiStringSchema(),
      seats: createOpenApiNumberSchema(),
      status: createOpenApiStringSchema(),
    }),
    BirdCoderWorkspaceSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        uuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        dataScope: createOpenApiStringSchema(),
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
        maxStorage: createOpenApiIntegerSchema(0),
        usedStorage: createOpenApiIntegerSchema(0),
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
        dataScope: createOpenApiStringSchema(),
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
        maxStorage: createOpenApiIntegerSchema(0),
        usedStorage: createOpenApiIntegerSchema(0),
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
      dataScope: createOpenApiStringSchema(),
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
      maxStorage: createOpenApiIntegerSchema(0),
      usedStorage: createOpenApiIntegerSchema(0),
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
        dataScope: createOpenApiStringSchema(),
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
        budgetAmount: createOpenApiIntegerSchema(0),
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
        dataScope: createOpenApiStringSchema(),
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
        budgetAmount: createOpenApiIntegerSchema(0),
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
      dataScope: createOpenApiStringSchema(),
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
      budgetAmount: createOpenApiIntegerSchema(0),
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
        installCount: createOpenApiIntegerSchema(0),
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
        installCount: createOpenApiIntegerSchema(0),
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
    BirdCoderAdminAuditEventSummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        uuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
        scopeType: createOpenApiStringSchema(),
        scopeId: createOpenApiStringSchema(),
        eventType: createOpenApiStringSchema(),
        payload: {
          type: 'object',
          additionalProperties: true,
        },
      },
      {
        required: ['id', 'scopeType', 'scopeId', 'eventType', 'payload'],
      },
    ),
    BirdCoderAdminPolicySummary: createOpenApiObjectSchema(
      {
        id: createOpenApiStringSchema(),
        uuid: createOpenApiStringSchema(),
        tenantId: createOpenApiStringSchema(),
        organizationId: createOpenApiStringSchema(),
        createdAt: createOpenApiDateTimeSchema(),
        updatedAt: createOpenApiDateTimeSchema(),
        scopeType: createOpenApiStringSchema(
          'Known values include global, workspace, project, team, release, and runtime.',
        ),
        scopeId: createOpenApiStringSchema(),
        policyCategory: createOpenApiStringSchema(
          'Known values include terminal, engine, deployment, release, workspace, and project.',
        ),
        targetType: createOpenApiStringSchema(
          'Known values include engine, workflow, terminal-profile, deployment-target, workspace, and project.',
        ),
        targetId: createOpenApiStringSchema(),
        approvalPolicy: createOpenApiStringEnumSchema(BIRDCODER_APPROVAL_POLICIES),
        rationale: createOpenApiStringSchema(),
        status: createOpenApiStringSchema('Known values include draft, active, and archived.'),
      },
      {
        required: [
          'id',
          'scopeType',
          'scopeId',
          'policyCategory',
          'targetType',
          'targetId',
          'approvalPolicy',
          'status',
          'updatedAt',
        ],
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
    BirdCoderOperationDescriptorEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderOperationDescriptor'),
    ),
    BirdCoderApprovalDecisionResultEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderApprovalDecisionResult'),
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
    BirdCoderBooleanSuccessEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderBooleanSuccessResult'),
    ),
    BirdCoderUserCenterMetadataEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderUserCenterMetadataSummary'),
    ),
    BirdCoderUserCenterLoginQrCodeEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderUserCenterLoginQrCodeSummary'),
    ),
    BirdCoderUserCenterLoginQrStatusEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderUserCenterLoginQrStatusSummary'),
    ),
    BirdCoderUserCenterSessionEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderUserCenterSessionSummary'),
    ),
    BirdCoderUserCenterOAuthAuthorizationEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderUserCenterOAuthAuthorizationSummary'),
    ),
    BirdCoderNullableUserCenterSessionEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiNullableSchema(createOpenApiSchemaReference('BirdCoderUserCenterSessionSummary')),
    ),
    BirdCoderUserCenterProfileEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderUserCenterProfileSummary'),
    ),
    BirdCoderUserCenterMembershipEnvelope: createOpenApiEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderUserCenterMembershipSummary'),
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
    BirdCoderAdminAuditEventSummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderAdminAuditEventSummary'),
    ),
    BirdCoderAdminPolicySummaryListEnvelope: createOpenApiListEnvelopeSchema(
      createOpenApiSchemaReference('BirdCoderAdminPolicySummary'),
    ),
  };
}

interface BirdCoderOpenApiOperationDefinition {
  parameters?: BirdCoderOpenApiParameterObject[];
  requestBody?: BirdCoderOpenApiRequestBodyObject;
  responses: Record<string, BirdCoderOpenApiResponseObject>;
  streamKind?: (typeof BIRDCODER_STREAM_KINDS)[number];
}

function buildBirdCoderOpenApiOperationDefinitions(): Record<
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
    'id',
    'BirdCoder coding session identifier.',
  );
  const messageIdPathParameter = createOpenApiPathParameter(
    'messageId',
    'BirdCoder coding session message identifier.',
  );
  const engineKeyPathParameter = createOpenApiPathParameter(
    'engineKey',
    'BirdCoder engine key.',
  );
  const approvalIdPathParameter = createOpenApiPathParameter(
    'approvalId',
    'Approval checkpoint identifier.',
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
    'Runtime user-center session id used to authorize the websocket upgrade.',
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
  const qrKeyPathParameter = createOpenApiPathParameter(
    'qrKey',
    'BirdCoder login QR challenge identifier.',
  );

  return {
    'core.getDescriptor': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Coding server descriptor returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCodingServerDescriptorEnvelope'),
      }),
    },
    'core.listRoutes': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Unified route catalog returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderApiRouteCatalogEntryListEnvelope'),
      }),
    },
    'core.listEngines': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Engine catalog returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderEngineDescriptorListEnvelope'),
      }),
    },
    'core.listCodingSessions': {
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
    'core.createCodingSession': {
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
    'core.getCodingSession': {
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
    'core.updateCodingSession': {
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
    'core.deleteCodingSession': {
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
    'core.deleteCodingSessionMessage': {
      parameters: [codingSessionIdPathParameter, messageIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Coding session message deleted successfully.',
        successSchema: createOpenApiSchemaReference(
          'BirdCoderDeleteCodingSessionMessageResultEnvelope',
        ),
        extraResponses: {
          '404': createProblemResponse('Coding session message was not found.'),
          '500': createProblemResponse('Coding session message could not be deleted.'),
        },
      }),
    },
    'core.forkCodingSession': {
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
    'core.createCodingSessionTurn': {
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
    'core.listCodingSessionEvents': {
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
    'core.listNativeSessions': {
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
    'core.listNativeSessionProviders': {
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
    'core.getNativeSession': {
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
    'core.getEngineCapabilities': {
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
    'core.listModels': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Model catalog returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderModelCatalogEntryListEnvelope'),
      }),
    },
    'core.getRuntime': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Runtime metadata returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCoreRuntimeSummaryEnvelope'),
      }),
    },
    'core.getHealth': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Runtime health returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCoreHealthSummaryEnvelope'),
      }),
    },
    'core.getOperation': {
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
    'core.submitApprovalDecision': {
      parameters: [approvalIdPathParameter],
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
    'core.listCodingSessionArtifacts': {
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
    'core.listCodingSessionCheckpoints': {
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
    'app.getUserCenterConfig': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'User center provider metadata returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderUserCenterMetadataEnvelope'),
      }),
    },
    'app.getCurrentUserSession': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Current user center session returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderNullableUserCenterSessionEnvelope'),
      }),
    },
    'app.generateLoginQrCode': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'User center login QR challenge created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderUserCenterLoginQrCodeEnvelope'),
        extraResponses: {
          '500': createProblemResponse('User center login QR challenge could not be created.'),
        },
      }),
    },
    'app.checkLoginQrCodeStatus': {
      parameters: [qrKeyPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'User center login QR status returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderUserCenterLoginQrStatusEnvelope'),
        extraResponses: {
          '404': createProblemResponse('User center login QR challenge was not found.'),
        },
      }),
    },
    'app.login': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUserCenterLoginRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'User center session created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderUserCenterSessionEnvelope'),
        extraResponses: {
          '400': createProblemResponse('User center login request is invalid.'),
          '401': createProblemResponse('User center credentials were rejected.'),
        },
      }),
    },
    'app.loginWithEmailCode': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUserCenterEmailCodeLoginRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'User center session created successfully with email verification.',
        successSchema: createOpenApiSchemaReference('BirdCoderUserCenterSessionEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Email-code login request is invalid.'),
          '401': createProblemResponse('Email verification code was rejected.'),
        },
      }),
    },
    'app.loginWithPhoneCode': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUserCenterPhoneCodeLoginRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'User center session created successfully with phone verification.',
        successSchema: createOpenApiSchemaReference('BirdCoderUserCenterSessionEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Phone-code login request is invalid.'),
          '401': createProblemResponse('Phone verification code was rejected.'),
        },
      }),
    },
    'app.getOAuthAuthorizationUrl': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUserCenterOAuthAuthorizationRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'OAuth authorization URL resolved successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderUserCenterOAuthAuthorizationEnvelope'),
        extraResponses: {
          '400': createProblemResponse('OAuth authorization request is invalid.'),
        },
      }),
    },
    'app.loginWithOAuth': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUserCenterOAuthLoginRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'User center session created successfully with OAuth authorization.',
        successSchema: createOpenApiSchemaReference('BirdCoderUserCenterSessionEnvelope'),
        extraResponses: {
          '400': createProblemResponse('OAuth login request is invalid.'),
          '401': createProblemResponse('OAuth authorization code was rejected.'),
        },
      }),
    },
    'app.register': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUserCenterRegisterRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'User center user registered successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderUserCenterSessionEnvelope'),
        extraResponses: {
          '400': createProblemResponse('User center registration request is invalid.'),
        },
      }),
    },
    'app.sendVerifyCode': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUserCenterSendVerifyCodeRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Verification code dispatch accepted successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderBooleanSuccessEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Verification code request is invalid.'),
        },
      }),
    },
    'app.requestPasswordReset': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUserCenterPasswordResetChallengeRequest'),
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
    'app.resetPassword': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUserCenterPasswordResetRequest'),
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
    'app.logout': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'User center session revoked successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderBooleanSuccessEnvelope'),
      }),
    },
    'app.exchangeUserCenterSession': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUserCenterSessionExchangeRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'External user center identity exchanged successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderUserCenterSessionEnvelope'),
        extraResponses: {
          '400': createProblemResponse('User center session exchange request is invalid.'),
        },
      }),
    },
    'app.getCurrentUserProfile': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Current user profile returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderUserCenterProfileEnvelope'),
      }),
    },
    'app.updateCurrentUserProfile': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateCurrentUserProfileRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Current user profile updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderUserCenterProfileEnvelope'),
      }),
    },
    'app.getCurrentUserMembership': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Current user membership returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderUserCenterMembershipEnvelope'),
      }),
    },
    'app.updateCurrentUserMembership': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateCurrentUserMembershipRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Current user membership updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderUserCenterMembershipEnvelope'),
      }),
    },
    'app.listWorkspaces': {
      parameters: [userIdParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Workspace inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderWorkspaceSummaryListEnvelope'),
      }),
    },
    'app.createWorkspace': {
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
    'app.updateWorkspace': {
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
    'app.deleteWorkspace': {
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
    'app.subscribeWorkspaceRealtime': {
      parameters: [workspaceIdPathParameter, sessionIdQueryParameter],
      streamKind: 'websocket',
      responses: {
        '101': createOpenApiResponse(
          'WebSocket upgrade accepted for workspace realtime delivery.',
        ),
        '400': createProblemResponse('Workspace realtime subscription request is invalid.'),
        '401': createProblemResponse('A valid user-center session is required.'),
        '404': createProblemResponse('Workspace was not found.'),
        default: createProblemResponse('Problem response envelope.'),
      },
    },
    'app.listProjects': {
      parameters: [userIdParameter, workspaceIdParameter, rootPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectSummaryListEnvelope'),
      }),
    },
    'app.getProject': {
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
    'app.getProjectGitOverview': {
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
    'app.createProjectGitBranch': {
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
    'app.switchProjectGitBranch': {
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
    'app.commitProjectGitChanges': {
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
    'app.pushProjectGitBranch': {
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
    'app.createProjectGitWorktree': {
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
    'app.removeProjectGitWorktree': {
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
    'app.pruneProjectGitWorktrees': {
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
    'app.listProjectCollaborators': {
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
    'app.upsertProjectCollaborator': {
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
    'app.createProject': {
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
    'app.updateProject': {
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
    'app.deleteProject': {
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
    'app.listSkillPackages': {
      parameters: [userIdParameter, workspaceIdParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Skill package catalog returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderSkillPackageSummaryListEnvelope'),
      }),
    },
    'app.installSkillPackage': {
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
    'app.listAppTemplates': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'App template catalog returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderAppTemplateSummaryListEnvelope'),
      }),
    },
    'app.listDocuments': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project documents returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectDocumentSummaryListEnvelope'),
      }),
    },
    'app.listTeams': {
      parameters: [userIdParameter, workspaceIdParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Workspace team inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderTeamSummaryListEnvelope'),
      }),
    },
    'app.listWorkspaceMembers': {
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
    'app.upsertWorkspaceMember': {
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
    'app.publishProject': {
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
    'app.listDeployments': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Deployment inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderDeploymentRecordSummaryListEnvelope'),
      }),
    },
    'admin.listAuditEvents': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Audit events returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderAdminAuditEventSummaryListEnvelope'),
      }),
    },
    'admin.listPolicies': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Governance policies returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderAdminPolicySummaryListEnvelope'),
      }),
    },
    'admin.listTeams': {
      parameters: [userIdParameter, workspaceIdParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Admin team inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderTeamSummaryListEnvelope'),
      }),
    },
    'admin.listTeamMembers': {
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
    'admin.listDeploymentTargets': {
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
    'admin.listReleases': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Release inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderReleaseSummaryListEnvelope'),
      }),
    },
    'admin.listDeployments': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Admin deployment inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderDeploymentRecordSummaryListEnvelope'),
      }),
    },
  };
}

function buildOpenApiDefaultResponses(): Record<string, BirdCoderOpenApiResponseObject> {
  return {
    '200': {
      description: 'Successful response',
    },
    default: {
      ...createProblemResponse('Problem response envelope.'),
    },
  };
}

function getSurfaceBasePath(surface: BirdCoderApiSurface): string {
  switch (surface) {
    case 'core':
      return '/api/core/v1';
    case 'app':
      return '/api/app/v1';
    case 'admin':
      return '/api/admin/v1';
    default:
      return BIRDCODER_CODING_SERVER_GATEWAY_BASE_PATH;
  }
}

function buildOpenApiOperationDescription(route: BirdCoderApiRouteDefinition): string {
  const authDescription =
    route.authMode === 'host'
      ? 'No user session is required; this route is available on the host runtime surface.'
      : route.authMode === 'user'
        ? 'Requires an authenticated BirdCoder user session.'
        : 'Requires an authenticated BirdCoder admin session.';

  return `${route.summary}. ${authDescription}`;
}

function buildOpenApiOperationSecurity(
  route: BirdCoderApiRouteDefinition,
): Array<{ bearerAuth: [] }> | undefined {
  return route.authMode === 'host' ? undefined : [{ bearerAuth: [] }];
}

function getOperationIdForRoute(route: BirdCoderApiRouteDefinition): string {
  const operationIds = new Map<string, string>([
    ['GET /api/core/v1/descriptor', 'core.getDescriptor'],
    ['GET /api/core/v1/routes', 'core.listRoutes'],
    ['GET /api/core/v1/engines', 'core.listEngines'],
    ['GET /api/core/v1/native-session-providers', 'core.listNativeSessionProviders'],
    ['GET /api/core/v1/native-sessions', 'core.listNativeSessions'],
    ['GET /api/core/v1/native-sessions/:id', 'core.getNativeSession'],
    ['GET /api/core/v1/engines/:engineKey/capabilities', 'core.getEngineCapabilities'],
    ['GET /api/core/v1/models', 'core.listModels'],
    ['GET /api/core/v1/runtime', 'core.getRuntime'],
    ['GET /api/core/v1/health', 'core.getHealth'],
    ['GET /api/core/v1/coding-sessions', 'core.listCodingSessions'],
    ['POST /api/core/v1/coding-sessions', 'core.createCodingSession'],
    ['GET /api/core/v1/coding-sessions/:id', 'core.getCodingSession'],
    ['PATCH /api/core/v1/coding-sessions/:id', 'core.updateCodingSession'],
    ['DELETE /api/core/v1/coding-sessions/:id', 'core.deleteCodingSession'],
    ['DELETE /api/core/v1/coding-sessions/:id/messages/:messageId', 'core.deleteCodingSessionMessage'],
    ['POST /api/core/v1/coding-sessions/:id/fork', 'core.forkCodingSession'],
    ['POST /api/core/v1/coding-sessions/:id/turns', 'core.createCodingSessionTurn'],
    ['GET /api/core/v1/coding-sessions/:id/events', 'core.listCodingSessionEvents'],
    ['GET /api/core/v1/coding-sessions/:id/artifacts', 'core.listCodingSessionArtifacts'],
    ['GET /api/core/v1/coding-sessions/:id/checkpoints', 'core.listCodingSessionCheckpoints'],
    ['POST /api/core/v1/approvals/:approvalId/decision', 'core.submitApprovalDecision'],
    ['GET /api/core/v1/operations/:operationId', 'core.getOperation'],
    ...getBirdCoderUserCenterAppRouteOperationEntries(),
    ...BIRDCODER_USER_CENTER_APP_EXTRA_OPERATION_ENTRIES,
    ['POST /api/app/v1/auth/email/login', 'app.loginWithEmailCode'],
    ['POST /api/app/v1/auth/phone/login', 'app.loginWithPhoneCode'],
    ['POST /api/app/v1/auth/verify/send', 'app.sendVerifyCode'],
    ['POST /api/app/v1/auth/password/reset/request', 'app.requestPasswordReset'],
    ['POST /api/app/v1/auth/password/reset', 'app.resetPassword'],
    ['GET /api/app/v1/workspaces', 'app.listWorkspaces'],
    ['POST /api/app/v1/workspaces', 'app.createWorkspace'],
    ['PATCH /api/app/v1/workspaces/:workspaceId', 'app.updateWorkspace'],
    ['DELETE /api/app/v1/workspaces/:workspaceId', 'app.deleteWorkspace'],
    ['GET /api/app/v1/workspaces/:workspaceId/realtime', 'app.subscribeWorkspaceRealtime'],
    ['GET /api/app/v1/projects', 'app.listProjects'],
    ['GET /api/app/v1/projects/:projectId', 'app.getProject'],
    ['GET /api/app/v1/projects/:projectId/git/overview', 'app.getProjectGitOverview'],
    ['POST /api/app/v1/projects/:projectId/git/branches', 'app.createProjectGitBranch'],
    ['POST /api/app/v1/projects/:projectId/git/branch-switch', 'app.switchProjectGitBranch'],
    ['POST /api/app/v1/projects/:projectId/git/commits', 'app.commitProjectGitChanges'],
    ['POST /api/app/v1/projects/:projectId/git/pushes', 'app.pushProjectGitBranch'],
    ['POST /api/app/v1/projects/:projectId/git/worktrees', 'app.createProjectGitWorktree'],
    ['POST /api/app/v1/projects/:projectId/git/worktree-removals', 'app.removeProjectGitWorktree'],
    ['POST /api/app/v1/projects/:projectId/git/worktree-prune', 'app.pruneProjectGitWorktrees'],
    ['GET /api/app/v1/projects/:projectId/collaborators', 'app.listProjectCollaborators'],
    ['POST /api/app/v1/projects/:projectId/collaborators', 'app.upsertProjectCollaborator'],
    ['POST /api/app/v1/projects', 'app.createProject'],
    ['PATCH /api/app/v1/projects/:projectId', 'app.updateProject'],
    ['DELETE /api/app/v1/projects/:projectId', 'app.deleteProject'],
    ['GET /api/app/v1/skill-packages', 'app.listSkillPackages'],
    ['POST /api/app/v1/skill-packages/:packageId/installations', 'app.installSkillPackage'],
    ['GET /api/app/v1/app-templates', 'app.listAppTemplates'],
    ['GET /api/app/v1/documents', 'app.listDocuments'],
    ['GET /api/app/v1/teams', 'app.listTeams'],
    ['GET /api/app/v1/workspaces/:workspaceId/members', 'app.listWorkspaceMembers'],
    ['POST /api/app/v1/workspaces/:workspaceId/members', 'app.upsertWorkspaceMember'],
    ['POST /api/app/v1/projects/:projectId/publish', 'app.publishProject'],
    ['GET /api/app/v1/deployments', 'app.listDeployments'],
    ['GET /api/admin/v1/audit', 'admin.listAuditEvents'],
    ['GET /api/admin/v1/policies', 'admin.listPolicies'],
    ['GET /api/admin/v1/teams', 'admin.listTeams'],
    ['GET /api/admin/v1/teams/:teamId/members', 'admin.listTeamMembers'],
    ['GET /api/admin/v1/projects/:projectId/deployment-targets', 'admin.listDeploymentTargets'],
    ['GET /api/admin/v1/releases', 'admin.listReleases'],
    ['GET /api/admin/v1/deployments', 'admin.listDeployments'],
  ]);

  return (
    operationIds.get(`${route.method} ${route.path}`) ??
    `${route.surface}.${route.method.toLowerCase()}.${route.path}`
  );
}

export function listBirdCoderCodingServerRouteCatalogEntries(): BirdCoderApiRouteCatalogEntry[] {
  return listBirdCoderCodingServerRoutes().map((route) => ({
    ...route,
    openApiPath: toOpenApiPathTemplate(route.path),
    operationId: getOperationIdForRoute(route),
  }));
}

function buildBirdCoderApiGatewaySummary(): BirdCoderApiGatewaySummary {
  const routeCatalog = listBirdCoderCodingServerRouteCatalogEntries();
  const routesBySurface = routeCatalog.reduce<Record<BirdCoderApiSurface, number>>(
    (accumulator, route) => {
      accumulator[route.surface] += 1;
      return accumulator;
    },
    {
      core: 0,
      app: 0,
      admin: 0,
    },
  );

  return {
    basePath: BIRDCODER_CODING_SERVER_GATEWAY_BASE_PATH,
    docsPath: BIRDCODER_CODING_SERVER_DOCS_PATH,
    liveOpenApiPath: BIRDCODER_CODING_SERVER_LIVE_OPENAPI_PATH,
    openApiPath: BIRDCODER_CODING_SERVER_OPENAPI_PATH,
    routeCatalogPath: BIRDCODER_CODING_SERVER_ROUTE_CATALOG_PATH,
    routeCount: routeCatalog.length,
    routesBySurface,
    surfaces: (['core', 'app', 'admin'] as const).map((surface) => ({
      authMode:
        surface === 'core' ? 'host' : surface === 'app' ? 'user' : 'admin',
      basePath: getSurfaceBasePath(surface),
      description: getSurfaceDescription(surface),
      name: surface,
      routeCount: routesBySurface[surface],
    })),
  };
}

function buildRequestId(seed: string): string {
  return `req:${seed}:${Date.now().toString(36)}`;
}

function createEmptyCoreSessionProjectionSnapshot(
  codingSessionId: string,
): BirdCoderCoreSessionProjectionSnapshot {
  return {
    codingSessionId,
    runtime: null,
    events: [],
    artifacts: [],
    operations: [],
  };
}

function cloneCoreSessionProjectionSnapshot(
  codingSessionId: string,
  state: BirdCoderCoreSessionProjectionState,
): BirdCoderCoreSessionProjectionSnapshot {
  return {
    codingSessionId,
    runtime: state.runtime ? { ...state.runtime } : null,
    events: [...state.events],
    artifacts: [...state.artifacts],
    operations: [...state.operationsById.values()],
  };
}

function appendDistinctById<TEntity extends { id: string }>(
  target: TEntity[],
  entries: readonly TEntity[],
): void {
  const existingIds = new Set(target.map((entry) => entry.id));
  for (const entry of entries) {
    if (existingIds.has(entry.id)) {
      continue;
    }
    target.push(entry);
    existingIds.add(entry.id);
  }
}

function createEnvelope<T>(data: T, seed: string): BirdCoderApiEnvelope<T> {
  return {
    requestId: buildRequestId(seed),
    timestamp: new Date().toISOString(),
    data,
    meta: {
      version: BIRDCODER_CODING_SERVER_API_VERSION,
    },
  };
}

function mapCanonicalEventToCoreEvent(
  request: BirdCoderCoreSessionRunRequest,
  canonicalEvent: ChatCanonicalEvent,
): {
  event: BirdCoderCodingSessionEvent;
  artifact: BirdCoderCodingSessionArtifact | null;
} {
  const createdAt = new Date().toISOString();
  const event: BirdCoderCodingSessionEvent = {
    id: `${request.runtimeId}:${request.turnId}:event:${canonicalEvent.sequence}`,
    codingSessionId: request.sessionId,
    turnId: request.turnId,
    runtimeId: request.runtimeId,
    kind: canonicalEvent.kind,
    sequence: canonicalEvent.sequence,
    payload: {
      ...canonicalEvent.payload,
      engineId: request.engineId,
      modelId: request.modelId,
      runtimeStatus: canonicalEvent.runtimeStatus,
    },
    createdAt,
  };

  const artifact = canonicalEvent.artifact
    ? {
        id: `${request.turnId}:artifact:${canonicalEvent.sequence}`,
        codingSessionId: request.sessionId,
        turnId: request.turnId,
        kind: canonicalEvent.artifact.kind,
        status: 'sealed' as const,
        title: canonicalEvent.artifact.title,
        metadata: {
          ...canonicalEvent.artifact.metadata,
          sourceEventKind: canonicalEvent.kind,
          sourceSequence: canonicalEvent.sequence,
          runtimeStatus: canonicalEvent.runtimeStatus,
        },
        createdAt,
      }
    : null;

  return {
    event,
    artifact,
  };
}

function resolveRequiredRuntimeModelId(
  request: BirdCoderCoreSessionRunRequest,
): string {
  const requestModelId =
    typeof request.modelId === 'string' ? request.modelId.trim() : '';
  if (!requestModelId) {
    throw new Error(
      `Coding session run requires an explicit model id for engine "${request.engineId}".`,
    );
  }

  const optionsModelId = request.options?.model?.trim();
  if (
    optionsModelId &&
    optionsModelId.localeCompare(requestModelId, undefined, { sensitivity: 'accent' }) !== 0
  ) {
    throw new Error(
      `Coding session run model id mismatch for engine "${request.engineId}": request model "${requestModelId}" does not match options model "${optionsModelId}".`,
    );
  }

  return requestModelId;
}

function resolveOperationStatus(
  events: BirdCoderCodingSessionEvent[],
): BirdCoderOperationDescriptor['status'] {
  const lastEvent = events.at(-1);
  if (!lastEvent) {
    return 'queued';
  }

  if (lastEvent.kind === 'turn.failed') {
    return 'failed';
  }

  if (lastEvent.kind === 'turn.completed') {
    const runtimeStatus = String(lastEvent.payload.runtimeStatus ?? '');
    return runtimeStatus === 'completed' ? 'succeeded' : 'running';
  }

  return 'running';
}

const CORE_API_CONTRACT: BirdCoderCoreApiContract = {
  codingSession: createRoute(
    'core',
    'host',
    'GET',
    '/api/core/v1/coding-sessions/:id',
    'Get coding session',
  ),
  codingSessions: createRoute(
    'core',
    'host',
    'GET',
    '/api/core/v1/coding-sessions',
    'List coding sessions',
  ),
  descriptor: createRoute('core', 'host', 'GET', '/api/core/v1/descriptor', 'Get coding-server descriptor'),
  engineCapabilities: createRoute(
    'core',
    'host',
    'GET',
    '/api/core/v1/engines/:engineKey/capabilities',
    'Get runtime capabilities for one engine',
  ),
  engines: createRoute('core', 'host', 'GET', '/api/core/v1/engines', 'List available engines'),
  forkCodingSession: createRoute(
    'core',
    'host',
    'POST',
    '/api/core/v1/coding-sessions/:id/fork',
    'Fork coding session',
  ),
  nativeSession: createRoute(
    'core',
    'host',
    'GET',
    '/api/core/v1/native-sessions/:id',
    'Get discovered native engine session detail',
  ),
  nativeSessionProviders: createRoute(
    'core',
    'host',
    'GET',
    '/api/core/v1/native-session-providers',
    'List registered native engine session providers',
  ),
  nativeSessions: createRoute(
    'core',
    'host',
    'GET',
    '/api/core/v1/native-sessions',
    'List discovered native engine sessions',
  ),
  events: createRoute(
    'core',
    'host',
    'GET',
    '/api/core/v1/coding-sessions/:id/events',
    'Replay or subscribe to coding session events',
  ),
  health: createRoute('core', 'host', 'GET', '/api/core/v1/health', 'Get coding-server health'),
  models: createRoute('core', 'host', 'GET', '/api/core/v1/models', 'List model catalog'),
  operations: createRoute(
    'core',
    'host',
    'GET',
    '/api/core/v1/operations/:operationId',
    'Get operation status',
  ),
  approvals: createRoute(
    'core',
    'host',
    'POST',
    '/api/core/v1/approvals/:approvalId/decision',
    'Submit approval decision',
  ),
  routes: createRoute('core', 'host', 'GET', BIRDCODER_CODING_SERVER_ROUTE_CATALOG_PATH, 'List unified API routes'),
  runtime: createRoute('core', 'host', 'GET', '/api/core/v1/runtime', 'Get runtime metadata'),
  sessions: createRoute(
    'core',
    'host',
    'POST',
    '/api/core/v1/coding-sessions',
    'Create coding session',
  ),
  sessionArtifacts: createRoute(
    'core',
    'host',
    'GET',
    '/api/core/v1/coding-sessions/:id/artifacts',
    'List coding session artifacts',
  ),
  sessionCheckpoints: createRoute(
    'core',
    'host',
    'GET',
    '/api/core/v1/coding-sessions/:id/checkpoints',
    'List coding session checkpoints',
  ),
  deleteCodingSession: createRoute(
    'core',
    'host',
    'DELETE',
    '/api/core/v1/coding-sessions/:id',
    'Delete coding session',
  ),
  deleteCodingSessionMessage: createRoute(
    'core',
    'host',
    'DELETE',
    '/api/core/v1/coding-sessions/:id/messages/:messageId',
    'Delete coding session message',
  ),
  sessionTurns: createRoute(
    'core',
    'host',
    'POST',
    '/api/core/v1/coding-sessions/:id/turns',
    'Create coding session turn',
  ),
  updateCodingSession: createRoute(
    'core',
    'host',
    'PATCH',
    '/api/core/v1/coding-sessions/:id',
    'Update coding session',
  ),
};

function getResolvedBirdCoderAppApiContract(): BirdCoderAppApiContract {
  birdCoderAppApiContract ??=
    getBirdCoderUserCenterAppRouteProjection().mergeContract({
  appTemplates: createRoute('app', 'user', 'GET', '/api/app/v1/app-templates', 'List app templates'),
  authQrGenerate: createRoute(
    'app',
    'user',
    'POST',
    '/api/app/v1/auth/qr/generate',
    'Generate user center login QR code',
  ),
  authQrStatus: createRoute(
    'app',
    'user',
    'GET',
    '/api/app/v1/auth/qr/status/:qrKey',
    'Check user center login QR code status',
  ),
  authOAuthUrl: createRoute(
    'app',
    'user',
    'POST',
    '/api/app/v1/auth/oauth/url',
    'Resolve OAuth authorization URL for social sign-in',
  ),
  authOAuthLogin: createRoute(
    'app',
    'user',
    'POST',
    '/api/app/v1/auth/oauth/login',
    'Create user center session with OAuth authorization code',
  ),
  loginWithEmailCode: createRoute(
    'app',
    'user',
    'POST',
    '/api/app/v1/auth/email/login',
    'Create user center session with email verification code',
  ),
  loginWithPhoneCode: createRoute(
    'app',
    'user',
    'POST',
    '/api/app/v1/auth/phone/login',
    'Create user center session with phone verification code',
  ),
  requestPasswordReset: createRoute(
    'app',
    'user',
    'POST',
    '/api/app/v1/auth/password/reset/request',
    'Request password reset verification challenge',
  ),
  resetPassword: createRoute(
    'app',
    'user',
    'POST',
    '/api/app/v1/auth/password/reset',
    'Reset local user center password',
  ),
  sendVerifyCode: createRoute(
    'app',
    'user',
    'POST',
    '/api/app/v1/auth/verify/send',
    'Send verification code for login, registration, or password reset',
  ),
  createProject: createRoute('app', 'user', 'POST', '/api/app/v1/projects', 'Create project'),
  createProjectCollaborator: createRoute(
    'app',
    'user',
    'POST',
    '/api/app/v1/projects/:projectId/collaborators',
    'Upsert project collaborator',
  ),
  createWorkspace: createRoute('app', 'user', 'POST', '/api/app/v1/workspaces', 'Create workspace'),
  createWorkspaceMember: createRoute(
    'app',
    'user',
    'POST',
    '/api/app/v1/workspaces/:workspaceId/members',
    'Upsert workspace member',
  ),
  deleteProject: createRoute(
    'app',
    'user',
    'DELETE',
    '/api/app/v1/projects/:projectId',
    'Delete project',
  ),
  deleteWorkspace: createRoute(
    'app',
    'user',
    'DELETE',
    '/api/app/v1/workspaces/:workspaceId',
    'Delete workspace',
  ),
  subscribeWorkspaceRealtime: createRoute(
    'app',
    'user',
    'GET',
    '/api/app/v1/workspaces/:workspaceId/realtime',
    'Subscribe to workspace realtime invalidation events',
  ),
  deployments: createRoute('app', 'user', 'GET', '/api/app/v1/deployments', 'List deployments'),
  documents: createRoute('app', 'user', 'GET', '/api/app/v1/documents', 'List project documents'),
  project: createRoute('app', 'user', 'GET', '/api/app/v1/projects/:projectId', 'Get project'),
  projectGitOverview: createRoute(
    'app',
    'user',
    'GET',
    '/api/app/v1/projects/:projectId/git/overview',
    'Get project Git overview',
  ),
  createProjectGitBranch: createRoute(
    'app',
    'user',
    'POST',
    '/api/app/v1/projects/:projectId/git/branches',
    'Create project Git branch',
  ),
  switchProjectGitBranch: createRoute(
    'app',
    'user',
    'POST',
    '/api/app/v1/projects/:projectId/git/branch-switch',
    'Switch project Git branch',
  ),
  commitProjectGitChanges: createRoute(
    'app',
    'user',
    'POST',
    '/api/app/v1/projects/:projectId/git/commits',
    'Commit project Git changes',
  ),
  pushProjectGitBranch: createRoute(
    'app',
    'user',
    'POST',
    '/api/app/v1/projects/:projectId/git/pushes',
    'Push project Git branch',
  ),
  createProjectGitWorktree: createRoute(
    'app',
    'user',
    'POST',
    '/api/app/v1/projects/:projectId/git/worktrees',
    'Create project Git worktree',
  ),
  removeProjectGitWorktree: createRoute(
    'app',
    'user',
    'POST',
    '/api/app/v1/projects/:projectId/git/worktree-removals',
    'Remove project Git worktree',
  ),
  pruneProjectGitWorktrees: createRoute(
    'app',
    'user',
    'POST',
    '/api/app/v1/projects/:projectId/git/worktree-prune',
    'Prune project Git worktrees',
  ),
  installSkillPackage: createRoute(
    'app',
    'user',
    'POST',
    '/api/app/v1/skill-packages/:packageId/installations',
    'Install skill package for a scope',
  ),
  publishProject: createRoute(
    'app',
    'user',
    'POST',
    '/api/app/v1/projects/:projectId/publish',
    'Publish project release flow',
  ),
  projectCollaborators: createRoute(
    'app',
    'user',
    'GET',
    '/api/app/v1/projects/:projectId/collaborators',
    'List project collaborators',
  ),
  projects: createRoute('app', 'user', 'GET', '/api/app/v1/projects', 'List projects'),
  skillPackages: createRoute('app', 'user', 'GET', '/api/app/v1/skill-packages', 'List skill packages'),
  teams: createRoute('app', 'user', 'GET', '/api/app/v1/teams', 'List workspace teams'),
  updateProject: createRoute(
    'app',
    'user',
    'PATCH',
    '/api/app/v1/projects/:projectId',
    'Update project',
  ),
  updateWorkspace: createRoute(
    'app',
    'user',
    'PATCH',
    '/api/app/v1/workspaces/:workspaceId',
    'Update workspace',
  ),
  workspaceMembers: createRoute(
    'app',
    'user',
    'GET',
    '/api/app/v1/workspaces/:workspaceId/members',
    'List workspace members',
  ),
  workspaces: createRoute('app', 'user', 'GET', '/api/app/v1/workspaces', 'List workspaces'),
  });
  return birdCoderAppApiContract;
}

const ADMIN_API_CONTRACT: BirdCoderAdminApiContract = {
  audit: createRoute('admin', 'admin', 'GET', '/api/admin/v1/audit', 'List audit events'),
  deployments: createRoute(
    'admin',
    'admin',
    'GET',
    '/api/admin/v1/deployments',
    'List governed deployments',
  ),
  deploymentTargets: createRoute(
    'admin',
    'admin',
    'GET',
    '/api/admin/v1/projects/:projectId/deployment-targets',
    'List deployment targets',
  ),
  policies: createRoute('admin', 'admin', 'GET', '/api/admin/v1/policies', 'List governance policies'),
  releases: createRoute('admin', 'admin', 'GET', '/api/admin/v1/releases', 'List releases'),
  teamMembers: createRoute(
    'admin',
    'admin',
    'GET',
    '/api/admin/v1/teams/:teamId/members',
    'List team members',
  ),
  teams: createRoute('admin', 'admin', 'GET', '/api/admin/v1/teams', 'List teams'),
};

export function resolveServerRuntime(
  distributionId: BirdServerDistributionId = 'global',
  overrides: Partial<BirdServerRuntime> = {},
): BirdServerRuntime {
  const distribution = BIRD_SERVER_DISTRIBUTIONS[distributionId];
  const hostDescriptor = createBirdHostDescriptorFromDistribution('server', distribution, {
    ...(overrides.apiBaseUrl ? { apiBaseUrl: overrides.apiBaseUrl } : {}),
    ...(overrides.appId ? { appId: overrides.appId } : {}),
    ...(overrides.appName ? { appName: overrides.appName } : {}),
    ...(overrides.distributionId ? { distributionId: overrides.distributionId } : {}),
    ...(overrides.mode ? { mode: overrides.mode } : {}),
  });

  return {
    ...hostDescriptor,
    host: overrides.host ?? BIRD_SERVER_DEFAULT_HOST,
    port: overrides.port ?? BIRD_SERVER_DEFAULT_PORT,
    configFileName: overrides.configFileName ?? BIRD_SERVER_DEFAULT_CONFIG_FILE_NAME,
  };
}

export async function bindBirdCoderServerRuntimeTransport(
  options: BindBirdCoderServerRuntimeTransportOptions = {},
): Promise<BirdServerRuntime> {
  const host = options.host ?? resolveServerRuntime(options.distributionId);
  const distributionId = options.distributionId ?? (host.distributionId as BirdServerDistributionId);
  const { bindDefaultBirdCoderIdeServicesRuntime } =
    await loadBirdCoderInfrastructureRuntimeModule();
  bindDefaultBirdCoderIdeServicesRuntime({
    appAdminClient: options.appAdminClient,
    apiBaseUrl:
      options.apiBaseUrl ??
      (options.host ? undefined : BIRD_SERVER_RUNTIME_TRANSPORT_BASE_URLS[distributionId]),
    host,
  });
  return host;
}

export function getBirdCoderCodingServerDescriptor(
  hostMode: BirdCoderHostMode = 'server',
): BirdCoderCodingServerDescriptor {
  return {
    apiVersion: BIRDCODER_CODING_SERVER_API_VERSION,
    gateway: buildBirdCoderApiGatewaySummary(),
    hostMode,
    moduleId: 'coding-server',
    openApiPath: BIRDCODER_CODING_SERVER_OPENAPI_PATH,
    surfaces: ['core', 'app', 'admin'],
  };
}

export function listBirdCoderCodingServerEngines(): ReadonlyArray<BirdCoderEngineDescriptor> {
  return listBirdCoderCodeEngineDescriptors();
}

export function listBirdCoderCodingServerModels(): ReadonlyArray<BirdCoderModelCatalogEntry> {
  return listBirdCoderCodeEngineModels();
}

export function listBirdCoderCodingServerNativeSessionProviders(): ReadonlyArray<BirdCoderNativeSessionProviderSummary> {
  return listBirdCoderCodeEngineNativeSessionProviders();
}

export function getBirdCoderCodingServerEngineDescriptor(
  engineKey: string,
): BirdCoderEngineDescriptor | null {
  return getBirdCoderCodeEngineDescriptor(engineKey);
}

export function getBirdCoderCodingServerEngineCapabilities(
  engineKey: string,
): BirdCoderEngineCapabilityMatrix | null {
  return getBirdCoderCodeEngineCapabilities(engineKey);
}

export function getBirdCoderCoreApiContract(): BirdCoderCoreApiContract {
  return CORE_API_CONTRACT;
}

export function getBirdCoderAppApiContract(): BirdCoderAppApiContract {
  return getResolvedBirdCoderAppApiContract();
}

export function getBirdCoderAdminApiContract(): BirdCoderAdminApiContract {
  return ADMIN_API_CONTRACT;
}

export function listBirdCoderCodingServerRoutes(): BirdCoderApiRouteDefinition[] {
  return [
    ...Object.values(CORE_API_CONTRACT),
    ...Object.values(getResolvedBirdCoderAppApiContract()),
    ...Object.values(ADMIN_API_CONTRACT),
  ];
}

export function buildBirdCoderCodingServerOpenApiDocument(
  distributionId: BirdServerDistributionId = 'global',
): BirdCoderCodingServerOpenApiDocumentSeed {
  void distributionId;
  const routes = listBirdCoderCodingServerRoutes();
  const gateway = buildBirdCoderApiGatewaySummary();
  const operationDefinitions = buildBirdCoderOpenApiOperationDefinitions();
  const schemas = buildBirdCoderCodingServerOpenApiSchemas();

  const paths: BirdCoderCodingServerOpenApiDocumentSeed['paths'] = {};
  for (const route of routes) {
    const method = route.method.toLowerCase() as Lowercase<BirdCoderApiRouteDefinition['method']>;
    const openApiPath = toOpenApiPathTemplate(route.path);
    const security = buildOpenApiOperationSecurity(route);
    const operationId = getOperationIdForRoute(route);
    const operationDefinition = operationDefinitions[operationId];
    paths[openApiPath] = {
      ...(paths[openApiPath] ?? {}),
      [method]: {
        operationId,
        summary: route.summary,
        description: buildOpenApiOperationDescription(route),
        tags: [route.surface],
        ...(operationDefinition?.parameters ? { parameters: operationDefinition.parameters } : {}),
        ...(operationDefinition?.requestBody
          ? { requestBody: operationDefinition.requestBody }
          : {}),
        responses: operationDefinition?.responses ?? buildOpenApiDefaultResponses(),
        ...(security ? { security } : {}),
        'x-sdkwork-auth-mode': route.authMode,
        'x-sdkwork-surface': route.surface,
        ...(operationDefinition?.streamKind
          ? { 'x-sdkwork-stream-kind': operationDefinition.streamKind }
          : {}),
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
    tags: [
      { name: 'core', description: getSurfaceDescription('core') },
      { name: 'app', description: getSurfaceDescription('app') },
      { name: 'admin', description: getSurfaceDescription('admin') },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'Bearer token',
        },
      },
      schemas,
    },
    paths,
    'x-sdkwork-api-gateway': {
      basePath: BIRDCODER_CODING_SERVER_GATEWAY_BASE_PATH,
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

export function buildBirdCoderCodingServerOpenApiDocumentSeed(
  distributionId: BirdServerDistributionId = 'global',
): BirdCoderCodingServerOpenApiDocumentSeed {
  return buildBirdCoderCodingServerOpenApiDocument(distributionId);
}

export async function executeBirdCoderCoreSessionRun(
  request: BirdCoderCoreSessionRunRequest,
): Promise<BirdCoderCoreSessionRunProjection> {
  const resolvedModelId = resolveRequiredRuntimeModelId(request);
  const { kernel, chatEngine } = createWorkbenchServerSessionEngineBinding(request.engineId);
  const runtimeDescriptor =
    chatEngine.describeRuntime?.({
      ...request.options,
      model: resolvedModelId,
    }) ??
    (() => {
      throw new Error(`Engine ${request.engineId} does not expose describeRuntime()`);
    })();
  if (
    runtimeDescriptor.modelId.trim().localeCompare(resolvedModelId, undefined, {
      sensitivity: 'accent',
    }) !== 0
  ) {
    throw new Error(
      `Coding session runtime model id mismatch for engine "${request.engineId}": runtime resolved "${runtimeDescriptor.modelId}" but request requires "${resolvedModelId}".`,
    );
  }
  const runtimeHealth = await chatEngine.getHealth?.();
  const runtimeTransportKind = runtimeHealth
    ? resolveTransportKindForRuntimeMode(
        kernel.descriptor.transportKinds,
        runtimeHealth.runtimeMode,
      )
    : runtimeDescriptor.transportKind;
  const createdAt = new Date().toISOString();
  const events: BirdCoderCodingSessionEvent[] = [];
  const artifacts: BirdCoderCodingSessionArtifact[] = [];

  for await (const canonicalEvent of chatEngine.sendCanonicalEvents?.(
    request.messages,
    {
      ...request.options,
      model: resolvedModelId,
    },
  ) ?? []) {
    const projection = mapCanonicalEventToCoreEvent(
      {
        ...request,
        modelId: resolvedModelId,
      },
      canonicalEvent,
    );
    events.push(projection.event);
    if (projection.artifact) {
      artifacts.push(projection.artifact);
    }
  }

  const runtime: BirdCoderCodingSessionRuntime = {
    id: request.runtimeId,
    codingSessionId: request.sessionId,
    hostMode: request.hostMode ?? 'server',
    status:
      (String(events.at(-1)?.payload.runtimeStatus ?? 'initializing') as BirdCoderCodingSessionRuntime['status']) ??
      'initializing',
    engineId: runtimeDescriptor.engineId,
    modelId: resolvedModelId,
    nativeRef: {
      engineId: runtimeDescriptor.engineId,
      transportKind: runtimeTransportKind,
      nativeSessionId: request.sessionId,
      nativeTurnContainerId: request.turnId,
      metadata: {
        approvalPolicy: runtimeDescriptor.approvalPolicy,
      },
    },
    capabilitySnapshot: runtimeDescriptor.capabilityMatrix,
    metadata: {
      approvalPolicy: runtimeDescriptor.approvalPolicy,
    },
    createdAt,
    updatedAt: events.at(-1)?.createdAt ?? createdAt,
  };

  const operation: BirdCoderOperationDescriptor = {
    operationId: `${request.turnId}:operation`,
    status: resolveOperationStatus(events),
    artifactRefs: artifacts.map((artifact) => artifact.id),
    streamUrl: `/api/core/v1/coding-sessions/${request.sessionId}/events`,
    streamKind: 'sse',
  };

  return {
    runtime,
    events,
    artifacts,
    operation,
  };
}

export function createInMemoryBirdCoderCoreSessionProjectionStore(): BirdCoderCoreSessionProjectionStore {
  const states = new Map<string, BirdCoderCoreSessionProjectionState>();

  return {
    async getSessionSnapshot(
      codingSessionId: string,
    ): Promise<BirdCoderCoreSessionProjectionSnapshot> {
      const state = states.get(codingSessionId);
      return state
        ? cloneCoreSessionProjectionSnapshot(codingSessionId, state)
        : createEmptyCoreSessionProjectionSnapshot(codingSessionId);
    },
    async persistRunProjection(
      projection: BirdCoderCoreSessionRunProjection,
    ): Promise<BirdCoderCoreSessionProjectionSnapshot> {
      const codingSessionId = projection.runtime.codingSessionId;
      const state =
        states.get(codingSessionId) ??
        {
          runtime: null,
          events: [],
          artifacts: [],
          operationsById: new Map<string, BirdCoderOperationDescriptor>(),
        };

      state.runtime = projection.runtime;
      appendDistinctById(state.events, projection.events);
      appendDistinctById(state.artifacts, projection.artifacts);
      state.operationsById.set(projection.operation.operationId, projection.operation);
      states.set(codingSessionId, state);

      return cloneCoreSessionProjectionSnapshot(codingSessionId, state);
    },
  };
}

export async function persistBirdCoderCoreSessionRunProjection(
  store: BirdCoderCoreSessionProjectionStore,
  projection: BirdCoderCoreSessionRunProjection,
): Promise<BirdCoderCoreSessionProjectionSnapshot> {
  return store.persistRunProjection(projection);
}

export async function* streamBirdCoderCoreSessionEventEnvelopes(
  request: BirdCoderCoreSessionRunRequest,
): AsyncGenerator<BirdCoderApiEnvelope<BirdCoderCodingSessionEvent>, void, unknown> {
  const projection = await executeBirdCoderCoreSessionRun(request);
  for (const event of projection.events) {
    yield createEnvelope(event, event.id);
  }
}

export function createBirdCoderApprovalDecisionEnvelope(
  result: BirdCoderApprovalDecisionResult,
): BirdCoderApiEnvelope<BirdCoderApprovalDecisionResult> {
  return createEnvelope(result, result.approvalId);
}

export {
  createBirdCoderRepresentativeAppAdminRepositories,
  type BirdCoderRepresentativeAppAdminRepositories,
  type BirdCoderRepresentativeProjectRecord,
  type BirdCoderRepresentativeReleaseRecord,
  type BirdCoderRepresentativeTeamRecord,
} from './appAdminRepository.ts';
