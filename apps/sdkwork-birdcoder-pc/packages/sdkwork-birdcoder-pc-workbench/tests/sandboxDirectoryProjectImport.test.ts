import { describe, expect, it, vi } from 'vitest';
import type { SandboxSelection } from '@sdkwork/drive-pc-sandbox-contracts';
import {
  buildSandboxDirectoryProjectSourceRef,
  importSandboxDirectoryProject,
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
  it('imports once with Workspace and selected Drive identity', async () => {
    const importProject = vi.fn(async () => ({ projectId: 'project-1' }));
    const result = await importSandboxDirectoryProject({
      fallbackProjectName: 'Fallback',
      importPort: { importProject },
      selection,
      workspaceId: 'workspace.default.100',
    });

    expect(result).toEqual({
      projectId: 'project-1',
      projectName: 'demo',
      selection,
    });
    expect(importProject).toHaveBeenCalledTimes(1);
    expect(importProject).toHaveBeenCalledWith({
      driveLogicalPath: 'projects/demo',
      driveRootEntryId: 'entry-projects-demo',
      driveSpaceId: 'sandbox-1',
      name: 'demo',
      sourceKind: 'drive_sandbox',
      sourceRef: 'drive://sandbox-1/entry-projects-demo',
      workspaceId: 'workspace.default.100',
    });
    expect(JSON.stringify(importProject.mock.calls)).not.toMatch(
      /[A-Za-z]:\\|providerRootRef|fileSystemHandle/u,
    );
  });

  it('rejects import when no Workspace is selected', async () => {
    const importProject = vi.fn(async () => ({ projectId: 'project-2' }));

    await expect(importSandboxDirectoryProject({
      fallbackProjectName: 'Fallback',
      importPort: { importProject },
      selection,
      workspaceId: ' ',
    })).rejects.toThrow('Workspace ID is required.');
    expect(importProject).not.toHaveBeenCalled();
  });

  it('builds an encoded stable source reference', () => {
    expect(buildSandboxDirectoryProjectSourceRef({
      ...selection,
      sandboxId: 'space/alpha',
      entryId: 'root beta',
    })).toBe('drive://space%2Falpha/root%20beta');
  });
});
