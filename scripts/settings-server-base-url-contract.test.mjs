import assert from 'node:assert/strict';
import fs from 'node:fs';

const configSettingsPath = new URL(
  '../packages/sdkwork-birdcoder-settings/src/components/ConfigSettings.tsx',
  import.meta.url,
);
const settingsPagePath = new URL(
  '../packages/sdkwork-birdcoder-settings/src/pages/SettingsPage.tsx',
  import.meta.url,
);
const desktopMainPath = new URL(
  '../packages/sdkwork-birdcoder-desktop/src/main.tsx',
  import.meta.url,
);
const webMainPath = new URL(
  '../packages/sdkwork-birdcoder-web/src/main.tsx',
  import.meta.url,
);
const rootMainPath = new URL('../src/main.tsx', import.meta.url);

const configSettingsSource = fs.readFileSync(configSettingsPath, 'utf8');
const settingsPageSource = fs.readFileSync(settingsPagePath, 'utf8');
const desktopMainSource = fs.readFileSync(desktopMainPath, 'utf8');
const webMainSource = fs.readFileSync(webMainPath, 'utf8');
const rootMainSource = fs.readFileSync(rootMainPath, 'utf8');

assert.equal(
  configSettingsSource.includes('serverBaseUrl'),
  true,
  'ConfigSettings must expose a persisted server Base URL field.',
);
assert.equal(
  configSettingsSource.includes('currentServerBaseUrl'),
  true,
  'ConfigSettings must display the current effective server Base URL alongside the editable override.',
);
assert.equal(
  settingsPageSource.includes('serverBaseUrl'),
  true,
  'SettingsPage default settings must persist the server Base URL field.',
);
assert.equal(
  desktopMainSource.includes('readStoredBirdCoderServerBaseUrl'),
  true,
  'Desktop startup must read the persisted server Base URL before bootstrapping runtime services.',
);
assert.equal(
  desktopMainSource.includes('resolveBirdCoderBootstrapServerBaseUrl'),
  true,
  'Desktop startup must resolve persisted override vs embedded runtime Base URL explicitly.',
);
assert.equal(
  webMainSource.includes('readStoredBirdCoderServerBaseUrl'),
  true,
  'Web startup must read the persisted server Base URL before bootstrapping runtime services.',
);
assert.equal(
  rootMainSource.includes('readStoredBirdCoderServerBaseUrl'),
  true,
  'The legacy root Vite entry must also honor the persisted server Base URL override.',
);

console.log('settings server base url contract passed.');
