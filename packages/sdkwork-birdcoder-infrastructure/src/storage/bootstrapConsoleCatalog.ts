import type {
  BirdCoderConsoleRepositories,
  BirdCoderRepresentativeProjectRecord,
  BirdCoderWorkspaceRecord,
} from './appConsoleRepository.ts';

export const BIRDCODER_DEFAULT_WORKSPACE_ID = 'workspace-default';
export const BIRDCODER_DEFAULT_WORKSPACE_NAME = 'Default Workspace';
export const BIRDCODER_DEFAULT_PROJECT_ID = 'project-default';
export const BIRDCODER_DEFAULT_PROJECT_NAME = 'Starter Project';

function createTimestamp(): string {
  return new Date().toISOString();
}

export function resolveBirdCoderBootstrapProjectId(workspaceId: string): string {
  return workspaceId === BIRDCODER_DEFAULT_WORKSPACE_ID
    ? BIRDCODER_DEFAULT_PROJECT_ID
    : `project-starter-${workspaceId}`;
}

export function createBirdCoderBootstrapWorkspaceRecord(
  ownerIdentityId: string,
): BirdCoderWorkspaceRecord {
  const now = createTimestamp();
  return {
    id: BIRDCODER_DEFAULT_WORKSPACE_ID,
    name: BIRDCODER_DEFAULT_WORKSPACE_NAME,
    description: 'Primary local workspace for BirdCoder.',
    ownerIdentityId,
    createdAt: now,
    updatedAt: now,
  };
}

export function createBirdCoderBootstrapProjectRecord(
  workspaceId: string,
): BirdCoderRepresentativeProjectRecord {
  const now = createTimestamp();
  return {
    id: resolveBirdCoderBootstrapProjectId(workspaceId),
    workspaceId,
    name: BIRDCODER_DEFAULT_PROJECT_NAME,
    description: 'Starter project provisioned for first-run BirdCoder workflows.',
    rootPath: undefined,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
}

async function ensureBootstrapWorkspace(
  repositories: BirdCoderConsoleRepositories,
  ownerIdentityId: string,
): Promise<BirdCoderWorkspaceRecord> {
  const existingWorkspaces = await repositories.workspaces.list();
  const resolvedWorkspace =
    existingWorkspaces.find((workspace) => workspace.id === BIRDCODER_DEFAULT_WORKSPACE_ID) ??
    existingWorkspaces[0];
  if (resolvedWorkspace) {
    return resolvedWorkspace;
  }

  const persistedWorkspace = await repositories.workspaces.save(
    createBirdCoderBootstrapWorkspaceRecord(ownerIdentityId),
  );
  return persistedWorkspace;
}

async function ensureBootstrapProject(
  repositories: BirdCoderConsoleRepositories,
  workspaceId: string,
): Promise<BirdCoderRepresentativeProjectRecord> {
  const existingProjects = await repositories.projects.list();
  const resolvedProject = existingProjects.find((project) => project.workspaceId === workspaceId);
  if (resolvedProject) {
    return resolvedProject;
  }

  const persistedProject = await repositories.projects.save(
    createBirdCoderBootstrapProjectRecord(workspaceId),
  );
  return persistedProject;
}

export interface EnsureBirdCoderBootstrapConsoleCatalogOptions {
  defaultOwnerIdentityId?: string;
  repositories: BirdCoderConsoleRepositories;
}

export interface BirdCoderBootstrapConsoleCatalog {
  project: BirdCoderRepresentativeProjectRecord;
  projects: BirdCoderRepresentativeProjectRecord[];
  workspace: BirdCoderWorkspaceRecord;
  workspaces: BirdCoderWorkspaceRecord[];
}

export async function ensureBirdCoderBootstrapConsoleCatalog({
  defaultOwnerIdentityId = 'identity-local-default',
  repositories,
}: EnsureBirdCoderBootstrapConsoleCatalogOptions): Promise<BirdCoderBootstrapConsoleCatalog> {
  const workspace = await ensureBootstrapWorkspace(repositories, defaultOwnerIdentityId);
  const project = await ensureBootstrapProject(repositories, workspace.id);
  const [workspaces, projects] = await Promise.all([
    repositories.workspaces.list(),
    repositories.projects.list(),
  ]);

  return {
    project,
    projects,
    workspace,
    workspaces,
  };
}
