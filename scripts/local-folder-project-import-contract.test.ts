import assert from 'node:assert/strict';

import type { LocalFolderMountSource } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts';

const modulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/localFolderProjectImport.ts',
  import.meta.url,
);

const {
  importLocalFolderProject,
  LocalFolderProjectImportError,
  rebindLocalFolderProject,
} = await import(
  `${modulePath.href}?t=${Date.now()}`,
);

const browserFolderInfo = {
  type: 'browser',
  handle: {
    name: 'sample-browser-app',
  },
} as unknown as LocalFolderMountSource;

const browserCalls: string[] = [];
const browserImportResult = await importLocalFolderProject({
  createProject: async (name: string, options) => {
    assert.equal(options, undefined, 'browser imports must not send a local path to createProject.');
    browserCalls.push(`create:${name}`);
    return { id: 'browser-project' };
  },
  fallbackProjectName: 'Local Folder',
  folderInfo: browserFolderInfo,
  bindLocalProjectRuntimeLocation: async (projectId: string, folderInfo: LocalFolderMountSource) => {
    browserCalls.push(`mount:${projectId}:${folderInfo.type}`);
    return { host: folderInfo.type, projectId, status: 'bound' };
  },
});

assert.deepEqual(browserImportResult, {
  localMount: {
    displayName: 'sample-browser-app',
    type: 'browser',
  },
  projectId: 'browser-project',
  projectName: 'sample-browser-app',
  reusedExistingProject: false,
});
assert.deepEqual(browserCalls, [
  'create:sample-browser-app',
  'mount:browser-project:browser',
]);

const tauriFolderInfo = {
  type: 'tauri',
  path: 'D:\\repos\\sample-desktop-app\\',
} as const satisfies LocalFolderMountSource;

const tauriCalls: string[] = [];
const tauriImportResult = await importLocalFolderProject({
  createProject: async (name: string, options) => {
    assert.equal(options, undefined, 'Tauri imports must not send a local path to createProject.');
    tauriCalls.push(`create:${name}`);
    return { id: 'desktop-project' };
  },
  fallbackProjectName: 'Local Folder',
  folderInfo: tauriFolderInfo,
  bindLocalProjectRuntimeLocation: async (projectId: string, folderInfo: LocalFolderMountSource) => {
    tauriCalls.push(`mount:${projectId}:${folderInfo.type}:${folderInfo.type === 'tauri' ? folderInfo.path : folderInfo.handle.name}`);
    return { host: folderInfo.type, projectId, status: 'bound' };
  },
});

assert.deepEqual(tauriImportResult, {
  localMount: {
    displayName: 'sample-desktop-app',
    type: 'tauri',
  },
  projectId: 'desktop-project',
  projectName: 'sample-desktop-app',
  reusedExistingProject: false,
});
assert.deepEqual(tauriCalls, [
  'create:sample-desktop-app',
  'mount:desktop-project:tauri:D:\\repos\\sample-desktop-app',
]);

const rebindBrowserCalls: string[] = [];
const reboundBrowserProject = await rebindLocalFolderProject({
  projectId: 'existing-browser-project',
  fallbackProjectName: 'Local Folder',
  folderInfo: browserFolderInfo,
  bindLocalProjectRuntimeLocation: async (projectId: string, folderInfo: LocalFolderMountSource) => {
    rebindBrowserCalls.push(`mount:${projectId}:${folderInfo.type}`);
    return { host: folderInfo.type, projectId, status: 'bound' };
  },
});

assert.deepEqual(reboundBrowserProject, {
  localMount: {
    displayName: 'sample-browser-app',
    type: 'browser',
  },
  projectId: 'existing-browser-project',
  projectName: 'sample-browser-app',
  reusedExistingProject: false,
});
assert.deepEqual(rebindBrowserCalls, [
  'mount:existing-browser-project:browser',
]);

const rebindTauriCalls: string[] = [];
const reboundTauriProject = await rebindLocalFolderProject({
  projectId: 'existing-desktop-project',
  fallbackProjectName: 'Local Folder',
  folderInfo: tauriFolderInfo,
  bindLocalProjectRuntimeLocation: async (projectId: string, folderInfo: LocalFolderMountSource) => {
    rebindTauriCalls.push(
      `mount:${projectId}:${folderInfo.type}:${folderInfo.type === 'tauri' ? folderInfo.path : folderInfo.handle.name}`,
    );
    return { host: folderInfo.type, projectId, status: 'bound' };
  },
});

assert.deepEqual(reboundTauriProject, {
  localMount: {
    displayName: 'sample-desktop-app',
    type: 'tauri',
  },
  projectId: 'existing-desktop-project',
  projectName: 'sample-desktop-app',
  reusedExistingProject: false,
});
assert.deepEqual(rebindTauriCalls, [
  'mount:existing-desktop-project:tauri:D:\\repos\\sample-desktop-app',
]);

const failedImportCalls: string[] = [];
await assert.rejects(
  () => importLocalFolderProject({
    bindLocalProjectRuntimeLocation: async (projectId) => {
      failedImportCalls.push(`bind:${projectId}`);
      return {
        code: 'persistence_failed',
        message: 'The local project folder could not be persisted.',
        projectId,
        status: 'failed',
      };
    },
    createProject: async () => ({ id: 'failed-desktop-project' }),
    deleteCreatedProject: async (projectId) => {
      failedImportCalls.push(`delete:${projectId}`);
    },
    fallbackProjectName: 'Local Folder',
    folderInfo: tauriFolderInfo,
  }),
  (error: unknown) => {
    assert.ok(error instanceof LocalFolderProjectImportError);
    assert.equal(error.projectId, 'failed-desktop-project');
    assert.equal(error.cleanupError, null);
    return true;
  },
  'a failed durable binding must fail import instead of reporting a false-positive local mount.',
);
assert.deepEqual(failedImportCalls, [
  'bind:failed-desktop-project',
  'delete:failed-desktop-project',
]);

console.log('local folder project import contract passed.');
