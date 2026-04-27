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
import { createBirdCoderSavedPromptEntryRepository } from '../storage/savedPromptEntryRepository.ts';
import { createBirdCoderAppAdminConsoleQueries } from './appAdminConsoleQueries.ts';
import {
  createBirdCoderHttpApiTransport,
  createBirdCoderInProcessAppAdminApiTransport,
} from './appAdminApiClient.ts';
import { createBirdCoderInProcessCoreApiTransport } from './coreApiClient.ts';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import { ProviderBackedProjectService } from './impl/ProviderBackedProjectService.ts';
import { ProviderBackedPromptService } from './impl/ProviderBackedPromptService.ts';
import { ProviderBackedWorkspaceService } from './impl/ProviderBackedWorkspaceService.ts';
import { createBirdCoderRuntimeAuthService } from './impl/RuntimeAuthService.ts';
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
import type { IGitService } from './interfaces/IGitService.ts';
import type { IPromptService } from './interfaces/IPromptService.ts';
import type { IProjectService } from './interfaces/IProjectService.ts';
import type { IReleaseService } from './interfaces/IReleaseService.ts';
import type { ITeamService } from './interfaces/ITeamService.ts';
import type { IWorkspaceService } from './interfaces/IWorkspaceService.ts';
import { resolveRuntimeServerSessionHeaders } from './runtimeServerSession.ts';

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
  gitService: IGitService;
  promptService: IPromptService;
  projectService: IProjectService;
  releaseService: IReleaseService;
  teamService: ITeamService;
  workspaceService: IWorkspaceService;
}

export type BirdCoderDefaultIdeServiceKey = keyof BirdCoderDefaultIdeServices;

export interface CreateBirdCoderDefaultIdeServicesOptions {
  appAdminClient?: BirdCoderAppAdminApiClient;
  coreReadClient?: BirdCoderCoreReadApiClient;
  coreWriteClient?: BirdCoderCoreWriteApiClient;
  storageProvider?: BirdCoderTransactionalStorageProvider;
}

export interface BirdCoderDefaultIdeSharedRuntime {
  appAdminClient: BirdCoderAppAdminApiClient;
  authService: IAuthService;
  coreReadClient: BirdCoderCoreReadApiClient;
  coreWriteClient: BirdCoderCoreWriteApiClient;
  hasBoundAppAdminClient: boolean;
  promptService: ProviderBackedPromptService;
  providerBackedProjectService: ProviderBackedProjectService;
  providerBackedWorkspaceService: ProviderBackedWorkspaceService;
}

const DEFAULT_RUNTIME_HTTP_API_TIMEOUT_MS = 20_000;
const DEFAULT_RUNTIME_USER_CENTER_TIMEOUT_MS = 20_000;

function isBrowserRuntime(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function hasConfiguredRemoteAppAdminAccess(
  runtimeConfig: ReturnType<typeof getDefaultBirdCoderIdeServicesRuntimeConfig>,
  options: CreateBirdCoderDefaultIdeServicesOptions,
): boolean {
  return Boolean(
    options.appAdminClient ||
      runtimeConfig.appAdminClient ||
      runtimeConfig.apiBaseUrl,
  );
}

function hasConfiguredRemoteCoreAccess(
  runtimeConfig: ReturnType<typeof getDefaultBirdCoderIdeServicesRuntimeConfig>,
  options: CreateBirdCoderDefaultIdeServicesOptions,
): boolean {
  return Boolean(
    runtimeConfig.apiBaseUrl ||
      ((options.coreReadClient || runtimeConfig.coreReadClient) &&
        (options.coreWriteClient || runtimeConfig.coreWriteClient)),
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
  if (!hasConfiguredRemoteAppAdminAccess(runtimeConfig, options)) {
    missingBoundaries.push('app/admin');
  }
  if (!hasConfiguredRemoteCoreAccess(runtimeConfig, options)) {
    missingBoundaries.push('core read/write');
  }
  if (missingBoundaries.length === 0) {
    return;
  }

  const runtimeLabel = isBrowserRuntime() ? 'BirdCoder browser runtime' : 'BirdCoder runtime';
  throw new Error(
    `${runtimeLabel} requires authoritative remote API composition. Missing ${missingBoundaries.join(' and ')} bindings. Configure apiBaseUrl or explicit generated API clients before bootstrapping IDE services.`,
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

function createInProcessBirdCoderAppAdminClient(
  queries: ReturnType<typeof createBirdCoderAppAdminConsoleQueries>,
): BirdCoderAppAdminApiClient {
  return createBirdCoderGeneratedAppAdminApiClient({
    transport: createBirdCoderInProcessAppAdminApiTransport({
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
  const hasBoundAppAdminClient = hasConfiguredRemoteAppAdminAccess(runtimeConfig, options);
  const appAdminClient =
    options.appAdminClient ??
    resolveRuntimeAppAdminClient() ??
    createUnavailableBirdCoderAppAdminClient();
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
  const resolvedCoreReadClient = options.coreReadClient ?? resolveRuntimeCoreReadClient();
  const resolvedCoreWriteClient = options.coreWriteClient ?? resolveRuntimeCoreWriteClient();
  const inProcessCoreTransport =
    resolvedCoreReadClient && resolvedCoreWriteClient
      ? undefined
      : runtimeConfig.executionAuthorityMode === 'remote-required'
        ? undefined
        : createBirdCoderInProcessCoreApiTransport({
            projectService: providerBackedProjectService,
          });
  if (!resolvedCoreReadClient && !inProcessCoreTransport) {
    throw new Error(
      'BirdCoder runtime is missing authoritative core read access. Configure apiBaseUrl or an explicit generated core read client.',
    );
  }
  if (!resolvedCoreWriteClient && !inProcessCoreTransport) {
    throw new Error(
      'BirdCoder runtime is missing authoritative core write access. Configure apiBaseUrl or an explicit generated core write client.',
    );
  }

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
  const authService = createBirdCoderRuntimeAuthService({
    client: resolveRuntimeUserCenterClient(),
  });

  return {
    appAdminClient,
    authService,
    coreReadClient,
    coreWriteClient,
    hasBoundAppAdminClient,
    promptService,
    providerBackedProjectService,
    providerBackedWorkspaceService,
  };
}
