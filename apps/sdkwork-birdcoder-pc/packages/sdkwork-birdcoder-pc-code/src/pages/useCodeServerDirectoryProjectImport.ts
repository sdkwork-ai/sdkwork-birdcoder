import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSandboxDirectoryPicker } from '@sdkwork/drive-pc-sandbox-explorer';
import { importSandboxDirectoryProject } from '@sdkwork/birdcoder-pc-commons/workbench/sandboxDirectoryProjectImport';
import { resolveProjectImportWorkspaceId as resolveSharedProjectImportWorkspaceId } from '@sdkwork/birdcoder-pc-commons/workbench/projectImportWorkspace';
import type { BirdCoderProject } from '@sdkwork/birdcoder-pc-types';

type CreateProjectOptions = {
  appTemplateVersionId?: string;
  description?: string;
  templatePresetKey?: string;
};

interface ProjectServiceForServerDirectoryImport {
  bindProjectWorkspace?(
    projectId: string,
    input: {
      logicalPath: string;
      rootEntryId: string;
      sandboxId: string;
    },
  ): Promise<void>;
  createProject(
    workspaceId: string,
    name: string,
    options?: CreateProjectOptions,
  ): Promise<BirdCoderProject>;
  deleteProject(projectId: string): Promise<void>;
}

interface WorkspaceIdentity {
  id: string;
}

export function useCodeServerDirectoryProjectImport({
  createProject,
  createWorkspace,
  deleteProject,
  effectiveWorkspaceId,
  projectService,
  refreshWorkspaces,
}: {
  createProject: (name: string, options?: CreateProjectOptions) => Promise<BirdCoderProject>;
  createWorkspace: (name: string, description?: string) => Promise<WorkspaceIdentity>;
  deleteProject: (projectId: string) => Promise<void>;
  effectiveWorkspaceId: string;
  projectService: ProjectServiceForServerDirectoryImport;
  refreshWorkspaces: () => Promise<Array<{ id: string }>>;
}) {
  const { t } = useTranslation();
  const { pickDirectory } = useSandboxDirectoryPicker();

  const resolveTargetWorkspaceId = useCallback(
    () => resolveSharedProjectImportWorkspaceId({
      createWorkspace,
      effectiveWorkspaceId,
      refreshWorkspaces,
    }),
    [createWorkspace, effectiveWorkspaceId, refreshWorkspaces],
  );

  const selectFolderAndImportProject = useCallback(async (fallbackProjectName: string) => {
    const selection = await pickDirectory({
      title: t('app.selectServerDirectory'),
    });
    if (!selection) {
      return null;
    }

    const bindProjectWorkspace = projectService.bindProjectWorkspace?.bind(projectService);
    if (!bindProjectWorkspace) {
      throw new Error(
        'The BirdCoder project service does not provide the server workspace binding capability.',
      );
    }

    const targetWorkspaceId = await resolveTargetWorkspaceId();
    const createProjectForTargetWorkspace = (name: string, options?: CreateProjectOptions) => {
      if (targetWorkspaceId === effectiveWorkspaceId) {
        return createProject(name, options);
      }
      return projectService.createProject(targetWorkspaceId, name, options);
    };
    const importedProject = await importSandboxDirectoryProject({
      bindingPort: {
        bindProjectWorkspace: (projectId, selectedDirectory) =>
          bindProjectWorkspace(projectId, {
            logicalPath: selectedDirectory.logicalPath,
            rootEntryId: selectedDirectory.entryId,
            sandboxId: selectedDirectory.sandboxId,
          }),
      },
      createProject: createProjectForTargetWorkspace,
      deleteCreatedProject: async (projectId) => {
        if (targetWorkspaceId === effectiveWorkspaceId) {
          await deleteProject(projectId);
          return;
        }
        await projectService.deleteProject(projectId);
      },
      fallbackProjectName,
      selection,
    });

    return {
      ...importedProject,
      workspaceId: targetWorkspaceId,
    };
  }, [
    createProject,
    deleteProject,
    effectiveWorkspaceId,
    pickDirectory,
    projectService,
    resolveTargetWorkspaceId,
    t,
  ]);

  return {
    selectFolderAndImportProject,
  };
}
