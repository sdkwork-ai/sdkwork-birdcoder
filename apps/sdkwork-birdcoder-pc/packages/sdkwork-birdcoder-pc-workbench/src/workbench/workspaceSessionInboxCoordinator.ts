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
  expireAgentSessionRuntimeStatuses,
  resolveNextAgentSessionActivityExpiryAt,
} from './agentSessionActivity.ts';

const WORKSPACE_SESSION_INBOX_INVALIDATION_CHANNEL =
  'sdkwork-birdcoder.workspace-session-inbox-invalidation.v1';

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
      if (
        loadedSessionCount > WORKSPACE_SESSION_INBOX_MAX_CACHED_SESSIONS
        || (page.hasMore && loadedSessionCount >= WORKSPACE_SESSION_INBOX_MAX_CACHED_SESSIONS)
      ) {
        throw new Error(
          `Agents Workspace Session activity snapshot exceeds ${WORKSPACE_SESSION_INBOX_MAX_CACHED_SESSIONS} Sessions.`,
        );
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
