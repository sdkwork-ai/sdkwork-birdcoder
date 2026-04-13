import {
  createBirdCoderGeneratedAppAdminApiClient,
  createBirdCoderGeneratedCoreReadApiClient,
  createBirdCoderGeneratedCoreWriteApiClient,
  type BirdCoderAppAdminApiClient,
  type BirdCoderCoreReadApiClient,
  type BirdCoderCoreWriteApiClient,
} from '@sdkwork/birdcoder-types';
import type { BirdHostDescriptor } from '@sdkwork/birdcoder-host-core';
import {
  createBirdCoderStorageProvider,
  type BirdCoderTransactionalStorageProvider,
} from '../storage/dataKernel.ts';
import { createBirdCoderConsoleRepositories } from '../storage/appConsoleRepository.ts';
import { createBirdCoderPromptSkillTemplateEvidenceRepositories } from '../storage/promptSkillTemplateEvidenceRepository.ts';
import { createBirdCoderAppAdminConsoleQueries } from './appAdminConsoleQueries.ts';
import {
  createBirdCoderHttpApiTransport,
  createBirdCoderInProcessAppAdminApiTransport,
} from './appAdminApiClient.ts';
import { MockAuthService } from './impl/MockAuthService.ts';
import { ApiBackedAdminDeploymentService } from './impl/ApiBackedAdminDeploymentService.ts';
import { ApiBackedAdminPolicyService } from './impl/ApiBackedAdminPolicyService.ts';
import { ApiBackedAuditService } from './impl/ApiBackedAuditService.ts';
import { ApiBackedCoreReadService } from './impl/ApiBackedCoreReadService.ts';
import { ApiBackedCoreWriteService } from './impl/ApiBackedCoreWriteService.ts';
import { ApiBackedDeploymentService } from './impl/ApiBackedDeploymentService.ts';
import { ApiBackedDocumentService } from './impl/ApiBackedDocumentService.ts';
import { MockFileSystemService } from './impl/MockFileSystemService.ts';
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
import type { ICoreReadService } from './interfaces/ICoreReadService.ts';
import type { ICoreWriteService } from './interfaces/ICoreWriteService.ts';
import type { IDeploymentService } from './interfaces/IDeploymentService.ts';
import type { IDocumentService } from './interfaces/IDocumentService.ts';
import type { IFileSystemService } from './interfaces/IFileSystemService.ts';
import type { IProjectService } from './interfaces/IProjectService.ts';
import type { IReleaseService } from './interfaces/IReleaseService.ts';
import type { ITeamService } from './interfaces/ITeamService.ts';
import type { IWorkspaceService } from './interfaces/IWorkspaceService.ts';

