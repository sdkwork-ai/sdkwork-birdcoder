import { defineLocaleModule } from '../../resource.ts';

export default defineLocaleModule('app/bootstrap', {
  bootstrap: {
    startingTitle: 'Starting SDKWork BirdCoder',
    bootingDescription: 'Preparing the local runtime and loading the application shell.',
    startupFailed: 'Startup did not complete. Review the error and retry.',
    retry: 'Retry',
    startupTimeout: 'Startup did not complete within {{seconds}} seconds.',
    unknownFailure: 'Unknown bootstrap failure',
  },
});
