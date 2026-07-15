import type { LocalFolderMountSource } from '@sdkwork/birdcoder-pc-types';
import { emitProjectGitOverviewRefresh } from './projectGitOverview.ts';

interface ProjectIdentifier {
  id: string;
}

export interface ImportLocalFolderProjectOptions {
  createProject: (
    name: string,
    options?: {
      appTemplateVersionId?: string;
      templatePresetKey?: string;
    },
  ) => Promise<ProjectIdentifier>;
  fallbackProjectName: string;
  folderInfo: LocalFolderMountSource;
  mountFolder: (projectId: string, folderInfo: LocalFolderMountSource) => Promise<void>;
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
  mountFolder: (projectId: string, folderInfo: LocalFolderMountSource) => Promise<void>;
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

function resolveImportedProjectName(
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
  const displayName = resolveImportedProjectName(folderInfo, fallbackProjectName);
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

export async function importLocalFolderProject(
  options: ImportLocalFolderProjectOptions,
): Promise<ImportedLocalFolderProject> {
  const normalizedFolderInfo = normalizeFolderInfo(options.folderInfo);
  const localMount = resolveLocalProjectMount(
    normalizedFolderInfo,
    options.fallbackProjectName,
  );
  const projectName = localMount.displayName;
  const targetProjectId = (await options.createProject(projectName)).id;

  await options.mountFolder(targetProjectId, normalizedFolderInfo);
  emitProjectGitOverviewRefresh(targetProjectId);

  return {
    localMount,
    projectId: targetProjectId,
    projectName,
    reusedExistingProject: false,
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

  await options.mountFolder(options.projectId, normalizedFolderInfo);
  emitProjectGitOverviewRefresh(options.projectId);

  return {
    localMount,
    projectId: options.projectId,
    projectName,
    reusedExistingProject: false,
  };
}
