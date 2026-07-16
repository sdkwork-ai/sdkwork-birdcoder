import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { buildTerminalProfileBlockedMessage } from '@sdkwork/birdcoder-pc-commons/terminal/profileAvailability';
import { emitOpenTerminalRequest } from '@sdkwork/birdcoder-pc-commons/terminal/requests';
import { globalEventBus } from '@sdkwork/birdcoder-pc-commons/utils/EventBus';
import { getDefaultRunConfigurations } from '@sdkwork/birdcoder-pc-commons/terminal/runConfigDefinitions';
import { resolveRunConfigurationTerminalLaunch } from '@sdkwork/birdcoder-pc-commons/terminal/runConfigs';
import { useProjectRunConfigurations } from '@sdkwork/birdcoder-pc-commons/hooks/useProjectRunConfigurations';
import type { ProjectRuntimeLocationResolver } from '@sdkwork/birdcoder-pc-commons/hooks/useProjectRuntimeLocation';
import {
  getProjectRuntimeLocationFailureMessage,
  getResolvedProjectRuntimeLocationWorkingDirectory,
} from '@sdkwork/birdcoder-pc-commons/workbench/projectRuntimeLocationResolution';
import type { RunConfigurationRecord } from '@sdkwork/birdcoder-pc-commons/terminal/runConfigDefinitions';
import type { ToastType } from '@sdkwork/birdcoder-pc-commons/contexts/ToastProvider';
import { useTranslation } from 'react-i18next';

interface UseCodeRunEntryActionsOptions {
  currentProjectId: string;
  resolveProjectRuntimeLocation: ProjectRuntimeLocationResolver;
  isRunConfigVisible: boolean;
  setIsRunConfigVisible: Dispatch<SetStateAction<boolean>>;
  setIsDebugConfigVisible: Dispatch<SetStateAction<boolean>>;
  setIsRunTaskVisible: Dispatch<SetStateAction<boolean>>;
  addToast: (message: string, type?: ToastType) => void;
}

export function useCodeRunEntryActions({
  currentProjectId,
  resolveProjectRuntimeLocation,
  isRunConfigVisible,
  setIsRunConfigVisible,
  setIsDebugConfigVisible,
  setIsRunTaskVisible,
  addToast,
}: UseCodeRunEntryActionsOptions) {
  const { t } = useTranslation();
  const { runConfigurations, saveRunConfiguration } = useProjectRunConfigurations(currentProjectId || null);
  const [runConfigurationDraft, setRunConfigurationDraft] = useState<RunConfigurationRecord>(
    getDefaultRunConfigurations()[0],
  );

  useEffect(() => {
    if (!isRunConfigVisible) {
      return;
    }

    setRunConfigurationDraft(
      runConfigurations.find((configuration) => configuration.group === 'dev') ??
        runConfigurations[0] ??
        getDefaultRunConfigurations()[0],
    );
  }, [isRunConfigVisible, runConfigurations]);

  const dispatchRunConfiguration = async (configuration: RunConfigurationRecord) => {
    const resolution = await resolveProjectRuntimeLocation(currentProjectId, {
      allowFolderSelection: true,
      capability: 'build',
    });
    const projectDirectory = getResolvedProjectRuntimeLocationWorkingDirectory(resolution);
    if (!projectDirectory) {
      const message = getProjectRuntimeLocationFailureMessage(
        resolution,
        'A local desktop folder must be mounted before running this configuration.',
      );
      if (message) {
        addToast(message, 'error');
      }
      return;
    }

    const launch = await resolveRunConfigurationTerminalLaunch(configuration, {
      projectDirectory,
      workspaceDirectory: projectDirectory,
    });

    if (!launch.request) {
      addToast(
        buildTerminalProfileBlockedMessage(configuration.profileId, {
          launchState: launch.launchPresentation,
          blockedAction: launch.blockedAction,
        }) ?? 'Blocked terminal profile.',
        'error',
      );

      if (launch.blockedAction.actionId === 'open-settings') {
        globalEventBus.emit('openSettings');
      }
      return;
    }

    emitOpenTerminalRequest(launch.request);
  };

  const handleSubmitRunConfiguration = async () => {
    const [savedConfiguration] = await saveRunConfiguration({
      ...runConfigurationDraft,
      id: runConfigurationDraft.id || 'dev',
    });

    addToast(t('app.runningConfiguration'), 'info');
    setIsRunConfigVisible(false);
    void dispatchRunConfiguration(savedConfiguration);
  };

  const handleRunTaskExecution = (configuration: RunConfigurationRecord) => {
    setIsRunTaskVisible(false);
    void dispatchRunConfiguration(configuration);
    addToast(`Running ${configuration.name}`, 'info');
  };

  const handleRunWithoutDebugging = () => {
    const defaultRunConfiguration =
      runConfigurations.find((configuration) => configuration.group === 'dev') ??
      runConfigurations[0] ??
      getDefaultRunConfigurations()[0];
    void dispatchRunConfiguration(defaultRunConfiguration);
    addToast(t('code.startingApplication'), 'info');
  };

  const handleSaveDebugConfiguration = () => {
    setIsDebugConfigVisible(false);
    addToast(t('app.debugConfigurationUnavailable'), 'error');
  };

  return {
    runConfigurations,
    runConfigurationDraft,
    setRunConfigurationDraft,
    handleSubmitRunConfiguration,
    handleRunTaskExecution,
    handleRunWithoutDebugging,
    handleSaveDebugConfiguration,
  } as const;
}
