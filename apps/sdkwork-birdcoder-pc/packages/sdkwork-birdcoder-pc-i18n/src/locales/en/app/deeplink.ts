import { defineLocaleModule } from '../../resource.ts';

export default defineLocaleModule('app/deeplink', {
  app: {
    deepLinkImportDialogTitle: 'Import model channel',
    deepLinkImportDialogEndpoint: 'Endpoint',
    deepLinkImportDialogApiKey: 'API Key',
    deepLinkImportDialogModel: 'Default model',
    deepLinkImportDialogHint:
      'On confirm the channel is written to the client-local model config and can be managed in Settings → Model Access.',
    deepLinkChannelKindOfficial: 'Official',
    deepLinkChannelKindRelay: 'Relay',
    deepLinkChannelKindCustom: 'Advanced custom',
    deepLinkImportCancel: 'Cancel',
    deepLinkImportConfirm: 'Confirm import',
    deepLinkImporting: 'Importing…',
    deepLinkImportSucceeded:
      'Imported {{kind}} channel "{{name}}". You can manage it in Settings → Model Access.',
    deepLinkImportFailed: 'Deep link import failed: {{message}}',
    deepLinkParseFailed: 'Deep link parse failed: {{error}}',
  },
});
