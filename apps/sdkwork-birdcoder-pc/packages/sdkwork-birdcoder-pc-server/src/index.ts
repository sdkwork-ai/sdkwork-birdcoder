import type {
  ChatCanonicalEvent,
  ChatMessage,
  ChatOptions,
} from '@sdkwork/birdcoder-pc-chat';
import {
  buildDefaultBirdCoderCodeEngineModelConfig,
  createBirdCoderCodeEngineModelConfigSyncPlan,
  createWorkbenchServerSessionEngineBinding,
  getBirdCoderCodeEngineCapabilities,
  getBirdCoderCodeEngineDescriptor,
  listBirdCoderCodeEngineNativeSessionProviders,
  listBirdCoderCodeEngineDescriptors,
  listBirdCoderCodeEngineModels,
} from '@sdkwork/birdcoder-pc-codeengine';
import {
  resolveTransportKindForRuntimeMode,
} from '@sdkwork/birdcoder-pc-chat';
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

export const BIRD_SERVER_DEFAULT_HOST = BIRDCODER_DEFAULT_LOCAL_API_HOST;
export const BIRD_SERVER_DEFAULT_PORT = BIRDCODER_DEFAULT_LOCAL_API_PORT;
export const BIRD_SERVER_DEFAULT_CONFIG_FILE_NAME = 'bird-server.config.json';
export const BIRDCODER_CODING_SERVER_API_VERSION = BIRDCODER_CODING_SERVER_API_VERSION_VALUE;
export const BIRDCODER_CODING_SERVER_OPENAPI_PATH = '/openapi/coding-server-v1.json';
export const BIRDCODER_CODING_SERVER_LIVE_OPENAPI_PATH = '/openapi.json';
export const BIRDCODER_CODING_SERVER_DOCS_PATH = '/docs';
export const BIRDCODER_CODING_SERVER_ROUTE_CATALOG_PATH = '/app/v3/api/system/routes';

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
type BirdCoderOpenApiScope = 'platform' | 'tenant' | 'organization' | 'user' | 'owner';
type BirdCoderOpenApiDomain =
  | 'commerce'
  | 'collaboration'
  | 'content'
  | 'device'
  | 'ecosystem'
  | 'iam'
  | 'intelligence'
  | 'platform'
  | 'runtime'
  | 'system';

interface BirdCoderOpenApiGovernanceMetadata {
  dataScope: BirdCoderOpenApiScope;
  deployment: 'all';
  domain: BirdCoderOpenApiDomain;
  isPublic: boolean;
  permission?: string;
  resource: string;
  tenantScope: BirdCoderOpenApiScope;
}

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
    'application/json'?: {
      schema: BirdCoderOpenApiSchema;
    };
    'application/problem+json'?: {
      schema: BirdCoderOpenApiSchema;
    };
  };
}

interface BirdCoderOpenApiOperationObject {
  operationId: string;
  summary: string;
  description: string;
  tags: string[];
  parameters?: BirdCoderOpenApiParameterObject[];
  requestBody?: BirdCoderOpenApiRequestBodyObject;
  responses: Record<string, BirdCoderOpenApiResponseObject>;
  security: Array<{ bearerAuth: []; sdkworkAccessToken: [] }> | [];
  'x-sdkwork-auth-mode': BirdCoderApiRouteDefinition['authMode'];
  'x-sdkwork-data-scope': BirdCoderOpenApiScope;
  'x-sdkwork-deployment': 'all';
  'x-sdkwork-domain': BirdCoderOpenApiDomain;
  'x-sdkwork-permission'?: string;
  'x-sdkwork-public': boolean;
  'x-sdkwork-resource': string;
  'x-sdkwork-surface': BirdCoderApiSurface;
  'x-sdkwork-stream-kind'?: (typeof BIRDCODER_STREAM_KINDS)[number];
  'x-sdkwork-tenant-scope': BirdCoderOpenApiScope;
}

export interface BirdCoderCodingServerOpenApiDocument {
  openapi: '3.1.0';
  info: {
    title: 'SDKWork BirdCoder Coding Server API';
    version: typeof BIRDCODER_CODING_SERVER_API_VERSION;
    description: string;
  };
  servers: Array<{ url: string; description: string }>;
  tags: Array<{ name: string; description: string }>;
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http';
        scheme: 'bearer';
        bearerFormat: 'Bearer token';
      };
      sdkworkAccessToken: {
        type: 'apiKey';
        in: 'header';
        name: 'Access-Token';
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

const BIRDCODER_IAM_LOGIN_METHODS = [
  'emailCode',
  'password',
  'phoneCode',
  'sessionBridge',
] as const;

const BIRDCODER_IAM_REGISTER_METHODS = ['email', 'phone'] as const;

const BIRDCODER_IAM_RECOVERY_METHODS = ['email', 'phone'] as const;

const BIRDCODER_IAM_VERIFY_TYPES = ['EMAIL', 'PHONE'] as const;

const BIRDCODER_IAM_VERIFY_SCENES = [
  'LOGIN',
  'REGISTER',
  'RESET_PASSWORD',
] as const;

const BIRDCODER_IAM_PASSWORD_RESET_CHANNELS = ['EMAIL', 'SMS'] as const;

const BIRDCODER_IAM_DEVICE_TYPES = ['android', 'desktop', 'ios', 'web'] as const;

const BIRDCODER_IAM_QR_AUTH_STATUSES = [
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

const BIRDCODER_API_AUTH_MODES = ['host', 'user', 'admin'] as const;

const BIRDCODER_API_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

const BIRDCODER_API_SURFACE_NAMES = ['app', 'backend'] as const;

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
export interface BirdServerRuntime extends BirdHostDescriptor {
  host: string;
  port: number;
  configFileName: string;
}

export interface BindBirdCoderServerRuntimeTransportOptions {
  apiBaseUrl?: string;
  appClient?: BirdCoderAppSdkApiClient;
  backendClient?: BirdCoderBackendSdkApiClient;
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
    appClient?: BirdCoderAppSdkApiClient;
    backendClient?: BirdCoderBackendSdkApiClient;
    host?: BirdHostDescriptor;
  }): void;
}

let birdCoderInfrastructureRuntimeModulePromise:
  | Promise<BirdCoderInfrastructureRuntimeModule>
  | null = null;

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

