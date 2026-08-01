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
const MAX_DIRECTORY_ENTRIES = DIRECTORY_PAGE_SIZE * MAX_DIRECTORY_PAGES;
const MAX_SEARCH_TREE_NODES = 20_000;
const MAX_SEARCH_SNAPSHOT_ATTEMPTS = 2;
const REMOTE_POLL_INTERVAL_MS = 2_000;
const MAX_REMOTE_POLLED_FILES = 16;
const MAX_REVISION_DIRECTORY_CONCURRENCY = 4;

interface DriveSandboxProjectFileSystemServiceOptions {
  readonly drivePort: SandboxExplorerPort;
  readonly projectService: Pick<IProjectService, 'getProjectDrive'>;
  readonly remotePollIntervalMs?: number;
}

interface RemoteProjectState {
  activeMutationCount: number;
  readonly binding: ProjectDriveComposition;
  readonly context: DriveSandboxProjectPathContext;
  readonly directChildPathsByDirectoryPath: Map<string, Set<string>>;
  readonly directoryRequestGenerations: Map<string, symbol>;
  readonly entriesByVirtualPath: Map<string, SandboxEntry>;
  mutationGeneration: number;
  mutationSettledPromise: Promise<void>;
  resolveMutationSettled: (() => void) | null;
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

async function waitForPromiseWithAbort(
  promise: Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  if (!signal) {
    await promise;
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const handleAbort = () => {
      try {
        signal.throwIfAborted();
      } catch (error) {
        reject(error);
      }
    };
    signal.addEventListener('abort', handleAbort, { once: true });
    void promise.then(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, (error: unknown) => {
      signal.removeEventListener('abort', handleAbort);
      reject(error);
    });
  });
}

function selectRemoteTrackedFilePollPaths(
  trackedFilePaths: readonly string[],
  cursor: number,
): { readonly nextCursor: number; readonly paths: readonly string[] } {
  if (trackedFilePaths.length <= MAX_REMOTE_POLLED_FILES) {
    return { nextCursor: 0, paths: trackedFilePaths };
  }
  const primaryPath = trackedFilePaths[0]!;
  const secondaryPaths = trackedFilePaths.slice(1);
  const secondaryBatchSize = MAX_REMOTE_POLLED_FILES - 1;
  const normalizedCursor = (
    (Math.trunc(cursor) % secondaryPaths.length) + secondaryPaths.length
  ) % secondaryPaths.length;
  const paths = [primaryPath];
  for (let index = 0; index < secondaryBatchSize; index += 1) {
    paths.push(secondaryPaths[(normalizedCursor + index) % secondaryPaths.length]!);
  }
  return {
    nextCursor: (normalizedCursor + secondaryBatchSize) % secondaryPaths.length,
    paths,
  };
}

function assertRemoteEntryIdentity(
  entry: SandboxEntry,
  expected: {
    readonly sandboxId: string;
    readonly logicalPath: string;
    readonly kind: SandboxEntry['kind'];
    readonly id?: string;
  },
): void {
  const separatorIndex = expected.logicalPath.lastIndexOf('/');
  const expectedName = separatorIndex < 0
    ? expected.logicalPath
    : expected.logicalPath.slice(separatorIndex + 1);
  if (
    entry.sandboxId !== expected.sandboxId
    || entry.logicalPath !== expected.logicalPath
    || entry.name !== expectedName
    || entry.kind !== expected.kind
    || (expected.id !== undefined && entry.id !== expected.id)
  ) {
    throw new Error('Drive returned an inconsistent entry identity.');
  }
}

function cacheRemoteEntry(
  state: RemoteProjectState,
  entry: SandboxEntry,
): string {
  const path = toVirtualProjectPath(state.context, entry.logicalPath);
  state.entriesByVirtualPath.set(path, entry);
  const separatorIndex = path.lastIndexOf('/');
  const parentPath = path.slice(0, separatorIndex);
  const directChildPaths = state.directChildPathsByDirectoryPath.get(parentPath)
    ?? new Set<string>();
  directChildPaths.add(path);
  state.directChildPathsByDirectoryPath.set(parentPath, directChildPaths);
  return path;
}

