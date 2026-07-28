import type {
  SandboxEntry,
  SandboxExplorerPort,
  SandboxRoot,
} from '@sdkwork/drive-pc-sandbox-contracts';
import {
  searchProjectFiles,
  type FileRevisionLookupResult,
  type IFileNode,
  type LocalFolderMountSource,
  type ProjectDeviceMountRecoveryResult,
  type ProjectDeviceMountState,
  type ProjectFileSystemRoot,
  type ProjectFileSystemChangeEvent,
  type ProjectFileSearchExecutionResult,
  type ProjectFileSearchOptions,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  FileSystemChangeSubscriptionOptions,
  IFileSystemService,
} from '../interfaces/IFileSystemService.ts';
import type {
  IProjectService,
  ProjectDriveComposition,
} from '../interfaces/IProjectService.ts';
import {
  createDriveSandboxProjectPathContext,
  relocateNodeInTree,
  removeNodeFromTree,
  replaceDirectoryInTree,
  splitVirtualMutationPath,
  toSandboxLogicalPath,
  toVirtualProjectPath,
  upsertNodeInDirectory,
  type DriveSandboxProjectPathContext,
} from './driveSandboxProjectPaths.ts';

const DIRECTORY_PAGE_SIZE = 200;
const MAX_DIRECTORY_PAGES = 100;
const MAX_SEARCH_TREE_NODES = 20_000;
const REMOTE_POLL_INTERVAL_MS = 2_000;
const MAX_REMOTE_POLLED_FILES = 16;

interface DriveSandboxProjectFileSystemServiceOptions {
  readonly drivePort: SandboxExplorerPort;
  readonly projectService: Pick<IProjectService, 'getProjectDrive'>;
  readonly remotePollIntervalMs?: number;
}

interface RemoteProjectState {
  readonly binding: ProjectDriveComposition;
  readonly context: DriveSandboxProjectPathContext;
  readonly entriesByVirtualPath: Map<string, SandboxEntry>;
  tree: IFileNode[];
}

export class ProjectDriveCompositionRequiredError extends Error {
  readonly projectId: string;

  constructor(projectId: string) {
    super('The Agents project has no primary Drive composition.');
    this.name = 'ProjectDriveCompositionRequiredError';
    this.projectId = projectId;
  }
}

function normalizeProjectId(projectId: string): string {
  const normalized = projectId.trim();
  if (!normalized) throw new Error('Project ID is required for file-system access.');
  return normalized;
}

function bindingIdentity(binding: ProjectDriveComposition): string {
  return [
    binding.slotId,
    binding.version,
    binding.driveId,
    binding.rootEntryId,
    binding.logicalPath,
  ].join('\u001f');
}

function compareFileNodes(left: IFileNode, right: IFileNode): number {
  if (left.type !== right.type) return left.type === 'directory' ? -1 : 1;
  return left.name.localeCompare(right.name);
}

function entryToFileNode(
  state: RemoteProjectState,
  entry: SandboxEntry,
): IFileNode {
  const path = toVirtualProjectPath(state.context, entry.logicalPath);
  state.entriesByVirtualPath.set(path, entry);
  return {
    name: entry.name,
    path,
    type: entry.kind,
  };
}

function createRootNode(state: RemoteProjectState, children: IFileNode[]): IFileNode {
  return {
    name: state.context.virtualRootName,
    path: state.context.virtualRootPath,
    type: 'directory',
    children: children.sort(compareFileNodes),
  };
}

export class DriveSandboxProjectFileSystemService implements IFileSystemService {
  private readonly drivePort: SandboxExplorerPort;
  private readonly projectService: DriveSandboxProjectFileSystemServiceOptions['projectService'];
  private readonly projectStates = new Map<string, RemoteProjectState>();
  private readonly remotePollIntervalMs: number;

  constructor(options: DriveSandboxProjectFileSystemServiceOptions) {
    this.drivePort = options.drivePort;
    this.projectService = options.projectService;
    this.remotePollIntervalMs = Math.max(500, options.remotePollIntervalMs ?? REMOTE_POLL_INTERVAL_MS);
  }

