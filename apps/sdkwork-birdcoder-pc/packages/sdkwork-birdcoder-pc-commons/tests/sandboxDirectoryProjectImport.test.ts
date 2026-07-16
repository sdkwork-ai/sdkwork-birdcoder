import { describe, expect, it, vi } from 'vitest';
import type { SandboxSelection } from '@sdkwork/drive-pc-sandbox-contracts';
import {
  importSandboxDirectoryProject,
  SandboxDirectoryProjectImportError,
} from '../src/workbench/sandboxDirectoryProjectImport';

const selection: SandboxSelection = {
  sandboxId: 'sandbox-1',
  sandboxDisplayName: 'Deployment workspace',
  entryId: 'entry-projects-demo',
  directoryName: 'demo',
  logicalPath: 'projects/demo',
  displayPath: 'Deployment workspace / projects/demo',
};

describe('importSandboxDirectoryProject', () => {
  it('creates a project and binds only the selected logical Drive identity', async () => {
    const bindProjectWorkspace = vi.fn(async () => undefined);
    const result = await importSandboxDirectoryProject({
      bindingPort: { bindProjectWorkspace },
      createProject: vi.fn(async () => ({ id: 'project-1' })),
      fallbackProjectName: 'Fallback',
      selection,
    });

    expect(result).toEqual({
      projectId: 'project-1',
      projectName: 'demo',
      selection,
    });
    expect(bindProjectWorkspace).toHaveBeenCalledWith('project-1', selection);
    expect(JSON.stringify(result)).not.toMatch(/[A-Za-z]:\\|providerRootRef|fileSystemHandle/u);
  });

  it('deletes only the newly created project when binding fails', async () => {
    const deleteCreatedProject = vi.fn(async () => undefined);
    await expect(importSandboxDirectoryProject({
      bindingPort: {
        bindProjectWorkspace: vi.fn(async () => {
          throw new Error('Drive grant is no longer available.');
        }),
      },
      createProject: vi.fn(async () => ({ id: 'project-2' })),
      deleteCreatedProject,
      fallbackProjectName: 'Fallback',
      selection,
    })).rejects.toMatchObject({
      message: 'Drive grant is no longer available.',
      projectId: 'project-2',
    });
    expect(deleteCreatedProject).toHaveBeenCalledWith('project-2');
  });

  it('preserves cleanup failure evidence without masking the binding error', async () => {
    let caught: unknown;
    try {
      await importSandboxDirectoryProject({
        bindingPort: {
          bindProjectWorkspace: vi.fn(async () => {
            throw new Error('Binding rejected.');
          }),
        },
        createProject: vi.fn(async () => ({ id: 'project-3' })),
        deleteCreatedProject: vi.fn(async () => {
          throw new Error('Cleanup rejected.');
        }),
        fallbackProjectName: 'Fallback',
        selection,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(SandboxDirectoryProjectImportError);
    expect(caught).toMatchObject({
      message: 'Binding rejected.',
      projectId: 'project-3',
      cleanupError: expect.objectContaining({ message: 'Cleanup rejected.' }),
    });
  });
});
