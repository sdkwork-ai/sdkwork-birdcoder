import type {
  AgentProjectView,
  AgentSessionActivityView,
  AgentSessionView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { compareWorkbenchLongIntegers } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import {
  toAgentSessionViewFromActivitySummary,
  type AgentSessionActivitySummaryRecord,
} from '../services/agentSessionViewModels.ts';
import {
  canApplyAgentSessionTombstone,
  canCommitAgentSessionToProjectsStore,
  recordAgentSessionTombstoneInProjectsStore,
  removeAgentSessionFromCollection,
  PROJECT_STORE_MAX_CACHED_SESSIONS,
  trimProjectsStoreSessionCache,
  updateAgentSessionInCollection,
  upsertAgentSessionIntoCollection,
} from '../stores/projectsStore.ts';

export const WORKSPACE_SESSION_INBOX_PAGE_SIZE = 100;
export const WORKSPACE_SESSION_INBOX_REFRESH_INTERVAL_MS = 15_000;
export const WORKSPACE_SESSION_INBOX_MAX_RETRY_INTERVAL_MS = 120_000;

/**
 * 工作区会话收件箱在内存中保留的最大会话数量上限。
 *
 * 当会话总数超过此阈值时，会触发有界裁剪。已加载 transcript、pinned、
 * 待交互、运行中和 unread 会话依次优先，其余席位按活动时间填充。
 *
 * 该值复用 ProjectsStore 的统一 Session 缓存上限，所有写入路径保持一致。
 */
export const WORKSPACE_SESSION_INBOX_MAX_CACHED_SESSIONS = PROJECT_STORE_MAX_CACHED_SESSIONS;
const WORKSPACE_SESSION_INBOX_MAX_CURSOR_LENGTH = 2_048;

export function resolveWorkspaceSessionInboxRefreshDelay(
  consecutiveFailures: number,
): number {
  const normalizedFailures = Math.max(0, Math.trunc(consecutiveFailures));
  return Math.min(
    WORKSPACE_SESSION_INBOX_MAX_RETRY_INTERVAL_MS,
    WORKSPACE_SESSION_INBOX_REFRESH_INTERVAL_MS * (2 ** normalizedFailures),
  );
}

export function canSynchronizeWorkspaceSessionInbox(
  visibilityState: DocumentVisibilityState,
  isOnline: boolean,
): boolean {
  return visibilityState !== 'hidden' && isOnline;
}

export interface WorkspaceSessionInboxUpdate {
  cursor?: string;
  hasMore: boolean;
  nextCursor?: string;
  summaries: readonly AgentSessionActivitySummaryRecord[];
}

export function mergeWorkspaceSessionInboxUpdates(
  updates: readonly WorkspaceSessionInboxUpdate[],
): WorkspaceSessionInboxUpdate {
  if (updates.length === 0) {
    return { hasMore: false, summaries: [] };
  }

  const summaries: AgentSessionActivitySummaryRecord[] = [];
  const seenSessionKeys = new Set<string>();
  for (let index = 0; index < updates.length; index += 1) {
    const update = updates[index]!;
    const previous = updates[index - 1];
    if (previous && update.cursor !== previous.nextCursor) {
      throw new Error('Agents Session activity continuation does not match the prior cursor.');
    }
    for (const summary of update.summaries) {
      const projectId = summary.session.projectId?.trim() ?? '';
      const sessionId = summary.session.sessionId.trim();
      const key = buildScopedSessionKey(projectId, sessionId);
      if (seenSessionKeys.has(key)) {
        throw new Error('Agents Session activity snapshot contains a duplicate Session identity.');
      }
      seenSessionKeys.add(key);
      summaries.push(summary);
    }
  }

  const lastUpdate = updates.at(-1)!;
  return {
    cursor: updates[0]!.cursor,
    hasMore: lastUpdate.hasMore,
    nextCursor: lastUpdate.nextCursor,
    summaries,
  };
}

function buildScopedSessionKey(projectId: string, sessionId: string): string {
  return `${projectId}\u0001${sessionId}`;
}

function parseTimestamp(value: string | null | undefined, label: string): number {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Agents Session activity ${label} is not a valid timestamp.`);
  }
  return timestamp;
}

function readNullableTimestamp(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error(`Agents Session activity ${label} must be a timestamp or null.`);
  }
  return parseTimestamp(value, label);
}

function assertOptionalComponentVersion(
  actual: string | null,
  expected: string | undefined,
  label: string,
): void {
  if ((actual ?? undefined) !== expected) {
    throw new Error(`Agents Session activity ${label} revision does not match its record.`);
  }
}

function normalizeNullableIdentity(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error('Agents Session activity provider identity contains a blank value.');
  }
  return normalized;
}

export function validateAgentSessionActivitySummary(
  summary: AgentSessionActivitySummaryRecord,
  project: AgentProjectView,
  workspaceId?: string,
): void {
  const session = summary.session;
  const projectId = session.projectId?.trim() ?? '';
  if (
    !session.sessionId.trim()
    || projectId !== project.projectId
    || (workspaceId !== undefined && project.workspaceId !== workspaceId)
    || session.tenantId !== project.tenantId
    || session.organizationId !== project.organizationId
    || session.ownerUserId !== project.ownerUserId
  ) {
    const scopeLabel = workspaceId === undefined ? 'Project' : 'Workspace';
    throw new Error(
      `Agents Session activity summary escaped its requested ${scopeLabel} scope.`,
    );
  }
  const assertSessionComponent = (
    component: {
      organizationId: string;
      sessionId: string;
      tenantId: string;
    } | null,
    label: string,
  ) => {
    if (component && (
      component.sessionId !== session.sessionId
      || component.tenantId !== session.tenantId
      || component.organizationId !== session.organizationId
    )) {
      throw new Error(`Agents Session activity ${label} identity does not match its Session.`);
    }
  };
  assertSessionComponent(summary.latestTurn, 'latest Turn');
  assertSessionComponent(summary.pendingInteraction, 'pending Interaction');
  assertSessionComponent(summary.currentRuntimeBinding, 'current RuntimeBinding');
  assertSessionComponent(summary.latestRuntimeBinding, 'latest RuntimeBinding');
  if (summary.latestTurn && (
    summary.latestTurn.agentId !== session.agentId
    || summary.latestTurn.ownerUserId !== session.ownerUserId
  )) {
    throw new Error('Agents Session activity latest Turn escaped its Session owner scope.');
  }
  if (summary.currentRuntimeBinding && (
    !summary.currentRuntimeBinding.isCurrent
    || summary.currentRuntimeBinding.status !== 'active'
  )) {
    throw new Error('Agents Session activity current RuntimeBinding is not active and current.');
  }
  const providerIdentity = summary.providerIdentity;
  const identityValues = [
    providerIdentity.runtimeBindingId,
    providerIdentity.providerBindingId,
    providerIdentity.providerId,
    providerIdentity.modelId,
    providerIdentity.providerSessionId,
    providerIdentity.providerSessionTreeId,
    providerIdentity.providerParentSessionId,
    providerIdentity.providerForkedFromSessionId,
  ];
  identityValues.forEach((value) => normalizeNullableIdentity(value));
  const canonicalIdentitySource = summary.currentRuntimeBinding ?? summary.latestTurn;
  if (canonicalIdentitySource) {
    const expectedIdentity = summary.currentRuntimeBinding
      ? {
          runtimeBindingId: summary.currentRuntimeBinding.runtimeBindingId,
          providerBindingId: summary.currentRuntimeBinding.providerBindingId,
          providerId: summary.currentRuntimeBinding.providerId,
          modelId: summary.currentRuntimeBinding.modelId,
          providerSessionId: summary.currentRuntimeBinding.providerSessionId,
          providerSessionTreeId: summary.currentRuntimeBinding.providerSessionTreeId,
          providerParentSessionId: summary.currentRuntimeBinding.providerParentSessionId,
          providerForkedFromSessionId: summary.currentRuntimeBinding.providerForkedFromSessionId,
        }
      : {
          runtimeBindingId: summary.latestTurn?.runtimeBindingId,
          providerBindingId: summary.latestTurn?.providerBindingId,
          providerId: summary.latestTurn?.providerId,
          modelId: summary.latestTurn?.modelId,
          providerSessionId: null,
          providerSessionTreeId: null,
          providerParentSessionId: null,
          providerForkedFromSessionId: null,
        };
    for (const key of Object.keys(expectedIdentity) as Array<keyof typeof expectedIdentity>) {
      if (
        normalizeNullableIdentity(providerIdentity[key])
        !== normalizeNullableIdentity(expectedIdentity[key])
      ) {
        throw new Error('Agents Session activity provider identity is inconsistent.');
      }
    }
  } else if (identityValues.some((value) => value !== null && value !== undefined)) {
    throw new Error('Agents Session activity provider identity has no authoritative source.');
  }
  if (summary.userState && (
    summary.userState.resourceType !== 'session'
    || summary.userState.resourceId !== session.sessionId
    || summary.userState.tenantId !== session.tenantId
    || summary.userState.organizationId !== session.organizationId
    || summary.userState.userId !== session.ownerUserId
  )) {
    throw new Error('Agents Session activity user state escaped its Session owner scope.');
  }
  if (
    summary.providerActivity
    && summary.providerActivity.providerSessionId !== summary.providerIdentity.providerSessionId
  ) {
    throw new Error('Agents Session activity provider Session identity does not match its provider identity.');
  }

  const freshness = summary.freshness;
  if (freshness.sessionVersion !== session.version) {
    throw new Error('Agents Session activity Session revision does not match its record.');
  }
  assertOptionalComponentVersion(
    freshness.latestTurnVersion,
    summary.latestTurn?.version,
    'latest Turn',
  );
  assertOptionalComponentVersion(
    freshness.pendingInteractionVersion,
    summary.pendingInteraction?.version,
    'pending Interaction',
  );
  assertOptionalComponentVersion(
    freshness.currentRuntimeBindingVersion,
    summary.currentRuntimeBinding?.version,
    'current RuntimeBinding',
  );
  assertOptionalComponentVersion(
    freshness.latestRuntimeBindingVersion,
    summary.latestRuntimeBinding?.version,
    'latest RuntimeBinding',
  );
  if (
    (freshness.latestInteractionId === null)
    !== (freshness.latestInteractionVersion === null)
  ) {
    throw new Error('Agents Session activity latest Interaction tombstone is incomplete.');
  }
  if (
    (freshness.latestRuntimeBindingId === null)
    !== (freshness.latestRuntimeBindingVersion === null)
  ) {
    throw new Error('Agents Session activity latest RuntimeBinding tombstone is incomplete.');
  }
  if ((freshness.latestRuntimeBindingId ?? undefined)
    !== summary.latestRuntimeBinding?.runtimeBindingId) {
    throw new Error('Agents Session activity latest RuntimeBinding identity is inconsistent.');
  }
  assertOptionalComponentVersion(
    freshness.userStateVersion,
    summary.userState?.version,
    'user state',
  );

  parseTimestamp(freshness.activityAt, 'activityAt');
  const observedAt = readNullableTimestamp(freshness.observedAt, 'observedAt');
  const freshUntil = readNullableTimestamp(freshness.freshUntil, 'freshUntil');
  if (freshUntil !== null && (observedAt === null || freshUntil <= observedAt)) {
    throw new Error('Agents Session activity freshness interval is invalid.');
  }
  if (summary.providerActivity) {
    const providerObservedAt = readNullableTimestamp(
      summary.providerActivity.observedAt,
      'provider observedAt',
    );
    const providerFreshUntil = readNullableTimestamp(
      summary.providerActivity.freshUntil,
      'provider freshUntil',
    );
    if (
      summary.providerActivity.freshness === 'fresh'
      && (
        summary.providerActivity.state === null
        || summary.providerActivity.evidenceKind === null
        || providerObservedAt === null
        || providerFreshUntil === null
        || providerFreshUntil <= providerObservedAt
      )
    ) {
      throw new Error('Agents Session activity fresh provider evidence is incomplete.');
    }
  }
}

function normalizeSummaries(
  summaries: readonly AgentSessionActivitySummaryRecord[],
  projects: readonly AgentProjectView[],
  workspaceId: string,
): AgentSessionActivitySummaryRecord[] {
  const loadedProjects = new Map(projects.map((project) => [project.projectId, project]));
  const seenKeys = new Set<string>();
  const normalized: AgentSessionActivitySummaryRecord[] = [];
  for (const summary of summaries) {
    const projectId = summary.session.projectId?.trim() ?? '';
    const sessionId = summary.session.sessionId.trim();
    if (!projectId || !sessionId) {
      throw new Error('Agents Session activity summary is missing its Session identity.');
    }
    const key = buildScopedSessionKey(projectId, sessionId);
    if (seenKeys.has(key)) {
      throw new Error('Agents Session activity page contains a duplicate Session identity.');
    }
    seenKeys.add(key);
    const project = loadedProjects.get(projectId);
    if (!project) {
      continue;
    }
    validateAgentSessionActivitySummary(summary, project, workspaceId);
    normalized.push(summary);
  }
  return normalized;
}

export function normalizeAgentSessionActivityCursor(
  value: unknown,
  label: string,
): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`Agents Session activity ${label} must be an opaque string.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > WORKSPACE_SESSION_INBOX_MAX_CURSOR_LENGTH) {
    throw new Error(`Agents Session activity ${label} has an invalid length.`);
  }
  return normalized;
}

