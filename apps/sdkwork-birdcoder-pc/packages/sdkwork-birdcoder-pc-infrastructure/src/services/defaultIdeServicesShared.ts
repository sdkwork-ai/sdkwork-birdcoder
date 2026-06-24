import {
  createBirdCoderStorageProvider,
  type BirdCoderTransactionalStorageProvider,
} from '../storage/dataKernel.ts';
import { createBirdCoderConsoleRepositories } from '../storage/appConsoleRepository.ts';
import { createBirdCoderCodingSessionRepositories } from '../storage/codingSessionRepository.ts';
import { createBirdCoderPromptSkillTemplateEvidenceRepositories } from '../storage/promptSkillTemplateEvidenceRepository.ts';
import { createBirdCoderSavedPromptEntryRepository } from '../storage/savedPromptEntryRepository.ts';
import { createBirdCoderConsoleQueries } from './consoleQueries.ts';
import { createBirdCoderInProcessAppSdkTransport } from './appSdkTransport.ts';
import { createBirdCoderInProcessBackendSdkTransport } from './backendSdkTransport.ts';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import { ProviderBackedProjectService } from './impl/ProviderBackedProjectService.ts';
import { ProviderBackedPromptService } from './impl/ProviderBackedPromptService.ts';
import { ProviderBackedWorkspaceService } from './impl/ProviderBackedWorkspaceService.ts';
import { createBirdCoderRuntimeAuthService } from './impl/RuntimeAuthService.ts';
import type { IAuthService } from './interfaces/IAuthService.ts';
import type {
  IAdminDeploymentService,
  IAdminPolicyService,
  IAuditService,
} from '@sdkwork/birdcoder-pc-admin-core';
import type { ICatalogService } from './interfaces/ICatalogService.ts';
import type { ICollaborationService } from './interfaces/ICollaborationService.ts';
import type { IAppRuntimeReadService } from './interfaces/IAppRuntimeReadService.ts';
import type { IAppRuntimeWriteService } from './interfaces/IAppRuntimeWriteService.ts';
import type { IDeploymentService } from './interfaces/IDeploymentService.ts';
import type { IDocumentService } from './interfaces/IDocumentService.ts';
import type { IFileSystemService } from './interfaces/IFileSystemService.ts';
import type { IGitService } from './interfaces/IGitService.ts';
import type { IPromptService } from './interfaces/IPromptService.ts';
import type { IProjectService } from './interfaces/IProjectService.ts';
import type { IReleaseService } from './interfaces/IReleaseService.ts';
import type { ITeamService } from './interfaces/ITeamService.ts';
import type { IVipMembershipService } from './interfaces/IVipMembershipService.ts';
import type { IWorkspaceService } from './interfaces/IWorkspaceService.ts';
import { resolveRuntimeServerSessionHeaders } from './runtimeServerSession.ts';
import {
  createBirdCoderAppSdkApiClient,
  createBirdCoderBackendSdkApiClient,
  type BirdCoderAppRuntimeReadSdkApiClient,
  type BirdCoderAppRuntimeSdkApiClient,
  type BirdCoderAppRuntimeWriteSdkApiClient,
  type BirdCoderAppSdkApiClient,
  type BirdCoderBackendSdkApiClient,
} from './sdkClients.ts';
import { createBirdCoderHttpApiTransport } from './sdkTransportShared.ts';

export interface BirdCoderDefaultIdeServices {
  adminDeploymentService: IAdminDeploymentService;
  adminPolicyService: IAdminPolicyService;
  authService: IAuthService;
  auditService: IAuditService;
  catalogService: ICatalogService;
  collaborationService: ICollaborationService;
  appRuntimeReadService: IAppRuntimeReadService;
  appRuntimeWriteService: IAppRuntimeWriteService;
  deploymentService: IDeploymentService;
  documentService: IDocumentService;
  fileSystemService: IFileSystemService;
  gitService: IGitService;
  promptService: IPromptService;
  projectService: IProjectService;
  releaseService: IReleaseService;
  teamService: ITeamService;
  vipMembershipService: IVipMembershipService;
  workspaceService: IWorkspaceService;
}

export type BirdCoderDefaultIdeServiceKey = keyof BirdCoderDefaultIdeServices;

