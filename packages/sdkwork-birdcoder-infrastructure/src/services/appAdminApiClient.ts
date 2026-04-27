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
import {
  normalizeBirdCoderApiQueryValue,
  parseBirdCoderApiJson,
  stringifyBirdCoderApiJson,
} from './apiJson.ts';
import type { BirdCoderAppAdminConsoleQueries } from './appAdminConsoleQueries.ts';

export interface CreateBirdCoderInProcessAppAdminApiTransportOptions {
  observe?: (request: BirdCoderApiTransportRequest) => void;
  queries: BirdCoderAppAdminConsoleQueries;
}

export interface CreateBirdCoderHttpApiTransportOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  resolveHeaders?: () => Record<string, string | undefined>;
  timeoutMs?: number;
}

type BirdCoderFetchLike = typeof fetch;
const DEFAULT_BIRDCODER_HTTP_API_TIMEOUT_MS = 8_000;

function buildRequestId(path: string): string {
  const normalizedPath = path.replace(/\//gu, '.').replace(/^\.+/u, '');
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

function normalizeQueryValue(
  key: string,
  value: BirdCoderApiQueryValue,
): string | undefined {
  return normalizeBirdCoderApiQueryValue(key, value);
}

function buildUrl(baseUrl: string, request: BirdCoderApiTransportRequest): URL {
  const url = new URL(baseUrl);
  const normalizedBasePath = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/u, '');
  const normalizedRequestPath = request.path.startsWith('/') ? request.path : `/${request.path}`;
  url.pathname = `${normalizedBasePath}${normalizedRequestPath}`;
  for (const [key, value] of Object.entries(request.query ?? {})) {
    const normalizedValue = normalizeQueryValue(key, value);
    if (normalizedValue) {
      url.searchParams.set(key, normalizedValue);
    }
  }
  return url;
}

function mapWorkspaceSummary(
  workspace: Awaited<ReturnType<BirdCoderAppAdminConsoleQueries['listWorkspaces']>>[number],
): BirdCoderWorkspaceSummary {
  const canonical = workspace as Partial<BirdCoderWorkspaceSummary>;
  const ownerId = canonical.ownerId;
  return {
    id: workspace.id,
    uuid: canonical.uuid,
    tenantId: canonical.tenantId,
    organizationId: canonical.organizationId,
    dataScope: canonical.dataScope,
    code: canonical.code,
    title: canonical.title,
    name: workspace.name,
    description: workspace.description,
    icon: canonical.icon,
    color: canonical.color,
    ownerId,
    leaderId: canonical.leaderId ?? ownerId,
    createdByUserId: canonical.createdByUserId ?? ownerId,
    type: canonical.type,
    startTime: canonical.startTime,
    endTime: canonical.endTime,
    maxMembers: canonical.maxMembers,
    currentMembers: canonical.currentMembers,
    memberCount: canonical.memberCount,
    maxStorage: canonical.maxStorage,
    usedStorage: canonical.usedStorage,
    settings: canonical.settings,
    isPublic: canonical.isPublic,
    isTemplate: canonical.isTemplate,
    status: canonical.status === 'archived' ? 'archived' : 'active',
  };
}

function createEnvelope<TData>(data: TData) {
  return {
    requestId: buildRequestId('data'),
    timestamp: new Date().toISOString(),
    data,
  };
}

function mapProjectSummary(
  project: Awaited<ReturnType<BirdCoderAppAdminConsoleQueries['listProjects']>>[number],
): BirdCoderProjectSummary {
  const canonical = project as Partial<BirdCoderProjectSummary>;
  const ownerId = canonical.ownerId;
  const createdByUserId = canonical.createdByUserId ?? ownerId;
  return {
    id: project.id,
    uuid: canonical.uuid,
    tenantId: canonical.tenantId,
    organizationId: canonical.organizationId,
    dataScope: canonical.dataScope,
    workspaceId: project.workspaceId,
    workspaceUuid: canonical.workspaceUuid,
    userId: canonical.userId,
    parentId: canonical.parentId,
    parentUuid: canonical.parentUuid,
    parentMetadata: canonical.parentMetadata,
    code: canonical.code,
    title: canonical.title,
    name: project.name,
    description: project.description,
    rootPath: project.rootPath,
    sitePath: canonical.sitePath,
    domainPrefix: canonical.domainPrefix,
    ownerId,
    leaderId: canonical.leaderId ?? ownerId,
    createdByUserId,
    author: canonical.author ?? createdByUserId ?? ownerId,
    fileId: canonical.fileId,
    conversationId: canonical.conversationId,
    type: canonical.type,
    coverImage: canonical.coverImage,
    startTime: canonical.startTime,
    endTime: canonical.endTime,
    budgetAmount: canonical.budgetAmount,
    isTemplate: canonical.isTemplate,
    status: project.status === 'archived' ? 'archived' : 'active',
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

function mapDocumentSummary(
  document: Awaited<ReturnType<BirdCoderAppAdminConsoleQueries['listDocuments']>>[number],
): BirdCoderProjectDocumentSummary {
  const canonical = document as Partial<BirdCoderProjectDocumentSummary>;
  return {
    id: document.id,
    uuid: canonical.uuid,
    tenantId: canonical.tenantId,
    organizationId: canonical.organizationId,
    createdAt: canonical.createdAt ?? document.createdAt,
    updatedAt: canonical.updatedAt ?? document.updatedAt,
    projectId: document.projectId,
    documentKind: document.documentKind as BirdCoderProjectDocumentSummary['documentKind'],
    title: document.title,
    slug: document.slug,
    bodyRef: canonical.bodyRef,
    status: document.status === 'archived' ? 'archived' : document.status === 'draft' ? 'draft' : 'active',
  };
}

function mapDeploymentSummary(
  deployment: Awaited<ReturnType<BirdCoderAppAdminConsoleQueries['listDeployments']>>[number],
): BirdCoderDeploymentRecordSummary {
  const canonical = deployment as Partial<BirdCoderDeploymentRecordSummary>;
  return {
    id: deployment.id,
    uuid: canonical.uuid,
    tenantId: canonical.tenantId,
    organizationId: canonical.organizationId,
    createdAt: canonical.createdAt ?? deployment.createdAt,
    updatedAt: canonical.updatedAt ?? deployment.updatedAt,
    projectId: deployment.projectId,
    targetId: deployment.targetId,
    releaseRecordId: canonical.releaseRecordId ?? deployment.releaseRecordId,
    status: deployment.status as BirdCoderDeploymentRecordSummary['status'],
    endpointUrl: canonical.endpointUrl ?? deployment.endpointUrl,
    startedAt: canonical.startedAt ?? deployment.startedAt,
    completedAt: canonical.completedAt ?? deployment.completedAt,
  };
}

function mapDeploymentTargetSummary(
  target: Awaited<ReturnType<BirdCoderAppAdminConsoleQueries['listDeploymentTargets']>>[number],
): BirdCoderDeploymentTargetSummary {
  const canonical = target as Partial<BirdCoderDeploymentTargetSummary>;
  return {
    id: target.id,
    uuid: canonical.uuid,
    tenantId: canonical.tenantId,
    organizationId: canonical.organizationId,
    createdAt: canonical.createdAt ?? target.createdAt,
    updatedAt: canonical.updatedAt ?? target.updatedAt,
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
  const canonical = team as Partial<BirdCoderTeamSummary>;
  const ownerId = canonical.ownerId;
  return {
    id: team.id,
    uuid: canonical.uuid,
    tenantId: canonical.tenantId,
    organizationId: canonical.organizationId,
    createdAt: canonical.createdAt,
    updatedAt: canonical.updatedAt,
    workspaceId: team.workspaceId,
    code: canonical.code,
    title: canonical.title,
    name: team.name,
    description: team.description,
    ownerId,
    leaderId: canonical.leaderId ?? ownerId,
    createdByUserId: canonical.createdByUserId ?? ownerId,
    metadata: canonical.metadata,
    status: team.status === 'archived' ? 'archived' : 'active',
  };
}

function mapTeamMemberSummary(
  member: Awaited<ReturnType<BirdCoderAppAdminConsoleQueries['listTeamMembers']>>[number],
): BirdCoderTeamMemberSummary {
  const canonical = member as Partial<BirdCoderTeamMemberSummary>;
  return {
    id: member.id,
    uuid: canonical.uuid,
    tenantId: canonical.tenantId,
    organizationId: canonical.organizationId,
    teamId: member.teamId,
    userId: canonical.userId ?? member.userId,
    role: member.role as BirdCoderTeamMemberSummary['role'],
    status: member.status as BirdCoderTeamMemberSummary['status'],
    createdByUserId: canonical.createdByUserId,
    grantedByUserId: canonical.grantedByUserId,
    createdAt: canonical.createdAt,
    updatedAt: canonical.updatedAt,
  };
}

function mapReleaseSummary(
  release: Awaited<ReturnType<BirdCoderAppAdminConsoleQueries['listReleases']>>[number],
): BirdCoderReleaseSummary {
  const canonical = release as Partial<BirdCoderReleaseSummary>;
  return {
    id: release.id,
    uuid: canonical.uuid,
    tenantId: canonical.tenantId,
    organizationId: canonical.organizationId,
    createdAt: canonical.createdAt ?? release.createdAt,
    updatedAt: canonical.updatedAt ?? release.updatedAt,
    releaseVersion: release.releaseVersion,
    releaseKind: release.releaseKind,
    rolloutStage: release.rolloutStage,
    manifest: canonical.manifest ?? release.manifest,
    status: release.status,
  };
}

function mapAuditSummary(
  auditEvent: Awaited<ReturnType<BirdCoderAppAdminConsoleQueries['listAuditEvents']>>[number],
): BirdCoderAdminAuditEventSummary {
  const canonical = auditEvent as Partial<BirdCoderAdminAuditEventSummary>;
  return {
    id: auditEvent.id,
    uuid: canonical.uuid,
    tenantId: canonical.tenantId,
    organizationId: canonical.organizationId,
    createdAt: canonical.createdAt ?? auditEvent.createdAt,
    updatedAt: canonical.updatedAt ?? auditEvent.updatedAt,
    scopeType: auditEvent.scopeType,
    scopeId: auditEvent.scopeId,
    eventType: auditEvent.eventType,
    payload: auditEvent.payload,
  };
}

function mapPolicySummary(
  policy: Awaited<ReturnType<BirdCoderAppAdminConsoleQueries['listPolicies']>>[number],
): BirdCoderAdminPolicySummary {
  const canonical = policy as Partial<BirdCoderAdminPolicySummary>;
  return {
    id: policy.id,
    uuid: canonical.uuid,
    tenantId: canonical.tenantId,
    organizationId: canonical.organizationId,
    createdAt: canonical.createdAt ?? policy.createdAt,
    updatedAt: canonical.updatedAt ?? policy.updatedAt,
    scopeType: policy.scopeType as BirdCoderAdminPolicySummary['scopeType'],
    scopeId: policy.scopeId,
    policyCategory: policy.policyCategory as BirdCoderAdminPolicySummary['policyCategory'],
    targetType: policy.targetType as BirdCoderAdminPolicySummary['targetType'],
    targetId: policy.targetId,
    approvalPolicy: policy.approvalPolicy as BirdCoderAdminPolicySummary['approvalPolicy'],
    rationale: policy.rationale,
    status: policy.status as BirdCoderAdminPolicySummary['status'],
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

function resolveTimeoutMs(timeoutMs?: number): number {
  if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return DEFAULT_BIRDCODER_HTTP_API_TIMEOUT_MS;
  }

  return Math.floor(timeoutMs);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function buildBirdCoderApiError(response: Response, request: BirdCoderApiTransportRequest): Promise<Error> {
  let detail = '';

  try {
    const rawBody = await response.text();
    const trimmedBody = rawBody.trim();
    if (!trimmedBody) {
      return new Error(
        `BirdCoder API request failed: ${request.method} ${request.path} -> ${response.status}`,
      );
    }

    try {
      const parsedBody: unknown = parseBirdCoderApiJson(trimmedBody);
      if (isRecord(parsedBody)) {
        const directMessage =
          typeof parsedBody.message === 'string' ? parsedBody.message.trim() : '';
        const dataMessage =
          isRecord(parsedBody.data) && typeof parsedBody.data.message === 'string'
            ? parsedBody.data.message.trim()
            : '';
        detail = dataMessage || directMessage;
      }
    } catch {
      detail = trimmedBody;
    }
  } catch {
    // Ignore body read failures and fall back to the status-only error below.
  }

  return new Error(
    detail
      ? `BirdCoder API request failed: ${request.method} ${request.path} -> ${response.status} (${detail})`
      : `BirdCoder API request failed: ${request.method} ${request.path} -> ${response.status}`,
  );
}

export function createBirdCoderHttpApiTransport({
  baseUrl,
  fetchImpl,
  resolveHeaders,
  timeoutMs,
}: CreateBirdCoderHttpApiTransportOptions): BirdCoderApiTransport {
  const resolvedFetch = resolveFetchLike(fetchImpl);
  const resolvedTimeoutMs = resolveTimeoutMs(timeoutMs);
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

      const abortController =
        typeof AbortController === 'function' ? new AbortController() : undefined;
      let requestTimedOut = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

      if (abortController) {
        timeoutHandle = setTimeout(() => {
          requestTimedOut = true;
          abortController.abort();
        }, resolvedTimeoutMs);
      }

      let response: Response;
      try {
        response = await resolvedFetch(buildUrl(baseUrl, request), {
          method: request.method,
          headers,
          body: request.body === undefined ? undefined : stringifyBirdCoderApiJson(request.body),
          signal: abortController?.signal,
        });
      } catch (error) {
        if (
          requestTimedOut ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          throw new Error(
            `BirdCoder API request timed out after ${resolvedTimeoutMs}ms: ${request.method} ${request.path}`,
          );
        }
        throw error;
      } finally {
        if (timeoutHandle !== undefined) {
          clearTimeout(timeoutHandle);
        }
      }

      if (!response.ok) {
        throw await buildBirdCoderApiError(response, request);
      }

      const rawBody = await response.text();
      const trimmedBody = rawBody.trim();
      if (!trimmedBody) {
        return undefined as TResponse;
      }

      return parseBirdCoderApiJson<TResponse>(trimmedBody);
    },
  };
}

export function createBirdCoderInProcessAppAdminApiTransport({
  observe,
  queries,
}: CreateBirdCoderInProcessAppAdminApiTransportOptions): BirdCoderApiTransport {
  const adminProjectDeploymentTargetsRoutePrefix = `${BIRDCODER_CODING_SERVER_API_PREFIXES.admin}/projects/`;
  const adminTeamMembersRoutePrefix = `${BIRDCODER_CODING_SERVER_API_PREFIXES.admin}/teams/`;
  const appWorkspaceRoutePrefix = `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/workspaces/`;
  const appProjectRoutePrefix = `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/projects/`;

  return {
    async request<TResponse>(request: BirdCoderApiTransportRequest): Promise<TResponse> {
      observe?.(request);

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
            throw new Error(`Unsupported in-process app/admin route: ${request.method} ${request.path}`);
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

        throw new Error(`Unsupported in-process app/admin route: ${request.method} ${request.path}`);
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

        throw new Error(`Unsupported in-process app/admin route: ${request.method} ${request.path}`);
      }

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

      if (
        request.path.startsWith(appProjectRoutePrefix) &&
        !request.path.endsWith('/collaborators') &&
        !request.path.endsWith('/publish')
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
        case `${BIRDCODER_CODING_SERVER_API_PREFIXES.admin}/deployments`:
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
            (await queries.listTeams({ workspaceId: normalizeQueryValue('workspaceId', request.query?.workspaceId) })).map(
              mapTeamSummary,
            ),
          ) as TResponse;
        case `${BIRDCODER_CODING_SERVER_API_PREFIXES.admin}/teams`:
          return createListEnvelope(
            (await queries.listTeams({ workspaceId: normalizeQueryValue('workspaceId', request.query?.workspaceId) })).map(
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
