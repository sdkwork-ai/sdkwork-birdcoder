import { createBirdCoderConsoleQueries } from './consoleQueries.ts';
import { createBirdCoderInProcessAppSdkTransport } from './appSdkTransport.ts';
import { createBirdCoderInProcessBackendSdkTransport } from './backendSdkTransport.ts';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import {
  createBirdCoderAdminIdeServices,
  createUnavailableAdminDeploymentService,
  createUnavailableAdminPolicyService,
  createUnavailableAuditService,
} from '@sdkwork/birdcoder-pc-admin-core';
import { ApiBackedCatalogService } from './impl/ApiBackedCatalogService.ts';
import { ApiBackedCollaborationService } from './impl/ApiBackedCollaborationService.ts';
import { ApiBackedAppRuntimeReadService } from './impl/ApiBackedAppRuntimeReadService.ts';
import { ApiBackedAppRuntimeWriteService } from './impl/ApiBackedAppRuntimeWriteService.ts';
import { ApiBackedDeploymentService } from './impl/ApiBackedDeploymentService.ts';
import { ApiBackedDocumentService } from './impl/ApiBackedDocumentService.ts';
import { ApiBackedGitService } from './impl/ApiBackedGitService.ts';
import { ApiBackedProjectService } from './impl/ApiBackedProjectService.ts';
import { ApiBackedReleaseService } from './impl/ApiBackedReleaseService.ts';
import { createUnavailableReleaseService } from './impl/UnavailableReleaseService.ts';
import { ApiBackedTeamService } from './impl/ApiBackedTeamService.ts';
import { ApiBackedVipMembershipService } from './impl/ApiBackedVipMembershipService.ts';
import { ApiBackedWorkspaceService } from './impl/ApiBackedWorkspaceService.ts';
import { RuntimeFileSystemService } from './impl/RuntimeFileSystemService.ts';
import {
  createBirdCoderDefaultIdeSharedRuntime,
  type BirdCoderDefaultIdeServices,
  type CreateBirdCoderDefaultIdeServicesOptions,
} from './defaultIdeServicesShared.ts';
import { resolveRuntimeServerSessionHeaders } from './runtimeServerSession.ts';
import {
  createBirdCoderAppSdkApiClient,
  createBirdCoderBackendSdkApiClient,
  type BirdCoderAppSdkApiClient,
  type BirdCoderBackendSdkApiClient,
} from './sdkClients.ts';
import { createBirdCoderHttpApiTransport } from './sdkTransportShared.ts';

export {
  type BirdCoderDefaultIdeServices,
  type CreateBirdCoderDefaultIdeServicesOptions,
} from './defaultIdeServicesShared.ts';

const DEFAULT_RUNTIME_HTTP_API_TIMEOUT_MS = 20_000;

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

export function createInProcessBirdCoderAppClient(
  queries: ReturnType<typeof createBirdCoderConsoleQueries>,
  projectService?: Parameters<typeof createBirdCoderInProcessAppSdkTransport>[0]['projectService'],
): BirdCoderAppSdkApiClient {
  return createBirdCoderAppSdkApiClient({
    transport: createBirdCoderInProcessAppSdkTransport({
      projectService,
      queries,
    }),
  });
}

export function createInProcessBirdCoderBackendClient(
  queries: ReturnType<typeof createBirdCoderConsoleQueries>,
): BirdCoderBackendSdkApiClient {
  return createBirdCoderBackendSdkApiClient({
    transport: createBirdCoderInProcessBackendSdkTransport({
      queries,
    }),
  });
}

export function createDefaultBirdCoderIdeServices(
  options: CreateBirdCoderDefaultIdeServicesOptions = {},
): BirdCoderDefaultIdeServices {
  const runtime = createBirdCoderDefaultIdeSharedRuntime(options);
  const appClient =
    runtime.appClient ??
    resolveRuntimeAppClient() ??
    createUnavailableBirdCoderAppClient();
  const workspaceService = runtime.hasBoundAppClient
    ? new ApiBackedWorkspaceService({
        appClient,
        currentUserProvider: runtime.authService,
        workspaceMirror: runtime.providerBackedWorkspaceService,
        writeService: runtime.providerBackedWorkspaceService,
      })
    : runtime.providerBackedWorkspaceService;
  const projectService = runtime.hasBoundAppClient
    ? new ApiBackedProjectService({
        appClient,
        codingSessionMirror: runtime.providerBackedProjectService,
        codingRuntimeClient: runtime.appRuntimeClient,
        currentUserProvider: runtime.authService,
        projectMirror: runtime.providerBackedProjectService,
        writeService: runtime.providerBackedProjectService,
      })
    : runtime.providerBackedProjectService;

  const adminServices = runtime.hasExplicitBackendClient
    ? createBirdCoderAdminIdeServices(runtime.backendClient)
    : {
        adminDeploymentService: createUnavailableAdminDeploymentService(),
        adminPolicyService: createUnavailableAdminPolicyService(),
        auditService: createUnavailableAuditService(),
      };

  return {
    adminDeploymentService: adminServices.adminDeploymentService,
    adminPolicyService: adminServices.adminPolicyService,
    authService: runtime.authService,
    auditService: adminServices.auditService,
    catalogService: new ApiBackedCatalogService({
      appClient,
    }),
    collaborationService: new ApiBackedCollaborationService({
      appClient,
      currentUserProvider: runtime.authService,
    }),
    appRuntimeReadService: new ApiBackedAppRuntimeReadService({
      client: runtime.appRuntimeClient,
      currentUserProvider: runtime.authService,
    }),
    appRuntimeWriteService: new ApiBackedAppRuntimeWriteService({
      client: runtime.appRuntimeClient,
    }),
    deploymentService: new ApiBackedDeploymentService({
      appClient,
    }),
    documentService: new ApiBackedDocumentService({
      appClient,
    }),
    fileSystemService: new RuntimeFileSystemService(),
    gitService: new ApiBackedGitService({
      appClient,
    }),
    promptService: runtime.promptService,
    projectService,
    releaseService: runtime.hasExplicitBackendClient
      ? new ApiBackedReleaseService({ backendClient: runtime.backendClient })
      : createUnavailableReleaseService(),
    teamService: new ApiBackedTeamService({
      appClient,
      currentUserProvider: runtime.authService,
    }),
    vipMembershipService: new ApiBackedVipMembershipService(),
    workspaceService,
  };
}
