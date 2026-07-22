import type {
  BirdCoderCoreRuntimeSummary,
  BirdCoderHostMode,
  BirdCoderApiTransport,
  BirdCoderApiTransportRequest,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  BirdCoderProjectRuntimeLocation,
  BirdCoderProjectRuntimeLocationPreference,
} from '@sdkwork/birdcoder-pc-core/sdk/birdcoder-app';
import type { IProjectService } from './interfaces/IProjectService.ts';
import { createBirdCoderInProcessAppRuntimeTransport } from './appRuntimeTransport.ts';
import type { BirdCoderConsoleQueries } from './consoleQueries.ts';
import {
  BIRDCODER_CODING_SERVER_API_PREFIXES,
  createEnvelope,
  createListEnvelope,
  mapDeploymentSummary,
  mapDeploymentTargetSummary,
  mapDocumentSummary,
  mapProjectSummary,
  mapTeamSummary,
  mapWorkspaceSummary,
  normalizeQueryValue,
  readStrictOffsetListPage,
} from './sdkTransportShared.ts';

export interface BirdCoderInProcessProjectRuntimeLocationReadPort {
  getProjectRuntimeLocation(
    projectId: string,
    runtimeLocationId: string,
  ): Promise<BirdCoderProjectRuntimeLocation>;
  listProjectRuntimeLocationPreferencePage(request: {
    limit: number;
    offset: number;
    projectId: string;
  }): Promise<{
    items: BirdCoderProjectRuntimeLocationPreference[];
    total: number;
  }>;
}

export interface CreateBirdCoderInProcessAppSdkTransportOptions {
  hostMode?: BirdCoderHostMode;
  observe?: (request: BirdCoderApiTransportRequest) => void;
  projectService?: Pick<
    IProjectService,
    | 'addCodingSessionMessage'
    | 'createCodingSession'
    | 'deleteCodingSession'
    | 'deleteCodingSessionMessage'
    | 'editCodingSessionMessage'
    | 'forkCodingSession'
    | 'getCodingSessionTranscript'
    | 'getProjectById'
    | 'getProjects'
    | 'listCodingSessions'
    | 'renameCodingSession'
    | 'updateCodingSession'
  >;
  projectRuntimeLocationReadPort?: BirdCoderInProcessProjectRuntimeLocationReadPort;
  queries: BirdCoderConsoleQueries;
  runtime?: Partial<BirdCoderCoreRuntimeSummary>;
}

function isAppRuntimeSdkRoute(path: string): boolean {
  const appPrefix = BIRDCODER_CODING_SERVER_API_PREFIXES.app;
  return (
    path.startsWith(`${appPrefix}/intelligence/coding_sessions`) ||
    path.startsWith(`${appPrefix}/engines`) ||
    path.startsWith(`${appPrefix}/model_config`) ||
    path.startsWith(`${appPrefix}/models`) ||
    path.startsWith(`${appPrefix}/native_session_providers`) ||
    path.startsWith(`${appPrefix}/operations/`) ||
    path.startsWith(`${appPrefix}/system/`)
  );
}

