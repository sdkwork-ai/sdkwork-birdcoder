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

export const BIRD_SERVER_DEFAULT_HOST = BIRDCODER_DEFAULT_LOCAL_API_HOST;
export const BIRD_SERVER_DEFAULT_PORT = BIRDCODER_DEFAULT_LOCAL_API_PORT;
export const BIRD_SERVER_DEFAULT_CONFIG_FILE_NAME = 'bird-server.config.json';
export const BIRDCODER_CODING_SERVER_API_VERSION = BIRDCODER_CODING_SERVER_API_VERSION_VALUE;
export const BIRDCODER_CODING_SERVER_OPENAPI_PATH = '/openapi/coding-server-v1.json';
export const BIRDCODER_CODING_SERVER_LIVE_OPENAPI_PATH = '/openapi.json';
export const BIRDCODER_CODING_SERVER_DOCS_PATH = '/docs';
export const BIRDCODER_CODING_SERVER_ROUTE_CATALOG_PATH = '/app/v3/api/system/routes';

export type BirdServerDistributionId = 'cn' | 'global';

export const BIRD_SERVER_DISTRIBUTIONS = {
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

export const BIRD_SERVER_RUNTIME_TRANSPORT_BASE_URLS: Record<BirdServerDistributionId, string> = {
  global: BIRDCODER_DEFAULT_LOCAL_API_BASE_URL,
  cn: 'https://cn.sdkwork.local/birdcoder',
};

export const BIRDCODER_CODING_SESSION_TURN_REQUEST_KINDS = [
  'chat',
  'plan',
  'tool',
  'review',
  'apply',
] as const;

export const BIRDCODER_CODING_SESSION_TURN_STATUSES = [
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;

export const BIRDCODER_WORKSPACE_RESOURCE_STATUSES = ['active', 'archived'] as const;

export const BIRDCODER_COLLABORATION_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;

export const BIRDCODER_COLLABORATION_STATUSES = ['invited', 'active', 'suspended', 'removed'] as const;

export const BIRDCODER_GIT_OVERVIEW_STATUSES = ['ready', 'not_repository'] as const;

export const BIRDCODER_DOCUMENT_KINDS = [
  'prd',
  'architecture',
  'step',
  'release',
  'test-plan',
  'custom',
] as const;

export const BIRDCODER_DOCUMENT_STATUSES = ['draft', 'active', 'archived'] as const;

export const BIRDCODER_IAM_LOGIN_METHODS = [
  'emailCode',
  'password',
  'phoneCode',
  'sessionBridge',
] as const;

export const BIRDCODER_IAM_REGISTER_METHODS = ['email', 'phone'] as const;

export const BIRDCODER_IAM_RECOVERY_METHODS = ['email', 'phone'] as const;

export const BIRDCODER_IAM_VERIFY_TYPES = ['EMAIL', 'PHONE'] as const;

export const BIRDCODER_IAM_VERIFY_SCENES = [
  'LOGIN',
  'REGISTER',
  'RESET_PASSWORD',
] as const;

export const BIRDCODER_IAM_PASSWORD_RESET_CHANNELS = ['EMAIL', 'SMS'] as const;

export const BIRDCODER_IAM_DEVICE_TYPES = ['android', 'desktop', 'ios', 'web'] as const;

export const BIRDCODER_IAM_QR_AUTH_STATUSES = [
  'pending',
  'scanned',
  'confirmed',
  'completed',
  'expired',
  'cancelled',
  'failed',
] as const;

export const BIRDCODER_DEPLOYMENT_RECORD_STATUSES = [
  'planned',
  'running',
  'succeeded',
  'failed',
  'rolled_back',
] as const;

export const BIRDCODER_RELEASE_KINDS = ['formal', 'canary', 'hotfix', 'rollback'] as const;

export const BIRDCODER_RELEASE_STATUSES = [
  'pending',
  'ready',
  'running',
  'succeeded',
  'failed',
  'rolled_back',
] as const;

export const BIRDCODER_API_AUTH_MODES = ['host', 'user', 'admin'] as const;

export const BIRDCODER_API_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export const BIRDCODER_API_SURFACE_NAMES = ['app', 'backend'] as const;

export const BIRDCODER_OPERATION_STATUSES = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'rolled_back',
] as const;

export const BIRDCODER_STREAM_KINDS = ['sse', 'websocket'] as const;

export const BIRDCODER_APPROVAL_DECISIONS = ['approved', 'denied', 'blocked'] as const;

export const BIRDCODER_CODING_SESSION_ARTIFACT_STATUSES = ['draft', 'sealed', 'archived'] as const;

export const BIRDCODER_CODING_SESSION_CHECKPOINT_KINDS = [
  'resume',
  'approval',
  'handoff',
  'snapshot',
] as const;

export const BIRDCODER_MODEL_STATUSES = ['active', 'preview', 'deprecated', 'disabled'] as const;
