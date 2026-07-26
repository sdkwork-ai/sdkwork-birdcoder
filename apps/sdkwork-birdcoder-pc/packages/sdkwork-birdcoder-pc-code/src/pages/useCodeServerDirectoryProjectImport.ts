import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSandboxDirectoryPicker } from '@sdkwork/drive-pc-sandbox-explorer';
import { importSandboxDirectoryProject } from '@sdkwork/birdcoder-pc-workbench/workbench/sandboxDirectoryProjectImport';
import type { AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';

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
  importProject,
  workspaceId,
}: {
  importProject: ImportProject;
  workspaceId: string;
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
      fallbackProjectName,
      importPort: { importProject },
      selection,
      workspaceId,
    });
  }, [
    importProject,
    pickDirectory,
    t,
    workspaceId,
  ]);

  return {
    selectFolderAndImportProject,
  };
}