  private async findSandboxRoot(sandboxId: string): Promise<SandboxRoot> {
    let page = 1;
    let totalPages = 1;
    do {
      const result = await this.drivePort.listSandboxes({ page, pageSize: DIRECTORY_PAGE_SIZE });
      const root = result.items.find((item) => item.id === sandboxId);
      if (root) return root;
      totalPages = result.totalPages;
      page += 1;
    } while (page <= totalPages && page <= MAX_DIRECTORY_PAGES);
    throw new Error('The bound Drive sandbox is unavailable or no longer authorized.');
  }

  private async resolveRemoteProject(projectId: string): Promise<RemoteProjectState | null> {
    const normalizedProjectId = normalizeProjectId(projectId);
    const binding = await this.projectService.getProjectDrive(normalizedProjectId);
    if (!binding) {
      this.projectStates.delete(normalizedProjectId);
      return null;
    }
    if (binding.projectId !== normalizedProjectId) {
      throw new Error('Project Drive composition does not match the active project.');
    }

    const current = this.projectStates.get(normalizedProjectId);
    if (current && bindingIdentity(current.binding) === bindingIdentity(binding)) {
      return current;
    }

    const sandboxRoot = await this.findSandboxRoot(binding.driveId);
    if (!binding.logicalPath && sandboxRoot.rootEntryId !== binding.rootEntryId) {
      throw new Error('Project workspace root identity no longer matches the Drive sandbox root.');
    }
    const state: RemoteProjectState = {
      binding,
      context: createDriveSandboxProjectPathContext(binding.logicalPath),
      entriesByVirtualPath: new Map(),
      tree: [],
    };
    this.projectStates.set(normalizedProjectId, state);
    return state;
  }

  private async collectDirectoryChildrenBounded(
    state: RemoteProjectState,
    logicalPath: string,
  ): Promise<readonly SandboxEntry[]> {
    const items: SandboxEntry[] = [];
    let cursor: string | undefined;
    for (let page = 1; page <= MAX_DIRECTORY_PAGES; page += 1) {
      const result = await this.drivePort.listChildren({
        sandboxId: state.binding.driveId,
        parentPath: logicalPath,
        pageSize: DIRECTORY_PAGE_SIZE,
        ...(cursor ? { cursor } : {}),
      });
      items.push(...result.items);
      cursor = result.nextCursor;
      if (!cursor) return items;
    }
    throw new Error('Server directory exceeds the supported bounded page traversal limit.');
  }

  private async loadRemoteDirectory(
    state: RemoteProjectState,
    virtualPath: string,
  ): Promise<IFileNode> {
    const logicalPath = toSandboxLogicalPath(state.context, virtualPath);
    const entries = await this.collectDirectoryChildrenBounded(state, logicalPath);
    const currentChildrenByPath = new Map(
      entries.map((entry) => [toVirtualProjectPath(state.context, entry.logicalPath), entry]),
    );
    for (const [childPath, currentEntry] of currentChildrenByPath) {
      const cachedEntry = state.entriesByVirtualPath.get(childPath);
      if (cachedEntry && cachedEntry.id !== currentEntry.id) {
        state.tree = removeNodeFromTree(state.tree, childPath);
        this.removeCachedEntryTree(state, childPath);
      }
    }
    const descendantPrefix = `${virtualPath}/`;
    for (const cachedPath of [...state.entriesByVirtualPath.keys()]) {
      if (!cachedPath.startsWith(descendantPrefix)) continue;
      const relativePath = cachedPath.slice(descendantPrefix.length);
      const firstSeparatorIndex = relativePath.indexOf('/');
      const directChildPath = firstSeparatorIndex < 0
        ? cachedPath
        : `${virtualPath}/${relativePath.slice(0, firstSeparatorIndex)}`;
      const currentEntry = currentChildrenByPath.get(directChildPath);
      const cachedDirectEntry = state.entriesByVirtualPath.get(directChildPath);
      if (
        !currentEntry
        || (
          firstSeparatorIndex >= 0
          && (
            currentEntry.kind === 'file'
            || !cachedDirectEntry
            || cachedDirectEntry.id !== currentEntry.id
          )
        )
      ) {
        state.entriesByVirtualPath.delete(cachedPath);
      }
    }
    const children = entries.map((entry) => entryToFileNode(state, entry));
    return {
      name: virtualPath === state.context.virtualRootPath
        ? state.context.virtualRootName
        : virtualPath.split('/').at(-1) ?? state.context.virtualRootName,
      path: virtualPath,
      type: 'directory',
      children: children.sort(compareFileNodes),
    };
  }

