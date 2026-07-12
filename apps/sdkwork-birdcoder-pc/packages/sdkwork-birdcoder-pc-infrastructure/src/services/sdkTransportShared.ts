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
import {
  clampListPageSize,
  DEFAULT_LIST_PAGE_SIZE,
  MAX_LIST_PAGE_SIZE,
} from '@sdkwork/utils/pagination';
import { BIRDCODER_DEFAULT_LOCAL_TENANT_ID } from '../storage/bootstrapConsoleCatalog.ts';
import type { BirdCoderRepresentativeProjectRecord } from '../storage/appConsoleRepository.ts';
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

/**
 * Maximum allowed size (in bytes) for a successful API response body before it
 * is read into memory. Guards against OOM when a server returns an unexpectedly
 * huge payload. Callers should use paginated API endpoints for large result sets.
 */
const MAX_RESPONSE_BODY_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Maximum allowed size (in bytes) for an error response body. Error bodies are
 * expected to be small (ProblemDetail JSON); a larger body usually indicates a
 * misconfigured gateway returning an HTML error page or a streaming dump.
 */
const MAX_ERROR_BODY_BYTES = 1 * 1024 * 1024; // 1 MB
const MAX_OFFSET_LIST_OFFSET = 200_000;
const LEGACY_OFFSET_PAGINATION_QUERY_KEYS = [
  'pageSize',
  'limit',
  'offset',
  'page_no',
  'pageNo',
  'per_page',
  'size',
] as const;

function createResponseBodyLimitError(
  label: string,
  maxBytes: number,
  detail: string,
): Error {
  return new Error(
    `BirdCoder API ${label} body exceeds maximum size of ${maxBytes} bytes (${detail}). Use a paginated API endpoint instead.`,
  );
}

function readDeclaredContentLength(response: Response, label: string): bigint | null {
  const headers = response.headers;
  if (!headers || typeof headers.get !== 'function') {
    throw new Error(`BirdCoder API ${label} response is missing standard Headers support.`);
  }

  const contentLengthHeader = headers.get('content-length')?.trim();
  if (!contentLengthHeader || !/^\d+$/u.test(contentLengthHeader)) {
    return null;
  }

  try {
    return BigInt(contentLengthHeader);
  } catch {
    return null;
  }
}

