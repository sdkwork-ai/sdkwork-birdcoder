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

function normalizeScopePart(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required to synchronize project sessions.`);
  }
  return normalized;
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

  return {
    invalidate(scope) {
      invalidateScopeKey(buildProjectSessionSynchronizationScopeKey(scope));
    },

    synchronize(scope, task, options = {}) {
      const scopeKey = buildProjectSessionSynchronizationScopeKey(scope);
      const cacheTtlMs = options.cacheTtlMs
        ?? DEFAULT_PROJECT_SESSION_SYNCHRONIZATION_CACHE_TTL_MS;
      if (!Number.isSafeInteger(cacheTtlMs) || cacheTtlMs < 0) {
        throw new RangeError('Project Session synchronization cache TTL must be non-negative.');
      }
      if (!options.force) {
        const completedAt = completedAtByScopeKey.get(scopeKey);
        if (completedAt !== undefined && Date.now() - completedAt < cacheTtlMs) {
          return Promise.resolve(null);
        }
        const inFlight = inFlightByScopeKey.get(scopeKey);
        if (inFlight) {
          return inFlight;
        }
      } else {
        invalidateScopeKey(scopeKey);
      }

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
