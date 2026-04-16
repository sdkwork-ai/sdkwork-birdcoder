import type { LocalFolderMountSource } from '@sdkwork/birdcoder-types';

export type ProjectMountRecoveryStatus = 'idle' | 'recovering' | 'recovered' | 'failed';

export interface ProjectMountRecoveryState {
  status: ProjectMountRecoveryStatus;
  path: string | null;
  message: string | null;
}

const UNKNOWN_PROJECT_MOUNT_RECOVERY_ERROR_MESSAGE =
  'Unable to remount the local project folder. Re-import the folder to restore file access.';

function isWindowsDrivePath(projectPath: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(projectPath);
}

function isWindowsUncPath(projectPath: string): boolean {
  return /^\\\\[^\\]+\\[^\\]+/.test(projectPath);
}

function isPosixNativePath(projectPath: string): boolean {
  if (!projectPath.startsWith('/')) {
    return false;
  }

  const segments = projectPath.split('/').filter(Boolean);
  return segments.length >= 2;
}

function resolveProjectMountRecoveryErrorMessage(error: unknown): string {
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message.trim();
  }

  return UNKNOWN_PROJECT_MOUNT_RECOVERY_ERROR_MESSAGE;
}

export function createIdleProjectMountRecoveryState(): ProjectMountRecoveryState {
  return {
    status: 'idle',
    path: null,
    message: null,
  };
}

export function createRecoveringProjectMountRecoveryState(
  projectPath: string,
): ProjectMountRecoveryState {
  return {
    status: 'recovering',
    path: projectPath,
    message: null,
  };
}

export function createRecoveredProjectMountRecoveryState(
  projectPath: string,
): ProjectMountRecoveryState {
  return {
    status: 'recovered',
    path: projectPath,
    message: null,
  };
}

export function createFailedProjectMountRecoveryState(
  projectPath: string,
  error: unknown,
): ProjectMountRecoveryState {
  return {
    status: 'failed',
    path: projectPath,
    message: resolveProjectMountRecoveryErrorMessage(error),
  };
}

export function resolveProjectMountRecoverySource(
  projectPath?: string,
): LocalFolderMountSource | null {
  const normalizedProjectPath = projectPath?.trim();
  if (!normalizedProjectPath) {
    return null;
  }

  if (
    isWindowsDrivePath(normalizedProjectPath) ||
    isWindowsUncPath(normalizedProjectPath) ||
    isPosixNativePath(normalizedProjectPath)
  ) {
    return {
      type: 'tauri',
      path: normalizedProjectPath,
    };
  }

  return null;
}
