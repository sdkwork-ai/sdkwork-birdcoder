import type {
  AgentSessionItemView,
  AgentSessionView,
  AgentProjectView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  areAgentSessionItemsEquivalent,
  buildAgentSessionItemMatchIndex,
  buildAgentSessionViewSynchronizationVersion,
  compareWorkbenchLongIntegers,
  compareWorkbenchProjectsByActivity,
  compareAgentSessionViewSortTimestamps,
  deduplicateAgentSessionItemViews,
  formatAgentSessionActivityDisplayTime,
  mergeLatestAgentSessionItems,
  resolveAgentSessionViewSortTimestampString,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type { AgentProjectViewPage } from '../services/interfaces/IProjectService.ts';

export interface ProjectsStoreSnapshot {
  error: string | null;
  hasFetched: boolean;
  isLoading: boolean;
  pageInfo: AgentProjectViewPage['pageInfo'] | null;
  projects: AgentProjectView[];
}

export interface ProjectsStore {
  agentSessionTombstones: Map<string, string>;
  agentSessionTranscriptRevisions: Map<string, number>;
  inventoryVersion: number;
  inflight: Promise<AgentProjectView[]> | null;
  inflightAbortController: AbortController | null;
  inflightKey: string | null;
  listeners: Set<(snapshot: ProjectsStoreSnapshot) => void>;
  removedProjectIds: Set<string>;
  snapshot: ProjectsStoreSnapshot;
}

export type AgentSessionItemMergeMode =
  | 'authority-window-reset'
  | 'latest'
  | 'ordered-window';

export interface AgentSessionStoreUpsertOptions {
  itemMergeMode?: AgentSessionItemMergeMode;
  acceptIncomingItemPageInfo?: boolean;
}

export interface AgentSessionProjectsStoreUpsertOptions
  extends AgentSessionStoreUpsertOptions {
  projectMetadata?: AgentProjectView;
}

export interface AgentSessionTranscriptRevisionSnapshot {
  agentId: string;
  hasMore: boolean;
  nextCursor: string | null;
  pageSize: number;
  revision: number;
}

export type AgentSessionStoreRemovalResult =
  | 'identity-mismatch'
  | 'invalid'
  | 'not-found'
  | 'removed';

/**
 * 最大缓存的 ProjectsStore scope 数量。
 *
 * 当缓存数量超过此上限时，会从最少访问的且无活跃监听器的 Scope Store 开始
 * 淘汰，确保长期运行的工作区切换不会导致内存无限增长。
 *
 * 默认值 5 个工作区 × 每工作区 ~200 agent sessions × 每 session ~10 transcript items
 * ≈ 10,000 个对象引用，在浏览器可承受范围内。
 */
const PROJECT_STORE_MAX_CACHED_SCOPES = 5;
const PROJECT_STORE_MAX_SCOPE_KEY_LENGTH = 384;

const projectStoresByScopeKey = new Map<string, ProjectsStore>();

/**
 * 更新 scope 的访问顺序，将其标记为最近访问。
 * 利用 Map 的插入顺序语义：删除并重新插入即可移至末尾（MRU 端）。
 */
function touchScopeAccess(scopeKey: string): void {
  const store = projectStoresByScopeKey.get(scopeKey);
  if (!store) {
    return;
  }
  projectStoresByScopeKey.delete(scopeKey);
  projectStoresByScopeKey.set(scopeKey, store);
}

/**
 * 淘汰最少访问的 scope store，直到缓存量回落至上限以内。
 *
 * 仅淘汰无活跃 listener 的 store，避免导致当前正在渲染的 UI 状态异常。
 * 若所有 store 均处于活跃状态，本次不强制淘汰，依赖下一次写入时再次尝试。
 */
function evictLeastRecentlyUsedScopes(): void {
  if (projectStoresByScopeKey.size <= PROJECT_STORE_MAX_CACHED_SCOPES) {
    return;
  }

  const overflow = projectStoresByScopeKey.size - PROJECT_STORE_MAX_CACHED_SCOPES;
  let evicted = 0;

  // 迭代器按照插入顺序返回（LRU 在前）
  const iterator = projectStoresByScopeKey.keys();
  while (evicted < overflow) {
    const next = iterator.next();
    if (next.done) {
      break;
    }
    const key = next.value;
    const store = projectStoresByScopeKey.get(key)!;
    if (store.listeners.size === 0) {
      // 无订阅者：可安全释放整个 store
      store.inflightAbortController?.abort(new DOMException(
        'Project inventory scope was evicted.',
        'AbortError',
      ));
      store.agentSessionTombstones.clear();
      store.agentSessionTranscriptRevisions.clear();
      projectStoresByScopeKey.delete(key);
      evicted += 1;
    }
  }
}

/**
 * 验证 scopeKey 构成合法性，防止超长 scopeKey 导致未绑定的 Map 增长。
 */
function assertValidScopeKey(scopeKey: string): void {
  if (scopeKey.length > PROJECT_STORE_MAX_SCOPE_KEY_LENGTH) {
    throw new Error(
      `Projects store scope key exceeds maximum length ${PROJECT_STORE_MAX_SCOPE_KEY_LENGTH}.`,
    );
  }
}

function buildAgentSessionTranscriptRevisionKey(
  projectId: string,
  agentSessionId: string,
): string {
  return `${projectId}\u0001${agentSessionId}`;
}

export function peekProjectsStore(scopeKey: string): ProjectsStore | null {
  return projectStoresByScopeKey.get(scopeKey) ?? null;
}

export function normalizeProjectsStoreUserScope(
  userId: string | null | undefined,
): string {
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
  return normalizedUserId || 'anonymous';
}

export function buildProjectsStoreScopeKey(
  userScope: string,
  workspaceId: string,
): string {
  const normalizedWorkspaceId = workspaceId.trim();
  if (!normalizedWorkspaceId) {
    throw new Error('Workspace ID is required for the Projects store scope.');
  }
  const scopeKey = `${normalizeProjectsStoreUserScope(userScope)}::${normalizedWorkspaceId}`;
  assertValidScopeKey(scopeKey);
  return scopeKey;
}

export function createProjectsStoreSnapshot(): ProjectsStoreSnapshot {
  return {
    error: null,
    hasFetched: false,
    isLoading: false,
    pageInfo: null,
    projects: [],
  };
}

function areProjectScalarsEqual(
  left: AgentProjectView,
  right: AgentProjectView,
): boolean {
  const hasEqualAgentSessionPageInfo =
    left.agentSessionPageInfo === right.agentSessionPageInfo ||
    (
      left.agentSessionPageInfo?.page === right.agentSessionPageInfo?.page &&
      left.agentSessionPageInfo?.pageSize === right.agentSessionPageInfo?.pageSize &&
      left.agentSessionPageInfo?.hasMore === right.agentSessionPageInfo?.hasMore
    );
  return (
    left.projectId === right.projectId &&
    left.workspaceId === right.workspaceId &&
    left.tenantId === right.tenantId &&
    left.organizationId === right.organizationId &&
    left.ownerUserId === right.ownerUserId &&
    left.name === right.name &&
    left.description === right.description &&
    left.visibility === right.visibility &&
    left.status === right.status &&
    left.driveAccessMode === right.driveAccessMode &&
    left.defaultAgentId === right.defaultAgentId &&
    left.defaultModelId === right.defaultModelId &&
    left.version === right.version &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    left.archivedAt === right.archivedAt &&
    hasEqualAgentSessionPageInfo
  );
}

function areAgentSessionScalarsEqual(
  left: AgentSessionView,
  right: AgentSessionView,
): boolean {
  const hasEqualItemPageInfo =
    left.itemPageInfo === right.itemPageInfo ||
    (
      left.itemPageInfo?.nextCursor === right.itemPageInfo?.nextCursor &&
      left.itemPageInfo?.pageSize === right.itemPageInfo?.pageSize &&
      left.itemPageInfo?.hasMore === right.itemPageInfo?.hasMore
    );
  return (
    left.id === right.id &&
    left.agentId === right.agentId &&
    left.projectId === right.projectId &&
    areAgentSessionActivitiesEqual(left.activity, right.activity) &&
    left.runtimeBindingId === right.runtimeBindingId &&
    left.runtimeLocationId === right.runtimeLocationId &&
    left.title === right.title &&
    left.status === right.status &&
    left.hostMode === right.hostMode &&
    left.engineId === right.engineId &&
    left.modelId === right.modelId &&
    left.providerId === right.providerId &&
    left.providerBindingId === right.providerBindingId &&
    left.transportKind === right.transportKind &&
    left.providerSessionId === right.providerSessionId &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    left.lastTurnAt === right.lastTurnAt &&
    left.sortTimestamp === right.sortTimestamp &&
    left.transcriptUpdatedAt === right.transcriptUpdatedAt &&
    left.lastMessageAt === right.lastMessageAt &&
    left.lastRuntimeEventAt === right.lastRuntimeEventAt &&
    left.lastAttentionAt === right.lastAttentionAt &&
    left.lastUserActivityAt === right.lastUserActivityAt &&
    left.serverVersion === right.serverVersion &&
    left.lastItemSequence === right.lastItemSequence &&
    left.lastReadItemSequence === right.lastReadItemSequence &&
    left.runtimeStatus === right.runtimeStatus &&
    left.displayTime === right.displayTime &&
    left.pinned === right.pinned &&
    left.archived === right.archived &&
    left.unread === right.unread &&
    hasEqualItemPageInfo
  );
}

function areAgentSessionActivitiesEqual(
  left: AgentSessionView['activity'],
  right: AgentSessionView['activity'],
): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  const leftVersions = left.versions;
  const rightVersions = right.versions;
  const leftTurn = left.latestTurn;
  const rightTurn = right.latestTurn;
  const leftInteraction = left.pendingInteraction;
  const rightInteraction = right.pendingInteraction;
  const leftBinding = left.runtimeBinding;
  const rightBinding = right.runtimeBinding;
  const leftProvider = left.provider;
  const rightProvider = right.provider;
  return (
    left.activityAt === right.activityAt &&
    left.source === right.source &&
    left.observedAt === right.observedAt &&
    left.freshUntil === right.freshUntil &&
    left.freshness === right.freshness &&
    left.phase === right.phase &&
    leftVersions.session === rightVersions.session &&
    leftVersions.latestTurn === rightVersions.latestTurn &&
    leftVersions.latestInteractionId === rightVersions.latestInteractionId &&
    leftVersions.latestInteraction === rightVersions.latestInteraction &&
    leftVersions.latestRuntimeBindingId === rightVersions.latestRuntimeBindingId &&
    leftVersions.latestRuntimeBinding === rightVersions.latestRuntimeBinding &&
    leftVersions.pendingInteraction === rightVersions.pendingInteraction &&
    leftVersions.currentRuntimeBinding === rightVersions.currentRuntimeBinding &&
    leftVersions.userState === rightVersions.userState &&
    (
      leftTurn === rightTurn || Boolean(
        leftTurn && rightTurn &&
        leftTurn.id === rightTurn.id &&
        leftTurn.status === rightTurn.status &&
        leftTurn.updatedAt === rightTurn.updatedAt &&
        leftTurn.version === rightTurn.version,
      )
    ) &&
    (
      leftInteraction === rightInteraction || Boolean(
        leftInteraction && rightInteraction &&
        leftInteraction.id === rightInteraction.id &&
        leftInteraction.kind === rightInteraction.kind &&
        leftInteraction.status === rightInteraction.status &&
        leftInteraction.updatedAt === rightInteraction.updatedAt &&
        leftInteraction.version === rightInteraction.version,
      )
    ) &&
    (
      leftBinding === rightBinding || Boolean(
        leftBinding && rightBinding &&
        leftBinding.id === rightBinding.id &&
        leftBinding.status === rightBinding.status &&
        leftBinding.updatedAt === rightBinding.updatedAt &&
        leftBinding.version === rightBinding.version,
      )
    ) &&
    (
      leftProvider === rightProvider || Boolean(
        leftProvider && rightProvider &&
        leftProvider.state === rightProvider.state &&
        leftProvider.freshness === rightProvider.freshness &&
        leftProvider.evidenceKind === rightProvider.evidenceKind &&
        leftProvider.interactionHint === rightProvider.interactionHint &&
        leftProvider.observedAt === rightProvider.observedAt &&
        leftProvider.freshUntil === rightProvider.freshUntil,
      )
    )
  );
}

