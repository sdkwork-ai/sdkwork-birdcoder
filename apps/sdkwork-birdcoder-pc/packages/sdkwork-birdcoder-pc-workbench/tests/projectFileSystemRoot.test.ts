import { describe, expect, it, vi } from 'vitest';
import type { SandboxExplorerPort } from '@sdkwork/drive-pc-sandbox-contracts';
import type {
  LocalFolderMountSource,
  ProjectDeviceMountState,
  ProjectFileSystemRoot,
} from '@sdkwork/birdcoder-pc-contracts-commons';

import type { BirdCoderTauriFileSystemRuntime } from '../../sdkwork-birdcoder-pc-infrastructure/src/platform/tauriFileSystemRuntime.ts';
import { ProjectDeviceMountRegistry } from '../../sdkwork-birdcoder-pc-infrastructure/src/services/ProjectDeviceMountRegistry.ts';
import { DriveSandboxProjectFileSystemService } from '../../sdkwork-birdcoder-pc-infrastructure/src/services/impl/DriveSandboxProjectFileSystemService.ts';
import { RuntimeFileSystemService } from '../../sdkwork-birdcoder-pc-infrastructure/src/services/impl/RuntimeFileSystemService.ts';
import type { IFileSystemService } from '../../sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IFileSystemService.ts';
import {
  createProjectFileSystemService,
  resolveProjectFileSystemProvider,
} from '../../sdkwork-birdcoder-pc-infrastructure/src/services/projectFileSystemServiceFactory.ts';
import type { BirdCoderExecutionLocation } from '../../sdkwork-birdcoder-pc-infrastructure/src/services/runtimeTopology.ts';

const rootKeys = ['displayName', 'host', 'projectId', 'virtualPath'];

class TestMountRegistry extends ProjectDeviceMountRegistry {
  override async getCurrentSubjectKey(): Promise<string> {
    return 'test-subject';
  }

  override async register(
    _projectId: string,
    source: LocalFolderMountSource,
  ): Promise<ProjectDeviceMountState> {
    return {
      displayName: source.type === 'browser' ? source.handle.name : 'birdcoder-desktop',
      host: source.type,
      status: 'recoverable',
    };
  }
}

function createTauriRuntime(): BirdCoderTauriFileSystemRuntime {
  return {
    async getDirectoryRevisions(
      _rootSystemPath: string,
      _rootVirtualPath: string,
      mountedPaths: readonly string[],
    ) {
      return mountedPaths.map((path) => ({
        missing: false,
        path,
        revision: 'revision-1',
      }));
    },
    async listDirectory() {
      return {
        directory: {
          children: [],
          name: 'birdcoder-desktop',
          path: '/birdcoder-desktop',
          type: 'directory',
        },
        rootVirtualPath: '/birdcoder-desktop',
      };
    },
  } as unknown as BirdCoderTauriFileSystemRuntime;
}

function expectStableRootShape(root: ProjectFileSystemRoot | null): asserts root is ProjectFileSystemRoot {
  expect(root).not.toBeNull();
  expect(Object.keys(root ?? {}).sort()).toEqual(rootKeys);
  expect(root).not.toHaveProperty('handle');
  expect(root).not.toHaveProperty('path');
  expect(root).not.toHaveProperty('rootSystemPath');
}

