import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import {
  buildProjectsStoreScopeKey,
  getProjectsStore,
  mutateProjectsStoreByScopeKey,
  normalizeProjectsStoreUserScope,
} from '../stores/projectsStore.ts';
import {
  applyWorkspaceSessionInboxUpdate,
  canSynchronizeWorkspaceSessionInbox,
  loadWorkspaceSessionInboxUpdate,
  mergeWorkspaceSessionInboxUpdates,
  resolveWorkspaceSessionInboxRefreshDelay,
  WORKSPACE_SESSION_INBOX_MAX_CACHED_SESSIONS,
} from './workspaceSessionInboxSync.ts';
import {
  createProjectSessionSynchronizationCoordinator,
  type ProjectSessionSynchronizationScope,
} from './projectSessionSynchronization.ts';
import {
  expireAgentSessionRuntimeStatuses,
  resolveNextAgentSessionActivityExpiryAt,
} from './agentSessionActivity.ts';

const WORKSPACE_SESSION_INBOX_INVALIDATION_CHANNEL =
  'sdkwork-birdcoder.workspace-session-inbox-invalidation.v1';

/**
 * Provider Session inventory synchronization cadence and bounds for the
 * Workspace Session Inbox.
 *
 * The activity snapshot feed only contains Sessions the agents backend has
 * indexed. Provider Sessions (e.g. Codex threads) created or removed outside
 * this client stay invisible until a project-level provider synchronization
 * (`agents.projectSessions.synchronize`) imports the current provider
 * inventory. The inbox therefore runs a bounded synchronization pass over the
 * loaded projects before reading the feed, deduplicated by the shared
 * 60-second coordinator cache so the pass costs nothing on the periodic
 * 15-second refreshes.
 */
const WORKSPACE_PROJECT_PROVIDER_SYNC_TTL_MS = 60_000;
const WORKSPACE_PROJECT_PROVIDER_SYNC_MAX_CONCURRENCY = 2;
/**
 * How long a single inbox refresh cycle may spend on provider inventory
 * synchronization before the activity snapshot read is guaranteed to run.
 *
 * Without a budget, a workspace with many imported projects (each triggering
 * a full backend reconcile) can consume the whole cycle — and eventually the
 * maximum-flight timer — so the snapshot read never runs and the Session list
 * starves. Projects that miss the budget simply roll into the next cycle
 * (their scope has no completion cache entry yet), so the pass is a rolling
 * queue instead of a blocking sweep.
 */
const WORKSPACE_PROJECT_PROVIDER_SYNC_CYCLE_BUDGET_MS = 10_000;

type WorkspaceProjectProviderSynchronizationResult = Awaited<
  ReturnType<IAgentSessionService['synchronizeProjectSessions']>
>;

/**
 * 单次同步操作的最大允许飞行时间（毫秒）。
 *
 * 如果服务端响应缓慢或长轮询挂起，当此定时器到期时会主动中止当前请求。
 * 这保证同步循环在下一个刷新间隔开启前总是能回到空闲状态，防止请求堆积。
 * 设定为刷新间隔的 4 倍（60s），避免在常规慢网络下过早中断有效请求。
 */
const WORKSPACE_SESSION_INBOX_MAX_INFLIGHT_MS = 60_000;

export interface WorkspaceSessionInboxSynchronizationScope {
  userScope: string;
  workspaceId: string;
}

export interface WorkspaceSessionInboxSynchronizationSubscription {
  dispose(): void;
  invalidate(options?: { broadcast?: boolean }): Promise<void>;
}

interface WorkspaceSessionInboxSynchronizationEntry {
  controller: AbortController | null;
  failures: number;
  freshnessTimer: ReturnType<typeof setTimeout> | null;
  generation: number;
  inflight: Promise<void> | null;
  refCount: number;
  scope: WorkspaceSessionInboxSynchronizationScope;
  scopeKey: string;
  service: IAgentSessionService;
  timer: ReturnType<typeof setTimeout> | null;
}

interface WorkspaceSessionInboxInvalidationMessage {
  kind: 'workspace-session-inbox.invalidate';
  scopeKey: string;
}