export function createBirdCoderInProcessAppSdkTransport({
  hostMode,
  observe,
  projectService,
  projectRuntimeLocationReadPort,
  queries,
  runtime,
}: CreateBirdCoderInProcessAppSdkTransportOptions): BirdCoderApiTransport {
  const appWorkspaceRoutePrefix = `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/workspaces/`;
  const appProjectRoutePrefix = `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/projects/`;
  const appRuntimeTransport = projectService
    ? createBirdCoderInProcessAppRuntimeTransport({
        hostMode,
        projectService,
        runtime,
      })
    : undefined;

  return {
    async request<TResponse>(request: BirdCoderApiTransportRequest): Promise<TResponse> {
      observe?.(request);

      if (request.path.startsWith(BIRDCODER_CODING_SERVER_API_PREFIXES.backend)) {
        throw new Error(`Unsupported in-process app SDK route: ${request.method} ${request.path}`);
      }

      if (isAppRuntimeSdkRoute(request.path)) {
        if (!appRuntimeTransport) {
          throw new Error(
            `BirdCoder in-process app SDK runtime route is unavailable without a project service: ${request.method} ${request.path}`,
          );
        }
        return appRuntimeTransport.request<TResponse>(request);
      }

      if (request.method === 'POST') {
        switch (request.path) {
          case `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/workspaces`:
            return createEnvelope(
              await queries.createWorkspace(request.body as never),
            ) as TResponse;
          case `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/projects`:
            return createEnvelope(
              await queries.createProject(request.body as never),
            ) as TResponse;
          default:
            throw new Error(`Unsupported in-process app SDK route: ${request.method} ${request.path}`);
        }
      }

      if (request.method === 'PATCH') {
        if (request.path.startsWith(appWorkspaceRoutePrefix)) {
          const encodedWorkspaceId = request.path.slice(appWorkspaceRoutePrefix.length);
          return createEnvelope(
            await queries.updateWorkspace(
              decodeURIComponent(encodedWorkspaceId),
              request.body as never,
            ),
          ) as TResponse;
        }

        if (request.path.startsWith(appProjectRoutePrefix)) {
          const encodedProjectId = request.path.slice(appProjectRoutePrefix.length);
          return createEnvelope(
            await queries.updateProject(
              decodeURIComponent(encodedProjectId),
              request.body as never,
            ),
          ) as TResponse;
        }

        throw new Error(`Unsupported in-process app SDK route: ${request.method} ${request.path}`);
      }

      if (request.method === 'DELETE') {
        if (request.path.startsWith(appWorkspaceRoutePrefix)) {
          const encodedWorkspaceId = request.path.slice(appWorkspaceRoutePrefix.length);
          return createEnvelope(
            await queries.deleteWorkspace(decodeURIComponent(encodedWorkspaceId)),
          ) as TResponse;
        }

        if (request.path.startsWith(appProjectRoutePrefix)) {
          const encodedProjectId = request.path.slice(appProjectRoutePrefix.length);
          return createEnvelope(
            await queries.deleteProject(decodeURIComponent(encodedProjectId)),
          ) as TResponse;
        }

        throw new Error(`Unsupported in-process app SDK route: ${request.method} ${request.path}`);
      }

      if (request.method !== 'GET') {
        throw new Error(`Unsupported in-process app SDK method: ${request.method}`);
      }

      const runtimeLocationPreferencesMatch = request.path.match(
        /^\/app\/v3\/api\/projects\/([^/]+)\/runtime_location_preferences$/,
      );
      if (runtimeLocationPreferencesMatch) {
        const pagination = readStrictOffsetListPage(request);
        const projectId = decodeURIComponent(runtimeLocationPreferencesMatch[1]!);
        const page = projectRuntimeLocationReadPort
          ? await projectRuntimeLocationReadPort.listProjectRuntimeLocationPreferencePage({
              limit: pagination.pageSize,
              offset: pagination.offset,
              projectId,
            })
          : { items: [], total: 0 };
        return createListEnvelope(page.items, {
          offset: pagination.offset,
          pageSize: pagination.pageSize,
          total: page.total,
        }) as TResponse;
      }

      const runtimeLocationMatch = request.path.match(
        /^\/app\/v3\/api\/projects\/([^/]+)\/runtime_locations\/([^/]+)$/,
      );
      if (runtimeLocationMatch) {
        if (!projectRuntimeLocationReadPort) {
          throw new Error(
            `BirdCoder in-process project runtime-location read is unavailable: ${request.method} ${request.path}`,
          );
        }
        const projectId = decodeURIComponent(runtimeLocationMatch[1]!);
        const runtimeLocationId = decodeURIComponent(runtimeLocationMatch[2]!);
        return createEnvelope(
          await projectRuntimeLocationReadPort.getProjectRuntimeLocation(
            projectId,
            runtimeLocationId,
          ),
        ) as TResponse;
      }

      const deploymentTargetsMatch = request.path.match(
        /^\/app\/v3\/api\/projects\/([^/]+)\/deployment_targets$/,
      );
      if (deploymentTargetsMatch) {
        const projectId = decodeURIComponent(deploymentTargetsMatch[1]!);
        return createListEnvelope(
          (await queries.listDeploymentTargets({ projectId })).map(mapDeploymentTargetSummary),
        ) as TResponse;
      }

      if (
        request.path.startsWith(appProjectRoutePrefix) &&
        !request.path.endsWith('/collaborators') &&
        !request.path.endsWith('/publish') &&
        !request.path.endsWith('/deployment_targets')
      ) {
        const encodedProjectId = request.path.slice(appProjectRoutePrefix.length);
        if (encodedProjectId && !encodedProjectId.includes('/')) {
          const project = await queries.getProject(decodeURIComponent(encodedProjectId));
          if (!project) {
            throw new Error(`Project ${decodeURIComponent(encodedProjectId)} was not found.`);
          }
          return createEnvelope(mapProjectSummary(project)) as TResponse;
        }
      }

      switch (request.path) {
        case `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/workspaces`:
          {
            const pagination = readStrictOffsetListPage(request);
            const page = await queries.listWorkspacePage({
              page: pagination.page,
              pageSize: pagination.pageSize,
            });
            return createListEnvelope(
              page.items.map(mapWorkspaceSummary),
              {
                offset: pagination.offset,
                pageSize: pagination.pageSize,
                total: page.total,
              },
            ) as TResponse;
          }
        case `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/documents`:
          return createListEnvelope(
            (await queries.listDocuments()).map(mapDocumentSummary),
          ) as TResponse;
        case `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/deployments`:
          return createListEnvelope(
            (await queries.listDeployments()).map(mapDeploymentSummary),
          ) as TResponse;
        case `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/projects`:
          {
            const pagination = readStrictOffsetListPage(request);
            const page = await queries.listProjectPage({
              page: pagination.page,
              pageSize: pagination.pageSize,
              workspaceId: normalizeQueryValue('workspaceId', request.query?.workspaceId),
            });
          return createListEnvelope(
              page.items.map(mapProjectSummary),
              {
                offset: pagination.offset,
                pageSize: pagination.pageSize,
                total: page.total,
              },
          ) as TResponse;
          }
        case `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/teams`:
          return createListEnvelope(
            (await queries.listTeams({
              workspaceId: normalizeQueryValue('workspaceId', request.query?.workspaceId),
            })).map(mapTeamSummary),
          ) as TResponse;
        default:
          throw new Error(`Unsupported in-process app SDK route: ${request.method} ${request.path}`);
      }
    },
  };
}
