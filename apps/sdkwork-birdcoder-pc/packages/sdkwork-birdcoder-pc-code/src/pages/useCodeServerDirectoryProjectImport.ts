import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSandboxDirectoryPicker } from '@sdkwork/drive-pc-sandbox-explorer';
import {
  importSelectedProjectDirectory,
  selectProjectDirectory,
} from '@sdkwork/birdcoder-pc-workbench/workbench/projectDirectorySelection';
import type {
  AgentProjectView,
  LocalFolderMountSource,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type { ProjectRuntimeLocationBindingResult } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

type ImportProject = (options: {
  description?: string;
  driveLogicalPath?: string;
  driveRootEntryId: string;
  driveSpaceId: string;
  name: string;
  sourceKind: string;
  sourceRef: string;
}) => Promise<AgentProjectView>;

export function useCodeServerDirectoryProjectImport({
  bindLocalProjectRuntimeLocation,
  ensureProject,
  importProject,
  workspaceId,
}: {
  bindLocalProjectRuntimeLocation: (
    projectId: string,
    source: LocalFolderMountSource,
  ) => Promise<ProjectRuntimeLocationBindingResult>;
  ensureProject: (name: string) => Promise<{
    projectId: string;
    reusedExistingProject: boolean;
  }>;
  importProject: ImportProject;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const { pickDirectory } = useSandboxDirectoryPicker();

  const selectProjectFolder = useCallback(() => {
    return selectProjectDirectory({
      pickSandboxDirectory: pickDirectory,
      sandboxPickerTitle: t('app.selectServerDirectory'),
    });
  }, [pickDirectory, t]);

  const selectFolderAndImportProject = useCallback(async (fallbackProjectName: string) => {
    const selection = await selectProjectFolder();
    if (!selection) {
      return null;
    }

    return importSelectedProjectDirectory({
      bindLocalProjectRuntimeLocation,
      ensureProject,
      fallbackProjectName,
      importPort: { importProject },
      selection,
      workspaceId,
    });
  }, [
    bindLocalProjectRuntimeLocation,
    ensureProject,
    importProject,
    selectProjectFolder,
    workspaceId,
  ]);

  return {
    selectFolderAndImportProject,
    selectProjectFolder,
  };
}
