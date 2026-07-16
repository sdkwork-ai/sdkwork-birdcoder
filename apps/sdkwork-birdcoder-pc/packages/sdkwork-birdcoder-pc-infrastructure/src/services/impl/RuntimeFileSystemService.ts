import {
  DEFAULT_MAX_SEARCHABLE_FILE_CONTENT_CHARACTERS,
  searchProjectFiles,
  type FileRevisionLookupResult,
  type ProjectDeviceMountRecoveryResult,
  type ProjectDeviceMountState,
  type ProjectFileSystemChangeEvent,
  type IFileNode,
  type LocalFolderMountSource,
  type WorkspaceFileSearchExecutionResult,
  type WorkspaceFileSearchOptions,
} from '@sdkwork/birdcoder-pc-types';
import { APP_SESSION_CHANGE_EVENT_NAME } from '@sdkwork/birdcoder-pc-core/appSessionEvents';
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
import {
  ProjectDeviceMountRegistry,
  type ProjectDeviceMountSubjectProvider,
} from '../ProjectDeviceMountRegistry.ts';

interface BrowserWritableLike {
  abort?(): Promise<void>;
  close(): Promise<void>;
  write(data: ArrayBuffer | string): Promise<void>;
}

interface BrowserFileLike {
  arrayBuffer?(): Promise<ArrayBuffer>;
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

async function copyBrowserFileSnapshot(
  file: BrowserFileLike,
  writable: BrowserWritableLike,
): Promise<void> {
  try {
    const payload = file.arrayBuffer ? await file.arrayBuffer() : await file.text();
    await writable.write(payload);
    await writable.close();
  } catch (error) {
    try {
      await writable.abort?.();
    } catch {
      // Preserve the original copy failure.
    }
    throw error;
  }
}

function readBrowserHandleLookupErrorName(error: unknown): string {
  if (!error || typeof error !== 'object' || !('name' in error)) {
    return '';
  }

  return typeof error.name === 'string' ? error.name : '';
}

async function browserDirectoryEntryExists(
  directory: BrowserDirectoryHandleLike,
  name: string,
): Promise<boolean> {
  const lookups: Array<() => Promise<BrowserHandleLike>> = [];
  if (directory.getFileHandle) {
    lookups.push(() => directory.getFileHandle!(name));
  }
  if (directory.getDirectoryHandle) {
    lookups.push(() => directory.getDirectoryHandle!(name));
  }

  for (const lookup of lookups) {
    try {
      await lookup();
      return true;
    } catch (error) {
      const errorName = readBrowserHandleLookupErrorName(error);
      const errorMessage = error instanceof Error ? error.message : String(error ?? '');
      if (errorName === 'TypeMismatchError' || /type mismatch/iu.test(errorMessage)) {
        return true;
      }
      if (errorName === 'NotFoundError' || /not found|does not exist/iu.test(errorMessage)) {
        continue;
      }
      throw error;
    }
  }

  return false;
}

interface BrowserMountState {
  cachedSearchTree?: IFileNode[];
  cachedSearchTreeLimitReached?: boolean;
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
  cachedSearchTreeLimitReached?: boolean;
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

interface MountedProjectSubjectScope {
  generation: number;
  key: string | null;
}

type FileSystemChangeListener = (event: ProjectFileSystemChangeEvent) => void;
type ProjectFileTreePoller = {
  directoryPollCursor: number;
  isRunning: boolean;
  scope: MountedProjectSubjectScope;
  timerId: ReturnType<typeof setTimeout> | null;
  trackedFileKnownPaths: Set<string>;
  trackedFilePollCursor: number;
  trackedFileRevisionByPath: Map<string, string | null>;
};
type ProjectTauriFileWatcher = {
  rootSystemPath: string;
  scope: MountedProjectSubjectScope;
  stop: () => void;
};
type ProjectTauriFileWatcherStart = {
  cancelled: boolean;
  rootSystemPath: string;
  scope: MountedProjectSubjectScope;
};
type ProjectTauriWatchQueue = {
  events: ProjectFileSystemChangeEvent[];
  isFlushing: boolean;
  scope: MountedProjectSubjectScope;
  timerId: ReturnType<typeof setTimeout> | null;
};
interface SearchTreeSnapshotContext {
  limitReached: boolean;
  maxNodeCount: number;
  signal?: AbortSignal;
  totalVisitedNodeCount: number;
  visitedNodeCount: number;
}

interface SearchFileTreeSnapshot {
  files: IFileNode[];
  limitReached: boolean;
}

const FILE_TREE_POLL_INTERVAL_MS = 1500;
const TAURI_WATCH_FLUSH_DELAY_MS = 40;
const DIRECTORY_REFRESH_BATCH_SIZE = 4;
const DIRECTORY_POLL_BATCH_SIZE = 4;
const MAX_LOADED_DIRECTORY_REVISIONS_PER_POLL = 24;
const MAX_TRACKED_FILE_REVISIONS_PER_POLL = 7;
const MIN_RUNTIME_FILE_SEARCH_CONTENT_CHARACTERS = 4_096;
const MAX_RUNTIME_FILE_SEARCH_TREE_NODES = 20_000;
const SEARCH_TREE_SNAPSHOT_YIELD_INTERVAL = 128;

export interface RuntimeFileSystemServiceOptions {
  mountRegistry?: ProjectDeviceMountRegistry;
  mountSubjectProvider?: ProjectDeviceMountSubjectProvider;
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
): Promise<boolean> {
  throwIfSearchTreeSnapshotAborted(context.signal);
  if (context.totalVisitedNodeCount >= context.maxNodeCount) {
    context.limitReached = true;
    return false;
  }

  context.totalVisitedNodeCount += 1;
  context.visitedNodeCount += 1;
  if (context.visitedNodeCount < SEARCH_TREE_SNAPSHOT_YIELD_INTERVAL) {
    return true;
  }

  context.visitedNodeCount = 0;
  await yieldSearchTreeSnapshot();
  throwIfSearchTreeSnapshotAborted(context.signal);
  return true;
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

function normalizeMountedVirtualPath(path: string): string | null {
  const normalizedPath = path.trim().replace(/\\/gu, '/').replace(/\/+/gu, '/');
  if (!normalizedPath.startsWith('/')) {
    return null;
  }

  const normalizedSegments = normalizedPath
    .split('/')
    .filter(Boolean);
  if (normalizedSegments.some((segment) => segment === '.' || segment === '..')) {
    return null;
  }

  return `/${normalizedSegments.join('/')}`;
}

function resolveMountedTauriSystemPath(
  mount: TauriMountState,
  mountedPath: string | undefined,
): string | null {
  const normalizedRootVirtualPath = normalizeMountedVirtualPath(mount.rootVirtualPath);
  if (!normalizedRootVirtualPath) {
    return null;
  }

  const normalizedTargetVirtualPath = mountedPath
    ? normalizeMountedVirtualPath(mountedPath)
    : normalizedRootVirtualPath;
  if (!normalizedTargetVirtualPath) {
    return null;
  }

  const rootPrefix = `${normalizedRootVirtualPath}/`;
  if (
    normalizedTargetVirtualPath !== normalizedRootVirtualPath &&
    !normalizedTargetVirtualPath.startsWith(rootPrefix)
  ) {
    return null;
  }

  const relativePath = normalizedTargetVirtualPath.slice(normalizedRootVirtualPath.length)
    .replace(/^\/+/, '');
  if (!relativePath) {
    return mount.rootSystemPath;
  }

  const pathSeparator = mount.rootSystemPath.includes('\\') ? '\\' : '/';
  const normalizedRootSystemPath = mount.rootSystemPath.replace(/[\\/]+$/u, '');
  return `${normalizedRootSystemPath}${pathSeparator}${relativePath.replace(/\//gu, pathSeparator)}`;
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
  private readonly projectMountSubjectScopes = new Map<string, MountedProjectSubjectScope>();
  private readonly mountRegistry: ProjectDeviceMountRegistry;
  private mountedProjectSubjectGeneration = 0;
  private mountedProjectSubjectKey: string | null = null;
  private mountedProjectSubjectReconcileRequest = 0;
  private mountedProjectSubjectAppliedRequest = 0;
  private mountedProjectSubjectInitialized = false;

  constructor(options: RuntimeFileSystemServiceOptions = {}) {
    this.mountRegistry =
      options.mountRegistry ??
      new ProjectDeviceMountRegistry({ subjectProvider: options.mountSubjectProvider });
    this.tauriRuntime = options.tauriRuntime ?? createBirdCoderTauriFileSystemRuntime();
    globalThis.addEventListener?.(APP_SESSION_CHANGE_EVENT_NAME, () => {
      void this.reconcileMountedProjectSubject();
    });
  }

  async getFiles(projectId: string): Promise<IFileNode[]> {
    const scope = await this.reconcileMountedProjectSubject();
    return this.getFilesForSubjectScope(projectId, scope);
  }

  private getFilesForSubjectScope(
    projectId: string,
    scope: MountedProjectSubjectScope,
  ): IFileNode[] {
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return [];
    }

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

  async getProjectMountState(projectId: string): Promise<ProjectDeviceMountState> {
    const scope = await this.reconcileMountedProjectSubject();
    const mountedState = this.createMountedProjectState(projectId, scope);
    if (mountedState) {
      return mountedState;
    }

    try {
      return await this.mountRegistry.inspect(projectId, scope.key);
    } catch {
      return {
        displayName: null,
        host: null,
        status: 'session_required',
      };
    }
  }

  async restoreProjectMount(projectId: string): Promise<ProjectDeviceMountRecoveryResult> {
    const scope = await this.reconcileMountedProjectSubject();
    const mountedState = this.createMountedProjectState(projectId, scope);
    if (mountedState) {
      return {
        restored: false,
        state: mountedState,
      };
    }

    let recovery;
    try {
      recovery = await this.mountRegistry.resolveRecoverySource(projectId, scope.key);
    } catch {
      return {
        restored: false,
        state: {
          displayName: null,
          host: null,
          status: 'session_required',
        },
      };
    }
    if (!recovery.source) {
      return {
        restored: false,
        state: recovery.state,
      };
    }

    try {
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      await this.mountFolderForSubjectScope(projectId, recovery.source, scope);
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      return {
        restored: true,
        state: this.createMountedProjectState(projectId, scope) ?? recovery.state,
      };
    } catch {
      return {
        restored: false,
        state: {
          displayName: recovery.state.displayName,
          host: recovery.state.host,
          status: 'mount_required',
        },
      };
    }
  }

  async resolveLocalWorkingDirectory(
    projectId: string,
    mountedPath?: string,
  ): Promise<string | null> {
    const scope = await this.reconcileMountedProjectSubject();
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return null;
    }

    const mount = this.projectTauriMounts[projectId];
    return mount ? resolveMountedTauriSystemPath(mount, mountedPath) : null;
  }

  async revealProjectInFileManager(
    projectId: string,
    mountedPath?: string,
  ): Promise<boolean> {
    const scope = await this.reconcileMountedProjectSubject();
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return false;
    }

    const mount = this.projectTauriMounts[projectId];
    const targetPath = mount ? resolveMountedTauriSystemPath(mount, mountedPath) : null;
    if (!targetPath) {
      return false;
    }

    try {
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      await this.tauriRuntime.revealInFileManager(targetPath);
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      return true;
    } catch {
      return false;
    }
  }

