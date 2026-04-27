import { useCallback, useMemo } from 'react';
import {
  importLocalFolderProject,
  openLocalFolder,
  resolveLocalFolderImportWorkspaceId as resolveSharedLocalFolderImportWorkspaceId,
  useWorkspaces,
} from '@sdkwork/birdcoder-commons';
import type { BirdCoderProject, LocalFolderMountSource } from '@sdkwork/birdcoder-types';

type CreateProjectOptions = {
  appTemplateVersionId?: string;
  description?: string;
  path?: string;
  templatePresetKey?: string;
};

type ProjectServiceForLocalFolderImport = {
  createProject(
    workspaceId: string,
    name: string,
    options?: CreateProjectOptions,
  ): Promise<BirdCoderProject>;
  getProjectByPath(workspaceId: string, path: string): Promise<BirdCoderProject | null>;
  updateProject(projectId: string, updates: Partial<BirdCoderProject>): Promise<void>;
};

type WorkspaceIdentity = {
  id: string;
};

export function useCodeEffectiveWorkspaceId({
  isVisible,
  workspaceId,
}: {
  isVisible: boolean;
  workspaceId?: string;
}) {
  const { createWorkspace, workspaces, refreshWorkspaces } = useWorkspaces({ isActive: isVisible });
  const effectiveWorkspaceId = useMemo(() => {
    const explicitWorkspaceId = workspaceId?.trim() ?? '';
    if (explicitWorkspaceId) {
      return explicitWorkspaceId;
    }

    return workspaces
      .map((workspace) => String(workspace.id).trim())
      .find((candidateWorkspaceId) => candidateWorkspaceId.length > 0) ?? '';
  }, [workspaceId, workspaces]);

  return {
    createWorkspace,
    effectiveWorkspaceId,
    refreshWorkspaces,
  };
}

export function useCodeLocalFolderProjectImport({
  createProject,
  createWorkspace,
  effectiveWorkspaceId,
  mountFolder,
  projectService,
  refreshWorkspaces,
  updateProject,
}: {
  createProject: (name: string, options?: CreateProjectOptions) => Promise<BirdCoderProject>;
  createWorkspace: (name: string, description?: string) => Promise<WorkspaceIdentity>;
  effectiveWorkspaceId: string;
  mountFolder: (projectId: string, folderInfo: LocalFolderMountSource) => Promise<void> | void;
  projectService: ProjectServiceForLocalFolderImport;
  refreshWorkspaces: () => Promise<Array<{ id: string }>>;
  updateProject: (projectId: string, updates: Partial<BirdCoderProject>) => Promise<void> | void;
}) {
  const resolveLocalFolderImportWorkspaceId = useCallback(
    () =>
      resolveSharedLocalFolderImportWorkspaceId({
        createWorkspace,
        effectiveWorkspaceId,
        refreshWorkspaces,
      }),
    [createWorkspace, effectiveWorkspaceId, refreshWorkspaces],
  );

  const selectFolderAndImportProject = useCallback(async (fallbackProjectName: string) => {
    const folderInfo = await openLocalFolder();
    if (!folderInfo) {
      return null;
    }

    const targetWorkspaceId = await resolveLocalFolderImportWorkspaceId();
    const createProjectForTargetWorkspace = (name: string, options?: CreateProjectOptions) => {
      if (targetWorkspaceId === effectiveWorkspaceId) {
        return createProject(name, options);
      }

      return projectService.createProject(targetWorkspaceId, name, options);
    };
    const updateProjectForTargetWorkspace = (
      projectId: string,
      updates: Partial<BirdCoderProject>,
    ) => {
      if (targetWorkspaceId === effectiveWorkspaceId) {
        return updateProject(projectId, updates);
      }

      return projectService.updateProject(projectId, updates);
    };

    const importedProject = await importLocalFolderProject({
      createProject: createProjectForTargetWorkspace,
      fallbackProjectName,
      folderInfo,
      getProjectByPath: (projectPath) =>
        projectService.getProjectByPath(targetWorkspaceId, projectPath),
      mountFolder: async (projectId, nextFolderInfo) => {
        await mountFolder(projectId, nextFolderInfo);
      },
      updateProject: async (projectId, updates) => {
        await updateProjectForTargetWorkspace(projectId, updates);
      },
    });

    return {
      ...importedProject,
      workspaceId: targetWorkspaceId,
    };
  }, [
    createProject,
    effectiveWorkspaceId,
    mountFolder,
    projectService,
    resolveLocalFolderImportWorkspaceId,
    updateProject,
  ]);

  return {
    selectFolderAndImportProject,
  };
}