export async function loadWorkspaceSessionInboxUpdate(
  agentSessionService: IAgentSessionService,
  workspaceId: string,
  projects: readonly AgentProjectView[],
  cursor?: string,
  signal?: AbortSignal,
): Promise<WorkspaceSessionInboxUpdate> {
  const normalizedWorkspaceId = workspaceId.trim();
  if (!normalizedWorkspaceId) {
    return { cursor, hasMore: false, summaries: [] };
  }
  const normalizedCursor = cursor === undefined
    ? undefined
    : normalizeAgentSessionActivityCursor(cursor, 'request cursor');
  const page = await agentSessionService.listSessionActivitySummaries({
    cursor: normalizedCursor,
    pageSize: WORKSPACE_SESSION_INBOX_PAGE_SIZE,
    workspaceId: normalizedWorkspaceId,
  }, { signal });
  signal?.throwIfAborted();
  const returnedPageSize = page.pageInfo.pageSize;
  const hasMore = page.pageInfo.hasMore;
  const nextCursor = normalizeAgentSessionActivityCursor(
    page.pageInfo.nextCursor,
    'next cursor',
  );
  if (
    page.pageInfo.mode !== 'cursor'
    || returnedPageSize !== WORKSPACE_SESSION_INBOX_PAGE_SIZE
    || typeof hasMore !== 'boolean'
    || page.items.length > WORKSPACE_SESSION_INBOX_PAGE_SIZE
  ) {
    throw new Error('Agents Session activity snapshot returned invalid pagination metadata.');
  }
  if (hasMore && (
    page.items.length === 0
    || !nextCursor
    || nextCursor === normalizedCursor
  )) {
    throw new Error('Agents Session activity snapshot returned a non-progressing cursor page.');
  }
  if (!hasMore && nextCursor) {
    throw new Error('Agents Session activity snapshot returned an unexpected terminal cursor.');
  }
  return {
    cursor: normalizedCursor,
    hasMore,
    nextCursor,
    summaries: normalizeSummaries(page.items, projects, normalizedWorkspaceId),
  };
}

