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
} from '@sdkwork/birdcoder-pc-contracts-commons';
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
} from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  BIRDCODER_CODING_SERVER_API_VERSION,
  BIRDCODER_CODING_SERVER_DOCS_PATH,
  BIRDCODER_CODING_SERVER_LIVE_OPENAPI_PATH,
  BIRDCODER_CODING_SERVER_ROUTE_CATALOG_PATH,
  BIRDCODER_STREAM_KINDS,
} from './serverConstants.ts';

export type BirdCoderOpenApiSchema = Record<string, unknown>;
export type BirdCoderOpenApiScope = 'platform' | 'tenant' | 'organization' | 'user' | 'owner';
export type BirdCoderOpenApiDomain =
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

export interface BirdCoderOpenApiGovernanceMetadata {
  dataScope: BirdCoderOpenApiScope;
  deployment: 'all';
  domain: BirdCoderOpenApiDomain;
  isPublic: boolean;
  permission?: string;
  resource: string;
  tenantScope: BirdCoderOpenApiScope;
}

export interface BirdCoderOpenApiParameterObject {
  name: string;
  in: 'header' | 'path' | 'query';
  required?: boolean;
  description?: string;
  schema: BirdCoderOpenApiSchema;
}

export interface BirdCoderOpenApiRequestBodyObject {
  required?: boolean;
  content: {
    'application/json': {
      schema: BirdCoderOpenApiSchema;
    };
  };
}

export interface BirdCoderOpenApiResponseObject {
  description: string;
  content?: {
    'application/json'?: {
      schema: BirdCoderOpenApiSchema;
    };
    'application/problem+json'?: {
      schema: BirdCoderOpenApiSchema;
    };
    'text/event-stream'?: {
      schema: BirdCoderOpenApiSchema;
    };
  };
}

export interface BirdCoderOpenApiOperationObject {
  operationId: string;
  summary: string;
  description: string;
  tags: string[];
  parameters?: BirdCoderOpenApiParameterObject[];
  requestBody?: BirdCoderOpenApiRequestBodyObject;
  responses: Record<string, BirdCoderOpenApiResponseObject>;
  security: Array<{ bearerAuth: []; sdkworkAccessToken: [] }> | [];
  'x-sdkwork-auth-mode': 'anonymous' | BirdCoderApiRouteDefinition['authMode'];
  'x-sdkwork-data-scope': BirdCoderOpenApiScope;
  'x-sdkwork-deployment': 'all';
  'x-sdkwork-domain': BirdCoderOpenApiDomain;
  'x-sdkwork-audit-event'?: string;
  'x-sdkwork-forbid-credential-headers'?: boolean;
  'x-sdkwork-idempotent'?: boolean;
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
  'x-sdkwork-api-assembly': {
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

export interface BirdCoderOpenApiOperationDefinition {
  auditEvent?: string;
  idempotent?: boolean;
  parameters?: BirdCoderOpenApiParameterObject[];
  requestBody?: BirdCoderOpenApiRequestBodyObject;
  responses: Record<string, BirdCoderOpenApiResponseObject>;
  streamKind?: (typeof BIRDCODER_STREAM_KINDS)[number];
}
