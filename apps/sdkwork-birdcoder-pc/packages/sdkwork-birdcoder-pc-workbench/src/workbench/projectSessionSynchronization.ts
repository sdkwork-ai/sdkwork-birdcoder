export interface ProjectSessionSynchronizationScope {
  projectId: string;
  userScope: string;
  workspaceId: string;
}

export interface ProjectSessionSynchronizationOptions {
  cacheTtlMs?: number;
  force?: boolean;
}

export interface ProjectSessionSynchronizationAttempt {
  generation: number;
  signal: AbortSignal;
}

export interface ProjectSessionSynchronizationCoordinator<TResult> {
  invalidate(scope: ProjectSessionSynchronizationScope): void;
  synchronize(
    scope: ProjectSessionSynchronizationScope,
    task: (attempt: ProjectSessionSynchronizationAttempt) => Promise<TResult | null>,
    options?: ProjectSessionSynchronizationOptions,
  ): Promise<TResult | null>;
}

const DEFAULT_PROJECT_SESSION_SYNCHRONIZATION_CACHE_TTL_MS = 60_000;

/**
 * 每个协调器实例中缓存的 scope 数量上限。超出时优先淘汰最久未访问的已完成记录，
 * 确保长期运行下内存保持有界。
 */
const PROJECT_SESSION_SYNCHRONIZATION_MAX_CACHED_SCOPES = 20;
const PROJECT_SESSION_SYNCHRONIZATION_MAX_SCOPE_KEY_LENGTH = 256;

function normalizeScopePart(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required to synchronize project sessions.`);
  }
  return normalized;
}

function assertValidScopeKey(scopeKey: string): void {
  if (scopeKey.length > PROJECT_SESSION_SYNCHRONIZATION_MAX_SCOPE_KEY_LENGTH) {
    throw new Error(
      `Project Session synchronization scope key exceeds maximum length ${PROJECT_SESSION_SYNCHRONIZATION_MAX_SCOPE_KEY_LENGTH}.`,
    );
  }
}

export function buildProjectSessionSynchronizationScopeKey(
  scope: ProjectSessionSynchronizationScope,
): string {
  return [
    normalizeScopePart(scope.userScope, 'User scope'),
    normalizeScopePart(scope.workspaceId, 'Workspace ID'),
    normalizeScopePart(scope.projectId, 'Project ID'),
  ].join('\u0001');
}

export function createProjectSessionSynchronizationCoordinator<TResult>()
  : ProjectSessionSynchronizationCoordinator<TResult> {
  const completedAtByScopeKey = new Map<string, number>();
  const controllerByScopeKey = new Map<string, AbortController>();
  const generationByScopeKey = new Map<string, number>();
  const inFlightByScopeKey = new Map<string, Promise<TResult | null>>();

  const invalidateScopeKey = (scopeKey: string) => {
    completedAtByScopeKey.delete(scopeKey);
    generationByScopeKey.set(scopeKey, (generationByScopeKey.get(scopeKey) ?? 0) + 1);
    controllerByScopeKey.get(scopeKey)?.abort(
      new DOMException('Project Session synchronization was superseded.', 'AbortError'),
    );
    controllerByScopeKey.delete(scopeKey);
    inFlightByScopeKey.delete(scopeKey);
  };

  /**
   * 淘汰最久未访问的、非进行中的 scope 条目，直到缓存量回落至上限以内。
   * 利用 Map 的插入顺序语义：最早插入（最少访问）的在前面。
   * 跳过 inFlight 中的 scope（仍有活跃任务）以避免破坏进行中的同步。
   */
  function evictLeastRecentlyUsedScopes(): void {
    const totalSize = Math.max(
      completedAtByScopeKey.size,
      generationByScopeKey.size,
      controllerByScopeKey.size,
      inFlightByScopeKey.size,
    );
    if (totalSize <= PROJECT_SESSION_SYNCHRONIZATION_MAX_CACHED_SCOPES) {
      return;
    }
    const overflow = totalSize - PROJECT_SESSION_SYNCHRONIZATION_MAX_CACHED_SCOPES;
    let evicted = 0;
    // 基于 completedAtByScopeKey 的插入顺序判定 LRU（该 Map 在每个 scope 完成后被 set）
    const iterator = completedAtByScopeKey.keys();
    while (evicted < overflow) {
      const next = iterator.next();
      if (next.done) break;
      const key = next.value;
      // 仍有 inflight 或 active controller 的 scope 暂不淘汰
      if (inFlightByScopeKey.has(key) || controllerByScopeKey.has(key)) {
        continue;
      }
      completedAtByScopeKey.delete(key);
      generationByScopeKey.delete(key);
      evicted += 1;
    }
  }

  return {
    invalidate(scope) {
      invalidateScopeKey(buildProjectSessionSynchronizationScopeKey(scope));
    },

    synchronize(scope, task, options = {}) {
      const scopeKey = buildProjectSessionSynchronizationScopeKey(scope);
      assertValidScopeKey(scopeKey);
      const cacheTtlMs = options.cacheTtlMs
        ?? DEFAULT_PROJECT_SESSION_SYNCHRONIZATION_CACHE_TTL_MS;
      if (!Number.isSafeInteger(cacheTtlMs) || cacheTtlMs < 0) {
        throw new RangeError('Project Session synchronization cache TTL must be non-negative.');
      }
      if (!options.force) {
        const completedAt = completedAtByScopeKey.get(scopeKey);
        if (completedAt !== undefined && Date.now() - completedAt < cacheTtlMs) {
          // 缓存命中：更新访问顺序（重新插入相当于 touch）
          completedAtByScopeKey.delete(scopeKey);
          completedAtByScopeKey.set(scopeKey, completedAt);
          return Promise.resolve(null);
        }
      }
      // force 只绕过已完成结果的缓存；同一 scope 的进行中请求仍然合并，
      // 避免多个窗口/多次手动刷新并发时各自触发一次完整的后端同步。
      const inFlight = inFlightByScopeKey.get(scopeKey);
      if (inFlight) {
        return inFlight;
      }
      // 新 scope 首次写入后，检查是否需要 LRU 淘汰
      evictLeastRecentlyUsedScopes();

      const generation = (generationByScopeKey.get(scopeKey) ?? 0) + 1;
      generationByScopeKey.set(scopeKey, generation);
      const controller = new AbortController();
      controllerByScopeKey.set(scopeKey, controller);
      const synchronization = Promise.resolve()
        .then(() => task({ generation, signal: controller.signal }))
        .then((result) => {
          if (
            controller.signal.aborted
            || generationByScopeKey.get(scopeKey) !== generation
          ) {
            return null;
          }
          if (result !== null) {
            completedAtByScopeKey.set(scopeKey, Date.now());
          }
          return result;
        })
        .catch((error: unknown) => {
          if (
            controller.signal.aborted
            || generationByScopeKey.get(scopeKey) !== generation
          ) {
            return null;
          }
          throw error;
        })
        .finally(() => {
          if (inFlightByScopeKey.get(scopeKey) === synchronization) {
            inFlightByScopeKey.delete(scopeKey);
          }
          if (controllerByScopeKey.get(scopeKey) === controller) {
            controllerByScopeKey.delete(scopeKey);
          }
        });
      inFlightByScopeKey.set(scopeKey, synchronization);
      return synchronization;
    },
  };
}
