import {
  normalizeProjectRuntimeLocationInput,
  type ProjectRuntimeLocationInput,
  type ProjectRuntimeLocationTarget,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime/projectRuntimeLocation';
import { globalEventBus } from '../utils/EventBus.ts';

export const COPY_PROJECT_LOCAL_PATH_EVENT = 'copyProjectLocalPath';
export const OPEN_PROJECT_TERMINAL_EVENT = 'openProjectTerminal';
export const REVEAL_PROJECT_IN_FILE_MANAGER_EVENT = 'revealProjectInFileManager';

export type ProjectDeviceMountTarget = ProjectRuntimeLocationTarget;

export function resolveProjectDeviceMountTarget(
  project: ProjectRuntimeLocationInput,
): ProjectDeviceMountTarget | null {
  return normalizeProjectRuntimeLocationInput(project);
}

export function emitCopyProjectLocalPath(project: ProjectRuntimeLocationInput): boolean {
  const normalizedTarget = resolveProjectDeviceMountTarget(project);
  if (!normalizedTarget) {
    return false;
  }

  globalEventBus.emit(COPY_PROJECT_LOCAL_PATH_EVENT, normalizedTarget);
  return true;
}

export function emitOpenProjectTerminal(project: ProjectRuntimeLocationInput): boolean {
  const normalizedTarget = resolveProjectDeviceMountTarget(project);
  if (!normalizedTarget) {
    return false;
  }

  globalEventBus.emit(OPEN_PROJECT_TERMINAL_EVENT, normalizedTarget);
  return true;
}

export function emitRevealProjectInFileManager(project: ProjectRuntimeLocationInput): boolean {
  const normalizedTarget = resolveProjectDeviceMountTarget(project);
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
