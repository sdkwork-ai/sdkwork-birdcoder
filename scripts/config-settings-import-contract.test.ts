import assert from 'node:assert/strict';

import {
  AppSettingsImportError,
  parseAppSettingsImport,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-settings/src/components/appSettingsImport.ts';
import {
  DEFAULT_APP_SETTINGS,
  normalizeAppSettings,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/settings/appSettings.ts';

function createImportFile(value: string, size = Buffer.byteLength(value)) {
  return {
    size,
    text: async () => value,
  };
}

const imported = await parseAppSettingsImport(
  createImportFile(
    JSON.stringify({
      version: 1,
      settings: {
        approvalPolicy: 'On request',
        sandboxSettings: 'Read and write',
        serverBaseUrl: 'https://example.com/api/',
        theme: 'Light',
        requireCtrlEnter: true,
        ignoredExternalKey: 'ignored',
      },
    }),
  ),
);

assert.deepEqual(imported.settings, {
  approvalPolicy: 'OnRequest',
  sandboxSettings: 'ReadWrite',
  serverBaseUrl: 'https://example.com/api',
  theme: 'Light',
  requireCtrlEnter: true,
});
assert.deepEqual(imported.importedKeys, [
  'approvalPolicy',
  'sandboxSettings',
  'serverBaseUrl',
  'theme',
  'requireCtrlEnter',
]);

const normalized = normalizeAppSettings({
  approvalPolicy: 'Never' as never,
  sandboxSettings: 'Full access' as never,
  requireCtrlEnter: 'yes' as never,
});
assert.equal(normalized.approvalPolicy, 'AutoAllow');
assert.equal(normalized.sandboxSettings, 'FullAccess');
assert.equal(normalized.requireCtrlEnter, DEFAULT_APP_SETTINGS.requireCtrlEnter);

async function assertImportError(
  content: string,
  expectedCode: AppSettingsImportError['code'],
  size?: number,
) {
  await assert.rejects(
    () => parseAppSettingsImport(createImportFile(content, size)),
    (error: unknown) =>
      error instanceof AppSettingsImportError && error.code === expectedCode,
  );
}

await assertImportError('{', 'invalid-json');
await assertImportError('[]', 'invalid-shape');
await assertImportError('{"theme":false}', 'invalid-value');
await assertImportError('{"theme":"not-a-theme"}', 'invalid-value');
await assertImportError('{"uiFontSize":"999999999"}', 'invalid-value');
await assertImportError('{"darkAccent":"not-a-color"}', 'invalid-value');
await assertImportError('{"darkAccent":"#12"}', 'invalid-value');
await assertImportError('{"serverBaseUrl":"file:///tmp/config"}', 'invalid-value');
await assertImportError(
  '{"serverBaseUrl":"https://user:password@example.com"}',
  'invalid-value',
);
await assertImportError('{"external":true}', 'empty');
await assertImportError('{}', 'too-large', 256 * 1024 + 1);

const normalizedUnsafeSettings = normalizeAppSettings({
  theme: 'not-a-theme' as never,
  uiFontSize: '999999999' as never,
  darkAccent: 'not-a-color' as never,
});
assert.equal(normalizedUnsafeSettings.theme, DEFAULT_APP_SETTINGS.theme);
assert.equal(normalizedUnsafeSettings.uiFontSize, DEFAULT_APP_SETTINGS.uiFontSize);
assert.equal(normalizedUnsafeSettings.darkAccent, DEFAULT_APP_SETTINGS.darkAccent);

console.log('config settings import contract passed.');
