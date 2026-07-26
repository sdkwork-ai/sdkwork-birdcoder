import { describe, expect, it, vi } from 'vitest';
import {
  importLocalFolderProject,
  LocalFolderProjectImportError,
} from '../src/workbench/localFolderProjectImport';

describe('importLocalFolderProject', () => {
  it('creates an Agents Project and binds the selected device folder', async () => {
    const createProject = vi.fn(async () => ({ projectId: 'project-local-1' }));
    const bindLocalProjectRuntimeLocation = vi.fn(async (projectId: string) => ({
      host: 'tauri' as const,
      projectId,
      runtimeLocationId: 'runtime-location-1',
      status: 'bound' as const,
    }));
    const deleteCreatedProject = vi.fn(async () => undefined);

    const result = await importLocalFolderProject({
      bindLocalProjectRuntimeLocation,
      createProject,
      deleteCreatedProject,
      fallbackProjectName: 'Fallback',
      folderInfo: { type: 'tauri', path: 'E:\\projects\\bird-demo' },
    });

    expect(result).toEqual({
      localMount: { displayName: 'bird-demo', type: 'tauri' },
      projectId: 'project-local-1',
      projectName: 'bird-demo',
      reusedExistingProject: false,
    });
    expect(createProject).toHaveBeenCalledWith('bird-demo');
    expect(bindLocalProjectRuntimeLocation).toHaveBeenCalledWith(
      'project-local-1',
      { type: 'tauri', path: 'E:\\projects\\bird-demo' },
    );
    expect(deleteCreatedProject).not.toHaveBeenCalled();
  });

  it('deletes the newly created Project when local folder binding fails', async () => {
    const deleteCreatedProject = vi.fn(async () => undefined);

    await expect(importLocalFolderProject({
      bindLocalProjectRuntimeLocation: vi.fn(async (projectId: string) => ({
        code: 'persistence_failed' as const,
        message: 'Folder permission could not be retained.',
        projectId,
        status: 'failed' as const,
      })),
      createProject: vi.fn(async () => ({ projectId: 'project-local-2' })),
      deleteCreatedProject,
      fallbackProjectName: 'Fallback',
      folderInfo: { type: 'tauri', path: 'E:\\projects\\permission-failure' },
    })).rejects.toMatchObject({
      cleanupError: null,
      message: 'Folder permission could not be retained.',
      name: 'LocalFolderProjectImportError',
      projectId: 'project-local-2',
    });
    expect(deleteCreatedProject).toHaveBeenCalledWith('project-local-2');
  });

  it('preserves cleanup diagnostics when compensation also fails', async () => {
    const cleanupError = new Error('Project cleanup failed.');

    try {
      await importLocalFolderProject({
        bindLocalProjectRuntimeLocation: vi.fn(async () => {
          throw new Error('Folder binding failed.');
        }),
        createProject: vi.fn(async () => ({ projectId: 'project-local-3' })),
        deleteCreatedProject: vi.fn(async () => {
          throw cleanupError;
        }),
        fallbackProjectName: 'Fallback',
        folderInfo: { type: 'tauri', path: 'E:\\projects\\cleanup-failure' },
      });
      throw new Error('Expected local folder import to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(LocalFolderProjectImportError);
      expect(error).toMatchObject({
        cleanupError,
        message: 'Folder binding failed.',
        projectId: 'project-local-3',
      });
    }
  });
});