function findSession(
  projects: readonly AgentProjectView[],
  projectId: string,
  sessionId: string,
): AgentSessionView | null {
  return projects
    .find((project) => project.projectId === projectId)
    ?.agentSessions.find((session) => session.id === sessionId) ?? null;
}

function compareOptionalVersions(
  incoming: string | undefined,
  existing: string | undefined,
): number {
  if (incoming === existing) return 0;
  if (incoming === undefined) return -1;
  if (existing === undefined) return 1;
  return compareWorkbenchLongIntegers(incoming, existing);
}

function isSameRecordVersionRegression(
  incomingId: string | undefined,
  incomingVersion: string | undefined,
  existingId: string | undefined,
  existingVersion: string | undefined,
): boolean {
  return incomingId !== undefined
    && incomingId === existingId
    && compareOptionalVersions(incomingVersion, existingVersion) < 0;
}

function hasActivityComponentRegression(
  incoming: AgentSessionActivityView,
  existing: AgentSessionActivityView,
): boolean {
  if (compareOptionalVersions(incoming.versions.session, existing.versions.session) < 0) {
    return true;
  }
  if (existing.latestTurn && !incoming.latestTurn) {
    return true;
  }
  if (existing.versions.latestInteractionId && !incoming.versions.latestInteractionId) {
    return true;
  }
  if (existing.versions.latestRuntimeBindingId && !incoming.versions.latestRuntimeBindingId) {
    return true;
  }
  if (existing.versions.userState && !incoming.versions.userState) {
    return true;
  }
  return isSameRecordVersionRegression(
    incoming.latestTurn?.id,
    incoming.versions.latestTurn,
    existing.latestTurn?.id,
    existing.versions.latestTurn,
  ) || isSameRecordVersionRegression(
    incoming.versions.latestInteractionId,
    incoming.versions.latestInteraction,
    existing.versions.latestInteractionId,
    existing.versions.latestInteraction,
  ) || isSameRecordVersionRegression(
    incoming.versions.latestRuntimeBindingId,
    incoming.versions.latestRuntimeBinding,
    existing.versions.latestRuntimeBindingId,
    existing.versions.latestRuntimeBinding,
  ) || isSameRecordVersionRegression(
    incoming.pendingInteraction?.id,
    incoming.versions.pendingInteraction,
    existing.pendingInteraction?.id,
    existing.versions.pendingInteraction,
  ) || (
    incoming.versions.currentRuntimeBinding !== undefined
    && existing.versions.currentRuntimeBinding !== undefined
    && incoming.runtimeBinding?.id === existing.runtimeBinding?.id
    && compareOptionalVersions(
      incoming.versions.currentRuntimeBinding,
      existing.versions.currentRuntimeBinding,
    ) < 0
  ) || compareOptionalVersions(
    incoming.versions.userState,
    existing.versions.userState,
  ) < 0;
}

