/**
 * Workbench-owned bridging exports for the agent model access surface.
 *
 * The PC UI and Settings layers must not depend on the i18n or
 * infrastructure-runtime packages directly (architecture boundary). The
 * workbench owns those dependencies and re-exports the exact symbols the
 * model access picker, composer footer, and model management settings need.
 */

export { createAgentModelAccessSelectorMessages } from '@sdkwork/birdcoder-pc-i18n/agentModelAccessSelectorMessages';
export { AgentModelConfigurationCredentialRequiredError } from '@sdkwork/birdcoder-pc-infrastructure-runtime';
export type {
  ModelAccessCatalogChannel,
  ModelAccessCatalogModel,
  ModelAccessCatalogSnapshot,
  UserModelChannel,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';
export {
  BIRDCODER_OFFICIAL_MODEL_RELAY_BASE_URL,
  resolveBirdCoderModelRelayApiKey,
  resolveBirdCoderModelRelayBaseUrl,
  resolveBirdCoderVendorProtocol,
  type BirdCoderModelVendorProtocol,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';
export {
  BIRDOODER_OFFICIAL_RELAY_CHANNEL_CODE,
  ensureWorkbenchEngineModelConfigurationApplied,
  isWorkbenchEngineModelConfigCurrent,
  resolveWorkbenchEngineModelConfigFingerprint,
  resolveWorkbenchEngineModelConfigTarget,
  type EnsureWorkbenchEngineModelConfigurationOptions,
  type EnsureWorkbenchEngineModelConfigurationResult,
  type ResolveWorkbenchEngineModelConfigTargetInput,
  type WorkbenchEngineModelConfigFingerprint,
  type WorkbenchEngineModelConfigTarget,
} from './agentModelConfigEnsure.ts';