  private async refreshRemoteDirectoryState(
    state: RemoteProjectState,
    virtualPath: string,
  ): Promise<IFileNode[]> {
    const directory = await this.loadRemoteDirectory(state, virtualPath);
    if (state.tree.length === 0) {
      if (virtualPath !== state.context.virtualRootPath) {
        throw new Error('Project Drive root must be loaded before a nested directory.');
      }
      state.tree = [directory];
      return state.tree;
    }

    state.tree = replaceDirectoryInTree(state.tree, directory);
    return state.tree;
  }

  private async requireRemote<T>(
    projectId: string,
    remote: (state: RemoteProjectState) => Promise<T>,
  ): Promise<T> {
    const normalizedProjectId = normalizeProjectId(projectId);
    const state = await this.resolveRemoteProject(normalizedProjectId);
    if (state) return remote(state);
    throw new ProjectDriveCompositionRequiredError(normalizedProjectId);
  }

  private removeCachedEntryTree(state: RemoteProjectState, virtualPath: string): void {
    const descendantPrefix = `${virtualPath}/`;
    for (const cachedPath of [...state.entriesByVirtualPath.keys()]) {
      if (cachedPath === virtualPath || cachedPath.startsWith(descendantPrefix)) {
        state.entriesByVirtualPath.delete(cachedPath);
      }
    }
  }

  private relocateCachedEntryTree(
    state: RemoteProjectState,
    oldPath: string,
    newPath: string,
    movedEntry: SandboxEntry,
  ): void {
    const descendantPrefix = `${oldPath}/`;
    for (const [cachedPath, cachedEntry] of [...state.entriesByVirtualPath.entries()]) {
      if (cachedPath !== oldPath && !cachedPath.startsWith(descendantPrefix)) continue;
      state.entriesByVirtualPath.delete(cachedPath);
      const relocatedPath = cachedPath === oldPath
        ? newPath
        : `${newPath}${cachedPath.slice(oldPath.length)}`;
      state.entriesByVirtualPath.set(
        relocatedPath,
        cachedPath === oldPath
          ? movedEntry
          : {
              ...cachedEntry,
              logicalPath: toSandboxLogicalPath(state.context, relocatedPath),
            },
      );
    }
    state.entriesByVirtualPath.set(newPath, movedEntry);
  }

  private async resolveRemoteEntry(
    state: RemoteProjectState,
    virtualPath: string,
  ): Promise<SandboxEntry> {
    const logicalPath = toSandboxLogicalPath(state.context, virtualPath);
    if (logicalPath === state.binding.logicalPath) {
      throw new Error('The bound project root is not a mutable Drive entry.');
    }
    const separatorIndex = logicalPath.lastIndexOf('/');
    const parentPath = separatorIndex < 0 ? '' : logicalPath.slice(0, separatorIndex);
    const entries = await this.collectDirectoryChildrenBounded(state, parentPath);
    const entry = entries.find((candidate) => candidate.logicalPath === logicalPath);
    if (!entry) throw new Error('The requested project Drive entry no longer exists.');
    state.entriesByVirtualPath.set(virtualPath, entry);
    return entry;
  }

  private async resolveKnownRemoteEntry(
    state: RemoteProjectState,
    virtualPath: string,
  ): Promise<SandboxEntry> {
    return state.entriesByVirtualPath.get(virtualPath)
      ?? this.resolveRemoteEntry(state, virtualPath);
  }

