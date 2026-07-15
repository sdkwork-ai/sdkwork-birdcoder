import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { buildTerminalProfileBlockedMessage, emitOpenTerminalRequest } from '@sdkwork/birdcoder-pc-commons/terminal/runtime';
import { globalEventBus } from '@sdkwork/birdcoder-pc-commons/utils/EventBus';
import { getDefaultRunConfigurations } from '@sdkwork/birdcoder-pc-commons/terminal/runConfigStorage';
import { resolveRunConfigurationTerminalLaunch } from '@sdkwork/birdcoder-pc-commons/terminal/runConfigs';
import { useProjectRunConfigurations } from '@sdkwork/birdcoder-pc-commons/hooks/useProjectRunConfigurations';
import type { RunConfigurationRecord } from '@sdkwork/birdcoder-pc-commons/terminal/runConfigStorage';
import type { ToastType } from '@sdkwork/birdcoder-pc-commons/contexts/ToastProvider';
import { useTranslation } from 'react-i18next';

interface UseCodeRunEntryActionsOptions {
  currentProjectId: string;
  resolveLocalWorkingDirectory: (projectId: string) => Promise<string | null>;
  isRunConfigVisible: boolean;
  setIsRunConfigVisible: Dispatch<SetStateAction<boolean>>;
  setIsDebugConfigVisible: Dispatch<SetStateAction<boolean>>;
  setIsRunTaskVisible: Dispatch<SetStateAction<boolean>>;
  addToast: (message: string, type?: ToastType) => void;
}

export function useCodeRunEntryActions({
  currentProjectId,
  resolveLocalWorkingDirectory,
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
    const projectDirectory = await resolveLocalWorkingDirectory(currentProjectId);
    if (!projectDirectory) {
      addToast('A local desktop folder must be mounted before running this configuration.', 'error');
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