function hasNewerActivityComponent(
  incoming: AgentSessionActivityView,
  existing: AgentSessionActivityView,
): boolean {
  if (compareOptionalVersions(incoming.versions.session, existing.versions.session) > 0) {
    return true;
  }
  const sameRecordVersionPairs: ReadonlyArray<readonly [
    string | undefined,
    string | undefined,
    string | undefined,
    string | undefined,
  ]> = [
    [
      incoming.latestTurn?.id,
      incoming.versions.latestTurn,
      existing.latestTurn?.id,
      existing.versions.latestTurn,
    ],
    [
      incoming.versions.latestInteractionId,
      incoming.versions.latestInteraction,
      existing.versions.latestInteractionId,
      existing.versions.latestInteraction,
    ],
    [
      incoming.versions.latestRuntimeBindingId,
      incoming.versions.latestRuntimeBinding,
      existing.versions.latestRuntimeBindingId,
      existing.versions.latestRuntimeBinding,
    ],
    [
      incoming.pendingInteraction?.id,
      incoming.versions.pendingInteraction,
      existing.pendingInteraction?.id,
      existing.versions.pendingInteraction,
    ],
  ];
  if (sameRecordVersionPairs.some(([incomingId, incomingVersion, existingId, existingVersion]) =>
    incomingId !== undefined
    && incomingId === existingId
    && compareOptionalVersions(incomingVersion, existingVersion) > 0,
  )) {
    return true;
  }
  if (
    incoming.versions.currentRuntimeBinding !== undefined
    && existing.versions.currentRuntimeBinding !== undefined
    && incoming.runtimeBinding?.id === existing.runtimeBinding?.id
    && compareOptionalVersions(
      incoming.versions.currentRuntimeBinding,
      existing.versions.currentRuntimeBinding,
    ) > 0
  ) {
    return true;
  }
  if (compareOptionalVersions(incoming.versions.userState, existing.versions.userState) > 0) {
    return true;
  }
  const incomingProviderAt = readNullableTimestamp(
    incoming.provider?.observedAt,
    'provider observedAt',
  );
  const existingProviderAt = readNullableTimestamp(
    existing.provider?.observedAt,
    'provider observedAt',
  );
  return incomingProviderAt !== null
    && (existingProviderAt === null || incomingProviderAt > existingProviderAt);
}