describe('project file-system root contract', () => {
  it('keeps Browser, Tauri, and Drive roots behind the same virtual descriptor', async () => {
    const runtimeFileSystem = new RuntimeFileSystemService({
      mountRegistry: new TestMountRegistry(),
      tauriRuntime: createTauriRuntime(),
    });
    const browserHandle = {
      kind: 'directory',
      name: 'birdcoder-browser',
      nativeHandleMarker: 'must-not-leak',
      async *values() {},
    } as unknown as FileSystemDirectoryHandle;

    await runtimeFileSystem.mountFolder('project-browser', {
      handle: browserHandle,
      type: 'browser',
    });
    await runtimeFileSystem.mountFolder('project-tauri', {
      path: 'E:\\private\\birdcoder-desktop',
      type: 'tauri',
    });

    const driveFileSystem = new DriveSandboxProjectFileSystemService({
      drivePort: {
        async listSandboxes() {
          return {
            items: [{
              capabilities: {},
              displayName: 'private-drive-name',
              id: 'drive-1',
              rootEntryId: 'entry-1',
            }],
            page: 1,
            pageSize: 200,
            totalItems: 1,
            totalPages: 1,
          };
        },
      } as unknown as SandboxExplorerPort,
      projectService: {
        async getProjectDrive() {
          return {
            driveId: 'drive-1',
            logicalPath: 'workspaces/birdcoder-cloud',
            projectId: 'project-drive',
            rootEntryId: 'entry-1',
            slotId: 'slot-1',
            version: '1',
          };
        },
      },
    });

    const browserRoot = await runtimeFileSystem.resolveProjectRoot('project-browser');
    const tauriRoot = await runtimeFileSystem.resolveProjectRoot('project-tauri');
    const driveRoot = await driveFileSystem.resolveProjectRoot('project-drive');

    expectStableRootShape(browserRoot);
    expectStableRootShape(tauriRoot);
    expectStableRootShape(driveRoot);

    expect(browserRoot).toEqual({
      displayName: 'birdcoder-browser',
      host: 'browser',
      projectId: 'project-browser',
      virtualPath: '/birdcoder-browser',
    });
    expect(tauriRoot).toEqual({
      displayName: 'birdcoder-desktop',
      host: 'tauri',
      projectId: 'project-tauri',
      virtualPath: '/birdcoder-desktop',
    });
    expect(driveRoot).toEqual({
      displayName: 'birdcoder-cloud',
      host: 'server',
      projectId: 'project-drive',
      virtualPath: '/birdcoder-cloud',
    });

    const serializedRoots = JSON.stringify([browserRoot, tauriRoot, driveRoot]);
    expect(serializedRoots).not.toContain('must-not-leak');
    expect(serializedRoots).not.toContain('E:\\\\private');
    expect(serializedRoots).not.toContain('private-drive-name');
  });

  it('keeps a sandbox-root Drive binding stable and independent from its private name', async () => {
    const resolveRoot = async (sandboxDisplayName: string) => {
      const service = new DriveSandboxProjectFileSystemService({
        drivePort: {
          async listSandboxes() {
            return {
              items: [{
                capabilities: {},
                displayName: sandboxDisplayName,
                id: 'drive-root',
                rootEntryId: 'entry-root',
              }],
              page: 1,
              pageSize: 200,
              totalItems: 1,
              totalPages: 1,
            };
          },
        } as unknown as SandboxExplorerPort,
        projectService: {
          async getProjectDrive() {
            return {
              driveId: 'drive-root',
              logicalPath: '',
              projectId: 'project-drive-root',
              rootEntryId: 'entry-root',
              slotId: 'slot-root',
              version: '1',
            };
          },
        },
      });
      return await service.resolveProjectRoot('project-drive-root');
    };

    const firstRoot = await resolveRoot('private-name-before');
    const renamedRoot = await resolveRoot('private-name-after');

    expect(firstRoot).toEqual({
      displayName: 'Project Files',
      host: 'server',
      projectId: 'project-drive-root',
      virtualPath: '/Project Files',
    });
    expect(renamedRoot).toEqual(firstRoot);
    expect(JSON.stringify([firstRoot, renamedRoot])).not.toContain('private-name');
  });

  it('rejects an unsupported execution location without creating a provider', () => {
    const createLocalFileSystem = vi.fn(() => ({} as IFileSystemService));
    const createRemoteFileSystem = vi.fn(() => ({} as IFileSystemService));

    expect(() => createProjectFileSystemService({
      createLocalFileSystem,
      createRemoteFileSystem,
      executionLocation: 'future-location' as BirdCoderExecutionLocation,
    })).toThrow('Unsupported project file-system execution location: future-location.');
    expect(createLocalFileSystem).not.toHaveBeenCalled();
    expect(createRemoteFileSystem).not.toHaveBeenCalled();
  });

  it.each([
    ['local-host', 'device-mount'],
    ['cloud-workspace', 'drive-sandbox'],
  ] as const)(
    'maps %s to the explicit %s provider without constructing the unused adapter',
    (executionLocation, expectedProvider) => {
      const localFileSystem = { provider: 'local' } as unknown as IFileSystemService;
      const remoteFileSystem = { provider: 'remote' } as unknown as IFileSystemService;
      const createLocalFileSystem = vi.fn(() => localFileSystem);
      const createRemoteFileSystem = vi.fn(() => remoteFileSystem);

      expect(resolveProjectFileSystemProvider(executionLocation)).toBe(expectedProvider);
      expect(createProjectFileSystemService({
        createLocalFileSystem,
        createRemoteFileSystem,
        executionLocation,
      })).toBe(expectedProvider === 'device-mount' ? localFileSystem : remoteFileSystem);
      expect(createLocalFileSystem).toHaveBeenCalledTimes(expectedProvider === 'device-mount' ? 1 : 0);
      expect(createRemoteFileSystem).toHaveBeenCalledTimes(expectedProvider === 'drive-sandbox' ? 1 : 0);
    },
  );
});
