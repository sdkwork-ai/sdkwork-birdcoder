import { defineLocaleModule } from '../../resource.ts';

export default defineLocaleModule('app/bootstrap', {
  bootstrap: {
    startingTitle: 'SDKWork BirdCoder',
    bootingDescription: 'Connecting to the local runtime and preparing your workspace.',
    desktopApiUnavailable:
      'The embedded runtime at {{apiBaseUrl}} did not become ready. Retry now; if the issue continues, fully quit and restart BirdCoder.',
    localApiUnavailable:
      'BirdCoder could not connect to {{apiBaseUrl}}. Confirm that the local service is running, then retry.',
    runtimeStage: 'Local runtime',
    sessionStage: 'Secure session',
    workspaceStage: 'Workspace shell',
    validatingSession: 'Validating your secure session.',
    loadingWorkspace: 'Loading your workspace shell.',
    startupFailed: 'Startup did not complete. Review the error and retry.',
    retry: 'Retry',
    startupTimeout: 'Startup did not complete within {{seconds}} seconds.',
    unknownFailure: 'Unknown bootstrap failure',
  },
});
