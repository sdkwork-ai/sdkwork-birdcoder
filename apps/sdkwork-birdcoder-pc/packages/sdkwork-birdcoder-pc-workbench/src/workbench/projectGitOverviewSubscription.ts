import type {
  WorkbenchGitOverviewView,
  WorkbenchGitRepositoryStatus,
} from '@sdkwork/birdcoder-pc-contracts-commons';

export type ProjectGitOverviewSubscriptionActivation = 'active' | 'inactive';

export interface ProjectGitOverviewSource {
  getProjectGitOverview: (projectId: string) => Promise<WorkbenchGitOverviewView>;
}

export interface ProjectGitOverviewSubscriptionInput {
  activation: ProjectGitOverviewSubscriptionActivation;
  onLoadError?: (error: unknown) => void;
  projectId?: string | null;
  source: ProjectGitOverviewSource;
  timeoutMs?: number;
}

interface ProjectGitOverviewSnapshotBase {
  errorMessage: string | null;
  overview: WorkbenchGitOverviewView | null;
}

export type ProjectGitOverviewSubscriptionSnapshot =
  | (ProjectGitOverviewSnapshotBase & { kind: 'idle' })
  | (ProjectGitOverviewSnapshotBase & { kind: 'loading' })
  | (ProjectGitOverviewSnapshotBase & { kind: WorkbenchGitRepositoryStatus })
  | (ProjectGitOverviewSnapshotBase & { kind: 'error'; errorMessage: string });

export interface ProjectGitOverviewSubscriptionOutput {
  apply: (overview: WorkbenchGitOverviewView) => void;
  getSnapshot: () => ProjectGitOverviewSubscriptionSnapshot;
  normalizedProjectId: string;
  refresh: () => Promise<WorkbenchGitOverviewView | null>;
  subscribe: (listener: () => void) => () => void;
}

interface ProjectGitOverviewCacheEntry {
  inFlight: Promise<WorkbenchGitOverviewView | null> | null;
  listeners: Set<() => void>;
  requestVersion: number;
  snapshot: ProjectGitOverviewSubscriptionSnapshot;
}

interface ProjectGitOverviewLoadTimeoutBoundary {
  clear: () => void;
  promise: Promise<never>;
}

export const PROJECT_GIT_OVERVIEW_LOAD_TIMEOUT_MS = 30_000;

const EMPTY_SNAPSHOT: ProjectGitOverviewSubscriptionSnapshot = Object.freeze({
  errorMessage: null,
  kind: 'idle',
  overview: null,
});
const projectGitOverviewCache = new Map<string, ProjectGitOverviewCacheEntry>();

function createLoadTimeoutBoundary(
  projectId: string,
  timeoutMs: number,
): ProjectGitOverviewLoadTimeoutBoundary {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const promise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(
        `Timed out loading project Git overview for "${projectId}" after ${timeoutMs} ms.`,
      ));
    }, timeoutMs);
  });

  return {
    clear: () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    },
    promise,
  };
}

async function loadWithTimeout(
  source: ProjectGitOverviewSource,
  projectId: string,
  timeoutMs: number,
): Promise<WorkbenchGitOverviewView> {
  const timeoutBoundary = createLoadTimeoutBoundary(projectId, timeoutMs);
  try {
    return await Promise.race([
      source.getProjectGitOverview(projectId),
      timeoutBoundary.promise,
    ]);
  } finally {
    timeoutBoundary.clear();
  }
}

function createCacheEntry(): ProjectGitOverviewCacheEntry {
  return {
    inFlight: null,
    listeners: new Set(),
    requestVersion: 0,
    snapshot: EMPTY_SNAPSHOT,
  };
}

function getCacheEntry(projectId: string): ProjectGitOverviewCacheEntry {
  let entry = projectGitOverviewCache.get(projectId);
  if (!entry) {
    entry = createCacheEntry();
    projectGitOverviewCache.set(projectId, entry);
  }
  return entry;
}

function emit(entry: ProjectGitOverviewCacheEntry): void {
  for (const listener of Array.from(entry.listeners)) {
    listener();
  }
}

function cleanup(projectId: string, entry: ProjectGitOverviewCacheEntry): void {
  if (entry.listeners.size === 0 && !entry.inFlight) {
    projectGitOverviewCache.delete(projectId);
  }
}

function loadedSnapshot(
  overview: WorkbenchGitOverviewView,
): ProjectGitOverviewSubscriptionSnapshot {
  return {
    errorMessage: null,
    kind: overview.status,
    overview,
  };
}

function loadErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : 'Failed to load project Git overview.';
}

export function createProjectGitOverviewSubscription({
  activation,
  onLoadError,
  projectId,
  source,
  timeoutMs = PROJECT_GIT_OVERVIEW_LOAD_TIMEOUT_MS,
}: ProjectGitOverviewSubscriptionInput): ProjectGitOverviewSubscriptionOutput {
  const normalizedProjectId = projectId?.trim() ?? '';
  const isEnabled = activation === 'active'
    && normalizedProjectId.length > 0;

  const getSnapshot = (): ProjectGitOverviewSubscriptionSnapshot => {
    if (!isEnabled) {
      return EMPTY_SNAPSHOT;
    }
    return projectGitOverviewCache.get(normalizedProjectId)?.snapshot ?? EMPTY_SNAPSHOT;
  };

  const subscribe = (listener: () => void): (() => void) => {
    if (!isEnabled) {
      return () => undefined;
    }
    const entry = getCacheEntry(normalizedProjectId);
    entry.listeners.add(listener);
    return () => {
      entry.listeners.delete(listener);
      cleanup(normalizedProjectId, entry);
    };
  };

  const apply = (overview: WorkbenchGitOverviewView): void => {
    if (!normalizedProjectId) {
      return;
    }
    const entry = getCacheEntry(normalizedProjectId);
    entry.requestVersion += 1;
    entry.inFlight = null;
    entry.snapshot = loadedSnapshot(overview);
    emit(entry);
    cleanup(normalizedProjectId, entry);
  };

  const refresh = async (): Promise<WorkbenchGitOverviewView | null> => {
    if (!isEnabled) {
      return null;
    }

    const entry = getCacheEntry(normalizedProjectId);
    if (entry.inFlight) {
      return entry.inFlight;
    }

    const requestVersion = entry.requestVersion + 1;
    entry.requestVersion = requestVersion;
    entry.snapshot = {
      errorMessage: null,
      kind: 'loading',
      overview: entry.snapshot.overview,
    };
    emit(entry);

    const request = (async () => {
      try {
        const overview = await loadWithTimeout(source, normalizedProjectId, timeoutMs);
        if (entry.requestVersion !== requestVersion) {
          return entry.snapshot.overview;
        }
        entry.snapshot = loadedSnapshot(overview);
        emit(entry);
        return overview;
      } catch (error) {
        if (entry.requestVersion !== requestVersion) {
          return entry.snapshot.overview;
        }
        onLoadError?.(error);
        entry.snapshot = {
          errorMessage: loadErrorMessage(error),
          kind: 'error',
          overview: entry.snapshot.overview,
        };
        emit(entry);
        return entry.snapshot.overview;
      } finally {
        if (entry.requestVersion === requestVersion) {
          entry.inFlight = null;
        }
        cleanup(normalizedProjectId, entry);
      }
    })();

    entry.inFlight = request;
    return request;
  };

  return {
    apply,
    getSnapshot,
    normalizedProjectId,
    refresh,
    subscribe,
  };
}
