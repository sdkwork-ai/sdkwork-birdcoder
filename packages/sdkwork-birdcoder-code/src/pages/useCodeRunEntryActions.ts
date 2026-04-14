import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import {
  buildTerminalProfileBlockedMessage,
  getDefaultRunConfigurations,
  globalEventBus,
  resolveRunConfigurationTerminalLaunch,
  useProjectRunConfigurations,
  type RunConfigurationRecord,
  type ToastType,
} from '@sdkwork/birdcoder-commons';
import { useTranslation } from 'react-i18next';

interface UseCodeRunEntryActionsOptions {
  currentProjectId: string;
  currentProjectName?: string;
  defaultWorkingDirectory: string;
  isRunConfigVisible: boolean;
  setIsRunConfigVisible: Dispatch<SetStateAction<boolean>>;
  setIsDebugConfigVisible: Dispatch<SetStateAction<boolean>>;
  setIsRunTaskVisible: Dispatch<SetStateAction<boolean>>;
  addToast: (message: string, type?: ToastType) => void;
}

export function useCodeRunEntryActions({
  currentProjectId,
  currentProjectName,
  defaultWorkingDirectory,
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
    const projectDirectory = currentProjectName
      ? `/workspace/${currentProjectName}`
      : defaultWorkingDirectory;

    const launch = await resolveRunConfigurationTerminalLaunch(configuration, {
      projectDirectory,
      workspaceDirectory: defaultWorkingDirectory,
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

    globalEventBus.emit('openTerminal');
    globalEventBus.emit('terminalRequest', launch.request);
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
    handleSaveDebugConfiguration,
  } as const;
}
