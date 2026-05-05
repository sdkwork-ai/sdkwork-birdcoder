import {
  DEFAULT_MAX_SEARCHABLE_FILE_CONTENT_CHARACTERS,
  searchProjectFiles,
  type FileRevisionLookupResult,
  type ProjectFileSystemChangeEvent,
  type IFileNode,
  type LocalFolderMountSource,
  type WorkspaceFileSearchExecutionResult,
  type WorkspaceFileSearchOptions,
} from '@sdkwork/birdcoder-types';
import {
  createBirdCoderTauriFileSystemRuntime,
  type BirdCoderTauriDirectoryListing,
  type BirdCoderTauriFileSystemWatchEvent,
  type BirdCoderTauriFileSystemRuntime,
  type BirdCoderTauriPathRevisionLookupResult,
} from '../../platform/tauriFileSystemRuntime.ts';
import type {
  FileSystemChangeSubscriptionOptions,
  IFileSystemService,
} from '../interfaces/IFileSystemService.ts';

interface BrowserWritableLike {
  close(): Promise<void>;
  write(data: string): Promise<void>;
}

interface BrowserFileLike {
  lastModified?: number;
  slice?(start?: number, end?: number): BrowserFileLike;
  size?: number;
  text(): Promise<string>;
}

interface BrowserFileHandleLike {
  createWritable?(): Promise<BrowserWritableLike>;
  getFile(): Promise<BrowserFileLike>;
  kind: 'file';
  name: string;
}

interface BrowserDirectoryHandleLike {
  [Symbol.asyncIterator]?(): AsyncIterableIterator<[string, BrowserHandleLike] | BrowserHandleLike>;
  entries?(): AsyncIterable<[string, BrowserHandleLike]>;
  getDirectoryHandle?(
    name: string,
    options?: { create?: boolean },
  ): Promise<BrowserDirectoryHandleLike>;
  getFileHandle?(
    name: string,
    options?: { create?: boolean },
  ): Promise<BrowserFileHandleLike>;
  kind: 'directory';
  name: string;
  removeEntry?(name: string, options?: { recursive?: boolean }): Promise<void>;
  values?(): AsyncIterable<BrowserHandleLike>;
}

type BrowserHandleLike = BrowserDirectoryHandleLike | BrowserFileHandleLike;

interface BrowserMountState {
  cachedSearchTree?: IFileNode[];
  cachedTree?: IFileNode[];
  directoryHandles: Map<string, BrowserDirectoryHandleLike>;
  fileHandles: Map<string, BrowserFileHandleLike>;
  loadedDirectoryPaths: Set<string>;
  rootHandle: BrowserDirectoryHandleLike;
  rootPath: string;
  tree: IFileNode;
}

interface TauriMountState {
  cachedSearchTree?: IFileNode[];
  cachedTree?: IFileNode[];
  directoryRevisions: Map<string, string>;
  loadedDirectoryPaths: Set<string>;
  rootSystemPath: string;
  rootVirtualPath: string;
  tree: IFileNode;
}

type LoadedDirectoryMountState = {
  loadedDirectoryPaths: Set<string>;
};

type FileSystemChangeListener = (event: ProjectFileSystemChangeEvent) => void;
type ProjectFileTreePoller = {
  directoryPollCursor: number;
  isRunning: boolean;
  timerId: ReturnType<typeof setTimeout> | null;
  trackedFileKnownPaths: Set<string>;
  trackedFilePollCursor: number;
  trackedFileRevisionByPath: Map<string, string | null>;
};
type ProjectTauriFileWatcher = {
  rootSystemPath: string;
  stop: () => void;
};
type ProjectTauriFileWatcherStart = {
  cancelled: boolean;
  rootSystemPath: string;
};
type ProjectTauriWatchQueue = {
  events: ProjectFileSystemChangeEvent[];
  isFlushing: boolean;
  timerId: ReturnType<typeof setTimeout> | null;
};
interface SearchTreeSnapshotContext {
  signal?: AbortSignal;
  visitedNodeCount: number;
}

const FILE_TREE_POLL_INTERVAL_MS = 1500;
const TAURI_WATCH_FLUSH_DELAY_MS = 40;
const DIRECTORY_REFRESH_BATCH_SIZE = 4;
const DIRECTORY_POLL_BATCH_SIZE = 4;
const MAX_LOADED_DIRECTORY_REVISIONS_PER_POLL = 24;
const MAX_TRACKED_FILE_REVISIONS_PER_POLL = 7;
const MIN_RUNTIME_FILE_SEARCH_CONTENT_CHARACTERS = 4_096;
const SEARCH_TREE_SNAPSHOT_YIELD_INTERVAL = 128;

export interface RuntimeFileSystemServiceOptions {
  tauriRuntime?: BirdCoderTauriFileSystemRuntime;
}

function buildChildPath(parentPath: string, name: string): string {
  return parentPath === '/' ? `/${name}` : `${parentPath}/${name}`;
}

function getParentPath(path: string): string {
  const normalizedPath = path.trim();
  if (!normalizedPath || normalizedPath === '/') {
    return '/';
  }

  const separatorIndex = normalizedPath.lastIndexOf('/');
  if (separatorIndex <= 0) {
    return '/';
  }

  return normalizedPath.slice(0, separatorIndex);
}

function isBrowserDirectoryHandle(value: BrowserHandleLike): value is BrowserDirectoryHandleLike {
  return value.kind === 'directory';
}

function normalizeRuntimeFileSearchContentBudget(maxFileContentCharacters?: number): number {
  if (
    typeof maxFileContentCharacters !== 'number' ||
    !Number.isFinite(maxFileContentCharacters) ||
    maxFileContentCharacters <= 0
  ) {
    return DEFAULT_MAX_SEARCHABLE_FILE_CONTENT_CHARACTERS;
  }

  return Math.max(MIN_RUNTIME_FILE_SEARCH_CONTENT_CHARACTERS, Math.floor(maxFileContentCharacters));
}

function createEmptyRuntimeFileSearchResult(): WorkspaceFileSearchExecutionResult {
  return {
    limitReached: false,
    results: [],
  };
}

function createSearchTreeSnapshotAbortError(): Error {
  const error = new Error('Search tree snapshot aborted.');
  error.name = 'AbortError';
  return error;
}

function isSearchTreeSnapshotAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function throwIfSearchTreeSnapshotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createSearchTreeSnapshotAbortError();
  }
}