export interface CreateBirdCoderDefaultIdeServicesOptions {
  appClient?: BirdCoderAppSdkApiClient;
  appRuntimeClient?:
    | BirdCoderAppRuntimeReadSdkApiClient
    | BirdCoderAppRuntimeSdkApiClient
    | BirdCoderAppRuntimeWriteSdkApiClient;
  backendClient?: BirdCoderBackendSdkApiClient;
  storageProvider?: BirdCoderTransactionalStorageProvider;
}

export interface BirdCoderDefaultIdeSharedRuntime {
  appClient: BirdCoderAppSdkApiClient;
  appRuntimeClient: BirdCoderAppRuntimeSdkApiClient;
  authService: IAuthService;
  backendClient: BirdCoderBackendSdkApiClient;
  hasBoundAppClient: boolean;
  hasBoundBackendClient: boolean;
  hasExplicitBackendClient: boolean;
  promptService: ProviderBackedPromptService;
  providerBackedProjectService: ProviderBackedProjectService;
  providerBackedWorkspaceService: ProviderBackedWorkspaceService;
}

const DEFAULT_RUNTIME_HTTP_API_TIMEOUT_MS = 20_000;

function isBrowserRuntime(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function hasConfiguredRemoteAppAccess(
  runtimeConfig: ReturnType<typeof getDefaultBirdCoderIdeServicesRuntimeConfig>,
  options: CreateBirdCoderDefaultIdeServicesOptions,
): boolean {
  return Boolean(
    options.appClient ||
      options.appRuntimeClient ||
      runtimeConfig.appClient ||
      runtimeConfig.apiBaseUrl,
  );
}

function hasConfiguredRemoteBackendAccess(
  runtimeConfig: ReturnType<typeof getDefaultBirdCoderIdeServicesRuntimeConfig>,
  options: CreateBirdCoderDefaultIdeServicesOptions,
): boolean {
  return Boolean(
    options.backendClient ||
      runtimeConfig.backendClient ||
      runtimeConfig.apiBaseUrl,
  );
}

function assertRuntimeAuthorityConfigured(
  runtimeConfig: ReturnType<typeof getDefaultBirdCoderIdeServicesRuntimeConfig>,
  options: CreateBirdCoderDefaultIdeServicesOptions,
): void {
  const requiresRemoteAuthority =
    isBrowserRuntime() || runtimeConfig.executionAuthorityMode === 'remote-required';
  if (!requiresRemoteAuthority) {
    return;
  }

  const missingBoundaries: string[] = [];
  if (!hasConfiguredRemoteAppAccess(runtimeConfig, options)) {
    missingBoundaries.push('app SDK');
  }
  if (
    !isBrowserRuntime()
    && !hasConfiguredRemoteBackendAccess(runtimeConfig, options)
  ) {
    missingBoundaries.push('backend SDK');
  }
  if (missingBoundaries.length === 0) {
    return;
  }

  const runtimeLabel = isBrowserRuntime() ? 'BirdCoder browser runtime' : 'BirdCoder runtime';
  throw new Error(
    `${runtimeLabel} requires authoritative remote API composition. Missing ${missingBoundaries.join(' and ')} bindings. Configure apiBaseUrl or explicit generated API clients before bootstrapping IDE services.`,
  );
}

function resolveRuntimeAppClient(): BirdCoderAppSdkApiClient | undefined {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  if (runtimeConfig.appClient) {
    return runtimeConfig.appClient;
  }

  if (runtimeConfig.apiBaseUrl) {
    return createBirdCoderAppSdkApiClient({
      transport: createBirdCoderHttpApiTransport({
        baseUrl: runtimeConfig.apiBaseUrl,
        resolveHeaders: resolveRuntimeServerSessionHeaders,
        timeoutMs: DEFAULT_RUNTIME_HTTP_API_TIMEOUT_MS,
      }),
    });
  }

  return undefined;
}

function resolveRuntimeBackendClient(): BirdCoderBackendSdkApiClient | undefined {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  if (runtimeConfig.backendClient) {
    return runtimeConfig.backendClient;
  }

  if (runtimeConfig.apiBaseUrl) {
    return createBirdCoderBackendSdkApiClient({
      transport: createBirdCoderHttpApiTransport({
        baseUrl: runtimeConfig.apiBaseUrl,
        resolveHeaders: resolveRuntimeServerSessionHeaders,
        timeoutMs: DEFAULT_RUNTIME_HTTP_API_TIMEOUT_MS,
      }),
    });
  }

  return undefined;
}

function createUnavailableBirdCoderAppClient(): BirdCoderAppSdkApiClient {
  return createBirdCoderAppSdkApiClient({
    transport: {
      async request(request) {
        throw new Error(
          `BirdCoder app runtime client is unavailable. Configure a real server API base URL or explicit app SDK client before using ${request.method} ${request.path}.`,
        );
      },
    },
  });
}

function createUnavailableBirdCoderBackendClient(): BirdCoderBackendSdkApiClient {
  return createBirdCoderBackendSdkApiClient({
    transport: {
      async request(request) {
        throw new Error(
          `BirdCoder backend runtime client is unavailable. Configure a real server API base URL or explicit backend SDK client before using ${request.method} ${request.path}.`,
        );
      },
    },
  });
}

function createInProcessBirdCoderAppClient(
  queries: ReturnType<typeof createBirdCoderConsoleQueries>,
  projectService: ProviderBackedProjectService,
): BirdCoderAppSdkApiClient {
  return createBirdCoderAppSdkApiClient({
    transport: createBirdCoderInProcessAppSdkTransport({
      projectService,
      queries,
    }),
  });
}

function createInProcessBirdCoderBackendClient(
  queries: ReturnType<typeof createBirdCoderConsoleQueries>,
): BirdCoderBackendSdkApiClient {
  return createBirdCoderBackendSdkApiClient({
    transport: createBirdCoderInProcessBackendSdkTransport({
      queries,
    }),
  });
}

export function createBirdCoderDefaultIdeSharedRuntime(
  options: CreateBirdCoderDefaultIdeServicesOptions = {},
): BirdCoderDefaultIdeSharedRuntime {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  assertRuntimeAuthorityConfigured(runtimeConfig, options);

  const storageProvider = options.storageProvider ?? createBirdCoderStorageProvider('sqlite');
  const repositories = createBirdCoderConsoleRepositories({
    providerId: storageProvider.providerId,
    storage: storageProvider,
  });
  const queries = createBirdCoderConsoleQueries({ repositories });
  const codingSessionRepositories = createBirdCoderCodingSessionRepositories({
    providerId: storageProvider.providerId,
    storage: storageProvider,
  });
  const promptSkillTemplateEvidenceRepositories =
    createBirdCoderPromptSkillTemplateEvidenceRepositories({
      providerId: storageProvider.providerId,
      storage: storageProvider,
    });
  const savedPromptRepository = createBirdCoderSavedPromptEntryRepository({
    providerId: storageProvider.providerId,
    storage: storageProvider,
  });
  const promptService = new ProviderBackedPromptService({
    savedPromptRepository,
    sessionPromptHistoryRepository: codingSessionRepositories.promptEntries,
  });
  const providerBackedWorkspaceService = new ProviderBackedWorkspaceService({
    repository: repositories.workspaces,
  });
  const providerBackedProjectService = new ProviderBackedProjectService({
    codingSessionRepositories,
    evidenceRepositories: promptSkillTemplateEvidenceRepositories,
    projectContentRepository: repositories.projectContents,
    repository: repositories.projects,
  });
  const hasBoundAppClient = hasConfiguredRemoteAppAccess(runtimeConfig, options);
  const hasBoundBackendClient = hasConfiguredRemoteBackendAccess(runtimeConfig, options);
  const hasExplicitBackendClient = Boolean(
    options.backendClient || runtimeConfig.backendClient,
  );
  const appClient =
    options.appClient ??
    resolveRuntimeAppClient() ??
    (runtimeConfig.executionAuthorityMode === 'remote-required'
      ? createUnavailableBirdCoderAppClient()
      : createInProcessBirdCoderAppClient(queries, providerBackedProjectService));
  const appRuntimeClient = options.appRuntimeClient
    ? ({
        ...appClient,
        ...options.appRuntimeClient,
      } as BirdCoderAppRuntimeSdkApiClient)
    : appClient;
  const backendClient =
    options.backendClient ??
    resolveRuntimeBackendClient() ??
    (hasExplicitBackendClient
      ? runtimeConfig.executionAuthorityMode === 'remote-required'
        ? createUnavailableBirdCoderBackendClient()
        : createInProcessBirdCoderBackendClient(queries)
      : createUnavailableBirdCoderBackendClient());
  const authService = createBirdCoderRuntimeAuthService();

  return {
    appClient,
    appRuntimeClient,
    authService,
    backendClient,
    hasBoundAppClient,
    hasBoundBackendClient,
    hasExplicitBackendClient,
    promptService,
    providerBackedProjectService,
    providerBackedWorkspaceService,
  };
}
