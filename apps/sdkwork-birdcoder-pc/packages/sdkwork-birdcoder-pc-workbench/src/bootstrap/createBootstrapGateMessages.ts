import i18n from '../i18n/index.ts';

export interface BootstrapGateMessages {
  bootingDescription: string;
  desktopApiUnavailable: (apiBaseUrl: string) => string;
  localApiUnavailable: (apiBaseUrl: string) => string;
  runtimeStage: string;
  sessionStage: string;
  workspaceStage: string;
  validatingSession: string;
  loadingWorkspace: string;
  retry: string;
  startingTitle: string;
  startupFailed: string;
  startupTimeout: (seconds: number) => string;
  unknownFailure: string;
}

export function createBootstrapGateMessages(): BootstrapGateMessages {
  return {
    startingTitle: i18n.t('bootstrap.startingTitle'),
    bootingDescription: i18n.t('bootstrap.bootingDescription'),
    desktopApiUnavailable: (apiBaseUrl) =>
      i18n.t('bootstrap.desktopApiUnavailable', { apiBaseUrl }),
    localApiUnavailable: (apiBaseUrl) =>
      i18n.t('bootstrap.localApiUnavailable', { apiBaseUrl }),
    runtimeStage: i18n.t('bootstrap.runtimeStage'),
    sessionStage: i18n.t('bootstrap.sessionStage'),
    workspaceStage: i18n.t('bootstrap.workspaceStage'),
    validatingSession: i18n.t('bootstrap.validatingSession'),
    loadingWorkspace: i18n.t('bootstrap.loadingWorkspace'),
    startupFailed: i18n.t('bootstrap.startupFailed'),
    retry: i18n.t('bootstrap.retry'),
    startupTimeout: (seconds) => i18n.t('bootstrap.startupTimeout', { seconds }),
    unknownFailure: i18n.t('bootstrap.unknownFailure'),
  };
}
