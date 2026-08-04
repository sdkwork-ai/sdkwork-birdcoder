import { describe, expect, it } from 'vitest';

import type { IFileSystemService } from '../interfaces/IFileSystemService.ts';
import { normalizeProjectRuntimeLocationInput } from '../interfaces/IProjectRuntimeLocationService.ts';
import { RuntimeProjectRuntimeLocationService } from './RuntimeProjectRuntimeLocationService.ts';

const savedProjectPath = 'E:\\sdkwork-space\\sdkwork-birdcoder';

function recoverableFileSystemService() {
  let isRestored = false;
  let restoreCount = 0;
  return {
    fileSystemService: {
      getProjectMountState: async () => ({
        displayName: 'sdkwork-birdcoder',
        host: 'tauri' as const,
        status: isRestored ? 'mounted' as const : 'recoverable' as const,
      }),
      resolveLocalWorkingDirectory: async () => (isRestored ? savedProjectPath : null),
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
    } as unknown as IFileSystemService,
    restoreCount: () => restoreCount,
  };
}

describe('RuntimeProjectRuntimeLocationService', () => {
  it('recovers a recoverable mount and reports the recovered local working directory', async () => {
    const { fileSystemService, restoreCount } = recoverableFileSystemService();
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

    expect(restoreCount()).toBe(1);
    expect(resolution).toEqual({
      location: {
        localWorkingDirectory: savedProjectPath,
        projectId: 'project.339967887101923328',
        source: 'recovered_mount',
      },
      status: 'resolved',
    });
  });

  it('normalizes project runtime location inputs', () => {
    const project = {
      name: 'sdkwork-birdcoder',
      projectId: ' project.339967887101923328 ',
    };
    expect(normalizeProjectRuntimeLocationInput(project)).toEqual({
      projectId: 'project.339967887101923328',
    });
    expect(normalizeProjectRuntimeLocationInput({
      mountedPath: ' /sdkwork-birdcoder/apps/sdkwork-birdcoder-pc ',
      projectId: project.projectId,
    })).toEqual({
      mountedPath: '/sdkwork-birdcoder/apps/sdkwork-birdcoder-pc',
      projectId: 'project.339967887101923328',
    });
    expect(normalizeProjectRuntimeLocationInput('   ')).toBeNull();
  });

  it('resolves an active mounted project path without triggering mount recovery', async () => {
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
        throw new Error('An active project path must not trigger mount recovery.');
      },
    } as unknown as IFileSystemService;
    const activeService = new RuntimeProjectRuntimeLocationService({
      executionLocation: 'local-host',
      fileSystemService: activeFileSystemService,
    });
    const resolvedNestedPath = await activeService.resolveProjectLocalWorkingDirectory(
      {
        mountedPath: nestedMountedPath,
        projectId: 'project.339967887101923328',
      },
      {
        allowFolderSelection: false,
        capability: 'terminal',
      },
    );

    expect(resolvedNestedPath).toBe(nestedSystemPath);
    expect(nestedPathRequests).toEqual([{
      mountedPath: nestedMountedPath,
      projectId: 'project.339967887101923328',
    }]);
  });

  it('recovers the mount before revealing a project in the file manager', async () => {
    const nestedMountedPath = '/sdkwork-birdcoder/apps/sdkwork-birdcoder-pc';
    const nestedSystemPath = `${savedProjectPath}\\apps\\sdkwork-birdcoder-pc`;
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
      resolveLocalWorkingDirectory: async () => (revealMountRestored ? nestedSystemPath : null),
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

    expect(await revealService.revealProjectInFileManager({
      mountedPath: nestedMountedPath,
      projectId: 'project.339967887101923328',
    })).toBe(true);
    expect(revealRestoreCount).toBe(1);
    expect(folderPickerCallCount).toBe(0);
    expect(revealRequests).toEqual([{
      mountedPath: nestedMountedPath,
      projectId: 'project.339967887101923328',
    }]);
  });
});
