import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSandboxDirectoryPicker } from '@sdkwork/drive-pc-sandbox-explorer';
import { importSandboxDirectoryProject } from '@sdkwork/birdcoder-pc-workbench/workbench/sandboxDirectoryProjectImport';
import type { AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IProjectService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

type CreateProjectOptions = {
  description?: string;
};

export function useCodeServerDirectoryProjectImport({
  createProject,
  deleteProject,
  projectService,
}: {
  createProject: (name: string, options?: CreateProjectOptions) => Promise<AgentProjectView>;
  deleteProject: (projectId: string) => Promise<void>;
  projectService: Pick<IProjectService, 'bindProjectDrive'>;
}) {
  const { t } = useTranslation();
  const { pickDirectory } = useSandboxDirectoryPicker();

  const selectFolderAndImportProject = useCallback(async (fallbackProjectName: string) => {
    const selection = await pickDirectory({
      title: t('app.selectServerDirectory'),
    });
    if (!selection) {
      return null;
    }

    return importSandboxDirectoryProject({
      compositionPort: {
        bindProjectDrive: async (projectId, selectedDirectory) => {
          await projectService.bindProjectDrive(projectId, {
            driveId: selectedDirectory.sandboxId,
            logicalPath: selectedDirectory.logicalPath,
            rootEntryId: selectedDirectory.entryId,
          });
        },
      },
      createProject,
      deleteCreatedProject: deleteProject,
      fallbackProjectName,
      selection,
    });
  }, [
    createProject,
    deleteProject,
    pickDirectory,
    projectService,
    t,
  ]);

  return {
    selectFolderAndImportProject,
  };
}