export function areCollectionsReferentiallyEqual<TValue>(
  left: readonly TValue[],
  right: readonly TValue[],
): boolean {
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => Object.is(value, right[index]));
}

function areProjectsStoreSnapshotsEqual(
  left: ProjectsStoreSnapshot,
  right: ProjectsStoreSnapshot,
): boolean {
  return (
    left.error === right.error &&
    left.hasFetched === right.hasFetched &&
    left.isLoading === right.isLoading &&
    left.pageInfo === right.pageInfo &&
    left.projects === right.projects
  );
}

export function reuseProjectCollectionIfUnchanged(
  previousProjects: readonly AgentProjectView[],
  nextProjects: readonly AgentProjectView[],
): AgentProjectView[] {
  return areCollectionsReferentiallyEqual(previousProjects, nextProjects)
    ? (previousProjects as AgentProjectView[])
    : [...nextProjects];
}

function buildAgentSessionStoreVersion(
  agentSession: AgentSessionView,
  itemCount: number = agentSession.items.length,
): string {
  return buildAgentSessionViewSynchronizationVersion(agentSession, itemCount);
}

function areAgentSessionItemCollectionsEquivalent(
  leftItems: readonly AgentSessionItemView[],
  rightItems: readonly AgentSessionItemView[],
): boolean {
  if (leftItems === rightItems) {
    return true;
  }

  if (leftItems.length !== rightItems.length) {
    return false;
  }

  return leftItems.every((item, index) =>
    areAgentSessionItemsEquivalent(item, rightItems[index]!),
  );
}

function canReuseAgentSessionItems(
  existingAgentSession: AgentSessionView,
  incomingAgentSession: AgentSessionView,
): boolean {
  const existingItems = existingAgentSession.items;
  const incomingItems = incomingAgentSession.items;

  if (incomingItems.length === 0) {
    return existingItems.length > 0;
  }

  if (existingItems.length !== incomingItems.length) {
    return false;
  }

  if (
    buildAgentSessionStoreVersion(existingAgentSession, existingItems.length) !==
    buildAgentSessionStoreVersion(incomingAgentSession, incomingItems.length)
  ) {
    return false;
  }

  return areAgentSessionItemCollectionsEquivalent(existingItems, incomingItems);
}

function filterAgentSessionItemsForStore(
  agentSessionId: string,
  items: readonly AgentSessionItemView[],
): AgentSessionItemView[] {
  const normalizedAgentSessionId = agentSessionId.trim();
  if (!normalizedAgentSessionId || items.length === 0) {
    return [];
  }

  let scopedItems: AgentSessionItemView[] | null = null;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    if (item.sessionId.trim() === normalizedAgentSessionId) {
      scopedItems?.push(item);
      continue;
    }

    if (!scopedItems) {
      scopedItems = items.slice(0, index) as AgentSessionItemView[];
    }
  }

  return scopedItems ?? (items as AgentSessionItemView[]);
}

