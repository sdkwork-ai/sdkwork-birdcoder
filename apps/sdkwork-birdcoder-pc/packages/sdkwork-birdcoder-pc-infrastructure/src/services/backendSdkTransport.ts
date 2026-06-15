import type {
  BirdCoderApiTransport,
  BirdCoderApiTransportRequest,
} from '@sdkwork/birdcoder-pc-types';
import type { BirdCoderConsoleQueries } from './consoleQueries.ts';
import {
  BIRDCODER_CODING_SERVER_API_PREFIXES,
  createListEnvelope,
  mapAuditSummary,
  mapDeploymentSummary,
  mapDeploymentTargetSummary,
  mapPolicySummary,
  mapReleaseSummary,
  mapTeamMemberSummary,
  mapTeamSummary,
  normalizeQueryValue,
} from './sdkTransportShared.ts';

export interface CreateBirdCoderInProcessBackendSdkTransportOptions {
  observe?: (request: BirdCoderApiTransportRequest) => void;
  queries: BirdCoderConsoleQueries;
}

export function createBirdCoderInProcessBackendSdkTransport({
  observe,
  queries,
}: CreateBirdCoderInProcessBackendSdkTransportOptions): BirdCoderApiTransport {
  const backendProjectDeploymentTargetsRoutePrefix = `${BIRDCODER_CODING_SERVER_API_PREFIXES.backend}/projects/`;
  const backendTeamMembersRoutePrefix = `${BIRDCODER_CODING_SERVER_API_PREFIXES.backend}/iam/teams/`;

  return {
    async request<TResponse>(request: BirdCoderApiTransportRequest): Promise<TResponse> {
      observe?.(request);

      if (request.path.startsWith(BIRDCODER_CODING_SERVER_API_PREFIXES.app)) {
        throw new Error(`Unsupported in-process backend SDK route: ${request.method} ${request.path}`);
      }

      if (request.method !== 'GET') {
        throw new Error(`Unsupported in-process backend SDK method: ${request.method}`);
      }

      if (
        request.path.startsWith(backendTeamMembersRoutePrefix) &&
        request.path.endsWith('/members')
      ) {
        const encodedTeamId = request.path.slice(
          backendTeamMembersRoutePrefix.length,
          request.path.length - '/members'.length,
        );
        return createListEnvelope(
          (
            await queries.listTeamMembers({
              teamId: decodeURIComponent(encodedTeamId),
            })
          ).map(mapTeamMemberSummary),
        ) as TResponse;
      }

      if (
        request.path.startsWith(backendProjectDeploymentTargetsRoutePrefix) &&
        request.path.endsWith('/deployment_targets')
      ) {
        const encodedProjectId = request.path.slice(
          backendProjectDeploymentTargetsRoutePrefix.length,
          request.path.length - '/deployment_targets'.length,
        );
        return createListEnvelope(
          (
            await queries.listDeploymentTargets({
              projectId: decodeURIComponent(encodedProjectId),
            })
          ).map(mapDeploymentTargetSummary),
        ) as TResponse;
      }

      switch (request.path) {
        case `${BIRDCODER_CODING_SERVER_API_PREFIXES.backend}/deployments`:
          return createListEnvelope(
            (await queries.listDeployments()).map(mapDeploymentSummary),
          ) as TResponse;
        case `${BIRDCODER_CODING_SERVER_API_PREFIXES.backend}/iam/teams`:
          return createListEnvelope(
            (await queries.listTeams({
              workspaceId: normalizeQueryValue('workspaceId', request.query?.workspaceId),
            })).map(mapTeamSummary),
          ) as TResponse;
        case `${BIRDCODER_CODING_SERVER_API_PREFIXES.backend}/releases`:
          return createListEnvelope(
            (await queries.listReleases()).map(mapReleaseSummary),
          ) as TResponse;
        case `${BIRDCODER_CODING_SERVER_API_PREFIXES.backend}/iam/audit_events`:
          return createListEnvelope(
            (await queries.listAuditEvents()).map(mapAuditSummary),
          ) as TResponse;
        case `${BIRDCODER_CODING_SERVER_API_PREFIXES.backend}/iam/policies`:
          return createListEnvelope(
            (await queries.listPolicies()).map(mapPolicySummary),
          ) as TResponse;
        default:
          throw new Error(`Unsupported in-process backend SDK route: ${request.method} ${request.path}`);
      }
    },
  };
}