function validateDirectoryEntry(
  state: RemoteProjectState,
  requestedLogicalPath: string,
  entry: SandboxEntry,
): string {
  if (entry.sandboxId !== state.binding.driveId) {
    throw new Error('Drive returned an entry from an unexpected sandbox.');
  }
  const virtualPath = toVirtualProjectPath(state.context, entry.logicalPath);
  const separatorIndex = entry.logicalPath.lastIndexOf('/');
  const entryParentPath = separatorIndex < 0
    ? ''
    : entry.logicalPath.slice(0, separatorIndex);
  const expectedName = separatorIndex < 0
    ? entry.logicalPath
    : entry.logicalPath.slice(separatorIndex + 1);
  if (entryParentPath !== requestedLogicalPath || entry.name !== expectedName) {
    throw new Error('Drive returned an entry outside the requested directory.');
  }
  return virtualPath;
}

function entryToFileNode(
  state: RemoteProjectState,
  entry: SandboxEntry,
): IFileNode {
  const path = cacheRemoteEntry(state, entry);
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
      activeMutationCount: 0,
      binding,
      context: createDriveSandboxProjectPathContext(binding.logicalPath),
      directChildPathsByDirectoryPath: new Map(),
      directoryRequestGenerations: new Map(),
      entriesByVirtualPath: new Map(),
      mutationGeneration: 0,
      mutationSettledPromise: Promise.resolve(),
      resolveMutationSettled: null,
      tree: [],
    };
    this.projectStates.set(normalizedProjectId, state);
    return state;
  }

  private async collectDirectoryChildrenBounded(
    state: RemoteProjectState,
    logicalPath: string,
  ): Promise<readonly SandboxEntry[]> {
    const entriesByVirtualPath = new Map<string, SandboxEntry>();
    const virtualPathByEntryId = new Map<string, string>();
    const seenCursors = new Set<string>();
    let receivedEntryCount = 0;
    let cursor: string | undefined;
    for (let page = 1; page <= MAX_DIRECTORY_PAGES; page += 1) {
      const result = await this.drivePort.listChildren({
        sandboxId: state.binding.driveId,
        parentPath: logicalPath,
        pageSize: DIRECTORY_PAGE_SIZE,
        ...(cursor ? { cursor } : {}),
      });
      if (result.items.length > MAX_DIRECTORY_ENTRIES - receivedEntryCount) {
        throw new Error('Server directory exceeds the supported bounded entry limit.');
      }
      receivedEntryCount += result.items.length;
      for (const entry of result.items) {
        const virtualPath = validateDirectoryEntry(state, logicalPath, entry);

        const existingEntry = entriesByVirtualPath.get(virtualPath);
        if (existingEntry) {
          if (
            existingEntry.id !== entry.id
            || existingEntry.kind !== entry.kind
            || existingEntry.name !== entry.name
          ) {
            throw new Error('Drive returned inconsistent directory entry identity.');
          }
          continue;
        }
        const existingPath = virtualPathByEntryId.get(entry.id);
        if (existingPath && existingPath !== virtualPath) {
          throw new Error('Drive returned inconsistent directory entry identity.');
        }
        entriesByVirtualPath.set(virtualPath, entry);
        virtualPathByEntryId.set(entry.id, virtualPath);
      }
      cursor = result.nextCursor;
      if (!cursor) return [...entriesByVirtualPath.values()];
      if (seenCursors.has(cursor)) {
        throw new Error('Drive returned an invalid directory pagination cursor.');
      }
      seenCursors.add(cursor);
    }
    throw new Error('Server directory exceeds the supported bounded page traversal limit.');
  }

  private async probeRemoteDirectory(
    state: RemoteProjectState,
    logicalPath: string,
  ): Promise<void> {
    try {
      const result = await this.drivePort.listChildren({
        sandboxId: state.binding.driveId,
        parentPath: logicalPath,
        pageSize: DIRECTORY_PAGE_SIZE,
      });
      if (result.items.length > DIRECTORY_PAGE_SIZE) {
        throw new Error('Drive returned an oversized directory access probe.');
      }
      for (const entry of result.items) {
        validateDirectoryEntry(state, logicalPath, entry);
      }
    } catch {
      throw new Error('Unable to verify access to the project Drive root.');
    }
  }

  private async loadRemoteDirectory(
    state: RemoteProjectState,
    virtualPath: string,
    requestGeneration: symbol,
  ): Promise<IFileNode | null> {
    const logicalPath = toSandboxLogicalPath(state.context, virtualPath);
    const entries = await this.collectDirectoryChildrenBounded(state, logicalPath);
    if (state.directoryRequestGenerations.get(virtualPath) !== requestGeneration) {
      return null;
    }
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
    const previousChildPaths = [
      ...(state.directChildPathsByDirectoryPath.get(virtualPath) ?? []),
    ];
    for (const previousChildPath of previousChildPaths) {
      const currentEntry = currentChildrenByPath.get(previousChildPath);
      const cachedDirectEntry = state.entriesByVirtualPath.get(previousChildPath);
      if (
        !currentEntry
        || !cachedDirectEntry
        || cachedDirectEntry.id !== currentEntry.id
        || (
          currentEntry.kind === 'file'
          && state.directChildPathsByDirectoryPath.has(previousChildPath)
        )
      ) {
        this.removeCachedEntryTree(state, previousChildPath);
      }
    }
    const children = entries.map((entry) => entryToFileNode(state, entry));
    state.directChildPathsByDirectoryPath.set(
      virtualPath,
      new Set(children.map((child) => child.path)),
    );
    return {
      name: virtualPath === state.context.virtualRootPath
        ? state.context.virtualRootName
        : virtualPath.split('/').at(-1) ?? state.context.virtualRootName,
      path: virtualPath,
      type: 'directory',
      children: children.sort(compareFileNodes),
    };
  }

  private async collectDirectoryChildrenConsistent(
    state: RemoteProjectState,
    logicalPath: string,
  ): Promise<readonly SandboxEntry[]> {
    const virtualPath = logicalPath === state.binding.logicalPath
      ? state.context.virtualRootPath
      : toVirtualProjectPath(state.context, logicalPath);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const requestGeneration = state.directoryRequestGenerations.get(virtualPath);
      const entries = await this.collectDirectoryChildrenBounded(state, logicalPath);
      if (state.directoryRequestGenerations.get(virtualPath) === requestGeneration) {
        return entries;
      }
    }
    throw new Error('Project Drive directory changed while the request was in progress.');
  }

  private async refreshRemoteDirectoryState(
    state: RemoteProjectState,
    virtualPath: string,
  ): Promise<IFileNode[]> {
    const requestGeneration = this.advanceDirectoryRequestGeneration(state, virtualPath);
    const directory = await this.loadRemoteDirectory(
      state,
      virtualPath,
      requestGeneration,
    );
    if (!directory) return state.tree;
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

  private advanceDirectoryRequestGeneration(
    state: RemoteProjectState,
    virtualPath: string,
  ): symbol {
    const nextGeneration = Symbol(virtualPath);
    state.directoryRequestGenerations.set(virtualPath, nextGeneration);
    return nextGeneration;
  }

  private beginRemoteMutation(state: RemoteProjectState): () => void {
    if (state.activeMutationCount === 0) {
      state.mutationSettledPromise = new Promise<void>((resolve) => {
        state.resolveMutationSettled = resolve;
      });
    }
    state.activeMutationCount += 1;
    state.mutationGeneration += 1;
    let settled = false;
    return () => {
      if (settled) return;
      settled = true;
      state.activeMutationCount -= 1;
      state.mutationGeneration += 1;
      if (state.activeMutationCount === 0) {
        const resolve = state.resolveMutationSettled;
        state.resolveMutationSettled = null;
        resolve?.();
      }
    };
  }

  private async waitForRemoteMutations(
    state: RemoteProjectState,
    signal?: AbortSignal,
  ): Promise<void> {
    while (state.activeMutationCount > 0) {
      await waitForPromiseWithAbort(state.mutationSettledPromise, signal);
    }
  }

  private async runRemoteMutation<T>(
    state: RemoteProjectState,
    mutation: () => Promise<T>,
  ): Promise<T> {
    const endMutation = this.beginRemoteMutation(state);
    try {
      return await mutation();
    } finally {
      endMutation();
    }
  }

  private invalidateDirectoryRequestTree(
    state: RemoteProjectState,
    virtualPath: string,
  ): void {
    const descendantPrefix = `${virtualPath}/`;
    for (const requestPath of [...state.directoryRequestGenerations.keys()]) {
      if (requestPath === virtualPath || requestPath.startsWith(descendantPrefix)) {
        state.directoryRequestGenerations.delete(requestPath);
      }
    }
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
    this.invalidateDirectoryRequestTree(state, virtualPath);
    const separatorIndex = virtualPath.lastIndexOf('/');
    const parentPath = virtualPath.slice(0, separatorIndex);
    state.directChildPathsByDirectoryPath.get(parentPath)?.delete(virtualPath);

    const pendingPaths = [virtualPath];
    const visitedPaths = new Set<string>();
    while (pendingPaths.length > 0) {
      const currentPath = pendingPaths.pop()!;
      if (visitedPaths.has(currentPath)) continue;
      visitedPaths.add(currentPath);
      const childPaths = state.directChildPathsByDirectoryPath.get(currentPath);
      if (childPaths) {
        pendingPaths.push(...childPaths);
      }
      state.directChildPathsByDirectoryPath.delete(currentPath);
      state.entriesByVirtualPath.delete(currentPath);
    }
  }

  private relocateCachedEntryTree(
    state: RemoteProjectState,
    oldPath: string,
    newPath: string,
    movedEntry: SandboxEntry,
  ): void {
    this.invalidateDirectoryRequestTree(state, oldPath);
    this.invalidateDirectoryRequestTree(state, newPath);
    const pendingPaths = [oldPath];
    const visitedPaths = new Set<string>();
    const cachedEntries: Array<readonly [string, SandboxEntry]> = [];
    const loadedDirectoryChildren: Array<readonly [string, readonly string[]]> = [];
    while (pendingPaths.length > 0) {
      const currentPath = pendingPaths.pop()!;
      if (visitedPaths.has(currentPath)) continue;
      visitedPaths.add(currentPath);
      const cachedEntry = state.entriesByVirtualPath.get(currentPath);
      if (cachedEntry) cachedEntries.push([currentPath, cachedEntry]);
      const childPaths = state.directChildPathsByDirectoryPath.get(currentPath);
      if (childPaths) {
        const children = [...childPaths];
        loadedDirectoryChildren.push([currentPath, children]);
        pendingPaths.push(...children);
      }
    }

    this.removeCachedEntryTree(state, newPath);
    this.removeCachedEntryTree(state, oldPath);
    for (const [cachedPath, cachedEntry] of cachedEntries) {
      const relocatedPath = cachedPath === oldPath
        ? newPath
        : `${newPath}${cachedPath.slice(oldPath.length)}`;
      cacheRemoteEntry(
        state,
        cachedPath === oldPath
          ? movedEntry
          : {
              ...cachedEntry,
              logicalPath: toSandboxLogicalPath(state.context, relocatedPath),
            },
      );
    }
    for (const [directoryPath, childPaths] of loadedDirectoryChildren) {
      const relocatedDirectoryPath = directoryPath === oldPath
        ? newPath
        : `${newPath}${directoryPath.slice(oldPath.length)}`;
      state.directChildPathsByDirectoryPath.set(
        relocatedDirectoryPath,
        new Set(childPaths.map((childPath) => `${newPath}${childPath.slice(oldPath.length)}`)),
      );
    }
    if (!state.entriesByVirtualPath.has(newPath)) {
      cacheRemoteEntry(state, movedEntry);
    }
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
    const entries = await this.collectDirectoryChildrenConsistent(state, parentPath);
    const entry = entries.find((candidate) => candidate.logicalPath === logicalPath);
    if (!entry) throw new Error('The requested project Drive entry no longer exists.');
    cacheRemoteEntry(state, entry);
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
        assertRemoteEntryIdentity(result.entry, {
          sandboxId: state.binding.driveId,
          logicalPath: entry.logicalPath,
          kind: 'file',
          id: entry.id,
        });
        const entryPath = toVirtualProjectPath(state.context, entry.logicalPath);
        if (state.entriesByVirtualPath.get(entryPath)?.id === entry.id) {
          cacheRemoteEntry(state, result.entry);
        }
        return result.content;
      },
    );
  }

  resolveProjectImagePreviewUrl(
    _projectId: string,
    _path: string,
  ): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }

  async getFileRevision(projectId: string, path: string): Promise<string> {
    return this.requireRemote(
      projectId,
      async (state) => (await this.resolveRemoteEntry(state, path)).revision,
    );
  }

  private async resolveRemoteFileRevisions(
    state: RemoteProjectState,
    paths: readonly string[],
  ): Promise<ReadonlyArray<FileRevisionLookupResult>> {
    const results = new Array<FileRevisionLookupResult | undefined>(paths.length);
    const requestsByParentPath = new Map<
      string,
      Array<{ readonly index: number; readonly logicalPath: string; readonly path: string }>
    >();
    paths.forEach((path, index) => {
      try {
        const logicalPath = toSandboxLogicalPath(state.context, path);
        if (logicalPath === state.binding.logicalPath) {
          throw new Error('The project root is not a file entry.');
        }
        const separatorIndex = logicalPath.lastIndexOf('/');
        const parentPath = separatorIndex < 0 ? '' : logicalPath.slice(0, separatorIndex);
        const requests = requestsByParentPath.get(parentPath) ?? [];
        requests.push({ index, logicalPath, path });
        requestsByParentPath.set(parentPath, requests);
      } catch {
        results[index] = {
          path,
          revision: null,
          missing: false,
          error: 'Unable to query the project Drive file revision.',
        };
      }
    });

    const directoryRequests = [...requestsByParentPath.entries()];
    let nextDirectoryIndex = 0;
    const workerCount = Math.min(
      MAX_REVISION_DIRECTORY_CONCURRENCY,
      directoryRequests.length,
    );
    await Promise.all(Array.from({ length: workerCount }, async () => {
      while (nextDirectoryIndex < directoryRequests.length) {
        const requestIndex = nextDirectoryIndex;
        nextDirectoryIndex += 1;
        const [parentPath, requests] = directoryRequests[requestIndex]!;
        try {
          const entries = await this.collectDirectoryChildrenConsistent(state, parentPath);
          const entriesByLogicalPath = new Map(
            entries.map((entry) => [entry.logicalPath, entry]),
          );
          for (const request of requests) {
            const entry = entriesByLogicalPath.get(request.logicalPath);
            if (entry) cacheRemoteEntry(state, entry);
            results[request.index] = {
              path: request.path,
              revision: entry?.revision ?? null,
              missing: entry === undefined,
            };
          }
        } catch {
          for (const request of requests) {
            results[request.index] = {
              path: request.path,
              revision: null,
              missing: false,
              error: 'Unable to query the project Drive file revision.',
            };
          }
        }
      }
    }));
    return results.map((result, index) => result ?? {
      path: paths[index]!,
      revision: null,
      missing: false,
      error: 'Unable to query the project Drive file revision.',
    });
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
    return this.resolveRemoteFileRevisions(state, paths);
  }

  async saveFileContent(projectId: string, path: string, content: string): Promise<void> {
    await this.requireRemote(
      projectId,
      (state) => this.runRemoteMutation(state, async () => {
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
        assertRemoteEntryIdentity(updated, {
          sandboxId: state.binding.driveId,
          logicalPath: entry.logicalPath,
          kind: 'file',
          id: entry.id,
        });
        const entryPath = toVirtualProjectPath(state.context, entry.logicalPath);
        if (state.entriesByVirtualPath.get(entryPath)?.id === entry.id) {
          cacheRemoteEntry(state, updated);
        }
      }),
    );
  }

  async createFile(projectId: string, path: string): Promise<void> {
    await this.requireRemote(
      projectId,
      (state) => this.runRemoteMutation(state, async () => {
        const target = splitVirtualMutationPath(state.context, path);
        this.advanceDirectoryRequestGeneration(state, target.virtualParentPath);
        const entry = await this.drivePort.createFile({
          sandboxId: state.binding.driveId,
          parentPath: target.logicalParentPath,
          name: target.name,
          content: '',
          encoding: 'utf8',
        });
        this.advanceDirectoryRequestGeneration(state, target.virtualParentPath);
        assertRemoteEntryIdentity(entry, {
          sandboxId: state.binding.driveId,
          logicalPath: target.logicalParentPath
            ? `${target.logicalParentPath}/${target.name}`
            : target.name,
          kind: 'file',
        });
        const node = entryToFileNode(state, entry);
        state.tree = upsertNodeInDirectory(state.tree, target.virtualParentPath, node);
      }),
    );
  }

  async createFolder(projectId: string, path: string): Promise<void> {
    await this.requireRemote(
      projectId,
      (state) => this.runRemoteMutation(state, async () => {
        const target = splitVirtualMutationPath(state.context, path);
        this.advanceDirectoryRequestGeneration(state, target.virtualParentPath);
        const entry = await this.drivePort.createDirectory({
          sandboxId: state.binding.driveId,
          parentPath: target.logicalParentPath,
          name: target.name,
        });
        this.advanceDirectoryRequestGeneration(state, target.virtualParentPath);
        assertRemoteEntryIdentity(entry, {
          sandboxId: state.binding.driveId,
          logicalPath: target.logicalParentPath
            ? `${target.logicalParentPath}/${target.name}`
            : target.name,
          kind: 'directory',
        });
        const node = entryToFileNode(state, entry);
        state.tree = upsertNodeInDirectory(state.tree, target.virtualParentPath, node);
      }),
    );
  }

  private async deleteRemoteEntry(
    state: RemoteProjectState,
    path: string,
    recursive: boolean,
    expectedKind: SandboxEntry['kind'],
  ): Promise<void> {
    await this.runRemoteMutation(state, async () => {
      const target = splitVirtualMutationPath(state.context, path);
      const canonicalPath = `${target.virtualParentPath}/${target.name}`;
      const entry = await this.resolveKnownRemoteEntry(state, canonicalPath);
      if (entry.kind !== expectedKind) throw new Error(`The requested entry is not a ${expectedKind}.`);
      this.advanceDirectoryRequestGeneration(state, target.virtualParentPath);
      await this.drivePort.deleteEntry({
        sandboxId: state.binding.driveId,
        entryId: entry.id,
        logicalPath: entry.logicalPath,
        revision: entry.revision,
        recursive,
      });
      this.advanceDirectoryRequestGeneration(state, target.virtualParentPath);
      this.removeCachedEntryTree(state, canonicalPath);
      state.tree = removeNodeFromTree(state.tree, canonicalPath);
    });
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
      (state) => this.runRemoteMutation(state, async () => {
        const entry = await this.resolveKnownRemoteEntry(state, oldPath);
        const currentTarget = splitVirtualMutationPath(state.context, oldPath);
        const target = splitVirtualMutationPath(state.context, newPath);
        const canonicalOldPath = `${currentTarget.virtualParentPath}/${currentTarget.name}`;
        const canonicalNewPath = `${target.virtualParentPath}/${target.name}`;
        if (canonicalOldPath === canonicalNewPath) return;
        if (
          entry.kind === 'directory'
          && canonicalNewPath.startsWith(`${canonicalOldPath}/`)
        ) {
          throw new Error('A project directory cannot be moved into itself.');
        }
        this.advanceDirectoryRequestGeneration(state, currentTarget.virtualParentPath);
        if (target.virtualParentPath !== currentTarget.virtualParentPath) {
          this.advanceDirectoryRequestGeneration(state, target.virtualParentPath);
        }
        const moved = await this.drivePort.moveEntry({
          sandboxId: state.binding.driveId,
          entryId: entry.id,
          logicalPath: entry.logicalPath,
          revision: entry.revision,
          destinationParentPath: target.logicalParentPath,
          destinationName: target.name,
        });
        this.advanceDirectoryRequestGeneration(state, currentTarget.virtualParentPath);
        if (target.virtualParentPath !== currentTarget.virtualParentPath) {
          this.advanceDirectoryRequestGeneration(state, target.virtualParentPath);
        }
        assertRemoteEntryIdentity(moved, {
          sandboxId: state.binding.driveId,
          logicalPath: target.logicalParentPath
            ? `${target.logicalParentPath}/${target.name}`
            : target.name,
          kind: entry.kind,
          id: entry.id,
        });
        this.relocateCachedEntryTree(state, canonicalOldPath, canonicalNewPath, moved);
        state.tree = relocateNodeInTree(
          state.tree,
          canonicalOldPath,
          target.virtualParentPath,
          entryToFileNode(state, moved),
        );
      }),
    );
  }

  private async buildRemoteSearchTree(
    state: RemoteProjectState,
    signal?: AbortSignal,
  ): Promise<{
    readonly entriesByVirtualPath: ReadonlyMap<string, SandboxEntry>;
    readonly files: IFileNode[];
    readonly limitReached: boolean;
  }> {
    const root = createRootNode(state, []);
    const entriesByVirtualPath = new Map<string, SandboxEntry>();
    const queue: Array<{ logicalPath: string; node: IFileNode }> = [{
      logicalPath: state.binding.logicalPath,
      node: root,
    }];
    let queueIndex = 0;
    let visited = 1;
    let limitReached = false;
    while (queueIndex < queue.length && !signal?.aborted) {
      const current = queue[queueIndex]!;
      queueIndex += 1;
      const children: IFileNode[] = [];
      const entries = await this.collectDirectoryChildrenBounded(state, current.logicalPath);
      if (signal?.aborted) break;
      for (const entry of entries) {
        if (visited >= MAX_SEARCH_TREE_NODES) {
          limitReached = true;
          break;
        }
        visited += 1;
        const path = toVirtualProjectPath(state.context, entry.logicalPath);
        entriesByVirtualPath.set(path, entry);
        const child: IFileNode = {
          name: entry.name,
          path,
          type: entry.kind,
        };
        children.push(child);
        if (entry.kind === 'directory') queue.push({ logicalPath: entry.logicalPath, node: child });
      }
      current.node.children = children.sort(compareFileNodes);
      if (limitReached) break;
    }
    return { entriesByVirtualPath, files: [root], limitReached };
  }

  async searchFiles(
    projectId: string,
    options: ProjectFileSearchOptions,
  ): Promise<ProjectFileSearchExecutionResult> {
    return this.requireRemote(
      projectId,
      async (state) => {
        for (let attempt = 0; attempt < MAX_SEARCH_SNAPSHOT_ATTEMPTS; attempt += 1) {
          await this.waitForRemoteMutations(state, options.signal);
          const mutationGeneration = state.mutationGeneration;
          try {
            const snapshot = await this.buildRemoteSearchTree(state, options.signal);
            if (
              state.activeMutationCount > 0
              || state.mutationGeneration !== mutationGeneration
            ) {
              continue;
            }
            const result = await searchProjectFiles({
              ...options,
              files: snapshot.files,
              readFileContent: async (path) => {
                const entry = snapshot.entriesByVirtualPath.get(path)
                  ?? await this.resolveRemoteEntry(state, path);
                const content = await this.drivePort.readFile({
                  sandboxId: state.binding.driveId,
                  entryId: entry.id,
                  logicalPath: entry.logicalPath,
                  encoding: 'utf8',
                });
                assertRemoteEntryIdentity(content.entry, {
                  sandboxId: state.binding.driveId,
                  logicalPath: entry.logicalPath,
                  kind: 'file',
                  id: entry.id,
                });
                return content.content;
              },
            });
            if (
              state.activeMutationCount === 0
              && state.mutationGeneration === mutationGeneration
            ) {
              return { ...result, limitReached: result.limitReached || snapshot.limitReached };
            }
          } catch (error) {
            if (
              state.activeMutationCount === 0
              && state.mutationGeneration === mutationGeneration
            ) {
              throw error;
            }
          }
        }
        throw new Error('Project Drive changed while the search was in progress.');
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
    let trackedFilePollCursor = 0;
    const knownRevisions = new Map<string, string | null>();
    const timer = setInterval(() => {
      if (closed || polling) return;
      polling = true;
      void (async () => {
        const state = await this.resolveRemoteProject(normalizedProjectId);
        if (!state) return;
        const allTrackedPaths = [...new Set((options?.getTrackedFilePaths?.() ?? [])
          .map((path) => path.trim())
          .filter(Boolean))];
        const selectedPaths = selectRemoteTrackedFilePollPaths(
          allTrackedPaths,
          trackedFilePollCursor,
        );
        trackedFilePollCursor = selectedPaths.nextCursor;
        const trackedPaths = new Set(allTrackedPaths);
        for (const knownPath of knownRevisions.keys()) {
          if (!trackedPaths.has(knownPath)) knownRevisions.delete(knownPath);
        }
        const changedPaths: string[] = [];
        const revisionLookups = await this.resolveRemoteFileRevisions(
          state,
          selectedPaths.paths,
        );
        for (const lookup of revisionLookups) {
          if (lookup.error) continue;
          const revision = lookup.missing ? null : lookup.revision;
          const path = lookup.path;
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
      await this.probeRemoteDirectory(state, state.binding.logicalPath);
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
      await this.probeRemoteDirectory(state, state.binding.logicalPath);
      if (state.tree.length === 0) {
        await this.refreshRemoteDirectoryState(state, state.context.virtualRootPath);
      }
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
