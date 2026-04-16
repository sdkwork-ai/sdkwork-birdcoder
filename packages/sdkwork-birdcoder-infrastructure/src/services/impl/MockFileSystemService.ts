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

const MOCK_FILES: IFileNode[] = [
  { name: '.env.example', type: 'file', path: '/.env.example' },
  { name: '.gitignore', type: 'file', path: '/.gitignore' },
  { name: 'index.html', type: 'file', path: '/index.html' },
  { name: 'metadata.json', type: 'file', path: '/metadata.json' },
  { name: 'package-lock.json', type: 'file', path: '/package-lock.json' },
  { name: 'package.json', type: 'file', path: '/package.json' },
  { 
    name: 'packages', 
    type: 'directory', 
    path: '/packages',
    children: [
      {
        name: 'sdkwork-birdcoder-code',
        type: 'directory',
        path: '/packages/sdkwork-birdcoder-code',
        children: [
          {
            name: 'src',
            type: 'directory',
            path: '/packages/sdkwork-birdcoder-code/src',
            children: [
              { name: 'index.ts', type: 'file', path: '/packages/sdkwork-birdcoder-code/src/index.ts' },
              {
                name: 'pages',
                type: 'directory',
                path: '/packages/sdkwork-birdcoder-code/src/pages',
                children: [
                  { name: 'CodePage.tsx', type: 'file', path: '/packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx' }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  {
    name: 'src',
    type: 'directory',
    path: '/src',
    children: [
      { name: 'App.tsx', type: 'file', path: '/src/App.tsx' },
      { name: 'index.css', type: 'file', path: '/src/index.css' },
      { name: 'main.tsx', type: 'file', path: '/src/main.tsx' }
    ]
  },
  { name: 'tsconfig.json', type: 'file', path: '/tsconfig.json' },
  { name: 'vite.config.ts', type: 'file', path: '/vite.config.ts' }
];

const MOCK_FILE_CONTENT: Record<string, string> = {
  '/.env.example': 'GEMINI_API_KEY=\nAPP_URL=',
  '/.gitignore': 'node_modules\ndist\n.env',
  '/index.html': '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Vite + React + TS</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>',
  '/metadata.json': '{\n  "name": "",\n  "description": "",\n  "requestFramePermissions": []\n}',
  '/package.json': '{\n  "name": "sdkwork-birdcoder-workspace",\n  "private": true,\n  "version": "0.1.0",\n  "type": "module",\n  "scripts": {\n    "dev": "vite",\n    "build": "tsc && vite build",\n    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",\n    "preview": "vite preview"\n  }\n}',
  '/src/App.tsx': 'import React from "react";\n\nexport default function App() {\n  return <div>Hello World</div>;\n}',
  '/src/index.css': '@tailwind base;\n@tailwind components;\n@tailwind utilities;',
  '/src/main.tsx': 'import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App.tsx";\nimport "./index.css";\n\nReactDOM.createRoot(document.getElementById("root")!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);',
  '/tsconfig.json': '{\n  "compilerOptions": {\n    "target": "ES2020",\n    "useDefineForClassFields": true,\n    "lib": ["ES2020", "DOM", "DOM.Iterable"],\n    "module": "ESNext",\n    "skipLibCheck": true,\n    "moduleResolution": "bundler",\n    "allowImportingTsExtensions": true,\n    "resolveJsonModule": true,\n    "isolatedModules": true,\n    "noEmit": true,\n    "jsx": "react-jsx",\n    "strict": true,\n    "noUnusedLocals": true,\n    "noUnusedParameters": true,\n    "noFallthroughCasesInSwitch": true\n  },\n  "include": ["src"],\n  "references": [{ "path": "./tsconfig.node.json" }]\n}',
  '/vite.config.ts': 'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({\n  plugins: [react()],\n});'
};

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
  directoryHandles: Map<string, BrowserDirectoryHandleLike>;
  fileHandles: Map<string, BrowserFileHandleLike>;
  rootHandle: BrowserDirectoryHandleLike;
  rootPath: string;
  tree: IFileNode;
}

interface TauriMountState {
  rootSystemPath: string;
  rootVirtualPath: string;
  tree: IFileNode;
}

export interface MockFileSystemServiceOptions {
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

export class MockFileSystemService implements IFileSystemService {
  private readonly projectBrowserMounts: Record<string, BrowserMountState> = {};
  private readonly projectTauriMounts: Record<string, TauriMountState> = {};
  private readonly tauriRuntime: BirdCoderTauriFileSystemRuntime;
  private projectFiles: Record<string, IFileNode[]> = {
    p1: [...MOCK_FILES],
  };
  private projectFileContent: Record<string, Record<string, string>> = {
    p1: { ...MOCK_FILE_CONTENT },
  };

  constructor(options: MockFileSystemServiceOptions = {}) {
    this.tauriRuntime = options.tauriRuntime ?? createBirdCoderTauriFileSystemRuntime();
  }

  async getFiles(projectId: string): Promise<IFileNode[]> {
    return this.projectFiles[projectId] || [];
  }

  async getFileContent(projectId: string, path: string): Promise<string> {
    if (this.isBrowserMountedPath(projectId, path)) {
      const mountedContent = await this.readBrowserMountedFileContent(projectId, path);
      return mountedContent ?? '// File content not found';
    }

    if (this.isTauriMountedPath(projectId, path)) {
      const mountedContent = await this.readTauriMountedFileContent(projectId, path);
      return mountedContent ?? '// File content not found';
    }

    const contentMap = this.projectFileContent[projectId] || {};
    if (contentMap[path] !== undefined) {
      return contentMap[path];
    }

    return '// File content not found';
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

    this.projectFiles[projectId] ??= [];
    if (!this.projectFileContent[projectId]) {
      this.projectFileContent[projectId] = {};
    }
    this.projectFileContent[projectId][path] = content;

    const tree = this.projectFiles[projectId];
    if (tree) {
      const pathParts = path.split('/').filter(Boolean);
      const fileName = pathParts[pathParts.length - 1];
      this.addNodeToTree(tree, pathParts, {
        name: fileName,
        type: 'file',
        path,
      });
    }
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

    if (!this.projectFiles[projectId]) {
      this.projectFiles[projectId] = [];
    }
    if (!this.projectFileContent[projectId]) {
      this.projectFileContent[projectId] = {};
    }

    const parts = path.split('/').filter(Boolean);
    const fileName = parts[parts.length - 1];
    this.addNodeToTree(this.projectFiles[projectId], parts, {
      name: fileName,
      type: 'file',
      path,
    });
    this.projectFileContent[projectId][path] = '';
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

    if (!this.projectFiles[projectId]) {
      this.projectFiles[projectId] = [];
    }

    const parts = path.split('/').filter(Boolean);
    const folderName = parts[parts.length - 1];
    this.addNodeToTree(this.projectFiles[projectId], parts, {
      name: folderName,
      type: 'directory',
      path,
      children: [],
    });
  }

  async deleteFile(projectId: string, path: string): Promise<void> {
    if (!this.projectFiles[projectId]) {
      return;
    }

    if (this.isBrowserMountedPath(projectId, path)) {
      if (!(await this.deleteBrowserMountedEntry(projectId, path, false))) {
        throw new Error(`Unable to delete browser-mounted file "${path}".`);
      }
      return;
    }

    if (this.isTauriMountedPath(projectId, path)) {
      if (!(await this.deleteTauriMountedEntry(projectId, path, false))) {
        throw new Error(`Unable to delete desktop-mounted file "${path}".`);
      }
      return;
    }

    const parts = path.split('/').filter(Boolean);
    this.removeNodeFromTree(this.projectFiles[projectId], parts);
    deleteStoredPathContent(this.projectFileContent[projectId], path, false);
  }

  async deleteFolder(projectId: string, path: string): Promise<void> {
    if (!this.projectFiles[projectId]) {
      return;
    }

    if (this.isBrowserMountedPath(projectId, path)) {
      if (!(await this.deleteBrowserMountedEntry(projectId, path, true))) {
        throw new Error(`Unable to delete browser-mounted directory "${path}".`);
      }
      return;
    }

    if (this.isTauriMountedPath(projectId, path)) {
      if (!(await this.deleteTauriMountedEntry(projectId, path, true))) {
        throw new Error(`Unable to delete desktop-mounted directory "${path}".`);
      }
      return;
    }

    const parts = path.split('/').filter(Boolean);
    this.removeNodeFromTree(this.projectFiles[projectId], parts);
    deleteStoredPathContent(this.projectFileContent[projectId], path, true);
  }

  async renameNode(projectId: string, oldPath: string, newPath: string): Promise<void> {
    if (!this.projectFiles[projectId]) {
      return;
    }

    if (this.isBrowserMountedPath(projectId, oldPath) || this.isBrowserMountedPath(projectId, newPath)) {
      if (!(await this.renameBrowserMountedNode(projectId, oldPath, newPath))) {
        throw new Error(
          `Unable to rename browser-mounted entry from "${oldPath}" to "${newPath}".`,
        );
      }
      return;
    }

    if (this.isTauriMountedPath(projectId, oldPath) || this.isTauriMountedPath(projectId, newPath)) {
      if (!(await this.renameTauriMountedNode(projectId, oldPath, newPath))) {
        throw new Error(
          `Unable to rename desktop-mounted entry from "${oldPath}" to "${newPath}".`,
        );
      }
      return;
    }

    const oldParts = oldPath.split('/').filter(Boolean);
    const newParts = newPath.split('/').filter(Boolean);
    const newName = newParts[newParts.length - 1];

    this.renameNodeInTree(this.projectFiles[projectId], oldParts, newName, newPath);

    renameStoredPathContent(this.projectFileContent[projectId], oldPath, newPath);
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
        const content = await this.getFileContent(projectId, path);
        return content === '// File content not found' ? '' : content;
      },
    });
  }

  async mountFolder(projectId: string, folderInfo: LocalFolderMountSource): Promise<void> {
    if (folderInfo.type === 'browser') {
      const mountState = await this.buildBrowserMountState(
        folderInfo.handle as unknown as BrowserDirectoryHandleLike,
      );
      this.projectBrowserMounts[projectId] = mountState;
      delete this.projectTauriMounts[projectId];
      this.projectFiles[projectId] = [mountState.tree];
      this.projectFileContent[projectId] = {};
      return;
    }

    const mountState = await this.buildTauriMountState(folderInfo.path);
    this.projectTauriMounts[projectId] = mountState;
    delete this.projectBrowserMounts[projectId];
    this.projectFiles[projectId] = [mountState.tree];
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

    const refreshedMountState = await this.buildBrowserMountState(mountState.rootHandle);
    this.projectBrowserMounts[projectId] = refreshedMountState;
    this.projectFiles[projectId] = [refreshedMountState.tree];
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

    const refreshedMountState = await this.buildTauriMountState(mountState.rootSystemPath);
    this.projectTauriMounts[projectId] = refreshedMountState;
    this.projectFiles[projectId] = [refreshedMountState.tree];
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
    if (!this.projectFileContent[projectId]) {
      this.projectFileContent[projectId] = {};
    }
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
    delete this.projectFileContent[projectId][path];
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
    deleteStoredPathContent(this.projectFileContent[projectId], path, recursive);
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
    renameStoredPathContent(this.projectFileContent[projectId], oldPath, newPath);
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

  private addNodeToTree(
    nodes: IFileNode[],
    pathParts: string[],
    nodeToAdd: IFileNode,
    currentPath = '',
  ): boolean {
    if (pathParts.length === 1) {
      const existingIndex = nodes.findIndex((node) => node.name === nodeToAdd.name);
      if (existingIndex >= 0) {
        nodes[existingIndex] = nodeToAdd;
      } else {
        nodes.push(nodeToAdd);
      }
      sortFileNodes(nodes);
      return true;
    }

    const directoryName = pathParts[0];
    const nextPath = `${currentPath}/${directoryName}`;
    let directoryNode = nodes.find(
      (node) => node.name === directoryName && node.type === 'directory',
    );

    if (!directoryNode) {
      directoryNode = {
        name: directoryName,
        type: 'directory',
        path: nextPath,
        children: [],
      };
      nodes.push(directoryNode);
      sortFileNodes(nodes);
    }

    if (!directoryNode.children) {
      directoryNode.children = [];
    }

    return this.addNodeToTree(directoryNode.children, pathParts.slice(1), nodeToAdd, nextPath);
  }

  private removeNodeFromTree(nodes: IFileNode[], pathParts: string[]): boolean {
    if (pathParts.length === 1) {
      const index = nodes.findIndex((node) => node.name === pathParts[0]);
      if (index >= 0) {
        nodes.splice(index, 1);
        return true;
      }
      return false;
    }

    const directoryName = pathParts[0];
    const directoryNode = nodes.find(
      (node) => node.name === directoryName && node.type === 'directory',
    );
    if (directoryNode?.children) {
      return this.removeNodeFromTree(directoryNode.children, pathParts.slice(1));
    }

    return false;
  }

  private renameNodeInTree(
    nodes: IFileNode[],
    pathParts: string[],
    newName: string,
    newPath: string,
  ): boolean {
    if (pathParts.length === 1) {
      const node = nodes.find((candidate) => candidate.name === pathParts[0]);
      if (!node) {
        return false;
      }

      node.name = newName;
      node.path = newPath;
      if (node.type === 'directory' && node.children) {
        this.updateChildrenPaths(node.children, newPath);
      }
      sortFileNodes(nodes);
      return true;
    }

    const directoryName = pathParts[0];
    const directoryNode = nodes.find(
      (candidate) => candidate.name === directoryName && candidate.type === 'directory',
    );
    if (directoryNode?.children) {
      return this.renameNodeInTree(directoryNode.children, pathParts.slice(1), newName, newPath);
    }

    return false;
  }

  private updateChildrenPaths(nodes: IFileNode[], parentPath: string): void {
    for (const node of nodes) {
      node.path = buildChildPath(parentPath, node.name);
      if (node.type === 'directory' && node.children) {
        this.updateChildrenPaths(node.children, node.path);
      }
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
