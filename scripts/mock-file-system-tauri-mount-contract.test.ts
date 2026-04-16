import assert from 'node:assert/strict';

import type { IFileNode } from '../packages/sdkwork-birdcoder-types/src/index.ts';
import { MockFileSystemService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/MockFileSystemService.ts';

type TauriSnapshot = IFileNode;

interface FakeTauriRuntime {
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
  snapshotFolder(rootSystemPath: string): Promise<{ rootVirtualPath: string; tree: TauriSnapshot }>;
  writeFile(
    rootSystemPath: string,
    rootVirtualPath: string,
    mountedPath: string,
    content: string,
  ): Promise<void>;
}

function cloneTree(node: TauriSnapshot): TauriSnapshot {
  return structuredClone(node);
}

function sortNodes(nodes: IFileNode[]): void {
  nodes.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'directory' ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

function buildChildPath(parentPath: string, name: string): string {
  return parentPath === '/' ? `/${name}` : `${parentPath}/${name}`;
}

function findNode(node: IFileNode, path: string): IFileNode | null {
  if (node.path === path) {
    return node;
  }

  if (node.type !== 'directory' || !node.children) {
    return null;
  }

  for (const child of node.children) {
    const found = findNode(child, path);
    if (found) {
      return found;
    }
  }

  return null;
}

function findParentNode(root: IFileNode, path: string): IFileNode | null {
  const separatorIndex = path.lastIndexOf('/');
  if (separatorIndex <= 0) {
    return root;
  }

  return findNode(root, path.slice(0, separatorIndex));
}

function addNode(root: IFileNode, path: string, type: IFileNode['type']): void {
  const parent = findParentNode(root, path);
  assert.ok(parent && parent.type === 'directory', `parent directory must exist for ${path}`);
  parent.children ??= [];
  const name = path.split('/').pop()!;
  parent.children.push(type === 'directory' ? { name, type, path, children: [] } : { name, type, path });
  sortNodes(parent.children);
}

function removeNode(root: IFileNode, path: string): void {
  const parent = findParentNode(root, path);
  assert.ok(parent && parent.type === 'directory' && parent.children, `parent directory must exist for ${path}`);
  const index = parent.children.findIndex((child) => child.path === path);
  assert.ok(index >= 0, `${path} must exist before removal`);
  parent.children.splice(index, 1);
}

function updateDescendantPaths(node: IFileNode): void {
  if (node.type !== 'directory' || !node.children) {
    return;
  }

  for (const child of node.children) {
    child.path = buildChildPath(node.path, child.name);
    updateDescendantPaths(child);
  }
}

function renameNode(root: IFileNode, oldPath: string, newPath: string): void {
  const node = findNode(root, oldPath);
  assert.ok(node, `${oldPath} must exist before rename`);
  removeNode(root, oldPath);
  node.name = newPath.split('/').pop()!;
  node.path = newPath;
  updateDescendantPaths(node);
  const parent = findParentNode(root, newPath);
  assert.ok(parent && parent.type === 'directory', `parent directory must exist for ${newPath}`);
  parent.children ??= [];
  parent.children.push(node);
  sortNodes(parent.children);
}

const rootSystemPath = 'D:\\repos\\sample-app';
const rootVirtualPath = '/sample-app';
let currentTree: TauriSnapshot = {
  name: 'sample-app',
  type: 'directory',
  path: rootVirtualPath,
  children: [
    {
      name: 'src',
      type: 'directory',
      path: '/sample-app/src',
      children: [
        {
          name: 'main.ts',
          type: 'file',
          path: '/sample-app/src/main.ts',
        },
      ],
    },
    {
      name: 'package.json',
      type: 'file',
      path: '/sample-app/package.json',
    },
  ],
};
const fileContent = new Map<string, string>([
  ['/sample-app/package.json', '{\n  "name": "sample-app"\n}'],
  ['/sample-app/src/main.ts', 'console.log("sample-app");'],
]);
const observedOperations: string[] = [];

const service = new MockFileSystemService({
  tauriRuntime: {
    async snapshotFolder(requestedRootSystemPath) {
      observedOperations.push(`snapshot:${requestedRootSystemPath}`);
      assert.equal(requestedRootSystemPath, rootSystemPath);
      return {
        rootVirtualPath,
        tree: cloneTree(currentTree),
      };
    },
    async readFile(requestedRootSystemPath, requestedRootVirtualPath, mountedPath) {
      observedOperations.push(`read:${mountedPath}`);
      assert.equal(requestedRootSystemPath, rootSystemPath);
      assert.equal(requestedRootVirtualPath, rootVirtualPath);
      const content = fileContent.get(mountedPath);
      assert.notEqual(content, undefined, `${mountedPath} must be readable from the tauri runtime adapter`);
      return content!;
    },
    async writeFile(requestedRootSystemPath, requestedRootVirtualPath, mountedPath, content) {
      observedOperations.push(`write:${mountedPath}`);
      assert.equal(requestedRootSystemPath, rootSystemPath);
      assert.equal(requestedRootVirtualPath, rootVirtualPath);
      fileContent.set(mountedPath, content);
    },
    async createFile(requestedRootSystemPath, requestedRootVirtualPath, mountedPath) {
      observedOperations.push(`create-file:${mountedPath}`);
      assert.equal(requestedRootSystemPath, rootSystemPath);
      assert.equal(requestedRootVirtualPath, rootVirtualPath);
      addNode(currentTree, mountedPath, 'file');
      fileContent.set(mountedPath, '');
    },
    async createDirectory(requestedRootSystemPath, requestedRootVirtualPath, mountedPath) {
      observedOperations.push(`create-directory:${mountedPath}`);
      assert.equal(requestedRootSystemPath, rootSystemPath);
      assert.equal(requestedRootVirtualPath, rootVirtualPath);
      addNode(currentTree, mountedPath, 'directory');
    },
    async deleteEntry(requestedRootSystemPath, requestedRootVirtualPath, mountedPath, options) {
      observedOperations.push(`delete:${mountedPath}:${options?.recursive === true ? 'recursive' : 'single'}`);
      assert.equal(requestedRootSystemPath, rootSystemPath);
      assert.equal(requestedRootVirtualPath, rootVirtualPath);
      removeNode(currentTree, mountedPath);
      fileContent.delete(mountedPath);
    },
    async renameEntry(
      requestedRootSystemPath,
      requestedRootVirtualPath,
      oldMountedPath,
      newMountedPath,
    ) {
      observedOperations.push(`rename:${oldMountedPath}->${newMountedPath}`);
      assert.equal(requestedRootSystemPath, rootSystemPath);
      assert.equal(requestedRootVirtualPath, rootVirtualPath);
      renameNode(currentTree, oldMountedPath, newMountedPath);
      const existingContent = fileContent.get(oldMountedPath);
      if (existingContent !== undefined) {
        fileContent.set(newMountedPath, existingContent);
        fileContent.delete(oldMountedPath);
      }
    },
  } satisfies FakeTauriRuntime,
} as any);

await service.mountFolder('project-mounted-tauri-folder', {
  type: 'tauri',
  path: rootSystemPath,
});

assert.deepEqual(
  await service.getFiles('project-mounted-tauri-folder'),
  [cloneTree(currentTree)],
  'tauri folder mounts must materialize the actual project tree instead of rejecting desktop path imports.',
);
assert.equal(
  await service.getFileContent('project-mounted-tauri-folder', '/sample-app/package.json'),
  '{\n  "name": "sample-app"\n}',
  'tauri mounted files should be readable through the editor file-system service.',
);

await service.saveFileContent(
  'project-mounted-tauri-folder',
  '/sample-app/src/main.ts',
  'console.log("desktop-mounted");',
);
assert.equal(
  await service.getFileContent('project-mounted-tauri-folder', '/sample-app/src/main.ts'),
  'console.log("desktop-mounted");',
  'tauri mounted file edits must persist through the desktop runtime adapter.',
);

await service.createFolder('project-mounted-tauri-folder', '/sample-app/assets');
await service.createFile('project-mounted-tauri-folder', '/sample-app/assets/logo.txt');
await service.renameNode(
  'project-mounted-tauri-folder',
  '/sample-app/assets/logo.txt',
  '/sample-app/assets/brand.txt',
);
await service.deleteFile('project-mounted-tauri-folder', '/sample-app/assets/brand.txt');

assert.deepEqual(observedOperations, [
  'snapshot:D:\\repos\\sample-app',
  'read:/sample-app/package.json',
  'write:/sample-app/src/main.ts',
  'read:/sample-app/src/main.ts',
  'create-directory:/sample-app/assets',
  'snapshot:D:\\repos\\sample-app',
  'create-file:/sample-app/assets/logo.txt',
  'snapshot:D:\\repos\\sample-app',
  'rename:/sample-app/assets/logo.txt->/sample-app/assets/brand.txt',
  'snapshot:D:\\repos\\sample-app',
  'delete:/sample-app/assets/brand.txt:single',
  'snapshot:D:\\repos\\sample-app',
], 'tauri-mounted file operations must route through the desktop runtime adapter.');

console.log('mock file system tauri mount contract passed.');