const entriesByScopeKey = new Map<string, WorkspaceSessionInboxSynchronizationEntry>();
const providerInventorySynchronization =
  createProjectSessionSynchronizationCoordinator<WorkspaceProjectProviderSynchronizationResult>();
let invalidationChannel: BroadcastChannel | null = null;
let browserListenersInstalled = false;

function normalizeScope(
  scope: WorkspaceSessionInboxSynchronizationScope,
): WorkspaceSessionInboxSynchronizationScope {
  const workspaceId = scope.workspaceId.trim();
  if (!workspaceId) {
    throw new Error('Workspace ID is required for Session Inbox synchronization.');
  }
  return {
    userScope: normalizeProjectsStoreUserScope(scope.userScope),
    workspaceId,
  };
}

function buildScopeKey(scope: WorkspaceSessionInboxSynchronizationScope): string {
  return buildProjectsStoreScopeKey(scope.userScope, scope.workspaceId);
}

function isBrowserSynchronizationAvailable(): boolean {
  const visibilityState = typeof document === 'undefined'
    ? 'visible'
    : document.visibilityState;
  const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
  return canSynchronizeWorkspaceSessionInbox(visibilityState, isOnline);
}

function clearScheduledRefresh(entry: WorkspaceSessionInboxSynchronizationEntry): void {
  if (entry.timer !== null) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }
}

function clearScheduledFreshnessExpiry(
  entry: WorkspaceSessionInboxSynchronizationEntry,
): void {
  if (entry.freshnessTimer !== null) {
    clearTimeout(entry.freshnessTimer);
    entry.freshnessTimer = null;
  }
}

function materializeExpiredActivity(
  entry: WorkspaceSessionInboxSynchronizationEntry,
): void {
  const now = Date.now();
  mutateProjectsStoreByScopeKey(
    entry.scopeKey,
    (projects) => expireAgentSessionRuntimeStatuses(projects, now),
  );
  clearScheduledFreshnessExpiry(entry);
  if (entry.refCount < 1) {
    return;
  }
  const nextExpiry = resolveNextAgentSessionActivityExpiryAt(
    getProjectsStore(entry.scopeKey).snapshot.projects,
    now,
  );
  if (nextExpiry === null) {
    return;
  }
  const delay = Math.max(1, Math.min(2_147_483_647, nextExpiry - now + 1));
  entry.freshnessTimer = setTimeout(() => {
    entry.freshnessTimer = null;
    materializeExpiredActivity(entry);
  }, delay);
}

function abortRefresh(
  entry: WorkspaceSessionInboxSynchronizationEntry,
  reason: string,
): void {
  clearScheduledRefresh(entry);
  entry.generation += 1;
  entry.controller?.abort(new DOMException(reason, 'AbortError'));
  entry.controller = null;
  entry.inflight = null;
}

