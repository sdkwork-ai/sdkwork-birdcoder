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
  BIRDCODER_CODING_SERVER_API_VERSION,
  BIRDCODER_CODING_SERVER_OPENAPI_PATH,
} from './serverConstants.ts';
import { buildBirdCoderApiGatewaySummary } from './routeCatalog.ts';

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
