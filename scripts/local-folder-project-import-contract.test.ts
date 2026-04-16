import assert from 'node:assert/strict';

import type { LocalFolderMountSource } from '../packages/sdkwork-birdcoder-types/src/index.ts';

const modulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/localFolderProjectImport.ts',
  import.meta.url,
);

const { importLocalFolderProject, rebindLocalFolderProject } = await import(
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
  createProject: async (name: string, options?: { path?: string }) => {
    browserCalls.push(`create:${name}:${options?.path ?? ''}`);
    return { id: 'browser-project' };
  },
  fallbackProjectName: 'Local Folder',
  folderInfo: browserFolderInfo,
  mountFolder: async (projectId: string, folderInfo: LocalFolderMountSource) => {
    browserCalls.push(`mount:${projectId}:${folderInfo.type}`);
  },
  updateProject: async (projectId: string, updates: { path?: string }) => {
    browserCalls.push(`update:${projectId}:${updates.path ?? ''}`);
  },
});

assert.deepEqual(browserImportResult, {
  projectId: 'browser-project',
  projectName: 'sample-browser-app',
  projectPath: '/sample-browser-app',
  reusedExistingProject: false,
});
assert.deepEqual(browserCalls, [
  'create:sample-browser-app:/sample-browser-app',
  'mount:browser-project:browser',
]);

const tauriFolderInfo = {
  type: 'tauri',
  path: 'D:\\repos\\sample-desktop-app\\',
} as const satisfies LocalFolderMountSource;

const tauriCalls: string[] = [];
const tauriImportResult = await importLocalFolderProject({
  createProject: async (name: string, options?: { path?: string }) => {
    tauriCalls.push(`create:${name}:${options?.path ?? ''}`);
    return { id: 'desktop-project' };
  },
  fallbackProjectName: 'Local Folder',
  folderInfo: tauriFolderInfo,
  getProjects: async () => [],
  mountFolder: async (projectId: string, folderInfo: LocalFolderMountSource) => {
    tauriCalls.push(`mount:${projectId}:${folderInfo.type}:${folderInfo.type === 'tauri' ? folderInfo.path : folderInfo.handle.name}`);
  },
  updateProject: async (projectId: string, updates: { path?: string }) => {
    tauriCalls.push(`update:${projectId}:${updates.path ?? ''}`);
  },
});

assert.deepEqual(tauriImportResult, {
  projectId: 'desktop-project',
  projectName: 'sample-desktop-app',
  projectPath: 'D:\\repos\\sample-desktop-app',
  reusedExistingProject: false,
});
assert.deepEqual(tauriCalls, [
  'create:sample-desktop-app:D:\\repos\\sample-desktop-app',
  'mount:desktop-project:tauri:D:\\repos\\sample-desktop-app',
]);

const rebindBrowserCalls: string[] = [];
const reboundBrowserProject = await rebindLocalFolderProject({
  projectId: 'existing-browser-project',
  fallbackProjectName: 'Local Folder',
  folderInfo: browserFolderInfo,
  mountFolder: async (projectId: string, folderInfo: LocalFolderMountSource) => {
    rebindBrowserCalls.push(`mount:${projectId}:${folderInfo.type}`);
  },
  updateProject: async (projectId: string, updates: { path?: string }) => {
    rebindBrowserCalls.push(`update:${projectId}:${updates.path ?? ''}`);
  },
});

assert.deepEqual(reboundBrowserProject, {
  projectId: 'existing-browser-project',
  projectName: 'sample-browser-app',
  projectPath: '/sample-browser-app',
  reusedExistingProject: false,
});
assert.deepEqual(rebindBrowserCalls, [
  'mount:existing-browser-project:browser',
  'update:existing-browser-project:/sample-browser-app',
]);

const rebindTauriCalls: string[] = [];
const reboundTauriProject = await rebindLocalFolderProject({
  projectId: 'existing-desktop-project',
  fallbackProjectName: 'Local Folder',
  folderInfo: tauriFolderInfo,
  mountFolder: async (projectId: string, folderInfo: LocalFolderMountSource) => {
    rebindTauriCalls.push(
      `mount:${projectId}:${folderInfo.type}:${folderInfo.type === 'tauri' ? folderInfo.path : folderInfo.handle.name}`,
    );
  },
  updateProject: async (projectId: string, updates: { path?: string }) => {
    rebindTauriCalls.push(`update:${projectId}:${updates.path ?? ''}`);
  },
});

assert.deepEqual(reboundTauriProject, {
  projectId: 'existing-desktop-project',
  projectName: 'sample-desktop-app',
  projectPath: 'D:\\repos\\sample-desktop-app',
  reusedExistingProject: false,
});
assert.deepEqual(rebindTauriCalls, [
  'mount:existing-desktop-project:tauri:D:\\repos\\sample-desktop-app',
  'update:existing-desktop-project:D:\\repos\\sample-desktop-app',
]);

console.log('local folder project import contract passed.');
