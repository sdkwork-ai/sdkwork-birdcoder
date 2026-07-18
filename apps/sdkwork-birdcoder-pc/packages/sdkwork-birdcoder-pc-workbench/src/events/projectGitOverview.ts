import { globalEventBus } from '../utils/EventBus.ts';

const PROJECT_GIT_OVERVIEW_REFRESH_EVENT = 'projectGitOverviewRefresh';

export function emitProjectGitOverviewRefresh(projectId?: string | null): void {
  const normalizedProjectId = projectId?.trim() ?? '';
  if (!normalizedProjectId) {
    return;
  }

  globalEventBus.emit(PROJECT_GIT_OVERVIEW_REFRESH_EVENT, normalizedProjectId);
}

export function subscribeProjectGitOverviewRefresh(
  listener: (projectId: string) => void,
): () => void {
  return globalEventBus.on(PROJECT_GIT_OVERVIEW_REFRESH_EVENT, listener);
}
