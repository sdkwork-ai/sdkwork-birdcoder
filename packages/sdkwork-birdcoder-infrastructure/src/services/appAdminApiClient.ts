import {
  BIRDCODER_CODING_SERVER_API_PREFIXES,
  BIRDCODER_CODING_SERVER_API_VERSION,
  type BirdCoderAdminPolicySummary,
  type BirdCoderDeploymentRecordSummary,
  type BirdCoderDeploymentTargetSummary,
  type BirdCoderApiListEnvelope,
  type BirdCoderApiQueryValue,
  type BirdCoderProjectDocumentSummary,
  type BirdCoderApiTransport,
  type BirdCoderApiTransportRequest,
  type BirdCoderAdminAuditEventSummary,
  type BirdCoderProjectSummary,
  type BirdCoderReleaseSummary,
  type BirdCoderTeamMemberSummary,
  type BirdCoderTeamSummary,
  type BirdCoderWorkspaceSummary,
} from '@sdkwork/birdcoder-types';
import type { BirdCoderAppAdminConsoleQueries } from './appAdminConsoleQueries.ts';

export interface CreateBirdCoderInProcessAppAdminApiTransportOptions {
  observe?: (request: BirdCoderApiTransportRequest) => void;
  queries: BirdCoderAppAdminConsoleQueries;
}

export interface CreateBirdCoderHttpApiTransportOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  resolveHeaders?: () => Record<string, string | undefined>;
}

type BirdCoderFetchLike = typeof fetch;

function buildRequestId(path: string): string {
  const normalizedPath = path.replaceAll('/', '.').replace(/^\.*/u, '');
  return `req.${normalizedPath}.${Date.now().toString(36)}`;
}

function createListEnvelope<TItem>(items: readonly TItem[]): BirdCoderApiListEnvelope<TItem> {
  return {
    requestId: buildRequestId('list'),
    timestamp: new Date().toISOString(),
    items: [...items],
    meta: {
      page: 1,
      pageSize: items.length,
      total: items.length,
      version: BIRDCODER_CODING_SERVER_API_VERSION,
    },
  };
}

function normalizeQueryValue(value: BirdCoderApiQueryValue): string | undefined {
  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

function buildUrl(baseUrl: string, request: BirdCoderApiTransportRequest): URL {
  const url = new URL(baseUrl);
  const normalizedBasePath = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/u, '');
  const normalizedRequestPath = request.path.startsWith('/') ? request.path : `/${request.path}`;
  url.pathname = `${normalizedBasePath}${normalizedRequestPath}`;
  for (const [key, value] of Object.entries(request.query ?? {})) {
    const normalizedValue = normalizeQueryValue(value);
    if (normalizedValue) {
      url.searchParams.set(key, normalizedValue);
    }
  }
  return url;
}

function mapWorkspaceSummary(
  workspace: Awaited<ReturnType<BirdCoderAppAdminConsoleQueries['listWorkspaces']>>[number],
): BirdCoderWorkspaceSummary {
  return {
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    ownerIdentityId: workspace.ownerIdentityId,
    status: 'active',
  };
}

