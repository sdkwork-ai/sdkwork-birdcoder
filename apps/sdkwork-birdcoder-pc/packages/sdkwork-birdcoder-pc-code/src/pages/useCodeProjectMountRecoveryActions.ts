import { useCallback, useState } from 'react';
import type {
  AgentProjectView,
  ProjectDeviceMountState,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { useIDEServices } from '@sdkwork/birdcoder-pc-workbench/context/IDEContext';
import {
  rebindSelectedProjectDirectory,
  type ProjectDirectorySelection,
} from '@sdkwork/birdcoder-pc-workbench/workbench/projectDirectorySelection';
import {
  isProjectMountReadyForSessionSynchronization,
} from '@sdkwork/birdcoder-pc-workbench/workbench/projectMountRecovery';
import { useToast } from '@sdkwork/birdcoder-pc-workbench/contexts/ToastProvider';
import {
  getProviderSessionImportFailureCount,
  type ImportedProjectSessionInventoryResult,
} from '@sdkwork/birdcoder-pc-workbench/workbench/importedProjectHydration';
import { useTranslation } from 'react-i18next';

interface UseCodeProjectMountRecoveryActionsOptions {
  currentProject: AgentProjectView | null;
  currentProjectId: string;
  restoreProjectMount: () => Promise<ProjectDeviceMountState | null>;
  selectProjectFolder: () => Promise<ProjectDirectorySelection | null>;
  importProjectProviderSessions: (
    projectId: string,
  ) => Promise<ImportedProjectSessionInventoryResult | null>;
}

export function useCodeProjectMountRecoveryActions({
  currentProject,
  currentProjectId,
  restoreProjectMount,
  selectProjectFolder,
  importProjectProviderSessions,
}: UseCodeProjectMountRecoveryActionsOptions) {
  const {
    projectRuntimeLocationService,
    projectService,
  } = useIDEServices();
  const { addToast } = useToast();
  const { t } = useTranslation();
  const [isMountRecoveryActionPending, setIsMountRecoveryActionPending] = useState(false);

  const handleRetryMountRecovery = useCallback(async () => {
    if (!currentProjectId) {
      addToast('Select a project before reconnecting its local folder.', 'error');
      return;
    }

    setIsMountRecoveryActionPending(true);
    try {
      const recoveredMount = await restoreProjectMount();
      if (!recoveredMount || !isProjectMountReadyForSessionSynchronization(recoveredMount)) {
        addToast('Select the local folder again to restore file access on this device.', 'error');
        return;
      }
      const importedInventory = await importProjectProviderSessions(currentProjectId);
      const failedSessionCount = getProviderSessionImportFailureCount(importedInventory);
      addToast(
        failedSessionCount
          ? t('code.providerSessionsPartiallyImported', {
              count: failedSessionCount,
              name: currentProject?.name ?? t('code.localFolder'),
            })
          : t('code.reconnectedFolder', {
              name: currentProject?.name ?? t('code.localFolder'),
            }),
        failedSessionCount ? 'info' : 'success',
      );
    } catch (error) {
      console.error('Failed to retry local project folder recovery', error);
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to reconnect the local project folder.',
        'error',
      );
    } finally {
      setIsMountRecoveryActionPending(false);
    }
  }, [
    addToast,
    currentProject?.name,
    currentProjectId,
    restoreProjectMount,
    importProjectProviderSessions,
  ]);

  const handleReimportProjectFolder = useCallback(async () => {
    if (!currentProjectId) {
      addToast('Select a project before choosing a folder.', 'error');
      return;
    }

    setIsMountRecoveryActionPending(true);
    try {
      const selection = await selectProjectFolder();
      if (!selection) {
        return;
      }

      const reboundProject = await rebindSelectedProjectDirectory({
        bindLocalProjectRuntimeLocation: (projectId, source) =>
          projectRuntimeLocationService.bindLocalProjectRuntimeLocation(projectId, source),
        compositionPort: projectService,
        projectId: currentProjectId,
        fallbackProjectName: currentProject?.name ?? 'Local Folder',
        selection,
      });
      await restoreProjectMount();
      const importedInventory = await importProjectProviderSessions(currentProjectId);
      const failedSessionCount = getProviderSessionImportFailureCount(importedInventory);
      addToast(
        failedSessionCount
          ? t('code.providerSessionsPartiallyImported', {
              count: failedSessionCount,
              name: reboundProject.projectName,
            })
          : t('code.openedFolder', { name: reboundProject.projectName }),
        failedSessionCount ? 'info' : 'success',
      );
    } catch (error) {
      console.error('Failed to rebind local project folder', error);
      addToast(
        error instanceof Error && error.message.trim() ? error.message : 'Failed to open folder',
        'error',
      );
    } finally {
      setIsMountRecoveryActionPending(false);
    }
  }, [
    addToast,
    currentProject?.name,
    currentProjectId,
    projectRuntimeLocationService,
    projectService,
    restoreProjectMount,
    selectProjectFolder,
    importProjectProviderSessions,
  ]);

  return {
    handleReimportProjectFolder,
    handleRetryMountRecovery,
    isMountRecoveryActionPending,
  };
}
