import {
  createBirdCoderGeneratedAppAdminApiClient,
  createBirdCoderGeneratedCoreReadApiClient,
  createBirdCoderGeneratedCoreWriteApiClient,
  createBirdCoderGeneratedUserCenterApiClient,
  type BirdCoderAppAdminApiClient,
  type BirdCoderCoreReadApiClient,
  type BirdCoderCoreWriteApiClient,
  type BirdCoderUserCenterApiClient,
} from '@sdkwork/birdcoder-types';
import {
  createBirdCoderStorageProvider,
  type BirdCoderTransactionalStorageProvider,
} from '../storage/dataKernel.ts';
import { createBirdCoderConsoleRepositories } from '../storage/appConsoleRepository.ts';
import { createBirdCoderCodingSessionRepositories } from '../storage/codingSessionRepository.ts';
import { createBirdCoderPromptSkillTemplateEvidenceRepositories } from '../storage/promptSkillTemplateEvidenceRepository.ts';
import { createBirdCoderAppAdminConsoleQueries } from './appAdminConsoleQueries.ts';
import {
  createBirdCoderHttpApiTransport,
  createBirdCoderInProcessAppAdminApiTransport,
} from './appAdminApiClient.ts';
import { createBirdCoderInProcessCoreApiTransport } from './coreApiClient.ts';
import { resolveRuntimeServerSessionHeaders } from './runtimeServerSession.ts';
import { ApiBackedAdminDeploymentService } from './impl/ApiBackedAdminDeploymentService.ts';
import { ApiBackedAdminPolicyService } from './impl/ApiBackedAdminPolicyService.ts';
import { ApiBackedAuditService } from './impl/ApiBackedAuditService.ts';
import { ApiBackedCatalogService } from './impl/ApiBackedCatalogService.ts';
import { ApiBackedCollaborationService } from './impl/ApiBackedCollaborationService.ts';
import { ApiBackedCoreReadService } from './impl/ApiBackedCoreReadService.ts';
import { ApiBackedCoreWriteService } from './impl/ApiBackedCoreWriteService.ts';
import { ApiBackedDeploymentService } from './impl/ApiBackedDeploymentService.ts';
import { ApiBackedDocumentService } from './impl/ApiBackedDocumentService.ts';
import { RuntimeFileSystemService } from './impl/RuntimeFileSystemService.ts';
import { RuntimeAuthService } from './impl/RuntimeAuthService.ts';
import { ApiBackedProjectService } from './impl/ApiBackedProjectService.ts';
import { ApiBackedReleaseService } from './impl/ApiBackedReleaseService.ts';
import { ApiBackedTeamService } from './impl/ApiBackedTeamService.ts';
import { ApiBackedWorkspaceService } from './impl/ApiBackedWorkspaceService.ts';
import { ProviderBackedProjectService } from './impl/ProviderBackedProjectService.ts';
import { ProviderBackedWorkspaceService } from './impl/ProviderBackedWorkspaceService.ts';
import type { IAuthService } from './interfaces/IAuthService.ts';
import type { IAdminDeploymentService } from './interfaces/IAdminDeploymentService.ts';
import type { IAdminPolicyService } from './interfaces/IAdminPolicyService.ts';
import type { IAuditService } from './interfaces/IAuditService.ts';
import type { ICatalogService } from './interfaces/ICatalogService.ts';
import type { ICollaborationService } from './interfaces/ICollaborationService.ts';
import type { ICoreReadService } from './interfaces/ICoreReadService.ts';
import type { ICoreWriteService } from './interfaces/ICoreWriteService.ts';
import type { IDeploymentService } from './interfaces/IDeploymentService.ts';
import type { IDocumentService } from './interfaces/IDocumentService.ts';
import type { IFileSystemService } from './interfaces/IFileSystemService.ts';
import type { IProjectService } from './interfaces/IProjectService.ts';
import type { IReleaseService } from './interfaces/IReleaseService.ts';
import type { ITeamService } from './interfaces/ITeamService.ts';
import type { IWorkspaceService } from './interfaces/IWorkspaceService.ts';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';

export interface BirdCoderDefaultIdeServices {
  adminDeploymentService: IAdminDeploymentService;
  adminPolicyService: IAdminPolicyService;
  authService: IAuthService;
  auditService: IAuditService;
  catalogService: ICatalogService;
  collaborationService: ICollaborationService;
  coreReadService: ICoreReadService;
  coreWriteService: ICoreWriteService;
  deploymentService: IDeploymentService;
  documentService: IDocumentService;
  fileSystemService: IFileSystemService;
  projectService: IProjectService;
  releaseService: IReleaseService;
  teamService: ITeamService;
  workspaceService: IWorkspaceService;
}

