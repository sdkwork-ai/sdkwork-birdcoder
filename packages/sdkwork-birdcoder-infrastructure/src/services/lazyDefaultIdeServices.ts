import {
  createBirdCoderDefaultIdeSharedRuntime,
  type BirdCoderDefaultIdeServiceKey,
  type BirdCoderDefaultIdeServices,
  type BirdCoderDefaultIdeSharedRuntime,
  type CreateBirdCoderDefaultIdeServicesOptions,
} from './defaultIdeServicesShared.ts';
import { ApiBackedAdminDeploymentService } from './impl/ApiBackedAdminDeploymentService.ts';
import { ApiBackedAdminPolicyService } from './impl/ApiBackedAdminPolicyService.ts';
import { ApiBackedAuditService } from './impl/ApiBackedAuditService.ts';
import { ApiBackedCatalogService } from './impl/ApiBackedCatalogService.ts';
import { ApiBackedCollaborationService } from './impl/ApiBackedCollaborationService.ts';
import { ApiBackedCoreReadService } from './impl/ApiBackedCoreReadService.ts';
import { ApiBackedCoreWriteService } from './impl/ApiBackedCoreWriteService.ts';
import { ApiBackedDeploymentService } from './impl/ApiBackedDeploymentService.ts';
import { ApiBackedDocumentService } from './impl/ApiBackedDocumentService.ts';
import { ApiBackedGitService } from './impl/ApiBackedGitService.ts';
import { ApiBackedProjectService } from './impl/ApiBackedProjectService.ts';
import { ApiBackedReleaseService } from './impl/ApiBackedReleaseService.ts';
import { ApiBackedTeamService } from './impl/ApiBackedTeamService.ts';
import { ApiBackedWorkspaceService } from './impl/ApiBackedWorkspaceService.ts';
import { RuntimeFileSystemService } from './impl/RuntimeFileSystemService.ts';

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

  sharedRuntimePromise ??= Promise.resolve(createBirdCoderDefaultIdeSharedRuntime());
  return sharedRuntimePromise;
}

async function loadWorkspaceService(
  runtime: BirdCoderDefaultIdeSharedRuntime,
): Promise<BirdCoderDefaultIdeServices['workspaceService']> {
  if (!runtime.hasBoundAppClient) {
    return runtime.providerBackedWorkspaceService;
  }

  return new ApiBackedWorkspaceService({
    appClient: runtime.appClient,
    currentUserProvider: runtime.authService,
    workspaceMirror: runtime.providerBackedWorkspaceService,
    writeService: runtime.providerBackedWorkspaceService,
  });
}

async function loadProjectService(
  runtime: BirdCoderDefaultIdeSharedRuntime,
): Promise<BirdCoderDefaultIdeServices['projectService']> {
  if (!runtime.hasBoundAppClient) {
    return runtime.providerBackedProjectService;
  }

  return new ApiBackedProjectService({
    appClient: runtime.appClient,
    codingSessionMirror: runtime.providerBackedProjectService,
    codingRuntimeClient: runtime.appRuntimeClient,
    currentUserProvider: runtime.authService,
    projectMirror: runtime.providerBackedProjectService,
    writeService: runtime.providerBackedProjectService,
  });
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

  const servicePromise = loadSharedRuntime(options).then(async (runtime) => {
    switch (serviceKey) {
      case 'adminDeploymentService': {
        return new ApiBackedAdminDeploymentService({
          backendClient: runtime.backendClient,
        });
      }
      case 'adminPolicyService': {
        return new ApiBackedAdminPolicyService({
          backendClient: runtime.backendClient,
        });
      }
      case 'authService':
        return runtime.authService;
      case 'auditService': {
        return new ApiBackedAuditService({
          backendClient: runtime.backendClient,
        });
      }
      case 'catalogService': {
        return new ApiBackedCatalogService({
          appClient: runtime.appClient,
        });
      }
      case 'collaborationService': {
        return new ApiBackedCollaborationService({
          appClient: runtime.appClient,
          currentUserProvider: runtime.authService,
        });
      }
      case 'coreReadService': {
        return new ApiBackedCoreReadService({
          client: runtime.appRuntimeClient,
          currentUserProvider: runtime.authService,
        });
      }
      case 'coreWriteService': {
        return new ApiBackedCoreWriteService({
          client: runtime.appRuntimeClient,
        });
      }
      case 'deploymentService': {
        return new ApiBackedDeploymentService({
          appClient: runtime.appClient,
          backendClient: runtime.backendClient,
        });
      }
      case 'documentService': {
        return new ApiBackedDocumentService({
          appClient: runtime.appClient,
        });
      }
      case 'fileSystemService': {
        return new RuntimeFileSystemService();
      }
      case 'gitService': {
        return new ApiBackedGitService({
          appClient: runtime.appClient,
        });
      }
      case 'promptService':
        return runtime.promptService;
      case 'projectService':
        return loadProjectService(runtime);
      case 'releaseService': {
        return new ApiBackedReleaseService({
          backendClient: runtime.backendClient,
        });
      }
      case 'teamService': {
        return new ApiBackedTeamService({
          appClient: runtime.appClient,
          currentUserProvider: runtime.authService,
        });
      }
      case 'workspaceService':
        return loadWorkspaceService(runtime);
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
