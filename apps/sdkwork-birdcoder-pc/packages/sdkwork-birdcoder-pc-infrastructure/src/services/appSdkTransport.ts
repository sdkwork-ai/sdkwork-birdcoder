import type {
  BirdCoderCoreRuntimeSummary,
  BirdCoderHostMode,
  BirdCoderApiTransport,
  BirdCoderApiTransportRequest,
} from '@sdkwork/birdcoder-pc-types';
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
} from './sdkTransportShared.ts';

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
    path.startsWith(`${appPrefix}/native_sessions`) ||
    path.startsWith(`${appPrefix}/operations/`) ||
    path.startsWith(`${appPrefix}/system/`)
  );
}

export function createBirdCoderInProcessAppSdkTransport({
  hostMode,
  observe,
  projectService,
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
          return createListEnvelope(
            (await queries.listWorkspaces()).map(mapWorkspaceSummary),
          ) as TResponse;
        case `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/documents`:
          return createListEnvelope(
            (await queries.listDocuments()).map(mapDocumentSummary),
          ) as TResponse;
        case `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/deployments`:
          return createListEnvelope(
            (await queries.listDeployments()).map(mapDeploymentSummary),
          ) as TResponse;
        case `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/projects`:
          return createListEnvelope(
            (
              await queries.listProjects({
                rootPath: normalizeQueryValue('rootPath', request.query?.rootPath),
                workspaceId: normalizeQueryValue('workspaceId', request.query?.workspaceId),
              })
            ).map(mapProjectSummary),
          ) as TResponse;
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