  async loadDirectory(projectId: string, path: string): Promise<IFileNode[]> {
    const scope = await this.reconcileMountedProjectSubject();
    if (this.isBrowserMountedPath(projectId, path, scope)) {
      await this.loadBrowserMountedDirectory(projectId, path, scope);
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      return this.getFilesForSubjectScope(projectId, scope);
    }

    if (this.isTauriMountedPath(projectId, path, scope)) {
      await this.loadTauriMountedDirectory(projectId, path, undefined, scope);
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      return this.getFilesForSubjectScope(projectId, scope);
    }

    throw new Error(`Directory "${path}" is not available because project "${projectId}" is not mounted.`);
  }

  async refreshDirectory(projectId: string, path?: string): Promise<IFileNode[]> {
    return this.refreshDirectories(projectId, path ? [path] : []);
  }

  async refreshDirectories(projectId: string, paths: readonly string[]): Promise<IFileNode[]> {
    const scope = await this.reconcileMountedProjectSubject();
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return [];
    }

    const browserMount = this.projectBrowserMounts[projectId];
    if (browserMount) {
      const targetPaths = normalizeDirectoryRefreshPaths(paths, browserMount.rootPath);
      const refreshResults = await runBatchedTasks(
        targetPaths,
        DIRECTORY_REFRESH_BATCH_SIZE,
        async (directoryPath) => this.refreshBrowserDirectory(projectId, directoryPath, scope),
      );
      refreshResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(
            `Failed to refresh browser-mounted directory "${targetPaths[index]}"`,
            result.reason,
          );
        }
      });
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      return this.getFilesForSubjectScope(projectId, scope);
    }

    const tauriMount = this.projectTauriMounts[projectId];
    if (tauriMount) {
      const targetPaths = normalizeDirectoryRefreshPaths(paths, tauriMount.rootVirtualPath);
      const refreshResults = await runBatchedTasks(
        targetPaths,
        DIRECTORY_REFRESH_BATCH_SIZE,
        async (directoryPath) => this.refreshTauriDirectory(projectId, directoryPath, scope),
      );
      refreshResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(
            `Failed to refresh desktop-mounted directory "${targetPaths[index]}"`,
            result.reason,
          );
        }
      });
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      return this.getFilesForSubjectScope(projectId, scope);
    }

    return [];
  }

  subscribeToFileChanges(
    projectId: string,
    listener: (event: ProjectFileSystemChangeEvent) => void,
    options: FileSystemChangeSubscriptionOptions = {},
  ): () => void {
    let disposed = false;
    const requestedScope = this.mountedProjectSubjectInitialized
      ? this.getMountedProjectSubjectScope()
      : null;
    let registeredScope = requestedScope;
    void this.registerFileChangeSubscription(
      projectId,
      listener,
      options,
      () => disposed,
      requestedScope,
      (scope) => {
        registeredScope = scope;
      },
    ).catch(
      (error) => {
        console.error(`Failed to register file-system subscription for project "${projectId}"`, error);
      },
    );

    return () => {
      disposed = true;
      this.removeFileChangeSubscription(projectId, listener, registeredScope);
    };
  }

  private async registerFileChangeSubscription(
    projectId: string,
    listener: (event: ProjectFileSystemChangeEvent) => void,
    options: FileSystemChangeSubscriptionOptions,
    isDisposed: () => boolean,
    expectedScope: MountedProjectSubjectScope | null,
    onRegistered: (scope: MountedProjectSubjectScope) => void,
  ): Promise<void> {
    const scope = await this.reconcileMountedProjectSubject();
    if (
      isDisposed() ||
      (expectedScope !== null &&
        (expectedScope.generation !== scope.generation || expectedScope.key !== scope.key))
    ) {
      return;
    }

    const projectListeners =
      this.fileChangeListeners.get(projectId) ??
      new Map<FileSystemChangeListener, FileSystemChangeSubscriptionOptions>();
    projectListeners.set(listener, options);
    this.fileChangeListeners.set(projectId, projectListeners);
    onRegistered(scope);
    this.ensureProjectFileTreeRealtime(projectId, scope);

  }

  private removeFileChangeSubscription(
    projectId: string,
    listener: (event: ProjectFileSystemChangeEvent) => void,
    scope: MountedProjectSubjectScope | null,
  ): void {
    if (scope && !this.isMountedProjectSubjectScopeActive(scope)) {
      return;
    }

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
  }

  async getFileContent(projectId: string, path: string): Promise<string> {
    const scope = await this.reconcileMountedProjectSubject();
    if (this.isBrowserMountedPath(projectId, path, scope)) {
      const mountedContent = await this.readBrowserMountedFileContent(projectId, path, scope);
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      if (mountedContent !== null) {
        return mountedContent;
      }
    }

    if (this.isTauriMountedPath(projectId, path, scope)) {
      const mountedContent = await this.readTauriMountedFileContent(projectId, path, scope);
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      if (mountedContent !== null) {
        return mountedContent;
      }
    }

    throw new Error(`File "${path}" is not available because project "${projectId}" is not mounted.`);
  }

  async getFileRevision(projectId: string, path: string): Promise<string> {
    const scope = await this.reconcileMountedProjectSubject();
    if (this.isBrowserMountedPath(projectId, path, scope)) {
      const mountedRevision = await this.readBrowserMountedFileRevision(projectId, path, scope);
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      if (mountedRevision !== null) {
        return mountedRevision;
      }
    }

    if (this.isTauriMountedPath(projectId, path, scope)) {
      const mountedRevision = await this.readTauriMountedFileRevision(projectId, path, scope);
      await this.assertMountedProjectSubjectScopeCurrent(scope);
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
    const scope = await this.reconcileMountedProjectSubject();
    return this.getFileRevisionsForSubjectScope(projectId, paths, scope);
  }

  private async getFileRevisionsForSubjectScope(
    projectId: string,
    paths: readonly string[],
    scope: MountedProjectSubjectScope,
  ): Promise<ReadonlyArray<FileRevisionLookupResult>> {
    if (paths.length === 0) {
      return [];
    }

    if (this.isProjectMountOwnedByScope(projectId, scope) && this.projectBrowserMounts[projectId]) {
      const lookups = await runBatchedTasks(paths, DIRECTORY_POLL_BATCH_SIZE, async (path) => {
        const revision = await this.readBrowserMountedFileRevision(projectId, path, scope);
        return {
          path,
          revision,
          missing: revision === null,
        } satisfies FileRevisionLookupResult;
      });

      await this.assertMountedProjectSubjectScopeCurrent(scope);
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

    const tauriMount = this.isProjectMountOwnedByScope(projectId, scope)
      ? this.projectTauriMounts[projectId]
      : undefined;
    if (tauriMount) {
      const revisions = await this.tauriRuntime.getFileRevisions(
        tauriMount.rootSystemPath,
        tauriMount.rootVirtualPath,
        paths,
      );
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      return revisions;
    }

    return paths.map((path) => ({
      path,
      revision: null,
      missing: true,
      error: `File "${path}" is not available because project "${projectId}" is not mounted.`,
    }));
  }

  async saveFileContent(projectId: string, path: string, content: string): Promise<void> {
    const scope = await this.reconcileMountedProjectSubject();
    if (this.isBrowserMountedPath(projectId, path, scope)) {
      if (!(await this.writeBrowserMountedFile(projectId, path, content, scope))) {
        throw new Error(`Unable to persist browser-mounted file "${path}".`);
      }

      await this.assertMountedProjectSubjectScopeCurrent(scope);
      this.projectFileContent[projectId] ??= {};
      this.projectFileContent[projectId][path] = content;
      return;
    }

    if (this.isTauriMountedPath(projectId, path, scope)) {
      if (!(await this.writeTauriMountedFile(projectId, path, content, scope))) {
        throw new Error(`Unable to persist desktop-mounted file "${path}".`);
      }

      await this.assertMountedProjectSubjectScopeCurrent(scope);
      this.projectFileContent[projectId] ??= {};
      this.projectFileContent[projectId][path] = content;
      return;
    }

    throw new Error(`Project "${projectId}" must mount a real folder before saving "${path}".`);
  }

  async createFile(projectId: string, path: string): Promise<void> {
    const scope = await this.reconcileMountedProjectSubject();
    if (this.isBrowserMountedPath(projectId, path, scope)) {
      if (!(await this.createBrowserMountedFile(projectId, path, scope))) {
        throw new Error(`Unable to create browser-mounted file "${path}".`);
      }
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      return;
    }

    if (this.isTauriMountedPath(projectId, path, scope)) {
      if (!(await this.createTauriMountedFile(projectId, path, scope))) {
        throw new Error(`Unable to create desktop-mounted file "${path}".`);
      }
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      return;
    }

    throw new Error(`Project "${projectId}" must mount a real folder before creating "${path}".`);
  }

  async createFolder(projectId: string, path: string): Promise<void> {
    const scope = await this.reconcileMountedProjectSubject();
    if (this.isBrowserMountedPath(projectId, path, scope)) {
      if (!(await this.createBrowserMountedDirectory(projectId, path, scope))) {
        throw new Error(`Unable to create browser-mounted directory "${path}".`);
      }
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      return;
    }

    if (this.isTauriMountedPath(projectId, path, scope)) {
      if (!(await this.createTauriMountedDirectory(projectId, path, scope))) {
        throw new Error(`Unable to create desktop-mounted directory "${path}".`);
      }
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      return;
    }

    throw new Error(`Project "${projectId}" must mount a real folder before creating "${path}".`);
  }

  async deleteFile(projectId: string, path: string): Promise<void> {
    const scope = await this.reconcileMountedProjectSubject();
    if (this.isBrowserMountedPath(projectId, path, scope)) {
      if (!(await this.deleteBrowserMountedEntry(projectId, path, false, scope))) {
        throw new Error(`Unable to delete browser-mounted file "${path}".`);
      }
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      deleteStoredPathContent(this.projectFileContent[projectId], path, false);
      return;
    }

    if (this.isTauriMountedPath(projectId, path, scope)) {
      if (!(await this.deleteTauriMountedEntry(projectId, path, false, scope))) {
        throw new Error(`Unable to delete desktop-mounted file "${path}".`);
      }
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      deleteStoredPathContent(this.projectFileContent[projectId], path, false);
      return;
    }

    throw new Error(`Project "${projectId}" must mount a real folder before deleting "${path}".`);
  }

  async deleteFolder(projectId: string, path: string): Promise<void> {
    const scope = await this.reconcileMountedProjectSubject();
    if (this.isBrowserMountedPath(projectId, path, scope)) {
      if (!(await this.deleteBrowserMountedEntry(projectId, path, true, scope))) {
        throw new Error(`Unable to delete browser-mounted directory "${path}".`);
      }
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      deleteStoredPathContent(this.projectFileContent[projectId], path, true);
      return;
    }

    if (this.isTauriMountedPath(projectId, path, scope)) {
      if (!(await this.deleteTauriMountedEntry(projectId, path, true, scope))) {
        throw new Error(`Unable to delete desktop-mounted directory "${path}".`);
      }
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      deleteStoredPathContent(this.projectFileContent[projectId], path, true);
      return;
    }

    throw new Error(`Project "${projectId}" must mount a real folder before deleting "${path}".`);
  }

  async renameNode(projectId: string, oldPath: string, newPath: string): Promise<void> {
    const scope = await this.reconcileMountedProjectSubject();
    if (
      this.isBrowserMountedPath(projectId, oldPath, scope) ||
      this.isBrowserMountedPath(projectId, newPath, scope)
    ) {
      if (!(await this.renameBrowserMountedNode(projectId, oldPath, newPath, scope))) {
        throw new Error(
          `Unable to rename browser-mounted entry from "${oldPath}" to "${newPath}".`,
        );
      }
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      renameStoredPathContent(this.projectFileContent[projectId], oldPath, newPath);
      return;
    }

    if (
      this.isTauriMountedPath(projectId, oldPath, scope) ||
      this.isTauriMountedPath(projectId, newPath, scope)
    ) {
      if (!(await this.renameTauriMountedNode(projectId, oldPath, newPath, scope))) {
        throw new Error(
          `Unable to rename desktop-mounted entry from "${oldPath}" to "${newPath}".`,
        );
      }
      await this.assertMountedProjectSubjectScopeCurrent(scope);
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
    const scope = await this.reconcileMountedProjectSubject();
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return createEmptyRuntimeFileSearchResult();
    }

    const signal = options.signal;
    if (signal?.aborted) {
      return createEmptyRuntimeFileSearchResult();
    }

    const searchMaxFileContentCharacters = normalizeRuntimeFileSearchContentBudget(
      options.maxFileContentCharacters,
    );
    let searchTreeSnapshot: SearchFileTreeSnapshot;
    try {
      searchTreeSnapshot = await this.getSearchFileTree(projectId, options.signal, scope);
      await this.assertMountedProjectSubjectScopeCurrent(scope);
    } catch (error) {
      if (isSearchTreeSnapshotAbortError(error)) {
        return createEmptyRuntimeFileSearchResult();
      }

      throw error;
    }

    if (signal?.aborted) {
      return createEmptyRuntimeFileSearchResult();
    }

    const searchResult = await searchProjectFiles({
      files: searchTreeSnapshot.files,
      query: options.query,
      maxFileContentCharacters: searchMaxFileContentCharacters,
      maxResults: options.maxResults,
      maxSnippetLength: options.maxSnippetLength,
      signal,
      readFileContent: async (path: string) => {
        try {
          if (!(await this.isMountedProjectSubjectScopeCurrent(scope))) {
            return '';
          }

          return await this.readSearchFileContent(
            projectId,
            path,
            searchMaxFileContentCharacters,
            scope,
          );
        } catch {
          return '';
        }
      },
    });
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    return {
      ...searchResult,
      limitReached: searchResult.limitReached || searchTreeSnapshot.limitReached,
    };
  }

  async mountFolder(projectId: string, folderInfo: LocalFolderMountSource): Promise<void> {
    const scope = await this.reconcileMountedProjectSubject();
    await this.mountFolderForSubjectScope(projectId, folderInfo, scope);
  }

  private async mountFolderForSubjectScope(
    projectId: string,
    folderInfo: LocalFolderMountSource,
    scope: MountedProjectSubjectScope,
  ): Promise<void> {
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (folderInfo.type === 'browser') {
      const existingBrowserMount = this.projectBrowserMounts[projectId];
      if (
        this.isProjectMountOwnedByScope(projectId, scope) &&
        existingBrowserMount?.rootHandle === folderInfo.handle
      ) {
        await this.persistProjectMount(projectId, folderInfo, scope);
        await this.assertMountedProjectSubjectScopeCurrent(scope);
        delete this.projectTauriMounts[projectId];
        this.setProjectMountSubjectScope(projectId, scope);
        this.ensureProjectFileTreeRealtime(projectId, scope);
        return;
      }

      const mountState = await this.buildBrowserMountState(
        folderInfo.handle as unknown as BrowserDirectoryHandleLike,
      );
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      await this.persistProjectMount(projectId, folderInfo, scope);
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      this.projectBrowserMounts[projectId] = mountState;
      delete this.projectTauriMounts[projectId];
      this.projectFileContent[projectId] = {};
      this.setProjectMountSubjectScope(projectId, scope);
      this.ensureProjectFileTreeRealtime(projectId, scope);
      return;
    }

    const existingTauriMount = this.projectTauriMounts[projectId];
    if (
      this.isProjectMountOwnedByScope(projectId, scope) &&
      existingTauriMount &&
      normalizeComparableLocalFolderPath(existingTauriMount.rootSystemPath) ===
        normalizeComparableLocalFolderPath(folderInfo.path)
    ) {
      await this.persistProjectMount(projectId, folderInfo, scope);
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      delete this.projectBrowserMounts[projectId];
      this.setProjectMountSubjectScope(projectId, scope);
      this.ensureProjectFileTreeRealtime(projectId, scope);
      return;
    }

    const mountState = await this.buildTauriMountState(folderInfo.path);
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    await this.persistProjectMount(projectId, folderInfo, scope);
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    this.projectTauriMounts[projectId] = mountState;
    delete this.projectBrowserMounts[projectId];
    this.projectFileContent[projectId] = {};
    this.setProjectMountSubjectScope(projectId, scope);
    this.ensureProjectFileTreeRealtime(projectId, scope);
  }

  private async persistProjectMount(
    projectId: string,
    folderInfo: LocalFolderMountSource,
    scope: MountedProjectSubjectScope,
  ): Promise<void> {
    const registration = await this.mountRegistry.register(projectId, folderInfo, scope.key);
    if (registration.status === 'recoverable') {
      return;
    }

    if (registration.status === 'session_required') {
      throw new Error('Sign in before binding a local project folder.');
    }

    throw new Error('The local project folder could not be persisted for future terminal access.');
  }

  private createMountedProjectState(
    projectId: string,
    scope: MountedProjectSubjectScope,
  ): ProjectDeviceMountState | null {
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return null;
    }

    const browserMount = this.projectBrowserMounts[projectId];
    if (browserMount) {
      return {
        displayName: browserMount.rootHandle.name || null,
        host: 'browser',
        status: 'mounted',
      };
    }

    const tauriMount = this.projectTauriMounts[projectId];
    if (!tauriMount) {
      return null;
    }

    const rootSegments = tauriMount.rootVirtualPath.split('/').filter(Boolean);
    return {
      displayName: rootSegments[rootSegments.length - 1] ?? null,
      host: 'tauri',
      status: 'mounted',
    };
  }

  private async reconcileMountedProjectSubject(): Promise<MountedProjectSubjectScope> {
    const reconcileRequest = ++this.mountedProjectSubjectReconcileRequest;
    let subjectKey: string | null;
    try {
      subjectKey = await this.mountRegistry.getCurrentSubjectKey();
    } catch {
      subjectKey = null;
    }

    // Subject providers may resolve out of order while IAM is committing a new
    // session. Only the newest reconciliation is allowed to change ownership.
    if (reconcileRequest < this.mountedProjectSubjectAppliedRequest) {
      return this.getMountedProjectSubjectScope();
    }

    this.mountedProjectSubjectAppliedRequest = reconcileRequest;
    if (!this.mountedProjectSubjectInitialized) {
      this.mountedProjectSubjectInitialized = true;
      this.mountedProjectSubjectKey = subjectKey;
      this.mountedProjectSubjectGeneration += 1;
      return this.getMountedProjectSubjectScope();
    }

    if (this.mountedProjectSubjectKey === subjectKey) {
      return this.getMountedProjectSubjectScope();
    }

    this.mountedProjectSubjectKey = subjectKey;
    this.mountedProjectSubjectGeneration += 1;
    this.clearMountedProjectState();
    return this.getMountedProjectSubjectScope();
  }

  private getMountedProjectSubjectScope(): MountedProjectSubjectScope {
    return {
      generation: this.mountedProjectSubjectGeneration,
      key: this.mountedProjectSubjectKey,
    };
  }

  private isMountedProjectSubjectScopeActive(scope: MountedProjectSubjectScope): boolean {
    return (
      this.mountedProjectSubjectInitialized &&
      this.mountedProjectSubjectGeneration === scope.generation &&
      this.mountedProjectSubjectKey === scope.key
    );
  }

  private async isMountedProjectSubjectScopeCurrent(
    scope: MountedProjectSubjectScope,
  ): Promise<boolean> {
    const currentScope = await this.reconcileMountedProjectSubject();
    return (
      currentScope.generation === scope.generation &&
      currentScope.key === scope.key
    );
  }

  private async assertMountedProjectSubjectScopeCurrent(
    scope: MountedProjectSubjectScope,
  ): Promise<void> {
    if (await this.isMountedProjectSubjectScopeCurrent(scope)) {
      return;
    }

    throw new Error('The active session changed while accessing the device-local project folder.');
  }

  private isProjectMountOwnedByScope(
    projectId: string,
    scope: MountedProjectSubjectScope,
  ): boolean {
    const mountScope = this.projectMountSubjectScopes.get(projectId);
    return (
      this.isMountedProjectSubjectScopeActive(scope) &&
      mountScope?.generation === scope.generation &&
      mountScope.key === scope.key
    );
  }

  private setProjectMountSubjectScope(
    projectId: string,
    scope: MountedProjectSubjectScope,
  ): void {
    if (!this.isMountedProjectSubjectScopeActive(scope)) {
      throw new Error('The active session changed while mounting the device-local project folder.');
    }

    this.projectMountSubjectScopes.set(projectId, scope);
  }

  private clearMountedProjectState(): void {
    const mountedProjectIds = new Set([
      ...Object.keys(this.projectBrowserMounts),
      ...Object.keys(this.projectTauriMounts),
      ...Object.keys(this.projectFileContent),
      ...this.fileChangeListeners.keys(),
      ...this.projectFileTreePollers.keys(),
      ...this.projectTauriFileWatchers.keys(),
      ...this.projectTauriFileWatcherStarts.keys(),
      ...this.projectTauriWatchQueues.keys(),
    ]);
    mountedProjectIds.forEach((projectId) => {
      this.stopProjectFileTreePoller(projectId);
      this.stopProjectTauriFileWatcher(projectId);
      this.clearProjectTauriWatchQueue(projectId);
      delete this.projectBrowserMounts[projectId];
      delete this.projectTauriMounts[projectId];
      delete this.projectFileContent[projectId];
      this.projectMountSubjectScopes.delete(projectId);
    });
    this.projectMountSubjectScopes.clear();
    this.fileChangeListeners.clear();
  }

  private async getSearchFileTree(
    projectId: string,
    signal?: AbortSignal,
    scope?: MountedProjectSubjectScope,
  ): Promise<SearchFileTreeSnapshot> {
    throwIfSearchTreeSnapshotAborted(signal);

    if (!scope || !this.isProjectMountOwnedByScope(projectId, scope)) {
      return {
        files: [],
        limitReached: false,
      };
    }

    const browserMount = this.projectBrowserMounts[projectId];
    if (browserMount) {
      if (!browserMount.cachedSearchTree) {
        const browserSearchTreeSnapshotContext: SearchTreeSnapshotContext = {
          limitReached: false,
          maxNodeCount: MAX_RUNTIME_FILE_SEARCH_TREE_NODES,
          signal,
          totalVisitedNodeCount: 0,
          visitedNodeCount: 0,
        };
        const browserSearchTreeSnapshot = await this.snapshotBrowserDirectoryRecursively(
          browserMount.rootHandle,
          browserMount.rootPath,
          browserMount.directoryHandles,
          browserMount.fileHandles,
          browserSearchTreeSnapshotContext,
        );
        throwIfSearchTreeSnapshotAborted(signal);
        await this.assertMountedProjectSubjectScopeCurrent(scope);
        if (this.projectBrowserMounts[projectId] !== browserMount) {
          throw new Error('The active session changed while reading the device-local project folder.');
        }
        browserMount.cachedSearchTree = createReadonlyMountedTree(browserSearchTreeSnapshot);
        browserMount.cachedSearchTreeLimitReached = browserSearchTreeSnapshotContext.limitReached;
      }
      return {
        files: browserMount.cachedSearchTree,
        limitReached: browserMount.cachedSearchTreeLimitReached === true,
      };
    }

    const tauriMount = this.projectTauriMounts[projectId];
    if (tauriMount) {
      if (!tauriMount.cachedSearchTree) {
        throwIfSearchTreeSnapshotAborted(signal);
        const tauriSearchTreeSnapshot = await this.tauriRuntime.snapshotFolder(
          tauriMount.rootSystemPath,
          MAX_RUNTIME_FILE_SEARCH_TREE_NODES,
        );
        throwIfSearchTreeSnapshotAborted(signal);
        await this.assertMountedProjectSubjectScopeCurrent(scope);
        if (this.projectTauriMounts[projectId] !== tauriMount) {
          throw new Error('The active session changed while reading the device-local project folder.');
        }
        tauriMount.cachedSearchTree = createReadonlyMountedTree(
          tauriSearchTreeSnapshot.tree,
        );
        tauriMount.cachedSearchTreeLimitReached =
          tauriSearchTreeSnapshot.limitReached === true;
      }
      return {
        files: tauriMount.cachedSearchTree,
        limitReached: tauriMount.cachedSearchTreeLimitReached === true,
      };
    }

    return {
      files: [],
      limitReached: false,
    };
  }

  private invalidateProjectSearchTree(
    projectId: string,
    scope?: MountedProjectSubjectScope,
  ): void {
    if (scope && !this.isProjectMountOwnedByScope(projectId, scope)) {
      return;
    }

    const browserMount = this.projectBrowserMounts[projectId];
    if (browserMount) {
      browserMount.cachedSearchTree = undefined;
      browserMount.cachedSearchTreeLimitReached = undefined;
    }

    const tauriMount = this.projectTauriMounts[projectId];
    if (tauriMount) {
      tauriMount.cachedSearchTree = undefined;
      tauriMount.cachedSearchTreeLimitReached = undefined;
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
      if (!(await trackSearchTreeSnapshotEntry(context))) {
        break;
      }
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
        if (context.limitReached) {
          break;
        }
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
    scope: MountedProjectSubjectScope,
  ): Promise<void> {
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return;
    }

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
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectBrowserMounts[projectId] !== mountState) {
      return;
    }

    this.pruneRemovedBrowserMountedEntries(
      projectId,
      mountState,
      directoryPath,
      children,
    );
    mountState.tree = replaceDirectoryChildren(mountState.tree, directoryPath, children);
    markLoadedDirectoryPath(mountState, directoryPath);
    mountState.cachedTree = undefined;
    this.invalidateProjectSearchTree(projectId, scope);
  }

  private async refreshBrowserDirectory(
    projectId: string,
    directoryPath: string,
    scope: MountedProjectSubjectScope,
  ): Promise<void> {
    await this.loadBrowserMountedDirectory(projectId, directoryPath, scope);
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
    scope?: MountedProjectSubjectScope,
  ): Promise<void> {
    if (!scope || !this.isProjectMountOwnedByScope(projectId, scope)) {
      return;
    }

    const mountState = this.projectTauriMounts[projectId];
    if (!mountState) {
      return;
    }

    const listing = await this.tauriRuntime.listDirectory(
      mountState.rootSystemPath,
      mountState.rootVirtualPath,
      directoryPath,
    );
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectTauriMounts[projectId] !== mountState) {
      return;
    }

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
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectTauriMounts[projectId] !== mountState) {
      return;
    }

    updateTauriDirectoryRevision(mountState, listing.directory.path, directoryRevision);
    markLoadedDirectoryPath(mountState, listing.directory.path);
    pruneTauriDirectoryRevisionMap(mountState);
    mountState.cachedTree = undefined;
    this.invalidateProjectSearchTree(projectId, scope);
  }

  private async refreshTauriDirectory(
    projectId: string,
    directoryPath: string,
    scope: MountedProjectSubjectScope,
  ): Promise<void> {
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return;
    }

    const mountState = this.projectTauriMounts[projectId];
    if (!mountState) {
      return;
    }

    const directoryRevisions = await this.tauriRuntime.getDirectoryRevisions(
      mountState.rootSystemPath,
      mountState.rootVirtualPath,
      [directoryPath],
    );
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectTauriMounts[projectId] !== mountState) {
      return;
    }

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

    await this.loadTauriMountedDirectory(projectId, directoryPath, directoryRevision, scope);
  }

  private ensureProjectFileTreeRealtime(
    projectId: string,
    scope: MountedProjectSubjectScope,
  ): void {
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return;
    }

    if (!this.fileChangeListeners.has(projectId)) {
      this.stopProjectFileTreePoller(projectId);
      this.stopProjectTauriFileWatcher(projectId);
      this.clearProjectTauriWatchQueue(projectId);
      return;
    }

    if (this.projectTauriMounts[projectId]) {
      this.stopProjectFileTreePoller(projectId);
      void this.ensureProjectTauriFileWatcher(projectId, scope);
      return;
    }

    this.stopProjectTauriFileWatcher(projectId);
    this.clearProjectTauriWatchQueue(projectId);
    if (this.projectBrowserMounts[projectId]) {
      this.ensureProjectFileTreePoller(projectId, scope);
      return;
    }

    this.stopProjectFileTreePoller(projectId);
  }

  private async ensureProjectTauriFileWatcher(
    projectId: string,
    scope: MountedProjectSubjectScope,
  ): Promise<void> {
    const mountState = this.projectTauriMounts[projectId];
    if (
      !this.isProjectMountOwnedByScope(projectId, scope) ||
      !mountState ||
      !this.fileChangeListeners.has(projectId)
    ) {
      return;
    }

    const activeWatcher = this.projectTauriFileWatchers.get(projectId);
    if (activeWatcher) {
      if (
        activeWatcher.rootSystemPath === mountState.rootSystemPath &&
        activeWatcher.scope.generation === scope.generation &&
        activeWatcher.scope.key === scope.key
      ) {
        return;
      }

      this.stopProjectTauriFileWatcher(projectId);
    }

    const startingWatcher = this.projectTauriFileWatcherStarts.get(projectId);
    if (startingWatcher) {
      if (
        startingWatcher.rootSystemPath === mountState.rootSystemPath &&
        startingWatcher.scope.generation === scope.generation &&
        startingWatcher.scope.key === scope.key
      ) {
        return;
      }

      this.stopProjectTauriFileWatcher(projectId);
    }

    const watcherStart: ProjectTauriFileWatcherStart = {
      cancelled: false,
      rootSystemPath: mountState.rootSystemPath,
      scope,
    };
    this.projectTauriFileWatcherStarts.set(projectId, watcherStart);

    try {
      const dispose = await this.tauriRuntime.watchProjectTree(
        mountState.rootSystemPath,
        (event) => {
          if (
            watcherStart.cancelled ||
            !this.isProjectMountOwnedByScope(projectId, scope) ||
            this.projectTauriMounts[projectId] !== mountState
          ) {
            return;
          }

          this.enqueueProjectTauriWatchEvent(projectId, event, scope);
        },
      );

      if (
        watcherStart.cancelled ||
        !this.isProjectMountOwnedByScope(projectId, scope) ||
        this.projectTauriMounts[projectId] !== mountState
      ) {
        await dispose();
        return;
      }

      this.projectTauriFileWatchers.set(projectId, {
        rootSystemPath: mountState.rootSystemPath,
        scope,
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
          this.isProjectMountOwnedByScope(projectId, scope) &&
          this.projectTauriMounts[projectId]?.rootSystemPath === mountState.rootSystemPath
        ) {
          this.ensureProjectFileTreePoller(projectId, scope);
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
    scope: MountedProjectSubjectScope,
  ): void {
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return;
    }

    const normalizedPaths = [...new Set(event.paths.map((path) => path.trim()).filter(Boolean))];
    if (normalizedPaths.length === 0) {
      return;
    }

    const existingQueue = this.projectTauriWatchQueues.get(projectId);
    if (
      existingQueue &&
      (existingQueue.scope.generation !== scope.generation || existingQueue.scope.key !== scope.key)
    ) {
      return;
    }

    const queue = existingQueue ?? {
      events: [],
      isFlushing: false,
      scope,
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
      void this.flushProjectTauriWatchQueue(projectId, queue);
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

  private async flushProjectTauriWatchQueue(
    projectId: string,
    queue: ProjectTauriWatchQueue,
  ): Promise<void> {
    if (
      this.projectTauriWatchQueues.get(projectId) !== queue ||
      queue.isFlushing ||
      !this.isProjectMountOwnedByScope(projectId, queue.scope)
    ) {
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
        const browserMount = this.projectBrowserMounts[projectId];
        if (browserMount) {
          await runBatchedTasks(
            [...refreshPaths],
            DIRECTORY_REFRESH_BATCH_SIZE,
            async (directoryPath) =>
              this.refreshBrowserDirectory(projectId, directoryPath, queue.scope),
          );
        } else if (this.projectTauriMounts[projectId]) {
          await runBatchedTasks(
            [...refreshPaths],
            DIRECTORY_REFRESH_BATCH_SIZE,
            async (directoryPath) =>
              this.refreshTauriDirectory(projectId, directoryPath, queue.scope),
          );
        }
      }

      if (
        changedPaths.size > 0 &&
        (await this.isMountedProjectSubjectScopeCurrent(queue.scope))
      ) {
        this.emitFileSystemChange(projectId, {
          kind: 'other',
          paths: [...changedPaths],
        }, queue.scope);
      }
    } finally {
      const currentQueue = this.projectTauriWatchQueues.get(projectId);
      if (
        currentQueue !== queue ||
        !this.isProjectMountOwnedByScope(projectId, queue.scope)
      ) {
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

  private ensureProjectFileTreePoller(
    projectId: string,
    scope: MountedProjectSubjectScope,
  ): void {
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return;
    }

    const currentPoller = this.projectFileTreePollers.get(projectId);
    if (
      currentPoller &&
      currentPoller.scope.generation === scope.generation &&
      currentPoller.scope.key === scope.key
    ) {
      return;
    }

    if (currentPoller) {
      this.stopProjectFileTreePoller(projectId);
    }

    const poller: ProjectFileTreePoller = {
      directoryPollCursor: 0,
      isRunning: false,
      scope,
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
      void this.pollProjectFileTreeChanges(projectId, poller);
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

  private async pollProjectFileTreeChanges(
    projectId: string,
    poller: ProjectFileTreePoller,
  ): Promise<void> {
    if (
      this.projectFileTreePollers.get(projectId) !== poller ||
      poller.isRunning ||
      !this.isProjectMountOwnedByScope(projectId, poller.scope)
    ) {
      return;
    }

    poller.isRunning = true;
    try {
      const browserMount = this.projectBrowserMounts[projectId];
      const tauriMount = this.projectTauriMounts[projectId];
      const directoryChangePaths = browserMount
        ? await this.pollBrowserMountedDirectories(projectId, browserMount, poller)
        : tauriMount
          ? await this.pollTauriMountedDirectories(projectId, tauriMount, poller)
          : [];
      if (!(await this.isMountedProjectSubjectScopeCurrent(poller.scope))) {
        return;
      }

      const trackedFileChangePaths = await this.pollTrackedProjectFiles(projectId, poller);
      if (!(await this.isMountedProjectSubjectScopeCurrent(poller.scope))) {
        return;
      }

      const changedPaths = [...directoryChangePaths, ...trackedFileChangePaths];

      if (changedPaths.length > 0) {
        this.emitFileSystemChange(projectId, {
          kind: 'other',
          paths: [...new Set(changedPaths)],
        }, poller.scope);
      }
    } catch (error) {
      if (this.isProjectMountOwnedByScope(projectId, poller.scope)) {
        console.error(`Failed to poll mounted project file tree "${projectId}"`, error);
      }
    } finally {
      const currentPoller = this.projectFileTreePollers.get(projectId);
      if (
        currentPoller === poller &&
        this.isProjectMountOwnedByScope(projectId, poller.scope)
      ) {
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

  private async pollTrackedProjectFiles(
    projectId: string,
    poller: ProjectFileTreePoller,
  ): Promise<string[]> {
    if (
      this.projectFileTreePollers.get(projectId) !== poller ||
      !this.isProjectMountOwnedByScope(projectId, poller.scope)
    ) {
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

    const revisionLookups = await this.getFileRevisionsForSubjectScope(
      projectId,
      selectedTrackedFilePollBatch.paths,
      poller.scope,
    );
    if (
      this.projectFileTreePollers.get(projectId) !== poller ||
      !(await this.isMountedProjectSubjectScopeCurrent(poller.scope))
    ) {
      return [];
    }

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

  private async pollBrowserMountedDirectories(
    projectId: string,
    mountState: BrowserMountState,
    poller: ProjectFileTreePoller,
  ): Promise<string[]> {
    if (
      this.projectFileTreePollers.get(projectId) !== poller ||
      !this.isProjectMountOwnedByScope(projectId, poller.scope) ||
      this.projectBrowserMounts[projectId] !== mountState
    ) {
      return [];
    }

    const loadedDirectoryPaths = [...mountState.loadedDirectoryPaths];
    const selectedDirectoryPollBatch = selectLoadedDirectoryPollPaths(
      loadedDirectoryPaths,
      MAX_LOADED_DIRECTORY_REVISIONS_PER_POLL,
      poller.directoryPollCursor,
    );
    poller.directoryPollCursor = selectedDirectoryPollBatch.nextCursor;
    const changedPaths: string[] = [];
    const refreshResults = await runBatchedTasks(
      selectedDirectoryPollBatch.paths,
      DIRECTORY_POLL_BATCH_SIZE,
      async (directoryPath) =>
        this.maybeRefreshBrowserMountedDirectory(
          projectId,
          directoryPath,
          mountState,
          poller.scope,
        ),
    );
    if (
      this.projectFileTreePollers.get(projectId) !== poller ||
      !(await this.isMountedProjectSubjectScopeCurrent(poller.scope))
    ) {
      return [];
    }

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

  private async pollTauriMountedDirectories(
    projectId: string,
    mountState: TauriMountState,
    poller: ProjectFileTreePoller,
  ): Promise<string[]> {
    if (
      this.projectFileTreePollers.get(projectId) !== poller ||
      !this.isProjectMountOwnedByScope(projectId, poller.scope) ||
      this.projectTauriMounts[projectId] !== mountState
    ) {
      return [];
    }

    const loadedDirectoryPaths = [...mountState.loadedDirectoryPaths];
    const selectedDirectoryPollBatch = selectLoadedDirectoryPollPaths(
      loadedDirectoryPaths,
      MAX_LOADED_DIRECTORY_REVISIONS_PER_POLL,
      poller.directoryPollCursor,
    );
    poller.directoryPollCursor = selectedDirectoryPollBatch.nextCursor;
    if (selectedDirectoryPollBatch.paths.length === 0) {
      return [];
    }
    const revisionLookups = await this.tauriRuntime.getDirectoryRevisions(
      mountState.rootSystemPath,
      mountState.rootVirtualPath,
      selectedDirectoryPollBatch.paths,
    );
    if (
      this.projectFileTreePollers.get(projectId) !== poller ||
      !(await this.isMountedProjectSubjectScopeCurrent(poller.scope)) ||
      this.projectTauriMounts[projectId] !== mountState
    ) {
      return [];
    }

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
      async (lookup) =>
        this.maybeRefreshTauriMountedDirectory(
          projectId,
          lookup,
          mountState,
          poller.scope,
        ),
    );
    if (
      this.projectFileTreePollers.get(projectId) !== poller ||
      !(await this.isMountedProjectSubjectScopeCurrent(poller.scope))
    ) {
      return [];
    }

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
    mountState: BrowserMountState,
    scope: MountedProjectSubjectScope,
  ): Promise<boolean> {
    if (
      !this.isProjectMountOwnedByScope(projectId, scope) ||
      this.projectBrowserMounts[projectId] !== mountState
    ) {
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
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectBrowserMounts[projectId] !== mountState) {
      return false;
    }

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
    this.invalidateProjectSearchTree(projectId, scope);
    return true;
  }

  private async maybeRefreshTauriMountedDirectory(
    projectId: string,
    directoryRevision: BirdCoderTauriPathRevisionLookupResult,
    tauriMount: TauriMountState,
    scope: MountedProjectSubjectScope,
  ): Promise<boolean> {
    if (
      !this.isProjectMountOwnedByScope(projectId, scope) ||
      this.projectTauriMounts[projectId] !== tauriMount
    ) {
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
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectTauriMounts[projectId] !== tauriMount) {
      return false;
    }

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
    this.invalidateProjectSearchTree(projectId, scope);
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
    scope: MountedProjectSubjectScope,
  ): void {
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return;
    }

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
    scope: MountedProjectSubjectScope,
    options: { maxCharacters?: number } = {},
  ): Promise<string | null> {
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return null;
    }

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
    const content = shouldReadPrefix && typeof file.slice === 'function'
      ? await file.slice(0, Math.floor(maxCharacters)).text()
      : await file.text();
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectBrowserMounts[projectId] !== mountState) {
      return null;
    }

    if (!shouldReadPrefix) {
      this.projectFileContent[projectId] ??= {};
      this.projectFileContent[projectId][path] = content;
    }
    return content;
  }

  private async readBrowserMountedFileRevision(
    projectId: string,
    path: string,
    scope: MountedProjectSubjectScope,
  ): Promise<string | null> {
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return null;
    }

    const mountState = this.projectBrowserMounts[projectId];
    const fileHandle = mountState?.fileHandles.get(path);
    if (!fileHandle) {
      return null;
    }

    const file = await fileHandle.getFile();
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectBrowserMounts[projectId] !== mountState) {
      return null;
    }

    return buildBrowserFileRevision(file);
  }

  private async readSearchFileContent(
    projectId: string,
    path: string,
    maxFileContentCharacters: number,
    scope: MountedProjectSubjectScope,
  ): Promise<string> {
    if (this.isBrowserMountedPath(projectId, path, scope)) {
      const mountedContent = await this.readBrowserMountedFileContent(
        projectId,
        path,
        scope,
        { maxCharacters: maxFileContentCharacters },
      );
      if (mountedContent !== null) {
        return mountedContent;
      }
    }

    if (this.isTauriMountedPath(projectId, path, scope)) {
      const mountedContent = await this.readTauriMountedFileContent(projectId, path, scope, {
        maxBytes: maxFileContentCharacters,
      });
      if (mountedContent !== null) {
        return mountedContent;
      }
    }

    return '';
  }

  private async readTauriMountedFileContent(
    projectId: string,
    path: string,
    scope: MountedProjectSubjectScope,
    options: { maxBytes?: number } = {},
  ): Promise<string | null> {
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return null;
    }

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
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectTauriMounts[projectId] !== mountState) {
      return null;
    }

    if (!options.maxBytes) {
      this.projectFileContent[projectId] ??= {};
      this.projectFileContent[projectId][path] = content;
    }
    return content;
  }

  private async readTauriMountedFileRevision(
    projectId: string,
    path: string,
    scope: MountedProjectSubjectScope,
  ): Promise<string | null> {
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return null;
    }

    const mountState = this.projectTauriMounts[projectId];
    if (!mountState || !isPathWithinRoot(mountState.rootVirtualPath, path, false)) {
      return null;
    }

    const revision = await this.tauriRuntime.getFileRevision(
      mountState.rootSystemPath,
      mountState.rootVirtualPath,
      path,
    );
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    return this.projectTauriMounts[projectId] === mountState ? revision : null;
  }

  private async writeBrowserMountedFile(
    projectId: string,
    path: string,
    content: string,
    scope: MountedProjectSubjectScope,
  ): Promise<boolean> {
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return false;
    }

    const mountState = this.projectBrowserMounts[projectId];
    if (!mountState) {
      return false;
    }

    const existingHandle = mountState.fileHandles.get(path);
    if (existingHandle?.createWritable) {
      const writable = await existingHandle.createWritable();
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      if (this.projectBrowserMounts[projectId] !== mountState) {
        return false;
      }
      await writable.write(content);
      await writable.close();
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      if (this.projectBrowserMounts[projectId] !== mountState) {
        return false;
      }
      return true;
    }

    const parentPath = getParentPath(path);
    const parentHandle = mountState.directoryHandles.get(parentPath);
    const fileName = path.split('/').pop();
    if (!parentHandle?.getFileHandle || !fileName) {
      return false;
    }

    const createdHandle = await parentHandle.getFileHandle(fileName, { create: true });
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectBrowserMounts[projectId] !== mountState) {
      return false;
    }
    if (!createdHandle.createWritable) {
      return false;
    }

    const writable = await createdHandle.createWritable();
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectBrowserMounts[projectId] !== mountState) {
      return false;
    }
    await writable.write(content);
    await writable.close();
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectBrowserMounts[projectId] !== mountState) {
      return false;
    }
    await this.refreshBrowserDirectory(projectId, parentPath, scope);
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectBrowserMounts[projectId] !== mountState) {
      return false;
    }
    return true;
  }

  private async createBrowserMountedFile(
    projectId: string,
    path: string,
    scope: MountedProjectSubjectScope,
  ): Promise<boolean> {
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return false;
    }

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

    if (await browserDirectoryEntryExists(parentHandle, fileName)) {
      throw new Error(`A browser-mounted entry already exists at "${path}".`);
    }
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectBrowserMounts[projectId] !== mountState) {
      return false;
    }

    await parentHandle.getFileHandle(fileName, { create: true });
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectBrowserMounts[projectId] !== mountState) {
      return false;
    }
    await this.refreshBrowserDirectory(projectId, parentPath, scope);
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectBrowserMounts[projectId] !== mountState) {
      return false;
    }
    this.projectFileContent[projectId] ??= {};
    this.projectFileContent[projectId][path] = '';
    return true;
  }

  private async writeTauriMountedFile(
    projectId: string,
    path: string,
    content: string,
    scope: MountedProjectSubjectScope,
  ): Promise<boolean> {
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return false;
    }

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
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectTauriMounts[projectId] !== mountState) {
      return false;
    }
    return true;
  }

  private async createTauriMountedFile(
    projectId: string,
    path: string,
    scope: MountedProjectSubjectScope,
  ): Promise<boolean> {
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return false;
    }

    const mountState = this.projectTauriMounts[projectId];
    if (!mountState || !isPathWithinRoot(mountState.rootVirtualPath, path, false)) {
      return false;
    }

    await this.tauriRuntime.createFile(
      mountState.rootSystemPath,
      mountState.rootVirtualPath,
      path,
    );
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectTauriMounts[projectId] !== mountState) {
      return false;
    }
    await this.refreshTauriDirectory(projectId, getParentPath(path), scope);
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectTauriMounts[projectId] !== mountState) {
      return false;
    }
    this.projectFileContent[projectId] ??= {};
    this.projectFileContent[projectId][path] = '';
    return true;
  }

  private async createBrowserMountedDirectory(
    projectId: string,
    path: string,
    scope: MountedProjectSubjectScope,
  ): Promise<boolean> {
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return false;
    }

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

    if (await browserDirectoryEntryExists(parentHandle, directoryName)) {
      throw new Error(`A browser-mounted entry already exists at "${path}".`);
    }
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectBrowserMounts[projectId] !== mountState) {
      return false;
    }

    await parentHandle.getDirectoryHandle(directoryName, { create: true });
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectBrowserMounts[projectId] !== mountState) {
      return false;
    }
    await this.refreshBrowserDirectory(projectId, parentPath, scope);
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    return this.projectBrowserMounts[projectId] === mountState;
  }

  private async createTauriMountedDirectory(
    projectId: string,
    path: string,
    scope: MountedProjectSubjectScope,
  ): Promise<boolean> {
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return false;
    }

    const mountState = this.projectTauriMounts[projectId];
    if (!mountState || !isPathWithinRoot(mountState.rootVirtualPath, path, false)) {
      return false;
    }

    await this.tauriRuntime.createDirectory(
      mountState.rootSystemPath,
      mountState.rootVirtualPath,
      path,
    );
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectTauriMounts[projectId] !== mountState) {
      return false;
    }
    await this.refreshTauriDirectory(projectId, getParentPath(path), scope);
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    return this.projectTauriMounts[projectId] === mountState;
  }

  private async deleteBrowserMountedEntry(
    projectId: string,
    path: string,
    recursive: boolean,
    scope: MountedProjectSubjectScope,
  ): Promise<boolean> {
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return false;
    }

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
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectBrowserMounts[projectId] !== mountState) {
      return false;
    }
    await this.refreshBrowserDirectory(projectId, parentPath, scope);
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    return this.projectBrowserMounts[projectId] === mountState;
  }

  private async deleteTauriMountedEntry(
    projectId: string,
    path: string,
    recursive: boolean,
    scope: MountedProjectSubjectScope,
  ): Promise<boolean> {
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return false;
    }

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
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectTauriMounts[projectId] !== mountState) {
      return false;
    }
    await this.refreshTauriDirectory(projectId, getParentPath(path), scope);
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    return this.projectTauriMounts[projectId] === mountState;
  }

  private async renameBrowserMountedNode(
    projectId: string,
    oldPath: string,
    newPath: string,
    scope: MountedProjectSubjectScope,
  ): Promise<boolean> {
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return false;
    }

    const mountState = this.projectBrowserMounts[projectId];
    if (!mountState) {
      return false;
    }
    if (oldPath === newPath) {
      return true;
    }

    const oldParent = mountState.directoryHandles.get(getParentPath(oldPath));
    const newParent = mountState.directoryHandles.get(getParentPath(newPath));
    const oldName = oldPath.split('/').pop();
    const newName = newPath.split('/').pop();
    if (!oldParent?.removeEntry || !newParent || !oldName || !newName) {
      return false;
    }
    if (await browserDirectoryEntryExists(newParent, newName)) {
      throw new Error(`A browser-mounted entry already exists at "${newPath}".`);
    }
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectBrowserMounts[projectId] !== mountState) {
      return false;
    }

    const fileHandle = mountState.fileHandles.get(oldPath);
    if (fileHandle?.getFile && newParent.getFileHandle) {
      const file = await fileHandle.getFile();
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      if (this.projectBrowserMounts[projectId] !== mountState) {
        return false;
      }
      const createdHandle = await newParent.getFileHandle(newName, { create: true });
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      if (this.projectBrowserMounts[projectId] !== mountState) {
        return false;
      }
      if (!createdHandle.createWritable) {
        return false;
      }

      const writable = await createdHandle.createWritable();
      await copyBrowserFileSnapshot(file, writable);
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      if (this.projectBrowserMounts[projectId] !== mountState) {
        return false;
      }
      await oldParent.removeEntry(oldName);
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      if (this.projectBrowserMounts[projectId] !== mountState) {
        return false;
      }
      await this.refreshBrowserDirectory(projectId, getParentPath(oldPath), scope);
      if (getParentPath(newPath) !== getParentPath(oldPath)) {
        await this.refreshBrowserDirectory(projectId, getParentPath(newPath), scope);
      }
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      return this.projectBrowserMounts[projectId] === mountState;
    }

    const directoryHandle = mountState.directoryHandles.get(oldPath);
    if (directoryHandle && newParent.getDirectoryHandle) {
      const nextDirectory = await newParent.getDirectoryHandle(newName, { create: true });
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      if (this.projectBrowserMounts[projectId] !== mountState) {
        return false;
      }
      await this.copyBrowserDirectoryContents(projectId, mountState, scope, directoryHandle, nextDirectory);
      await oldParent.removeEntry(oldName, { recursive: true });
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      if (this.projectBrowserMounts[projectId] !== mountState) {
        return false;
      }
      await this.refreshBrowserDirectory(projectId, getParentPath(oldPath), scope);
      if (getParentPath(newPath) !== getParentPath(oldPath)) {
        await this.refreshBrowserDirectory(projectId, getParentPath(newPath), scope);
      }
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      return this.projectBrowserMounts[projectId] === mountState;
    }

    return false;
  }

  private async renameTauriMountedNode(
    projectId: string,
    oldPath: string,
    newPath: string,
    scope: MountedProjectSubjectScope,
  ): Promise<boolean> {
    if (!this.isProjectMountOwnedByScope(projectId, scope)) {
      return false;
    }

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
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    if (this.projectTauriMounts[projectId] !== mountState) {
      return false;
    }
    await this.refreshTauriDirectory(projectId, getParentPath(oldPath), scope);
    if (getParentPath(newPath) !== getParentPath(oldPath)) {
      await this.refreshTauriDirectory(projectId, getParentPath(newPath), scope);
    }
    await this.assertMountedProjectSubjectScopeCurrent(scope);
    return this.projectTauriMounts[projectId] === mountState;
  }

  private async copyBrowserDirectoryContents(
    projectId: string,
    mountState: BrowserMountState,
    scope: MountedProjectSubjectScope,
    sourceDirectory: BrowserDirectoryHandleLike,
    targetDirectory: BrowserDirectoryHandleLike,
  ): Promise<void> {
    for await (const entry of listBrowserDirectoryEntries(sourceDirectory)) {
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      if (this.projectBrowserMounts[projectId] !== mountState) {
        throw new Error('The active session changed while copying the device-local project folder.');
      }

      if (isBrowserDirectoryHandle(entry)) {
        if (!targetDirectory.getDirectoryHandle) {
          throw new Error('Target directory handle does not support creating child directories.');
        }

        const nextTarget = await targetDirectory.getDirectoryHandle(entry.name, { create: true });
        await this.assertMountedProjectSubjectScopeCurrent(scope);
        if (this.projectBrowserMounts[projectId] !== mountState) {
          throw new Error('The active session changed while copying the device-local project folder.');
        }
        await this.copyBrowserDirectoryContents(projectId, mountState, scope, entry, nextTarget);
        continue;
      }

      if (!targetDirectory.getFileHandle) {
        throw new Error('Target directory handle does not support creating child files.');
      }

      const file = await entry.getFile();
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      if (this.projectBrowserMounts[projectId] !== mountState) {
        throw new Error('The active session changed while copying the device-local project folder.');
      }
      const nextFile = await targetDirectory.getFileHandle(entry.name, { create: true });
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      if (this.projectBrowserMounts[projectId] !== mountState) {
        throw new Error('The active session changed while copying the device-local project folder.');
      }
      if (!nextFile.createWritable) {
        throw new Error('Target file handle does not support writing.');
      }

      const writable = await nextFile.createWritable();
      await copyBrowserFileSnapshot(file, writable);
      await this.assertMountedProjectSubjectScopeCurrent(scope);
      if (this.projectBrowserMounts[projectId] !== mountState) {
        throw new Error('The active session changed while copying the device-local project folder.');
      }
    }
  }

  private isBrowserMountedPath(
    projectId: string,
    path: string,
    scope: MountedProjectSubjectScope,
  ): boolean {
    const mountState = this.projectBrowserMounts[projectId];
    return (
      this.isProjectMountOwnedByScope(projectId, scope) &&
      !!mountState &&
      isPathWithinRoot(mountState.rootPath, path)
    );
  }

  private isTauriMountedPath(
    projectId: string,
    path: string,
    scope: MountedProjectSubjectScope,
  ): boolean {
    const mountState = this.projectTauriMounts[projectId];
    return (
      this.isProjectMountOwnedByScope(projectId, scope) &&
      !!mountState &&
      isPathWithinRoot(mountState.rootVirtualPath, path)
    );
  }
}
