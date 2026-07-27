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

interface UseCodeProjectMountRecoveryActionsOptions {
  currentProject: AgentProjectView | null;
  currentProjectId: string;
  restoreProjectMount: () => Promise<ProjectDeviceMountState | null>;
  selectProjectFolder: () => Promise<ProjectDirectorySelection | null>;
  synchronizeImportedProject: (projectId: string, force?: boolean) => Promise<unknown>;
}

export function useCodeProjectMountRecoveryActions({
  currentProject,
  currentProjectId,
  restoreProjectMount,
  selectProjectFolder,
  synchronizeImportedProject,
}: UseCodeProjectMountRecoveryActionsOptions) {
  const {
    projectRuntimeLocationService,
    projectService,
  } = useIDEServices();
  const { addToast } = useToast();
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
      await synchronizeImportedProject(currentProjectId, true);
      addToast(`Reconnected folder: ${currentProject?.name ?? 'Local folder'}`, 'success');
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
    synchronizeImportedProject,
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
      await synchronizeImportedProject(currentProjectId, true);
      addToast(`Opened folder: ${reboundProject.projectName}`, 'success');
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
    synchronizeImportedProject,
  ]);

  return {
    handleReimportProjectFolder,
    handleRetryMountRecovery,
    isMountRecoveryActionPending,
  };
}
