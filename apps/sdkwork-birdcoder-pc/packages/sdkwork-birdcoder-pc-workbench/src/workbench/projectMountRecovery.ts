import type { ProjectDeviceMountState } from '@sdkwork/birdcoder-pc-contracts-commons';

export type ProjectMountRecoveryStatus =
  | 'idle'
  | 'recovering'
  | 'recovered'
  | 'permission_required'
  | 'mount_required'
  | 'session_required'
  | 'failed';

export interface ProjectMountRecoveryState {
  displayName: string | null;
  status: ProjectMountRecoveryStatus;
  message: string | null;
}

export interface ProjectMountRecoveryActions {
  chooseFolder: boolean;
  requiresAttention: boolean;
  retry: boolean;
}

const UNKNOWN_PROJECT_MOUNT_RECOVERY_ERROR_MESSAGE =
  'Unable to remount the local project folder. Re-import the folder to restore file access.';

export function createIdleProjectMountRecoveryState(): ProjectMountRecoveryState {
  return {
    displayName: null,
    status: 'idle',
    message: null,
  };
}

export function createRecoveringProjectMountRecoveryState(
  displayName: string | null,
): ProjectMountRecoveryState {
  return {
    displayName,
    status: 'recovering',
    message: null,
  };
}

export function createRecoveredProjectMountRecoveryState(
  displayName: string | null,
): ProjectMountRecoveryState {
  return {
    displayName,
    status: 'recovered',
    message: null,
  };
}

export function createFailedProjectMountRecoveryState(
  displayName: string | null,
): ProjectMountRecoveryState {
  return {
    displayName,
    status: 'failed',
    message: UNKNOWN_PROJECT_MOUNT_RECOVERY_ERROR_MESSAGE,
  };
}

export function createProjectMountRecoveryStateFromDeviceMount(
  mount: ProjectDeviceMountState,
): ProjectMountRecoveryState {
  switch (mount.status) {
    case 'mounted':
    case 'recoverable':
      return createRecoveredProjectMountRecoveryState(mount.displayName);
    case 'permission_required':
      return {
        displayName: mount.displayName,
        status: 'permission_required',
        message: 'Select the folder again to restore files and local coding sessions.',
      };
    case 'session_required':
      return {
        displayName: mount.displayName,
        status: 'session_required',
        message: 'Sign in again before accessing the local project folder.',
      };
    case 'mount_required':
      return {
        displayName: mount.displayName,
        status: 'mount_required',
        message: 'Select this project\'s local folder to load files and local coding sessions.',
      };
    default:
      return createFailedProjectMountRecoveryState(mount.displayName);
  }
}

export function resolveProjectMountRecoveryActions(
  status: ProjectMountRecoveryStatus,
): ProjectMountRecoveryActions {
  switch (status) {
    case 'failed':
      return { chooseFolder: true, requiresAttention: true, retry: true };
    case 'mount_required':
    case 'permission_required':
      return { chooseFolder: true, requiresAttention: true, retry: false };
    case 'session_required':
      return { chooseFolder: false, requiresAttention: true, retry: false };
    default:
      return { chooseFolder: false, requiresAttention: false, retry: false };
  }
}

export function isProjectMountReadyForSessionSynchronization(
  mount: ProjectDeviceMountState,
): boolean {
  return mount.status === 'mounted';
}