function scheduleRefresh(entry: WorkspaceSessionInboxSynchronizationEntry): void {
  clearScheduledRefresh(entry);
  if (entry.refCount < 1 || !isBrowserSynchronizationAvailable()) {
    return;
  }
  const delay = resolveWorkspaceSessionInboxRefreshDelay(entry.failures);
  entry.timer = setTimeout(() => {
    entry.timer = null;
    void synchronizeEntry(entry);
  }, delay);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function canCommitRefresh(
  entry: WorkspaceSessionInboxSynchronizationEntry,
  generation: number,
  controller: AbortController,
): boolean {
  return !controller.signal.aborted
    && entry.generation === generation
    && entry.refCount > 0
    && entriesByScopeKey.get(entry.scopeKey) === entry;
}

function canSynchronizeProjectProviderInventories(
  service: IAgentSessionService,
): boolean {
  return typeof (service as { synchronizeProjectSessions?: unknown })
    .synchronizeProjectSessions === 'function';
}

/**
 * Imports the current provider Session inventory for every project already
 * loaded in the Store, so the activity feed read afterwards contains Sessions
 * the provider owns but the backend had not indexed yet (e.g. threads created
 * directly in the Codex CLI).
 *
 * The pass is best-effort and bounded: at most two projects synchronize
 * concurrently, each scope is deduplicated by the 60-second coordinator cache,
 * and a failing project never blocks the feed read (the next cycle retries
 * it). The provider synchronization coordinator owns its own abort signal, so
 * an inbox refresh superseded mid-pass does not cancel already accepted
 * backend work. Every loaded project is considered every cycle — projects
 * whose scope is still cached resolve immediately, and the per-cycle time
 * budget rolls the remainder into the next cycle, so no project is ever
 * permanently starved by a fixed per-cycle project cap.
 */
async function synchronizeWorkspaceProjectProviderInventories(
  entry: WorkspaceSessionInboxSynchronizationEntry,
  generation: number,
  controller: AbortController,
): Promise<void> {
  if (
    entry.generation !== generation
    || !canSynchronizeProjectProviderInventories(entry.service)
  ) {
    return;
  }
  const projects = getProjectsStore(entry.scopeKey).snapshot.projects;
  if (projects.length === 0) {
    return;
  }
  const failures: Array<{ error: unknown; projectId: string }> = [];
  let nextProjectIndex = 0;
  const workerCount = Math.min(
    WORKSPACE_PROJECT_PROVIDER_SYNC_MAX_CONCURRENCY,
    projects.length,
  );
  const deadline = Date.now() + WORKSPACE_PROJECT_PROVIDER_SYNC_CYCLE_BUDGET_MS;
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextProjectIndex < projects.length) {
      const project = projects[nextProjectIndex];
      nextProjectIndex += 1;
      if (
        controller.signal.aborted
        || entry.generation !== generation
        || Date.now() >= deadline
      ) {
        return;
      }
      const scope: ProjectSessionSynchronizationScope = {
        projectId: project.projectId,
        userScope: entry.scope.userScope,
        workspaceId: entry.scope.workspaceId,
      };
      try {
        const synchronization = await providerInventorySynchronization.synchronize(
          scope,
          ({ signal }) => entry.service.synchronizeProjectSessions(
            project.projectId,
            { signal },
          ),
          { cacheTtlMs: WORKSPACE_PROJECT_PROVIDER_SYNC_TTL_MS },
        );
        // A successful but incomplete synchronization is the classic silent
        // inconsistency: the backend records issues (provider engine
        // unavailable, inventory time budget exceeded, session reconcile
        // failures) without failing the request, so the activity snapshot
        // afterwards is only as complete as the backend inventory. Log the
        // outcome once per cache window so list gaps stay diagnosable.
        if (synchronization && (synchronization.issues?.length ?? 0) > 0) {
          console.warn(
            'Agents project provider Session inventory synchronization reported issues',
            {
              failedSessionCount: synchronization.failedSessionCount,
              issues: synchronization.issues,
              projectId: project.projectId,
              skippedSessionCount: synchronization.skippedSessionCount,
              synchronizedSessionCount: synchronization.synchronizedSessionCount,
            },
          );
        }
      } catch (error: unknown) {
        if (controller.signal.aborted || entry.generation !== generation) {
          return;
        }
        failures.push({ error, projectId: project.projectId });
      }
    }
  }));
  if (failures.length > 0) {
    console.error(
      'Failed to synchronize some Agents project provider Session inventories',
      failures,
    );
  }
}

function commitWorkspaceSessionInboxPage(
  entry: WorkspaceSessionInboxSynchronizationEntry,
  generation: number,
  controller: AbortController,
  update: Awaited<ReturnType<typeof loadWorkspaceSessionInboxUpdate>>,
): boolean {
  if (!canCommitRefresh(entry, generation, controller)) {
    return false;
  }
  mutateProjectsStoreByScopeKey(
    entry.scopeKey,
    (projects) => applyWorkspaceSessionInboxUpdate(projects, update, entry.scopeKey),
  );
  materializeExpiredActivity(entry);
  return true;
}