function mapProjectSummary(
  project: Awaited<ReturnType<BirdCoderAppAdminConsoleQueries['listProjects']>>[number],
): BirdCoderProjectSummary {
  return {
    id: project.id,
    workspaceId: project.workspaceId,
    name: project.name,
    description: project.description,
    rootPath: project.rootPath,
    status: project.status === 'archived' ? 'archived' : 'active',
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

function mapDocumentSummary(
  document: Awaited<ReturnType<BirdCoderAppAdminConsoleQueries['listDocuments']>>[number],
): BirdCoderProjectDocumentSummary {
  return {
    id: document.id,
    projectId: document.projectId,
    documentKind: document.documentKind as BirdCoderProjectDocumentSummary['documentKind'],
    title: document.title,
    slug: document.slug,
    status: document.status === 'archived' ? 'archived' : document.status === 'draft' ? 'draft' : 'active',
    updatedAt: document.updatedAt,
  };
}

function mapDeploymentSummary(
  deployment: Awaited<ReturnType<BirdCoderAppAdminConsoleQueries['listDeployments']>>[number],
): BirdCoderDeploymentRecordSummary {
  return {
    id: deployment.id,
    projectId: deployment.projectId,
    targetId: deployment.targetId,
    status: deployment.status as BirdCoderDeploymentRecordSummary['status'],
    startedAt: deployment.startedAt,
    completedAt: deployment.completedAt,
  };
}

function mapDeploymentTargetSummary(
  target: Awaited<ReturnType<BirdCoderAppAdminConsoleQueries['listDeploymentTargets']>>[number],
): BirdCoderDeploymentTargetSummary {
  return {
    id: target.id,
    projectId: target.projectId,
    name: target.name,
    environmentKey: target.environmentKey as BirdCoderDeploymentTargetSummary['environmentKey'],
    runtime: target.runtime as BirdCoderDeploymentTargetSummary['runtime'],
    status: target.status === 'archived' ? 'archived' : 'active',
  };
}

function mapTeamSummary(
  team: Awaited<ReturnType<BirdCoderAppAdminConsoleQueries['listTeams']>>[number],
): BirdCoderTeamSummary {
  return {
    id: team.id,
    workspaceId: team.workspaceId,
    name: team.name,
    description: team.description,
    status: team.status === 'archived' ? 'archived' : 'active',
  };
}

function mapTeamMemberSummary(
  member: Awaited<ReturnType<BirdCoderAppAdminConsoleQueries['listTeamMembers']>>[number],
): BirdCoderTeamMemberSummary {
  return {
    id: member.id,
    teamId: member.teamId,
    identityId: member.identityId,
    role: member.role as BirdCoderTeamMemberSummary['role'],
    status: member.status as BirdCoderTeamMemberSummary['status'],
  };
}

function mapReleaseSummary(
  release: Awaited<ReturnType<BirdCoderAppAdminConsoleQueries['listReleases']>>[number],
): BirdCoderReleaseSummary {
  return {
    id: release.id,
    releaseVersion: release.releaseVersion,
    releaseKind: release.releaseKind,
    rolloutStage: release.rolloutStage,
    status: release.status,
  };
}

function mapAuditSummary(
  auditEvent: Awaited<ReturnType<BirdCoderAppAdminConsoleQueries['listAuditEvents']>>[number],
): BirdCoderAdminAuditEventSummary {
  return {
    id: auditEvent.id,
    scopeType: auditEvent.scopeType,
    scopeId: auditEvent.scopeId,
    eventType: auditEvent.eventType,
    createdAt: auditEvent.createdAt,
    payload: auditEvent.payload,
  };
}

function mapPolicySummary(
  policy: Awaited<ReturnType<BirdCoderAppAdminConsoleQueries['listPolicies']>>[number],
): BirdCoderAdminPolicySummary {
  return {
    id: policy.id,
    scopeType: policy.scopeType as BirdCoderAdminPolicySummary['scopeType'],
    scopeId: policy.scopeId,
    policyCategory: policy.policyCategory as BirdCoderAdminPolicySummary['policyCategory'],
    targetType: policy.targetType as BirdCoderAdminPolicySummary['targetType'],
    targetId: policy.targetId,
    approvalPolicy: policy.approvalPolicy as BirdCoderAdminPolicySummary['approvalPolicy'],
    rationale: policy.rationale,
    status: policy.status as BirdCoderAdminPolicySummary['status'],
    updatedAt: policy.updatedAt,
  };
}

function resolveFetchLike(fetchImpl?: BirdCoderFetchLike): BirdCoderFetchLike {
  if (fetchImpl) {
    return fetchImpl;
  }
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch.bind(globalThis);
  }
  throw new Error('Fetch transport requires a fetch implementation.');
}

export function createBirdCoderHttpApiTransport({
  baseUrl,
  fetchImpl,
  resolveHeaders,
}: CreateBirdCoderHttpApiTransportOptions): BirdCoderApiTransport {
  const resolvedFetch = resolveFetchLike(fetchImpl);
  return {
    async request<TResponse>(request: BirdCoderApiTransportRequest): Promise<TResponse> {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      for (const [key, value] of Object.entries(resolveHeaders?.() ?? {})) {
        if (typeof value === 'string' && value.trim().length > 0) {
          headers[key] = value;
        }
      }
      for (const [key, value] of Object.entries(request.headers ?? {})) {
        if (typeof value === 'string' && value.trim().length > 0) {
          headers[key] = value;
        }
      }

      if (request.body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await resolvedFetch(buildUrl(baseUrl, request), {
        method: request.method,
        headers,
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
      });

      if (!response.ok) {
        throw new Error(`App/admin API request failed: ${request.method} ${request.path} -> ${response.status}`);
      }

      return response.json() as Promise<TResponse>;
    },
  };
}

export function createBirdCoderInProcessAppAdminApiTransport({
  observe,
  queries,
}: CreateBirdCoderInProcessAppAdminApiTransportOptions): BirdCoderApiTransport {
  const adminProjectDeploymentTargetsRoutePrefix = `${BIRDCODER_CODING_SERVER_API_PREFIXES.admin}/projects/`;
  const adminTeamMembersRoutePrefix = `${BIRDCODER_CODING_SERVER_API_PREFIXES.admin}/teams/`;

  return {
    async request<TResponse>(request: BirdCoderApiTransportRequest): Promise<TResponse> {
      observe?.(request);

      if (request.method !== 'GET') {
        throw new Error(`Unsupported in-process app/admin method: ${request.method}`);
      }

      if (
        request.path.startsWith(adminTeamMembersRoutePrefix) &&
        request.path.endsWith('/members')
      ) {
        const encodedTeamId = request.path.slice(
          adminTeamMembersRoutePrefix.length,
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
        request.path.startsWith(adminProjectDeploymentTargetsRoutePrefix) &&
        request.path.endsWith('/deployment-targets')
      ) {
        const encodedProjectId = request.path.slice(
          adminProjectDeploymentTargetsRoutePrefix.length,
          request.path.length - '/deployment-targets'.length,
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
        case `${BIRDCODER_CODING_SERVER_API_PREFIXES.admin}/deployments`:
          return createListEnvelope(
            (await queries.listDeployments()).map(mapDeploymentSummary),
          ) as TResponse;
        case `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/projects`:
          return createListEnvelope(
            (await queries.listProjects({ workspaceId: normalizeQueryValue(request.query?.workspaceId) })).map(
              mapProjectSummary,
            ),
          ) as TResponse;
        case `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/teams`:
          return createListEnvelope(
            (await queries.listTeams({ workspaceId: normalizeQueryValue(request.query?.workspaceId) })).map(
              mapTeamSummary,
            ),
          ) as TResponse;
        case `${BIRDCODER_CODING_SERVER_API_PREFIXES.admin}/teams`:
          return createListEnvelope(
            (await queries.listTeams({ workspaceId: normalizeQueryValue(request.query?.workspaceId) })).map(
              mapTeamSummary,
            ),
          ) as TResponse;
        case `${BIRDCODER_CODING_SERVER_API_PREFIXES.admin}/releases`:
          return createListEnvelope(
            (await queries.listReleases()).map(mapReleaseSummary),
          ) as TResponse;
        case `${BIRDCODER_CODING_SERVER_API_PREFIXES.admin}/audit`:
          return createListEnvelope(
            (await queries.listAuditEvents()).map(mapAuditSummary),
          ) as TResponse;
        case `${BIRDCODER_CODING_SERVER_API_PREFIXES.admin}/policies`:
          return createListEnvelope(
            (await queries.listPolicies()).map(mapPolicySummary),
          ) as TResponse;
        default:
          throw new Error(`Unsupported in-process app/admin route: ${request.method} ${request.path}`);
      }
    },
  };
}