export function shouldApplyAgentSessionActivitySummary(
  incoming: AgentSessionActivityView,
  existing: AgentSessionActivityView | undefined,
): boolean {
  if (!existing) {
    return true;
  }
  if (hasActivityComponentRegression(incoming, existing)) {
    return false;
  }
  if (hasNewerActivityComponent(incoming, existing)) {
    return true;
  }
  return parseTimestamp(incoming.activityAt, 'activityAt')
    > parseTimestamp(existing.activityAt, 'activityAt');
}

const LOCALLY_ACTIVE_RUNTIME_STATUSES = new Set<AgentSessionView['runtimeStatus']>([
  'initializing',
  'streaming',
  'awaiting_tool',
  'awaiting_approval',
  'awaiting_user',
]);

function mergeSummaryView(
  existing: AgentSessionView,
  incoming: AgentSessionView,
): AgentSessionView {
  const incomingActivityAt = parseTimestamp(incoming.activity?.activityAt, 'activityAt');
  const localActivityAt = Math.max(
    Date.parse(existing.lastUserActivityAt ?? '') || 0,
    Date.parse(existing.updatedAt) || 0,
  );
  const preserveLocalRuntime = !existing.activity
    && LOCALLY_ACTIVE_RUNTIME_STATUSES.has(existing.runtimeStatus)
    && localActivityAt > incomingActivityAt;
  return {
    ...incoming,
    items: existing.items,
    itemPageInfo: existing.itemPageInfo,
    runtimeStatus: preserveLocalRuntime ? existing.runtimeStatus : incoming.runtimeStatus,
    updatedAt: preserveLocalRuntime ? existing.updatedAt : incoming.updatedAt,
    lastTurnAt: preserveLocalRuntime ? existing.lastTurnAt : incoming.lastTurnAt,
    lastMessageAt: preserveLocalRuntime ? existing.lastMessageAt : incoming.lastMessageAt,
    lastUserActivityAt: preserveLocalRuntime
      ? existing.lastUserActivityAt
      : incoming.lastUserActivityAt,
    sortTimestamp: preserveLocalRuntime ? existing.sortTimestamp : incoming.sortTimestamp,
    transcriptUpdatedAt: preserveLocalRuntime
      ? existing.transcriptUpdatedAt
      : incoming.transcriptUpdatedAt,
  };
}

