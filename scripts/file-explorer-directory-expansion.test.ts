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
import { resolveFileExplorerRelativePath } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/fileExplorerPaths.ts';

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
assert.equal(resolveFileExplorerRelativePath('/birdcoder', '/birdcoder'), '.');
assert.equal(
  resolveFileExplorerRelativePath('/birdcoder/', '/birdcoder/src/index.ts'),
  'src/index.ts',
);
assert.equal(resolveFileExplorerRelativePath('/birdcoder', '/birdcoder-next/index.ts'), null);
assert.equal(resolveFileExplorerRelativePath('/birdcoder', '/birdcoder/../private.txt'), null);

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
const lastListChildrenPageSize = new Map<string, number>();
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
let nextReadFileBarrier: ((logicalPath: string) => Promise<void>) | null = null;

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
    lastListChildrenPageSize.set(input.parentPath, input.pageSize);
    const listError = nextListChildrenError;
    nextListChildrenError = null;
    if (listError) throw listError;
    const listedItems = listChildren(input.parentPath).slice(0, input.pageSize);
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
    const barrier = nextReadFileBarrier;
    nextReadFileBarrier = null;
    await barrier?.(input.logicalPath);
    const currentEntry = entries.get(input.logicalPath);
    if (!currentEntry) throw new Error('sensitive stale Drive read failure');
    return {
      checksumSha256: 'checksum',
      content: input.logicalPath,
      encoding: 'utf8',
      entry: currentEntry,
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

assert.equal((await service.getProjectMountState('project-1')).status, 'mounted');
assert.equal(
  lastListChildrenPageSize.get('projects/birdcoder'),
  200,
  'Mount-state checks must use one bounded page instead of traversing the root.',
);

const mountProbeCallsBefore = listChildrenCalls.get('projects/birdcoder') ?? 0;
nextListChildrenError = new Error('sensitive C:\\server\\workspace\\project');
await assert.rejects(
  service.restoreProjectMount('project-1'),
  (error: unknown) => (
    error instanceof Error
    && error.message === 'Unable to verify access to the project Drive root.'
    && !error.message.includes('server\\workspace')
  ),
  'A cached tree must not bypass a fresh, sanitized mount-access probe.',
);
assert.equal(
  (listChildrenCalls.get('projects/birdcoder') ?? 0) - mountProbeCallsBefore,
  0,
);
assert.equal((await service.restoreProjectMount('project-1')).restored, true);
assert.equal(
  (listChildrenCalls.get('projects/birdcoder') ?? 0) - mountProbeCallsBefore,
  1,
  'A successful cached mount restore must still read the remote project root once.',
);

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

await service.createFile('project-1', '/birdcoder/src/revision-delete-race.ts');
let releaseRevisionLookup!: () => void;
let markRevisionLookupStarted!: () => void;
const revisionLookupBarrier = new Promise<void>((resolve) => {
  releaseRevisionLookup = resolve;
});
const revisionLookupStarted = new Promise<void>((resolve) => {
  markRevisionLookupStarted = resolve;
});
nextListChildrenBarrier = async (parentPath) => {
  assert.equal(parentPath, 'projects/birdcoder/src');
  markRevisionLookupStarted();
  await revisionLookupBarrier;
};
const revisionDeleteRaceLookup = service.getFileRevisions(
  'project-1',
  ['/birdcoder/src/revision-delete-race.ts'],
);
await revisionLookupStarted;
await service.deleteFile('project-1', '/birdcoder/src/revision-delete-race.ts');
releaseRevisionLookup();
assert.deepEqual(await revisionDeleteRaceLookup, [{
  path: '/birdcoder/src/revision-delete-race.ts',
  revision: null,
  missing: true,
}], 'A revision response captured before deletion must retry instead of restoring stale identity.');

let releaseSearchRoot!: () => void;
let markSearchRootStarted!: () => void;
const searchRootBarrier = new Promise<void>((resolve) => {
  releaseSearchRoot = resolve;
});
const searchRootStarted = new Promise<void>((resolve) => {
  markSearchRootStarted = resolve;
});
nextListChildrenBarrier = async (parentPath) => {
  assert.equal(parentPath, 'projects/birdcoder');
  markSearchRootStarted();
  await searchRootBarrier;
};
const concurrentSearch = service.searchFiles('project-1', {
  maxResults: 20,
  query: 'search-race',
});
await searchRootStarted;
await service.createFile('project-1', '/birdcoder/search-race.ts');
releaseSearchRoot();
assert.ok(
  (await concurrentSearch).results.some((result) => result.path === '/birdcoder/search-race.ts'),
  'A search invalidated by a local mutation must retry from one coherent Drive snapshot.',
);

let releaseSearchRead!: () => void;
let markSearchReadStarted!: (logicalPath: string) => void;
const searchReadBarrier = new Promise<void>((resolve) => {
  releaseSearchRead = resolve;
});
const searchReadStarted = new Promise<string>((resolve) => {
  markSearchReadStarted = resolve;
});
nextReadFileBarrier = async (logicalPath) => {
  markSearchReadStarted(logicalPath);
  await searchReadBarrier;
};
const deleteDuringSearch = service.searchFiles('project-1', {
  maxResults: 20,
  query: 'query-with-no-match',
});
const blockedLogicalPath = await searchReadStarted;
const blockedVirtualPath = `/birdcoder${blockedLogicalPath.slice('projects/birdcoder'.length)}`;
await service.deleteFile('project-1', blockedVirtualPath);
releaseSearchRead();
assert.deepEqual(
  (await deleteDuringSearch).results,
  [],
  'A stale read failure caused by a concurrent deletion must retry instead of leaking the adapter error.',
);

await assert.rejects(
  service.createFile('project-1', `/birdcoder/src/${'a'.repeat(256)}`),
  /supported portable length/u,
);
await assert.rejects(
  service.createFolder('project-1', '/birdcoder/src/CON'),
  /not portable across supported hosts/u,
);

async function waitForCondition(
  condition: () => boolean,
  failureMessage: string,
  timeoutMs = 4_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() >= deadline) throw new Error(failureMessage);
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
}

