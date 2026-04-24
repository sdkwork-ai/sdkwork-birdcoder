import { defineLocaleModule } from '../../resource.ts';

export default defineLocaleModule('code/mobile-programming', {
  code: {
    mobileProgramming: {
      eyebrow: 'Mobile programming',
      title: 'Continue this coding session on your phone',
      description:
        'Scan the QR code with the SDKWORK app to open the current BirdCoder workspace and session on mobile.',
      workspaceLabel: 'Workspace',
      projectLabel: 'Project',
      sessionLabel: 'Session',
      unavailable: 'Unavailable',
      qrAlt: 'Mobile programming QR code',
      contextHint:
        'The QR code already contains the current workspace, project, and session context so the mobile app can continue from the same coding surface.',
      stepsEyebrow: 'How it works',
      stepsTitle: 'Open in SDKWORK app',
      stepDownloadTitle: 'Download SDKWORK app',
      stepDownloadDescription:
        'Install the latest SDKWORK app on your phone before scanning this programming session.',
      stepScanTitle: 'Open the app and scan',
      stepScanDescription:
        'Use the in-app scanner in SDKWORK to scan this QR code from the code view.',
      stepContinueTitle: 'Continue mobile programming',
      stepContinueDescription:
        'After the scan succeeds, continue the current coding session from the linked mobile surface.',
      installHint:
        'If the phone has not installed SDKWORK app yet, install it first and then return here to scan.',
    },
  },
});
