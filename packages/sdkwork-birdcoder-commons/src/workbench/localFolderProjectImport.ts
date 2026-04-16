import type { BirdCoderProject, LocalFolderMountSource } from '@sdkwork/birdcoder-types';

interface ProjectIdentifier {
  id: string;
}

type ProjectPathCandidate = Pick<BirdCoderProject, 'id' | 'name' | 'path'>;

export interface ImportLocalFolderProjectOptions {
  createProject: (name: string) => Promise<ProjectIdentifier>;
  fallbackProjectName: string;
  folderInfo: LocalFolderMountSource;
  getProjects?: () => Promise<ProjectPathCandidate[]>;
  mountFolder: (projectId: string, folderInfo: LocalFolderMountSource) => Promise<void>;
  updateProject: (projectId: string, updates: { path?: string }) => Promise<void>;
}

export interface ImportedLocalFolderProject {
  projectId: string;
  projectName: string;
  projectPath: string;
}

export interface RebindLocalFolderProjectOptions {
  projectId: string;
  fallbackProjectName: string;
  folderInfo: LocalFolderMountSource;
  mountFolder: (projectId: string, folderInfo: LocalFolderMountSource) => Promise<void>;
  updateProject: (projectId: string, updates: { path?: string }) => Promise<void>;
}

function trimTrailingPathSeparators(path: string): string {
  const normalizedPath = path.trim();
  if (!normalizedPath) {
    return normalizedPath;
  }

  if (/^[a-zA-Z]:[\\/]?$/.test(normalizedPath)) {
    return normalizedPath[0].toUpperCase() + ':';
  }

  return normalizedPath.replace(/[\\/]+$/, '');
}

function resolveTauriFolderPath(path: string): string {
  const normalizedPath = trimTrailingPathSeparators(path);
  return normalizedPath || path.trim();
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

function resolveImportedProjectPath(folderInfo: LocalFolderMountSource): string {
  if (folderInfo.type === 'browser') {
    return `/${folderInfo.handle.name}`;
  }

  return resolveTauriFolderPath(folderInfo.path);
}

function normalizeProjectPathForComparison(path: string | null | undefined): string | null {
  if (typeof path !== 'string') {
    return null;
  }

  const trimmedPath = path.trim();
  if (!trimmedPath) {
    return null;
  }

  const isWindowsStylePath =
    /^[a-zA-Z]:/u.test(trimmedPath) ||
    trimmedPath.includes('\\') ||
    trimmedPath.startsWith('\\\\');
  const normalizedSeparators = trimmedPath.replace(/\\/gu, '/');
  const collapsedPath = normalizedSeparators.startsWith('//')
    ? `//${normalizedSeparators.slice(2).replace(/\/+/gu, '/')}`
    : normalizedSeparators.replace(/\/+/gu, '/');
  const withoutTrailingSeparator =
    collapsedPath === '/'
      ? collapsedPath
      : collapsedPath.replace(/\/+$/u, '') || collapsedPath;

  return isWindowsStylePath
    ? withoutTrailingSeparator.toLowerCase()
    : withoutTrailingSeparator;
}

function findExistingProjectByPath(
  projects: readonly ProjectPathCandidate[],
  projectPath: string,
): ProjectPathCandidate | null {
  const normalizedImportedPath = normalizeProjectPathForComparison(projectPath);
  if (!normalizedImportedPath) {
    return null;
  }

  return (
    projects.find((project) => {
      const normalizedProjectPath = normalizeProjectPathForComparison(project.path);
      return normalizedProjectPath === normalizedImportedPath;
    }) ?? null
  );
}

export async function importLocalFolderProject(
  options: ImportLocalFolderProjectOptions,
): Promise<ImportedLocalFolderProject> {
  const normalizedFolderInfo = normalizeFolderInfo(options.folderInfo);
  const projectName = resolveImportedProjectName(
    normalizedFolderInfo,
    options.fallbackProjectName,
  );
  const projectPath = resolveImportedProjectPath(normalizedFolderInfo);
  const existingProject =
    normalizedFolderInfo.type === 'tauri' && options.getProjects
      ? findExistingProjectByPath(await options.getProjects(), projectPath)
      : null;
  const targetProjectId =
    existingProject?.id ?? (await options.createProject(projectName)).id;
  const resolvedProjectName = existingProject?.name.trim() || projectName;

  await options.mountFolder(targetProjectId, normalizedFolderInfo);
  await options.updateProject(targetProjectId, {
    path: projectPath,
  });

  return {
    projectId: targetProjectId,
    projectName: resolvedProjectName,
    projectPath,
  };
}

export async function rebindLocalFolderProject(
  options: RebindLocalFolderProjectOptions,
): Promise<ImportedLocalFolderProject> {
  const normalizedFolderInfo = normalizeFolderInfo(options.folderInfo);
  const projectName = resolveImportedProjectName(
    normalizedFolderInfo,
    options.fallbackProjectName,
  );
  const projectPath = resolveImportedProjectPath(normalizedFolderInfo);

  await options.mountFolder(options.projectId, normalizedFolderInfo);
  await options.updateProject(options.projectId, {
    path: projectPath,
  });

  return {
    projectId: options.projectId,
    projectName,
    projectPath,
  };
}
