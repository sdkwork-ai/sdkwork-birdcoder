import assert from 'node:assert/strict';

import type { IFileSystemService } from '../interfaces/IFileSystemService.ts';
import { normalizeProjectRuntimeLocationInput } from '../interfaces/IProjectRuntimeLocationService.ts';
import { RuntimeProjectRuntimeLocationService } from './RuntimeProjectRuntimeLocationService.ts';

const savedProjectPath = 'E:\\sdkwork-space\\sdkwork-birdcoder';
let isRestored = false;
let restoreCount = 0;

const fileSystemService = {
  getProjectMountState: async () => ({
    displayName: 'sdkwork-birdcoder',
    host: 'tauri' as const,
    status: isRestored ? 'mounted' as const : 'recoverable' as const,
  }),
  resolveLocalWorkingDirectory: async () => isRestored ? savedProjectPath : null,
  restoreProjectMount: async () => {
    restoreCount += 1;
    isRestored = true;
    return {
      restored: true,
      state: {
        displayName: 'sdkwork-birdcoder',
        host: 'tauri' as const,
        status: 'mounted' as const,
      },
    };
  },
} as unknown as IFileSystemService;

const service = new RuntimeProjectRuntimeLocationService({
  executionLocation: 'local-host',
  fileSystemService,
});
const resolution = await service.resolveProjectRuntimeLocation(
  'project.339967887101923328',
  {
    allowFolderSelection: false,
    capability: 'git',
  },
);

assert.equal(restoreCount, 1);
assert.deepEqual(resolution, {
  location: {
    localWorkingDirectory: savedProjectPath,
    projectId: 'project.339967887101923328',
    source: 'recovered_mount',
  },
  status: 'resolved',
});

const project = {
  name: 'sdkwork-birdcoder',
  projectId: ' project.339967887101923328 ',
};
assert.deepEqual(normalizeProjectRuntimeLocationInput(project), {
  projectId: 'project.339967887101923328',
});
assert.deepEqual(normalizeProjectRuntimeLocationInput({
  mountedPath: ' /sdkwork-birdcoder/apps/sdkwork-birdcoder-pc ',
  projectId: project.projectId,
}), {
  mountedPath: '/sdkwork-birdcoder/apps/sdkwork-birdcoder-pc',
  projectId: 'project.339967887101923328',
});
assert.equal(normalizeProjectRuntimeLocationInput('   '), null);

const nestedMountedPath = '/sdkwork-birdcoder/apps/sdkwork-birdcoder-pc';
const nestedSystemPath = `${savedProjectPath}\\apps\\sdkwork-birdcoder-pc`;
const nestedPathRequests: Array<{ mountedPath?: string; projectId: string }> = [];
const activeFileSystemService = {
  getProjectMountState: async () => ({
    displayName: 'sdkwork-birdcoder',
    host: 'tauri' as const,
    status: 'mounted' as const,
  }),
  resolveLocalWorkingDirectory: async (projectId: string, mountedPath?: string) => {
    nestedPathRequests.push({ projectId, mountedPath });
    return nestedSystemPath;
  },
  restoreProjectMount: async () => {
    assert.fail('An active project path must not trigger mount recovery.');
  },
} as unknown as IFileSystemService;
const activeService = new RuntimeProjectRuntimeLocationService({
  executionLocation: 'local-host',
  fileSystemService: activeFileSystemService,
});
const resolvedNestedPath = await activeService.resolveProjectLocalWorkingDirectory(
  {
    mountedPath: nestedMountedPath,
    projectId: project.projectId,
  },
  {
    allowFolderSelection: false,
    capability: 'terminal',
  },
);

assert.equal(resolvedNestedPath, nestedSystemPath);
assert.deepEqual(nestedPathRequests, [{
  mountedPath: nestedMountedPath,
  projectId: 'project.339967887101923328',
}]);

let revealMountRestored = false;
let revealRestoreCount = 0;
let folderPickerCallCount = 0;
const revealRequests: Array<{ mountedPath?: string; projectId: string }> = [];
const revealFileSystemService = {
  getProjectMountState: async () => ({
    displayName: 'sdkwork-birdcoder',
    host: 'tauri' as const,
    status: revealMountRestored ? 'mounted' as const : 'recoverable' as const,
  }),
  resolveLocalWorkingDirectory: async () => revealMountRestored ? nestedSystemPath : null,
  restoreProjectMount: async () => {
    revealRestoreCount += 1;
    revealMountRestored = true;
    return {
      restored: true,
      state: {
        displayName: 'sdkwork-birdcoder',
        host: 'tauri' as const,
        status: 'mounted' as const,
      },
    };
  },
  revealProjectInFileManager: async (projectId: string, mountedPath?: string) => {
    revealRequests.push({ projectId, mountedPath });
    return true;
  },
} as unknown as IFileSystemService;
const revealService = new RuntimeProjectRuntimeLocationService({
  fileSystemService: revealFileSystemService,
  openLocalFolder: async () => {
    folderPickerCallCount += 1;
    return { status: 'cancelled' };
  },
});

assert.equal(await revealService.revealProjectInFileManager({
  mountedPath: nestedMountedPath,
  projectId: project.projectId,
}), true);
assert.equal(revealRestoreCount, 1);
assert.equal(folderPickerCallCount, 0);
assert.deepEqual(revealRequests, [{
  mountedPath: nestedMountedPath,
  projectId: 'project.339967887101923328',
}]);

console.log('project runtime-location input and persisted-path tests passed.');
