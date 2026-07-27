import type { SandboxSelection } from '@sdkwork/drive-pc-sandbox-contracts';

interface ProjectIdentifier {
  readonly projectId: string;
}

export interface SandboxDirectoryProjectImportInput {
  readonly driveLogicalPath: string;
  readonly driveRootEntryId: string;
  readonly driveSpaceId: string;
  readonly name: string;
  readonly sourceKind: 'drive_sandbox';
  readonly sourceRef: string;
  readonly workspaceId: string;
}

export interface SandboxDirectoryProjectImportPort {
  importProject(input: SandboxDirectoryProjectImportInput): Promise<ProjectIdentifier>;
}

export interface ProjectDriveCompositionPort {
  bindProjectDrive(
    projectId: string,
    input: {
      readonly driveId: string;
      readonly logicalPath: string;
      readonly rootEntryId: string;
    },
  ): Promise<unknown>;
}

export interface ImportSandboxDirectoryProjectOptions {
  readonly fallbackProjectName: string;
  readonly importPort: SandboxDirectoryProjectImportPort;
  readonly projectName?: string;
  readonly selection: SandboxSelection;
  readonly workspaceId: string;
}

export interface ImportedSandboxDirectoryProject {
  readonly projectId: string;
  readonly projectName: string;
  readonly selection: SandboxSelection;
}

export interface RebindSandboxDirectoryProjectOptions {
  readonly compositionPort: ProjectDriveCompositionPort;
  readonly projectId: string;
  readonly selection: SandboxSelection;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function resolveProjectName(
  selection: SandboxSelection,
  fallbackProjectName: string,
  projectName?: string,
): string {
  return projectName?.trim()
    || selection.directoryName.trim()
    || fallbackProjectName.trim()
    || 'Server project';
}

export function buildSandboxDirectoryProjectSourceRef(
  selection: SandboxSelection,
): string {
  return `drive://${encodeURIComponent(normalizeRequired(selection.sandboxId, 'Drive space ID'))}/${encodeURIComponent(normalizeRequired(selection.entryId, 'Drive root entry ID'))}`;
}

export async function importSandboxDirectoryProject(
  options: ImportSandboxDirectoryProjectOptions,
): Promise<ImportedSandboxDirectoryProject> {
  const workspaceId = normalizeRequired(options.workspaceId, 'Workspace ID');
  const projectName = resolveProjectName(
    options.selection,
    options.fallbackProjectName,
    options.projectName,
  );
  const importedProject = await options.importPort.importProject({
    driveLogicalPath: options.selection.logicalPath.trim(),
    driveRootEntryId: normalizeRequired(options.selection.entryId, 'Drive root entry ID'),
    driveSpaceId: normalizeRequired(options.selection.sandboxId, 'Drive space ID'),
    name: projectName,
    sourceKind: 'drive_sandbox',
    sourceRef: buildSandboxDirectoryProjectSourceRef(options.selection),
    workspaceId,
  });
  const projectId = normalizeRequired(importedProject.projectId, 'Imported Project ID');

  return {
    projectId,
    projectName,
    selection: options.selection,
  };
}

export async function rebindSandboxDirectoryProject(
  options: RebindSandboxDirectoryProjectOptions,
): Promise<void> {
  const projectId = normalizeRequired(options.projectId, 'Project ID');
  await options.compositionPort.bindProjectDrive(projectId, {
    driveId: normalizeRequired(options.selection.sandboxId, 'Drive space ID'),
    logicalPath: options.selection.logicalPath.trim(),
    rootEntryId: normalizeRequired(options.selection.entryId, 'Drive root entry ID'),
  });
}