function normalizeAgentSessionItemsForStore(
  agentSessionId: string,
  items: readonly AgentSessionItemView[],
): AgentSessionItemView[] {
  return deduplicateAgentSessionItemViews(
    filterAgentSessionItemsForStore(agentSessionId, items),
  );
}

interface CloneAgentSessionForStoreOptions extends AgentSessionStoreUpsertOptions {
  preserveEmptyItems?: boolean;
  projectId?: string;
}

function normalizeAgentSessionProjectScope(
  agentSession: AgentSessionView,
  projectId?: string,
): AgentSessionView {
  const normalizedProjectId = projectId?.trim() ?? '';
  if (normalizedProjectId && agentSession.projectId !== normalizedProjectId) {
    throw new Error(
      `Agent session ${agentSession.id} does not belong to Agents project ${normalizedProjectId}.`,
    );
  }
  return agentSession;
}

function compareOptionalStoreVersion(
  incoming: string | undefined,
  existing: string | undefined,
): number {
  if (incoming === existing) {
    return 0;
  }
  if (incoming === undefined) {
    return -1;
  }
  if (existing === undefined) {
    return 1;
  }
  return compareWorkbenchLongIntegers(incoming, existing);
}

function resolveLatestTimestamp(
  existing: string | null | undefined,
  incoming: string | null | undefined,
): string | null | undefined {
  const existingTimestamp = existing ? Date.parse(existing) : Number.NaN;
  const incomingTimestamp = incoming ? Date.parse(incoming) : Number.NaN;
  if (!Number.isFinite(existingTimestamp)) {
    return incoming;
  }
  if (!Number.isFinite(incomingTimestamp)) {
    return existing;
  }
  return incomingTimestamp > existingTimestamp ? incoming : existing;
}

function isSameActivityRecordVersionRegression(
  incomingId: string | undefined,
  incomingVersion: string | undefined,
  existingId: string | undefined,
  existingVersion: string | undefined,
): boolean {
  return incomingId !== undefined
    && incomingId === existingId
    && compareOptionalStoreVersion(incomingVersion, existingVersion) < 0;
}

function hasAgentSessionActivityRegression(
  existing: NonNullable<AgentSessionView['activity']>,
  incoming: NonNullable<AgentSessionView['activity']>,
): boolean {
  if (compareOptionalStoreVersion(incoming.versions.session, existing.versions.session) < 0) {
    return true;
  }
  if (
    (existing.latestTurn && !incoming.latestTurn)
    || (existing.versions.latestInteractionId && !incoming.versions.latestInteractionId)
    || (existing.versions.latestRuntimeBindingId && !incoming.versions.latestRuntimeBindingId)
    || (existing.versions.userState && !incoming.versions.userState)
  ) {
    return true;
  }
  return isSameActivityRecordVersionRegression(
    incoming.latestTurn?.id,
    incoming.versions.latestTurn,
    existing.latestTurn?.id,
    existing.versions.latestTurn,
  ) || isSameActivityRecordVersionRegression(
    incoming.versions.latestInteractionId,
    incoming.versions.latestInteraction,
    existing.versions.latestInteractionId,
    existing.versions.latestInteraction,
  ) || isSameActivityRecordVersionRegression(
    incoming.versions.latestRuntimeBindingId,
    incoming.versions.latestRuntimeBinding,
    existing.versions.latestRuntimeBindingId,
    existing.versions.latestRuntimeBinding,
  ) || isSameActivityRecordVersionRegression(
    incoming.pendingInteraction?.id,
    incoming.versions.pendingInteraction,
    existing.pendingInteraction?.id,
    existing.versions.pendingInteraction,
  ) || (
    incoming.runtimeBinding?.id !== undefined
    && incoming.runtimeBinding.id === existing.runtimeBinding?.id
    && compareOptionalStoreVersion(
      incoming.versions.currentRuntimeBinding,
      existing.versions.currentRuntimeBinding,
    ) < 0
  ) || compareOptionalStoreVersion(
    incoming.versions.userState,
    existing.versions.userState,
  ) < 0;
}

function hasNewerAgentSessionActivityComponent(
  existing: NonNullable<AgentSessionView['activity']>,
  incoming: NonNullable<AgentSessionView['activity']>,
): boolean {
  if (compareOptionalStoreVersion(incoming.versions.session, existing.versions.session) > 0) {
    return true;
  }
  const recordVersions: ReadonlyArray<readonly [
    string | undefined,
    string | undefined,
    string | undefined,
    string | undefined,
  ]> = [
    [incoming.latestTurn?.id, incoming.versions.latestTurn,
      existing.latestTurn?.id, existing.versions.latestTurn],
    [incoming.versions.latestInteractionId, incoming.versions.latestInteraction,
      existing.versions.latestInteractionId, existing.versions.latestInteraction],
    [incoming.versions.latestRuntimeBindingId, incoming.versions.latestRuntimeBinding,
      existing.versions.latestRuntimeBindingId, existing.versions.latestRuntimeBinding],
    [incoming.pendingInteraction?.id, incoming.versions.pendingInteraction,
      existing.pendingInteraction?.id, existing.versions.pendingInteraction],
  ];
  if (recordVersions.some(([incomingId, incomingVersion, existingId, existingVersion]) =>
    incomingId !== undefined
    && incomingId === existingId
    && compareOptionalStoreVersion(incomingVersion, existingVersion) > 0,
  )) {
    return true;
  }
  if (
    incoming.runtimeBinding?.id !== undefined
    && incoming.runtimeBinding.id === existing.runtimeBinding?.id
    && compareOptionalStoreVersion(
      incoming.versions.currentRuntimeBinding,
      existing.versions.currentRuntimeBinding,
    ) > 0
  ) {
    return true;
  }
  if (compareOptionalStoreVersion(incoming.versions.userState, existing.versions.userState) > 0) {
    return true;
  }
  const existingProviderAt = existing.provider?.observedAt
    ? Date.parse(existing.provider.observedAt)
    : Number.NaN;
  const incomingProviderAt = incoming.provider?.observedAt
    ? Date.parse(incoming.provider.observedAt)
    : Number.NaN;
  return Number.isFinite(incomingProviderAt)
    && (!Number.isFinite(existingProviderAt) || incomingProviderAt > existingProviderAt);
}

function shouldRetainExistingActivityProjection(
  existing: AgentSessionView,
  incoming: AgentSessionView,
): boolean {
  if (!existing.activity) {
    return false;
  }
  if (!incoming.activity) {
    return true;
  }
  if (hasAgentSessionActivityRegression(existing.activity, incoming.activity)) {
    return true;
  }
  if (hasNewerAgentSessionActivityComponent(existing.activity, incoming.activity)) {
    return false;
  }
  return Date.parse(incoming.activity.activityAt) <= Date.parse(existing.activity.activityAt);
}

function resolveLaterLongInteger(
  existing: string | undefined,
  incoming: string | undefined,
): string | undefined {
  return compareOptionalStoreVersion(incoming, existing) >= 0 ? incoming : existing;
}

function mergeMonotonicSessionItemPageInfo(
  existing: AgentSessionView['itemPageInfo'],
  incoming: AgentSessionView['itemPageInfo'],
): AgentSessionView['itemPageInfo'] {
  if (!existing || !incoming) {
    return incoming ?? existing;
  }
  return existing;
}