function toBirdCoderRoutePath(path: string): string {
  return path.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/gu, ':$1');
}

function getSdkworkIamOperation(operationId: string): (typeof SDKWORK_IAM_OPERATION_IDS)[string] {
  const operation = SDKWORK_IAM_OPERATION_IDS[operationId];
  if (!operation) {
    throw new Error(`Unknown SDKWork IAM operation id: ${operationId}`);
  }
  return operation;
}

function createIamRoute(
  operationId: string,
  summary: string,
): BirdCoderApiRouteDefinition {
  const operation = getSdkworkIamOperation(operationId);
  const surface: BirdCoderApiSurface = operation.path.startsWith('/backend/v3/api/')
    ? 'backend'
    : 'app';
  return toBirdCoderApiRouteDefinition({
    authMode: surface === 'backend' ? 'admin' : 'user',
    method: operation.method,
    operationId: operation.operationId,
    path: toBirdCoderRoutePath(operation.path),
    surface,
    summary,
  });
}

function toBirdCoderApiRouteDefinition(
  route: Pick<
    BirdCoderApiRouteDefinition,
    'authMode' | 'method' | 'operationId' | 'path' | 'summary' | 'surface'
  >,
): BirdCoderApiRouteDefinition {
  return {
    authMode: route.authMode,
    method: route.method,
    operationId: route.operationId,
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

let birdCoderAppApiContract: BirdCoderAppApiContract | null = null;

function getSurfaceDescription(surface: BirdCoderApiSurface): string {
  switch (surface) {
    case 'app':
      return 'Application-facing coding runtime, workspace, project, collaboration, and IAM routes.';
    case 'backend':
      return 'Backend governance, audit, release, deployment, and team-management routes.';
    default:
      return 'Unified BirdCoder API surface.';
  }
}

function getOpenApiTagDescription(tag: string): string {
  switch (tag) {
    case 'audit':
      return 'Audit and operational evidence resources.';
    case 'auth':
      return 'SDKWork IAM authentication and session resources.';
    case 'commerce':
      return 'Commerce membership, package catalog, entitlement, order, and payment resources.';
    case 'collaboration':
      return 'Workspace collaboration and team catalog resources.';
    case 'content':
      return 'Project document and content resources.';
    case 'iam':
      return 'IAM user, tenant, organization, role, permission, policy, and audit resources.';
    case 'intelligence':
      return 'Coding session, checkpoint, approval, and question resources.';
    case 'platform':
      return 'Workspace, project, release, deployment, and delivery resources.';
    case 'runtime':
      return 'Runtime engine, model, native session, and local operation resources.';
    case 'skills':
      return 'Skill package catalog and installation resources.';
    case 'system':
      return 'System descriptor, health, route catalog, and runtime metadata resources.';
    case 'templates':
      return 'Application template catalog resources.';
    default:
      return `${tag} resources.`;
  }
}

function getOpenApiTagForOperationId(operationId: string): string {
  const normalizedOperationId = operationId.trim();
  if (/^oauth\./u.test(normalizedOperationId)) {
    return 'oauth';
  }
  if (
    /^(?:sessions|registrations|passwordResetRequests|passwordResets)\./u.test(
      normalizedOperationId,
    )
  ) {
    return 'auth';
  }
  if (/^iam\./u.test(normalizedOperationId)) {
    return 'system';
  }
  if (/^qrAuth\./u.test(normalizedOperationId)) {
    return 'openPlatform';
  }
  if (/^memberships\./u.test(normalizedOperationId)) {
    return 'commerce';
  }
  if (/^(?:codingSessions|approvals|questions)\./u.test(normalizedOperationId)) {
    return 'intelligence';
  }
  if (/^documents\./u.test(normalizedOperationId)) {
    return 'content';
  }
  if (/^workspaceTeams\./u.test(normalizedOperationId)) {
    return 'collaboration';
  }
  if (
    /^(?:apiKeys|auditEvents|organizationMemberships|organizations|permissions|policies|roleBindings|roles|securityEvents|tenants|users|teams|workspaces\.members)\./u.test(
      normalizedOperationId,
    )
  ) {
    return 'iam';
  }
  if (/^(?:workspaces|projects|deployments|releases|deploymentGovernance)\./u.test(normalizedOperationId)) {
    return 'platform';
  }
  if (/^(?:engines|nativeSessionProviders|nativeSessions|models|modelConfig)\./u.test(normalizedOperationId)) {
    return 'runtime';
  }
  if (/^skillPackages\./u.test(normalizedOperationId)) {
    return 'skills';
  }
  if (/^appTemplates\./u.test(normalizedOperationId)) {
    return 'templates';
  }
  return 'system';
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

function createOpenApiProblemJsonContent(schema: BirdCoderOpenApiSchema) {
  return {
    'application/problem+json': {
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

function createOpenApiLongIntegerStringSchema(description?: string): BirdCoderOpenApiSchema {
  return createOpenApiStringSchema(
    description ?? 'Java Long/BIGINT value serialized as an exact decimal string.',
  );
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

function createOpenApiDataScopeSchema(): BirdCoderOpenApiSchema {
  return createOpenApiStringEnumSchema(
    BIRDCODER_DATA_SCOPES,
    'DATABASE_SPEC.md standard data scope.',
  );
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
  return {
    description,
    content: createOpenApiProblemJsonContent(
      createOpenApiSchemaReference('BirdCoderProblemEnvelope'),
    ),
  };
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
        qrContent: createOpenApiStringSchema(),
        qrUrl: createOpenApiStringSchema(),
        status: createOpenApiStringEnumSchema(BIRDCODER_IAM_QR_AUTH_STATUSES),
      },
      {
        required: ['deviceAuthorizationId', 'status'],
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
    'codingSessions.messages.update': {
      parameters: [codingSessionIdPathParameter, messageIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderEditCodingSessionMessageRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Coding session message edited successfully.',
        successSchema: createOpenApiSchemaReference(
          'BirdCoderEditCodingSessionMessageResultEnvelope',
        ),
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
        successSchema: createOpenApiSchemaReference(
          'BirdCoderDeleteCodingSessionMessageResultEnvelope',
        ),
        extraResponses: {
          '404': createProblemResponse('Coding session message was not found.'),
          '500': createProblemResponse('Coding session message could not be deleted.'),
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
    'approvals.decisions.create': {
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
    'questions.answers.create': {
      parameters: [
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
      parameters: [userIdParameter],
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
      parameters: [userIdParameter, workspaceIdParameter, rootPathParameter],
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
    case 'app':
      return '/app/v3/api';
    case 'backend':
      return '/backend/v3/api';
  }
  throw new Error(`Unexpected BirdCoder API surface: ${String(surface)}`);
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
  operationId: string,
): Array<{ bearerAuth: []; sdkworkAccessToken: [] }> | [] {
  return isPublicOpenApiOperation(route, operationId)
    ? []
    : [{ bearerAuth: [], sdkworkAccessToken: [] }];
}

function isPublicOpenApiOperation(
  route: BirdCoderApiRouteDefinition,
  operationId: string,
): boolean {
  if (route.authMode === 'host') {
    return true;
  }

  const sdkworkIamOperation = SDKWORK_IAM_OPERATION_IDS[operationId];
  if (sdkworkIamOperation) {
    return sdkworkIamOperation.security !== 'dualToken';
  }

  return /^(?:oauth\.(?:authorizationUrls\.create|sessions\.create|deviceAuthorizations\.(?:create|retrieve|scans\.create|passwordCompletions\.create))|registrations\.create|sessions\.(?:create|refresh)|passwordResetRequests\.create|passwordResets\.create|iam\.(?:runtime|verificationPolicy)\.retrieve)$/u.test(
    operationId,
  );
}

function getOpenApiDomainForOperationId(operationId: string): BirdCoderOpenApiDomain {
  if (/^iam\.(?:runtime|verificationPolicy)\.retrieve$/u.test(operationId)) {
    return 'iam';
  }

  const tag = getOpenApiTagForOperationId(operationId);
  switch (tag) {
    case 'auth':
    case 'iam':
    case 'audit':
    case 'openPlatform':
      return 'iam';
    case 'commerce':
      return 'commerce';
    case 'collaboration':
      return 'collaboration';
    case 'content':
      return 'content';
    case 'intelligence':
      return 'intelligence';
    case 'platform':
      return 'platform';
    case 'runtime':
      return 'runtime';
    case 'skills':
      return 'ecosystem';
    case 'system':
      return 'system';
    case 'templates':
      return 'ecosystem';
    default:
      return 'system';
  }
}

function getOpenApiResourceForOperationId(
  operationId: string,
  domain: BirdCoderOpenApiDomain,
): string {
  const operationParts = operationId.split('.').filter(Boolean);
  const resourceParts = operationParts.slice(0, -1);
  const normalizedResource =
    resourceParts.length > 0 ? resourceParts.join('.') : operationParts[0] ?? 'operations';

  return normalizedResource.startsWith(`${domain}.`)
    ? normalizedResource
    : `${domain}.${normalizedResource}`;
}

function getOpenApiActionForOperation(
  route: BirdCoderApiRouteDefinition,
  operationId: string,
): 'create' | 'delete' | 'execute' | 'read' | 'subscribe' | 'update' | 'write' {
  const lastOperationIdSegment = operationId.split('.').at(-1) ?? '';
  switch (lastOperationIdSegment) {
    case 'create':
      return 'create';
    case 'delete':
      return 'delete';
    case 'retrieve':
    case 'list':
      return 'read';
    case 'subscribe':
      return 'subscribe';
    case 'sync':
    case 'update':
      return 'update';
  }

  switch (route.method) {
    case 'GET':
      return 'read';
    case 'DELETE':
      return 'delete';
    case 'PATCH':
    case 'PUT':
      return 'update';
    case 'POST':
      return 'create';
    default:
      return 'execute';
  }
}

function getOpenApiScopeMetadata(
  route: BirdCoderApiRouteDefinition,
  operationId: string,
): Pick<BirdCoderOpenApiGovernanceMetadata, 'dataScope' | 'tenantScope'> {
  if (isPublicOpenApiOperation(route, operationId)) {
    return {
      dataScope: 'platform',
      tenantScope: 'platform',
    };
  }

  if (/^(?:sessions\.current|users\.current|memberships\.current|memberships\.packageGroups)/u.test(operationId)) {
    return {
      dataScope: 'user',
      tenantScope: 'tenant',
    };
  }

  if (/^(?:codingSessions|approvals|questions|operations|nativeSessions)/u.test(operationId)) {
    return {
      dataScope: 'user',
      tenantScope: 'tenant',
    };
  }

  if (/^(?:descriptor|health|runtime|routes|engines|models|modelConfig|nativeSessionProviders)/u.test(operationId)) {
    return {
      dataScope: 'platform',
      tenantScope: 'tenant',
    };
  }

  void route;
  return {
    dataScope: 'organization',
    tenantScope: 'tenant',
  };
}

function buildOpenApiGovernanceMetadata(
  route: BirdCoderApiRouteDefinition,
  operationId: string,
): BirdCoderOpenApiGovernanceMetadata {
  const domain = getOpenApiDomainForOperationId(operationId);
  const resource = getOpenApiResourceForOperationId(operationId, domain);
  const scopeMetadata = getOpenApiScopeMetadata(route, operationId);
  const isPublic = isPublicOpenApiOperation(route, operationId);

  return {
    ...scopeMetadata,
    deployment: 'all',
    domain,
    isPublic,
    ...(isPublic
      ? {}
      : {
          permission: `${resource}.${getOpenApiActionForOperation(route, operationId)}`,
        }),
    resource,
  };
}

function getOperationIdForRoute(route: BirdCoderApiRouteDefinition): string {
  const operationIds = new Map<string, string>([
    ...Object.values(SDKWORK_IAM_OPERATION_IDS).map((operation) => [
      `${operation.method} ${toBirdCoderRoutePath(operation.path)}`,
      operation.operationId,
    ] as const),
    ['GET /app/v3/api/system/descriptor', 'descriptor.retrieve'],
    ['GET /app/v3/api/system/routes', 'routes.list'],
    ['GET /app/v3/api/engines', 'engines.list'],
    ['GET /app/v3/api/native_session_providers', 'nativeSessionProviders.list'],
    ['GET /app/v3/api/native_sessions', 'nativeSessions.list'],
    ['GET /app/v3/api/native_sessions/:id', 'nativeSessions.retrieve'],
    ['GET /app/v3/api/engines/:engineKey/capabilities', 'engines.capabilities.retrieve'],
    ['GET /app/v3/api/models', 'models.list'],
    ['GET /app/v3/api/model_config', 'modelConfig.retrieve'],
    ['PUT /app/v3/api/model_config', 'modelConfig.sync'],
    ['GET /app/v3/api/system/runtime', 'runtime.retrieve'],
    ['GET /app/v3/api/system/health', 'health.retrieve'],
    ['GET /app/v3/api/coding_sessions', 'codingSessions.list'],
    ['POST /app/v3/api/coding_sessions', 'codingSessions.create'],
    ['GET /app/v3/api/coding_sessions/:id', 'codingSessions.retrieve'],
    ['PATCH /app/v3/api/coding_sessions/:id', 'codingSessions.update'],
    ['DELETE /app/v3/api/coding_sessions/:id', 'codingSessions.delete'],
    ['PATCH /app/v3/api/coding_sessions/:id/messages/:messageId', 'codingSessions.messages.update'],
    ['DELETE /app/v3/api/coding_sessions/:id/messages/:messageId', 'codingSessions.messages.delete'],
    ['POST /app/v3/api/coding_sessions/:id/fork', 'codingSessions.forks.create'],
    ['POST /app/v3/api/coding_sessions/:id/turns', 'codingSessions.turns.create'],
    ['GET /app/v3/api/coding_sessions/:id/events', 'codingSessions.events.list'],
    ['GET /app/v3/api/coding_sessions/:id/artifacts', 'codingSessions.artifacts.list'],
    ['GET /app/v3/api/coding_sessions/:id/checkpoints', 'codingSessions.checkpoints.list'],
    ['POST /app/v3/api/approvals/:approvalId/decision', 'approvals.decisions.create'],
    ['POST /app/v3/api/questions/:questionId/answer', 'questions.answers.create'],
    ['GET /app/v3/api/operations/:operationId', 'operations.retrieve'],
    ['GET /app/v3/api/memberships/current', 'memberships.current.retrieve'],
    ['GET /app/v3/api/memberships/package_groups', 'memberships.packageGroups.list'],
    ['PATCH /app/v3/api/iam/users/current', 'users.current.update'],
    ['GET /app/v3/api/workspaces', 'workspaces.list'],
    ['POST /app/v3/api/workspaces', 'workspaces.create'],
    ['PATCH /app/v3/api/workspaces/:workspaceId', 'workspaces.update'],
    ['DELETE /app/v3/api/workspaces/:workspaceId', 'workspaces.delete'],
    ['GET /app/v3/api/workspaces/:workspaceId/realtime', 'workspaces.realtime.subscribe'],
    ['GET /app/v3/api/projects', 'projects.list'],
    ['GET /app/v3/api/projects/:projectId', 'projects.retrieve'],
    ['GET /app/v3/api/projects/:projectId/git/overview', 'projects.git.overview.retrieve'],
    ['POST /app/v3/api/projects/:projectId/git/branches', 'projects.git.branches.create'],
    ['POST /app/v3/api/projects/:projectId/git/branch_switch', 'projects.git.branchSwitch.create'],
    ['POST /app/v3/api/projects/:projectId/git/commits', 'projects.git.commits.create'],
    ['POST /app/v3/api/projects/:projectId/git/pushes', 'projects.git.pushes.create'],
    ['POST /app/v3/api/projects/:projectId/git/worktrees', 'projects.git.worktrees.create'],
    ['POST /app/v3/api/projects/:projectId/git/worktree_removals', 'projects.git.worktreeRemovals.create'],
    ['POST /app/v3/api/projects/:projectId/git/worktree_prune', 'projects.git.worktreePrune.create'],
    ['GET /app/v3/api/projects/:projectId/collaborators', 'projects.collaborators.list'],
    ['POST /app/v3/api/projects/:projectId/collaborators', 'projects.collaborators.upsert'],
    ['POST /app/v3/api/projects', 'projects.create'],
    ['PATCH /app/v3/api/projects/:projectId', 'projects.update'],
    ['DELETE /app/v3/api/projects/:projectId', 'projects.delete'],
    ['GET /app/v3/api/skill_packages', 'skillPackages.list'],
    ['POST /app/v3/api/skill_packages/:packageId/installations', 'skillPackages.installations.create'],
    ['GET /app/v3/api/app_templates', 'appTemplates.list'],
    ['GET /app/v3/api/documents', 'documents.list'],
    ['GET /app/v3/api/teams', 'workspaceTeams.list'],
    ['GET /app/v3/api/workspaces/:workspaceId/members', 'workspaces.members.list'],
    ['POST /app/v3/api/workspaces/:workspaceId/members', 'workspaces.members.upsert'],
    ['POST /app/v3/api/projects/:projectId/publish', 'projects.publish.create'],
    ['GET /app/v3/api/deployments', 'deployments.list'],
    ['GET /backend/v3/api/iam/audit_events', 'auditEvents.list'],
    ['GET /backend/v3/api/iam/policies', 'policies.list'],
    ['GET /backend/v3/api/iam/teams', 'teams.list'],
    ['GET /backend/v3/api/iam/teams/:teamId/members', 'teams.members.list'],
    ['GET /backend/v3/api/projects/:projectId/deployment_targets', 'projects.deploymentTargets.list'],
    ['GET /backend/v3/api/releases', 'releases.list'],
    ['GET /backend/v3/api/deployments', 'deploymentGovernance.list'],
  ]);
  const operationId = operationIds.get(`${route.method} ${route.path}`);
  if (operationId) {
    return operationId;
  }

  const routeOperationId = route.operationId?.trim();
  if (routeOperationId && !/^(?:app|backend|core|admin)\./u.test(routeOperationId)) {
    return routeOperationId;
  }

  return `custom.${route.method.toLowerCase()}.${route.path
    .split('/')
    .filter((segment) => segment && !segment.startsWith(':'))
    .map((segment) => segment.replace(/_([a-z0-9])/gu, (_, next: string) => next.toUpperCase()))
    .join('.')}`;
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
      app: 0,
      backend: 0,
    },
  );

  return {
    docsPath: BIRDCODER_CODING_SERVER_DOCS_PATH,
    liveOpenApiPath: BIRDCODER_CODING_SERVER_LIVE_OPENAPI_PATH,
    openApiPath: BIRDCODER_CODING_SERVER_OPENAPI_PATH,
    routeCatalogPath: BIRDCODER_CODING_SERVER_ROUTE_CATALOG_PATH,
    routeCount: routeCatalog.length,
    routesBySurface,
    surfaces: (['app', 'backend'] as const).map((surface) => ({
      authMode: surface === 'app' ? 'user' : 'admin',
      basePath: getSurfaceBasePath(surface),
      description: getSurfaceDescription(surface),
      name: surface,
      routeCount: routesBySurface[surface],
    })),
  };
}

function buildRequestId(_seed: string): string {
  return createBirdCoderServerRequestId();
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
  const sequence = stringifyBirdCoderLongInteger(canonicalEvent.sequence);
  const event: BirdCoderCodingSessionEvent = {
    id: `${request.runtimeId}:${request.turnId}:event:${canonicalEvent.sequence}`,
    codingSessionId: request.sessionId,
    turnId: request.turnId,
    runtimeId: request.runtimeId,
    kind: canonicalEvent.kind,
    sequence,
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
          sourceSequence: sequence,
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

function resolveCoreSessionRunFailureMessage(error: unknown): string {
  return String(error);
}

function resolveNextCanonicalFailureSequence(
  events: readonly BirdCoderCodingSessionEvent[],
): string {
  const latestSequence = events
    .map((event) => Number.parseInt(String(event.sequence), 10))
    .filter((sequence) => Number.isFinite(sequence))
    .reduce((latest, sequence) => Math.max(latest, sequence), 0);
  return stringifyBirdCoderLongInteger(latestSequence + 1);
}

function createCanonicalFailureEvent(
  sequence: string,
  error: unknown,
): ChatCanonicalEvent {
  return {
    kind: 'turn.failed',
    sequence,
    runtimeStatus: 'failed',
    payload: {
      errorMessage: resolveCoreSessionRunFailureMessage(error),
    },
  };
}

function appendCoreSessionRunFailureEvent(
  request: BirdCoderCoreSessionRunRequest,
  events: BirdCoderCodingSessionEvent[],
  error: unknown,
): BirdCoderCodingSessionEvent | null {
  if (events.at(-1)?.kind === 'turn.failed') {
    return null;
  }

  const { event } = mapCanonicalEventToCoreEvent(
    request,
    createCanonicalFailureEvent(resolveNextCanonicalFailureSequence(events), error),
  );
  events.push(event);
  return event;
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

const APP_RUNTIME_API_CONTRACT: BirdCoderAppRuntimeApiContract = {
  codingSession: createRoute('app', 'user',
    'GET',
    '/app/v3/api/coding_sessions/:id',
    'Get coding session',
  ),
  codingSessions: createRoute('app', 'user',
    'GET',
    '/app/v3/api/coding_sessions',
    'List coding sessions',
  ),
  descriptor: createRoute('app', 'user', 'GET', '/app/v3/api/system/descriptor', 'Get coding-server descriptor'),
  engineCapabilities: createRoute('app', 'user',
    'GET',
    '/app/v3/api/engines/:engineKey/capabilities',
    'Get runtime capabilities for one engine',
  ),
  engines: createRoute('app', 'user', 'GET', '/app/v3/api/engines', 'List available engines'),
  forkCodingSession: createRoute('app', 'user',
    'POST',
    '/app/v3/api/coding_sessions/:id/fork',
    'Fork coding session',
  ),
  nativeSession: createRoute('app', 'user',
    'GET',
    '/app/v3/api/native_sessions/:id',
    'Get discovered native engine session detail',
  ),
  nativeSessionProviders: createRoute('app', 'user',
    'GET',
    '/app/v3/api/native_session_providers',
    'List registered native engine session providers',
  ),
  nativeSessions: createRoute('app', 'user',
    'GET',
    '/app/v3/api/native_sessions',
    'List discovered native engine sessions',
  ),
  events: createRoute('app', 'user',
    'GET',
    '/app/v3/api/coding_sessions/:id/events',
    'Replay or subscribe to coding session events',
  ),
  health: createRoute('app', 'user', 'GET', '/app/v3/api/system/health', 'Get coding-server health'),
  modelConfig: createRoute('app', 'user',
    'GET',
    '/app/v3/api/model_config',
    'Get code engine model configuration',
  ),
  models: createRoute('app', 'user', 'GET', '/app/v3/api/models', 'List model catalog'),
  operations: createRoute('app', 'user',
    'GET',
    '/app/v3/api/operations/:operationId',
    'Get operation status',
  ),
  approvals: createRoute('app', 'user',
    'POST',
    '/app/v3/api/approvals/:approvalId/decision',
    'Submit approval decision',
  ),
  questions: createRoute('app', 'user',
    'POST',
    '/app/v3/api/questions/:questionId/answer',
    'Submit user-question answer',
  ),
  routes: createRoute('app', 'user', 'GET', BIRDCODER_CODING_SERVER_ROUTE_CATALOG_PATH, 'List unified API routes'),
  runtime: createRoute('app', 'user', 'GET', '/app/v3/api/system/runtime', 'Get runtime metadata'),
  sessions: createRoute('app', 'user',
    'POST',
    '/app/v3/api/coding_sessions',
    'Create coding session',
  ),
  sessionArtifacts: createRoute('app', 'user',
    'GET',
    '/app/v3/api/coding_sessions/:id/artifacts',
    'List coding session artifacts',
  ),
  sessionCheckpoints: createRoute('app', 'user',
    'GET',
    '/app/v3/api/coding_sessions/:id/checkpoints',
    'List coding session checkpoints',
  ),
  deleteCodingSession: createRoute('app', 'user',
    'DELETE',
    '/app/v3/api/coding_sessions/:id',
    'Delete coding session',
  ),
  deleteCodingSessionMessage: createRoute('app', 'user',
    'DELETE',
    '/app/v3/api/coding_sessions/:id/messages/:messageId',
    'Delete coding session message',
  ),
  editCodingSessionMessage: createRoute('app', 'user',
    'PATCH',
    '/app/v3/api/coding_sessions/:id/messages/:messageId',
    'Edit coding session message',
  ),
  sessionTurns: createRoute('app', 'user',
    'POST',
    '/app/v3/api/coding_sessions/:id/turns',
    'Create coding session turn',
  ),
  syncModelConfig: createRoute('app', 'user',
    'PUT',
    '/app/v3/api/model_config',
    'Sync code engine model configuration',
  ),
  updateCodingSession: createRoute('app', 'user',
    'PATCH',
    '/app/v3/api/coding_sessions/:id',
    'Update coding session',
  ),
};

function getResolvedBirdCoderAppApiContract(): BirdCoderAppApiContract {
  birdCoderAppApiContract ??= {
    iamRuntime: createIamRoute('iam.runtime.retrieve', 'Get SDKWork IAM runtime metadata'),
    iamVerificationPolicy: createIamRoute(
      'iam.verificationPolicy.retrieve',
      'Get SDKWork IAM verification policy',
    ),
    authOAuthAuthorizationUrl: createIamRoute(
      'oauth.authorizationUrls.create',
      'Resolve OAuth authorization URL for SDKWork IAM sign-in',
    ),
    authOAuthSession: createIamRoute(
      'oauth.sessions.create',
      'Create SDKWork IAM session with OAuth authorization code',
    ),
    oauthDeviceAuthorization: createIamRoute(
      'oauth.deviceAuthorizations.create',
      'Create SDKWork IAM OAuth device authorization',
    ),
    oauthDeviceAuthorizationStatus: createIamRoute(
      'oauth.deviceAuthorizations.retrieve',
      'Get SDKWork IAM OAuth device authorization',
    ),
    oauthDeviceAuthorizationScan: createIamRoute(
      'oauth.deviceAuthorizations.scans.create',
      'Create SDKWork IAM OAuth device authorization scan',
    ),
    oauthDeviceAuthorizationPasswordCompletion: createIamRoute(
      'oauth.deviceAuthorizations.passwordCompletions.create',
      'Complete SDKWork IAM OAuth device authorization with password',
    ),
    authPasswordResetRequest: createIamRoute(
      'passwordResetRequests.create',
      'Create SDKWork IAM password reset request',
    ),
    authPasswordReset: createIamRoute('passwordResets.create', 'Reset SDKWork IAM password'),
    authRegistration: createIamRoute('registrations.create', 'Register SDKWork IAM user'),
    authSession: createIamRoute('sessions.create', 'Create SDKWork IAM session'),
    authCurrentSession: createIamRoute('sessions.current.retrieve', 'Get current SDKWork IAM session'),
    authCurrentSessionUpdate: createIamRoute(
      'sessions.current.update',
      'Update current SDKWork IAM session',
    ),
    authCurrentSessionDelete: createIamRoute(
      'sessions.current.delete',
      'Delete current SDKWork IAM session',
    ),
    authSessionRefresh: createIamRoute('sessions.refresh', 'Refresh SDKWork IAM session'),
    currentIamUser: createIamRoute('users.current.retrieve', 'Get current SDKWork IAM user'),
    appTemplates: createRoute('app', 'user', 'GET', '/app/v3/api/app_templates', 'List app templates'),
    createProject: createRoute('app', 'user', 'POST', '/app/v3/api/projects', 'Create project'),
    createProjectCollaborator: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/projects/:projectId/collaborators',
      'Upsert project collaborator',
    ),
    createWorkspace: createRoute('app', 'user', 'POST', '/app/v3/api/workspaces', 'Create workspace'),
    createWorkspaceMember: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/workspaces/:workspaceId/members',
      'Upsert workspace member',
    ),
    deleteProject: createRoute(
      'app',
      'user',
      'DELETE',
      '/app/v3/api/projects/:projectId',
      'Delete project',
    ),
    deleteWorkspace: createRoute(
      'app',
      'user',
      'DELETE',
      '/app/v3/api/workspaces/:workspaceId',
      'Delete workspace',
    ),
    subscribeWorkspaceRealtime: createRoute(
      'app',
      'user',
      'GET',
      '/app/v3/api/workspaces/:workspaceId/realtime',
      'Subscribe to workspace realtime invalidation events',
    ),
    deployments: createRoute('app', 'user', 'GET', '/app/v3/api/deployments', 'List deployments'),
    documents: createRoute('app', 'user', 'GET', '/app/v3/api/documents', 'List project documents'),
    project: createRoute('app', 'user', 'GET', '/app/v3/api/projects/:projectId', 'Get project'),
    projectGitOverview: createRoute(
      'app',
      'user',
      'GET',
      '/app/v3/api/projects/:projectId/git/overview',
      'Get project Git overview',
    ),
    createProjectGitBranch: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/projects/:projectId/git/branches',
      'Create project Git branch',
    ),
    switchProjectGitBranch: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/projects/:projectId/git/branch_switch',
      'Switch project Git branch',
    ),
    commitProjectGitChanges: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/projects/:projectId/git/commits',
      'Commit project Git changes',
    ),
    pushProjectGitBranch: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/projects/:projectId/git/pushes',
      'Push project Git branch',
    ),
    createProjectGitWorktree: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/projects/:projectId/git/worktrees',
      'Create project Git worktree',
    ),
    removeProjectGitWorktree: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/projects/:projectId/git/worktree_removals',
      'Remove project Git worktree',
    ),
    pruneProjectGitWorktrees: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/projects/:projectId/git/worktree_prune',
      'Prune project Git worktrees',
    ),
    installSkillPackage: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/skill_packages/:packageId/installations',
      'Install skill package for a scope',
    ),
    publishProject: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/projects/:projectId/publish',
      'Publish project release flow',
    ),
    projectCollaborators: createRoute(
      'app',
      'user',
      'GET',
      '/app/v3/api/projects/:projectId/collaborators',
      'List project collaborators',
    ),
    projects: createRoute('app', 'user', 'GET', '/app/v3/api/projects', 'List projects'),
    skillPackages: createRoute('app', 'user', 'GET', '/app/v3/api/skill_packages', 'List skill packages'),
    teams: createRoute('app', 'user', 'GET', '/app/v3/api/teams', 'List workspace teams'),
    updateProject: createRoute(
      'app',
      'user',
      'PATCH',
      '/app/v3/api/projects/:projectId',
      'Update project',
    ),
    updateWorkspace: createRoute(
      'app',
      'user',
      'PATCH',
      '/app/v3/api/workspaces/:workspaceId',
      'Update workspace',
    ),
    membershipCurrent: createRoute(
      'app',
      'user',
      'GET',
      '/app/v3/api/memberships/current',
      'Get current SDKWork commerce membership',
    ),
    membershipPackageGroups: createRoute(
      'app',
      'user',
      'GET',
      '/app/v3/api/memberships/package_groups',
      'List SDKWork commerce membership package groups',
    ),
    updateCurrentUserProfile: toBirdCoderApiRouteDefinition({
      authMode: 'user',
      method: 'PATCH',
      operationId: 'users.current.update',
      path: '/app/v3/api/iam/users/current',
      surface: 'app',
      summary: 'Update current SDKWork IAM user profile',
    }),
    workspaceMembers: createRoute(
      'app',
      'user',
      'GET',
      '/app/v3/api/workspaces/:workspaceId/members',
      'List workspace members',
    ),
    workspaces: createRoute('app', 'user', 'GET', '/app/v3/api/workspaces', 'List workspaces'),
  };
  return birdCoderAppApiContract;
}

const BACKEND_API_CONTRACT: BirdCoderBackendApiContract = {
  iamApiKeys: createIamRoute('apiKeys.list', 'List SDKWork IAM API keys'),
  iamApiKeyRevoke: createIamRoute('apiKeys.revoke', 'Revoke SDKWork IAM API key'),
  iamAuditEvents: createIamRoute('auditEvents.list', 'List SDKWork IAM audit events'),
  iamOrganizations: createIamRoute('organizations.list', 'List SDKWork IAM organizations'),
  iamOrganization: createIamRoute('organizations.retrieve', 'Get SDKWork IAM organization'),
  createIamOrganization: createIamRoute('organizations.create', 'Create SDKWork IAM organization'),
  updateIamOrganization: createIamRoute('organizations.update', 'Update SDKWork IAM organization'),
  deleteIamOrganization: createIamRoute('organizations.delete', 'Delete SDKWork IAM organization'),
  iamOrganizationTree: createIamRoute(
    'organizations.tree.retrieve',
    'Get SDKWork IAM organization tree',
  ),
  iamOrganizationMemberships: createIamRoute(
    'organizationMemberships.list',
    'List SDKWork IAM organization memberships',
  ),
  createIamOrganizationMembership: createIamRoute(
    'organizationMemberships.create',
    'Create SDKWork IAM organization membership',
  ),
  updateIamOrganizationMembership: createIamRoute(
    'organizationMemberships.update',
    'Update SDKWork IAM organization membership',
  ),
  iamPermissions: createIamRoute('permissions.list', 'List SDKWork IAM permissions'),
  iamPermission: createIamRoute('permissions.retrieve', 'Get SDKWork IAM permission'),
  createIamPermission: createIamRoute('permissions.create', 'Create SDKWork IAM permission'),
  updateIamPermission: createIamRoute('permissions.update', 'Update SDKWork IAM permission'),
  deleteIamPermission: createIamRoute('permissions.delete', 'Delete SDKWork IAM permission'),
  iamPolicies: createIamRoute('policies.list', 'List SDKWork IAM policies'),
  iamPolicy: createIamRoute('policies.retrieve', 'Get SDKWork IAM policy'),
  createIamPolicy: createIamRoute('policies.create', 'Create SDKWork IAM policy'),
  updateIamPolicy: createIamRoute('policies.update', 'Update SDKWork IAM policy'),
  deleteIamPolicy: createIamRoute('policies.delete', 'Delete SDKWork IAM policy'),
  iamRoles: createIamRoute('roles.list', 'List SDKWork IAM roles'),
  iamRole: createIamRoute('roles.retrieve', 'Get SDKWork IAM role'),
  createIamRole: createIamRoute('roles.create', 'Create SDKWork IAM role'),
  updateIamRole: createIamRoute('roles.update', 'Update SDKWork IAM role'),
  deleteIamRole: createIamRoute('roles.delete', 'Delete SDKWork IAM role'),
  iamRolePermissions: createIamRoute('roles.permissions.list', 'List SDKWork IAM role permissions'),
  createIamRolePermission: createIamRoute(
    'roles.permissions.create',
    'Create SDKWork IAM role permission',
  ),
  deleteIamRolePermission: createIamRoute(
    'roles.permissions.delete',
    'Delete SDKWork IAM role permission',
  ),
  iamSecurityEvents: createIamRoute('securityEvents.list', 'List SDKWork IAM security events'),
  iamTenants: createIamRoute('tenants.list', 'List SDKWork IAM tenants'),
  iamTenant: createIamRoute('tenants.retrieve', 'Get SDKWork IAM tenant'),
  createIamTenant: createIamRoute('tenants.create', 'Create SDKWork IAM tenant'),
  updateIamTenant: createIamRoute('tenants.update', 'Update SDKWork IAM tenant'),
  deleteIamTenant: createIamRoute('tenants.delete', 'Delete SDKWork IAM tenant'),
  iamTenantMembers: createIamRoute('tenants.members.list', 'List SDKWork IAM tenant members'),
  createIamTenantMember: createIamRoute('tenants.members.create', 'Create SDKWork IAM tenant member'),
  updateIamTenantMember: createIamRoute('tenants.members.update', 'Update SDKWork IAM tenant member'),
  deleteIamTenantMember: createIamRoute('tenants.members.delete', 'Delete SDKWork IAM tenant member'),
  iamUsers: createIamRoute('users.list', 'List SDKWork IAM users'),
  iamUser: createIamRoute('users.retrieve', 'Get SDKWork IAM user'),
  createIamUser: createIamRoute('users.create', 'Create SDKWork IAM user'),
  updateIamUser: createIamRoute('users.update', 'Update SDKWork IAM user'),
  deleteIamUser: createIamRoute('users.delete', 'Delete SDKWork IAM user'),
  iamUserRoles: createIamRoute('roleBindings.list', 'List SDKWork IAM user role bindings'),
  createIamUserRole: createIamRoute('roleBindings.create', 'Create SDKWork IAM user role binding'),
  deleteIamUserRole: createIamRoute('roleBindings.delete', 'Delete SDKWork IAM user role binding'),
  audit: createRoute('backend', 'admin', 'GET', '/backend/v3/api/iam/audit_events', 'List audit events'),
  deployments: createRoute(
    'backend',
    'admin',
    'GET',
    '/backend/v3/api/deployments',
    'List governed deployments',
  ),
  deploymentTargets: createRoute(
    'backend',
    'admin',
    'GET',
    '/backend/v3/api/projects/:projectId/deployment_targets',
    'List deployment targets',
  ),
  policies: createRoute('backend', 'admin', 'GET', '/backend/v3/api/iam/policies', 'List governance policies'),
  releases: createRoute('backend', 'admin', 'GET', '/backend/v3/api/releases', 'List releases'),
  teamMembers: createRoute(
    'backend',
    'admin',
    'GET',
    '/backend/v3/api/iam/teams/:teamId/members',
    'List team members',
  ),
  teams: createRoute('backend', 'admin', 'GET', '/backend/v3/api/iam/teams', 'List teams'),
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
    appClient: options.appClient,
    apiBaseUrl:
      options.apiBaseUrl ??
      (options.host ? undefined : BIRD_SERVER_RUNTIME_TRANSPORT_BASE_URLS[distributionId]),
    backendClient: options.backendClient,
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
    surfaces: ['app', 'backend'],
  };
}

export function listBirdCoderCodingServerEngines(): ReadonlyArray<BirdCoderEngineDescriptor> {
  return listBirdCoderCodeEngineDescriptors();
}

export function listBirdCoderCodingServerModels(): ReadonlyArray<BirdCoderModelCatalogEntry> {
  return listBirdCoderCodeEngineModels();
}

export function getBirdCoderCodingServerModelConfig(): BirdCoderCodeEngineModelConfig {
  const models = listBirdCoderCodeEngineModels();
  const updatedAt =
    models
      .map((model) => Date.parse(model.updatedAt))
      .filter((timestamp) => Number.isFinite(timestamp))
      .sort((left, right) => right - left)[0] ?? Date.parse('2026-01-01T00:00:00.000Z');
  return buildDefaultBirdCoderCodeEngineModelConfig({
    models,
    source: 'server',
    updatedAt: new Date(updatedAt).toISOString(),
    version: BIRDCODER_CODING_SERVER_API_VERSION,
  });
}

export function syncBirdCoderCodingServerModelConfig(
  localConfig: BirdCoderCodeEngineModelConfig,
): BirdCoderCodeEngineModelConfigSyncResult {
  return createBirdCoderCodeEngineModelConfigSyncPlan({
    localConfig,
    serverConfig: getBirdCoderCodingServerModelConfig(),
  });
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

export function getBirdCoderAppRuntimeApiContract(): BirdCoderAppRuntimeApiContract {
  return APP_RUNTIME_API_CONTRACT;
}

export function getBirdCoderAppApiContract(): BirdCoderAppApiContract {
  return getResolvedBirdCoderAppApiContract();
}

export function getBirdCoderBackendApiContract(): BirdCoderBackendApiContract {
  return BACKEND_API_CONTRACT;
}

export function listBirdCoderCodingServerRoutes(): BirdCoderApiRouteDefinition[] {
  const routes = [
    ...Object.values(APP_RUNTIME_API_CONTRACT),
    ...Object.values(getResolvedBirdCoderAppApiContract()),
    ...Object.values(BACKEND_API_CONTRACT),
  ];
  const routesByMethodAndPath = new Map<string, BirdCoderApiRouteDefinition>();

  for (const route of routes) {
    const routeKey = `${route.method} ${route.path}`;
    if (!routesByMethodAndPath.has(routeKey)) {
      routesByMethodAndPath.set(routeKey, route);
    }
  }

  return [...routesByMethodAndPath.values()];
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
    'x-sdkwork-api-gateway': {
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

  const resolvedRequest = {
    ...request,
    modelId: resolvedModelId,
  };

  try {
    for await (const canonicalEvent of chatEngine.sendCanonicalEvents?.(
      request.messages,
      {
        ...request.options,
        model: resolvedModelId,
      },
    ) ?? []) {
      const projection = mapCanonicalEventToCoreEvent(
        resolvedRequest,
        canonicalEvent,
      );
      events.push(projection.event);
      if (projection.artifact) {
        artifacts.push(projection.artifact);
      }
    }
  } catch (error) {
    appendCoreSessionRunFailureEvent(resolvedRequest, events, error);
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
    streamUrl: `/app/v3/api/coding_sessions/${request.sessionId}/events`,
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
  const resolvedModelId = resolveRequiredRuntimeModelId(request);
  const { chatEngine } = createWorkbenchServerSessionEngineBinding(request.engineId);
  const resolvedRequest = {
    ...request,
    modelId: resolvedModelId,
  };
  const events: BirdCoderCodingSessionEvent[] = [];

  try {
    for await (const canonicalEvent of chatEngine.sendCanonicalEvents?.(
      request.messages,
      {
        ...request.options,
        model: resolvedModelId,
      },
    ) ?? []) {
      const { event } = mapCanonicalEventToCoreEvent(
        resolvedRequest,
        canonicalEvent,
      );
      events.push(event);
      yield createEnvelope(event, event.id);
    }
  } catch (error) {
    const appendedFailureEvent = appendCoreSessionRunFailureEvent(resolvedRequest, events, error);
    if (appendedFailureEvent) {
      yield createEnvelope(appendedFailureEvent, appendedFailureEvent.id);
    }
  }
}

export function createBirdCoderApprovalDecisionEnvelope(
  result: BirdCoderApprovalDecisionResult,
): BirdCoderApiEnvelope<BirdCoderApprovalDecisionResult> {
  return createEnvelope(result, result.approvalId);
}

export function createBirdCoderUserQuestionAnswerEnvelope(
  result: BirdCoderUserQuestionAnswerResult,
): BirdCoderApiEnvelope<BirdCoderUserQuestionAnswerResult> {
  return createEnvelope(result, result.questionId);
}

export {
  createBirdCoderConsoleRepositories,
  createBirdCoderWorkspaceRepository,
  type BirdCoderConsoleRepositories,
  type BirdCoderRepresentativeAuditRecord,
  type BirdCoderRepresentativePolicyRecord,
  type BirdCoderProjectContentRecord,
  type BirdCoderRepresentativeProjectRecord,
  type BirdCoderRepresentativeReleaseRecord,
  type BirdCoderRepresentativeTeamRecord,
  type BirdCoderWorkspaceRecord,
} from '@sdkwork/birdcoder-pc-infrastructure/storage/appConsoleRepository';
