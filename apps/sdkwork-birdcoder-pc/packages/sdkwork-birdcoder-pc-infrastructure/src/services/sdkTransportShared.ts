import {
  BIRDCODER_CODING_SERVER_API_PREFIXES,
  BIRDCODER_CODING_SERVER_API_VERSION,
  type BirdCoderApiEnvelope,
  type BirdCoderApiListEnvelope,
  type BirdCoderApiQueryValue,
  type BirdCoderApiTransport,
  type BirdCoderApiTransportRequest,
  type BirdCoderDeploymentRecordSummary,
  type BirdCoderDeploymentTargetSummary,
  type BirdCoderIamAuditEventSummary,
  type BirdCoderIamPolicySummary,
  type BirdCoderProjectDocumentSummary,
  type BirdCoderProjectSummary,
  type BirdCoderReleaseSummary,
  type BirdCoderTeamMemberSummary,
  type BirdCoderTeamSummary,
  type BirdCoderWorkspaceSummary,
} from '@sdkwork/birdcoder-pc-types';
import { BirdCoderApiTransportError } from '@sdkwork/birdcoder-pc-core/birdCoderApiTransportError';
import { BIRDCODER_DEFAULT_LOCAL_TENANT_ID } from '../storage/bootstrapConsoleCatalog.ts';
import {
  normalizeBirdCoderApiQueryValue,
  parseBirdCoderApiJson,
  stringifyBirdCoderApiJson,
} from './apiJson.ts';
import { createBirdCoderLocalServerRequestId } from './localServerRequestId.ts';
import type { BirdCoderConsoleQueries } from './consoleQueries.ts';

export interface CreateBirdCoderHttpApiTransportOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  resolveHeaders?: () => Record<string, string | undefined>;
  timeoutMs?: number;
}

type BirdCoderFetchLike = typeof fetch;

const DEFAULT_BIRDCODER_HTTP_API_TIMEOUT_MS = 8_000;

export function createListEnvelope<TItem>(
  items: readonly TItem[],
): BirdCoderApiListEnvelope<TItem> {
  return {
    code: 0,
    traceId: createBirdCoderLocalServerRequestId(),
    data: {
      items: [...items],
      pageInfo: {
        mode: 'offset',
        page: 1,
        pageSize: items.length,
        totalItems: String(items.length),
      },
    },
  };
}

export function createEnvelope<TData>(data: TData): BirdCoderApiEnvelope<TData> {
  return {
    code: 0,
    traceId: createBirdCoderLocalServerRequestId(),
    data: { item: data },
  };
}

export function normalizeQueryValue(
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

export function mapWorkspaceSummary(
  workspace: Awaited<ReturnType<BirdCoderConsoleQueries['listWorkspaces']>>[number],
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

export function mapProjectSummary(
  project: Awaited<ReturnType<BirdCoderConsoleQueries['listProjects']>>[number],
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

export function mapDocumentSummary(
  document: Awaited<ReturnType<BirdCoderConsoleQueries['listDocuments']>>[number],
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

export function mapDeploymentSummary(
  deployment: Awaited<ReturnType<BirdCoderConsoleQueries['listDeployments']>>[number],
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

export function mapDeploymentTargetSummary(
  target: Awaited<ReturnType<BirdCoderConsoleQueries['listDeploymentTargets']>>[number],
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

export function mapTeamSummary(
  team: Awaited<ReturnType<BirdCoderConsoleQueries['listTeams']>>[number],
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

export function mapTeamMemberSummary(
  member: Awaited<ReturnType<BirdCoderConsoleQueries['listTeamMembers']>>[number],
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

export function mapReleaseSummary(
  release: Awaited<ReturnType<BirdCoderConsoleQueries['listReleases']>>[number],
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

export function mapAuditSummary(
  auditEvent: Awaited<ReturnType<BirdCoderConsoleQueries['listAuditEvents']>>[number],
): BirdCoderIamAuditEventSummary {
  const canonical = auditEvent as Partial<BirdCoderIamAuditEventSummary>;
  return {
    id: auditEvent.id,
    tenantId: canonical.tenantId ?? auditEvent.tenantId ?? BIRDCODER_DEFAULT_LOCAL_TENANT_ID,
    organizationId: canonical.organizationId,
    actorUserId: canonical.actorUserId,
    action: canonical.action ?? auditEvent.eventType,
    resourceType: canonical.resourceType ?? auditEvent.scopeType,
    resourceId: canonical.resourceId ?? auditEvent.scopeId,
    requestId: canonical.requestId,
    appId: canonical.appId,
    environment: canonical.environment,
    shardingKey: canonical.shardingKey,
    detail: canonical.detail ?? auditEvent.payload,
    createdAt: canonical.createdAt ?? auditEvent.createdAt,
  };
}

export function mapPolicySummary(
  policy: Awaited<ReturnType<BirdCoderConsoleQueries['listPolicies']>>[number],
): BirdCoderIamPolicySummary {
  const canonical = policy as Partial<BirdCoderIamPolicySummary>;
  const policyDetail = canonical.policy ?? {
    approvalPolicy: policy.approvalPolicy,
    policyCategory: policy.policyCategory,
    rationale: policy.rationale,
    scopeId: policy.scopeId,
    scopeType: policy.scopeType,
    targetId: policy.targetId,
    targetType: policy.targetType,
  };
  return {
    id: policy.id,
    tenantId: canonical.tenantId ?? policy.tenantId ?? BIRDCODER_DEFAULT_LOCAL_TENANT_ID,
    code: canonical.code ?? `${policy.policyCategory}.${policy.targetType}.${policy.targetId}`,
    name: canonical.name ?? policy.rationale ?? policy.id,
    policy: policyDetail,
    status: canonical.status ?? policy.status,
    createdAt: canonical.createdAt ?? policy.createdAt,
    updatedAt: canonical.updatedAt ?? policy.updatedAt,
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

async function buildBirdCoderApiError(
  response: Response,
  request: BirdCoderApiTransportRequest,
): Promise<BirdCoderApiTransportError> {
  let detail = '';
  let code: string | undefined;
  let businessCode: string | undefined;

  try {
    const rawBody = await response.text();
    const trimmedBody = rawBody.trim();
    if (!trimmedBody) {
      return new BirdCoderApiTransportError({
        detail,
        httpStatus: response.status,
        method: request.method,
        path: request.path,
      });
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
        code = typeof parsedBody.code === 'string' ? parsedBody.code.trim() : undefined;
        businessCode =
          typeof parsedBody.businessCode === 'string'
            ? parsedBody.businessCode.trim()
            : undefined;
        if (!code && isRecord(parsedBody.data) && typeof parsedBody.data.code === 'string') {
          code = parsedBody.data.code.trim();
        }
      }
    } catch {
      detail = trimmedBody;
    }
  } catch {
    // Fall back to the status-only error below.
  }

  return new BirdCoderApiTransportError({
    businessCode,
    code,
    detail: detail || undefined,
    httpStatus: response.status,
    method: request.method,
    path: request.path,
  });
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

export { BIRDCODER_CODING_SERVER_API_PREFIXES };
