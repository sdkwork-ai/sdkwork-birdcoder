import { describe, expect, it, vi } from 'vitest';
import {
  importLocalFolderProject,
  LocalFolderProjectImportError,
} from '../src/workbench/localFolderProjectImport';

describe('importLocalFolderProject', () => {
  it('creates an Agents Project and binds the selected device folder', async () => {
    const ensureProject = vi.fn(async () => ({
      projectId: 'project-local-1',
      reusedExistingProject: false,
    }));
    const bindLocalProjectRuntimeLocation = vi.fn(async (projectId: string) => ({
      host: 'tauri' as const,
      projectId,
      runtimeLocationId: 'runtime-location-1',
      status: 'bound' as const,
    }));
    const result = await importLocalFolderProject({
      bindLocalProjectRuntimeLocation,
      ensureProject,
      fallbackProjectName: 'Fallback',
      folderInfo: { type: 'tauri', path: 'E:\\projects\\bird-demo' },
    });

    expect(result).toEqual({
      localMount: { displayName: 'bird-demo', type: 'tauri' },
      projectId: 'project-local-1',
      projectName: 'bird-demo',
      reusedExistingProject: false,
    });
    expect(ensureProject).toHaveBeenCalledWith('bird-demo');
    expect(bindLocalProjectRuntimeLocation).toHaveBeenCalledWith(
      'project-local-1',
      { type: 'tauri', path: 'E:\\projects\\bird-demo' },
    );
  });

  it('keeps an explicit Project name separate from the selected folder name', async () => {
    const ensureProject = vi.fn(async () => ({
      projectId: 'project-local-named',
      reusedExistingProject: false,
    }));

    const result = await importLocalFolderProject({
      bindLocalProjectRuntimeLocation: vi.fn(async (projectId: string) => ({
        host: 'tauri' as const,
        projectId,
        runtimeLocationId: 'runtime-location-named',
        status: 'bound' as const,
      })),
      ensureProject,
      fallbackProjectName: 'Fallback',
      folderInfo: { type: 'tauri', path: 'E:\\projects\\bird-demo' },
      projectName: 'My Bird Project',
    });

    expect(ensureProject).toHaveBeenCalledWith('My Bird Project');
    expect(result).toMatchObject({
      localMount: { displayName: 'bird-demo', type: 'tauri' },
      projectName: 'My Bird Project',
    });
  });

  it('keeps the newly created Project for retry when local folder binding fails', async () => {
    await expect(importLocalFolderProject({
      bindLocalProjectRuntimeLocation: vi.fn(async (projectId: string) => ({
        code: 'persistence_failed' as const,
        message: 'Folder permission could not be retained.',
        projectId,
        status: 'failed' as const,
      })),
      ensureProject: vi.fn(async () => ({
        projectId: 'project-local-2',
        reusedExistingProject: false,
      })),
      fallbackProjectName: 'Fallback',
      folderInfo: { type: 'tauri', path: 'E:\\projects\\permission-failure' },
    })).rejects.toMatchObject({
      cleanupError: null,
      message: 'Folder permission could not be retained.',
      name: 'LocalFolderProjectImportError',
      projectId: 'project-local-2',
    });
  });

  it('preserves binding diagnostics without attempting remote compensation', async () => {
    try {
      await importLocalFolderProject({
        bindLocalProjectRuntimeLocation: vi.fn(async () => {
          throw new Error('Folder binding failed.');
        }),
        ensureProject: vi.fn(async () => ({
          projectId: 'project-local-3',
          reusedExistingProject: false,
        })),
        fallbackProjectName: 'Fallback',
        folderInfo: { type: 'tauri', path: 'E:\\projects\\cleanup-failure' },
      });
      throw new Error('Expected local folder import to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(LocalFolderProjectImportError);
      expect(error).toMatchObject({
        cleanupError: null,
        message: 'Folder binding failed.',
        projectId: 'project-local-3',
      });
    }
  });

  it('reuses a same-name Workspace Project and reports the reuse', async () => {
    const result = await importLocalFolderProject({
      bindLocalProjectRuntimeLocation: vi.fn(async (projectId: string) => ({
        host: 'tauri' as const,
        projectId,
        runtimeLocationId: 'runtime-location-existing',
        status: 'bound' as const,
      })),
      ensureProject: vi.fn(async () => ({
        projectId: 'project-existing',
        reusedExistingProject: true,
      })),
      fallbackProjectName: 'Fallback',
      folderInfo: { type: 'tauri', path: 'E:\\projects\\bird-demo' },
    });
    expect(result).toMatchObject({
      projectId: 'project-existing',
      reusedExistingProject: true,
    });
  });
});
