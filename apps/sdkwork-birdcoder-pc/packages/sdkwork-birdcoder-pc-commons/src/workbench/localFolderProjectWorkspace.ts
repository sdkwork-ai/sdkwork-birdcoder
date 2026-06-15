export type LocalFolderImportWorkspaceIdentity = {
  id: string;
};

export const DEFAULT_LOCAL_FOLDER_IMPORT_WORKSPACE_NAME = 'Default Workspace';
export const DEFAULT_LOCAL_FOLDER_IMPORT_WORKSPACE_DESCRIPTION =
  'Default workspace for local folder projects.';
const defaultLocalFolderImportWorkspaceCreationPromises = new WeakMap<
  ResolveLocalFolderImportWorkspaceIdOptions['createWorkspace'],
  Promise<string>
>();

export interface ResolveLocalFolderImportWorkspaceIdOptions<
  TWorkspace extends LocalFolderImportWorkspaceIdentity = LocalFolderImportWorkspaceIdentity,
> {
  createWorkspace: (
    name: string,
    description?: string,
  ) => Promise<LocalFolderImportWorkspaceIdentity>;
  effectiveWorkspaceId: string | null | undefined;
  refreshWorkspaces: () => Promise<TWorkspace[]>;
  selectWorkspaceId?: (
    workspaces: readonly TWorkspace[],
  ) => string | null | undefined;
}

function normalizeWorkspaceId(value: string | null | undefined): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function resolveFirstWorkspaceId(
  workspaces: readonly LocalFolderImportWorkspaceIdentity[],
): string {
  return workspaces
    .map((workspace) => normalizeWorkspaceId(workspace.id))
    .find((workspaceId) => workspaceId.length > 0) ?? '';
}

async function refreshWorkspaceCatalog<
  TWorkspace extends LocalFolderImportWorkspaceIdentity = LocalFolderImportWorkspaceIdentity,
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
  TWorkspace extends LocalFolderImportWorkspaceIdentity = LocalFolderImportWorkspaceIdentity,
>(
  workspaces: readonly TWorkspace[],
  selectWorkspaceId?: (workspaces: readonly TWorkspace[]) => string | null | undefined,
): string {
  const selectedWorkspaceId = normalizeWorkspaceId(selectWorkspaceId?.(workspaces));
  return selectedWorkspaceId || resolveFirstWorkspaceId(workspaces);
}

function createDefaultLocalFolderImportWorkspace(
  createWorkspace: ResolveLocalFolderImportWorkspaceIdOptions['createWorkspace'],
): Promise<string> {
  const currentPromise = defaultLocalFolderImportWorkspaceCreationPromises.get(createWorkspace);
  if (currentPromise) {
    return currentPromise;
  }

  const nextPromise = createWorkspace(
    DEFAULT_LOCAL_FOLDER_IMPORT_WORKSPACE_NAME,
    DEFAULT_LOCAL_FOLDER_IMPORT_WORKSPACE_DESCRIPTION,
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
        defaultLocalFolderImportWorkspaceCreationPromises.get(createWorkspace) === nextPromise
      ) {
        defaultLocalFolderImportWorkspaceCreationPromises.delete(createWorkspace);
      }
    });

  defaultLocalFolderImportWorkspaceCreationPromises.set(createWorkspace, nextPromise);
  return nextPromise;
}

export async function resolveLocalFolderImportWorkspaceId<
  TWorkspace extends LocalFolderImportWorkspaceIdentity = LocalFolderImportWorkspaceIdentity,
>({
  createWorkspace,
  effectiveWorkspaceId,
  refreshWorkspaces,
  selectWorkspaceId,
}: ResolveLocalFolderImportWorkspaceIdOptions<TWorkspace>): Promise<string> {
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
    return await createDefaultLocalFolderImportWorkspace(createWorkspace);
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
