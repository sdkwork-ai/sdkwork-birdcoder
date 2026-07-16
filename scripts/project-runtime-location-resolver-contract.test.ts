import assert from 'node:assert/strict';

import type { IFileSystemService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IFileSystemService.ts';
import {
  RuntimeProjectRuntimeLocationService,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/RuntimeProjectRuntimeLocationService.ts';

type MountStatus = Awaited<ReturnType<IFileSystemService['getProjectMountState']>>;

function createFileSystemService(options: {
  initialWorkingDirectory?: string | null;
  mountError?: Error;
  mountState?: MountStatus;
  recoveredWorkingDirectory?: string | null;
}) {
  let workingDirectory = options.initialWorkingDirectory ?? null;
  let mountState = options.mountState ?? {
    displayName: null,
    host: null,
    status: 'mount_required' as const,
  };
  const calls = {
    mount: 0,
    restore: 0,
  };

  const fileSystemService = {
    async getProjectMountState() {
      return mountState;
    },
    async mountFolder(
      _projectId: string,
      source: { path?: string; type: 'browser' | 'tauri' },
    ) {
      calls.mount += 1;
      if (options.mountError) {
        throw options.mountError;
      }

      mountState = {
        displayName: source.type === 'tauri' ? 'desktop-project' : 'browser-project',
        host: source.type,
        status: 'mounted',
      };
      if (source.type === 'tauri' && source.path) {
        workingDirectory = source.path;
      }
    },
    async resolveLocalWorkingDirectory() {
      return workingDirectory;
    },
    async restoreProjectMount() {
      calls.restore += 1;
      if (options.recoveredWorkingDirectory) {
        workingDirectory = options.recoveredWorkingDirectory;
        mountState = {
          displayName: 'recovered-project',
          host: 'tauri',
          status: 'mounted',
        };
      }

      return {
        restored: Boolean(options.recoveredWorkingDirectory),
        state: mountState,
      };
    },
  } as unknown as IFileSystemService;

  return { calls, fileSystemService };
}

const activeFileSystem = createFileSystemService({
  initialWorkingDirectory: 'E:\\work\\active-project',
});
let activePickerCalls = 0;
const activeResolver = new RuntimeProjectRuntimeLocationService({
  fileSystemService: activeFileSystem.fileSystemService,
  openLocalFolder: async () => {
    activePickerCalls += 1;
    return { status: 'cancelled' };
  },
});
const activeResolution = await activeResolver.resolveProjectRuntimeLocation('project-active', {
  allowFolderSelection: true,
  capability: 'terminal',
});
assert.deepEqual(activeResolution, {
  location: {
    localWorkingDirectory: 'E:\\work\\active-project',
    projectId: 'project-active',
    remoteSynchronization: 'not_configured',
    source: 'active_mount',
  },
  status: 'resolved',
});
assert.equal(activeFileSystem.calls.restore, 0);
assert.equal(activePickerCalls, 0);

const recoveredFileSystem = createFileSystemService({
  recoveredWorkingDirectory: 'E:\\work\\recovered-project',
});
let recoveredPickerCalls = 0;
const recoveredResolver = new RuntimeProjectRuntimeLocationService({
  fileSystemService: recoveredFileSystem.fileSystemService,
  openLocalFolder: async () => {
    recoveredPickerCalls += 1;
    return { status: 'cancelled' };
  },
});
const recoveredResolution = await recoveredResolver.resolveProjectRuntimeLocation('project-recovered', {
  allowFolderSelection: true,
  capability: 'terminal',
});
assert.deepEqual(recoveredResolution, {
  location: {
    localWorkingDirectory: 'E:\\work\\recovered-project',
    projectId: 'project-recovered',
    remoteSynchronization: 'not_configured',
    source: 'recovered_mount',
  },
  status: 'resolved',
});
assert.equal(recoveredFileSystem.calls.restore, 1);
assert.equal(recoveredPickerCalls, 0);

const cancelledFileSystem = createFileSystemService({});
const cancelledResolver = new RuntimeProjectRuntimeLocationService({
  fileSystemService: cancelledFileSystem.fileSystemService,
  openLocalFolder: async () => ({ status: 'cancelled' }),
});
assert.deepEqual(
  await cancelledResolver.resolveProjectRuntimeLocation('project-cancelled', {
    allowFolderSelection: true,
    capability: 'terminal',
  }),
  { projectId: 'project-cancelled', status: 'cancelled' },
  'cancelling a folder picker must be an intentional no-op.',
);
assert.equal(cancelledFileSystem.calls.mount, 0);

const persistenceFailureFileSystem = createFileSystemService({
  mountError: new Error('The local project folder could not be persisted for future terminal access.'),
});
const persistenceFailureResolver = new RuntimeProjectRuntimeLocationService({
  fileSystemService: persistenceFailureFileSystem.fileSystemService,
  openLocalFolder: async () => ({
    source: { path: 'E:\\work\\failed-project', type: 'tauri' },
    status: 'selected',
  }),
});
const persistenceFailureResolution = await persistenceFailureResolver.resolveProjectRuntimeLocation(
  'project-persistence-failure',
  { allowFolderSelection: true, capability: 'terminal' },
);
assert.equal(persistenceFailureResolution.status, 'unavailable');
assert.equal(
  persistenceFailureResolution.status === 'unavailable'
    ? persistenceFailureResolution.code
    : null,
  'persistence_failed',
  'a failed durable write must not produce a terminal working directory.',
);
assert.equal(persistenceFailureFileSystem.calls.mount, 1);

const desktopRegistrationFileSystem = createFileSystemService({});
const desktopRegistrationInspectionInputs: Array<{
  absolutePath: string;
  displayName: string | null;
  projectId: string;
}> = [];
const desktopRegistrationSynchronizationInputs: Array<{
  absolutePath: string;
  displayName: string | null;
  projectId: string;
}> = [];
let desktopRegistrationSynchronized = false;
const desktopRegistrationResolver = new RuntimeProjectRuntimeLocationService({
  fileSystemService: desktopRegistrationFileSystem.fileSystemService,
  registrationPort: {
    async inspectLocalDesktopRuntimeLocation(input) {
      desktopRegistrationInspectionInputs.push(input);
      return desktopRegistrationSynchronized
        ? {
            remoteSynchronization: 'registered' as const,
            runtimeLocationId: 'runtime-location-desktop-1',
          }
        : { remoteSynchronization: 'pending' as const };
    },
    async synchronizeLocalDesktopRuntimeLocation(input) {
      desktopRegistrationSynchronizationInputs.push(input);
      desktopRegistrationSynchronized = true;
      return {
        remoteSynchronization: 'registered' as const,
        runtimeLocationId: 'runtime-location-desktop-1',
      };
    },
  },
});
assert.deepEqual(
  await desktopRegistrationResolver.bindLocalProjectRuntimeLocation('project-desktop', {
    path: 'E:\\work\\desktop-project',
    type: 'tauri',
  }),
  {
    host: 'tauri',
    projectId: 'project-desktop',
    remoteSynchronization: 'pending',
    status: 'bound',
  },
  'A durable desktop binding stays locally usable while remote registration synchronizes asynchronously.',
);
assert.deepEqual(
  desktopRegistrationInspectionInputs,
  [{
    absolutePath: 'E:\\work\\desktop-project',
    displayName: 'desktop-project',
    projectId: 'project-desktop',
  }],
  'Only the dedicated desktop registration boundary may receive the absolute path.',
);
assert.deepEqual(
  desktopRegistrationSynchronizationInputs,
  [{
    absolutePath: 'E:\\work\\desktop-project',
    displayName: 'desktop-project',
    projectId: 'project-desktop',
  }],
  'The asynchronous synchronization adapter receives the same narrow desktop boundary input.',
);
assert.deepEqual(
  await desktopRegistrationResolver.resolveProjectRuntimeLocation('project-desktop', {
    allowFolderSelection: false,
    capability: 'terminal',
  }),
  {
    location: {
      localWorkingDirectory: 'E:\\work\\desktop-project',
      projectId: 'project-desktop',
      remoteSynchronization: 'registered',
      runtimeLocationId: 'runtime-location-desktop-1',
      source: 'active_mount',
    },
    status: 'resolved',
  },
  'A later terminal resolution uses the durable local root and exposes only the safe registered identifier.',
);

const remoteFailureFileSystem = createFileSystemService({});
let remoteSynchronizationAttempts = 0;
const remoteFailureResolver = new RuntimeProjectRuntimeLocationService({
  fileSystemService: remoteFailureFileSystem.fileSystemService,
  registrationPort: {
    async inspectLocalDesktopRuntimeLocation() {
      return { remoteSynchronization: 'pending' as const };
    },
    async synchronizeLocalDesktopRuntimeLocation() {
      remoteSynchronizationAttempts += 1;
      throw new Error('The remote runtime-location service is temporarily unavailable.');
    },
  },
});
assert.deepEqual(
  await remoteFailureResolver.bindLocalProjectRuntimeLocation('project-remote-pending', {
    path: 'E:\\work\\remote-pending-project',
    type: 'tauri',
  }),
  {
    host: 'tauri',
    projectId: 'project-remote-pending',
    remoteSynchronization: 'pending',
    status: 'bound',
  },
  'A remote registration failure must not roll back a durable local desktop mount.',
);
await new Promise<void>((resolve) => setTimeout(resolve, 0));
assert.equal(remoteSynchronizationAttempts, 1);
assert.deepEqual(
  await remoteFailureResolver.resolveProjectRuntimeLocation('project-remote-pending', {
    allowFolderSelection: false,
    capability: 'terminal',
  }),
  {
    location: {
      localWorkingDirectory: 'E:\\work\\remote-pending-project',
      projectId: 'project-remote-pending',
      remoteSynchronization: 'pending',
      source: 'active_mount',
    },
    status: 'resolved',
  },
  'The selected project terminal root remains available while remote synchronization is pending.',
);
assert.equal(
  remoteSynchronizationAttempts,
  2,
  'Later local resolution retries remote synchronization without blocking the terminal root.',
);

const browserFileSystem = createFileSystemService({});
let browserRegistrationCalls = 0;
const browserResolver = new RuntimeProjectRuntimeLocationService({
  fileSystemService: browserFileSystem.fileSystemService,
  openLocalFolder: async () => ({
    source: {
      handle: { name: 'browser-project' } as FileSystemDirectoryHandle,
      type: 'browser',
    },
    status: 'selected',
  }),
  registrationPort: {
    async inspectLocalDesktopRuntimeLocation() {
      browserRegistrationCalls += 1;
      return { remoteSynchronization: 'registered' as const };
    },
    async synchronizeLocalDesktopRuntimeLocation() {
      browserRegistrationCalls += 1;
      return { remoteSynchronization: 'registered' as const };
    },
  },
});
const browserResolution = await browserResolver.resolveProjectRuntimeLocation('project-browser', {
  allowFolderSelection: true,
  capability: 'terminal',
});
assert.equal(browserResolution.status, 'unavailable');
assert.equal(
  browserResolution.status === 'unavailable' ? browserResolution.code : null,
  'browser_path_unavailable',
  'a browser directory handle must never be treated as an OS terminal path.',
);
assert.equal(browserRegistrationCalls, 0, 'browser handles must not enter desktop path registration.');

console.log('project runtime location resolver contract passed.');
