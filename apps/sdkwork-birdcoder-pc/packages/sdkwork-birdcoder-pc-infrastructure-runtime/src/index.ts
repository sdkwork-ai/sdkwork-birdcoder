export * from '@sdkwork/birdcoder-pc-infrastructure';

export { getBirdCoderGeneratedAppSdkClient } from '@sdkwork/birdcoder-pc-infrastructure';

// Re-export openLocalFolder for shared package compatibility
export { openLocalFolder } from '@sdkwork/birdcoder-pc-infrastructure/platform/openLocalFolder';

// Re-export getDefaultBirdCoderIdeServicesRuntimeConfig for shared package compatibility
export { getDefaultBirdCoderIdeServicesRuntimeConfig } from '@sdkwork/birdcoder-pc-infrastructure/services/defaultIdeServicesRuntime';

// Re-export canSubscribeBirdCoderWorkspaceRealtime for shared package compatibility
export { canSubscribeBirdCoderWorkspaceRealtime, subscribeBirdCoderWorkspaceRealtime } from '@sdkwork/birdcoder-pc-infrastructure/services/workspaceRealtimeClient';

// Re-export service interfaces for shared package compatibility
export type { IDeploymentService } from '@sdkwork/birdcoder-pc-infrastructure/services/interfaces/IDeploymentService';
export type { DocumentListOptions, IDocumentService } from '@sdkwork/birdcoder-pc-infrastructure/services/interfaces/IDocumentService';
export type { IAppRuntimeReadService } from '@sdkwork/birdcoder-pc-infrastructure/services/interfaces/IAppRuntimeReadService';
export type { IAppRuntimeWriteService } from '@sdkwork/birdcoder-pc-infrastructure/services/interfaces/IAppRuntimeWriteService';
