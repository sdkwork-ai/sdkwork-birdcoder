export { openLocalFolder } from '@sdkwork/birdcoder-pc-infrastructure/platform/openLocalFolder';

export {
  bindDefaultBirdCoderIdeServicesRuntime,
  configureDefaultBirdCoderIdeServicesRuntime,
  createBirdCoderDependencyAppSdkClients,
  getDefaultBirdCoderIdeServicesRuntimeConfig,
  loadDefaultBirdCoderIdeService,
  resetDefaultBirdCoderIdeServicesRuntimeForTests,
  type BindDefaultBirdCoderIdeServicesRuntimeOptions,
  type BirdCoderDefaultIdeServicesRuntimeConfig,
  type BirdCoderDependencyAppSdkClients,
} from './defaultIdeServices.ts';

export {
  bootstrapBirdCoderMembershipSdk,
  resetBirdCoderMembershipSdkBootstrap,
} from '@sdkwork/birdcoder-pc-infrastructure/services/membershipSdkBootstrap';

export {
  bootstrapBirdCoderDriveSandboxExplorer,
  createBirdCoderDriveSandboxExplorerPort,
} from '@sdkwork/birdcoder-pc-infrastructure/services/driveSandboxExplorerRuntime';
export type { BirdCoderDriveSandboxExplorerRuntimeOptions } from '@sdkwork/birdcoder-pc-infrastructure/services/driveSandboxExplorerRuntime';

export type {
  BirdCoderAppSdkApiClient,
} from '@sdkwork/birdcoder-pc-infrastructure/services/birdCoderSdkClient';

export {
  BIRDCODER_PLATFORM_DEV_PROXY_PATH,
  normalizeBirdCoderSdkBaseUrl,
  readBirdCoderRuntimeEnv,
  resolveBirdCoderApplicationSdkBaseUrl,
  resolveBirdCoderDependencySdkBaseUrl,
  resolveBirdCoderPlatformSdkBaseUrl,
} from '@sdkwork/birdcoder-pc-infrastructure/services/sdkBaseUrls';

export {
  resolveBirdCoderRuntimeTopology,
  type BirdCoderDeploymentProfile,
  type BirdCoderExecutionLocation,
  type BirdCoderRuntimeTarget,
  type BirdCoderRuntimeTopology,
} from '@sdkwork/birdcoder-pc-infrastructure/services/runtimeTopology';

export type {
  ResolveBirdCoderRuntimeTopologyOptions,
} from '@sdkwork/birdcoder-pc-infrastructure/services/runtimeTopology';

export type {
  BirdCoderDefaultIdeServiceKey,
  BirdCoderDefaultIdeServices,
} from '@sdkwork/birdcoder-pc-infrastructure/services/defaultIdeServicesShared';

export type {
  BirdCoderVipBenefit,
  BirdCoderVipCurrentMembership,
  BirdCoderVipMembershipState,
  BirdCoderVipPackage,
  BirdCoderVipPackageGroup,
  IVipMembershipService,
} from '@sdkwork/birdcoder-pc-infrastructure/services/interfaces/IVipMembershipService';

export type { IAuthService } from '@sdkwork/birdcoder-pc-infrastructure/services/interfaces/IAuthService';
export type {
  AgentInteractionClaim,
  AgentSessionPageRequest,
  CreateAgentSessionInput,
  IAgentSessionService,
  SubmitAgentTurnInput,
} from '@sdkwork/birdcoder-pc-infrastructure/services/interfaces/IAgentSessionService';
export type { ICatalogService } from '@sdkwork/birdcoder-pc-infrastructure/services/interfaces/ICatalogService';
export type { IDocumentService, DocumentListOptions } from '@sdkwork/birdcoder-pc-infrastructure/services/interfaces/IDocumentService';
export type { IFileSystemService } from '@sdkwork/birdcoder-pc-infrastructure/services/interfaces/IFileSystemService';
export type {
  IProjectRuntimeLocationService,
  ProjectRuntimeLocationBindingResult,
  ProjectRuntimeLocationCapability,
  ProjectRuntimeLocationExecutionUnavailableCode,
  ProjectRuntimeLocationRegistrationPort,
  ProjectRuntimeLocationResolution,
  ProjectRuntimeLocationResolutionRequest,
  ResolvedProjectRuntimeLocation,
} from '@sdkwork/birdcoder-pc-infrastructure/services/interfaces/IProjectRuntimeLocationService';
export {
  ProjectRuntimeLocationExecutionUnavailableError,
  requireProjectRuntimeLocationExecutionId,
} from '@sdkwork/birdcoder-pc-infrastructure/services/interfaces/IProjectRuntimeLocationService';
export type { IGitService } from '@sdkwork/birdcoder-pc-infrastructure/services/interfaces/IGitService';
export type { IPromptService } from '@sdkwork/birdcoder-pc-infrastructure/services/interfaces/IPromptService';
export type { IProjectService } from '@sdkwork/birdcoder-pc-infrastructure/services/interfaces/IProjectService';
export type { IWorkspaceService } from '@sdkwork/birdcoder-pc-infrastructure/services/interfaces/IWorkspaceService';
