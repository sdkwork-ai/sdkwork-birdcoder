import type {
  LocalFolderMountSource,
  LocalFolderPickerResult,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type { SandboxSelection } from '@sdkwork/drive-pc-sandbox-contracts';
import {
  isDesktopLocalFolderPickerRuntime,
  openLocalFolder,
  resolveSelectedLocalFolderSource,
} from '../utils/fileSystem.ts';
import {
  importLocalFolderProject,
  rebindLocalFolderProject,
  resolveLocalFolderMountDisplayName,
  type ImportLocalFolderProjectOptions,
} from './localFolderProjectImport.ts';
import {
  importSandboxDirectoryProject,
  rebindSandboxDirectoryProject,
  type ProjectDriveCompositionPort,
  type SandboxDirectoryProjectImportPort,
} from './sandboxDirectoryProjectImport.ts';

export type ProjectDirectorySelection =
  | {
      readonly kind: 'drive_sandbox';
      readonly selection: SandboxSelection;
    }
  | {
      readonly kind: 'local_folder';
      readonly source: LocalFolderMountSource;
    };

interface ProjectDirectorySelectionRuntime {
  readonly isDesktopRuntime: () => Promise<boolean>;
  readonly pickLocalDirectory: () => Promise<LocalFolderPickerResult>;
}

export interface SelectProjectDirectoryOptions {
  readonly pickSandboxDirectory: (options: {
    readonly title: string;
  }) => Promise<SandboxSelection | null>;
  readonly sandboxPickerTitle: string;
  readonly runtime?: ProjectDirectorySelectionRuntime;
}

export interface ImportSelectedProjectDirectoryOptions {
  readonly bindLocalProjectRuntimeLocation: ImportLocalFolderProjectOptions['bindLocalProjectRuntimeLocation'];
  readonly ensureProject: ImportLocalFolderProjectOptions['ensureProject'];
  readonly fallbackProjectName: string;
  readonly importPort: SandboxDirectoryProjectImportPort;
  readonly projectName?: string;
  readonly selection: ProjectDirectorySelection;
  readonly workspaceId: string;
}

export interface ImportedProjectDirectory {
  readonly projectId: string;
  readonly projectName: string;
  readonly selection: ProjectDirectorySelection;
}

export interface RebindSelectedProjectDirectoryOptions {
  readonly bindLocalProjectRuntimeLocation: ImportLocalFolderProjectOptions['bindLocalProjectRuntimeLocation'];
  readonly compositionPort: ProjectDriveCompositionPort;
  readonly fallbackProjectName: string;
  readonly projectId: string;
  readonly selection: ProjectDirectorySelection;
}

const defaultSelectionRuntime: ProjectDirectorySelectionRuntime = {
  isDesktopRuntime: isDesktopLocalFolderPickerRuntime,
  pickLocalDirectory: openLocalFolder,
};

export async function selectProjectDirectory(
  options: SelectProjectDirectoryOptions,
): Promise<ProjectDirectorySelection | null> {
  const runtime = options.runtime ?? defaultSelectionRuntime;
  if (await runtime.isDesktopRuntime()) {
    const source = resolveSelectedLocalFolderSource(await runtime.pickLocalDirectory());
    return source
      ? {
          kind: 'local_folder',
          source,
        }
      : null;
  }

  const selection = await options.pickSandboxDirectory({
    title: options.sandboxPickerTitle,
  });
  return selection
    ? {
        kind: 'drive_sandbox',
        selection,
      }
    : null;
}

export function resolveProjectDirectorySelectionName(
  selection: ProjectDirectorySelection,
  fallbackProjectName: string,
): string {
  if (selection.kind === 'drive_sandbox') {
    return selection.selection.directoryName.trim() || fallbackProjectName;
  }

  return resolveLocalFolderMountDisplayName(selection.source, fallbackProjectName);
}

export async function importSelectedProjectDirectory(
  options: ImportSelectedProjectDirectoryOptions,
): Promise<ImportedProjectDirectory> {
  if (options.selection.kind === 'drive_sandbox') {
    const importedProject = await importSandboxDirectoryProject({
      fallbackProjectName: options.fallbackProjectName,
      importPort: options.importPort,
      projectName: options.projectName,
      selection: options.selection.selection,
      workspaceId: options.workspaceId,
    });
    return {
      projectId: importedProject.projectId,
      projectName: importedProject.projectName,
      selection: options.selection,
    };
  }

  const importedProject = await importLocalFolderProject({
    bindLocalProjectRuntimeLocation: options.bindLocalProjectRuntimeLocation,
    ensureProject: options.ensureProject,
    fallbackProjectName: options.fallbackProjectName,
    folderInfo: options.selection.source,
    projectName: options.projectName,
  });
  return {
    projectId: importedProject.projectId,
    projectName: importedProject.projectName,
    selection: options.selection,
  };
}

export async function rebindSelectedProjectDirectory(
  options: RebindSelectedProjectDirectoryOptions,
): Promise<ImportedProjectDirectory> {
  if (options.selection.kind === 'drive_sandbox') {
    await rebindSandboxDirectoryProject({
      compositionPort: options.compositionPort,
      projectId: options.projectId,
      selection: options.selection.selection,
    });
    return {
      projectId: options.projectId,
      projectName: resolveProjectDirectorySelectionName(
        options.selection,
        options.fallbackProjectName,
      ),
      selection: options.selection,
    };
  }

  const reboundProject = await rebindLocalFolderProject({
    bindLocalProjectRuntimeLocation: options.bindLocalProjectRuntimeLocation,
    fallbackProjectName: options.fallbackProjectName,
    folderInfo: options.selection.source,
    projectId: options.projectId,
  });
  return {
    projectId: reboundProject.projectId,
    projectName: reboundProject.projectName,
    selection: options.selection,
  };
}