async function readResponseBodyWithSizeGuard(
  response: Response,
  maxBytes: number,
  label: string,
): Promise<string> {
  const declaredLength = readDeclaredContentLength(response, label);
  if (declaredLength !== null && declaredLength > BigInt(maxBytes)) {
    throw createResponseBodyLimitError(
      label,
      maxBytes,
      `declared Content-Length: ${declaredLength.toString()}`,
    );
  }

  const body = response.body;
  if (body === null) {
    return '';
  }
  if (!body || typeof body.getReader !== 'function') {
    throw new Error(`BirdCoder API ${label} response is missing standard ReadableStream support.`);
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (!(value instanceof Uint8Array)) {
        await reader.cancel('BirdCoder API response yielded a non-byte stream chunk.').catch(() => undefined);
        throw new Error(`BirdCoder API ${label} response yielded a non-byte stream chunk.`);
      }

      if (value.byteLength > maxBytes - totalBytes) {
        await reader.cancel('BirdCoder API response body exceeded its configured byte limit.').catch(() => undefined);
        throw createResponseBodyLimitError(label, maxBytes, `received bytes: ${totalBytes + value.byteLength}`);
      }

      chunks.push(value);
      totalBytes += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export function createListEnvelope<TItem>(
  items: readonly TItem[],
  options: {
    offset?: number;
    pageSize?: number;
    total?: number;
  } = {},
): BirdCoderApiListEnvelope<TItem> {
  const total = options.total ?? items.length;
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new Error('List envelope total must be a non-negative safe integer.');
  }
  const { offset, pageSize } = clampListPageSize(
    options.offset,
    options.pageSize,
  );
  const page = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.ceil(total / pageSize);
  return {
    code: 0,
    traceId: createBirdCoderLocalServerRequestId(),
    data: {
      items: [...items],
      pageInfo: {
        mode: 'offset',
        hasMore: page < totalPages,
        page,
        pageSize,
        totalItems: String(total),
        totalPages,
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
  const effectiveBaseUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!effectiveBaseUrl) {
    throw new Error('Cannot build API URL without a base URL or browser origin.');
  }
  const url = new URL(effectiveBaseUrl);
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
  project: BirdCoderRepresentativeProjectRecord,
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
  const canonical = auditEvent as Partial<BirdCoderIamAuditEventSummary> & { requestId?: string };
  return {
    id: auditEvent.id,
    tenantId: canonical.tenantId ?? auditEvent.tenantId ?? BIRDCODER_DEFAULT_LOCAL_TENANT_ID,
    organizationId: canonical.organizationId,
    actorUserId: canonical.actorUserId,
    action: canonical.action ?? auditEvent.eventType,
    resourceType: canonical.resourceType ?? auditEvent.scopeType,
    resourceId: canonical.resourceId ?? auditEvent.scopeId,
    traceId: canonical.traceId ?? canonical.requestId,
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

export interface BirdCoderStrictOffsetListPage {
  offset: number;
  page: number;
  pageSize: number;
}

function throwInvalidListPagination(request: BirdCoderApiTransportRequest): never {
  throw new BirdCoderApiTransportError({
    code: 40003,
    detail: 'Invalid list pagination parameters.',
    httpStatus: 400,
    method: request.method,
    path: request.path,
    traceId: createBirdCoderLocalServerRequestId(),
  });
}

function parsePositiveDecimalPaginationValue(
  request: BirdCoderApiTransportRequest,
  value: BirdCoderApiQueryValue,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 1) {
      throwInvalidListPagination(request);
    }
    return value;
  }
  if (typeof value !== 'string' || !/^\d+$/u.test(value)) {
    throwInvalidListPagination(request);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throwInvalidListPagination(request);
  }
  return parsed;
}

export function readStrictOffsetListPage(
  request: BirdCoderApiTransportRequest,
): BirdCoderStrictOffsetListPage {
  const query = request.query ?? {};
  for (const key of LEGACY_OFFSET_PAGINATION_QUERY_KEYS) {
    if (query[key] !== undefined) {
      throwInvalidListPagination(request);
    }
  }
  if (query.cursor !== undefined) {
    throwInvalidListPagination(request);
  }

  const page = parsePositiveDecimalPaginationValue(request, query.page) ?? 1;
  const pageSize =
    parsePositiveDecimalPaginationValue(request, query.page_size) ?? DEFAULT_LIST_PAGE_SIZE;
  if (pageSize > MAX_LIST_PAGE_SIZE) {
    throwInvalidListPagination(request);
  }

  const offset = (page - 1) * pageSize;
  if (!Number.isSafeInteger(offset) || offset > MAX_OFFSET_LIST_OFFSET) {
    throwInvalidListPagination(request);
  }
  return { offset, page, pageSize };
}

function readProblemDetailCode(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function readProblemDetailTraceId(value: unknown): string | undefined {
  const traceId = typeof value === 'string' ? value.trim() : '';
  return traceId || undefined;
}

async function buildBirdCoderApiError(
  response: Response,
  request: BirdCoderApiTransportRequest,
): Promise<BirdCoderApiTransportError> {
  let detail = '';
  let code: number | undefined;
  let businessCode: string | undefined;
  let traceId: string | undefined;

  try {
    const rawBody = await readResponseBodyWithSizeGuard(
      response,
      MAX_ERROR_BODY_BYTES,
      'error',
    );
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
        const directDetail =
          typeof parsedBody.detail === 'string' ? parsedBody.detail.trim() : '';
        const directMessage =
          typeof parsedBody.message === 'string' ? parsedBody.message.trim() : '';
        const dataMessage =
          isRecord(parsedBody.data) && typeof parsedBody.data.message === 'string'
            ? parsedBody.data.message.trim()
            : '';
        detail = directDetail || dataMessage || directMessage;
        code = readProblemDetailCode(parsedBody.code);
        traceId = readProblemDetailTraceId(parsedBody.traceId);
        businessCode =
          typeof parsedBody.businessCode === 'string'
            ? parsedBody.businessCode.trim()
            : undefined;
        if (!code && isRecord(parsedBody.data)) {
          code = readProblemDetailCode(parsedBody.data.code);
        }
        if (!traceId && isRecord(parsedBody.data)) {
          traceId = readProblemDetailTraceId(parsedBody.data.traceId);
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
    traceId,
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

      try {
        const response = await resolvedFetch(buildUrl(baseUrl, request), {
          method: request.method,
          headers,
          body: request.body === undefined ? undefined : stringifyBirdCoderApiJson(request.body),
          signal: abortController?.signal,
        });

        if (!response.ok) {
          throw await buildBirdCoderApiError(response, request);
        }

        const rawBody = await readResponseBodyWithSizeGuard(
          response,
          MAX_RESPONSE_BODY_BYTES,
          'response',
        );
        const trimmedBody = rawBody.trim();
        if (!trimmedBody) {
          return undefined as TResponse;
        }

        return parseBirdCoderApiJson<TResponse>(trimmedBody);
      } catch (error) {
        if (requestTimedOut || (error instanceof Error && error.name === 'AbortError')) {
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
    },
  };
}

export { BIRDCODER_CODING_SERVER_API_PREFIXES };
