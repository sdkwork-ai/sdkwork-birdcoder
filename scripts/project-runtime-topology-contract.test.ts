import assert from 'node:assert/strict';

import type { SandboxExplorerPort } from '@sdkwork/drive-pc-sandbox-contracts';
import type { IFileSystemService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IFileSystemService.ts';
import { ProjectRuntimeLocationExecutionUnavailableError } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IProjectRuntimeLocationService.ts';
import { RuntimeProjectRuntimeLocationService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/RuntimeProjectRuntimeLocationService.ts';
import {
  DriveSandboxProjectFileSystemService,
  ProjectDriveCompositionRequiredError,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/DriveSandboxProjectFileSystemService.ts';
import { resolveBirdCoderRuntimeTopology } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/runtimeTopology.ts';
import {
  publishBirdCoderDesktopSdkRuntimeEnv,
  readDesktopRuntimeConfig,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/bootstrapDesktopRuntime.ts';

assert.equal(
  resolveBirdCoderRuntimeTopology({
    deploymentProfile: 'standalone',
    runtimeTarget: 'browser',
  }).executionLocation,
  'cloud-workspace',
);
assert.equal(
  resolveBirdCoderRuntimeTopology({
    deploymentProfile: 'cloud',
    runtimeTarget: 'browser',
  }).executionLocation,
  'cloud-workspace',
);
assert.equal(
  resolveBirdCoderRuntimeTopology({
    deploymentProfile: 'standalone',
    runtimeTarget: 'desktop',
  }).executionLocation,
  'local-host',
);
assert.equal(
  resolveBirdCoderRuntimeTopology({
    deploymentProfile: 'cloud',
    runtimeTarget: 'desktop',
  }).executionLocation,
  'cloud-workspace',
);

assert.deepEqual(
  await readDesktopRuntimeConfig({
    configuredApplicationApiBaseUrl: 'https://birdcoder.example.com/',
    configuredPlatformApiGatewayBaseUrl: 'https://platform.example.com/',
    deploymentProfile: 'cloud',
  }),
  {
    applicationApiBaseUrl: 'https://birdcoder.example.com',
    deploymentProfile: 'cloud',
    executionLocation: 'cloud-workspace',
    runtimeTarget: 'desktop',
    platformApiGatewayBaseUrl: 'https://platform.example.com',
  },
  'Remote desktop must preserve distinct application and platform SDK endpoints.',
);

const runtimeEnvHost = globalThis as typeof globalThis & {
  __SDKWORK_PC_REACT_ENV__?: Record<string, string>;
};
const previousRuntimeEnv = runtimeEnvHost.__SDKWORK_PC_REACT_ENV__;
runtimeEnvHost.__SDKWORK_PC_REACT_ENV__ = {
  VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL: 'https://platform.example.com',
};
publishBirdCoderDesktopSdkRuntimeEnv({
  applicationApiBaseUrl: 'https://birdcoder.example.com',
  deploymentProfile: 'cloud',
  executionLocation: 'cloud-workspace',
  runtimeTarget: 'desktop',
  platformApiGatewayBaseUrl: 'https://platform.example.com',
});
assert.equal(
  runtimeEnvHost.__SDKWORK_PC_REACT_ENV__.VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL,
  'https://platform.example.com',
);
assert.equal(
  runtimeEnvHost.__SDKWORK_PC_REACT_ENV__.VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL,
  'https://birdcoder.example.com',
);
runtimeEnvHost.__SDKWORK_PC_REACT_ENV__ = previousRuntimeEnv;

let cloudLocalFileSystemCalls = 0;
let cloudIdentityCalls = 0;
let cloudPickerCalls = 0;
const cloudRuntimeLocationService = new RuntimeProjectRuntimeLocationService({
  executionLocation: 'cloud-workspace',
  fileSystemService: new Proxy(
    {},
    {
      get() {
        return async () => {
          cloudLocalFileSystemCalls += 1;
          throw new Error('Cloud execution must not inspect the local file system.');
        };
      },
    },
  ) as IFileSystemService,
  identityPort: {
    async resolveDesktopRuntimeLocationBinding() {
      cloudIdentityCalls += 1;
      return null;
    },
  },
  openLocalFolder: async () => {
    cloudPickerCalls += 1;
    return { status: 'cancelled' };
  },
});
await assert.rejects(
  cloudRuntimeLocationService.resolveProjectRuntimeLocationExecutionId(
    'project-cloud',
    'terminal',
    { allowFolderSelection: true },
  ),
  (error: unknown) =>
    error instanceof ProjectRuntimeLocationExecutionUnavailableError
    && error.code === 'missing_runtime_location_id',
);
assert.equal(cloudLocalFileSystemCalls, 0);
assert.equal(cloudIdentityCalls, 0);
assert.equal(cloudPickerCalls, 0);

const remoteFileSystem = new DriveSandboxProjectFileSystemService({
  drivePort: {} as SandboxExplorerPort,
  projectService: {
    async getProjectDrive() {
      return null;
    },
  },
});
await assert.rejects(
  remoteFileSystem.getFiles('project-without-drive-composition'),
  (error: unknown) => error instanceof ProjectDriveCompositionRequiredError,
);

let localWorkingDirectory: string | null = null;
const localIdentityInputs: Array<{ absolutePath: string; projectId: string }> = [];
const localRuntimeLocationService = new RuntimeProjectRuntimeLocationService({
  executionLocation: 'local-host',
  fileSystemService: {
    async getProjectMountState() {
      return localWorkingDirectory
        ? { displayName: 'local-project', host: 'tauri', status: 'mounted' }
        : { displayName: null, host: null, status: 'mount_required' };
    },
    async mountFolder(_projectId, source) {
      assert.equal(source.type, 'tauri');
      localWorkingDirectory = source.type === 'tauri' ? source.path : null;
    },
    async resolveLocalWorkingDirectory() {
      return localWorkingDirectory;
    },
    async restoreProjectMount() {
      return {
        restored: false,
        state: { displayName: null, host: null, status: 'mount_required' },
      };
    },
  } as IFileSystemService,
  identityPort: {
    async resolveDesktopRuntimeLocationBinding(input) {
      localIdentityInputs.push(input);
      return {
        displayName: 'local-project',
        locationKind: 'local_directory',
        pathFlavor: 'windows',
        rootLocator: 'desktop-root:11111111-1111-4111-8111-111111111111',
        runtimeTargetId: 'desktop-device:22222222-2222-4222-8222-222222222222',
        runtimeTargetKind: 'desktop',
      };
    },
  },
  openLocalFolder: async () => ({
    source: { path: 'E:\\work\\local-project', type: 'tauri' },
    status: 'selected',
  }),
});
assert.equal(
  await localRuntimeLocationService.resolveProjectRuntimeLocationExecutionId(
    'project-local',
    'terminal',
    { allowFolderSelection: true },
  ),
  'desktop-root:11111111-1111-4111-8111-111111111111',
);
assert.deepEqual(localIdentityInputs, [{
  absolutePath: 'E:\\work\\local-project',
  projectId: 'project-local',
}]);

let resolvedMountedPath = '';
const mountedPathService = new RuntimeProjectRuntimeLocationService({
  executionLocation: 'local-host',
  fileSystemService: {
    async getProjectMountState() {
      return { displayName: 'worktree', host: 'tauri', status: 'mounted' };
    },
    async resolveLocalWorkingDirectory(_projectId, mountedPath) {
      return mountedPath ?? 'E:\\work\\default';
    },
  } as IFileSystemService,
  identityPort: {
    async resolveDesktopRuntimeLocationBinding(input) {
      resolvedMountedPath = input.absolutePath;
      return {
        displayName: 'worktree',
        locationKind: 'local_directory',
        pathFlavor: 'windows',
        rootLocator: 'desktop-root:33333333-3333-4333-8333-333333333333',
        runtimeTargetId: 'desktop-device:44444444-4444-4444-8444-444444444444',
        runtimeTargetKind: 'desktop',
      };
    },
  },
});
const mountedPathResolution = await mountedPathService.resolveProjectRuntimeLocation(
  'project-worktree',
  {
    allowFolderSelection: false,
    capability: 'terminal',
    mountedPath: 'E:\\work\\explicit-worktree',
  },
);
assert.equal(mountedPathResolution.status, 'resolved');
assert.equal(
  resolvedMountedPath,
  'E:\\work\\explicit-worktree',
  'Opaque identity resolution must use the same explicit mounted path selected by the caller.',
);

console.log('project runtime topology contract passed.');
