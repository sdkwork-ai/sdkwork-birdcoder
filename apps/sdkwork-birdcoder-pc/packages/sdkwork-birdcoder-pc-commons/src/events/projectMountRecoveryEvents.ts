import { globalEventBus } from '../utils/EventBus.ts';
import type { ProjectMountRecoveryState } from '../workbench/projectMountRecovery.ts';

export const PROJECT_MOUNT_RECOVERY_EVENT = 'projectMountRecoveryStateChanged';

export type ProjectMountRecoverySurface = 'code' | 'studio';

export interface ProjectMountRecoveryEventPayload {
  surface: ProjectMountRecoverySurface;
  projectId: string | null;
  projectName: string | null;
  state: ProjectMountRecoveryState;
}

export function emitProjectMountRecoveryState(payload: ProjectMountRecoveryEventPayload) {
  globalEventBus.emit(PROJECT_MOUNT_RECOVERY_EVENT, payload);
}

export function subscribeProjectMountRecoveryState(
  callback: (payload: ProjectMountRecoveryEventPayload) => void,
) {
  return globalEventBus.on(PROJECT_MOUNT_RECOVERY_EVENT, callback);
}