  async getFiles(projectId: string): Promise<IFileNode[]> {
    const normalizedProjectId = normalizeProjectId(projectId);
    const state = await this.resolveRemoteProject(normalizedProjectId);
    if (!state) {
      throw new ProjectDriveCompositionRequiredError(normalizedProjectId);
    }
    if (state.tree.length > 0) return state.tree;
    return this.refreshRemoteDirectoryState(state, state.context.virtualRootPath);
  }

  async resolveProjectRoot(projectId: string): Promise<ProjectFileSystemRoot | null> {
    const normalizedProjectId = normalizeProjectId(projectId);
    const state = await this.resolveRemoteProject(normalizedProjectId);
    if (!state) {
      return null;
    }

    return {
      displayName: state.context.virtualRootName,
      host: 'server',
      projectId: normalizedProjectId,
      virtualPath: state.context.virtualRootPath,
    };
  }

  async loadDirectory(projectId: string, path: string): Promise<IFileNode[]> {
    return this.requireRemote(
      projectId,
      async (state) => {
        if (state.tree.length === 0) {
          await this.refreshRemoteDirectoryState(state, state.context.virtualRootPath);
        }
        return this.refreshRemoteDirectoryState(state, path);
      },
    );
  }

  async refreshDirectory(projectId: string, path?: string): Promise<IFileNode[]> {
    return this.requireRemote(
      projectId,
      async (state) => {
        if (state.tree.length === 0) {
          await this.refreshRemoteDirectoryState(state, state.context.virtualRootPath);
        }
        return this.refreshRemoteDirectoryState(
          state,
          path ?? state.context.virtualRootPath,
        );
      },
    );
  }

  async refreshDirectories(projectId: string, paths: readonly string[]): Promise<IFileNode[]> {
    return this.requireRemote(projectId, async (state) => {
      if (state.tree.length === 0) {
        await this.refreshRemoteDirectoryState(state, state.context.virtualRootPath);
      }
      const targetPaths = paths.length > 0
        ? new Set(paths)
        : new Set([state.context.virtualRootPath]);
      for (const targetPath of targetPaths) {
        await this.refreshRemoteDirectoryState(state, targetPath);
      }
      return state.tree;
    });
  }

  async getFileContent(projectId: string, path: string): Promise<string> {
    return this.requireRemote(
      projectId,
      async (state) => {
        const entry = await this.resolveKnownRemoteEntry(state, path);
        if (entry.kind !== 'file') throw new Error('The requested project Drive entry is not a file.');
        const result = await this.drivePort.readFile({
          sandboxId: state.binding.driveId,
          entryId: entry.id,
          logicalPath: entry.logicalPath,
          encoding: 'utf8',
        });
        state.entriesByVirtualPath.set(path, result.entry);
        return result.content;
      },
    );
  }

  async getFileRevision(projectId: string, path: string): Promise<string> {
    return this.requireRemote(
      projectId,
      async (state) => (await this.resolveRemoteEntry(state, path)).revision,
    );
  }

  async getFileRevisions(
    projectId: string,
    paths: readonly string[],
  ): Promise<ReadonlyArray<FileRevisionLookupResult>> {
    const normalizedProjectId = normalizeProjectId(projectId);
    const state = await this.resolveRemoteProject(normalizedProjectId);
    if (!state) {
      throw new ProjectDriveCompositionRequiredError(normalizedProjectId);
    }
    return Promise.all(paths.map(async (path): Promise<FileRevisionLookupResult> => {
      try {
        return { path, revision: (await this.resolveRemoteEntry(state, path)).revision, missing: false };
      } catch (error) {
        return {
          path,
          revision: null,
          missing: true,
          error: error instanceof Error ? error.message : 'Unable to resolve server file revision.',
        };
      }
    }));
  }

