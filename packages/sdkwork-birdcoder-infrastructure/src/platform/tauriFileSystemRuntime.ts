import type { FileRevisionLookupResult, IFileNode } from '@sdkwork/birdcoder-types';
import { isBirdCoderTauriRuntime } from './tauriRuntime.ts';

type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
type TauriListenEvent<TPayload> = {
  payload: TPayload;
};
type TauriListen = <TPayload>(
  eventName: string,
  listener: (event: TauriListenEvent<TPayload>) => void,
) => Promise<() => void>;

export interface BirdCoderTauriFolderSnapshot {
  rootVirtualPath: string;
  tree: IFileNode;
}

export interface BirdCoderTauriDirectoryListing {
  rootVirtualPath: string;
  directory: IFileNode;
}

interface BirdCoderTauriFileRevisionProbe {
  error?: string;
  missing: boolean;
  revision: string | null;
}

export interface BirdCoderTauriPathRevisionLookupResult {
  path: string;
  revision: string | null;
  missing: boolean;
  error?: string;
}

export interface BirdCoderTauriFileSystemWatchEvent {
  kind: 'create' | 'modify' | 'remove' | 'rename' | 'other';
  paths: string[];
}

interface BirdCoderTauriFileSystemWatchRegistration {
  watchId: string;
}

interface BirdCoderTauriFileSystemWatchEventPayload extends BirdCoderTauriFileSystemWatchEvent {
  watchId: string;
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
    options?: { maxBytes?: number },
  ): Promise<string>;
  getFileRevision(
    rootSystemPath: string,
    rootVirtualPath: string,
    mountedPath: string,
  ): Promise<string>;
  getFileRevisions(
    rootSystemPath: string,
    rootVirtualPath: string,
    mountedPaths: readonly string[],
  ): Promise<ReadonlyArray<FileRevisionLookupResult>>;
  getDirectoryRevisions(
    rootSystemPath: string,
    rootVirtualPath: string,
    mountedPaths: readonly string[],
  ): Promise<ReadonlyArray<BirdCoderTauriPathRevisionLookupResult>>;
  renameEntry(
    rootSystemPath: string,
    rootVirtualPath: string,
    oldMountedPath: string,
    newMountedPath: string,
  ): Promise<void>;
  listDirectory(
    rootSystemPath: string,
    rootVirtualPath: string | null,
    mountedPath?: string,
  ): Promise<BirdCoderTauriDirectoryListing>;
  watchProjectTree(
    rootSystemPath: string,
    listener: (event: BirdCoderTauriFileSystemWatchEvent) => void,
  ): Promise<() => Promise<void>>;
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

