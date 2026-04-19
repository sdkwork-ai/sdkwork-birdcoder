import type {
  BirdCoderConsoleRepositories,
  BirdCoderWorkspaceRecord,
} from './appConsoleRepository.ts';

export const BIRDCODER_DEFAULT_WORKSPACE_ID = 'workspace-default';
export const BIRDCODER_DEFAULT_WORKSPACE_NAME = 'Default Workspace';

function createTimestamp(): string {
  return new Date().toISOString();
}

export function createBirdCoderBootstrapWorkspaceRecord(
  ownerUserId: string,
): BirdCoderWorkspaceRecord {
  const now = createTimestamp();
  return {
    id: BIRDCODER_DEFAULT_WORKSPACE_ID,
    uuid: BIRDCODER_DEFAULT_WORKSPACE_ID,
    tenantId: 'tenant-local-default',
    code: 'workspace-default',
    title: BIRDCODER_DEFAULT_WORKSPACE_NAME,
    name: BIRDCODER_DEFAULT_WORKSPACE_NAME,
    description: 'Primary local workspace for BirdCoder.',
    ownerId: ownerUserId,
    leaderId: ownerUserId,
    createdByUserId: ownerUserId,
    type: 'DEFAULT',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
}

async function ensureBootstrapWorkspace(
  repositories: BirdCoderConsoleRepositories,
  ownerUserId: string,
): Promise<BirdCoderWorkspaceRecord> {
  const existingWorkspaces = await repositories.workspaces.list();
  const resolvedWorkspace =
    existingWorkspaces.find((workspace) => workspace.id === BIRDCODER_DEFAULT_WORKSPACE_ID) ??
    existingWorkspaces[0];
  if (resolvedWorkspace) {
    return resolvedWorkspace;
  }

  const persistedWorkspace = await repositories.workspaces.save(
    createBirdCoderBootstrapWorkspaceRecord(ownerUserId),
  );
  return persistedWorkspace;
}

export interface EnsureBirdCoderBootstrapConsoleCatalogOptions {
  defaultOwnerUserId?: string;
  repositories: BirdCoderConsoleRepositories;
}

export interface BirdCoderBootstrapConsoleCatalog {
  workspace: BirdCoderWorkspaceRecord;
  projects: Awaited<ReturnType<BirdCoderConsoleRepositories['projects']['list']>>;
  workspaces: BirdCoderWorkspaceRecord[];
}

export async function ensureBirdCoderBootstrapConsoleCatalog({
  defaultOwnerUserId = 'user-local-default',
  repositories,
}: EnsureBirdCoderBootstrapConsoleCatalogOptions): Promise<BirdCoderBootstrapConsoleCatalog> {
  const workspace = await ensureBootstrapWorkspace(repositories, defaultOwnerUserId);
  const [workspaces, projects] = await Promise.all([
    repositories.workspaces.list(),
    repositories.projects.list(),
  ]);

  return {
    projects,
    workspace,
    workspaces,
  };
}
