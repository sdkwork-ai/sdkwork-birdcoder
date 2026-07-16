import { useCallback, type Dispatch, type SetStateAction } from 'react';

import {
  buildTerminalProfileBlockedMessage,
  emitOpenTerminalRequest,
  getDefaultRunConfigurations,
  getProjectRuntimeLocationFailureMessage,
  getResolvedProjectRuntimeLocationWorkingDirectory,
  globalEventBus,
  resolveRunConfigurationTerminalLaunch,
  type RunConfigurationRecord,
  type TerminalProfileBlockedAction,
  type TerminalProfileLaunchPresentation,
  type ProjectRuntimeLocationResolver,
} from '@sdkwork/birdcoder-pc-commons';

import { resolveStudioBuildProfile } from '../build/profiles';
import { resolveStudioBuildExecutionLaunch } from '../build/runtime';
import { saveStoredStudioBuildExecutionEvidence } from '../build/evidenceStore';
import {
  resolveStudioPreviewExecutionLaunch,
  resolveStudioPreviewUrl,
} from '../preview/runtime';
import { saveStoredStudioPreviewExecutionEvidence } from '../preview/evidenceStore';
import { resolveStudioSimulatorExecutionLaunch } from '../simulator/runtime';
import { saveStoredStudioSimulatorExecutionEvidence } from '../simulator/evidenceStore';
import { resolveStudioTestExecutionLaunch } from '../test/runtime';
import { saveStoredStudioTestExecutionEvidence } from '../test/evidenceStore';
import {
  resolveHostStudioPreviewSession,
  resolveHostStudioSimulatorSession,
} from '@sdkwork/birdcoder-pc-host-studio';
import { resolveSafePreviewUrl } from '@sdkwork/birdcoder-pc-ui-shell';

type ToastVariant = 'success' | 'info' | 'error';
type StudioTab = 'preview' | 'simulator' | 'code';
type PreviewPlatform = 'web' | 'miniprogram' | 'app';
type PreviewWebDevice = 'desktop' | 'tablet' | 'mobile';
type PreviewMiniProgramPlatform = 'wechat' | 'douyin' | 'alipay';
type PreviewAppPlatform = 'ios' | 'android' | 'harmony';

interface UseStudioExecutionActionsOptions {
  activeTab: StudioTab;
  addToast: (message: string, variant: ToastVariant) => void;
  currentProjectId: string;
  resolveProjectRuntimeLocation: ProjectRuntimeLocationResolver;
  previewAppPlatform: PreviewAppPlatform;
  previewDeviceModel: string;
  previewIsLandscape: boolean;
  previewMpPlatform: PreviewMiniProgramPlatform;
  previewPlatform: PreviewPlatform;
  previewUrl: string;
  previewWebDevice: PreviewWebDevice;
  runConfigurationDraft: RunConfigurationRecord;
  runConfigurations: RunConfigurationRecord[];
  saveRunConfiguration: (configuration: RunConfigurationRecord) => Promise<unknown>;
  setIsDebugConfigVisible: Dispatch<SetStateAction<boolean>>;
  setIsRunConfigVisible: Dispatch<SetStateAction<boolean>>;
  setIsRunTaskVisible: Dispatch<SetStateAction<boolean>>;
  setPreviewKey: Dispatch<SetStateAction<number>>;
  setPreviewUrl: Dispatch<SetStateAction<string>>;
  t: (key: string, options?: Record<string, unknown>) => string;
}

interface BlockedLaunchResult {
  blockedAction: TerminalProfileBlockedAction;
  launchPresentation: TerminalProfileLaunchPresentation;
}

function resolveDefaultRunConfiguration(runConfigurations: RunConfigurationRecord[]) {
  return (
    runConfigurations.find((entry) => entry.group === 'dev') ??
    runConfigurations[0] ??
    getDefaultRunConfigurations()[0]
  );
}