function isTransientAgentSessionItem(item: AgentSessionItemView): boolean {
  return item.metadata?.transient === true;
}

function mergeResetAgentSessionItemWindow(
  existingItems: readonly AgentSessionItemView[],
  incomingItems: readonly AgentSessionItemView[],
): AgentSessionItemView[] {
  const mergedItems = mergeLatestAgentSessionItems(
    existingItems.filter(isTransientAgentSessionItem),
    incomingItems,
  );
  return [
    ...mergedItems.filter((item) => !isTransientAgentSessionItem(item)),
    ...mergedItems.filter(isTransientAgentSessionItem),
  ];
}

export function mergeAgentSessionProjectionForStore(
  existing: AgentSessionView,
  incoming: AgentSessionView,
  options: AgentSessionStoreUpsertOptions = {},
): AgentSessionView {
  if (existing.id !== incoming.id || existing.projectId !== incoming.projectId) {
    throw new Error('Incoming Agents Session projection does not match the Store identity.');
  }

  const retainExistingActivity = shouldRetainExistingActivityProjection(existing, incoming);
  const existingSessionVersion = existing.activity?.versions.session ?? existing.serverVersion;
  const incomingSessionVersion = incoming.activity?.versions.session ?? incoming.serverVersion;
  const sessionVersionComparison = compareOptionalStoreVersion(
    incomingSessionVersion,
    existingSessionVersion,
  );
  const retainExistingSession = sessionVersionComparison < 0 || (
    sessionVersionComparison === 0
    && Date.parse(incoming.updatedAt) < Date.parse(existing.updatedAt)
  );
  const hasAuthoritativeTerminalStatus = (
    incoming.status === 'completed' || incoming.status === 'archived'
  ) && sessionVersionComparison > 0;
  const retainExistingRuntime = retainExistingActivity && !hasAuthoritativeTerminalStatus;
  const lastItemSequence = resolveLaterLongInteger(
    existing.lastItemSequence,
    incoming.lastItemSequence,
  );
  const lastReadItemSequence = retainExistingActivity
    ? existing.lastReadItemSequence
    : incoming.lastReadItemSequence;
  const unread = lastReadItemSequence !== undefined && lastItemSequence !== undefined
    ? lastReadItemSequence !== lastItemSequence
    : retainExistingActivity
      ? existing.unread
      : incoming.unread;

  return {
    ...incoming,
    agentId: retainExistingSession ? existing.agentId : incoming.agentId,
    activity: retainExistingActivity ? existing.activity : incoming.activity,
    runtimeBindingId: retainExistingActivity
      ? existing.runtimeBindingId
      : incoming.runtimeBindingId,
    runtimeLocationId: retainExistingActivity
      ? existing.runtimeLocationId
      : incoming.runtimeLocationId,
    // Activity can legitimately be newer than a plain inventory projection,
    // but the inventory still carries the latest provider/user-state title.
    title: retainExistingSession ? existing.title : incoming.title,
    status: retainExistingSession ? existing.status : incoming.status,
    hostMode: retainExistingActivity ? existing.hostMode : incoming.hostMode,
    engineId: retainExistingActivity ? existing.engineId : incoming.engineId,
    modelId: retainExistingActivity ? existing.modelId : incoming.modelId,
    providerId: retainExistingActivity ? existing.providerId : incoming.providerId,
    providerBindingId: retainExistingActivity
      ? existing.providerBindingId
      : incoming.providerBindingId,
    transportKind: retainExistingActivity ? existing.transportKind : incoming.transportKind,
    providerSessionId: retainExistingActivity
      ? existing.providerSessionId
      : incoming.providerSessionId,
    runtimeStatus: retainExistingRuntime ? existing.runtimeStatus : incoming.runtimeStatus,
    createdAt: retainExistingSession ? existing.createdAt : incoming.createdAt,
    updatedAt: resolveLatestTimestamp(existing.updatedAt, incoming.updatedAt) ?? incoming.updatedAt,
    lastTurnAt: resolveLatestTimestamp(existing.lastTurnAt, incoming.lastTurnAt) ?? undefined,
    lastMessageAt: resolveLatestTimestamp(existing.lastMessageAt, incoming.lastMessageAt) ?? undefined,
    lastRuntimeEventAt:
      resolveLatestTimestamp(existing.lastRuntimeEventAt, incoming.lastRuntimeEventAt) ?? undefined,
    lastAttentionAt:
      resolveLatestTimestamp(existing.lastAttentionAt, incoming.lastAttentionAt) ?? undefined,
    lastUserActivityAt:
      resolveLatestTimestamp(existing.lastUserActivityAt, incoming.lastUserActivityAt) ?? undefined,
    transcriptUpdatedAt:
      resolveLatestTimestamp(existing.transcriptUpdatedAt, incoming.transcriptUpdatedAt),
    serverVersion: resolveLaterLongInteger(existing.serverVersion, incoming.serverVersion),
    lastItemSequence,
    lastReadItemSequence,
    pinned: retainExistingActivity ? existing.pinned : incoming.pinned,
    archived: incoming.status === 'archived'
      ? true
      : retainExistingActivity
        ? existing.archived
        : incoming.archived,
    unread,
    displayTime: retainExistingActivity ? existing.displayTime : incoming.displayTime,
    itemPageInfo: options.itemMergeMode === 'authority-window-reset'
      ? incoming.itemPageInfo
      : options.acceptIncomingItemPageInfo
        ? incoming.itemPageInfo ?? existing.itemPageInfo
        : mergeMonotonicSessionItemPageInfo(
            existing.itemPageInfo,
            incoming.itemPageInfo,
          ),
    items: options.itemMergeMode === 'authority-window-reset'
      ? mergeResetAgentSessionItemWindow(existing.items, incoming.items)
      : incoming.items.length === 0
        ? existing.items
        : options.itemMergeMode === 'ordered-window'
          ? mergeOrderedAgentSessionItemWindow(existing.items, incoming.items)
          : mergeLatestAgentSessionItems(existing.items, incoming.items),
    sortTimestamp: String(Math.max(
      Number(existing.sortTimestamp) || 0,
      Number(incoming.sortTimestamp) || 0,
    )),
  };
}

function mergeOrderedAgentSessionItemWindow(
  existingItems: readonly AgentSessionItemView[],
  orderedIncomingItems: readonly AgentSessionItemView[],
): AgentSessionItemView[] {
  const latestMergedItems = mergeLatestAgentSessionItems(
    existingItems,
    orderedIncomingItems,
  );
  const latestItemMatchIndex = buildAgentSessionItemMatchIndex(latestMergedItems);
  const incomingItemMatchIndex = buildAgentSessionItemMatchIndex(orderedIncomingItems);
  const orderedItems = orderedIncomingItems.map((incomingItem) => {
    const matchingIndex = latestItemMatchIndex.findMatchingIndex(incomingItem);
    return matchingIndex >= 0 ? latestMergedItems[matchingIndex]! : incomingItem;
  });
  const concurrentItems = latestMergedItems.filter((candidate) =>
    incomingItemMatchIndex.findMatchingIndex(candidate) < 0,
  );
  return deduplicateAgentSessionItemViews([...orderedItems, ...concurrentItems]);
}

