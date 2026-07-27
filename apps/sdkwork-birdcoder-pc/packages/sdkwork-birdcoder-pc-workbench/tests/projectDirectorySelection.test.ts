import { describe, expect, it, vi } from 'vitest';
import type { SandboxSelection } from '@sdkwork/drive-pc-sandbox-contracts';
import type { BirdCoderExecutionLocation } from '@sdkwork/birdcoder-pc-infrastructure-runtime/runtimeTopology';
import {
  importSelectedProjectDirectory,
  rebindSelectedProjectDirectory,
  resolveProjectDirectorySelectionName,
  selectProjectDirectory,
} from '../src/workbench/projectDirectorySelection';

const sandboxSelection: SandboxSelection = {
  sandboxId: 'sandbox-1',
  sandboxDisplayName: 'Browser workspace',
  entryId: 'entry-project',
  directoryName: 'browser-project',
  logicalPath: 'projects/browser-project',
  displayPath: 'Browser workspace / projects/browser-project',
};

describe('projectDirectorySelection', () => {
  it('uses only the Drive sandbox picker for Browser cloud execution', async () => {
    const pickLocalDirectory = vi.fn(async () => ({ status: 'cancelled' as const }));
    const pickSandboxDirectory = vi.fn(async () => sandboxSelection);

    const selection = await selectProjectDirectory({
      pickSandboxDirectory,
      sandboxPickerTitle: 'Select server directory',
      runtime: {
        pickLocalDirectory,
        resolveExecutionLocation: () => 'cloud-workspace',
      },
    });

    expect(selection).toEqual({
      kind: 'drive_sandbox',
      selection: sandboxSelection,
    });
    expect(pickSandboxDirectory).toHaveBeenCalledWith({
      title: 'Select server directory',
    });
    expect(pickLocalDirectory).not.toHaveBeenCalled();
  });

  it('uses only the host directory picker for standalone Tauri execution', async () => {
    const pickSandboxDirectory = vi.fn(async () => sandboxSelection);
    const source = { type: 'tauri' as const, path: 'E:\\projects\\desktop-project' };

    const selection = await selectProjectDirectory({
      pickSandboxDirectory,
      sandboxPickerTitle: 'Select server directory',
      runtime: {
        pickLocalDirectory: vi.fn(async () => ({ status: 'selected' as const, source })),
        resolveExecutionLocation: () => 'local-host',
      },
    });

    expect(selection).toEqual({ kind: 'local_folder', source });
    expect(pickSandboxDirectory).not.toHaveBeenCalled();
  });

  it('uses Drive instead of a local folder picker for cloud Tauri execution', async () => {
    const pickLocalDirectory = vi.fn(async () => ({
      status: 'selected' as const,
      source: { type: 'tauri' as const, path: 'E:\\projects\\wrong-local-project' },
    }));
    const pickSandboxDirectory = vi.fn(async () => sandboxSelection);

    const selection = await selectProjectDirectory({
      pickSandboxDirectory,
      sandboxPickerTitle: 'Select server directory',
      runtime: {
        pickLocalDirectory,
        resolveExecutionLocation: () => 'cloud-workspace',
      },
    });

    expect(selection).toEqual({
      kind: 'drive_sandbox',
      selection: sandboxSelection,
    });
    expect(pickLocalDirectory).not.toHaveBeenCalled();
  });

  it('does not create a selection after either picker is cancelled', async () => {
    const browserSelection = await selectProjectDirectory({
      pickSandboxDirectory: vi.fn(async () => null),
      sandboxPickerTitle: 'Select server directory',
      runtime: {
        pickLocalDirectory: vi.fn(async () => ({ status: 'cancelled' as const })),
        resolveExecutionLocation: () => 'cloud-workspace',
      },
    });
    const desktopSelection = await selectProjectDirectory({
      pickSandboxDirectory: vi.fn(async () => sandboxSelection),
      sandboxPickerTitle: 'Select server directory',
      runtime: {
        pickLocalDirectory: vi.fn(async () => ({ status: 'cancelled' as const })),
        resolveExecutionLocation: () => 'local-host',
      },
    });

    expect(browserSelection).toBeNull();
    expect(desktopSelection).toBeNull();
  });

  it('rejects unsupported execution locations without invoking either picker', async () => {
    const pickLocalDirectory = vi.fn(async () => ({ status: 'cancelled' as const }));
    const pickSandboxDirectory = vi.fn(async () => sandboxSelection);

    await expect(selectProjectDirectory({
      pickSandboxDirectory,
      sandboxPickerTitle: 'Select server directory',
      runtime: {
        pickLocalDirectory,
        resolveExecutionLocation: () => 'future-location' as BirdCoderExecutionLocation,
      },
    })).rejects.toThrow(
      'Unsupported project directory execution location: future-location.',
    );
    expect(pickLocalDirectory).not.toHaveBeenCalled();
    expect(pickSandboxDirectory).not.toHaveBeenCalled();
  });

  it('imports a Browser selection with complete Drive identity', async () => {
    const importProject = vi.fn(async () => ({ projectId: 'project-browser' }));
    const ensureProject = vi.fn(async () => ({
      projectId: 'unexpected-local-project',
      reusedExistingProject: false,
    }));
    const bindLocalProjectRuntimeLocation = vi.fn(async (projectId: string) => ({
      host: 'tauri' as const,
      projectId,
      runtimeLocationId: 'unexpected-runtime-location',
      status: 'bound' as const,
    }));

    const result = await importSelectedProjectDirectory({
      bindLocalProjectRuntimeLocation,
      ensureProject,
      fallbackProjectName: 'Fallback',
      importPort: { importProject },
      selection: { kind: 'drive_sandbox', selection: sandboxSelection },
      workspaceId: 'workspace-1',
    });

    expect(result).toMatchObject({
      projectId: 'project-browser',
      projectName: 'browser-project',
    });
    expect(importProject).toHaveBeenCalledWith({
      driveLogicalPath: 'projects/browser-project',
      driveRootEntryId: 'entry-project',
      driveSpaceId: 'sandbox-1',
      name: 'browser-project',
      sourceKind: 'drive_sandbox',
      sourceRef: 'drive://sandbox-1/entry-project',
      workspaceId: 'workspace-1',
    });
    expect(ensureProject).not.toHaveBeenCalled();
    expect(bindLocalProjectRuntimeLocation).not.toHaveBeenCalled();
  });

  it('creates and binds a Tauri Project with the exact local path', async () => {
    const source = { type: 'tauri' as const, path: 'E:\\projects\\desktop-project' };
    const ensureProject = vi.fn(async () => ({
      projectId: 'project-desktop',
      reusedExistingProject: false,
    }));
    const bindLocalProjectRuntimeLocation = vi.fn(async (projectId: string) => ({
      host: 'tauri' as const,
      projectId,
      runtimeLocationId: 'runtime-location-desktop',
      status: 'bound' as const,
    }));
    const importProject = vi.fn(async () => ({ projectId: 'unexpected-drive-project' }));

    const result = await importSelectedProjectDirectory({
      bindLocalProjectRuntimeLocation,
      ensureProject,
      fallbackProjectName: 'Fallback',
      importPort: { importProject },
      selection: { kind: 'local_folder', source },
      workspaceId: 'workspace-1',
    });

    expect(result).toMatchObject({
      projectId: 'project-desktop',
      projectName: 'desktop-project',
    });
    expect(ensureProject).toHaveBeenCalledWith('desktop-project');
    expect(bindLocalProjectRuntimeLocation).toHaveBeenCalledWith('project-desktop', source);
    expect(importProject).not.toHaveBeenCalled();
    expect(resolveProjectDirectorySelectionName(
      { kind: 'local_folder', source },
      'Fallback',
    )).toBe('desktop-project');
  });

  it('rebinds a Browser Project through Drive composition only', async () => {
    const bindProjectDrive = vi.fn(async () => undefined);
    const bindLocalProjectRuntimeLocation = vi.fn(async (projectId: string) => ({
      host: 'tauri' as const,
      projectId,
      runtimeLocationId: 'unexpected-runtime-location',
      status: 'bound' as const,
    }));

    const result = await rebindSelectedProjectDirectory({
      bindLocalProjectRuntimeLocation,
      compositionPort: { bindProjectDrive },
      fallbackProjectName: 'Fallback',
      projectId: 'project-browser',
      selection: { kind: 'drive_sandbox', selection: sandboxSelection },
    });

    expect(result.projectName).toBe('browser-project');
    expect(bindProjectDrive).toHaveBeenCalledWith('project-browser', {
      driveId: 'sandbox-1',
      logicalPath: 'projects/browser-project',
      rootEntryId: 'entry-project',
    });
    expect(bindLocalProjectRuntimeLocation).not.toHaveBeenCalled();
  });

  it('rebinds a Tauri Project through the local runtime location only', async () => {
    const source = { type: 'tauri' as const, path: 'E:\\projects\\desktop-project' };
    const bindProjectDrive = vi.fn(async () => undefined);
    const bindLocalProjectRuntimeLocation = vi.fn(async (projectId: string) => ({
      host: 'tauri' as const,
      projectId,
      runtimeLocationId: 'runtime-location-desktop',
      status: 'bound' as const,
    }));

    const result = await rebindSelectedProjectDirectory({
      bindLocalProjectRuntimeLocation,
      compositionPort: { bindProjectDrive },
      fallbackProjectName: 'Fallback',
      projectId: 'project-desktop',
      selection: { kind: 'local_folder', source },
    });

    expect(result.projectName).toBe('desktop-project');
    expect(bindLocalProjectRuntimeLocation).toHaveBeenCalledWith('project-desktop', source);
    expect(bindProjectDrive).not.toHaveBeenCalled();
  });
});
