export interface WorkspaceBootstrapIdentity {
  id: string;
}

export const DEFAULT_EFFECTIVE_WORKSPACE_NAME = 'Default Workspace';
export const DEFAULT_EFFECTIVE_WORKSPACE_DESCRIPTION =
  'Default workspace for BirdCoder projects.';
const defaultEffectiveWorkspaceCreationPromises = new WeakMap<
  ResolveEffectiveWorkspaceIdOptions['createWorkspace'],
  Promise<string>
>();

export interface ResolveEffectiveWorkspaceIdOptions<
  TWorkspace extends WorkspaceBootstrapIdentity = WorkspaceBootstrapIdentity,
> {
  allowUnknownCurrentWorkspaceId?: boolean;
  createWorkspace: (
    name: string,
    description?: string,
  ) => Promise<WorkspaceBootstrapIdentity>;
  currentWorkspaceId?: string | null;
  recoveryWorkspaceId?: string | null;
  refreshWorkspaces: () => Promise<TWorkspace[]>;
  workspaces: readonly TWorkspace[];
}

function normalizeWorkspaceId(value: string | null | undefined): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function resolveFirstWorkspaceId(
  workspaces: readonly WorkspaceBootstrapIdentity[],
): string {
  return workspaces
    .map((workspace) => normalizeWorkspaceId(workspace.id))
    .find((workspaceId) => workspaceId.length > 0) ?? '';
}

function hasWorkspaceId(
  workspaces: readonly WorkspaceBootstrapIdentity[],
  workspaceId: string,
): boolean {
  return workspaces.some((workspace) => normalizeWorkspaceId(workspace.id) === workspaceId);
}

function resolveWorkspaceIdFromCatalog(
  options: Pick<
    ResolveEffectiveWorkspaceIdOptions,
    'allowUnknownCurrentWorkspaceId' | 'currentWorkspaceId' | 'recoveryWorkspaceId'
  > & {
    workspaces: readonly WorkspaceBootstrapIdentity[];
  },
): string {
  const normalizedCurrentWorkspaceId = normalizeWorkspaceId(options.currentWorkspaceId);
  if (
    normalizedCurrentWorkspaceId &&
    (
      options.allowUnknownCurrentWorkspaceId ||
      hasWorkspaceId(options.workspaces, normalizedCurrentWorkspaceId)
    )
  ) {
    return normalizedCurrentWorkspaceId;
  }

  const normalizedRecoveryWorkspaceId = normalizeWorkspaceId(options.recoveryWorkspaceId);
  if (
    normalizedRecoveryWorkspaceId &&
    hasWorkspaceId(options.workspaces, normalizedRecoveryWorkspaceId)
  ) {
    return normalizedRecoveryWorkspaceId;
  }

  return resolveFirstWorkspaceId(options.workspaces);
}

function createDefaultEffectiveWorkspace(
  createWorkspace: ResolveEffectiveWorkspaceIdOptions['createWorkspace'],
): Promise<string> {
  const currentPromise = defaultEffectiveWorkspaceCreationPromises.get(createWorkspace);
  if (currentPromise) {
    return currentPromise;
  }

  const nextPromise = createWorkspace(
    DEFAULT_EFFECTIVE_WORKSPACE_NAME,
    DEFAULT_EFFECTIVE_WORKSPACE_DESCRIPTION,
  )
    .then((createdWorkspace) => {
      const createdWorkspaceId = normalizeWorkspaceId(createdWorkspace.id);
      if (!createdWorkspaceId) {
        throw new Error(
          'Default workspace is unavailable. Please wait for workspace initialization to complete.',
        );
      }

      return createdWorkspaceId;
    })
    .finally(() => {
      if (defaultEffectiveWorkspaceCreationPromises.get(createWorkspace) === nextPromise) {
        defaultEffectiveWorkspaceCreationPromises.delete(createWorkspace);
      }
    });

  defaultEffectiveWorkspaceCreationPromises.set(createWorkspace, nextPromise);
  return nextPromise;
}

async function refreshWorkspaceCatalog<
  TWorkspace extends WorkspaceBootstrapIdentity = WorkspaceBootstrapIdentity,
>(
  refreshWorkspaces: () => Promise<TWorkspace[]>,
): Promise<TWorkspace[]> {
  try {
    return await refreshWorkspaces();
  } catch {
    return [];
  }
}

export async function resolveEffectiveWorkspaceId<
  TWorkspace extends WorkspaceBootstrapIdentity = WorkspaceBootstrapIdentity,
>({
  allowUnknownCurrentWorkspaceId = false,
  createWorkspace,
  currentWorkspaceId,
  recoveryWorkspaceId,
  refreshWorkspaces,
  workspaces,
}: ResolveEffectiveWorkspaceIdOptions<TWorkspace>): Promise<string> {
  const catalogWorkspaceId = resolveWorkspaceIdFromCatalog({
    allowUnknownCurrentWorkspaceId,
    currentWorkspaceId,
    recoveryWorkspaceId,
    workspaces,
  });
  if (catalogWorkspaceId) {
    return catalogWorkspaceId;
  }

  const refreshedWorkspaces = await refreshWorkspaceCatalog(refreshWorkspaces);
  const refreshedWorkspaceId = resolveWorkspaceIdFromCatalog({
    allowUnknownCurrentWorkspaceId,
    currentWorkspaceId,
    recoveryWorkspaceId,
    workspaces: refreshedWorkspaces,
  });
  if (refreshedWorkspaceId) {
    return refreshedWorkspaceId;
  }

  try {
    return await createDefaultEffectiveWorkspace(createWorkspace);
  } catch (error) {
    const recoveredWorkspaces = await refreshWorkspaceCatalog(refreshWorkspaces);
    const recoveredWorkspaceId = resolveWorkspaceIdFromCatalog({
      allowUnknownCurrentWorkspaceId,
      currentWorkspaceId,
      recoveryWorkspaceId,
      workspaces: recoveredWorkspaces,
    });
    if (recoveredWorkspaceId) {
      return recoveredWorkspaceId;
    }

    throw error;
  }
}
