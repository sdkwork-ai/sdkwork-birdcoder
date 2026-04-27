export type LocalFolderImportWorkspaceIdentity = {
  id: string;
};

export const DEFAULT_LOCAL_FOLDER_IMPORT_WORKSPACE_NAME = 'Default Workspace';
export const DEFAULT_LOCAL_FOLDER_IMPORT_WORKSPACE_DESCRIPTION =
  'Default workspace for local folder projects.';

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

  const refreshedWorkspaces = await refreshWorkspaces();
  const selectedRefreshedWorkspaceId = normalizeWorkspaceId(
    selectWorkspaceId?.(refreshedWorkspaces),
  );
  const refreshedWorkspaceId =
    selectedRefreshedWorkspaceId || resolveFirstWorkspaceId(refreshedWorkspaces);
  if (refreshedWorkspaceId) {
    return refreshedWorkspaceId;
  }

  const createdWorkspace = await createWorkspace(
    DEFAULT_LOCAL_FOLDER_IMPORT_WORKSPACE_NAME,
    DEFAULT_LOCAL_FOLDER_IMPORT_WORKSPACE_DESCRIPTION,
  );
  const createdWorkspaceId = normalizeWorkspaceId(createdWorkspace.id);
  if (createdWorkspaceId) {
    return createdWorkspaceId;
  }

  throw new Error(
    'Default workspace is unavailable. Please wait for workspace initialization to complete.',
  );
}
