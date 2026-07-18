export interface ProjectImportWorkspaceIdentity {
  id: string;
}

export const DEFAULT_PROJECT_IMPORT_WORKSPACE_NAME = 'Default Workspace';
export const DEFAULT_PROJECT_IMPORT_WORKSPACE_DESCRIPTION =
  'Default workspace for imported projects.';

export interface ResolveProjectImportWorkspaceIdOptions<
  TWorkspace extends ProjectImportWorkspaceIdentity = ProjectImportWorkspaceIdentity,
> {
  createWorkspace: (
    name: string,
    description?: string,
  ) => Promise<ProjectImportWorkspaceIdentity>;
  effectiveWorkspaceId: string | null | undefined;
  refreshWorkspaces: () => Promise<TWorkspace[]>;
  selectWorkspaceId?: (
    workspaces: readonly TWorkspace[],
  ) => string | null | undefined;
}

const defaultProjectImportWorkspaceCreationPromises = new WeakMap<
  ResolveProjectImportWorkspaceIdOptions['createWorkspace'],
  Promise<string>
>();

function normalizeWorkspaceId(value: string | null | undefined): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function resolveFirstWorkspaceId(
  workspaces: readonly ProjectImportWorkspaceIdentity[],
): string {
  return workspaces
    .map((workspace) => normalizeWorkspaceId(workspace.id))
    .find((workspaceId) => workspaceId.length > 0) ?? '';
}

async function refreshWorkspaceCatalog<
  TWorkspace extends ProjectImportWorkspaceIdentity = ProjectImportWorkspaceIdentity,
>(
  refreshWorkspaces: () => Promise<TWorkspace[]>,
): Promise<TWorkspace[]> {
  try {
    return await refreshWorkspaces();
  } catch {
    return [];
  }
}

function resolveWorkspaceIdFromCatalog<
  TWorkspace extends ProjectImportWorkspaceIdentity = ProjectImportWorkspaceIdentity,
>(
  workspaces: readonly TWorkspace[],
  selectWorkspaceId?: (workspaces: readonly TWorkspace[]) => string | null | undefined,
): string {
  const selectedWorkspaceId = normalizeWorkspaceId(selectWorkspaceId?.(workspaces));
  return selectedWorkspaceId || resolveFirstWorkspaceId(workspaces);
}

function createDefaultProjectImportWorkspace(
  createWorkspace: ResolveProjectImportWorkspaceIdOptions['createWorkspace'],
): Promise<string> {
  const currentPromise = defaultProjectImportWorkspaceCreationPromises.get(createWorkspace);
  if (currentPromise) {
    return currentPromise;
  }

  const nextPromise = createWorkspace(
    DEFAULT_PROJECT_IMPORT_WORKSPACE_NAME,
    DEFAULT_PROJECT_IMPORT_WORKSPACE_DESCRIPTION,
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
      if (
        defaultProjectImportWorkspaceCreationPromises.get(createWorkspace) === nextPromise
      ) {
        defaultProjectImportWorkspaceCreationPromises.delete(createWorkspace);
      }
    });

  defaultProjectImportWorkspaceCreationPromises.set(createWorkspace, nextPromise);
  return nextPromise;
}

export async function resolveProjectImportWorkspaceId<
  TWorkspace extends ProjectImportWorkspaceIdentity = ProjectImportWorkspaceIdentity,
>({
  createWorkspace,
  effectiveWorkspaceId,
  refreshWorkspaces,
  selectWorkspaceId,
}: ResolveProjectImportWorkspaceIdOptions<TWorkspace>): Promise<string> {
  const immediateWorkspaceId = normalizeWorkspaceId(effectiveWorkspaceId);
  if (immediateWorkspaceId) {
    return immediateWorkspaceId;
  }

  const refreshedWorkspaces = await refreshWorkspaceCatalog(refreshWorkspaces);
  const refreshedWorkspaceId = resolveWorkspaceIdFromCatalog(
    refreshedWorkspaces,
    selectWorkspaceId,
  );
  if (refreshedWorkspaceId) {
    return refreshedWorkspaceId;
  }

  try {
    return await createDefaultProjectImportWorkspace(createWorkspace);
  } catch (error) {
    const recoveredWorkspaces = await refreshWorkspaceCatalog(refreshWorkspaces);
    const recoveredWorkspaceId = resolveWorkspaceIdFromCatalog(
      recoveredWorkspaces,
      selectWorkspaceId,
    );
    if (recoveredWorkspaceId) {
      return recoveredWorkspaceId;
    }
    throw error;
  }
}
