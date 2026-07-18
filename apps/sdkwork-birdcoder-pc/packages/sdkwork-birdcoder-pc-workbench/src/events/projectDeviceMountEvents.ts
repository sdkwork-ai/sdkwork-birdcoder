import { globalEventBus } from '../utils/EventBus.ts';

export const COPY_PROJECT_LOCAL_PATH_EVENT = 'copyProjectLocalPath';
export const OPEN_PROJECT_TERMINAL_EVENT = 'openProjectTerminal';
export const REVEAL_PROJECT_IN_FILE_MANAGER_EVENT = 'revealProjectInFileManager';

export interface ProjectDeviceMountTarget {
  mountedPath?: string;
  projectId: string;
}

function normalizeTarget(target: ProjectDeviceMountTarget): ProjectDeviceMountTarget | null {
  const projectId = target.projectId.trim();
  if (!projectId) {
    return null;
  }

  const mountedPath = target.mountedPath?.trim();
  return {
    projectId,
    ...(mountedPath ? { mountedPath } : {}),
  };
}

export function emitCopyProjectLocalPath(target: ProjectDeviceMountTarget): boolean {
  const normalizedTarget = normalizeTarget(target);
  if (!normalizedTarget) {
    return false;
  }

  globalEventBus.emit(COPY_PROJECT_LOCAL_PATH_EVENT, normalizedTarget);
  return true;
}

export function emitOpenProjectTerminal(target: ProjectDeviceMountTarget): boolean {
  const normalizedTarget = normalizeTarget(target);
  if (!normalizedTarget) {
    return false;
  }

  globalEventBus.emit(OPEN_PROJECT_TERMINAL_EVENT, normalizedTarget);
  return true;
}

export function emitRevealProjectInFileManager(target: ProjectDeviceMountTarget): boolean {
  const normalizedTarget = normalizeTarget(target);
  if (!normalizedTarget) {
    return false;
  }

  globalEventBus.emit(REVEAL_PROJECT_IN_FILE_MANAGER_EVENT, normalizedTarget);
  return true;
}

export function subscribeCopyProjectLocalPath(
  callback: (target: ProjectDeviceMountTarget) => void,
): () => void {
  return globalEventBus.on(COPY_PROJECT_LOCAL_PATH_EVENT, callback);
}

export function subscribeOpenProjectTerminal(
  callback: (target: ProjectDeviceMountTarget) => void,
): () => void {
  return globalEventBus.on(OPEN_PROJECT_TERMINAL_EVENT, callback);
}

export function subscribeRevealProjectInFileManager(
  callback: (target: ProjectDeviceMountTarget) => void,
): () => void {
  return globalEventBus.on(REVEAL_PROJECT_IN_FILE_MANAGER_EVENT, callback);
}
