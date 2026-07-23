import type { BootstrapGateMessages } from './BootstrapGate.tsx';

export function createBootstrapGateMessages(): BootstrapGateMessages {
  return {
    bootingDescription: 'Preparing the BirdCoder mobile workspace.',
    retry: 'Retry',
    startingTitle: 'Starting BirdCoder',
    startupFailed: 'BirdCoder could not start',
    startupTimeout: (seconds) => `Startup did not finish within ${seconds} seconds.`,
    unknownFailure: 'BirdCoder could not complete startup.',
  };
}
