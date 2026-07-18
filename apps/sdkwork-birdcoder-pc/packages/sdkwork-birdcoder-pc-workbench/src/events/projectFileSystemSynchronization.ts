import { globalEventBus } from '../utils/EventBus.ts';

const PROJECT_FILE_SYSTEM_FLUSH_REQUEST_EVENT = 'projectFileSystemFlushRequest';
const PROJECT_FILE_SYSTEM_REFRESH_REQUEST_EVENT = 'projectFileSystemRefreshRequest';

export interface ProjectFileSystemSynchronizationRequest {
  projectId: string;
  waitUntil: (task: Promise<unknown>) => void;
}

type ProjectFileSystemSynchronizationListener = (
  request: ProjectFileSystemSynchronizationRequest,
) => void;

async function requestProjectFileSystemSynchronization(
  eventName: string,
  projectId?: string | null,
): Promise<void> {
  const normalizedProjectId = projectId?.trim() ?? '';
  if (!normalizedProjectId) {
    return;
  }

  const pendingTasks: Promise<unknown>[] = [];
  globalEventBus.emit(eventName, {
    projectId: normalizedProjectId,
    waitUntil: (task: Promise<unknown>) => {
      pendingTasks.push(Promise.resolve(task));
    },
  } satisfies ProjectFileSystemSynchronizationRequest);

  await Promise.all(pendingTasks);
}

export function requestProjectFileSystemFlush(projectId?: string | null): Promise<void> {
  return requestProjectFileSystemSynchronization(
    PROJECT_FILE_SYSTEM_FLUSH_REQUEST_EVENT,
    projectId,
  );
}

export function requestProjectFileSystemRefresh(projectId?: string | null): Promise<void> {
  return requestProjectFileSystemSynchronization(
    PROJECT_FILE_SYSTEM_REFRESH_REQUEST_EVENT,
    projectId,
  );
}

export function subscribeProjectFileSystemFlushRequest(
  listener: ProjectFileSystemSynchronizationListener,
): () => void {
  return globalEventBus.on(PROJECT_FILE_SYSTEM_FLUSH_REQUEST_EVENT, listener);
}

export function subscribeProjectFileSystemRefreshRequest(
  listener: ProjectFileSystemSynchronizationListener,
): () => void {
  return globalEventBus.on(PROJECT_FILE_SYSTEM_REFRESH_REQUEST_EVENT, listener);
}