function cloneAgentSessionForStore(
  agentSession: AgentSessionView,
  existingAgentSession?: AgentSessionView,
  options: CloneAgentSessionForStoreOptions = {},
): AgentSessionView {
  const preserveEmptyItems = (options.preserveEmptyItems ?? true)
    && options.itemMergeMode !== 'authority-window-reset';
  const projectScopedAgentSession = normalizeAgentSessionProjectScope(
    agentSession,
    options.projectId,
  );
  const activityScopedAgentSession = existingAgentSession
    ? mergeAgentSessionProjectionForStore(
        existingAgentSession,
        projectScopedAgentSession,
        options,
      )
    : projectScopedAgentSession;
  const incomingItems =
    activityScopedAgentSession.items.length > 0
      ? normalizeAgentSessionItemsForStore(
          activityScopedAgentSession.id,
          activityScopedAgentSession.items,
        )
      : (activityScopedAgentSession.items as AgentSessionItemView[]);
  const scopedAgentSession =
    incomingItems === activityScopedAgentSession.items
      ? activityScopedAgentSession
      : {
          ...activityScopedAgentSession,
          items: incomingItems,
        };
  const items =
    activityScopedAgentSession.items.length === 0
      ? preserveEmptyItems
        ? normalizeAgentSessionItemsForStore(
            activityScopedAgentSession.id,
            existingAgentSession?.items ?? [],
          )
        : []
      : incomingItems.length === 0
        ? []
        : existingAgentSession && canReuseAgentSessionItems(existingAgentSession, scopedAgentSession)
        ? existingAgentSession.items
        : incomingItems;

  const sortTimestamp = resolveAgentSessionViewSortTimestampString(scopedAgentSession);
  const nextAgentSession = {
    ...scopedAgentSession,
    items,
    sortTimestamp,
    displayTime: formatAgentSessionActivityDisplayTime({
      ...scopedAgentSession,
      sortTimestamp,
    }),
  };

  return existingAgentSession &&
    areAgentSessionScalarsEqual(existingAgentSession, nextAgentSession) &&
    existingAgentSession.items === nextAgentSession.items
    ? existingAgentSession
    : nextAgentSession;
}

function compareAgentSessionsForStore(
  left: AgentSessionView,
  right: AgentSessionView,
): number {
  return (
    compareAgentSessionViewSortTimestamps(right, left) ||
    left.id.localeCompare(right.id)
  );
}

function sortAgentSessionsForStore(
  agentSessions: readonly AgentSessionView[],
): AgentSessionView[] {
  if (agentSessions.length < 2) {
    return agentSessions as AgentSessionView[];
  }

  for (let index = 1; index < agentSessions.length; index += 1) {
    if (compareAgentSessionsForStore(agentSessions[index - 1], agentSessions[index]) > 0) {
      return [...agentSessions].sort(compareAgentSessionsForStore);
    }
  }

  return agentSessions as AgentSessionView[];
}

function compareProjectsForStore(
  left: AgentProjectView,
  right: AgentProjectView,
): number {
  return compareWorkbenchProjectsByActivity(left, right);
}

function sortProjectsForStore(projects: readonly AgentProjectView[]): AgentProjectView[] {
  if (projects.length < 2) {
    return projects as AgentProjectView[];
  }

  for (let index = 1; index < projects.length; index += 1) {
    if (compareProjectsForStore(projects[index - 1], projects[index]) > 0) {
      return [...projects].sort(compareProjectsForStore);
    }
  }

  return projects as AgentProjectView[];
}

function reconcileProjectAgentSessionsForStore(
  projectId: string,
  incomingAgentSessions: readonly AgentSessionView[],
  existingAgentSessions: readonly AgentSessionView[],
): AgentSessionView[] {
  const existingAgentSessionsById = new Map(
    existingAgentSessions.map((agentSession) => [agentSession.id, agentSession]),
  );
  const nextAgentSessionsById = new Map<string, AgentSessionView>();

  incomingAgentSessions.forEach((agentSession) => {
    const mergedAgentSession = cloneAgentSessionForStore(
      agentSession,
      nextAgentSessionsById.get(agentSession.id) ??
        existingAgentSessionsById.get(agentSession.id),
      { projectId },
    );
    nextAgentSessionsById.set(agentSession.id, mergedAgentSession);
  });

  return sortAgentSessionsForStore(Array.from(nextAgentSessionsById.values()));
}

function mergeProjectForStore(
  existingProject: AgentProjectView | undefined,
  incomingProject: AgentProjectView,
): AgentProjectView {
  const incomingProjectAgentSessions =
    incomingProject.agentSessions.length === 0 &&
    (existingProject?.agentSessions.length ?? 0) > 0
      ? existingProject!.agentSessions
      : incomingProject.agentSessions;
  const nextAgentSessions = reconcileProjectAgentSessionsForStore(
    incomingProject.projectId,
    incomingProjectAgentSessions,
    existingProject?.agentSessions ?? [],
  );
  const nextProject = {
    ...incomingProject,
    agentSessionPageInfo:
      incomingProject.agentSessionPageInfo ?? existingProject?.agentSessionPageInfo,
    agentSessions: nextAgentSessions,
  };

  return existingProject &&
    areProjectScalarsEqual(existingProject, nextProject) &&
    areCollectionsReferentiallyEqual(
      existingProject.agentSessions,
      nextProject.agentSessions,
    )
    ? existingProject
    : nextProject;
}

export function upsertProjectIntoCollection(
  projects: readonly AgentProjectView[],
  incomingProject: AgentProjectView,
): AgentProjectView[] {
  const existingProject = projects.find(
    (project) => project.projectId === incomingProject.projectId,
  );
  const mergedProject = mergeProjectForStore(existingProject, incomingProject);
  return reuseProjectCollectionIfUnchanged(
    projects,
    sortProjectsForStore([
      ...projects.filter((project) => project.projectId !== incomingProject.projectId),
      mergedProject,
    ]),
  );
}

export function mergeProjectsForStore(
  existingProjects: readonly AgentProjectView[],
  incomingProjects: readonly AgentProjectView[],
): AgentProjectView[] {
  const existingProjectsById = new Map(
    existingProjects.map((project) => [project.projectId, project]),
  );
  const nextProjectsById = new Map<string, AgentProjectView>();
  incomingProjects.forEach((project) => {
    const mergedProject = mergeProjectForStore(
      nextProjectsById.get(project.projectId) ?? existingProjectsById.get(project.projectId),
      project,
    );
    nextProjectsById.set(project.projectId, mergedProject);
  });
  return reuseProjectCollectionIfUnchanged(
    existingProjects,
    sortProjectsForStore(Array.from(nextProjectsById.values())),
  );
}

export function updateProjectInCollection(
  projects: readonly AgentProjectView[],
  projectId: string,
  updates: Partial<AgentProjectView>,
): AgentProjectView[] {
  const nextTimestamp = new Date().toISOString();
  return reuseProjectCollectionIfUnchanged(
    projects,
    sortProjectsForStore(
      projects.map((project) =>
        project.projectId === projectId
          ? {
              ...project,
              ...updates,
              agentSessions: sortAgentSessionsForStore(project.agentSessions),
              updatedAt: updates.updatedAt ?? nextTimestamp,
            }
          : project,
      ),
    ),
  );
}

export function removeProjectFromCollection(
  projects: readonly AgentProjectView[],
  projectId: string,
): AgentProjectView[] {
  return reuseProjectCollectionIfUnchanged(
    projects,
    sortProjectsForStore(projects.filter((project) => project.projectId !== projectId)),
  );
}

export function filterProjectsForInventoryStore(
  store: ProjectsStore,
  projects: readonly AgentProjectView[],
): AgentProjectView[] {
  return projects.flatMap((project) => {
    if (project.status === 'deleted' || store.removedProjectIds.has(project.projectId)) {
      return [];
    }

    const agentSessions = project.agentSessions.filter((agentSession) =>
      canCommitAgentSessionAgainstProjectsStoreTombstones(
        store,
        project.projectId,
        agentSession,
      ),
    );
    return agentSessions.length === project.agentSessions.length
      ? [project]
      : [{ ...project, agentSessions }];
  });
}