async function yieldSearchTreeSnapshot(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function trackSearchTreeSnapshotEntry(
  context: SearchTreeSnapshotContext,
): Promise<void> {
  throwIfSearchTreeSnapshotAborted(context.signal);
  context.visitedNodeCount += 1;
  if (context.visitedNodeCount < SEARCH_TREE_SNAPSHOT_YIELD_INTERVAL) {
    return;
  }

  context.visitedNodeCount = 0;
  await yieldSearchTreeSnapshot();
  throwIfSearchTreeSnapshotAborted(context.signal);
}

async function* listBrowserDirectoryEntries(
  handle: BrowserDirectoryHandleLike,
): AsyncIterable<BrowserHandleLike> {
  if (typeof handle.values === 'function') {
    yield* handle.values();
    return;
  }

  if (typeof handle.entries === 'function') {
    for await (const [, entry] of handle.entries()) {
      yield entry;
    }
    return;
  }

  const asyncIteratorFactory = handle[Symbol.asyncIterator];
  if (typeof asyncIteratorFactory === 'function') {
    for await (const entry of asyncIteratorFactory.call(handle)) {
      if (Array.isArray(entry)) {
        yield entry[1];
      } else {
        yield entry;
      }
    }
    return;
  }

  throw new Error(`Directory handle ${handle.name} does not expose async directory enumeration.`);
}

function sortFileNodes(nodes: IFileNode[]): IFileNode[] {
  return nodes.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'directory' ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

function isPathWithinRoot(rootPath: string, path: string, includeRoot = true): boolean {
  if (path === rootPath) {
    return includeRoot;
  }

  return path.startsWith(`${rootPath}/`);
}

function normalizeComparableLocalFolderPath(path: string): string {
  const trimmedPath = path.trim();
  if (!trimmedPath) {
    return '';
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

function buildBrowserFileRevision(file: BrowserFileLike): string {
  return `${file.lastModified ?? 0}:${file.size ?? 0}`;
}

function deleteStoredPathContent(
  contentMap: Record<string, string> | undefined,
  path: string,
  recursive: boolean,
): void {
  if (!contentMap) {
    return;
  }

  delete contentMap[path];
  if (!recursive) {
    return;
  }

  const prefix = `${path}/`;
  Object.keys(contentMap).forEach((key) => {
    if (key.startsWith(prefix)) {
      delete contentMap[key];
    }
  });
}

function renameStoredPathContent(
  contentMap: Record<string, string> | undefined,
  oldPath: string,
  newPath: string,
): void {
  if (!contentMap) {
    return;
  }

  if (contentMap[oldPath] !== undefined) {
    contentMap[newPath] = contentMap[oldPath];
    delete contentMap[oldPath];
    return;
  }

  const oldPrefix = `${oldPath}/`;
  const newPrefix = `${newPath}/`;
  Object.keys(contentMap).forEach((key) => {
    if (key.startsWith(oldPrefix)) {
      const nextKey = key.replace(oldPrefix, newPrefix);
      contentMap[nextKey] = contentMap[key];
      delete contentMap[key];
    }
  });
}

function createReadonlyMountedTree(tree: IFileNode): IFileNode[] {
  // Mounted trees are replaced wholesale on refresh, so avoid deep cloning and
  // freezing the entire directory graph on every project switch.
  return Object.freeze([tree]) as IFileNode[];
}

function cloneDirectoryEntry(node: IFileNode): IFileNode {
  if (node.type === 'file') {
    return {
      name: node.name,
      type: node.type,
      path: node.path,
    };
  }

  return {
    name: node.name,
    type: node.type,
    path: node.path,
  };
}

function cloneDirectoryChildren(children: readonly IFileNode[]): IFileNode[] {
  return sortFileNodes(children.map((child) => cloneDirectoryEntry(child)));
}

function mergeDirectoryChildren(
  currentNode: IFileNode,
  nextChildren: readonly IFileNode[],
): IFileNode[] {
  const currentChildrenByPath = new Map(
    (currentNode.children ?? []).map((child) => [child.path, child]),
  );

  return sortFileNodes(
    nextChildren.map((nextChild) => {
      const currentChild = currentChildrenByPath.get(nextChild.path);
      if (!currentChild || currentChild.type !== nextChild.type) {
        return cloneDirectoryEntry(nextChild);
      }

      if (currentChild.type === 'directory' && currentChild.children !== undefined) {
        return {
          ...cloneDirectoryEntry(nextChild),
          children: currentChild.children,
        };
      }

      return cloneDirectoryEntry(nextChild);
    }),
  );
}

function findNodeByPath(node: IFileNode, targetPath: string): IFileNode | null {
  if (node.path === targetPath) {
    return node;
  }

  if (!node.children?.length) {
    return null;
  }

  for (const child of node.children) {
    const match = findNodeByPath(child, targetPath);
    if (match) {
      return match;
    }
  }

  return null;
}

function areDirectoryChildrenEquivalent(
  currentChildren: readonly IFileNode[] | undefined,
  nextChildren: readonly IFileNode[] | undefined,
): boolean {
  const currentChildList = currentChildren ?? [];
  const nextChildList = nextChildren ?? [];
  if (currentChildList === nextChildList) {
    return true;
  }

  if (currentChildList.length !== nextChildList.length) {
    return false;
  }

  for (let index = 0; index < currentChildList.length; index += 1) {
    const currentChild = currentChildList[index]!;
    const nextChild = nextChildList[index]!;
    if (
      currentChild.type !== nextChild.type ||
      currentChild.path !== nextChild.path ||
      currentChild.name !== nextChild.name
    ) {
      return false;
    }
  }

  return true;
}

function replaceDirectoryChildren(
  node: IFileNode,
  targetPath: string,
  nextChildren: readonly IFileNode[],
): IFileNode {
  if (node.path === targetPath) {
    return {
      ...node,
      children: mergeDirectoryChildren(node, nextChildren),
    };
  }

  if (!node.children?.length) {
    return node;
  }

  let didChange = false;
  const children = node.children.map((child) => {
    const nextChild = replaceDirectoryChildren(child, targetPath, nextChildren);
    if (nextChild !== child) {
      didChange = true;
    }
    return nextChild;
  });

  if (!didChange) {
    return node;
  }

  return {
    ...node,
    children,
  };
}

function selectLoadedDirectoryPollPaths(
  loadedDirectoryPaths: readonly string[],
  maxPathsPerCycle: number,
  cursor: number,
): {
  nextCursor: number;
  paths: string[];
} {
  if (loadedDirectoryPaths.length === 0) {
    return {
      nextCursor: 0,
      paths: [],
    };
  }

  const normalizedMaxPathsPerCycle =
    Number.isFinite(maxPathsPerCycle) && maxPathsPerCycle > 0
      ? Math.floor(maxPathsPerCycle)
      : loadedDirectoryPaths.length;

  if (loadedDirectoryPaths.length <= normalizedMaxPathsPerCycle) {
    return {
      nextCursor: 0,
      paths: [...loadedDirectoryPaths],
    };
  }

  const rootPath = loadedDirectoryPaths[0]!;
  const descendantPaths = loadedDirectoryPaths.slice(1);
  const descendantBatchSize = Math.max(0, normalizedMaxPathsPerCycle - 1);
  if (descendantPaths.length === 0 || descendantBatchSize === 0) {
    return {
      nextCursor: 0,
      paths: [rootPath],
    };
  }

  const normalizedCursor =
    ((Math.trunc(cursor) % descendantPaths.length) + descendantPaths.length) %
    descendantPaths.length;
  const rotatedPaths = [];
  const rotatedCount = Math.min(descendantBatchSize, descendantPaths.length);
  for (let index = 0; index < rotatedCount; index += 1) {
    rotatedPaths.push(descendantPaths[(normalizedCursor + index) % descendantPaths.length]!);
  }

  return {
    nextCursor: (normalizedCursor + rotatedCount) % descendantPaths.length,
    paths: [rootPath, ...rotatedPaths],
  };
}

function selectTrackedFilePollPaths(
  trackedFilePaths: readonly string[],
  maxPathsPerCycle: number,
  cursor: number,
): {
  nextCursor: number;
  paths: string[];
} {
  if (trackedFilePaths.length === 0) {
    return {
      nextCursor: 0,
      paths: [],
    };
  }

  const normalizedMaxPathsPerCycle =
    Number.isFinite(maxPathsPerCycle) && maxPathsPerCycle > 0
      ? Math.floor(maxPathsPerCycle)
      : trackedFilePaths.length;

  if (trackedFilePaths.length <= normalizedMaxPathsPerCycle) {
    return {
      nextCursor: 0,
      paths: [...trackedFilePaths],
    };
  }

  const primaryTrackedFilePath = trackedFilePaths[0]!;
  const secondaryTrackedFilePaths = trackedFilePaths.slice(1);
  const secondaryBatchSize = Math.max(0, normalizedMaxPathsPerCycle - 1);
  if (secondaryTrackedFilePaths.length === 0 || secondaryBatchSize === 0) {
    return {
      nextCursor: 0,
      paths: [primaryTrackedFilePath],
    };
  }

  const normalizedCursor =
    ((Math.trunc(cursor) % secondaryTrackedFilePaths.length) + secondaryTrackedFilePaths.length) %
    secondaryTrackedFilePaths.length;
  const rotatedPaths: string[] = [];
  const rotatedCount = Math.min(secondaryBatchSize, secondaryTrackedFilePaths.length);
  for (let index = 0; index < rotatedCount; index += 1) {
    rotatedPaths.push(
      secondaryTrackedFilePaths[
        (normalizedCursor + index) % secondaryTrackedFilePaths.length
      ]!,
    );
  }

  return {
    nextCursor: (normalizedCursor + rotatedCount) % secondaryTrackedFilePaths.length,
    paths: [primaryTrackedFilePath, ...rotatedPaths],
  };
}

function markLoadedDirectoryPath(
  mountState: LoadedDirectoryMountState,
  directoryPath: string,
): void {
  const normalizedPath = directoryPath.trim();
  if (!normalizedPath) {
    return;
  }

  mountState.loadedDirectoryPaths.add(normalizedPath);
}

function removeLoadedDirectoryPath(
  mountState: LoadedDirectoryMountState,
  path: string,
  recursive: boolean,
): void {
  const normalizedPath = path.trim();
  if (!normalizedPath) {
    return;
  }

  mountState.loadedDirectoryPaths.delete(normalizedPath);
  if (!recursive) {
    return;
  }

  const descendantPrefix = `${normalizedPath}/`;
  for (const candidatePath of [...mountState.loadedDirectoryPaths]) {
    if (candidatePath.startsWith(descendantPrefix)) {
      mountState.loadedDirectoryPaths.delete(candidatePath);
    }
  }
}

function pruneRemovedLoadedDirectoryPaths(
  mountState: LoadedDirectoryMountState & { tree: IFileNode },
  directoryPath: string,
  nextChildren: readonly IFileNode[],
): void {
  const currentNode = findNodeByPath(mountState.tree, directoryPath);
  if (!currentNode?.children?.length) {
    return;
  }

  const nextChildrenByPath = new Map(
    nextChildren.map((child) => [child.path, child.type] as const),
  );
  currentNode.children.forEach((currentChild) => {
    const nextChildType = nextChildrenByPath.get(currentChild.path);
    if (nextChildType === currentChild.type) {
      return;
    }

    removeLoadedDirectoryPath(
      mountState,
      currentChild.path,
      currentChild.type === 'directory',
    );
  });
}

function resolveSuccessfulPathRevisionMap(
  lookups: readonly BirdCoderTauriPathRevisionLookupResult[],
): Map<string, string> {
  const revisionByPath = new Map<string, string>();
  lookups.forEach((lookup) => {
    if (!lookup.missing && !lookup.error && lookup.revision !== null) {
      revisionByPath.set(lookup.path, lookup.revision);
    }
  });
  return revisionByPath;
}

function pruneTauriDirectoryRevisionMap(mountState: TauriMountState): void {
  mountState.directoryRevisions.forEach((_, path) => {
    if (!mountState.loadedDirectoryPaths.has(path)) {
      mountState.directoryRevisions.delete(path);
    }
  });
}

function updateTauriDirectoryRevision(
  mountState: TauriMountState,
  directoryPath: string,
  directoryRevision?: BirdCoderTauriPathRevisionLookupResult,
): void {
  if (
    directoryRevision &&
    !directoryRevision.missing &&
    !directoryRevision.error &&
    directoryRevision.revision !== null
  ) {
    mountState.directoryRevisions.set(directoryPath, directoryRevision.revision);
    return;
  }

  mountState.directoryRevisions.delete(directoryPath);
}

async function runBatchedTasks<TItem, TResult>(
  items: readonly TItem[],
  batchSize: number,
  worker: (item: TItem) => Promise<TResult>,
): Promise<PromiseSettledResult<TResult>[]> {
  const normalizedBatchSize = Math.max(1, batchSize);
  const settledResults: PromiseSettledResult<TResult>[] = [];

  for (let index = 0; index < items.length; index += normalizedBatchSize) {
    const batchItems = items.slice(index, index + normalizedBatchSize);
    settledResults.push(...(await Promise.allSettled(batchItems.map((item) => worker(item)))));
  }

  return settledResults;
}

function normalizeDirectoryRefreshPaths(
  paths: readonly string[],
  rootPath: string,
): string[] {
  if (paths.length === 0) {
    return [rootPath];
  }

  const normalizedPaths = new Set<string>();
  paths.forEach((path) => {
    const normalizedPath = path.trim();
    normalizedPaths.add(normalizedPath || rootPath);
  });
  return [...normalizedPaths];
}

export class RuntimeFileSystemService implements IFileSystemService {
  private readonly projectBrowserMounts: Record<string, BrowserMountState> = {};
  private readonly projectTauriMounts: Record<string, TauriMountState> = {};
  private readonly tauriRuntime: BirdCoderTauriFileSystemRuntime;
  private readonly projectFileContent: Record<string, Record<string, string>> = {};
  private readonly fileChangeListeners = new Map<
    string,
    Map<FileSystemChangeListener, FileSystemChangeSubscriptionOptions>
  >();
  private readonly projectFileTreePollers = new Map<string, ProjectFileTreePoller>();
  private readonly projectTauriFileWatchers = new Map<string, ProjectTauriFileWatcher>();
  private readonly projectTauriFileWatcherStarts = new Map<string, ProjectTauriFileWatcherStart>();
  private readonly projectTauriWatchQueues = new Map<string, ProjectTauriWatchQueue>();

  constructor(options: RuntimeFileSystemServiceOptions = {}) {
    this.tauriRuntime = options.tauriRuntime ?? createBirdCoderTauriFileSystemRuntime();
  }

  async getFiles(projectId: string): Promise<IFileNode[]> {
    const browserMount = this.projectBrowserMounts[projectId];
    if (browserMount) {
      if (!browserMount.cachedTree) {
        browserMount.cachedTree = createReadonlyMountedTree(browserMount.tree);
      }
      return browserMount.cachedTree;
    }

    const tauriMount = this.projectTauriMounts[projectId];
    if (tauriMount) {
      if (!tauriMount.cachedTree) {
        tauriMount.cachedTree = createReadonlyMountedTree(tauriMount.tree);
      }
      return tauriMount.cachedTree;
    }

    return [];
  }

  async loadDirectory(projectId: string, path: string): Promise<IFileNode[]> {
    if (this.isBrowserMountedPath(projectId, path)) {
      await this.loadBrowserMountedDirectory(projectId, path);
      return this.getFiles(projectId);
    }

    if (this.isTauriMountedPath(projectId, path)) {
      await this.loadTauriMountedDirectory(projectId, path);
      return this.getFiles(projectId);
    }

    throw new Error(`Directory "${path}" is not available because project "${projectId}" is not mounted.`);
  }

  async refreshDirectory(projectId: string, path?: string): Promise<IFileNode[]> {
    return this.refreshDirectories(projectId, path ? [path] : []);
  }

  async refreshDirectories(projectId: string, paths: readonly string[]): Promise<IFileNode[]> {
    const browserMount = this.projectBrowserMounts[projectId];
    if (browserMount) {
      const targetPaths = normalizeDirectoryRefreshPaths(paths, browserMount.rootPath);
      const refreshResults = await runBatchedTasks(
        targetPaths,
        DIRECTORY_REFRESH_BATCH_SIZE,
        async (directoryPath) => this.refreshBrowserDirectory(projectId, directoryPath),
      );
      refreshResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(
            `Failed to refresh browser-mounted directory "${targetPaths[index]}"`,
            result.reason,
          );
        }
      });
      return this.getFiles(projectId);
    }

    const tauriMount = this.projectTauriMounts[projectId];
    if (tauriMount) {
      const targetPaths = normalizeDirectoryRefreshPaths(paths, tauriMount.rootVirtualPath);
      const refreshResults = await runBatchedTasks(
        targetPaths,
        DIRECTORY_REFRESH_BATCH_SIZE,
        async (directoryPath) => this.refreshTauriDirectory(projectId, directoryPath),
      );
      refreshResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(
            `Failed to refresh desktop-mounted directory "${targetPaths[index]}"`,
            result.reason,
          );
        }
      });
      return this.getFiles(projectId);
    }

    return [];
  }

  subscribeToFileChanges(
    projectId: string,
    listener: (event: ProjectFileSystemChangeEvent) => void,
    options: FileSystemChangeSubscriptionOptions = {},
  ): () => void {
    const projectListeners =
      this.fileChangeListeners.get(projectId) ??
      new Map<FileSystemChangeListener, FileSystemChangeSubscriptionOptions>();
    projectListeners.set(listener, options);
    this.fileChangeListeners.set(projectId, projectListeners);
    this.ensureProjectFileTreeRealtime(projectId);

    return () => {
      const currentListeners = this.fileChangeListeners.get(projectId);
      if (!currentListeners) {
        return;
      }

      currentListeners.delete(listener);
      if (currentListeners.size === 0) {
        this.fileChangeListeners.delete(projectId);
        this.stopProjectFileTreePoller(projectId);
        this.stopProjectTauriFileWatcher(projectId);
        this.clearProjectTauriWatchQueue(projectId);
      }
    };
  }

  async getFileContent(projectId: string, path: string): Promise<string> {
    if (this.isBrowserMountedPath(projectId, path)) {
      const mountedContent = await this.readBrowserMountedFileContent(projectId, path);
      if (mountedContent !== null) {
        return mountedContent;
      }
    }

    if (this.isTauriMountedPath(projectId, path)) {
      const mountedContent = await this.readTauriMountedFileContent(projectId, path);
      if (mountedContent !== null) {
        return mountedContent;
      }
    }

    throw new Error(`File "${path}" is not available because project "${projectId}" is not mounted.`);
  }

  async getFileRevision(projectId: string, path: string): Promise<string> {
    if (this.isBrowserMountedPath(projectId, path)) {
      const mountedRevision = await this.readBrowserMountedFileRevision(projectId, path);
      if (mountedRevision !== null) {
        return mountedRevision;
      }
    }

    if (this.isTauriMountedPath(projectId, path)) {
      const mountedRevision = await this.readTauriMountedFileRevision(projectId, path);
      if (mountedRevision !== null) {
        return mountedRevision;
      }
    }

    throw new Error(`File "${path}" is not available because project "${projectId}" is not mounted.`);
  }

  async getFileRevisions(
    projectId: string,
    paths: readonly string[],
  ): Promise<ReadonlyArray<FileRevisionLookupResult>> {
    if (paths.length === 0) {
      return [];
    }

    if (this.projectBrowserMounts[projectId]) {
      const lookups = await runBatchedTasks(paths, DIRECTORY_POLL_BATCH_SIZE, async (path) => {
        const revision = await this.readBrowserMountedFileRevision(projectId, path);
        return {
          path,
          revision,
          missing: revision === null,
        } satisfies FileRevisionLookupResult;
      });

      return lookups.map((lookup, index) => {
        if (lookup.status === 'fulfilled') {
          return lookup.value;
        }

        return {
          path: paths[index]!,
          revision: null,
          missing: false,
          error: lookup.reason instanceof Error ? lookup.reason.message : String(lookup.reason),
        } satisfies FileRevisionLookupResult;
      });
    }

    const tauriMount = this.projectTauriMounts[projectId];
    if (tauriMount) {
      return this.tauriRuntime.getFileRevisions(
        tauriMount.rootSystemPath,
        tauriMount.rootVirtualPath,
        paths,
      );
    }

    return paths.map((path) => ({
      path,
      revision: null,
      missing: true,
      error: `File "${path}" is not available because project "${projectId}" is not mounted.`,
    }));
  }

  async saveFileContent(projectId: string, path: string, content: string): Promise<void> {
    if (this.isBrowserMountedPath(projectId, path)) {
      if (!(await this.writeBrowserMountedFile(projectId, path, content))) {
        throw new Error(`Unable to persist browser-mounted file "${path}".`);
      }

      this.projectFileContent[projectId] ??= {};
      this.projectFileContent[projectId][path] = content;
      return;
    }

    if (this.isTauriMountedPath(projectId, path)) {
      if (!(await this.writeTauriMountedFile(projectId, path, content))) {
        throw new Error(`Unable to persist desktop-mounted file "${path}".`);
      }

      this.projectFileContent[projectId] ??= {};
      this.projectFileContent[projectId][path] = content;
      return;
    }

    throw new Error(`Project "${projectId}" must mount a real folder before saving "${path}".`);
  }

  async createFile(projectId: string, path: string): Promise<void> {
    if (this.isBrowserMountedPath(projectId, path)) {
      if (!(await this.createBrowserMountedFile(projectId, path))) {
        throw new Error(`Unable to create browser-mounted file "${path}".`);
      }
      return;
    }

    if (this.isTauriMountedPath(projectId, path)) {
      if (!(await this.createTauriMountedFile(projectId, path))) {
        throw new Error(`Unable to create desktop-mounted file "${path}".`);
      }
      return;
    }

    throw new Error(`Project "${projectId}" must mount a real folder before creating "${path}".`);
  }

  async createFolder(projectId: string, path: string): Promise<void> {
    if (this.isBrowserMountedPath(projectId, path)) {
      if (!(await this.createBrowserMountedDirectory(projectId, path))) {
        throw new Error(`Unable to create browser-mounted directory "${path}".`);
      }
      return;
    }

    if (this.isTauriMountedPath(projectId, path)) {
      if (!(await this.createTauriMountedDirectory(projectId, path))) {
        throw new Error(`Unable to create desktop-mounted directory "${path}".`);
      }
      return;
    }

    throw new Error(`Project "${projectId}" must mount a real folder before creating "${path}".`);
  }

  async deleteFile(projectId: string, path: string): Promise<void> {
    if (this.isBrowserMountedPath(projectId, path)) {
      if (!(await this.deleteBrowserMountedEntry(projectId, path, false))) {
        throw new Error(`Unable to delete browser-mounted file "${path}".`);
      }
      deleteStoredPathContent(this.projectFileContent[projectId], path, false);
      return;
    }

    if (this.isTauriMountedPath(projectId, path)) {
      if (!(await this.deleteTauriMountedEntry(projectId, path, false))) {
        throw new Error(`Unable to delete desktop-mounted file "${path}".`);
      }
      deleteStoredPathContent(this.projectFileContent[projectId], path, false);
      return;
    }

    throw new Error(`Project "${projectId}" must mount a real folder before deleting "${path}".`);
  }

  async deleteFolder(projectId: string, path: string): Promise<void> {
    if (this.isBrowserMountedPath(projectId, path)) {
      if (!(await this.deleteBrowserMountedEntry(projectId, path, true))) {
        throw new Error(`Unable to delete browser-mounted directory "${path}".`);
      }
      deleteStoredPathContent(this.projectFileContent[projectId], path, true);
      return;
    }

    if (this.isTauriMountedPath(projectId, path)) {
      if (!(await this.deleteTauriMountedEntry(projectId, path, true))) {
        throw new Error(`Unable to delete desktop-mounted directory "${path}".`);
      }
      deleteStoredPathContent(this.projectFileContent[projectId], path, true);
      return;
    }

    throw new Error(`Project "${projectId}" must mount a real folder before deleting "${path}".`);
  }

  async renameNode(projectId: string, oldPath: string, newPath: string): Promise<void> {
    if (this.isBrowserMountedPath(projectId, oldPath) || this.isBrowserMountedPath(projectId, newPath)) {
      if (!(await this.renameBrowserMountedNode(projectId, oldPath, newPath))) {
        throw new Error(
          `Unable to rename browser-mounted entry from "${oldPath}" to "${newPath}".`,
        );
      }
      renameStoredPathContent(this.projectFileContent[projectId], oldPath, newPath);
      return;
    }

    if (this.isTauriMountedPath(projectId, oldPath) || this.isTauriMountedPath(projectId, newPath)) {
      if (!(await this.renameTauriMountedNode(projectId, oldPath, newPath))) {
        throw new Error(
          `Unable to rename desktop-mounted entry from "${oldPath}" to "${newPath}".`,
        );
      }
      renameStoredPathContent(this.projectFileContent[projectId], oldPath, newPath);
      return;
    }

    throw new Error(
      `Project "${projectId}" must mount a real folder before renaming "${oldPath}".`,
    );
  }

  async searchFiles(
    projectId: string,
    options: WorkspaceFileSearchOptions,
  ): Promise<WorkspaceFileSearchExecutionResult> {
    const signal = options.signal;
    if (signal?.aborted) {
      return createEmptyRuntimeFileSearchResult();
    }

    const searchMaxFileContentCharacters = normalizeRuntimeFileSearchContentBudget(
      options.maxFileContentCharacters,
    );
    let files: IFileNode[];
    try {
      files = await this.getSearchFileTree(projectId, options.signal);
    } catch (error) {
      if (isSearchTreeSnapshotAbortError(error)) {
        return createEmptyRuntimeFileSearchResult();
      }

      throw error;
    }

    if (signal?.aborted) {
      return createEmptyRuntimeFileSearchResult();
    }

    return searchProjectFiles({
      files,
      query: options.query,
      maxFileContentCharacters: searchMaxFileContentCharacters,
      maxResults: options.maxResults,
      maxSnippetLength: options.maxSnippetLength,
      signal,
      readFileContent: async (path: string) => {
        try {
          return await this.readSearchFileContent(
            projectId,
            path,
            searchMaxFileContentCharacters,
          );
        } catch {
          return '';
        }
      },
    });
  }

  async mountFolder(projectId: string, folderInfo: LocalFolderMountSource): Promise<void> {
    if (folderInfo.type === 'browser') {
      const existingBrowserMount = this.projectBrowserMounts[projectId];
      if (existingBrowserMount?.rootHandle === folderInfo.handle) {
        delete this.projectTauriMounts[projectId];
        this.ensureProjectFileTreeRealtime(projectId);
        return;
      }

      const mountState = await this.buildBrowserMountState(
        folderInfo.handle as unknown as BrowserDirectoryHandleLike,
      );
      this.projectBrowserMounts[projectId] = mountState;
      delete this.projectTauriMounts[projectId];
      this.projectFileContent[projectId] = {};
      this.ensureProjectFileTreeRealtime(projectId);
      return;
    }

    const existingTauriMount = this.projectTauriMounts[projectId];
    if (
      existingTauriMount &&
      normalizeComparableLocalFolderPath(existingTauriMount.rootSystemPath) ===
        normalizeComparableLocalFolderPath(folderInfo.path)
    ) {
      delete this.projectBrowserMounts[projectId];
      this.ensureProjectFileTreeRealtime(projectId);
      return;
    }

    const mountState = await this.buildTauriMountState(folderInfo.path);
    this.projectTauriMounts[projectId] = mountState;
    delete this.projectBrowserMounts[projectId];
    this.projectFileContent[projectId] = {};
    this.ensureProjectFileTreeRealtime(projectId);
  }

  private async getSearchFileTree(
    projectId: string,
    signal?: AbortSignal,
  ): Promise<IFileNode[]> {
    throwIfSearchTreeSnapshotAborted(signal);

    const browserMount = this.projectBrowserMounts[projectId];
    if (browserMount) {
      if (!browserMount.cachedSearchTree) {
        const browserSearchTreeSnapshot = await this.snapshotBrowserDirectoryRecursively(
          browserMount.rootHandle,
          browserMount.rootPath,
          browserMount.directoryHandles,
          browserMount.fileHandles,
          {
            signal,
            visitedNodeCount: 0,
          },
        );
        throwIfSearchTreeSnapshotAborted(signal);
        browserMount.cachedSearchTree = createReadonlyMountedTree(browserSearchTreeSnapshot);
      }
      return browserMount.cachedSearchTree;
    }

    const tauriMount = this.projectTauriMounts[projectId];
    if (tauriMount) {
      if (!tauriMount.cachedSearchTree) {
        throwIfSearchTreeSnapshotAborted(signal);
        const tauriSearchTreeSnapshot = await this.tauriRuntime.snapshotFolder(
          tauriMount.rootSystemPath,
        );
        throwIfSearchTreeSnapshotAborted(signal);
        tauriMount.cachedSearchTree = createReadonlyMountedTree(
          tauriSearchTreeSnapshot.tree,
        );
      }
      return tauriMount.cachedSearchTree;
    }

    return this.getFiles(projectId);
  }

  private invalidateProjectSearchTree(projectId: string): void {
    const browserMount = this.projectBrowserMounts[projectId];
    if (browserMount) {
      browserMount.cachedSearchTree = undefined;
    }

    const tauriMount = this.projectTauriMounts[projectId];
    if (tauriMount) {
      tauriMount.cachedSearchTree = undefined;
    }
  }

  private async buildBrowserMountState(
    rootHandle: BrowserDirectoryHandleLike,
  ): Promise<BrowserMountState> {
    const rootPath = `/${rootHandle.name}`;
    const directoryHandles = new Map<string, BrowserDirectoryHandleLike>();
    const fileHandles = new Map<string, BrowserFileHandleLike>();
    directoryHandles.set(rootPath, rootHandle);
    const tree: IFileNode = {
      name: rootHandle.name,
      type: 'directory',
      path: rootPath,
      children: await this.listBrowserDirectoryChildren(
        rootHandle,
        rootPath,
        directoryHandles,
        fileHandles,
      ),
    };

    return {
      directoryHandles,
      fileHandles,
      loadedDirectoryPaths: new Set([rootPath]),
      rootHandle,
      rootPath,
      tree,
    };
  }

  private async listBrowserDirectoryChildren(
    handle: BrowserDirectoryHandleLike,
    directoryPath: string,
    directoryHandles: Map<string, BrowserDirectoryHandleLike>,
    fileHandles: Map<string, BrowserFileHandleLike>,
  ): Promise<IFileNode[]> {
    const children: IFileNode[] = [];

    for await (const entry of listBrowserDirectoryEntries(handle)) {
      const childPath = buildChildPath(directoryPath, entry.name);
      if (isBrowserDirectoryHandle(entry)) {
        directoryHandles.set(childPath, entry);
        children.push({
          name: entry.name,
          type: 'directory',
          path: childPath,
        });
        continue;
      }

      fileHandles.set(childPath, entry);
      children.push({
        name: entry.name,
        type: 'file',
        path: childPath,
      });
    }

    return sortFileNodes(children);
  }

  private async snapshotBrowserDirectoryRecursively(
    handle: BrowserDirectoryHandleLike,
    directoryPath: string,
    directoryHandles: Map<string, BrowserDirectoryHandleLike>,
    fileHandles: Map<string, BrowserFileHandleLike>,
    context: SearchTreeSnapshotContext,
  ): Promise<IFileNode> {
    throwIfSearchTreeSnapshotAborted(context.signal);
    const children: IFileNode[] = [];

    for await (const entry of listBrowserDirectoryEntries(handle)) {
      await trackSearchTreeSnapshotEntry(context);
      const childPath = buildChildPath(directoryPath, entry.name);
      if (isBrowserDirectoryHandle(entry)) {
        directoryHandles.set(childPath, entry);
        children.push(
          await this.snapshotBrowserDirectoryRecursively(
            entry,
            childPath,
            directoryHandles,
            fileHandles,
            context,
          ),
        );
        continue;
      }

      fileHandles.set(childPath, entry);
      children.push({
        name: entry.name,
        type: 'file',
        path: childPath,
      });
    }

    throwIfSearchTreeSnapshotAborted(context.signal);
    return {
      name: handle.name,
      type: 'directory',
      path: directoryPath,
      children: sortFileNodes(children),
    };
  }

  private async loadBrowserMountedDirectory(
    projectId: string,
    directoryPath: string,
  ): Promise<void> {
    const mountState = this.projectBrowserMounts[projectId];
    if (!mountState) {
      return;
    }

    const targetHandle = mountState.directoryHandles.get(directoryPath);
    if (!targetHandle) {
      return;
    }

    const children = await this.listBrowserDirectoryChildren(
      targetHandle,
      directoryPath,
      mountState.directoryHandles,
      mountState.fileHandles,
    );
    this.pruneRemovedBrowserMountedEntries(
      projectId,
      mountState,
      directoryPath,
      children,
    );
    mountState.tree = replaceDirectoryChildren(mountState.tree, directoryPath, children);
    markLoadedDirectoryPath(mountState, directoryPath);
    mountState.cachedTree = undefined;
    this.invalidateProjectSearchTree(projectId);
  }

  private async refreshBrowserDirectory(projectId: string, directoryPath: string): Promise<void> {
    await this.loadBrowserMountedDirectory(projectId, directoryPath);
  }

  private async buildTauriMountState(rootSystemPath: string): Promise<TauriMountState> {
    const listing = await this.tauriRuntime.listDirectory(rootSystemPath, null);
    const rootRevisions = await this.tauriRuntime.getDirectoryRevisions(
      rootSystemPath,
      listing.rootVirtualPath,
      [listing.rootVirtualPath],
    );
    return this.createTauriMountStateFromListing(
      rootSystemPath,
      listing,
      resolveSuccessfulPathRevisionMap(rootRevisions),
    );
  }

  private createTauriMountStateFromListing(
    rootSystemPath: string,
    listing: BirdCoderTauriDirectoryListing,
    directoryRevisions: Map<string, string>,
  ): TauriMountState {
    const mountState: TauriMountState = {
      cachedSearchTree: undefined,
      cachedTree: undefined,
      directoryRevisions: new Map(directoryRevisions),
      loadedDirectoryPaths: new Set([listing.rootVirtualPath]),
      rootSystemPath,
      rootVirtualPath: listing.rootVirtualPath,
      tree: {
        name: listing.directory.name,
        type: listing.directory.type,
        path: listing.directory.path,
        children: cloneDirectoryChildren(listing.directory.children ?? []),
      },
    };

    return mountState;
  }

  private async loadTauriMountedDirectory(
    projectId: string,
    directoryPath: string,
    knownDirectoryRevision?: BirdCoderTauriPathRevisionLookupResult,
  ): Promise<void> {
    const mountState = this.projectTauriMounts[projectId];
    if (!mountState) {
      return;
    }

    const listing = await this.tauriRuntime.listDirectory(
      mountState.rootSystemPath,
      mountState.rootVirtualPath,
      directoryPath,
    );
    pruneRemovedLoadedDirectoryPaths(
      mountState,
      listing.directory.path,
      listing.directory.children ?? [],
    );
    mountState.tree = replaceDirectoryChildren(
      mountState.tree,
      listing.directory.path,
      listing.directory.children ?? [],
    );
    const directoryRevision =
      knownDirectoryRevision?.path === listing.directory.path
        ? knownDirectoryRevision
        : (
            await this.tauriRuntime.getDirectoryRevisions(
              mountState.rootSystemPath,
              mountState.rootVirtualPath,
              [listing.directory.path],
            )
          )[0];
    updateTauriDirectoryRevision(mountState, listing.directory.path, directoryRevision);
    markLoadedDirectoryPath(mountState, listing.directory.path);
    pruneTauriDirectoryRevisionMap(mountState);
    mountState.cachedTree = undefined;
    this.invalidateProjectSearchTree(projectId);
  }

  private async refreshTauriDirectory(projectId: string, directoryPath: string): Promise<void> {
    const mountState = this.projectTauriMounts[projectId];
    if (!mountState) {
      return;
    }

    const directoryRevisions = await this.tauriRuntime.getDirectoryRevisions(
      mountState.rootSystemPath,
      mountState.rootVirtualPath,
      [directoryPath],
    );
    const directoryRevision = directoryRevisions[0];
    if (
      directoryRevision &&
      !directoryRevision.missing &&
      !directoryRevision.error &&
      directoryRevision.revision !== null &&
      mountState.directoryRevisions.get(directoryPath) === directoryRevision.revision
    ) {
      return;
    }

    await this.loadTauriMountedDirectory(projectId, directoryPath, directoryRevision);
  }

  private ensureProjectFileTreeRealtime(projectId: string): void {
    if (!this.fileChangeListeners.has(projectId)) {
      this.stopProjectFileTreePoller(projectId);
      this.stopProjectTauriFileWatcher(projectId);
      this.clearProjectTauriWatchQueue(projectId);
      return;
    }

    if (this.projectTauriMounts[projectId]) {
      this.stopProjectFileTreePoller(projectId);
      void this.ensureProjectTauriFileWatcher(projectId);
      return;
    }

    this.stopProjectTauriFileWatcher(projectId);
    this.clearProjectTauriWatchQueue(projectId);
    if (this.projectBrowserMounts[projectId]) {
      this.ensureProjectFileTreePoller(projectId);
      return;
    }

    this.stopProjectFileTreePoller(projectId);
  }

  private async ensureProjectTauriFileWatcher(projectId: string): Promise<void> {
    const mountState = this.projectTauriMounts[projectId];
    if (!mountState || !this.fileChangeListeners.has(projectId)) {
      return;
    }

    const activeWatcher = this.projectTauriFileWatchers.get(projectId);
    if (activeWatcher) {
      if (activeWatcher.rootSystemPath === mountState.rootSystemPath) {
        return;
      }

      this.stopProjectTauriFileWatcher(projectId);
    }

    const startingWatcher = this.projectTauriFileWatcherStarts.get(projectId);
    if (startingWatcher) {
      if (startingWatcher.rootSystemPath === mountState.rootSystemPath) {
        return;
      }

      this.stopProjectTauriFileWatcher(projectId);
    }

    const watcherStart: ProjectTauriFileWatcherStart = {
      cancelled: false,
      rootSystemPath: mountState.rootSystemPath,
    };
    this.projectTauriFileWatcherStarts.set(projectId, watcherStart);

    try {
      const dispose = await this.tauriRuntime.watchProjectTree(
        mountState.rootSystemPath,
        (event) => {
          if (watcherStart.cancelled) {
            return;
          }

          this.enqueueProjectTauriWatchEvent(projectId, event);
        },
      );

      if (watcherStart.cancelled) {
        await dispose();
        return;
      }

      this.projectTauriFileWatchers.set(projectId, {
        rootSystemPath: mountState.rootSystemPath,
        stop: () => {
          if (watcherStart.cancelled) {
            return;
          }

          watcherStart.cancelled = true;
          void dispose().catch((error) => {
            console.error(
              `Failed to dispose desktop-mounted file watcher for project "${projectId}"`,
              error,
            );
          });
        },
      });
    } catch (error) {
      if (!watcherStart.cancelled) {
        console.error(
          `Failed to start desktop-mounted file watcher for project "${projectId}"`,
          error,
        );
        if (
          this.fileChangeListeners.has(projectId) &&
          this.projectTauriMounts[projectId]?.rootSystemPath === mountState.rootSystemPath
        ) {
          this.ensureProjectFileTreePoller(projectId);
        }
      }
    } finally {
      const currentWatcherStart = this.projectTauriFileWatcherStarts.get(projectId);
      if (currentWatcherStart === watcherStart) {
        this.projectTauriFileWatcherStarts.delete(projectId);
      }
    }
  }

  private stopProjectTauriFileWatcher(projectId: string): void {
    const watcher = this.projectTauriFileWatchers.get(projectId);
    if (watcher) {
      this.projectTauriFileWatchers.delete(projectId);
      watcher.stop();
    }

    const watcherStart = this.projectTauriFileWatcherStarts.get(projectId);
    if (watcherStart) {
      watcherStart.cancelled = true;
      this.projectTauriFileWatcherStarts.delete(projectId);
    }
  }

  private enqueueProjectTauriWatchEvent(
    projectId: string,
    event: BirdCoderTauriFileSystemWatchEvent,
  ): void {
    const normalizedPaths = [...new Set(event.paths.map((path) => path.trim()).filter(Boolean))];
    if (normalizedPaths.length === 0) {
      return;
    }

    const queue = this.projectTauriWatchQueues.get(projectId) ?? {
      events: [],
      isFlushing: false,
      timerId: null,
    };
    queue.events.push({
      kind: event.kind,
      paths: normalizedPaths,
    });
    this.projectTauriWatchQueues.set(projectId, queue);
    this.scheduleProjectTauriWatchQueueFlush(projectId, queue);
  }

  private scheduleProjectTauriWatchQueueFlush(
    projectId: string,
    queue: ProjectTauriWatchQueue,
  ): void {
    if (queue.timerId !== null) {
      return;
    }

    queue.timerId = setTimeout(() => {
      queue.timerId = null;
      void this.flushProjectTauriWatchQueue(projectId);
    }, TAURI_WATCH_FLUSH_DELAY_MS);
  }

  private clearProjectTauriWatchQueue(projectId: string): void {
    const queue = this.projectTauriWatchQueues.get(projectId);
    if (!queue) {
      return;
    }

    if (queue.timerId !== null) {
      clearTimeout(queue.timerId);
      queue.timerId = null;
    }

    this.projectTauriWatchQueues.delete(projectId);
  }

  private resolveTauriWatchRefreshPaths(
    projectId: string,
    event: ProjectFileSystemChangeEvent,
  ): string[] {
    const mountState = this.projectTauriMounts[projectId];
    if (!mountState) {
      return [];
    }

    const refreshPaths = new Set<string>();
    event.paths.forEach((path) => {
      const normalizedPath = path.trim() || mountState.rootVirtualPath;
      if (normalizedPath === mountState.rootVirtualPath) {
        refreshPaths.add(mountState.rootVirtualPath);
        return;
      }

      if (event.kind === 'remove' || event.kind === 'rename') {
        refreshPaths.add(getParentPath(normalizedPath));
        return;
      }

      const currentNode = findNodeByPath(mountState.tree, normalizedPath);
      if (currentNode?.type === 'directory') {
        refreshPaths.add(normalizedPath);
        return;
      }

      refreshPaths.add(getParentPath(normalizedPath));
    });

    return [...refreshPaths];
  }

  private async flushProjectTauriWatchQueue(projectId: string): Promise<void> {
    const queue = this.projectTauriWatchQueues.get(projectId);
    if (!queue || queue.isFlushing) {
      return;
    }

    queue.isFlushing = true;
    try {
      const pendingEvents = queue.events.splice(0);
      if (pendingEvents.length === 0) {
        return;
      }

      const changedPaths = new Set<string>();
      const refreshPaths = new Set<string>();
      pendingEvents.forEach((event) => {
        event.paths.forEach((path) => {
          changedPaths.add(path);
        });
        this.resolveTauriWatchRefreshPaths(projectId, event).forEach((path) => {
          refreshPaths.add(path);
        });
      });

      if (refreshPaths.size > 0) {
        await this.refreshDirectories(projectId, [...refreshPaths]);
      }

      if (changedPaths.size > 0) {
        this.emitFileSystemChange(projectId, {
          kind: 'other',
          paths: [...changedPaths],
        });
      }
    } finally {
      const currentQueue = this.projectTauriWatchQueues.get(projectId);
      if (!currentQueue) {
        return;
      }

      currentQueue.isFlushing = false;
      if (currentQueue.events.length === 0) {
        if (currentQueue.timerId === null) {
          this.projectTauriWatchQueues.delete(projectId);
        }
        return;
      }

      this.scheduleProjectTauriWatchQueueFlush(projectId, currentQueue);
    }
  }

  private ensureProjectFileTreePoller(projectId: string): void {
    if (this.projectFileTreePollers.has(projectId)) {
      return;
    }

    const poller: ProjectFileTreePoller = {
      directoryPollCursor: 0,
      isRunning: false,
      timerId: null,
      trackedFileKnownPaths: new Set(),
      trackedFilePollCursor: 0,
      trackedFileRevisionByPath: new Map(),
    };
    this.projectFileTreePollers.set(projectId, poller);
    this.scheduleProjectFileTreePoll(projectId, poller);
  }

  private scheduleProjectFileTreePoll(
    projectId: string,
    poller: ProjectFileTreePoller,
  ): void {
    if (poller.timerId !== null) {
      return;
    }

    poller.timerId = setTimeout(() => {
      poller.timerId = null;
      void this.pollProjectFileTreeChanges(projectId);
    }, FILE_TREE_POLL_INTERVAL_MS);
  }

  private stopProjectFileTreePoller(projectId: string): void {
    const poller = this.projectFileTreePollers.get(projectId);
    if (!poller) {
      return;
    }

    if (poller.timerId !== null) {
      clearTimeout(poller.timerId);
      poller.timerId = null;
    }
    this.projectFileTreePollers.delete(projectId);
  }

  private async pollProjectFileTreeChanges(projectId: string): Promise<void> {
    const poller = this.projectFileTreePollers.get(projectId);
    if (!poller || poller.isRunning) {
      return;
    }

    poller.isRunning = true;
    try {
      const directoryChangePaths = this.projectBrowserMounts[projectId]
        ? await this.pollBrowserMountedDirectories(projectId)
        : this.projectTauriMounts[projectId]
          ? await this.pollTauriMountedDirectories(projectId)
          : [];
      const trackedFileChangePaths = await this.pollTrackedProjectFiles(projectId);
      const changedPaths = [...directoryChangePaths, ...trackedFileChangePaths];

      if (changedPaths.length > 0) {
        this.emitFileSystemChange(projectId, {
          kind: 'other',
          paths: [...new Set(changedPaths)],
        });
      }
    } finally {
      const currentPoller = this.projectFileTreePollers.get(projectId);
      if (currentPoller) {
        currentPoller.isRunning = false;
        this.scheduleProjectFileTreePoll(projectId, currentPoller);
      }
    }
  }

  private collectTrackedProjectFilePaths(projectId: string): string[] {
    const projectListeners = this.fileChangeListeners.get(projectId);
    if (!projectListeners || projectListeners.size === 0) {
      return [];
    }

    const trackedFilePaths: string[] = [];
    const seenPaths = new Set<string>();
    projectListeners.forEach((options) => {
      if (typeof options.getTrackedFilePaths !== 'function') {
        return;
      }

      try {
        const paths = options.getTrackedFilePaths();
        paths.forEach((path) => {
          const normalizedPath = path.trim();
          if (!normalizedPath || seenPaths.has(normalizedPath)) {
            return;
          }

          seenPaths.add(normalizedPath);
          trackedFilePaths.push(normalizedPath);
        });
      } catch (error) {
        console.error(`Failed to resolve tracked file paths for project "${projectId}"`, error);
      }
    });

    return trackedFilePaths;
  }

  private pruneTrackedProjectFiles(
    poller: ProjectFileTreePoller,
    trackedFilePaths: readonly string[],
  ): void {
    const trackedFilePathSet = new Set(trackedFilePaths);
    poller.trackedFileKnownPaths.forEach((path) => {
      if (!trackedFilePathSet.has(path)) {
        poller.trackedFileKnownPaths.delete(path);
      }
    });
    poller.trackedFileRevisionByPath.forEach((_, path) => {
      if (!trackedFilePathSet.has(path)) {
        poller.trackedFileRevisionByPath.delete(path);
      }
    });
    if (trackedFilePaths.length <= 1) {
      poller.trackedFilePollCursor = 0;
    }
  }

  private async pollTrackedProjectFiles(projectId: string): Promise<string[]> {
    const poller = this.projectFileTreePollers.get(projectId);
    if (!poller) {
      return [];
    }

    const trackedFilePaths = this.collectTrackedProjectFilePaths(projectId);
    this.pruneTrackedProjectFiles(poller, trackedFilePaths);
    if (trackedFilePaths.length === 0) {
      return [];
    }

    const selectedTrackedFilePollBatch = selectTrackedFilePollPaths(
      trackedFilePaths,
      MAX_TRACKED_FILE_REVISIONS_PER_POLL,
      poller.trackedFilePollCursor,
    );
    poller.trackedFilePollCursor = selectedTrackedFilePollBatch.nextCursor;
    if (selectedTrackedFilePollBatch.paths.length === 0) {
      return [];
    }

    const revisionLookups = await this.getFileRevisions(projectId, selectedTrackedFilePollBatch.paths);
    const changedPaths: string[] = [];
    revisionLookups.forEach((lookup) => {
      if (lookup.error) {
        console.error(
          `Failed to poll tracked file revision "${lookup.path}" for project "${projectId}"`,
          lookup.error,
        );
        return;
      }

      const nextRevision = lookup.missing ? null : lookup.revision;
      const hasKnownRevision = poller.trackedFileKnownPaths.has(lookup.path);
      const previousRevision = poller.trackedFileRevisionByPath.get(lookup.path) ?? null;
      poller.trackedFileKnownPaths.add(lookup.path);
      poller.trackedFileRevisionByPath.set(lookup.path, nextRevision);
      if (!hasKnownRevision) {
        if (lookup.missing) {
          changedPaths.push(lookup.path);
        }
        return;
      }

      if (previousRevision !== nextRevision) {
        changedPaths.push(lookup.path);
      }
    });

    return changedPaths;
  }

  private async pollBrowserMountedDirectories(projectId: string): Promise<string[]> {
    const mountState = this.projectBrowserMounts[projectId];
    if (!mountState) {
      return [];
    }

    const loadedDirectoryPaths = [...mountState.loadedDirectoryPaths];
    const poller = this.projectFileTreePollers.get(projectId);
    const selectedDirectoryPollBatch = selectLoadedDirectoryPollPaths(
      loadedDirectoryPaths,
      MAX_LOADED_DIRECTORY_REVISIONS_PER_POLL,
      poller?.directoryPollCursor ?? 0,
    );
    if (poller) {
      poller.directoryPollCursor = selectedDirectoryPollBatch.nextCursor;
    }
    const changedPaths: string[] = [];
    const refreshResults = await runBatchedTasks(
      selectedDirectoryPollBatch.paths,
      DIRECTORY_POLL_BATCH_SIZE,
      async (directoryPath) => this.maybeRefreshBrowserMountedDirectory(projectId, directoryPath),
    );
    refreshResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value) {
          changedPaths.push(selectedDirectoryPollBatch.paths[index]!);
        }
        return;
      }

      console.error(
        `Failed to poll browser-mounted directory "${selectedDirectoryPollBatch.paths[index]}"`,
        result.reason,
      );
    });

    return changedPaths;
  }

  private async pollTauriMountedDirectories(projectId: string): Promise<string[]> {
    const mountState = this.projectTauriMounts[projectId];
    if (!mountState) {
      return [];
    }

    const loadedDirectoryPaths = [...mountState.loadedDirectoryPaths];
    const poller = this.projectFileTreePollers.get(projectId);
    const selectedDirectoryPollBatch = selectLoadedDirectoryPollPaths(
      loadedDirectoryPaths,
      MAX_LOADED_DIRECTORY_REVISIONS_PER_POLL,
      poller?.directoryPollCursor ?? 0,
    );
    if (poller) {
      poller.directoryPollCursor = selectedDirectoryPollBatch.nextCursor;
    }
    if (selectedDirectoryPollBatch.paths.length === 0) {
      return [];
    }
    const revisionLookups = await this.tauriRuntime.getDirectoryRevisions(
      mountState.rootSystemPath,
      mountState.rootVirtualPath,
      selectedDirectoryPollBatch.paths,
    );
    const changedDirectoryLookups = revisionLookups
      .filter((lookup) => {
        if (lookup.missing || lookup.error || lookup.revision === null) {
          return false;
        }

        return mountState.directoryRevisions.get(lookup.path) !== lookup.revision;
      });
    const changedPaths: string[] = [];
    const refreshResults = await runBatchedTasks(
      changedDirectoryLookups,
      DIRECTORY_POLL_BATCH_SIZE,
      async (lookup) => this.maybeRefreshTauriMountedDirectory(projectId, lookup),
    );
    refreshResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value) {
          changedPaths.push(changedDirectoryLookups[index]!.path);
        }
        return;
      }

      console.error(
        `Failed to poll desktop-mounted directory "${changedDirectoryLookups[index]?.path}"`,
        result.reason,
      );
    });

    return changedPaths;
  }

  private async maybeRefreshBrowserMountedDirectory(
    projectId: string,
    directoryPath: string,
  ): Promise<boolean> {
    const mountState = this.projectBrowserMounts[projectId];
    if (!mountState) {
      return false;
    }

    const currentNode = findNodeByPath(mountState.tree, directoryPath);
    const targetHandle = mountState.directoryHandles.get(directoryPath);
    if (!currentNode || !targetHandle) {
      return false;
    }

    const nextChildren = await this.listBrowserDirectoryChildren(
      targetHandle,
      directoryPath,
      mountState.directoryHandles,
      mountState.fileHandles,
    );
    if (areDirectoryChildrenEquivalent(currentNode.children, nextChildren)) {
      markLoadedDirectoryPath(mountState, directoryPath);
      return false;
    }

    this.pruneRemovedBrowserMountedEntries(
      projectId,
      mountState,
      directoryPath,
      nextChildren,
    );
    mountState.tree = replaceDirectoryChildren(mountState.tree, directoryPath, nextChildren);
    markLoadedDirectoryPath(mountState, directoryPath);
    mountState.cachedTree = undefined;
    this.invalidateProjectSearchTree(projectId);
    return true;
  }

  private async maybeRefreshTauriMountedDirectory(
    projectId: string,
    directoryRevision: BirdCoderTauriPathRevisionLookupResult,
  ): Promise<boolean> {
    const tauriMount = this.projectTauriMounts[projectId];
    if (!tauriMount) {
      return false;
    }

    const directoryPath = directoryRevision.path;

    const currentNode = findNodeByPath(tauriMount.tree, directoryPath);
    if (!currentNode) {
      return false;
    }

    const listing = await this.tauriRuntime.listDirectory(
      tauriMount.rootSystemPath,
      tauriMount.rootVirtualPath,
      directoryPath,
    );
    if (
      areDirectoryChildrenEquivalent(
        currentNode.children,
        listing.directory.children ?? [],
      )
    ) {
      updateTauriDirectoryRevision(tauriMount, directoryPath, directoryRevision);
      markLoadedDirectoryPath(tauriMount, directoryPath);
      return false;
    }
    pruneRemovedLoadedDirectoryPaths(
      tauriMount,
      listing.directory.path,
      listing.directory.children ?? [],
    );
    tauriMount.tree = replaceDirectoryChildren(
      tauriMount.tree,
      listing.directory.path,
      listing.directory.children ?? [],
    );
    updateTauriDirectoryRevision(tauriMount, listing.directory.path, directoryRevision);
    markLoadedDirectoryPath(tauriMount, listing.directory.path);
    pruneTauriDirectoryRevisionMap(tauriMount);
    tauriMount.cachedTree = undefined;
    this.invalidateProjectSearchTree(projectId);
    return true;
  }

  private pruneRemovedBrowserMountedEntries(
    projectId: string,
    mountState: BrowserMountState,
    directoryPath: string,
    nextChildren: readonly IFileNode[],
  ): void {
    const currentNode = findNodeByPath(mountState.tree, directoryPath);
    if (!currentNode?.children?.length) {
      return;
    }

    const nextChildrenByPath = new Map(
      nextChildren.map((child) => [child.path, child.type] as const),
    );
    currentNode.children.forEach((currentChild) => {
      const nextChildType = nextChildrenByPath.get(currentChild.path);
      if (nextChildType === currentChild.type) {
        return;
      }

      removeLoadedDirectoryPath(
        mountState,
        currentChild.path,
        currentChild.type === 'directory',
      );
      this.removeBrowserMountedHandles(
        mountState,
        currentChild.path,
        currentChild.type === 'directory',
        nextChildType,
      );
      deleteStoredPathContent(
        this.projectFileContent[projectId],
        currentChild.path,
        currentChild.type === 'directory',
      );
    });
  }

  private removeBrowserMountedHandles(
    mountState: BrowserMountState,
    path: string,
    recursive: boolean,
    replacementType?: IFileNode['type'],
  ): void {
    const shouldPreserveFileHandleAtPath = replacementType === 'file';
    const shouldPreserveDirectoryHandleAtPath = replacementType === 'directory';
    if (!shouldPreserveFileHandleAtPath) {
      mountState.fileHandles.delete(path);
    }
    if (!recursive) {
      if (!shouldPreserveDirectoryHandleAtPath) {
        mountState.directoryHandles.delete(path);
      }
      return;
    }

    const descendantPrefix = `${path}/`;
    [...mountState.fileHandles.keys()].forEach((candidatePath) => {
      if (
        candidatePath.startsWith(descendantPrefix) ||
        (candidatePath === path && !shouldPreserveFileHandleAtPath)
      ) {
        mountState.fileHandles.delete(candidatePath);
      }
    });
    [...mountState.directoryHandles.keys()].forEach((candidatePath) => {
      if (candidatePath === mountState.rootPath) {
        return;
      }

      if (
        candidatePath.startsWith(descendantPrefix) ||
        (candidatePath === path && !shouldPreserveDirectoryHandleAtPath)
      ) {
        mountState.directoryHandles.delete(candidatePath);
      }
    });
  }

  private emitFileSystemChange(
    projectId: string,
    event: ProjectFileSystemChangeEvent,
  ): void {
    const projectListeners = this.fileChangeListeners.get(projectId);
    if (!projectListeners || projectListeners.size === 0) {
      return;
    }

    projectListeners.forEach((_, listener) => {
      listener(event);
    });
  }

  private async readBrowserMountedFileContent(
    projectId: string,
    path: string,
    options: { maxCharacters?: number } = {},
  ): Promise<string | null> {
    const mountState = this.projectBrowserMounts[projectId];
    const fileHandle = mountState?.fileHandles.get(path);
    if (!fileHandle) {
      return null;
    }

    const file = await fileHandle.getFile();
    const maxCharacters = options.maxCharacters;
    const shouldReadPrefix =
      typeof maxCharacters === 'number' &&
      Number.isFinite(maxCharacters) &&
      maxCharacters > 0 &&
      typeof file.size === 'number' &&
      file.size > maxCharacters &&
      typeof file.slice === 'function';
    const content = shouldReadPrefix
      ? await file.slice(0, Math.floor(maxCharacters)).text()
      : await file.text();
    if (!shouldReadPrefix) {
      this.projectFileContent[projectId] ??= {};
      this.projectFileContent[projectId][path] = content;
    }
    return content;
  }

  private async readBrowserMountedFileRevision(
    projectId: string,
    path: string,
  ): Promise<string | null> {
    const mountState = this.projectBrowserMounts[projectId];
    const fileHandle = mountState?.fileHandles.get(path);
    if (!fileHandle) {
      return null;
    }

    const file = await fileHandle.getFile();
    return buildBrowserFileRevision(file);
  }

  private async readSearchFileContent(
    projectId: string,
    path: string,
    maxFileContentCharacters: number,
  ): Promise<string> {
    if (this.isBrowserMountedPath(projectId, path)) {
      const mountedContent = await this.readBrowserMountedFileContent(projectId, path, {
        maxCharacters: maxFileContentCharacters,
      });
      if (mountedContent !== null) {
        return mountedContent;
      }
    }

    if (this.isTauriMountedPath(projectId, path)) {
      const mountedContent = await this.readTauriMountedFileContent(projectId, path, {
        maxBytes: maxFileContentCharacters,
      });
      if (mountedContent !== null) {
        return mountedContent;
      }
    }

    return this.getFileContent(projectId, path);
  }

  private async readTauriMountedFileContent(
    projectId: string,
    path: string,
    options: { maxBytes?: number } = {},
  ): Promise<string | null> {
    const mountState = this.projectTauriMounts[projectId];
    if (!mountState || !isPathWithinRoot(mountState.rootVirtualPath, path, false)) {
      return null;
    }

    const content = await this.tauriRuntime.readFile(
      mountState.rootSystemPath,
      mountState.rootVirtualPath,
      path,
      options.maxBytes ? { maxBytes: options.maxBytes } : undefined,
    );
    if (!options.maxBytes) {
      this.projectFileContent[projectId] ??= {};
      this.projectFileContent[projectId][path] = content;
    }
    return content;
  }

  private async readTauriMountedFileRevision(projectId: string, path: string): Promise<string | null> {
    const mountState = this.projectTauriMounts[projectId];
    if (!mountState || !isPathWithinRoot(mountState.rootVirtualPath, path, false)) {
      return null;
    }

    return this.tauriRuntime.getFileRevision(
      mountState.rootSystemPath,
      mountState.rootVirtualPath,
      path,
    );
  }

  private async writeBrowserMountedFile(
    projectId: string,
    path: string,
    content: string,
  ): Promise<boolean> {
    const mountState = this.projectBrowserMounts[projectId];
    if (!mountState) {
      return false;
    }

    const existingHandle = mountState.fileHandles.get(path);
    if (existingHandle?.createWritable) {
      const writable = await existingHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    }

    const parentPath = getParentPath(path);
    const parentHandle = mountState.directoryHandles.get(parentPath);
    const fileName = path.split('/').pop();
    if (!parentHandle?.getFileHandle || !fileName) {
      return false;
    }

    const createdHandle = await parentHandle.getFileHandle(fileName, { create: true });
    if (!createdHandle.createWritable) {
      return false;
    }

    const writable = await createdHandle.createWritable();
    await writable.write(content);
    await writable.close();
    await this.refreshBrowserDirectory(projectId, parentPath);
    return true;
  }

  private async createBrowserMountedFile(projectId: string, path: string): Promise<boolean> {
    const mountState = this.projectBrowserMounts[projectId];
    if (!mountState) {
      return false;
    }

    const parentPath = getParentPath(path);
    const parentHandle = mountState.directoryHandles.get(parentPath);
    const fileName = path.split('/').pop();
    if (!parentHandle?.getFileHandle || !fileName) {
      return false;
    }

    await parentHandle.getFileHandle(fileName, { create: true });
    await this.refreshBrowserDirectory(projectId, parentPath);
    this.projectFileContent[projectId] ??= {};
    this.projectFileContent[projectId][path] = '';
    return true;
  }

  private async writeTauriMountedFile(
    projectId: string,
    path: string,
    content: string,
  ): Promise<boolean> {
    const mountState = this.projectTauriMounts[projectId];
    if (!mountState || !isPathWithinRoot(mountState.rootVirtualPath, path, false)) {
      return false;
    }

    await this.tauriRuntime.writeFile(
      mountState.rootSystemPath,
      mountState.rootVirtualPath,
      path,
      content,
    );
    return true;
  }

  private async createTauriMountedFile(projectId: string, path: string): Promise<boolean> {
    const mountState = this.projectTauriMounts[projectId];
    if (!mountState || !isPathWithinRoot(mountState.rootVirtualPath, path, false)) {
      return false;
    }

    await this.tauriRuntime.createFile(
      mountState.rootSystemPath,
      mountState.rootVirtualPath,
      path,
    );
    await this.refreshTauriDirectory(projectId, getParentPath(path));
    this.projectFileContent[projectId] ??= {};
    this.projectFileContent[projectId][path] = '';
    return true;
  }

  private async createBrowserMountedDirectory(projectId: string, path: string): Promise<boolean> {
    const mountState = this.projectBrowserMounts[projectId];
    if (!mountState) {
      return false;
    }

    const parentPath = getParentPath(path);
    const parentHandle = mountState.directoryHandles.get(parentPath);
    const directoryName = path.split('/').pop();
    if (!parentHandle?.getDirectoryHandle || !directoryName) {
      return false;
    }

    await parentHandle.getDirectoryHandle(directoryName, { create: true });
    await this.refreshBrowserDirectory(projectId, parentPath);
    return true;
  }

  private async createTauriMountedDirectory(projectId: string, path: string): Promise<boolean> {
    const mountState = this.projectTauriMounts[projectId];
    if (!mountState || !isPathWithinRoot(mountState.rootVirtualPath, path, false)) {
      return false;
    }

    await this.tauriRuntime.createDirectory(
      mountState.rootSystemPath,
      mountState.rootVirtualPath,
      path,
    );
    await this.refreshTauriDirectory(projectId, getParentPath(path));
    return true;
  }

  private async deleteBrowserMountedEntry(
    projectId: string,
    path: string,
    recursive: boolean,
  ): Promise<boolean> {
    const mountState = this.projectBrowserMounts[projectId];
    if (!mountState) {
      return false;
    }

    const parentPath = getParentPath(path);
    const parentHandle = mountState.directoryHandles.get(parentPath);
    const entryName = path.split('/').pop();
    if (!parentHandle?.removeEntry || !entryName) {
      return false;
    }

    await parentHandle.removeEntry(entryName, recursive ? { recursive: true } : undefined);
    await this.refreshBrowserDirectory(projectId, parentPath);
    return true;
  }

  private async deleteTauriMountedEntry(
    projectId: string,
    path: string,
    recursive: boolean,
  ): Promise<boolean> {
    const mountState = this.projectTauriMounts[projectId];
    if (!mountState || !isPathWithinRoot(mountState.rootVirtualPath, path, false)) {
      return false;
    }

    await this.tauriRuntime.deleteEntry(
      mountState.rootSystemPath,
      mountState.rootVirtualPath,
      path,
      recursive ? { recursive: true } : undefined,
    );
    await this.refreshTauriDirectory(projectId, getParentPath(path));
    return true;
  }

  private async renameBrowserMountedNode(
    projectId: string,
    oldPath: string,
    newPath: string,
  ): Promise<boolean> {
    const mountState = this.projectBrowserMounts[projectId];
    if (!mountState) {
      return false;
    }

    const oldParent = mountState.directoryHandles.get(getParentPath(oldPath));
    const newParent = mountState.directoryHandles.get(getParentPath(newPath));
    const oldName = oldPath.split('/').pop();
    const newName = newPath.split('/').pop();
    if (!oldParent?.removeEntry || !newParent || !oldName || !newName) {
      return false;
    }

    const fileHandle = mountState.fileHandles.get(oldPath);
    if (fileHandle?.getFile && newParent.getFileHandle) {
      const file = await fileHandle.getFile();
      const createdHandle = await newParent.getFileHandle(newName, { create: true });
      if (!createdHandle.createWritable) {
        return false;
      }

      const writable = await createdHandle.createWritable();
      await writable.write(await file.text());
      await writable.close();
      await oldParent.removeEntry(oldName);
      await this.refreshBrowserDirectory(projectId, getParentPath(oldPath));
      if (getParentPath(newPath) !== getParentPath(oldPath)) {
        await this.refreshBrowserDirectory(projectId, getParentPath(newPath));
      }
      return true;
    }

    const directoryHandle = mountState.directoryHandles.get(oldPath);
    if (directoryHandle && newParent.getDirectoryHandle) {
      const nextDirectory = await newParent.getDirectoryHandle(newName, { create: true });
      await this.copyBrowserDirectoryContents(directoryHandle, nextDirectory);
      await oldParent.removeEntry(oldName, { recursive: true });
      await this.refreshBrowserDirectory(projectId, getParentPath(oldPath));
      if (getParentPath(newPath) !== getParentPath(oldPath)) {
        await this.refreshBrowserDirectory(projectId, getParentPath(newPath));
      }
      return true;
    }

    return false;
  }

  private async renameTauriMountedNode(
    projectId: string,
    oldPath: string,
    newPath: string,
  ): Promise<boolean> {
    const mountState = this.projectTauriMounts[projectId];
    if (
      !mountState ||
      !isPathWithinRoot(mountState.rootVirtualPath, oldPath, false) ||
      !isPathWithinRoot(mountState.rootVirtualPath, newPath, false)
    ) {
      return false;
    }

    await this.tauriRuntime.renameEntry(
      mountState.rootSystemPath,
      mountState.rootVirtualPath,
      oldPath,
      newPath,
    );
    await this.refreshTauriDirectory(projectId, getParentPath(oldPath));
    if (getParentPath(newPath) !== getParentPath(oldPath)) {
      await this.refreshTauriDirectory(projectId, getParentPath(newPath));
    }
    return true;
  }

  private async copyBrowserDirectoryContents(
    sourceDirectory: BrowserDirectoryHandleLike,
    targetDirectory: BrowserDirectoryHandleLike,
  ): Promise<void> {
    for await (const entry of listBrowserDirectoryEntries(sourceDirectory)) {
      if (isBrowserDirectoryHandle(entry)) {
        if (!targetDirectory.getDirectoryHandle) {
          throw new Error('Target directory handle does not support creating child directories.');
        }

        const nextTarget = await targetDirectory.getDirectoryHandle(entry.name, { create: true });
        await this.copyBrowserDirectoryContents(entry, nextTarget);
        continue;
      }

      if (!targetDirectory.getFileHandle) {
        throw new Error('Target directory handle does not support creating child files.');
      }

      const file = await entry.getFile();
      const nextFile = await targetDirectory.getFileHandle(entry.name, { create: true });
      if (!nextFile.createWritable) {
        throw new Error('Target file handle does not support writing.');
      }

      const writable = await nextFile.createWritable();
      await writable.write(await file.text());
      await writable.close();
    }
  }

  private isBrowserMountedPath(projectId: string, path: string): boolean {
    const mountState = this.projectBrowserMounts[projectId];
    return !!mountState && isPathWithinRoot(mountState.rootPath, path);
  }

  private isTauriMountedPath(projectId: string, path: string): boolean {
    const mountState = this.projectTauriMounts[projectId];
    return !!mountState && isPathWithinRoot(mountState.rootVirtualPath, path);
  }
}
