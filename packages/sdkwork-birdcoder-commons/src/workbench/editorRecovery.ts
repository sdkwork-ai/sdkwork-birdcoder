import type { IFileNode } from '@sdkwork/birdcoder-types';

export interface ResolveStartupSelectedFileOptions {
  files: ReadonlyArray<IFileNode>;
  persistedSelectedFilePath: string | null;
}

function normalizeProjectId(projectId: string | null | undefined): string {
  return typeof projectId === 'string'
    ? projectId.trim()
    : '';
}

function hasFilePath(nodes: ReadonlyArray<IFileNode>, targetPath: string): boolean {
  for (const node of nodes) {
    if (node.type === 'file' && node.path === targetPath) {
      return true;
    }

    if (node.children?.length && hasFilePath(node.children, targetPath)) {
      return true;
    }
  }

  return false;
}

export function buildEditorSelectionStorageKey(
  projectId: string | null | undefined,
): string {
  const normalizedProjectId = normalizeProjectId(projectId);
  return normalizedProjectId
    ? `selected-file.${normalizedProjectId}.v1`
    : 'selected-file.global.v1';
}

export function findFirstFile(nodes: ReadonlyArray<IFileNode>): string | null {
  for (const node of nodes) {
    if (node.type === 'file') {
      return node.path;
    }

    if (node.children?.length) {
      const nestedFilePath = findFirstFile(node.children);
      if (nestedFilePath) {
        return nestedFilePath;
      }
    }
  }

  return null;
}

export function resolveStartupSelectedFile(
  options: ResolveStartupSelectedFileOptions,
): string | null {
  const persistedSelectedFilePath = options.persistedSelectedFilePath?.trim() ?? '';
  if (persistedSelectedFilePath && hasFilePath(options.files, persistedSelectedFilePath)) {
    return persistedSelectedFilePath;
  }

  return null;
}
