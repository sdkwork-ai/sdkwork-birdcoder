import { BirdCoderAgentSessionService } from './agentsSessionService.ts';
import {
  createBirdCoderDefaultIdeSharedRuntime,
  type BirdCoderDefaultIdeServiceKey,
  type BirdCoderDefaultIdeServices,
  type BirdCoderDefaultIdeSharedRuntime,
  type CreateBirdCoderDefaultIdeServicesOptions,
} from './defaultIdeServicesShared.ts';
import { ApiBackedCatalogService } from './impl/ApiBackedCatalogService.ts';
import { ApiBackedGitService } from './impl/ApiBackedGitService.ts';
import { ApiBackedProjectService } from './impl/ApiBackedProjectService.ts';
import { ApiBackedVipMembershipService } from './impl/ApiBackedVipMembershipService.ts';
import { ApiBackedWorkspaceService } from './impl/ApiBackedWorkspaceService.ts';
import { PromptsSdkPromptService } from './impl/PromptsSdkPromptService.ts';
import { DocumentsSdkProjectDocumentService } from './impl/DocumentsSdkProjectDocumentService.ts';

export type {
  BirdCoderDefaultIdeServiceKey,
  BirdCoderDefaultIdeServices,
} from './defaultIdeServicesShared.ts';

let sharedRuntimePromise: Promise<BirdCoderDefaultIdeSharedRuntime> | null = null;
const servicePromiseByKey = new Map<
  BirdCoderDefaultIdeServiceKey,
  Promise<BirdCoderDefaultIdeServices[BirdCoderDefaultIdeServiceKey]>
>();

function loadSharedRuntime(
  options?: CreateBirdCoderDefaultIdeServicesOptions,
): Promise<BirdCoderDefaultIdeSharedRuntime> {
  if (options) {
    return Promise.resolve(createBirdCoderDefaultIdeSharedRuntime(options));
  }
  sharedRuntimePromise ??= Promise.resolve().then(() =>
    createBirdCoderDefaultIdeSharedRuntime(),
  );
  return sharedRuntimePromise;
}

export function loadDefaultBirdCoderIdeService<K extends BirdCoderDefaultIdeServiceKey>(
  serviceKey: K,
  options?: CreateBirdCoderDefaultIdeServicesOptions,
): Promise<BirdCoderDefaultIdeServices[K]> {
  if (!options) {
    const cachedPromise = servicePromiseByKey.get(serviceKey) as
      | Promise<BirdCoderDefaultIdeServices[K]>
      | undefined;
    if (cachedPromise) {
      return cachedPromise;
    }
  }

  const servicePromise = loadSharedRuntime(options).then((runtime) => {
    switch (serviceKey) {
      case 'agentSessionService':
        return new BirdCoderAgentSessionService({ client: runtime.agentsClient });
      case 'authService':
        return runtime.authService;
      case 'catalogService':
        return new ApiBackedCatalogService({ skillsClient: runtime.skillsClient });
      case 'documentService':
        return new DocumentsSdkProjectDocumentService({
          appClient: runtime.appClient,
          documentsClient: runtime.documentsClient,
        });
      case 'fileSystemService':
        return runtime.fileSystemService;
      case 'gitService':
        return new ApiBackedGitService({
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
        });
      case 'projectRuntimeLocationService':
        return runtime.projectRuntimeLocationService;
      case 'promptService':
        return new PromptsSdkPromptService(runtime.promptsClient);
      case 'projectService':
        return new ApiBackedProjectService({
          agentProjects: runtime.agentsClient.ai.agents.projects,
          appClient: runtime.appClient,
        });
      case 'vipMembershipService':
        return new ApiBackedVipMembershipService();
      case 'workspaceService':
        return new ApiBackedWorkspaceService({ appClient: runtime.appClient });
      default:
        throw new Error(`Unsupported BirdCoder IDE service key: ${String(serviceKey)}`);
    }
  }) as Promise<BirdCoderDefaultIdeServices[K]>;

  if (!options) {
    servicePromiseByKey.set(
      serviceKey,
      servicePromise as Promise<BirdCoderDefaultIdeServices[BirdCoderDefaultIdeServiceKey]>,
    );
  }
  return servicePromise;
}
