import {
  createBirdCoderGeneratedAppAdminApiClient,
  createBirdCoderGeneratedCoreReadApiClient,
  createBirdCoderGeneratedCoreWriteApiClient,
  type BirdCoderAppAdminApiClient,
  type BirdCoderCoreReadApiClient,
  type BirdCoderCoreWriteApiClient,
} from '@sdkwork/birdcoder-types';
import { createBirdCoderAppAdminConsoleQueries } from './appAdminConsoleQueries.ts';
import {
  createBirdCoderHttpApiTransport,
  createBirdCoderInProcessAppAdminApiTransport,
} from './appAdminApiClient.ts';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
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
import {
  createBirdCoderDefaultIdeSharedRuntime,
  type BirdCoderDefaultIdeServices,
  type CreateBirdCoderDefaultIdeServicesOptions,
} from './defaultIdeServicesShared.ts';
import { resolveRuntimeServerSessionHeaders } from './runtimeServerSession.ts';

export {
  type BirdCoderDefaultIdeServices,
  type CreateBirdCoderDefaultIdeServicesOptions,
} from './defaultIdeServicesShared.ts';

const DEFAULT_RUNTIME_HTTP_API_TIMEOUT_MS = 20_000;

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
  const runtime = createBirdCoderDefaultIdeSharedRuntime(options);
  const appAdminClient =
    runtime.appAdminClient ??
    resolveRuntimeAppAdminClient() ??
    createUnavailableBirdCoderAppAdminClient();
  const coreReadClient = runtime.coreReadClient ?? resolveRuntimeCoreReadClient();
  const coreWriteClient = runtime.coreWriteClient ?? resolveRuntimeCoreWriteClient();
  const workspaceService = runtime.hasBoundAppAdminClient
    ? new ApiBackedWorkspaceService({
        client: appAdminClient,
        identityProvider: runtime.authService,
        workspaceMirror: runtime.providerBackedWorkspaceService,
        writeService: runtime.providerBackedWorkspaceService,
      })
    : runtime.providerBackedWorkspaceService;
  const projectService = runtime.hasBoundAppAdminClient
    ? new ApiBackedProjectService({
        client: appAdminClient,
        codingSessionMirror: runtime.providerBackedProjectService,
        coreReadClient: coreReadClient ?? runtime.coreReadClient,
        coreWriteClient: coreWriteClient ?? runtime.coreWriteClient,
        identityProvider: runtime.authService,
        projectMirror: runtime.providerBackedProjectService,
        writeService: runtime.providerBackedProjectService,
      })
    : runtime.providerBackedProjectService;

  return {
    adminDeploymentService: new ApiBackedAdminDeploymentService({
      client: appAdminClient,
    }),
    adminPolicyService: new ApiBackedAdminPolicyService({
      client: appAdminClient,
    }),
    authService: runtime.authService,
    auditService: new ApiBackedAuditService({
      client: appAdminClient,
    }),
    catalogService: new ApiBackedCatalogService({
      client: appAdminClient,
    }),
    collaborationService: new ApiBackedCollaborationService({
      client: appAdminClient,
      identityProvider: runtime.authService,
    }),
    coreReadService: new ApiBackedCoreReadService({
      client: coreReadClient ?? runtime.coreReadClient,
      identityProvider: runtime.authService,
    }),
    coreWriteService: new ApiBackedCoreWriteService({
      client: coreWriteClient ?? runtime.coreWriteClient,
    }),
    deploymentService: new ApiBackedDeploymentService({
      client: appAdminClient,
    }),
    documentService: new ApiBackedDocumentService({
      client: appAdminClient,
    }),
    fileSystemService: new RuntimeFileSystemService(),
    gitService: new ApiBackedGitService({
      client: appAdminClient,
    }),
    promptService: runtime.promptService,
    projectService,
    releaseService: new ApiBackedReleaseService({
      client: appAdminClient,
    }),
    teamService: new ApiBackedTeamService({
      client: appAdminClient,
      identityProvider: runtime.authService,
    }),
    workspaceService,
  };
}
