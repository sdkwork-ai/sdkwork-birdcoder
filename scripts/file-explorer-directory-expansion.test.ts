import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import type {
  SandboxEntry,
  SandboxExplorerPort,
} from '@sdkwork/drive-pc-sandbox-contracts';
import type { IFileNode } from '@sdkwork/birdcoder-pc-contracts-commons';
import { DriveSandboxProjectFileSystemService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/DriveSandboxProjectFileSystemService.ts';
import {
  relocateNodeInTree,
  removeNodeFromTree,
  replaceDirectoryInTree,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/driveSandboxProjectPaths.ts';
import {
  collapseFileExplorerSearchFolders,
  resolveFileExplorerExpandedFolders,
  setFileExplorerFolderExpanded,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/fileExplorerExpansionState.ts';

const nestedFile: IFileNode = {
  name: 'nested.ts',
  path: '/birdcoder/src/nested/nested.ts',
  type: 'file',
};
const nestedDirectory: IFileNode = {
  name: 'nested',
  path: '/birdcoder/src/nested',
  type: 'directory',
  children: [nestedFile],
};
const sourceDirectory: IFileNode = {
  name: 'src',
  path: '/birdcoder/src',
  type: 'directory',
  children: [nestedDirectory],
};
const docsDirectory: IFileNode = {
  name: 'docs',
  path: '/birdcoder/docs',
  type: 'directory',
  children: [],
};
const initialTree: IFileNode[] = [{
  name: 'birdcoder',
  path: '/birdcoder',
  type: 'directory',
  children: [sourceDirectory, docsDirectory],
}];

const refreshedTree = replaceDirectoryInTree(initialTree, {
  name: 'src',
  path: '/birdcoder/src',
  type: 'directory',
  children: [{
    name: 'nested',
    path: '/birdcoder/src/nested',
    type: 'directory',
  }],
});
const refreshedSource = refreshedTree[0]!.children![0]!;
assert.equal(refreshedTree, initialTree);
assert.equal(refreshedTree[0]!.children![1], docsDirectory);
assert.equal(refreshedSource, sourceDirectory);
assert.equal(refreshedSource.children![0]!.children, nestedDirectory.children);
assert.equal(removeNodeFromTree(initialTree, '/birdcoder/missing'), initialTree);

const relocatedTree = relocateNodeInTree(
  initialTree,
  '/birdcoder/src/nested',
  '/birdcoder/docs',
  {
    name: 'renamed',
    path: '/birdcoder/docs/renamed',
    type: 'directory',
  },
);
const relocatedDirectory = relocatedTree[0]!.children!
  .find((node) => node.path === '/birdcoder/docs')!
  .children![0]!;
assert.equal(relocatedDirectory.path, '/birdcoder/docs/renamed');
assert.equal(relocatedDirectory.children![0]!.path, '/birdcoder/docs/renamed/nested.ts');

const searchDefaults = { '/birdcoder': true, '/birdcoder/src': true };
const collapsedSearch = collapseFileExplorerSearchFolders(searchDefaults);
assert.deepEqual(collapsedSearch, { '/birdcoder': false, '/birdcoder/src': false });
assert.deepEqual(resolveFileExplorerExpandedFolders({
  expandedFolders: { '/birdcoder': true },
  searchActive: true,
  searchExpandedFolders: searchDefaults,
  searchExpansionOverrides: setFileExplorerFolderExpanded(
    collapsedSearch,
    '/birdcoder/src',
    true,
  ),
}), { '/birdcoder': false, '/birdcoder/src': true });

let revision = 1;
const entry = (
  logicalPath: string,
  kind: SandboxEntry['kind'],
): SandboxEntry => ({
  id: `entry:${logicalPath}:${revision}`,
  kind,
  logicalPath,
  name: logicalPath.split('/').at(-1)!,
  parentId: null,
  revision: `revision:${revision++}`,
  sandboxId: 'drive-1',
});

const entries = new Map<string, SandboxEntry>([
  ['projects/birdcoder/src', entry('projects/birdcoder/src', 'directory')],
  ['projects/birdcoder/README.md', entry('projects/birdcoder/README.md', 'file')],
  ['projects/birdcoder/src/index.ts', entry('projects/birdcoder/src/index.ts', 'file')],
]);
const listChildrenCalls = new Map<string, number>();
const listChildren = (parentPath: string): SandboxEntry[] => {
  listChildrenCalls.set(parentPath, (listChildrenCalls.get(parentPath) ?? 0) + 1);
  const prefix = parentPath ? `${parentPath}/` : '';
  return [...entries.values()].filter((candidate) => {
    if (!candidate.logicalPath.startsWith(prefix)) return false;
    return !candidate.logicalPath.slice(prefix.length).includes('/');
  });
};
let nextListChildrenBarrier: ((parentPath: string) => Promise<void>) | null = null;
let nextListChildrenTransform:
  | ((items: readonly SandboxEntry[], parentPath: string) => readonly SandboxEntry[])
  | null = null;
let nextRepeatedListChildrenCursor: string | null = null;
let nextListChildrenError: Error | null = null;
let nextCreateFileBarrier: (() => Promise<void>) | null = null;

const drivePort: SandboxExplorerPort = {
  async listSandboxes() {
    return {
      items: [{
        capabilities: {
          browse: true,
          createDirectory: true,
          createFile: true,
          deleteEntry: true,
          moveEntry: true,
          readFile: true,
          selectDirectory: true,
          writeFile: true,
        },
        displayName: 'BirdCoder',
        id: 'drive-1',
        rootEntryId: 'root-entry',
      }],
      page: 1,
      pageSize: 200,
      totalItems: 1,
      totalPages: 1,
    };
  },
  async listChildren(input) {
    const listError = nextListChildrenError;
    nextListChildrenError = null;
    if (listError) throw listError;
    const listedItems = listChildren(input.parentPath);
    const transform = nextListChildrenTransform;
    nextListChildrenTransform = null;
    const items = transform ? transform(listedItems, input.parentPath) : listedItems;
    const barrier = nextListChildrenBarrier;
    nextListChildrenBarrier = null;
    await barrier?.(input.parentPath);
    const repeatedCursor = nextRepeatedListChildrenCursor;
    if (repeatedCursor && input.cursor === repeatedCursor) {
      nextRepeatedListChildrenCursor = null;
    }
    return {
      items,
      ...(repeatedCursor ? { nextCursor: repeatedCursor } : {}),
    };
  },
  async createDirectory(input) {
    const created = entry(`${input.parentPath}/${input.name}`, 'directory');
    entries.set(created.logicalPath, created);
    return created;
  },
  async createFile(input) {
    const barrier = nextCreateFileBarrier;
    nextCreateFileBarrier = null;
    await barrier?.();
    const created = entry(`${input.parentPath}/${input.name}`, 'file');
    entries.set(created.logicalPath, created);
    return created;
  },
  async deleteEntry(input) {
    for (const logicalPath of [...entries.keys()]) {
      if (logicalPath === input.logicalPath || logicalPath.startsWith(`${input.logicalPath}/`)) {
        entries.delete(logicalPath);
      }
    }
    return { accepted: true, resourceId: input.entryId, status: 'deleted' };
  },
  async moveEntry(input) {
    const current = entries.get(input.logicalPath)!;
    const destinationLogicalPath = `${input.destinationParentPath}/${input.destinationName}`;
    const movedEntries = [...entries.entries()].filter(([logicalPath]) =>
      logicalPath === input.logicalPath || logicalPath.startsWith(`${input.logicalPath}/`));
    for (const [logicalPath] of movedEntries) {
      entries.delete(logicalPath);
    }
    for (const [logicalPath, currentEntry] of movedEntries) {
      if (logicalPath === input.logicalPath) continue;
      const relocatedLogicalPath = `${destinationLogicalPath}${logicalPath.slice(input.logicalPath.length)}`;
      entries.set(relocatedLogicalPath, {
        ...currentEntry,
        logicalPath: relocatedLogicalPath,
      });
    }
    const moved = {
      ...current,
      logicalPath: destinationLogicalPath,
      name: input.destinationName,
      revision: `revision:${revision++}`,
    };
    entries.set(moved.logicalPath, moved);
    return moved;
  },
  async readFile(input) {
    return {
      checksumSha256: 'checksum',
      content: input.logicalPath,
      encoding: 'utf8',
      entry: entries.get(input.logicalPath)!,
      sizeBytes: '0',
    };
  },
  async updateFile(input) {
    const updated = {
      ...entries.get(input.logicalPath)!,
      revision: `revision:${revision++}`,
    };
    entries.set(updated.logicalPath, updated);
    return updated;
  },
};

const service = new DriveSandboxProjectFileSystemService({
  drivePort,
  projectService: {
    async getProjectDrive() {
      return {
        driveId: 'drive-1',
        logicalPath: 'projects/birdcoder',
        projectId: 'project-1',
        rootEntryId: 'root-entry',
        slotId: 'primary',
        version: '1',
      };
    },
  },
});

const rootTree = await service.getFiles('project-1');
assert.equal(listChildrenCalls.get('projects/birdcoder'), 1);
const expandedTree = await service.loadDirectory('project-1', '/birdcoder/src');
assert.equal(expandedTree[0]!.children![0]!.children![0]!.name, 'index.ts');
assert.equal(await service.getFiles('project-1'), expandedTree);
assert.equal(listChildrenCalls.get('projects/birdcoder'), 1);

await service.createFile('project-1', '/birdcoder/src/created.ts');
assert.equal(listChildrenCalls.get('projects/birdcoder/src'), 1);
assert.deepEqual(
  (await service.getFiles('project-1'))[0]!.children![0]!.children!.map((node) => node.name),
  ['created.ts', 'index.ts'],
);

await service.deleteFile('project-1', '/birdcoder/src/created.ts');
assert.equal(listChildrenCalls.get('projects/birdcoder/src'), 1);
assert.deepEqual(
  (await service.getFiles('project-1'))[0]!.children![0]!.children!.map((node) => node.name),
  ['index.ts'],
);

await service.createFile('project-1', '/birdcoder/src/canonical-delete.ts');
await service.deleteFile('project-1', ' /birdcoder/src//canonical-delete.ts ');
assert.equal(
  (await service.getFiles('project-1'))[0]!.children![0]!.children!
    .some((node) => node.name === 'canonical-delete.ts'),
  false,
  'Equivalent non-canonical paths must remove the canonical cache and tree entry.',
);

await service.renameNode(
  'project-1',
  '/birdcoder/src/index.ts',
  '/birdcoder/src/main.ts',
);
assert.equal(listChildrenCalls.get('projects/birdcoder/src'), 1);
assert.deepEqual(
  (await service.getFiles('project-1'))[0]!.children![0]!.children!.map((node) => node.name),
  ['main.ts'],
);

entries.set('projects/birdcoder/LICENSE', entry('projects/birdcoder/LICENSE', 'file'));
const refreshedRootTree = await service.refreshDirectory('project-1', '/birdcoder');
assert.equal(refreshedRootTree[0]!.children![0]!.children![0]!.name, 'main.ts');
assert.equal(refreshedRootTree[0]!.children!.at(-1)!.name, 'README.md');
assert.ok(refreshedRootTree[0]!.children!.some((node) => node.name === 'LICENSE'));
assert.notEqual(rootTree, refreshedRootTree);
assert.equal(
  await service.refreshDirectory('project-1', '/birdcoder'),
  refreshedRootTree,
  'An unchanged directory refresh must preserve the complete tree reference.',
);

const previousSourceEntry = entries.get('projects/birdcoder/src')!;
entries.set('projects/birdcoder/src', {
  ...previousSourceEntry,
  id: 'entry:projects/birdcoder/src:replacement',
  revision: `revision:${revision++}`,
});
const replacedSourceTree = await service.refreshDirectory('project-1', '/birdcoder');
const replacedSourceNode = replacedSourceTree[0]!.children!
  .find((node) => node.path === '/birdcoder/src')!;
assert.equal(
  replacedSourceNode.children,
  undefined,
  'A same-path directory with a new server identity must not inherit stale loaded descendants.',
);
const reloadedSourceTree = await service.loadDirectory('project-1', '/birdcoder/src');
assert.equal(reloadedSourceTree[0]!.children![0]!.children![0]!.name, 'main.ts');

async function startBlockedDirectoryRefresh(
  logicalPath: string,
  virtualPath: string,
): Promise<{
  readonly release: () => void;
  readonly refresh: Promise<IFileNode[]>;
}> {
  let releaseRefresh!: () => void;
  let markRefreshStarted!: () => void;
  const refreshBarrier = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  const refreshStarted = new Promise<void>((resolve) => {
    markRefreshStarted = resolve;
  });
  nextListChildrenBarrier = async (parentPath) => {
    assert.equal(parentPath, logicalPath);
    markRefreshStarted();
    await refreshBarrier;
  };
  const refresh = service.refreshDirectory('project-1', virtualPath);
  await refreshStarted;
  return { release: releaseRefresh, refresh };
}

const startBlockedSourceRefresh = () => startBlockedDirectoryRefresh(
  'projects/birdcoder/src',
  '/birdcoder/src',
);

const staleCreateRefresh = await startBlockedSourceRefresh();
await service.createFile('project-1', '/birdcoder/src/created-during-refresh.ts');
staleCreateRefresh.release();
await staleCreateRefresh.refresh;
assert.ok(
  (await service.getFiles('project-1'))[0]!.children![0]!.children!
    .some((node) => node.name === 'created-during-refresh.ts'),
  'A stale directory response must not remove a file created after the request started.',
);

const staleDeleteRefresh = await startBlockedSourceRefresh();
await service.deleteFile('project-1', '/birdcoder/src/created-during-refresh.ts');
staleDeleteRefresh.release();
await staleDeleteRefresh.refresh;
assert.equal(
  (await service.getFiles('project-1'))[0]!.children![0]!.children!
    .some((node) => node.name === 'created-during-refresh.ts'),
  false,
  'A stale directory response must not restore a file deleted after the request started.',
);

const staleRenameRefresh = await startBlockedSourceRefresh();
await service.renameNode(
  'project-1',
  '/birdcoder/src/main.ts',
  '/birdcoder/src/renamed-during-refresh.ts',
);
staleRenameRefresh.release();
await staleRenameRefresh.refresh;
assert.deepEqual(
  (await service.getFiles('project-1'))[0]!.children![0]!.children!.map((node) => node.name),
  ['renamed-during-refresh.ts'],
  'A stale directory response must not revert a rename completed after the request started.',
);

let releaseOverlappingCreate!: () => void;
let markOverlappingCreateStarted!: () => void;
const overlappingCreateBarrier = new Promise<void>((resolve) => {
  releaseOverlappingCreate = resolve;
});
const overlappingCreateStarted = new Promise<void>((resolve) => {
  markOverlappingCreateStarted = resolve;
});
nextCreateFileBarrier = async () => {
  markOverlappingCreateStarted();
  await overlappingCreateBarrier;
};
const overlappingCreate = service.createFile(
  'project-1',
  '/birdcoder/src/created-with-overlapping-refresh.ts',
);
await overlappingCreateStarted;
const refreshDuringCreate = await startBlockedSourceRefresh();
releaseOverlappingCreate();
await overlappingCreate;
refreshDuringCreate.release();
await refreshDuringCreate.refresh;
assert.ok(
  (await service.getFiles('project-1'))[0]!.children![0]!.children!
    .some((node) => node.name === 'created-with-overlapping-refresh.ts'),
  'A refresh started during a mutation must not overwrite the committed mutation result.',
);

await service.createFolder('project-1', '/birdcoder/src/transient');
await service.createFile('project-1', '/birdcoder/src/transient/stale.ts');
await service.loadDirectory('project-1', '/birdcoder/src/transient');
const deletedSubtreeRefresh = await startBlockedDirectoryRefresh(
  'projects/birdcoder/src/transient',
  '/birdcoder/src/transient',
);
await service.deleteFolder('project-1', '/birdcoder/src/transient');
deletedSubtreeRefresh.release();
await deletedSubtreeRefresh.refresh;
await service.createFolder('project-1', '/birdcoder/src/transient');
await assert.rejects(
  service.getFileContent('project-1', '/birdcoder/src/transient/stale.ts'),
  /no longer exists/u,
  'A deleted subtree request must not repopulate cache after the path is recreated.',
);

await service.createFolder('project-1', '/birdcoder/src/moving');
await service.createFile('project-1', '/birdcoder/src/moving/stale.ts');
await service.loadDirectory('project-1', '/birdcoder/src/moving');
const movedSubtreeRefresh = await startBlockedDirectoryRefresh(
  'projects/birdcoder/src/moving',
  '/birdcoder/src/moving',
);
await service.renameNode(
  'project-1',
  '/birdcoder/src/moving',
  '/birdcoder/src/moved',
);
movedSubtreeRefresh.release();
await movedSubtreeRefresh.refresh;
await service.createFolder('project-1', '/birdcoder/src/moving');
await assert.rejects(
  service.getFileContent('project-1', '/birdcoder/src/moving/stale.ts'),
  /no longer exists/u,
  'A moved subtree request must not repopulate cache under its old path.',
);

const sourceChildren = listChildren('projects/birdcoder/src');
const conflictingEntry = sourceChildren[0]!;
nextListChildrenTransform = (items) => [...items, items[0]!];
const duplicateSafeTree = await service.refreshDirectory('project-1', '/birdcoder/src');
const duplicateSafeChildren = duplicateSafeTree[0]!.children!
  .find((node) => node.path === '/birdcoder/src')!
  .children!;
assert.equal(
  duplicateSafeChildren.length,
  new Set(sourceChildren.map((candidate) => candidate.logicalPath)).size,
  'An identical repeated page entry must not create duplicate tree keys.',
);

nextListChildrenTransform = (items) => [
  ...items,
  { ...conflictingEntry, id: `${conflictingEntry.id}:conflict` },
];
await assert.rejects(
  service.refreshDirectory('project-1', '/birdcoder/src'),
  /inconsistent directory entry identity/u,
);

nextListChildrenTransform = (items) => Array.from(
  { length: 20_001 },
  () => items[0]!,
);
await assert.rejects(
  service.refreshDirectory('project-1', '/birdcoder/src'),
  /bounded entry limit/u,
);

nextRepeatedListChildrenCursor = 'repeated-cursor';
await assert.rejects(
  service.refreshDirectory('project-1', '/birdcoder/src'),
  /invalid directory pagination cursor/u,
);

const revisionListCallsBefore = listChildrenCalls.get('projects/birdcoder/src') ?? 0;
const revisionLookups = await service.getFileRevisions('project-1', [
  '/birdcoder/src/renamed-during-refresh.ts',
  '/birdcoder/src/created-with-overlapping-refresh.ts',
  '/birdcoder/src/missing.ts',
]);
assert.equal(
  (listChildrenCalls.get('projects/birdcoder/src') ?? 0) - revisionListCallsBefore,
  1,
  'Revision lookups in one directory must share a single bounded directory request.',
);
assert.equal(revisionLookups[0]?.missing, false);
assert.equal(revisionLookups[1]?.missing, false);
assert.deepEqual(revisionLookups[2], {
  path: '/birdcoder/src/missing.ts',
  revision: null,
  missing: true,
});

nextListChildrenError = new Error('sensitive C:\\workspace\\server-path');
assert.deepEqual(
  await service.getFileRevisions('project-1', ['/birdcoder/src/network-error.ts']),
  [{
    path: '/birdcoder/src/network-error.ts',
    revision: null,
    missing: false,
    error: 'Unable to query the project Drive file revision.',
  }],
  'A transport failure must not be reported as a deleted file or expose raw server details.',
);

await assert.rejects(
  service.createFile('project-1', `/birdcoder/src/${'a'.repeat(256)}`),
  /supported portable length/u,
);
await assert.rejects(
  service.createFolder('project-1', '/birdcoder/src/CON'),
  /not portable across supported hosts/u,
);

const useFileSystemSource = await readFile(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useFileSystem.ts', import.meta.url),
  'utf8',
);
assert.match(useFileSystemSource, /directoryLoadPromisesRef\.current\.get\(requestKey\)/u);
assert.match(useFileSystemSource, /directoryLoadGenerationRef\.current \+= 1/u);
assert.match(
  useFileSystemSource,
  /directoryLoadGenerationRef\.current !== requestGeneration[\s\S]*!isProjectActive\(requestProjectId\)/u,
);

const fileExplorerSource = await readFile(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/FileExplorer.tsx', import.meta.url),
  'utf8',
);
assert.match(fileExplorerSource, /directoryLoadRequestsRef\.current\.get\(path\)/u);
assert.match(fileExplorerSource, /directoryLoadScopeGenerationRef\.current/u);

console.log('File Explorer directory expansion regression tests passed.');