  async saveFileContent(projectId: string, path: string, content: string): Promise<void> {
    await this.requireRemote(
      projectId,
      async (state) => {
        const entry = await this.resolveKnownRemoteEntry(state, path);
        if (entry.kind !== 'file') throw new Error('The requested project Drive entry is not a file.');
        const updated = await this.drivePort.updateFile({
          sandboxId: state.binding.driveId,
          entryId: entry.id,
          logicalPath: entry.logicalPath,
          revision: entry.revision,
          content,
          encoding: 'utf8',
        });
        state.entriesByVirtualPath.set(path, updated);
      },
    );
  }

  async createFile(projectId: string, path: string): Promise<void> {
    await this.requireRemote(
      projectId,
      async (state) => {
        const target = splitVirtualMutationPath(state.context, path);
        const entry = await this.drivePort.createFile({
          sandboxId: state.binding.driveId,
          parentPath: target.logicalParentPath,
          name: target.name,
          content: '',
          encoding: 'utf8',
        });
        const node = entryToFileNode(state, entry);
        state.tree = upsertNodeInDirectory(state.tree, target.virtualParentPath, node);
      },
    );
  }

  async createFolder(projectId: string, path: string): Promise<void> {
    await this.requireRemote(
      projectId,
      async (state) => {
        const target = splitVirtualMutationPath(state.context, path);
        const entry = await this.drivePort.createDirectory({
          sandboxId: state.binding.driveId,
          parentPath: target.logicalParentPath,
          name: target.name,
        });
        const node = entryToFileNode(state, entry);
        state.tree = upsertNodeInDirectory(state.tree, target.virtualParentPath, node);
      },
    );
  }

  private async deleteRemoteEntry(
    state: RemoteProjectState,
    path: string,
    recursive: boolean,
    expectedKind: SandboxEntry['kind'],
  ): Promise<void> {
    const entry = await this.resolveKnownRemoteEntry(state, path);
    if (entry.kind !== expectedKind) throw new Error(`The requested entry is not a ${expectedKind}.`);
    await this.drivePort.deleteEntry({
      sandboxId: state.binding.driveId,
      entryId: entry.id,
      logicalPath: entry.logicalPath,
      revision: entry.revision,
      recursive,
    });
    this.removeCachedEntryTree(state, path);
    state.tree = removeNodeFromTree(state.tree, path);
  }

  async deleteFile(projectId: string, path: string): Promise<void> {
    await this.requireRemote(
      projectId,
      (state) => this.deleteRemoteEntry(state, path, false, 'file'),
    );
  }

  async deleteFolder(projectId: string, path: string): Promise<void> {
    await this.requireRemote(
      projectId,
      (state) => this.deleteRemoteEntry(state, path, true, 'directory'),
    );
  }

  async renameNode(projectId: string, oldPath: string, newPath: string): Promise<void> {
    await this.requireRemote(
      projectId,
      async (state) => {
        const entry = await this.resolveKnownRemoteEntry(state, oldPath);
        const target = splitVirtualMutationPath(state.context, newPath);
        const moved = await this.drivePort.moveEntry({
          sandboxId: state.binding.driveId,
          entryId: entry.id,
          logicalPath: entry.logicalPath,
          revision: entry.revision,
          destinationParentPath: target.logicalParentPath,
          destinationName: target.name,
        });
        this.relocateCachedEntryTree(state, oldPath, newPath, moved);
        state.tree = relocateNodeInTree(
          state.tree,
          oldPath,
          target.virtualParentPath,
          entryToFileNode(state, moved),
        );
      },
    );
  }

  private async buildRemoteSearchTree(
    state: RemoteProjectState,
    signal?: AbortSignal,
  ): Promise<{ readonly files: IFileNode[]; readonly limitReached: boolean }> {
    const root = createRootNode(state, []);
    const queue: Array<{ logicalPath: string; node: IFileNode }> = [{
      logicalPath: state.binding.logicalPath,
      node: root,
    }];
    let visited = 1;
    let limitReached = false;
    while (queue.length > 0 && !signal?.aborted) {
      const current = queue.shift()!;
      const children: IFileNode[] = [];
      for (const entry of await this.collectDirectoryChildrenBounded(state, current.logicalPath)) {
        if (visited >= MAX_SEARCH_TREE_NODES) {
          limitReached = true;
          break;
        }
        visited += 1;
        const child = entryToFileNode(state, entry);
        children.push(child);
        if (entry.kind === 'directory') queue.push({ logicalPath: entry.logicalPath, node: child });
      }
      current.node.children = children.sort(compareFileNodes);
      if (limitReached) break;
    }
    return { files: [root], limitReached };
  }

