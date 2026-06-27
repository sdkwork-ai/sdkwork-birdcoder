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
  BIRD_SERVER_DEFAULT_CONFIG_FILE_NAME,
  BIRD_SERVER_DEFAULT_HOST,
  BIRD_SERVER_DEFAULT_PORT,
  BIRD_SERVER_DISTRIBUTIONS,
  BIRD_SERVER_RUNTIME_TRANSPORT_BASE_URLS,
  type BirdServerDistributionId,
} from './serverConstants.ts';
import {
  type BirdServerRuntime,
  type BindBirdCoderServerRuntimeTransportOptions,
  loadBirdCoderInfrastructureRuntimeModule,
} from './serverRuntime.ts';

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

