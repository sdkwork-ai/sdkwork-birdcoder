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
  if (!runtime.hasBoundAppAdminClient) {
    return runtime.providerBackedWorkspaceService;
  }

  return new ApiBackedWorkspaceService({
    client: runtime.appAdminClient,
    identityProvider: runtime.authService,
    workspaceMirror: runtime.providerBackedWorkspaceService,
    writeService: runtime.providerBackedWorkspaceService,
  });
}

async function loadProjectService(
  runtime: BirdCoderDefaultIdeSharedRuntime,
): Promise<BirdCoderDefaultIdeServices['projectService']> {
  if (!runtime.hasBoundAppAdminClient) {
    return runtime.providerBackedProjectService;
  }

  return new ApiBackedProjectService({
    client: runtime.appAdminClient,
    codingSessionMirror: runtime.providerBackedProjectService,
    coreReadClient: runtime.coreReadClient,
    coreWriteClient: runtime.coreWriteClient,
    identityProvider: runtime.authService,
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
          client: runtime.appAdminClient,
        });
      }
      case 'adminPolicyService': {
        return new ApiBackedAdminPolicyService({
          client: runtime.appAdminClient,
        });
      }
      case 'authService':
        return runtime.authService;
      case 'auditService': {
        return new ApiBackedAuditService({
          client: runtime.appAdminClient,
        });
      }
      case 'catalogService': {
        return new ApiBackedCatalogService({
          client: runtime.appAdminClient,
        });
      }
      case 'collaborationService': {
        return new ApiBackedCollaborationService({
          client: runtime.appAdminClient,
          identityProvider: runtime.authService,
        });
      }
      case 'coreReadService': {
        return new ApiBackedCoreReadService({
          client: runtime.coreReadClient,
          identityProvider: runtime.authService,
        });
      }
      case 'coreWriteService': {
        return new ApiBackedCoreWriteService({
          client: runtime.coreWriteClient,
        });
      }
      case 'deploymentService': {
        return new ApiBackedDeploymentService({
          client: runtime.appAdminClient,
        });
      }
      case 'documentService': {
        return new ApiBackedDocumentService({
          client: runtime.appAdminClient,
        });
      }
      case 'fileSystemService': {
        return new RuntimeFileSystemService();
      }
      case 'gitService': {
        return new ApiBackedGitService({
          client: runtime.appAdminClient,
        });
      }
      case 'promptService':
        return runtime.promptService;
      case 'projectService':
        return loadProjectService(runtime);
      case 'releaseService': {
        return new ApiBackedReleaseService({
          client: runtime.appAdminClient,
        });
      }
      case 'teamService': {
        return new ApiBackedTeamService({
          client: runtime.appAdminClient,
          identityProvider: runtime.authService,
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