async function resolveTauriListen(): Promise<TauriListen | null> {
  if (!(await isBirdCoderTauriRuntime())) {
    return null;
  }

  if (typeof window !== 'undefined') {
    const directListen = (
      window as Window &
        typeof globalThis & {
          __TAURI_INTERNALS__?: {
            event?: {
              listen?: TauriListen;
            };
          };
        }
    ).__TAURI_INTERNALS__?.event?.listen;
    if (typeof directListen === 'function') {
      return directListen;
    }
  }

  try {
    const { listen } = await import('@tauri-apps/api/event');
    return listen;
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

function normalizeMountedAbsolutePath(mountedPath: string): string {
  const normalizedMountedPath = mountedPath.trim();
  if (!normalizedMountedPath.startsWith('/')) {
    throw new Error(`Mounted path must be absolute. Received "${mountedPath}".`);
  }

  return normalizedMountedPath.endsWith('/') && normalizedMountedPath.length > 1
    ? normalizedMountedPath.slice(0, -1)
    : normalizedMountedPath;
}

function toMountedRelativePath(rootVirtualPath: string, mountedPath: string): string {
  const normalizedRoot = normalizeMountedRootPath(rootVirtualPath);
  const normalizedMountedPath = normalizeMountedAbsolutePath(mountedPath);
  if (normalizedMountedPath === normalizedRoot) {
    return '';
  }

  const rootPrefix = `${normalizedRoot}/`;

  if (!normalizedMountedPath.startsWith(rootPrefix)) {
    throw new Error(
      `Mounted path "${mountedPath}" must stay within the mounted project root "${rootVirtualPath}".`,
    );
  }

  return normalizedMountedPath.slice(rootPrefix.length);
}

function toOptionalMountedRelativePath(
  rootVirtualPath: string | null,
  mountedPath?: string,
): string | undefined {
  const normalizedMountedPath = mountedPath
    ? normalizeMountedAbsolutePath(mountedPath)
    : undefined;
  if (!normalizedMountedPath) {
    return undefined;
  }

  const normalizedRoot = normalizeMountedRootPath(rootVirtualPath ?? normalizedMountedPath);
  if (normalizedMountedPath === normalizedRoot) {
    return '';
  }

  return toMountedRelativePath(normalizedRoot, normalizedMountedPath);
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

function normalizeWatchEventKind(
  kind: unknown,
): BirdCoderTauriFileSystemWatchEvent['kind'] {
  switch (kind) {
    case 'create':
    case 'modify':
    case 'remove':
    case 'rename':
      return kind;
    default:
      return 'other';
  }
}

function normalizeWatchEventPaths(paths: unknown): string[] {
  if (!Array.isArray(paths)) {
    return [];
  }

  const normalizedPaths = new Set<string>();
  paths.forEach((path) => {
    if (typeof path !== 'string') {
      return;
    }

    const normalizedPath = path.trim();
    if (!normalizedPath) {
      return;
    }

    normalizedPaths.add(normalizedPath);
  });

  return [...normalizedPaths];
}

function normalizeTauriReadFileMaxBytes(maxBytes: number | undefined): number | undefined {
  if (typeof maxBytes !== 'number' || !Number.isFinite(maxBytes) || maxBytes <= 0) {
    return undefined;
  }

  return Math.floor(maxBytes);
}

export function createBirdCoderTauriFileSystemRuntime(): BirdCoderTauriFileSystemRuntime {
  return {
    async listDirectory(rootSystemPath, rootVirtualPath, mountedPath) {
      return invokeTauriFileSystemCommand<BirdCoderTauriDirectoryListing>('fs_list_directory', {
        rootPath: rootSystemPath,
        relativePath: toOptionalMountedRelativePath(rootVirtualPath, mountedPath),
      });
    },
    async snapshotFolder(rootSystemPath) {
      return invokeTauriFileSystemCommand<BirdCoderTauriFolderSnapshot>('fs_snapshot_folder', {
        rootPath: rootSystemPath,
      });
    },
    async watchProjectTree(rootSystemPath, listener) {
      const listen = await resolveTauriListen();
      if (!listen) {
        throw new Error('Tauri filesystem watch bridge is unavailable.');
      }

      const registration =
        await invokeTauriFileSystemCommand<BirdCoderTauriFileSystemWatchRegistration>(
          'fs_watch_start',
          {
            rootPath: rootSystemPath,
          },
        );
      let unlisten: (() => void) | null = null;

      try {
        unlisten = await listen<BirdCoderTauriFileSystemWatchEventPayload>(
          'birdcoder:file-system-watch',
          (event) => {
            const payload = event.payload;
            if (!payload || payload.watchId !== registration.watchId) {
              return;
            }

            listener({
              kind: normalizeWatchEventKind(payload.kind),
              paths: normalizeWatchEventPaths(payload.paths),
            });
          },
        );
      } catch (error) {
        await invokeTauriFileSystemCommand('fs_watch_stop', {
          watchId: registration.watchId,
        }).catch(() => undefined);
        throw error;
      }

      return async () => {
        try {
          unlisten?.();
        } finally {
          await invokeTauriFileSystemCommand('fs_watch_stop', {
            watchId: registration.watchId,
          }).catch((error) => {
            console.error(
              `Failed to stop Tauri filesystem watcher "${registration.watchId}"`,
              error,
            );
          });
        }
      };
    },
    async readFile(rootSystemPath, rootVirtualPath, mountedPath, options) {
      return invokeTauriFileSystemCommand<string>('fs_read_file', {
        maxBytes: normalizeTauriReadFileMaxBytes(options?.maxBytes),
        rootPath: rootSystemPath,
        relativePath: toMountedRelativePath(rootVirtualPath, mountedPath),
      });
    },
    async getFileRevision(rootSystemPath, rootVirtualPath, mountedPath) {
      return invokeTauriFileSystemCommand<string>('fs_get_file_revision', {
        rootPath: rootSystemPath,
        relativePath: toMountedRelativePath(rootVirtualPath, mountedPath),
      });
    },
    async getFileRevisions(rootSystemPath, rootVirtualPath, mountedPaths) {
      if (mountedPaths.length === 0) {
        return [];
      }

      const probes = await invokeTauriFileSystemCommand<BirdCoderTauriFileRevisionProbe[]>(
        'fs_get_file_revisions',
        {
          rootPath: rootSystemPath,
          relativePaths: mountedPaths.map((mountedPath) =>
            toMountedRelativePath(rootVirtualPath, mountedPath),
          ),
        },
      );

      return mountedPaths.map((mountedPath, index) => {
        const probe = probes[index];
        if (!probe) {
          return {
            path: mountedPath,
            revision: null,
            missing: false,
            error: 'Missing revision probe response.',
          };
        }

        return {
          path: mountedPath,
          revision: probe.revision,
          missing: probe.missing,
          ...(probe.error ? { error: probe.error } : {}),
        };
      });
    },
    async getDirectoryRevisions(rootSystemPath, rootVirtualPath, mountedPaths) {
      if (mountedPaths.length === 0) {
        return [];
      }

      const probes = await invokeTauriFileSystemCommand<BirdCoderTauriFileRevisionProbe[]>(
        'fs_get_directory_revisions',
        {
          rootPath: rootSystemPath,
          relativePaths: mountedPaths.map((mountedPath) =>
            toMountedRelativePath(rootVirtualPath, mountedPath),
          ),
        },
      );

      return mountedPaths.map((mountedPath, index) => {
        const probe = probes[index];
        if (!probe) {
          return {
            path: mountedPath,
            revision: null,
            missing: false,
            error: 'Missing directory revision probe response.',
          };
        }

        return {
          path: mountedPath,
          revision: probe.revision,
          missing: probe.missing,
          ...(probe.error ? { error: probe.error } : {}),
        };
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