export function upsertAgentSessionIntoCollection(
  projects: readonly AgentProjectView[],
  projectId: string,
  agentSession: AgentSessionView,
  options: AgentSessionStoreUpsertOptions = {},
): AgentProjectView[] {
  const projectIndex = projects.findIndex((project) => project.projectId === projectId);
  if (projectIndex < 0) {
    return projects as AgentProjectView[];
  }

  const project = projects[projectIndex]!;
  const existingAgentSessionIndex = project.agentSessions.findIndex(
    (candidateAgentSession) => candidateAgentSession.id === agentSession.id,
  );
  const existingAgentSession =
    existingAgentSessionIndex >= 0
      ? project.agentSessions[existingAgentSessionIndex]
      : undefined;
  const nextAgentSession = cloneAgentSessionForStore(
    agentSession,
    existingAgentSession,
    { ...options, preserveEmptyItems: false, projectId },
  );
  let unsortedAgentSessions: readonly AgentSessionView[];
  if (existingAgentSessionIndex >= 0) {
    if (project.agentSessions[existingAgentSessionIndex] === nextAgentSession) {
      unsortedAgentSessions = project.agentSessions;
    } else {
      const replacedAgentSessions = [...project.agentSessions];
      replacedAgentSessions[existingAgentSessionIndex] = nextAgentSession;
      unsortedAgentSessions = replacedAgentSessions;
    }
  } else {
    unsortedAgentSessions = [
      ...project.agentSessions,
      nextAgentSession,
    ];
  }
  const nextAgentSessions = sortAgentSessionsForStore(unsortedAgentSessions);
  const nextProject = {
    ...project,
    agentSessions: nextAgentSessions,
  };
  const mergedProject =
    areProjectScalarsEqual(project, nextProject) &&
    project.agentSessions === nextProject.agentSessions
      ? project
      : nextProject;

  if (mergedProject === project) {
    return projects as AgentProjectView[];
  }

  const nextProjects = [...projects];
  nextProjects[projectIndex] = mergedProject;
  return reuseProjectCollectionIfUnchanged(
    projects,
    sortProjectsForStore(nextProjects),
  );
}

function finalizeAgentSessionForStore(
  agentSession: AgentSessionView,
  existingAgentSession?: AgentSessionView,
): AgentSessionView {
  const normalizedItems = normalizeAgentSessionItemsForStore(
    agentSession.id,
    agentSession.items,
  );
  const items = existingAgentSession && areAgentSessionItemCollectionsEquivalent(
    existingAgentSession.items,
    normalizedItems,
  )
    ? existingAgentSession.items
    : normalizedItems;
  const sortTimestamp = resolveAgentSessionViewSortTimestampString(agentSession);
  const nextAgentSession = {
    ...agentSession,
    items,
    sortTimestamp,
    displayTime: formatAgentSessionActivityDisplayTime({
      ...agentSession,
      sortTimestamp,
    }),
  };
  return existingAgentSession
    && areAgentSessionScalarsEqual(existingAgentSession, nextAgentSession)
    && existingAgentSession.items === nextAgentSession.items
    ? existingAgentSession
    : nextAgentSession;
}

export function updateAgentSessionInCollection(
  projects: readonly AgentProjectView[],
  projectId: string,
  agentSessionId: string,
  updater: (agentSession: AgentSessionView) => AgentSessionView,
): AgentProjectView[] {
  const projectIndex = projects.findIndex((project) => project.projectId === projectId);
  if (projectIndex < 0) {
    return projects as AgentProjectView[];
  }

  const project = projects[projectIndex]!;
  const currentAgentSessionIndex = project.agentSessions.findIndex(
    (candidateAgentSession) => candidateAgentSession.id === agentSessionId,
  );
  if (currentAgentSessionIndex < 0) {
    return projects as AgentProjectView[];
  }

  const currentAgentSession = project.agentSessions[currentAgentSessionIndex]!;
  const projectScopedAgentSession = normalizeAgentSessionProjectScope(
    currentAgentSession,
    projectId,
  );
  const updatedAgentSession = updater(projectScopedAgentSession);
  if (updatedAgentSession === projectScopedAgentSession) {
    return projects as AgentProjectView[];
  }
  const nextAgentSession = finalizeAgentSessionForStore(
    normalizeAgentSessionProjectScope(
      updatedAgentSession,
      projectId,
    ),
    currentAgentSession,
  );
  let unsortedAgentSessions: readonly AgentSessionView[];
  if (project.agentSessions[currentAgentSessionIndex] === nextAgentSession) {
    unsortedAgentSessions = project.agentSessions;
  } else {
    const replacedAgentSessions = [...project.agentSessions];
    replacedAgentSessions[currentAgentSessionIndex] = nextAgentSession;
    unsortedAgentSessions = replacedAgentSessions;
  }
  const nextAgentSessions = sortAgentSessionsForStore(unsortedAgentSessions);
  const nextProject = {
    ...project,
    agentSessions: nextAgentSessions,
  };
  const mergedProject =
    areProjectScalarsEqual(project, nextProject) &&
    project.agentSessions === nextProject.agentSessions
      ? project
      : nextProject;

  if (mergedProject === project) {
    return projects as AgentProjectView[];
  }

  const nextProjects = [...projects];
  nextProjects[projectIndex] = mergedProject;
  return reuseProjectCollectionIfUnchanged(
    projects,
    sortProjectsForStore(nextProjects),
  );
}

export function removeAgentSessionFromCollection(
  projects: readonly AgentProjectView[],
  projectId: string,
  agentSessionId: string,
): AgentProjectView[] {
  const projectIndex = projects.findIndex((project) => project.projectId === projectId);
  if (projectIndex < 0) {
    return projects as AgentProjectView[];
  }

  const project = projects[projectIndex]!;
  const agentSessionIndex = project.agentSessions.findIndex(
    (agentSession) => agentSession.id === agentSessionId,
  );
  if (agentSessionIndex < 0) {
    return projects as AgentProjectView[];
  }

  const nextAgentSessions = [...project.agentSessions];
  nextAgentSessions.splice(agentSessionIndex, 1);
  const nextProjects = [...projects];
  nextProjects[projectIndex] = {
    ...project,
    agentSessions: nextAgentSessions,
  };

  return reuseProjectCollectionIfUnchanged(
    projects,
    sortProjectsForStore(nextProjects),
  );
}

/**
 * Evict a Session only from the authenticated Workspace store that observed
 * its confirmed 404. An optional Agent guard prevents an older request from
 * deleting a newer Session projection with the same Session id.
 */
export function removeAgentSessionFromProjectsStore(
  scopeKey: string,
  projectId: string,
  agentSessionId: string,
  expectedAgentId?: string,
): AgentSessionStoreRemovalResult {
  const normalizedProjectId = projectId.trim();
  const normalizedSessionId = agentSessionId.trim();
  const normalizedAgentId = expectedAgentId?.trim() ?? '';
  if (!scopeKey || !normalizedProjectId || !normalizedSessionId) {
    return 'invalid';
  }
  const store = peekProjectsStore(scopeKey);
  const currentSession = store?.snapshot.projects
    .find((project) => project.projectId === normalizedProjectId)
    ?.agentSessions
    .find((session) => session.id === normalizedSessionId);
  if (!store || !currentSession) {
    return 'not-found';
  }
  if (normalizedAgentId && currentSession.agentId !== normalizedAgentId) {
    return 'identity-mismatch';
  }
  const revisionKey = buildAgentSessionTranscriptRevisionKey(
    normalizedProjectId,
    normalizedSessionId,
  );
  mutateProjectsStoreByScopeKey(scopeKey, (projects) => {
    store.agentSessionTranscriptRevisions.set(
      revisionKey,
      (store.agentSessionTranscriptRevisions.get(revisionKey) ?? 0) + 1,
    );
    return removeAgentSessionFromCollection(
      projects,
      normalizedProjectId,
      normalizedSessionId,
    );
  });
  return 'removed';
}

