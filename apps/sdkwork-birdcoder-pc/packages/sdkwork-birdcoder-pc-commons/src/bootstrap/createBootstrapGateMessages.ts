import i18n from '../i18n/index.ts';

export interface BootstrapGateMessages {
  bootingDescription: string;
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
    startupFailed: i18n.t('bootstrap.startupFailed'),
    retry: i18n.t('bootstrap.retry'),
    startupTimeout: (seconds) => i18n.t('bootstrap.startupTimeout', { seconds }),
    unknownFailure: i18n.t('bootstrap.unknownFailure'),
  };
}
