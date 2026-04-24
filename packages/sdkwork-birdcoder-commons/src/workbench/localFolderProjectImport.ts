import type { BirdCoderProject, LocalFolderMountSource } from '@sdkwork/birdcoder-types';
import { emitProjectGitOverviewRefresh } from './projectGitOverview.ts';

interface ProjectIdentifier {
  id: string;
}

type ProjectPathCandidate = Pick<BirdCoderProject, 'id' | 'name' | 'path'>;

export interface ImportLocalFolderProjectOptions {
  createProject: (
    name: string,
    options?: {
      appTemplateVersionId?: string;
      path?: string;
      templatePresetKey?: string;
    },
  ) => Promise<ProjectIdentifier>;
  fallbackProjectName: string;
  folderInfo: LocalFolderMountSource;
  getProjectByPath?: (projectPath: string) => Promise<ProjectPathCandidate | null>;
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

function hasMatchingProjectPath(
  candidatePath: string | undefined,
  projectPath: string,
): boolean {
  if (!candidatePath) {
    return false;
  }

  return trimTrailingPathSeparators(candidatePath) === trimTrailingPathSeparators(projectPath);
}

async function resolveExistingProjectByPath(
  options: ImportLocalFolderProjectOptions,
  projectPath: string,
): Promise<ProjectPathCandidate | null> {
  if (typeof options.getProjectByPath === 'function') {
    return options.getProjectByPath(projectPath);
  }

  if (typeof options.getProjects !== 'function') {
    return null;
  }

  const projects = await options.getProjects();
  return projects.find((project) => hasMatchingProjectPath(project.path, projectPath)) ?? null;
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
    existingProject = await resolveExistingProjectByPath(options, projectPath);
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
  emitProjectGitOverviewRefresh(targetProjectId);

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
  emitProjectGitOverviewRefresh(options.projectId);

  return {
    projectId: options.projectId,
    projectName,
    projectPath,
    reusedExistingProject: false,
  };
}