export function getProjectsStore(scopeKey: string): ProjectsStore {
  assertValidScopeKey(scopeKey);
  let store = projectStoresByScopeKey.get(scopeKey);
  if (store) {
    // 已在缓存：更新访问顺序（移至 MRU 端）
    touchScopeAccess(scopeKey);
    return store;
  }

  // 新建 store 并执行 LRU 淘汰检查
  store = {
    agentSessionTombstones: new Map(),
    agentSessionTranscriptRevisions: new Map(),
    inventoryVersion: 0,
    inflight: null,
    inflightAbortController: null,
    inflightKey: null,
    listeners: new Set(),
    removedProjectIds: new Set(),
    snapshot: createProjectsStoreSnapshot(),
  };
  projectStoresByScopeKey.set(scopeKey, store);
  evictLeastRecentlyUsedScopes();
  return store;
}

function emitProjectsStoreSnapshot(store: ProjectsStore): void {
  const snapshot = store.snapshot;
  store.listeners.forEach((listener) => {
    listener(snapshot);
  });
}

export function updateProjectsStoreSnapshot(
  store: ProjectsStore,
  updater: (previousSnapshot: ProjectsStoreSnapshot) => ProjectsStoreSnapshot,
): void {
  const nextSnapshot = updater(store.snapshot);
  if (areProjectsStoreSnapshotsEqual(store.snapshot, nextSnapshot)) {
    return;
  }

  store.snapshot = nextSnapshot;
  emitProjectsStoreSnapshot(store);
}

function buildAgentSessionTombstoneKey(projectId: string, sessionId: string): string {
  return `${projectId}\u0001${sessionId}`;
}

function normalizeAgentSessionTombstoneVersion(version: string | undefined): string | null {
  const normalizedVersion = version?.trim() ?? '';
  return /^\d+$/u.test(normalizedVersion) ? normalizedVersion : null;
}

function resolveAgentSessionStoreVersion(agentSession: AgentSessionView): string | null {
  const activityVersion = normalizeAgentSessionTombstoneVersion(
    agentSession.activity?.versions.session,
  );
  const serverVersion = normalizeAgentSessionTombstoneVersion(agentSession.serverVersion);
  if (activityVersion === null) {
    return serverVersion;
  }
  if (serverVersion === null) {
    return activityVersion;
  }
  return compareWorkbenchLongIntegers(activityVersion, serverVersion) >= 0
    ? activityVersion
    : serverVersion;
}

function canCommitAgentSessionAgainstProjectsStoreTombstones(
  store: ProjectsStore | null,
  projectId: string,
  agentSession: AgentSessionView,
): boolean {
  const normalizedProjectId = projectId.trim();
  const normalizedSessionId = agentSession.id.trim();
  if (
    !normalizedProjectId
    || agentSession.projectId !== normalizedProjectId
    || !normalizedSessionId
    || agentSession.id !== normalizedSessionId
  ) {
    return false;
  }
  const tombstoneVersion = store?.agentSessionTombstones.get(
    buildAgentSessionTombstoneKey(normalizedProjectId, normalizedSessionId),
  );
  if (tombstoneVersion === undefined) {
    return true;
  }
  const sessionVersion = resolveAgentSessionStoreVersion(agentSession);
  return sessionVersion !== null
    && compareWorkbenchLongIntegers(sessionVersion, tombstoneVersion) > 0;
}

export function canApplyAgentSessionTombstone(
  current: AgentSessionView,
  tombstone: AgentSessionView,
): boolean {
  if (current.id !== tombstone.id || current.projectId !== tombstone.projectId) {
    throw new Error('Agents Session tombstone does not match the current Store identity.');
  }
  const tombstoneVersion = resolveAgentSessionStoreVersion(tombstone);
  if (tombstoneVersion === null) {
    throw new Error('Deleted Agents Session tombstone is missing its Session version.');
  }
  const currentVersion = resolveAgentSessionStoreVersion(current);
  return currentVersion === null
    || compareWorkbenchLongIntegers(currentVersion, tombstoneVersion) <= 0;
}

export function recordAgentSessionTombstoneInProjectsStore(
  scopeKey: string,
  projectId: string,
  sessionId: string,
  version: string,
): void {
  const normalizedProjectId = projectId.trim();
  const normalizedSessionId = sessionId.trim();
  const normalizedVersion = normalizeAgentSessionTombstoneVersion(version);
  if (!scopeKey || !normalizedProjectId || !normalizedSessionId || !normalizedVersion) {
    throw new Error('Agents Session tombstone requires scope, identity, and version.');
  }
  const store = getProjectsStore(scopeKey);
  const tombstoneKey = buildAgentSessionTombstoneKey(
    normalizedProjectId,
    normalizedSessionId,
  );
  const existingVersion = store.agentSessionTombstones.get(tombstoneKey);
  if (
    existingVersion === undefined
    || compareWorkbenchLongIntegers(normalizedVersion, existingVersion) > 0
  ) {
    store.agentSessionTombstones.set(tombstoneKey, normalizedVersion);
  }
}

export function canCommitAgentSessionToProjectsStore(
  scopeKey: string,
  projectId: string,
  agentSession: AgentSessionView,
): boolean {
  if (!scopeKey) {
    return false;
  }
  return canCommitAgentSessionAgainstProjectsStoreTombstones(
    peekProjectsStore(scopeKey),
    projectId,
    agentSession,
  );
}

export function mutateProjectsStoreByScopeKey(
  scopeKey: string,
  updater: (projects: readonly AgentProjectView[]) => AgentProjectView[],
  options: { invalidatePagination?: boolean } = {},
): void {
  if (!scopeKey) {
    return;
  }
  const store = getProjectsStore(scopeKey);
  updateProjectsStoreSnapshot(store, (previousSnapshot) => {
    const nextProjects = updater(previousSnapshot.projects);
    if (
      previousSnapshot.error === null &&
      previousSnapshot.hasFetched &&
      areCollectionsReferentiallyEqual(previousSnapshot.projects, nextProjects)
    ) {
      return previousSnapshot;
    }

    if (options.invalidatePagination) {
      store.inventoryVersion += 1;
    }

    return {
      ...previousSnapshot,
      error: null,
      hasFetched: true,
      pageInfo: options.invalidatePagination ? null : previousSnapshot.pageInfo,
      projects: reuseProjectCollectionIfUnchanged(previousSnapshot.projects, nextProjects),
    };
  });
}