function synchronizeEntry(
  entry: WorkspaceSessionInboxSynchronizationEntry,
  force = false,
): Promise<void> {
  if (entry.refCount < 1 || !isBrowserSynchronizationAvailable()) {
    return Promise.resolve();
  }
  if (entry.inflight && !force) {
    return entry.inflight;
  }
  if (force) {
    abortRefresh(entry, 'Workspace Session Inbox refresh was superseded.');
  } else {
    clearScheduledRefresh(entry);
  }

  const generation = entry.generation + 1;
  entry.generation = generation;
  const controller = new AbortController();
  entry.controller = controller;

  // 背压保护：如果刷新超过最大飞行时间，主动中止并立即规划下一次重试，
  // 防止长请求阻塞后续刷新定时器。
  let inflightTimeoutId: ReturnType<typeof setTimeout> | null = null;
  inflightTimeoutId = setTimeout(() => {
    inflightTimeoutId = null;
    if (entry.generation === generation) {
      abortRefresh(entry, 'Session Inbox synchronization exceeded maximum flight duration.');
      // abortRefresh 不会重新调度 —— 由于本次是超时主动触发，需要立即重调度
      // 以便在下一个刷新间隔时恢复同步，否则 UI 将陷入停滞直到下一次外部触发。
      scheduleRefresh(entry);
    }
  }, WORKSPACE_SESSION_INBOX_MAX_INFLIGHT_MS);

  const task = (async () => {
    await synchronizeWorkspaceProjectProviderInventories(entry, generation, controller);
    const updates = [];
    const seenCursors = new Set<string>();
    let cursor: string | undefined;
    do {
      if (cursor && !seenCursors.add(cursor)) {
        throw new Error('Agents Workspace Session activity snapshot repeated a cursor.');
      }
      const page = await loadWorkspaceSessionInboxUpdate(
        entry.service,
        entry.scope.workspaceId,
        getProjectsStore(entry.scopeKey).snapshot.projects,
        cursor,
        controller.signal,
      );
      updates.push(page);
      const loadedSessionCount = updates.reduce(
        (count, update) => count + update.summaries.length,
        0,
      );
      if (loadedSessionCount >= WORKSPACE_SESSION_INBOX_MAX_CACHED_SESSIONS) {
        // The workspace holds more Sessions than the projection cache can
        // retain. Stop the traversal and commit the newest rows instead of
        // failing the whole synchronization: a capped list beats an empty
        // list, and the Store cache trim already applies the same bound.
        if (page.hasMore) {
          console.warn(
            `Agents Workspace Session activity snapshot truncated at ${WORKSPACE_SESSION_INBOX_MAX_CACHED_SESSIONS} Sessions.`,
          );
        }
        break;
      }
      cursor = page.nextCursor;
    } while (updates.at(-1)?.hasMore);
    const update = mergeWorkspaceSessionInboxUpdates(updates);
    if (!commitWorkspaceSessionInboxPage(entry, generation, controller, update)) {
      return;
    }
    entry.failures = 0;
  })()
    .catch((error: unknown) => {
      if (!canCommitRefresh(entry, generation, controller) || isAbortError(error)) {
        return;
      }
      entry.failures += 1;
      console.error('Failed to synchronize the Agents Workspace Session Inbox', error);
    })
    .finally(() => {
      if (inflightTimeoutId !== null) {
        clearTimeout(inflightTimeoutId);
      }
      if (entry.generation !== generation) {
        return;
      }
      if (entry.controller === controller) {
        entry.controller = null;
      }
      if (entry.inflight === task) {
        entry.inflight = null;
      }
      scheduleRefresh(entry);
    });
  entry.inflight = task;
  return task;
}

function handleBrowserResume(): void {
  if (!isBrowserSynchronizationAvailable()) {
    for (const entry of entriesByScopeKey.values()) {
      abortRefresh(entry, 'Workspace Session Inbox synchronization was paused.');
    }
    return;
  }
  for (const entry of entriesByScopeKey.values()) {
    void synchronizeEntry(entry, true);
  }
}

function isInvalidationMessage(value: unknown): value is WorkspaceSessionInboxInvalidationMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const message = value as Record<string, unknown>;
  return message.kind === 'workspace-session-inbox.invalidate'
    && typeof message.scopeKey === 'string'
    && message.scopeKey.length > 0
    && message.scopeKey.length <= 1_024;
}

