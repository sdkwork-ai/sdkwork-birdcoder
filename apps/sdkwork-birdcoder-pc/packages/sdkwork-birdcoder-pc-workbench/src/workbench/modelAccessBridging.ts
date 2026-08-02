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
