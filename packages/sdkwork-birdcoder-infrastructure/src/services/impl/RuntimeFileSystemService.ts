import {
  searchProjectFiles,
  type IFileNode,
  type LocalFolderMountSource,
  type WorkspaceFileSearchExecutionResult,
  type WorkspaceFileSearchOptions,
} from '@sdkwork/birdcoder-types';
import {
  createBirdCoderTauriFileSystemRuntime,
  type BirdCoderTauriFileSystemRuntime,
} from '../../platform/tauriFileSystemRuntime.ts';
import type { IFileSystemService } from '../interfaces/IFileSystemService.ts';

interface BrowserWritableLike {
  close(): Promise<void>;
  write(data: string): Promise<void>;
}

interface BrowserFileLike {
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
  cachedTree?: IFileNode[];
  directoryHandles: Map<string, BrowserDirectoryHandleLike>;
  fileHandles: Map<string, BrowserFileHandleLike>;
  rootHandle: BrowserDirectoryHandleLike;
  rootPath: string;
  tree: IFileNode;
}

interface TauriMountState {
  cachedTree?: IFileNode[];
  rootSystemPath: string;
  rootVirtualPath: string;
  tree: IFileNode;
}

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

  if (typeof handle[Symbol.asyncIterator] === 'function') {
    for await (const entry of handle[Symbol.asyncIterator]()) {
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

export class RuntimeFileSystemService implements IFileSystemService {
  private readonly projectBrowserMounts: Record<string, BrowserMountState> = {};
  private readonly projectTauriMounts: Record<string, TauriMountState> = {};
  private readonly tauriRuntime: BirdCoderTauriFileSystemRuntime;
  private readonly projectFileContent: Record<string, Record<string, string>> = {};

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
    const files = await this.getFiles(projectId);
    return searchProjectFiles({
      files,
      query: options.query,
      maxResults: options.maxResults,
      maxSnippetLength: options.maxSnippetLength,
      signal: options.signal,
      readFileContent: async (path: string) => {
        try {
          return await this.getFileContent(projectId, path);
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
        return;
      }

      const mountState = await this.buildBrowserMountState(
        folderInfo.handle as unknown as BrowserDirectoryHandleLike,
      );
      this.projectBrowserMounts[projectId] = mountState;
      delete this.projectTauriMounts[projectId];
      this.projectFileContent[projectId] = {};
      return;
    }

    const existingTauriMount = this.projectTauriMounts[projectId];
    if (
      existingTauriMount &&
      normalizeComparableLocalFolderPath(existingTauriMount.rootSystemPath) ===
        normalizeComparableLocalFolderPath(folderInfo.path)
    ) {
      delete this.projectBrowserMounts[projectId];
      return;
    }

    const mountState = await this.buildTauriMountState(folderInfo.path);
    this.projectTauriMounts[projectId] = mountState;
    delete this.projectBrowserMounts[projectId];
    this.projectFileContent[projectId] = {};
  }

  private async buildBrowserMountState(
    rootHandle: BrowserDirectoryHandleLike,
  ): Promise<BrowserMountState> {
    const rootPath = `/${rootHandle.name}`;
    const directoryHandles = new Map<string, BrowserDirectoryHandleLike>();
    const fileHandles = new Map<string, BrowserFileHandleLike>();
    const tree = await this.snapshotBrowserDirectory(
      rootHandle,
      rootPath,
      directoryHandles,
      fileHandles,
    );

    return {
      directoryHandles,
      fileHandles,
      rootHandle,
      rootPath,
      tree,
    };
  }

  private async snapshotBrowserDirectory(
    handle: BrowserDirectoryHandleLike,
    directoryPath: string,
    directoryHandles: Map<string, BrowserDirectoryHandleLike>,
    fileHandles: Map<string, BrowserFileHandleLike>,
  ): Promise<IFileNode> {
    directoryHandles.set(directoryPath, handle);
    const children: IFileNode[] = [];

    for await (const entry of listBrowserDirectoryEntries(handle)) {
      const childPath = buildChildPath(directoryPath, entry.name);
      if (isBrowserDirectoryHandle(entry)) {
        children.push(
          await this.snapshotBrowserDirectory(entry, childPath, directoryHandles, fileHandles),
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

    return {
      name: handle.name,
      type: 'directory',
      path: directoryPath,
      children: sortFileNodes(children),
    };
  }

  private async refreshBrowserMount(projectId: string): Promise<void> {
    const mountState = this.projectBrowserMounts[projectId];
    if (!mountState) {
      return;
    }

    this.projectBrowserMounts[projectId] = await this.buildBrowserMountState(mountState.rootHandle);
  }

  private async buildTauriMountState(rootSystemPath: string): Promise<TauriMountState> {
    const snapshot = await this.tauriRuntime.snapshotFolder(rootSystemPath);
    return {
      rootSystemPath,
      rootVirtualPath: snapshot.rootVirtualPath,
      tree: snapshot.tree,
    };
  }

  private async refreshTauriMount(projectId: string): Promise<void> {
    const mountState = this.projectTauriMounts[projectId];
    if (!mountState) {
      return;
    }

    this.projectTauriMounts[projectId] = await this.buildTauriMountState(mountState.rootSystemPath);
  }

  private async readBrowserMountedFileContent(
    projectId: string,
    path: string,
  ): Promise<string | null> {
    const mountState = this.projectBrowserMounts[projectId];
    const fileHandle = mountState?.fileHandles.get(path);
    if (!fileHandle) {
      return null;
    }

    const file = await fileHandle.getFile();
    const content = await file.text();
    this.projectFileContent[projectId] ??= {};
    this.projectFileContent[projectId][path] = content;
    return content;
  }

  private async readTauriMountedFileContent(projectId: string, path: string): Promise<string | null> {
    const mountState = this.projectTauriMounts[projectId];
    if (!mountState || !isPathWithinRoot(mountState.rootVirtualPath, path, false)) {
      return null;
    }

    const content = await this.tauriRuntime.readFile(
      mountState.rootSystemPath,
      mountState.rootVirtualPath,
      path,
    );
    this.projectFileContent[projectId] ??= {};
    this.projectFileContent[projectId][path] = content;
    return content;
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
    await this.refreshBrowserMount(projectId);
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
    await this.refreshBrowserMount(projectId);
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
    await this.refreshTauriMount(projectId);
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
    await this.refreshBrowserMount(projectId);
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
    await this.refreshTauriMount(projectId);
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
    await this.refreshBrowserMount(projectId);
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
    await this.refreshTauriMount(projectId);
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
      await this.refreshBrowserMount(projectId);
      return true;
    }

    const directoryHandle = mountState.directoryHandles.get(oldPath);
    if (directoryHandle && newParent.getDirectoryHandle) {
      const nextDirectory = await newParent.getDirectoryHandle(newName, { create: true });
      await this.copyBrowserDirectoryContents(directoryHandle, nextDirectory);
      await oldParent.removeEntry(oldName, { recursive: true });
      await this.refreshBrowserMount(projectId);
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
    await this.refreshTauriMount(projectId);
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