export interface CreateBirdCoderDefaultIdeServicesOptions {
  appAdminClient?: BirdCoderAppAdminApiClient;
  coreReadClient?: BirdCoderCoreReadApiClient;
  coreWriteClient?: BirdCoderCoreWriteApiClient;
  storageProvider?: BirdCoderTransactionalStorageProvider;
}

const DEFAULT_RUNTIME_HTTP_API_TIMEOUT_MS = 20_000;
const DEFAULT_RUNTIME_USER_CENTER_TIMEOUT_MS = 20_000;

function isBrowserRuntime(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function hasExplicitRuntimeApiClients(
  runtimeConfig: ReturnType<typeof getDefaultBirdCoderIdeServicesRuntimeConfig>,
  options: CreateBirdCoderDefaultIdeServicesOptions,
): boolean {
  return Boolean(
    options.appAdminClient ||
      options.coreReadClient ||
      options.coreWriteClient ||
      runtimeConfig.appAdminClient ||
      runtimeConfig.coreReadClient ||
      runtimeConfig.coreWriteClient,
  );
}

function assertBrowserRuntimeApiConfigured(
  runtimeConfig: ReturnType<typeof getDefaultBirdCoderIdeServicesRuntimeConfig>,
  options: CreateBirdCoderDefaultIdeServicesOptions,
): void {
  if (!isBrowserRuntime()) {
    return;
  }

  if (runtimeConfig.apiBaseUrl || hasExplicitRuntimeApiClients(runtimeConfig, options)) {
    return;
  }

  throw new Error(
    'BirdCoder browser runtime requires a real server API base URL or explicit generated API clients. In-process fallback is disabled for product runtime.',
  );
}

function resolveRuntimeAppAdminClient(): BirdCoderAppAdminApiClient | undefined {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  if (runtimeConfig.appAdminClient) {
    return runtimeConfig.appAdminClient;
  }

  if (runtimeConfig.apiBaseUrl) {
    return createBirdCoderGeneratedAppAdminApiClient({
      transport: createBirdCoderHttpApiTransport({
        baseUrl: runtimeConfig.apiBaseUrl,
        resolveHeaders: resolveRuntimeServerSessionHeaders,
        timeoutMs: DEFAULT_RUNTIME_HTTP_API_TIMEOUT_MS,
      }),
    });
  }

  return undefined;
}

function resolveRuntimeCoreReadClient(): BirdCoderCoreReadApiClient | undefined {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  if (runtimeConfig.coreReadClient) {
    return runtimeConfig.coreReadClient;
  }

  if (runtimeConfig.apiBaseUrl) {
    return createBirdCoderGeneratedCoreReadApiClient({
      transport: createBirdCoderHttpApiTransport({
        baseUrl: runtimeConfig.apiBaseUrl,
        resolveHeaders: resolveRuntimeServerSessionHeaders,
        timeoutMs: DEFAULT_RUNTIME_HTTP_API_TIMEOUT_MS,
      }),
    });
  }

  return undefined;
}

function resolveRuntimeCoreWriteClient(): BirdCoderCoreWriteApiClient | undefined {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  if (runtimeConfig.coreWriteClient) {
    return runtimeConfig.coreWriteClient;
  }

  if (runtimeConfig.apiBaseUrl) {
    return createBirdCoderGeneratedCoreWriteApiClient({
      transport: createBirdCoderHttpApiTransport({
        baseUrl: runtimeConfig.apiBaseUrl,
        resolveHeaders: resolveRuntimeServerSessionHeaders,
        timeoutMs: DEFAULT_RUNTIME_HTTP_API_TIMEOUT_MS,
      }),
    });
  }

  return undefined;
}

function resolveRuntimeUserCenterClient(): BirdCoderUserCenterApiClient | undefined {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  if (!runtimeConfig.apiBaseUrl) {
    return undefined;
  }

  return createBirdCoderGeneratedUserCenterApiClient({
    transport: createBirdCoderHttpApiTransport({
      baseUrl: runtimeConfig.apiBaseUrl,
      resolveHeaders: resolveRuntimeServerSessionHeaders,
      timeoutMs: DEFAULT_RUNTIME_USER_CENTER_TIMEOUT_MS,
    }),
  });
}

function createUnavailableBirdCoderAppAdminClient(): BirdCoderAppAdminApiClient {
  return createBirdCoderGeneratedAppAdminApiClient({
    transport: {
      async request(request) {
        throw new Error(
          `BirdCoder app/admin runtime client is unavailable. Configure a real server API base URL or explicit generated app/admin client before using ${request.method} ${request.path}.`,
        );
      },
    },
  });
}

export function createInProcessBirdCoderAppAdminClient(
  queries: ReturnType<typeof createBirdCoderAppAdminConsoleQueries>,
): BirdCoderAppAdminApiClient {
  return createBirdCoderGeneratedAppAdminApiClient({
    transport: createBirdCoderInProcessAppAdminApiTransport({
      queries,
    }),
  });
}

export function createDefaultBirdCoderIdeServices(
  options: CreateBirdCoderDefaultIdeServicesOptions = {},
): BirdCoderDefaultIdeServices {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  assertBrowserRuntimeApiConfigured(runtimeConfig, options);
  const provider = options.storageProvider ?? createBirdCoderStorageProvider('sqlite');
  const repositories = createBirdCoderConsoleRepositories({
    providerId: provider.providerId,
    storage: provider,
  });
  const codingSessionRepositories = createBirdCoderCodingSessionRepositories({
    providerId: provider.providerId,
    storage: provider,
  });
  const promptSkillTemplateEvidenceRepositories =
    createBirdCoderPromptSkillTemplateEvidenceRepositories({
      providerId: provider.providerId,
      storage: provider,
    });
  const hasBoundAppAdminClient = Boolean(
    options.appAdminClient || runtimeConfig.appAdminClient || runtimeConfig.apiBaseUrl,
  );
  const appAdminClient =
    options.appAdminClient ??
    resolveRuntimeAppAdminClient() ??
    createUnavailableBirdCoderAppAdminClient();
  const providerBackedWorkspaceService = new ProviderBackedWorkspaceService({
    repository: repositories.workspaces,
  });
  const providerBackedProjectService = new ProviderBackedProjectService({
    codingSessionRepositories,
    evidenceRepositories: promptSkillTemplateEvidenceRepositories,
    repository: repositories.projects,
  });
  const resolvedCoreReadClient = options.coreReadClient ?? resolveRuntimeCoreReadClient();
  const resolvedCoreWriteClient = options.coreWriteClient ?? resolveRuntimeCoreWriteClient();
  const inProcessCoreTransport =
    resolvedCoreReadClient && resolvedCoreWriteClient
      ? undefined
      : createBirdCoderInProcessCoreApiTransport({
          projectService: providerBackedProjectService,
        });
  const coreReadClient =
    resolvedCoreReadClient ??
    createBirdCoderGeneratedCoreReadApiClient({
      transport: inProcessCoreTransport!,
    });
  const coreWriteClient =
    resolvedCoreWriteClient ??
    createBirdCoderGeneratedCoreWriteApiClient({
      transport: inProcessCoreTransport!,
    });
  const authService = new RuntimeAuthService({
    client: resolveRuntimeUserCenterClient(),
  });
  const workspaceService = hasBoundAppAdminClient
    ? new ApiBackedWorkspaceService({
        client: appAdminClient,
        identityProvider: authService,
        workspaceMirror: providerBackedWorkspaceService,
        writeService: providerBackedWorkspaceService,
      })
    : providerBackedWorkspaceService;
  const projectService = hasBoundAppAdminClient
    ? new ApiBackedProjectService({
        client: appAdminClient,
        codingSessionMirror: providerBackedProjectService,
        coreReadClient,
        coreWriteClient,
        identityProvider: authService,
        projectMirror: providerBackedProjectService,
        writeService: providerBackedProjectService,
      })
    : providerBackedProjectService;

  return {
    adminDeploymentService: new ApiBackedAdminDeploymentService({
      client: appAdminClient,
    }),
    adminPolicyService: new ApiBackedAdminPolicyService({
      client: appAdminClient,
    }),
    authService,
    auditService: new ApiBackedAuditService({
      client: appAdminClient,
    }),
    catalogService: new ApiBackedCatalogService({
      client: appAdminClient,
    }),
    collaborationService: new ApiBackedCollaborationService({
      client: appAdminClient,
      identityProvider: authService,
    }),
    coreReadService: new ApiBackedCoreReadService({
      client: coreReadClient,
      identityProvider: authService,
    }),
    coreWriteService: new ApiBackedCoreWriteService({
      client: coreWriteClient,
    }),
    deploymentService: new ApiBackedDeploymentService({
      client: appAdminClient,
    }),
    documentService: new ApiBackedDocumentService({
      client: appAdminClient,
    }),
    fileSystemService: new RuntimeFileSystemService(),
    projectService,
    releaseService: new ApiBackedReleaseService({
      client: appAdminClient,
    }),
    teamService: new ApiBackedTeamService({
      client: appAdminClient,
      identityProvider: authService,
    }),
    workspaceService,
  };
}