  async searchFiles(
    projectId: string,
    options: ProjectFileSearchOptions,
  ): Promise<ProjectFileSearchExecutionResult> {
    return this.requireRemote(
      projectId,
      async (state) => {
        const snapshot = await this.buildRemoteSearchTree(state, options.signal);
        const result = await searchProjectFiles({
          ...options,
          files: snapshot.files,
          readFileContent: async (path) => {
            const entry = state.entriesByVirtualPath.get(path)
              ?? await this.resolveRemoteEntry(state, path);
            const content = await this.drivePort.readFile({
              sandboxId: state.binding.driveId,
              entryId: entry.id,
              logicalPath: entry.logicalPath,
              encoding: 'utf8',
            });
            return content.content;
          },
        });
        return { ...result, limitReached: result.limitReached || snapshot.limitReached };
      },
    );
  }

  subscribeToFileChanges(
    projectId: string,
    listener: (event: ProjectFileSystemChangeEvent) => void,
    options?: FileSystemChangeSubscriptionOptions,
  ): () => void {
    const normalizedProjectId = normalizeProjectId(projectId);
    let closed = false;
    let polling = false;
    const knownRevisions = new Map<string, string | null>();
    const timer = setInterval(() => {
      if (closed || polling) return;
      polling = true;
      void (async () => {
        const state = await this.resolveRemoteProject(normalizedProjectId);
        if (!state) return;
        const paths = (options?.getTrackedFilePaths?.() ?? [])
          .filter(Boolean)
          .slice(0, MAX_REMOTE_POLLED_FILES);
        const changedPaths: string[] = [];
        for (const path of paths) {
          let revision: string | null = null;
          try {
            revision = (await this.resolveRemoteEntry(state, path)).revision;
          } catch {
            revision = null;
          }
          if (knownRevisions.has(path) && knownRevisions.get(path) !== revision) {
            changedPaths.push(path);
          }
          knownRevisions.set(path, revision);
        }
        if (changedPaths.length > 0 && !closed) {
          listener({ kind: 'modify', paths: changedPaths });
        }
      })().catch(() => undefined).finally(() => {
        polling = false;
      });
    }, this.remotePollIntervalMs);
    return () => {
      closed = true;
      clearInterval(timer);
    };
  }

  async getProjectMountState(projectId: string): Promise<ProjectDeviceMountState> {
    const normalizedProjectId = normalizeProjectId(projectId);
    const state = await this.resolveRemoteProject(normalizedProjectId);
    if (state) {
      await this.collectDirectoryChildrenBounded(state, state.binding.logicalPath);
      return {
        displayName: state.context.virtualRootName,
        host: 'server',
        status: 'mounted',
      };
    }
    return { displayName: null, host: null, status: 'mount_required' };
  }

  async restoreProjectMount(projectId: string): Promise<ProjectDeviceMountRecoveryResult> {
    const state = await this.resolveRemoteProject(projectId);
    if (state) {
      await this.getFiles(projectId);
      return {
        restored: true,
        state: {
          displayName: state.context.virtualRootName,
          host: 'server',
          status: 'mounted',
        },
      };
    }
    return {
      restored: false,
      state: { displayName: null, host: null, status: 'mount_required' },
    };
  }

  resolveLocalWorkingDirectory(projectId: string, mountedPath?: string): Promise<string | null> {
    return Promise.resolve(null);
  }

  revealProjectInFileManager(projectId: string, mountedPath?: string): Promise<boolean> {
    return Promise.resolve(false);
  }

  async mountFolder(projectId: string, folderInfo: LocalFolderMountSource): Promise<void> {
    throw new Error('Local folders are unavailable while BirdCoder uses a remote Drive workspace.');
  }
}