export interface BirdCoderDefaultIdeServices {
  adminDeploymentService: IAdminDeploymentService;
  adminPolicyService: IAdminPolicyService;
  authService: IAuthService;
  auditService: IAuditService;
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

export interface BirdCoderDefaultIdeServicesRuntimeConfig {
  apiBaseUrl?: string;
  appAdminClient?: BirdCoderAppAdminApiClient;
  coreReadClient?: BirdCoderCoreReadApiClient;
  coreWriteClient?: BirdCoderCoreWriteApiClient;
}

export interface BindDefaultBirdCoderIdeServicesRuntimeOptions {
  apiBaseUrl?: string;
  appAdminClient?: BirdCoderAppAdminApiClient;
  coreReadClient?: BirdCoderCoreReadApiClient;
  coreWriteClient?: BirdCoderCoreWriteApiClient;
  host?: BirdHostDescriptor;
}

let defaultIdeServicesRuntimeConfig: BirdCoderDefaultIdeServicesRuntimeConfig = {};

function normalizeApiBaseUrl(apiBaseUrl?: string): string | undefined {
  const normalizedApiBaseUrl = apiBaseUrl?.trim();
  return normalizedApiBaseUrl ? normalizedApiBaseUrl : undefined;
}

function resolveBoundApiBaseUrl(
  options: BindDefaultBirdCoderIdeServicesRuntimeOptions,
): string | undefined {
  const explicitApiBaseUrl = normalizeApiBaseUrl(options.apiBaseUrl);
  if (explicitApiBaseUrl) {
    return explicitApiBaseUrl;
  }

  return normalizeApiBaseUrl(options.host?.apiBaseUrl);
}

function resolveRuntimeAppAdminClient(): BirdCoderAppAdminApiClient | undefined {
  if (defaultIdeServicesRuntimeConfig.appAdminClient) {
    return defaultIdeServicesRuntimeConfig.appAdminClient;
  }

  if (defaultIdeServicesRuntimeConfig.apiBaseUrl) {
    return createBirdCoderGeneratedAppAdminApiClient({
      transport: createBirdCoderHttpApiTransport({
        baseUrl: defaultIdeServicesRuntimeConfig.apiBaseUrl,
      }),
    });
  }

  return undefined;
}

function resolveRuntimeCoreReadClient(): BirdCoderCoreReadApiClient | undefined {
  if (defaultIdeServicesRuntimeConfig.coreReadClient) {
    return defaultIdeServicesRuntimeConfig.coreReadClient;
  }

  if (defaultIdeServicesRuntimeConfig.apiBaseUrl) {
    return createBirdCoderGeneratedCoreReadApiClient({
      transport: createBirdCoderHttpApiTransport({
        baseUrl: defaultIdeServicesRuntimeConfig.apiBaseUrl,
      }),
    });
  }

  return undefined;
}

function resolveRuntimeCoreWriteClient(): BirdCoderCoreWriteApiClient | undefined {
  if (defaultIdeServicesRuntimeConfig.coreWriteClient) {
    return defaultIdeServicesRuntimeConfig.coreWriteClient;
  }

  if (defaultIdeServicesRuntimeConfig.apiBaseUrl) {
    return createBirdCoderGeneratedCoreWriteApiClient({
      transport: createBirdCoderHttpApiTransport({
        baseUrl: defaultIdeServicesRuntimeConfig.apiBaseUrl,
      }),
    });
  }

  return undefined;
}

function createUnavailableBirdCoderCoreReadClient(): BirdCoderCoreReadApiClient {
  const createUnavailableError = () =>
    new Error('Core read service requires a bound coding-server runtime or an injected coreReadClient.');

  return {
    async getCodingSession() {
      throw createUnavailableError();
    },
    async getDescriptor() {
      throw createUnavailableError();
    },
    async getEngineCapabilities() {
      throw createUnavailableError();
    },
    async getHealth() {
      throw createUnavailableError();
    },
    async getOperation() {
      throw createUnavailableError();
    },
    async getRuntime() {
      throw createUnavailableError();
    },
    async listCodingSessionArtifacts() {
      throw createUnavailableError();
    },
    async listCodingSessionCheckpoints() {
      throw createUnavailableError();
    },
    async listCodingSessionEvents() {
      throw createUnavailableError();
    },
    async listEngines() {
      throw createUnavailableError();
    },
    async listModels() {
      throw createUnavailableError();
    },
  };
}

function createUnavailableBirdCoderCoreWriteClient(): BirdCoderCoreWriteApiClient {
  const createUnavailableError = () =>
    new Error('Core write service requires a bound coding-server runtime or an injected coreWriteClient.');

  return {
    async createCodingSession() {
      throw createUnavailableError();
    },
    async createCodingSessionTurn() {
      throw createUnavailableError();
    },
    async submitApprovalDecision() {
      throw createUnavailableError();
    },
  };
}

export function configureDefaultBirdCoderIdeServicesRuntime(
  config: BirdCoderDefaultIdeServicesRuntimeConfig = {},
): void {
  defaultIdeServicesRuntimeConfig = {
    appAdminClient: config.appAdminClient,
    coreReadClient: config.coreReadClient,
    coreWriteClient: config.coreWriteClient,
    apiBaseUrl: normalizeApiBaseUrl(config.apiBaseUrl),
  };
}

export function bindDefaultBirdCoderIdeServicesRuntime(
  options: BindDefaultBirdCoderIdeServicesRuntimeOptions = {},
): void {
  configureDefaultBirdCoderIdeServicesRuntime({
    appAdminClient: options.appAdminClient,
    coreReadClient: options.coreReadClient,
    coreWriteClient: options.coreWriteClient,
    apiBaseUrl: resolveBoundApiBaseUrl(options),
  });
}

export function resetDefaultBirdCoderIdeServicesRuntimeForTests(): void {
  defaultIdeServicesRuntimeConfig = {};
}

export function createDefaultBirdCoderIdeServices(
  options: CreateBirdCoderDefaultIdeServicesOptions = {},
): BirdCoderDefaultIdeServices {
  const provider = options.storageProvider ?? createBirdCoderStorageProvider('sqlite');
  const repositories = createBirdCoderConsoleRepositories({
    providerId: provider.providerId,
    storage: provider,
  });
  const promptSkillTemplateEvidenceRepositories =
    createBirdCoderPromptSkillTemplateEvidenceRepositories({
      providerId: provider.providerId,
      storage: provider,
    });
  const queries = createBirdCoderAppAdminConsoleQueries({
    repositories,
  });
  const appAdminClient =
    options.appAdminClient ??
    resolveRuntimeAppAdminClient() ??
    createBirdCoderGeneratedAppAdminApiClient({
      transport: createBirdCoderInProcessAppAdminApiTransport({
        queries,
      }),
    });
  const coreReadClient =
    options.coreReadClient ??
    resolveRuntimeCoreReadClient() ??
    createUnavailableBirdCoderCoreReadClient();
  const coreWriteClient = options.coreWriteClient ?? resolveRuntimeCoreWriteClient();
  const exposedCoreWriteClient = coreWriteClient ?? createUnavailableBirdCoderCoreWriteClient();
  const providerBackedWorkspaceService = new ProviderBackedWorkspaceService({
    repository: repositories.workspaces,
  });
  const providerBackedProjectService = new ProviderBackedProjectService({
    evidenceRepositories: promptSkillTemplateEvidenceRepositories,
    repository: repositories.projects,
  });

  return {
    adminDeploymentService: new ApiBackedAdminDeploymentService({
      client: appAdminClient,
    }),
    adminPolicyService: new ApiBackedAdminPolicyService({
      client: appAdminClient,
    }),
    authService: new MockAuthService(),
    auditService: new ApiBackedAuditService({
      client: appAdminClient,
    }),
    coreReadService: new ApiBackedCoreReadService({
      client: coreReadClient,
    }),
    coreWriteService: new ApiBackedCoreWriteService({
      client: exposedCoreWriteClient,
    }),
    deploymentService: new ApiBackedDeploymentService({
      client: appAdminClient,
    }),
    documentService: new ApiBackedDocumentService({
      client: appAdminClient,
    }),
    fileSystemService: new MockFileSystemService(),
    projectService: new ApiBackedProjectService({
      client: appAdminClient,
      codingSessionMirror: providerBackedProjectService,
      coreWriteClient,
      writeService: providerBackedProjectService,
    }),
    releaseService: new ApiBackedReleaseService({
      client: appAdminClient,
    }),
    teamService: new ApiBackedTeamService({
      client: appAdminClient,
    }),
    workspaceService: new ApiBackedWorkspaceService({
      client: appAdminClient,
      writeService: providerBackedWorkspaceService,
    }),
  };
}
