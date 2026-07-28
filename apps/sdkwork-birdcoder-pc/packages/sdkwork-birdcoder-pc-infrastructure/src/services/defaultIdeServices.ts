import { BirdCoderAgentSessionService } from './agentsSessionService.ts';
import {
  createBirdCoderDefaultIdeSharedRuntime,
  type BirdCoderDefaultIdeServices,
  type CreateBirdCoderDefaultIdeServicesOptions,
} from './defaultIdeServicesShared.ts';
import { ApiBackedCatalogService } from './impl/ApiBackedCatalogService.ts';
import { ApiBackedVipMembershipService } from './impl/ApiBackedVipMembershipService.ts';
import { PromptsSdkPromptService } from './impl/PromptsSdkPromptService.ts';

export {
  type BirdCoderDefaultIdeServices,
  type CreateBirdCoderDefaultIdeServicesOptions,
} from './defaultIdeServicesShared.ts';

export function createDefaultBirdCoderIdeServices(
  options: CreateBirdCoderDefaultIdeServicesOptions = {},
): BirdCoderDefaultIdeServices {
  const runtime = createBirdCoderDefaultIdeSharedRuntime(options);

  return {
    agentSessionService: new BirdCoderAgentSessionService({
      client: runtime.agentsClient,
      providerSessionDirectoryIdentityProvider: (projectId) =>
        runtime.projectDeviceMountRegistry.resolveProviderSessionDirectoryIdentity(projectId),
    }),
    applicationPublishService: runtime.applicationPublishService,
    authService: runtime.authService,
    catalogService: new ApiBackedCatalogService({
      agentsClient: runtime.agentsClient,
      skillsClient: runtime.skillsClient,
    }),
    documentService: runtime.documentService,
    fileSystemService: runtime.fileSystemService,
    gitService: runtime.gitService,
    projectRuntimeLocationService: runtime.projectRuntimeLocationService,
    promptService: new PromptsSdkPromptService(runtime.promptsClient),
    projectService: runtime.projectService,
    workspaceService: runtime.workspaceService,
    vipMembershipService: new ApiBackedVipMembershipService(),
  };
}
