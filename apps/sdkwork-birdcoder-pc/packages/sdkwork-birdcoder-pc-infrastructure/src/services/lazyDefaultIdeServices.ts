import type {
  BirdCoderDefaultIdeServiceKey,
  BirdCoderDefaultIdeServices,
  BirdCoderDefaultIdeSharedRuntime,
  CreateBirdCoderDefaultIdeServicesOptions,
} from './defaultIdeServicesShared.ts';
import {
  createBirdCoderAdminIdeServices,
  createUnavailableAdminDeploymentService,
  createUnavailableAdminPolicyService,
  createUnavailableAuditService,
} from '@sdkwork/birdcoder-pc-admin-core';
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
    return import('./defaultIdeServicesShared.ts').then((module) =>
      module.createBirdCoderDefaultIdeSharedRuntime(options),
    );
  }

  sharedRuntimePromise ??= import('./defaultIdeServicesShared.ts').then((module) =>
    module.createBirdCoderDefaultIdeSharedRuntime(),
  );
  return sharedRuntimePromise;
}

async function loadWorkspaceService(
  runtime: BirdCoderDefaultIdeSharedRuntime,
): Promise<BirdCoderDefaultIdeServices['workspaceService']> {
  if (!runtime.hasBoundAppClient) {
    return runtime.providerBackedWorkspaceService;
  }

  const { ApiBackedWorkspaceService } = await import('./impl/ApiBackedWorkspaceService.ts');
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

  const { ApiBackedProjectService } = await import('./impl/ApiBackedProjectService.ts');
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
        if (!runtime.hasExplicitBackendClient) {
          return createUnavailableAdminDeploymentService();
        }
        return createBirdCoderAdminIdeServices(runtime.backendClient).adminDeploymentService;
      }
      case 'adminPolicyService': {
        if (!runtime.hasExplicitBackendClient) {
          return createUnavailableAdminPolicyService();
        }
        return createBirdCoderAdminIdeServices(runtime.backendClient).adminPolicyService;
      }
      case 'authService':
        return runtime.authService;
      case 'auditService': {
        if (!runtime.hasExplicitBackendClient) {
          return createUnavailableAuditService();
        }
        return createBirdCoderAdminIdeServices(runtime.backendClient).auditService;
      }
      case 'catalogService': {
        const { ApiBackedCatalogService } = await import('./impl/ApiBackedCatalogService.ts');
        return new ApiBackedCatalogService({
          appClient: runtime.appClient,
        });
      }
      case 'collaborationService': {
        const { ApiBackedCollaborationService } = await import('./impl/ApiBackedCollaborationService.ts');
        return new ApiBackedCollaborationService({
          appClient: runtime.appClient,
          currentUserProvider: runtime.authService,
        });
      }
      case 'appRuntimeReadService': {
        const { ApiBackedAppRuntimeReadService } = await import('./impl/ApiBackedAppRuntimeReadService.ts');
        return new ApiBackedAppRuntimeReadService({
          client: runtime.appRuntimeClient,
          currentUserProvider: runtime.authService,
        });
      }
      case 'appRuntimeWriteService': {
        const { ApiBackedAppRuntimeWriteService } = await import('./impl/ApiBackedAppRuntimeWriteService.ts');
        return new ApiBackedAppRuntimeWriteService({
          client: runtime.appRuntimeClient,
        });
      }
      case 'deploymentService': {
        const { ApiBackedDeploymentService } = await import('./impl/ApiBackedDeploymentService.ts');
        return new ApiBackedDeploymentService({
          appClient: runtime.appClient,
        });
      }
      case 'documentService': {
        const { ApiBackedDocumentService } = await import('./impl/ApiBackedDocumentService.ts');
        return new ApiBackedDocumentService({
          appClient: runtime.appClient,
        });
      }
      case 'fileSystemService': {
        return runtime.fileSystemService;
      }
      case 'gitService': {
        const { ApiBackedGitService } = await import('./impl/ApiBackedGitService.ts');
        return new ApiBackedGitService({
          appClient: runtime.appClient,
        });
      }
      case 'promptService':
        return runtime.promptService;
      case 'projectService':
        return loadProjectService(runtime);
      case 'releaseService': {
        if (!runtime.hasExplicitBackendClient) {
          const { createUnavailableReleaseService } = await import('./impl/UnavailableReleaseService.ts');
          return createUnavailableReleaseService();
        }
        const { ApiBackedReleaseService } = await import('./impl/ApiBackedReleaseService.ts');
        return new ApiBackedReleaseService({ backendClient: runtime.backendClient });
      }
      case 'teamService': {
        const { ApiBackedTeamService } = await import('./impl/ApiBackedTeamService.ts');
        return new ApiBackedTeamService({
          appClient: runtime.appClient,
          currentUserProvider: runtime.authService,
        });
      }
      case 'vipMembershipService': {
        const { ApiBackedVipMembershipService } = await import('./impl/ApiBackedVipMembershipService.ts');
        return new ApiBackedVipMembershipService();
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