export function upsertAgentSessionIntoProjectsStore(
  projectId: string,
  agentSession: AgentSessionView,
  workspaceId: string,
  userScope?: string,
  options: AgentSessionProjectsStoreUpsertOptions = {},
): void {
  const normalizedWorkspaceId = workspaceId.trim();
  if (!projectId.trim() || !normalizedWorkspaceId) {
    return;
  }

  const projectMetadata = options.projectMetadata;
  if (
    projectMetadata
    && (
      projectMetadata.projectId.trim() !== projectId.trim()
      || projectMetadata.workspaceId.trim() !== normalizedWorkspaceId
      || projectMetadata.status === 'deleted'
    )
  ) {
    throw new Error('Agents Session project metadata does not match the Store target.');
  }

  const scopeKey = buildProjectsStoreScopeKey(
    normalizeProjectsStoreUserScope(userScope),
    normalizedWorkspaceId,
  );
  const store = getProjectsStore(scopeKey);
  if (!canCommitAgentSessionToProjectsStore(scopeKey, projectId, agentSession)) {
    return;
  }
  const normalizedProjectId = projectId.trim();
  const normalizedSessionId = agentSession.id.trim();
  const revisionKey = buildAgentSessionTranscriptRevisionKey(
    normalizedProjectId,
    normalizedSessionId,
  );
  mutateProjectsStoreByScopeKey(scopeKey, (projects) => {
    const projectsWithMetadata = projectMetadata
      ? upsertProjectIntoCollection(projects, {
          ...projectMetadata,
          // Project activity pages are bounded; their Session rows cannot
          // replace the Store's complete inventory during a transcript commit.
          agentSessions: [],
        })
      : projects;
    const previousSession = projectsWithMetadata
      .find((project) => project.projectId === normalizedProjectId)
      ?.agentSessions
      .find((session) => session.id === normalizedSessionId);
    const nextProjects = upsertAgentSessionIntoCollection(
      projectsWithMetadata,
      normalizedProjectId,
      agentSession,
      {
        acceptIncomingItemPageInfo: options.acceptIncomingItemPageInfo,
        itemMergeMode: options.itemMergeMode,
      },
    );
    const nextSession = nextProjects
      .find((project) => project.projectId === normalizedProjectId)
      ?.agentSessions
      .find((session) => session.id === normalizedSessionId);
    const authorityWindowWasReset = (
      options.itemMergeMode === 'authority-window-reset'
      && nextSession !== undefined
    );
    const transcriptWindowChanged = nextSession !== previousSession && (
      options.itemMergeMode === 'ordered-window'
      || nextSession?.agentId !== previousSession?.agentId
      || nextSession?.itemPageInfo?.hasMore !== previousSession?.itemPageInfo?.hasMore
      || nextSession?.itemPageInfo?.nextCursor !== previousSession?.itemPageInfo?.nextCursor
      || nextSession?.itemPageInfo?.pageSize !== previousSession?.itemPageInfo?.pageSize
    );
    if (authorityWindowWasReset || transcriptWindowChanged) {
      store.agentSessionTranscriptRevisions.set(
        revisionKey,
        (store.agentSessionTranscriptRevisions.get(revisionKey) ?? 0) + 1,
      );
    }
    return nextProjects;
  });
}

export function getAgentSessionTranscriptRevision(
  scopeKey: string,
  projectId: string,
  agentSessionId: string,
): number {
  const normalizedProjectId = projectId.trim();
  const normalizedSessionId = agentSessionId.trim();
  if (!scopeKey || !normalizedProjectId || !normalizedSessionId) {
    return 0;
  }
  return peekProjectsStore(scopeKey)?.agentSessionTranscriptRevisions.get(
    buildAgentSessionTranscriptRevisionKey(normalizedProjectId, normalizedSessionId),
  ) ?? 0;
}

export function upsertAgentSessionIntoProjectsStoreIfTranscriptUnchanged(
  projectId: string,
  agentSession: AgentSessionView,
  workspaceId: string,
  userScope: string,
  expected: AgentSessionTranscriptRevisionSnapshot,
  options: AgentSessionStoreUpsertOptions = {},
): boolean {
  const normalizedProjectId = projectId.trim();
  const normalizedWorkspaceId = workspaceId.trim();
  const normalizedSessionId = agentSession.id.trim();
  const incomingPageInfo = agentSession.itemPageInfo;
  if (!normalizedProjectId || !normalizedWorkspaceId || !normalizedSessionId) {
    return false;
  }
  const scopeKey = buildProjectsStoreScopeKey(
    normalizeProjectsStoreUserScope(userScope),
    normalizedWorkspaceId,
  );
  const store = peekProjectsStore(scopeKey);
  const currentSession = store?.snapshot.projects
    .find((project) => project.projectId === normalizedProjectId)
    ?.agentSessions
    .find((session) => session.id === normalizedSessionId);
  if (
    !currentSession
    || agentSession.projectId.trim() !== normalizedProjectId
    || agentSession.agentId !== expected.agentId
    || !expected.hasMore
    || !expected.nextCursor
    || !incomingPageInfo
    || incomingPageInfo.nextCursor === expected.nextCursor
    || (incomingPageInfo.hasMore && !incomingPageInfo.nextCursor)
    || (!incomingPageInfo.hasMore && incomingPageInfo.nextCursor !== null)
    || incomingPageInfo.pageSize !== expected.pageSize
    || currentSession.agentId !== expected.agentId
    || currentSession.itemPageInfo?.hasMore !== expected.hasMore
    || currentSession.itemPageInfo?.nextCursor !== expected.nextCursor
    || currentSession.itemPageInfo?.pageSize !== expected.pageSize
    || getAgentSessionTranscriptRevision(
      scopeKey,
      normalizedProjectId,
      normalizedSessionId,
    ) !== expected.revision
  ) {
    return false;
  }
  upsertAgentSessionIntoProjectsStore(
    normalizedProjectId,
    agentSession,
    normalizedWorkspaceId,
    userScope,
    { ...options, acceptIncomingItemPageInfo: true },
  );
  return true;
}

export function removeProjectFromProjectsStore(scopeKey: string, projectId: string): void {
  const normalizedProjectId = projectId.trim();
  if (!scopeKey || !normalizedProjectId) {
    return;
  }

  const store = getProjectsStore(scopeKey);
  store.removedProjectIds.add(normalizedProjectId);
  mutateProjectsStoreByScopeKey(
    scopeKey,
    (projects) => removeProjectFromCollection(projects, normalizedProjectId),
    { invalidatePagination: true },
  );
}

export function upsertProjectIntoProjectsStore(
  project: AgentProjectView,
  userScope?: string,
): void {
  if (!project.projectId.trim()) {
    return;
  }

  const scopeKey = buildProjectsStoreScopeKey(
    normalizeProjectsStoreUserScope(userScope),
    project.workspaceId,
  );

  upsertProjectIntoProjectsStoreByScopeKey(scopeKey, project);
}

export function upsertProjectIntoProjectsStoreByScopeKey(
  scopeKey: string,
  project: AgentProjectView,
): void {
  if (!scopeKey || !project.projectId.trim()) {
    return;
  }
  const store = getProjectsStore(scopeKey);
  const filteredProject = filterProjectsForInventoryStore(store, [project])[0];
  if (!filteredProject) {
    return;
  }

  mutateProjectsStoreByScopeKey(
    scopeKey,
    (projects) => upsertProjectIntoCollection(projects, filteredProject),
  );
}

export function deleteProjectsStore(scopeKey: string): void {
  const store = projectStoresByScopeKey.get(scopeKey);
  if (store) {
    // 主动清理 Map 内部数据，帮助 GC 在长时间运行的应用中更快回收
    store.inflightAbortController?.abort(new DOMException(
      'Project inventory scope was released.',
      'AbortError',
    ));
    store.inflightAbortController = null;
    store.agentSessionTombstones.clear();
    store.agentSessionTranscriptRevisions.clear();
    store.removedProjectIds.clear();
    store.listeners.clear();
    projectStoresByScopeKey.delete(scopeKey);
  }
}