export function useStudioExecutionActions({
  activeTab,
  addToast,
  currentProjectId,
  resolveProjectRuntimeLocation,
  previewAppPlatform,
  previewDeviceModel,
  previewIsLandscape,
  previewMpPlatform,
  previewPlatform,
  previewUrl,
  previewWebDevice,
  runConfigurationDraft,
  runConfigurations,
  saveRunConfiguration,
  setIsDebugConfigVisible,
  setIsRunConfigVisible,
  setIsRunTaskVisible,
  setPreviewKey,
  setPreviewUrl,
  t,
}: UseStudioExecutionActionsOptions) {
  const resolveProjectDirectory = useCallback(async (): Promise<string | null> => {
    if (!currentProjectId.trim()) {
      addToast('Select a project before starting a local execution.', 'error');
      return null;
    }

    const resolution = await resolveProjectRuntimeLocation(currentProjectId, {
      allowFolderSelection: true,
      capability: 'build',
    });
    const localWorkingDirectory = getResolvedProjectRuntimeLocationWorkingDirectory(resolution);
    if (!localWorkingDirectory) {
      const message = getProjectRuntimeLocationFailureMessage(
        resolution,
        'A local desktop folder must be mounted before starting a local execution.',
      );
      if (message) {
        addToast(message, 'error');
      }
      return null;
    }

    return localWorkingDirectory;
  }, [addToast, currentProjectId, resolveProjectRuntimeLocation]);

  const dispatchBlockedLaunch = useCallback(
    (
      configuration: RunConfigurationRecord,
      launch: BlockedLaunchResult,
    ) => {
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
    },
    [addToast],
  );

  const dispatchRunConfiguration = useCallback(
    async (configuration: RunConfigurationRecord) => {
      const projectDirectory = await resolveProjectDirectory();
      if (!projectDirectory) {
        return;
      }
      const launch = await resolveRunConfigurationTerminalLaunch(configuration, {
        projectDirectory,
        workspaceDirectory: projectDirectory,
      });

      if (!launch.request) {
        dispatchBlockedLaunch(configuration, launch);
        return;
      }

      emitOpenTerminalRequest(launch.request);
    },
    [dispatchBlockedLaunch, resolveProjectDirectory],
  );

  const dispatchBuildRunConfiguration = useCallback(
    async (configuration: RunConfigurationRecord) => {
      const projectDirectory = await resolveProjectDirectory();
      if (!projectDirectory) {
        return;
      }
      const buildProfile = resolveStudioBuildProfile({
        platform: previewPlatform,
        webDevice: previewWebDevice,
        miniProgramPlatform: previewMpPlatform,
        appPlatform: previewAppPlatform,
      });
      const launch = await resolveStudioBuildExecutionLaunch(buildProfile, configuration, {
        projectId: currentProjectId || null,
        runConfigurationId: configuration.id,
        projectDirectory,
        workspaceDirectory: projectDirectory,
        timestamp: Date.now(),
      });

      if (!launch.request) {
        dispatchBlockedLaunch(configuration, launch);
        return;
      }

      emitOpenTerminalRequest(launch.request.terminalRequest);

      try {
        await saveStoredStudioBuildExecutionEvidence(launch.request.evidence);
      } catch (error) {
        console.error('Failed to persist build execution evidence', error);
      }

      addToast(t('studio.runningBuildTask'), 'info');
    },
    [
      addToast,
      currentProjectId,
      dispatchBlockedLaunch,
      previewAppPlatform,
      previewMpPlatform,
      previewPlatform,
      previewWebDevice,
      resolveProjectDirectory,
      t,
    ],
  );

  const dispatchTestRunConfiguration = useCallback(
    async (configuration: RunConfigurationRecord) => {
      const projectDirectory = await resolveProjectDirectory();
      if (!projectDirectory) {
        return;
      }
      const launch = await resolveStudioTestExecutionLaunch(configuration, {
        projectId: currentProjectId || null,
        runConfigurationId: configuration.id,
        projectDirectory,
        workspaceDirectory: projectDirectory,
        timestamp: Date.now(),
      });

      if (!launch.request) {
        dispatchBlockedLaunch(configuration, launch);
        return;
      }

      emitOpenTerminalRequest(launch.request.terminalRequest);

      try {
        await saveStoredStudioTestExecutionEvidence(launch.request.evidence);
      } catch (error) {
        console.error('Failed to persist test execution evidence', error);
      }

      addToast(t('studio.runningTestTask'), 'info');
    },
    [
      addToast,
      currentProjectId,
      dispatchBlockedLaunch,
      resolveProjectDirectory,
      t,
    ],
  );

  const launchPreview = useCallback(
    async (
      openExternal = false,
      configuration: RunConfigurationRecord = resolveDefaultRunConfiguration(runConfigurations),
    ) => {
      const projectDirectory = await resolveProjectDirectory();
      if (!projectDirectory) {
        return;
      }
      const previewSession = resolveHostStudioPreviewSession({
        url: resolveStudioPreviewUrl(previewUrl),
        platform: previewPlatform,
        webDevice: previewWebDevice,
        miniProgramPlatform: previewMpPlatform,
        appPlatform: previewAppPlatform,
        deviceModel: previewPlatform === 'web' ? undefined : previewDeviceModel,
        isLandscape: previewIsLandscape,
      });
      const launch = await resolveStudioPreviewExecutionLaunch(previewSession, configuration, {
        projectId: currentProjectId || null,
        runConfigurationId: configuration.id,
        projectDirectory,
        workspaceDirectory: projectDirectory,
        timestamp: Date.now(),
      });

      if (!launch.request) {
        dispatchBlockedLaunch(configuration, launch);
        return;
      }

      emitOpenTerminalRequest(launch.request.terminalRequest);
      const safePreviewUrl = resolveSafePreviewUrl(launch.request.session.target.url);
      setPreviewUrl(safePreviewUrl);
      setPreviewKey((value) => value + 1);

      try {
        await saveStoredStudioPreviewExecutionEvidence(launch.request.evidence);
      } catch (error) {
        console.error('Failed to persist preview execution evidence', error);
      }

      addToast(t('studio.startingApplication'), 'info');

      if (openExternal && typeof window !== 'undefined') {
        window.open(safePreviewUrl, '_blank', 'noopener,noreferrer');
      }
    },
    [
      addToast,
      currentProjectId,
      dispatchBlockedLaunch,
      previewAppPlatform,
      previewDeviceModel,
      previewIsLandscape,
      previewMpPlatform,
      previewPlatform,
      previewUrl,
      previewWebDevice,
      resolveProjectDirectory,
      runConfigurations,
      setPreviewKey,
      setPreviewUrl,
      t,
    ],
  );

  const launchSimulator = useCallback(
    async (
      configuration: RunConfigurationRecord = resolveDefaultRunConfiguration(runConfigurations),
    ) => {
      const projectDirectory = await resolveProjectDirectory();
      if (!projectDirectory) {
        return;
      }
      const simulatorSession = resolveHostStudioSimulatorSession({
        platform: previewPlatform,
        webDevice: previewWebDevice,
        miniProgramPlatform: previewMpPlatform,
        appPlatform: previewAppPlatform,
        deviceModel: previewPlatform === 'web' ? undefined : previewDeviceModel,
        isLandscape: previewIsLandscape,
      });
      const launch = await resolveStudioSimulatorExecutionLaunch(simulatorSession, configuration, {
        projectId: currentProjectId || null,
        runConfigurationId: configuration.id,
        projectDirectory,
        workspaceDirectory: projectDirectory,
        timestamp: Date.now(),
      });

      if (!launch.request) {
        dispatchBlockedLaunch(configuration, launch);
        return;
      }

      emitOpenTerminalRequest(launch.request.terminalRequest);
      setPreviewKey((value) => value + 1);

      try {
        await saveStoredStudioSimulatorExecutionEvidence(launch.request.evidence);
      } catch (error) {
        console.error('Failed to persist simulator execution evidence', error);
      }

      addToast(t('studio.runningSimulator'), 'info');
    },
    [
      addToast,
      currentProjectId,
      dispatchBlockedLaunch,
      previewAppPlatform,
      previewDeviceModel,
      previewIsLandscape,
      previewMpPlatform,
      previewPlatform,
      previewWebDevice,
      resolveProjectDirectory,
      runConfigurations,
      setPreviewKey,
      t,
    ],
  );

  const handleRunTaskExecution = useCallback(
    (configuration: RunConfigurationRecord) => {
      setIsRunTaskVisible(false);
      if (configuration.group === 'build') {
        void dispatchBuildRunConfiguration(configuration);
        return;
      }
      if (configuration.group === 'test') {
        void dispatchTestRunConfiguration(configuration);
        return;
      }
      if (configuration.group === 'dev' && activeTab === 'simulator') {
        void launchSimulator(configuration);
        return;
      }

      void dispatchRunConfiguration(configuration);
      if (configuration.group === 'dev') {
        addToast(t('studio.runningDevTask'), 'info');
        return;
      }
      addToast(`Running ${configuration.name}`, 'info');
    },
    [
      activeTab,
      addToast,
      dispatchBuildRunConfiguration,
      dispatchRunConfiguration,
      dispatchTestRunConfiguration,
      launchSimulator,
      setIsRunTaskVisible,
      t,
    ],
  );

  const handleSubmitRunConfiguration = useCallback(async () => {
    await saveRunConfiguration(runConfigurationDraft);
    addToast(t('studio.configurationSaved'), 'success');
    setIsRunConfigVisible(false);
  }, [addToast, runConfigurationDraft, saveRunConfiguration, setIsRunConfigVisible, t]);

  const handleSaveDebugConfiguration = useCallback(() => {
    addToast(t('studio.debugConfigurationUnavailable'), 'error');
    setIsDebugConfigVisible(false);
  }, [addToast, setIsDebugConfigVisible, t]);

  return {
    handleRunTaskExecution,
    handleSaveDebugConfiguration,
    handleSubmitRunConfiguration,
    launchPreview,
    launchSimulator,
  } as const;
}

