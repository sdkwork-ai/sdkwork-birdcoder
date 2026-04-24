import {
  createBirdCoderDefaultIdeSharedRuntime,
  type BirdCoderDefaultIdeServiceKey,
  type BirdCoderDefaultIdeServices,
  type BirdCoderDefaultIdeSharedRuntime,
  type CreateBirdCoderDefaultIdeServicesOptions,
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

  sharedRuntimePromise ??= Promise.resolve(createBirdCoderDefaultIdeSharedRuntime());
  return sharedRuntimePromise;
}

async function loadWorkspaceService(
  runtime: BirdCoderDefaultIdeSharedRuntime,
): Promise<BirdCoderDefaultIdeServices['workspaceService']> {
  if (!runtime.hasBoundAppAdminClient) {
    return runtime.providerBackedWorkspaceService;
  }

  const { ApiBackedWorkspaceService } = await import('./impl/ApiBackedWorkspaceService.ts');
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

  const { ApiBackedProjectService } = await import('./impl/ApiBackedProjectService.ts');
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
        const { ApiBackedAdminDeploymentService } = await import(
          './impl/ApiBackedAdminDeploymentService.ts'
        );
        return new ApiBackedAdminDeploymentService({
          client: runtime.appAdminClient,
        });
      }
      case 'adminPolicyService': {
        const { ApiBackedAdminPolicyService } = await import(
          './impl/ApiBackedAdminPolicyService.ts'
        );
        return new ApiBackedAdminPolicyService({
          client: runtime.appAdminClient,
        });
      }
      case 'authService':
        return runtime.authService;
      case 'auditService': {
        const { ApiBackedAuditService } = await import('./impl/ApiBackedAuditService.ts');
        return new ApiBackedAuditService({
          client: runtime.appAdminClient,
        });
      }
      case 'catalogService': {
        const { ApiBackedCatalogService } = await import('./impl/ApiBackedCatalogService.ts');
        return new ApiBackedCatalogService({
          client: runtime.appAdminClient,
        });
      }
      case 'collaborationService': {
        const { ApiBackedCollaborationService } = await import(
          './impl/ApiBackedCollaborationService.ts'
        );
        return new ApiBackedCollaborationService({
          client: runtime.appAdminClient,
          identityProvider: runtime.authService,
        });
      }
      case 'coreReadService': {
        const { ApiBackedCoreReadService } = await import('./impl/ApiBackedCoreReadService.ts');
        return new ApiBackedCoreReadService({
          client: runtime.coreReadClient,
          identityProvider: runtime.authService,
        });
      }
      case 'coreWriteService': {
        const { ApiBackedCoreWriteService } = await import('./impl/ApiBackedCoreWriteService.ts');
        return new ApiBackedCoreWriteService({
          client: runtime.coreWriteClient,
        });
      }
      case 'deploymentService': {
        const { ApiBackedDeploymentService } = await import('./impl/ApiBackedDeploymentService.ts');
        return new ApiBackedDeploymentService({
          client: runtime.appAdminClient,
        });
      }
      case 'documentService': {
        const { ApiBackedDocumentService } = await import('./impl/ApiBackedDocumentService.ts');
        return new ApiBackedDocumentService({
          client: runtime.appAdminClient,
        });
      }
      case 'fileSystemService': {
        const { RuntimeFileSystemService } = await import('./impl/RuntimeFileSystemService.ts');
        return new RuntimeFileSystemService();
      }
      case 'gitService': {
        const { ApiBackedGitService } = await import('./impl/ApiBackedGitService.ts');
        return new ApiBackedGitService({
          client: runtime.appAdminClient,
        });
      }
      case 'promptService':
        return runtime.promptService;
      case 'projectService':
        return loadProjectService(runtime);
      case 'releaseService': {
        const { ApiBackedReleaseService } = await import('./impl/ApiBackedReleaseService.ts');
        return new ApiBackedReleaseService({
          client: runtime.appAdminClient,
        });
      }
      case 'teamService': {
        const { ApiBackedTeamService } = await import('./impl/ApiBackedTeamService.ts');
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
