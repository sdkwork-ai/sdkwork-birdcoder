import type { SandboxSelection } from '@sdkwork/drive-pc-sandbox-contracts';

interface ProjectIdentifier {
  readonly id: string;
}

export interface ProjectWorkspaceBindingPort {
  bindProjectWorkspace(
    projectId: string,
    selection: SandboxSelection,
  ): Promise<void>;
}

export interface ImportSandboxDirectoryProjectOptions {
  readonly bindingPort: ProjectWorkspaceBindingPort;
  readonly createProject: (name: string) => Promise<ProjectIdentifier>;
  readonly deleteCreatedProject?: (projectId: string) => Promise<void>;
  readonly fallbackProjectName: string;
  readonly selection: SandboxSelection;
}

export interface ImportedSandboxDirectoryProject {
  readonly projectId: string;
  readonly projectName: string;
  readonly selection: SandboxSelection;
}

export interface RebindSandboxDirectoryProjectOptions {
  readonly bindingPort: ProjectWorkspaceBindingPort;
  readonly projectId: string;
  readonly selection: SandboxSelection;
}

export class SandboxDirectoryProjectImportError extends Error {
  readonly cleanupError: unknown;
  readonly projectId: string;

  constructor(projectId: string, cause: unknown, cleanupError: unknown = null) {
    const reason = cause instanceof Error && cause.message.trim()
      ? cause.message.trim()
      : 'The server directory could not be bound to the project.';
    super(reason, { cause });
    this.name = 'SandboxDirectoryProjectImportError';
    this.cleanupError = cleanupError;
    this.projectId = projectId;
  }
}

function resolveProjectName(selection: SandboxSelection, fallbackProjectName: string): string {
  return selection.directoryName.trim()
    || fallbackProjectName.trim()
    || 'Server project';
}

export async function importSandboxDirectoryProject(
  options: ImportSandboxDirectoryProjectOptions,
): Promise<ImportedSandboxDirectoryProject> {
  const projectName = resolveProjectName(options.selection, options.fallbackProjectName);
  const projectId = (await options.createProject(projectName)).id.trim();
  if (!projectId) {
    throw new Error('Project creation returned an empty project id.');
  }

  try {
    await options.bindingPort.bindProjectWorkspace(projectId, options.selection);
  } catch (error) {
    let cleanupError: unknown = null;
    if (options.deleteCreatedProject) {
      try {
        await options.deleteCreatedProject(projectId);
      } catch (deleteError) {
        cleanupError = deleteError;
      }
    }
    throw new SandboxDirectoryProjectImportError(projectId, error, cleanupError);
  }

  return {
    projectId,
    projectName,
    selection: options.selection,
  };
}

export async function rebindSandboxDirectoryProject(
  options: RebindSandboxDirectoryProjectOptions,
): Promise<void> {
  const projectId = options.projectId.trim();
  if (!projectId) {
    throw new Error('Project id is required to bind a server directory.');
  }
  await options.bindingPort.bindProjectWorkspace(projectId, options.selection);
}
