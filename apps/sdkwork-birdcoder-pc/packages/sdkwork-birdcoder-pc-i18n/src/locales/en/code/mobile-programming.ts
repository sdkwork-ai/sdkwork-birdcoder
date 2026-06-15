import { defineLocaleModule } from '../../resource.ts';

export default defineLocaleModule('code/mobile-programming', {
  code: {
    mobileProgramming: {
      eyebrow: 'Mobile coding simulator',
      title: 'Experience mobile programming in a phone workflow',
      description:
        'Scan the QR code to open this project on your phone and keep coding through the same assistant conversation.',
      workspaceLabel: 'Workspace',
      projectLabel: 'Project',
      sessionLabel: 'Session',
      unavailable: 'Unavailable',
      qrAlt: 'Mobile programming QR code',
      qrLoadingTitle: 'Generating QR code',
      qrUnavailableTitle: 'QR code unavailable',
      contextHint:
        'The QR code already contains the current workspace, project, and session context so the mobile app can continue from the same coding surface.',
      simulatorLabel: 'Phone simulator showing mobile coding assistant conversation',
      simulatorStatus: 'Mobile assistant online',
      simulatorSubtitle: 'Connected to the current code session',
      sessionFallback: 'Current coding session',
      projectFallback: 'BirdCoder mobile project',
      userMessage: 'Make the login page support one-tap mobile verification.',
      assistantMessagePlan:
        'I found the login view and will update the form, verification state, and mobile preview together.',
      codeFileLabel: 'src/pages/Login.tsx',
      assistantMessageCode:
        'export function LoginPanel() {\n  return <OtpLogin mode="mobile" />;\n}',
      assistantMessagePreview:
        'Done. I updated 2 files and started the mobile simulator preview for verification.',
      changeChip: '2 files changed',
      runChip: 'Preview running',
      composerPlaceholder: 'Ask BirdCoder to change the app...',
      sendLabel: 'Send mobile coding request',
      scanPanelTitle: 'Mobile entry',
      scanTitle: 'Scan',
      scanCta: 'Start mobile programming',
      scanDescription:
        'Open SDKWORK on your phone and scan this code to enter the same project, session, and coding context.',
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