function handleInvalidationMessage(event: MessageEvent<unknown>): void {
  if (!isInvalidationMessage(event.data)) {
    return;
  }
  const entry = entriesByScopeKey.get(event.data.scopeKey);
  if (entry) {
    void synchronizeEntry(entry, true);
  }
}

function ensureBrowserListeners(): void {
  if (browserListenersInstalled || typeof window === 'undefined') {
    return;
  }
  browserListenersInstalled = true;
  window.addEventListener('online', handleBrowserResume);
  window.addEventListener('offline', handleBrowserResume);
  document.addEventListener('visibilitychange', handleBrowserResume);
  if (typeof BroadcastChannel !== 'undefined') {
    invalidationChannel = new BroadcastChannel(WORKSPACE_SESSION_INBOX_INVALIDATION_CHANNEL);
    invalidationChannel.addEventListener('message', handleInvalidationMessage);
  }
}

function releaseBrowserListeners(): void {
  if (!browserListenersInstalled || entriesByScopeKey.size > 0 || typeof window === 'undefined') {
    return;
  }
  browserListenersInstalled = false;
  window.removeEventListener('online', handleBrowserResume);
  window.removeEventListener('offline', handleBrowserResume);
  document.removeEventListener('visibilitychange', handleBrowserResume);
  invalidationChannel?.removeEventListener('message', handleInvalidationMessage);
  invalidationChannel?.close();
  invalidationChannel = null;
}

function broadcastInvalidation(scopeKey: string): void {
  invalidationChannel?.postMessage({
    kind: 'workspace-session-inbox.invalidate',
    scopeKey,
  } satisfies WorkspaceSessionInboxInvalidationMessage);
}

export function subscribeWorkspaceSessionInboxSynchronization(
  service: IAgentSessionService,
  inputScope: WorkspaceSessionInboxSynchronizationScope,
): WorkspaceSessionInboxSynchronizationSubscription {
  const scope = normalizeScope(inputScope);
  const scopeKey = buildScopeKey(scope);
  let entry = entriesByScopeKey.get(scopeKey);
  if (!entry) {
    entry = {
      controller: null,
      failures: 0,
      freshnessTimer: null,
      generation: 0,
      inflight: null,
      refCount: 0,
      scope,
      scopeKey,
      service,
      timer: null,
    };
    entriesByScopeKey.set(scopeKey, entry);
  } else {
    entry.service = service;
  }
  entry.refCount += 1;
  ensureBrowserListeners();
  materializeExpiredActivity(entry);
  void synchronizeEntry(entry);

  let disposed = false;
  return {
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      entry!.refCount -= 1;
      if (entry!.refCount < 1) {
        abortRefresh(entry!, 'Workspace Session Inbox synchronization was disposed.');
        clearScheduledFreshnessExpiry(entry!);
        entriesByScopeKey.delete(scopeKey);
        releaseBrowserListeners();
      }
    },
    invalidate(options = {}) {
      if (options.broadcast !== false) {
        broadcastInvalidation(scopeKey);
      }
      return synchronizeEntry(entry!, true);
    },
  };
}

export function invalidateWorkspaceSessionInboxSynchronization(
  inputScope: WorkspaceSessionInboxSynchronizationScope,
  options: { broadcast?: boolean } = {},
): Promise<void> {
  const scope = normalizeScope(inputScope);
  const scopeKey = buildScopeKey(scope);
  if (options.broadcast !== false) {
    broadcastInvalidation(scopeKey);
  }
  const entry = entriesByScopeKey.get(scopeKey);
  return entry ? synchronizeEntry(entry, true) : Promise.resolve();
}

export async function invalidateActiveWorkspaceSessionInboxSynchronizations(
  options: { broadcast?: boolean } = {},
): Promise<void> {
  const entries = [...entriesByScopeKey.values()];
  await Promise.all(entries.map((entry) => {
    if (options.broadcast !== false) {
      broadcastInvalidation(entry.scopeKey);
    }
    return synchronizeEntry(entry, true);
  }));
}