const pollEntries = new Map<string, SandboxEntry>();
const trackedPollPaths = Array.from({ length: 21 }, (_, index) => {
  const name = `tracked-${String(index).padStart(2, '0')}.ts`;
  const logicalPath = `projects/birdcoder/poll/${name}`;
  pollEntries.set(logicalPath, entry(logicalPath, 'file'));
  return `/birdcoder/poll/${name}`;
});
let pollDirectoryRequestCount = 0;
const pollingDrivePort: SandboxExplorerPort = {
  ...drivePort,
  async listChildren(input) {
    assert.equal(input.parentPath, 'projects/birdcoder/poll');
    pollDirectoryRequestCount += 1;
    return { items: [...pollEntries.values()] };
  },
};
const pollingService = new DriveSandboxProjectFileSystemService({
  drivePort: pollingDrivePort,
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
  remotePollIntervalMs: 500,
});
const tailTrackedPath = trackedPollPaths.at(-1)!;
let tailChangeObserved = false;
const stopPolling = pollingService.subscribeToFileChanges(
  'project-1',
  (event) => {
    if (event.paths.includes(tailTrackedPath)) tailChangeObserved = true;
  },
  { getTrackedFilePaths: () => trackedPollPaths },
);
try {
  await waitForCondition(
    () => pollDirectoryRequestCount >= 2,
    'Polling did not rotate far enough to establish a baseline for the tail file.',
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  const tailLogicalPath = `projects/birdcoder/poll/${tailTrackedPath.split('/').at(-1)!}`;
  const previousTailEntry = pollEntries.get(tailLogicalPath)!;
  pollEntries.set(tailLogicalPath, {
    ...previousTailEntry,
    revision: `revision:${revision++}`,
  });
  await waitForCondition(
    () => tailChangeObserved,
    'Round-robin polling starved a tracked file beyond the first 16 paths.',
  );
} finally {
  stopPolling();
}

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
