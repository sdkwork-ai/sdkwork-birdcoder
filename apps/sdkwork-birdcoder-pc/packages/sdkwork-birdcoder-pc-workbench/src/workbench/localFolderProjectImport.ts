import type { LocalFolderMountSource } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { ProjectRuntimeLocationBindingResult } from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import { emitProjectGitOverviewRefresh } from './projectGitOverview.ts';

interface EnsuredProjectIdentifier {
  projectId: string;
  reusedExistingProject: boolean;
}

export interface ImportLocalFolderProjectOptions {
  ensureProject: (name: string) => Promise<EnsuredProjectIdentifier>;
  fallbackProjectName: string;
  folderInfo: LocalFolderMountSource;
  projectName?: string;
  bindLocalProjectRuntimeLocation: (
    projectId: string,
    folderInfo: LocalFolderMountSource,
  ) => Promise<ProjectRuntimeLocationBindingResult>;
}

export interface ImportedLocalFolderProject {
  localMount: LocalProjectMount;
  projectId: string;
  projectName: string;
  reusedExistingProject: boolean;
}

/**
 * Device-local mount metadata returned to the renderer after a folder import.
 * This is deliberately separate from the project's remote root identity.
 */
export interface LocalProjectMount {
  displayName: string;
  type: LocalFolderMountSource['type'];
}

export interface RebindLocalFolderProjectOptions {
  projectId: string;
  fallbackProjectName: string;
  folderInfo: LocalFolderMountSource;
  bindLocalProjectRuntimeLocation: (
    projectId: string,
    folderInfo: LocalFolderMountSource,
  ) => Promise<ProjectRuntimeLocationBindingResult>;
}

export class LocalFolderProjectImportError extends Error {
  readonly cleanupError: unknown;
  readonly projectId: string;

  constructor(projectId: string, cause: unknown, cleanupError: unknown = null) {
    const reason = cause instanceof Error && cause.message.trim()
      ? cause.message.trim()
      : 'The local project folder could not be bound.';
    super(reason);
    this.name = 'LocalFolderProjectImportError';
    this.projectId = projectId;
    this.cleanupError = cleanupError;
  }
}

function isWindowsDriveRootPath(path: string): boolean {
  return /^[a-zA-Z]:[\\/]?$/u.test(path);
}

function isPosixRootPath(path: string): boolean {
  return /^\/+$/u.test(path);
}

function isAbsoluteTauriFolderPath(path: string): boolean {
  return /^[a-zA-Z]:[\\/]/u.test(path) || path.startsWith('\\\\') || path.startsWith('/');
}

function trimTrailingPathSeparators(path: string): string {
  const normalizedPath = path.trim();
  if (!normalizedPath) {
    return normalizedPath;
  }

  if (isWindowsDriveRootPath(normalizedPath)) {
    return `${normalizedPath[0].toUpperCase()}:\\`;
  }

  if (isPosixRootPath(normalizedPath)) {
    return '/';
  }

  return normalizedPath.replace(/[\\/]+$/, '');
}

function resolveTauriFolderPath(path: string): string {
  const trimmedPath = path.trim();
  if (!trimmedPath) {
    return trimmedPath;
  }

  const normalizedPath = trimTrailingPathSeparators(trimmedPath) || trimmedPath;
  if (!isAbsoluteTauriFolderPath(normalizedPath)) {
    throw new Error('Local folder import requires an absolute folder path.');
  }

  return normalizedPath;
}

function resolveTauriFolderName(path: string, fallbackProjectName: string): string {
  const normalizedPath = resolveTauriFolderPath(path);
  const segments = normalizedPath.split(/[/\\]/).filter(Boolean);
  return segments[segments.length - 1] || fallbackProjectName;
}

function normalizeFolderInfo(folderInfo: LocalFolderMountSource): LocalFolderMountSource {
  if (folderInfo.type === 'browser') {
    return folderInfo;
  }

  return {
    type: 'tauri',
    path: resolveTauriFolderPath(folderInfo.path),
  };
}

export function resolveLocalFolderMountDisplayName(
  folderInfo: LocalFolderMountSource,
  fallbackProjectName: string,
): string {
  if (folderInfo.type === 'browser') {
    return folderInfo.handle.name || fallbackProjectName;
  }

  return resolveTauriFolderName(folderInfo.path, fallbackProjectName);
}

function resolveLocalProjectMount(
  folderInfo: LocalFolderMountSource,
  fallbackProjectName: string,
): LocalProjectMount {
  const displayName = resolveLocalFolderMountDisplayName(folderInfo, fallbackProjectName);
  if (folderInfo.type === 'browser') {
    return {
      displayName,
      type: 'browser',
    };
  }

  return {
    displayName,
    type: 'tauri',
  };
}

async function bindImportedProjectFolder(
  projectId: string,
  folderInfo: LocalFolderMountSource,
  bindLocalProjectRuntimeLocation: ImportLocalFolderProjectOptions['bindLocalProjectRuntimeLocation'],
): Promise<void> {
  const binding = await bindLocalProjectRuntimeLocation(projectId, folderInfo);
  if (binding.status === 'bound') {
    return;
  }

  throw new Error(binding.message);
}

export async function importLocalFolderProject(
  options: ImportLocalFolderProjectOptions,
): Promise<ImportedLocalFolderProject> {
  const normalizedFolderInfo = normalizeFolderInfo(options.folderInfo);
  const localMount = resolveLocalProjectMount(
    normalizedFolderInfo,
    options.fallbackProjectName,
  );
  const projectName = options.projectName?.trim() || localMount.displayName;
  const ensuredProject = await options.ensureProject(projectName);
  const targetProjectId = ensuredProject.projectId;

  try {
    await bindImportedProjectFolder(
      targetProjectId,
      normalizedFolderInfo,
      options.bindLocalProjectRuntimeLocation,
    );
  } catch (error) {
    throw new LocalFolderProjectImportError(targetProjectId, error);
  }

  emitProjectGitOverviewRefresh(targetProjectId);

  return {
    localMount,
    projectId: targetProjectId,
    projectName,
    reusedExistingProject: ensuredProject.reusedExistingProject,
  };
}

export async function rebindLocalFolderProject(
  options: RebindLocalFolderProjectOptions,
): Promise<ImportedLocalFolderProject> {
  const normalizedFolderInfo = normalizeFolderInfo(options.folderInfo);
  const localMount = resolveLocalProjectMount(
    normalizedFolderInfo,
    options.fallbackProjectName,
  );
  const projectName = localMount.displayName;

  await bindImportedProjectFolder(
    options.projectId,
    normalizedFolderInfo,
    options.bindLocalProjectRuntimeLocation,
  );
  emitProjectGitOverviewRefresh(options.projectId);

  return {
    localMount,
    projectId: options.projectId,
    projectName,
    reusedExistingProject: false,
  };
}
