import type {
  BirdCoderConsoleRepositories,
  BirdCoderWorkspaceRecord,
} from './appConsoleRepository.ts';

export const BIRDCODER_DEFAULT_LOCAL_TENANT_ID = '0';
export const BIRDCODER_DEFAULT_LOCAL_ORGANIZATION_ID = '0';
export const BIRDCODER_DEFAULT_LOCAL_OWNER_USER_ID = '100000000000000001';
export const BIRDCODER_DEFAULT_WORKSPACE_ID = '100000000000000101';
export const BIRDCODER_DEFAULT_WORKSPACE_UUID = '00000000-0000-0000-0000-000000000101';
export const BIRDCODER_DEFAULT_WORKSPACE_NAME = 'Default Workspace';

function createTimestamp(): string {
  return new Date().toISOString();
}

export function createBirdCoderBootstrapWorkspaceRecord(
  ownerUserId: string,
): BirdCoderWorkspaceRecord {
  const now = createTimestamp();
  const resolvedOwnerUserId =
    ownerUserId.trim().length > 0 ? ownerUserId : BIRDCODER_DEFAULT_LOCAL_OWNER_USER_ID;
  return {
    id: BIRDCODER_DEFAULT_WORKSPACE_ID,
    uuid: BIRDCODER_DEFAULT_WORKSPACE_UUID,
    tenantId: BIRDCODER_DEFAULT_LOCAL_TENANT_ID,
    organizationId: BIRDCODER_DEFAULT_LOCAL_ORGANIZATION_ID,
    dataScope: 'PRIVATE',
    code: 'default-workspace',
    title: BIRDCODER_DEFAULT_WORKSPACE_NAME,
    name: BIRDCODER_DEFAULT_WORKSPACE_NAME,
    description: 'Primary local workspace for BirdCoder.',
    icon: 'Folder',
    color: '#4f6f52',
    ownerId: resolvedOwnerUserId,
    leaderId: resolvedOwnerUserId,
    createdByUserId: resolvedOwnerUserId,
    type: 'DEFAULT',
    settings: {},
    isPublic: false,
    isTemplate: false,
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
  defaultOwnerUserId = BIRDCODER_DEFAULT_LOCAL_OWNER_USER_ID,
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
