import { BirdCoderAgentSessionService } from './agentsSessionService.ts';
import {
  createBirdCoderDefaultIdeSharedRuntime,
  type BirdCoderDefaultIdeServices,
  type CreateBirdCoderDefaultIdeServicesOptions,
} from './defaultIdeServicesShared.ts';
import { ApiBackedCatalogService } from './impl/ApiBackedCatalogService.ts';
import { ApiBackedGitService } from './impl/ApiBackedGitService.ts';
import { ApiBackedProjectService } from './impl/ApiBackedProjectService.ts';
import { ApiBackedVipMembershipService } from './impl/ApiBackedVipMembershipService.ts';
import { ApiBackedWorkspaceService } from './impl/ApiBackedWorkspaceService.ts';
import { PromptsSdkPromptService } from './impl/PromptsSdkPromptService.ts';
import { DocumentsSdkProjectDocumentService } from './impl/DocumentsSdkProjectDocumentService.ts';

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
    }),
    authService: runtime.authService,
    catalogService: new ApiBackedCatalogService({
      skillsClient: runtime.skillsClient,
    }),
    documentService: new DocumentsSdkProjectDocumentService({
      appClient: runtime.appClient,
      documentsClient: runtime.documentsClient,
    }),
    fileSystemService: runtime.fileSystemService,
    gitService: new ApiBackedGitService({
      appClient: runtime.appClient,
      resolveProjectRuntimeLocation: (projectId) =>
        runtime.projectRuntimeLocationService.resolveProjectRuntimeLocation(projectId, {
          allowFolderSelection: false,
          capability: 'git',
        }),
      resolveRemoteRuntimeLocationId: (projectId) =>
        runtime.projectRuntimeLocationService.resolveRemoteProjectRuntimeLocationId(
          projectId,
          'git',
        ),
    }),
    projectRuntimeLocationService: runtime.projectRuntimeLocationService,
    promptService: new PromptsSdkPromptService(runtime.promptsClient),
    projectService: new ApiBackedProjectService({
      agentProjects: runtime.agentsClient.ai.agents.projects,
      appClient: runtime.appClient,
    }),
    vipMembershipService: new ApiBackedVipMembershipService(),
    workspaceService: new ApiBackedWorkspaceService({
      appClient: runtime.appClient,
    }),
  };
}
