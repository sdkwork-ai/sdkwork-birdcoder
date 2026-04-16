import type { IFileNode } from '@sdkwork/birdcoder-types';
import { isBirdCoderTauriRuntime } from './tauriRuntime.ts';

type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export interface BirdCoderTauriFolderSnapshot {
  rootVirtualPath: string;
  tree: IFileNode;
}

export interface BirdCoderTauriFileSystemRuntime {
  createDirectory(
    rootSystemPath: string,
    rootVirtualPath: string,
    mountedPath: string,
  ): Promise<void>;
  createFile(
    rootSystemPath: string,
    rootVirtualPath: string,
    mountedPath: string,
  ): Promise<void>;
  deleteEntry(
    rootSystemPath: string,
    rootVirtualPath: string,
    mountedPath: string,
    options?: { recursive?: boolean },
  ): Promise<void>;
  readFile(
    rootSystemPath: string,
    rootVirtualPath: string,
    mountedPath: string,
  ): Promise<string>;
  renameEntry(
    rootSystemPath: string,
    rootVirtualPath: string,
    oldMountedPath: string,
    newMountedPath: string,
  ): Promise<void>;
  snapshotFolder(rootSystemPath: string): Promise<BirdCoderTauriFolderSnapshot>;
  writeFile(
    rootSystemPath: string,
    rootVirtualPath: string,
    mountedPath: string,
    content: string,
  ): Promise<void>;
}

async function resolveTauriInvoke(): Promise<TauriInvoke | null> {
  if (!(await isBirdCoderTauriRuntime())) {
    return null;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke;
  } catch {
    return null;
  }
}

function normalizeMountedRootPath(rootVirtualPath: string): string {
  const normalizedRoot = rootVirtualPath.trim();
  if (!normalizedRoot.startsWith('/')) {
    throw new Error(`Mounted root path must be absolute. Received "${rootVirtualPath}".`);
  }

  return normalizedRoot.endsWith('/') && normalizedRoot.length > 1
    ? normalizedRoot.slice(0, -1)
    : normalizedRoot;
}

function toMountedRelativePath(rootVirtualPath: string, mountedPath: string): string {
  const normalizedRoot = normalizeMountedRootPath(rootVirtualPath);
  const normalizedMountedPath = mountedPath.trim();
  const rootPrefix = `${normalizedRoot}/`;

  if (!normalizedMountedPath.startsWith(rootPrefix)) {
    throw new Error(
      `Mounted path "${mountedPath}" must stay within the mounted project root "${rootVirtualPath}".`,
    );
  }

  return normalizedMountedPath.slice(rootPrefix.length);
}

async function invokeTauriFileSystemCommand<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const invoke = await resolveTauriInvoke();
  if (!invoke) {
    throw new Error(`Tauri filesystem bridge is unavailable for "${command}".`);
  }

  return invoke<T>(command, args);
}

export function createBirdCoderTauriFileSystemRuntime(): BirdCoderTauriFileSystemRuntime {
  return {
    async snapshotFolder(rootSystemPath) {
      return invokeTauriFileSystemCommand<BirdCoderTauriFolderSnapshot>('fs_snapshot_folder', {
        rootPath: rootSystemPath,
      });
    },
    async readFile(rootSystemPath, rootVirtualPath, mountedPath) {
      return invokeTauriFileSystemCommand<string>('fs_read_file', {
        rootPath: rootSystemPath,
        relativePath: toMountedRelativePath(rootVirtualPath, mountedPath),
      });
    },
    async writeFile(rootSystemPath, rootVirtualPath, mountedPath, content) {
      await invokeTauriFileSystemCommand('fs_write_file', {
        rootPath: rootSystemPath,
        relativePath: toMountedRelativePath(rootVirtualPath, mountedPath),
        content,
      });
    },
    async createFile(rootSystemPath, rootVirtualPath, mountedPath) {
      await invokeTauriFileSystemCommand('fs_create_file', {
        rootPath: rootSystemPath,
        relativePath: toMountedRelativePath(rootVirtualPath, mountedPath),
      });
    },
    async createDirectory(rootSystemPath, rootVirtualPath, mountedPath) {
      await invokeTauriFileSystemCommand('fs_create_directory', {
        rootPath: rootSystemPath,
        relativePath: toMountedRelativePath(rootVirtualPath, mountedPath),
      });
    },
    async deleteEntry(rootSystemPath, rootVirtualPath, mountedPath, options) {
      await invokeTauriFileSystemCommand('fs_delete_entry', {
        rootPath: rootSystemPath,
        relativePath: toMountedRelativePath(rootVirtualPath, mountedPath),
        recursive: options?.recursive === true,
      });
    },
    async renameEntry(rootSystemPath, rootVirtualPath, oldMountedPath, newMountedPath) {
      await invokeTauriFileSystemCommand('fs_rename_entry', {
        rootPath: rootSystemPath,
        oldRelativePath: toMountedRelativePath(rootVirtualPath, oldMountedPath),
        newRelativePath: toMountedRelativePath(rootVirtualPath, newMountedPath),
      });
    },
  };
}
