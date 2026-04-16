import type { BirdCoderProject, LocalFolderMountSource } from '@sdkwork/birdcoder-types';

interface ProjectIdentifier {
  id: string;
}

type ProjectPathCandidate = Pick<BirdCoderProject, 'id' | 'name' | 'path'>;

export interface ImportLocalFolderProjectOptions {
  createProject: (
    name: string,
    options?: {
      path?: string;
    },
  ) => Promise<ProjectIdentifier>;
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
  reusedExistingProject: boolean;
}

export interface RebindLocalFolderProjectOptions {
  projectId: string;
  fallbackProjectName: string;
  folderInfo: LocalFolderMountSource;
  mountFolder: (projectId: string, folderInfo: LocalFolderMountSource) => Promise<void>;
  updateProject: (projectId: string, updates: { path?: string }) => Promise<void>;
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

  const matchingProjects = projects
    .map((project) => {
      const trimmedProjectPath = project.path?.trim() ?? '';
      const normalizedProjectPath = normalizeProjectPathForComparison(trimmedProjectPath);

      if (!normalizedProjectPath || normalizedProjectPath !== normalizedImportedPath) {
        return null;
      }

      const isExactPathMatch = trimmedProjectPath === projectPath;
      const isCanonicalPathMatch =
        !isExactPathMatch &&
        trimmedProjectPath.length > 0 &&
        resolveTauriFolderPath(trimmedProjectPath) === projectPath;

      return {
        project,
        score: isExactPathMatch ? 2 : isCanonicalPathMatch ? 1 : 0,
      };
    })
    .filter((candidate): candidate is { project: ProjectPathCandidate; score: number } => {
      return candidate !== null;
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.project.id.localeCompare(right.project.id);
    });

  return matchingProjects[0]?.project ?? null;
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
  let existingProject: ProjectPathCandidate | null = null;

  if (normalizedFolderInfo.type === 'tauri') {
    if (!options.getProjects) {
      throw new Error(
        'Tauri local folder import requires workspace project lookup for absolute-path deduplication.',
      );
    }

    existingProject = findExistingProjectByPath(await options.getProjects(), projectPath);
  }

  const reusedExistingProject = existingProject !== null;
  const targetProjectId =
    existingProject?.id ??
    (await options.createProject(projectName, { path: projectPath })).id;
  const resolvedProjectName = existingProject?.name.trim() || projectName;

  await options.mountFolder(targetProjectId, normalizedFolderInfo);
  if (reusedExistingProject) {
    await options.updateProject(targetProjectId, {
      path: projectPath,
    });
  }

  return {
    projectId: targetProjectId,
    projectName: resolvedProjectName,
    projectPath,
    reusedExistingProject,
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
    reusedExistingProject: false,
  };
}