export function applyWorkspaceSessionInboxUpdate(
  projects: readonly AgentProjectView[],
  update: WorkspaceSessionInboxUpdate,
  scopeKey?: string,
): AgentProjectView[] {
  let nextProjects = projects as AgentProjectView[];
  for (const summary of update.summaries) {
    const projectId = summary.session.projectId?.trim() ?? '';
    if (!projectId || !nextProjects.some((project) => project.projectId === projectId)) {
      continue;
    }
    const existing = findSession(nextProjects, projectId, summary.session.sessionId);
    if (summary.presentationPhase === 'deleted' || summary.session.deletedAt) {
      if (scopeKey) {
        recordAgentSessionTombstoneInProjectsStore(
          scopeKey,
          projectId,
          summary.session.sessionId,
          summary.session.version,
        );
      }
      if (existing) {
        const deleted = toAgentSessionViewFromActivitySummary(summary);
        if (!canApplyAgentSessionTombstone(existing, deleted)) {
          continue;
        }
      }
      nextProjects = removeAgentSessionFromCollection(
        nextProjects,
        projectId,
        summary.session.sessionId,
      );
      continue;
    }
    const incoming = toAgentSessionViewFromActivitySummary(summary);
    if (
      scopeKey
      && !canCommitAgentSessionToProjectsStore(scopeKey, projectId, incoming)
    ) {
      continue;
    }
    if (!existing) {
      nextProjects = upsertAgentSessionIntoCollection(nextProjects, projectId, incoming);
      continue;
    }
    if (!shouldApplyAgentSessionActivitySummary(incoming.activity!, existing.activity)) {
      continue;
    }
    nextProjects = updateAgentSessionInCollection(
      nextProjects,
      projectId,
      summary.session.sessionId,
      (session) => mergeSummaryView(session, incoming),
    );
  }
  return trimProjectsStoreSessionCache(nextProjects);
}
