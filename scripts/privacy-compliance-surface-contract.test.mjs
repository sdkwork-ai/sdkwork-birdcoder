import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

const manifest = readJson('sdkwork.app.config.json');
const settingsSource = readText(
  'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-chat/src/screens/SettingsPage.tsx',
);
const legalLinksSource = readText(
  'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-commons/src/legalLinks.ts',
);
const commonsIndexSource = readText(
  'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-commons/src/index.ts',
);

for (const field of ['privacyPolicyUrl', 'termsOfServiceUrl', 'supportUrl']) {
  assert.equal(
    typeof manifest.app?.[field],
    'string',
    `Root app manifest must declare app.${field} for privacy compliance.`,
  );
  assert.match(
    manifest.app[field],
    /^https:\/\//u,
    `Root app manifest app.${field} must use an https URL.`,
  );
}

assert.match(
  legalLinksSource,
  /resolveBirdCoderLegalLinks/u,
  'H5 commons must expose resolveBirdCoderLegalLinks for runtime legal URL resolution.',
);
assert.match(
  legalLinksSource,
  /privacyPolicyUrl/u,
  'H5 legal links resolver must include privacyPolicyUrl.',
);
assert.match(
  legalLinksSource,
  /termsOfServiceUrl/u,
  'H5 legal links resolver must include termsOfServiceUrl.',
);

assert.match(
  commonsIndexSource,
  /legalLinks/u,
  'h5-commons must export legal link helpers.',
);

assert.match(
  settingsSource,
  /resolveBirdCoderLegalLinks/u,
  'H5 settings screen must resolve legal links for user-facing privacy disclosures.',
);
assert.match(
  settingsSource,
  /privacyPolicyUrl/u,
  'H5 settings screen must link to the privacy policy.',
);
assert.match(
  settingsSource,
  /termsOfServiceUrl/u,
  'H5 settings screen must link to the terms of service.',
);
assert.match(
  settingsSource,
  /rel="noopener noreferrer"/u,
  'H5 legal links must open in a new tab with noopener noreferrer.',
);

const pcLegalLinksSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/legalLinks.ts',
);
const pcCommonsIndexSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/index.ts',
);
const pcLegalSettingsSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-settings/src/components/LegalComplianceSettings.tsx',
);
const pcSettingsPageSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-settings/src/pages/SettingsPage.tsx',
);
const pcSettingsSidebarSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-settings/src/components/SettingsSidebar.tsx',
);

assert.match(
  pcLegalLinksSource,
  /resolveBirdCoderLegalLinks/u,
  'PC commons must expose resolveBirdCoderLegalLinks for runtime legal URL resolution.',
);
assert.match(
  pcCommonsIndexSource,
  /legalLinks/u,
  'pc-commons must export legal link helpers.',
);
assert.match(
  pcLegalSettingsSource,
  /resolveBirdCoderLegalLinks/u,
  'PC legal settings must resolve legal links for user-facing privacy disclosures.',
);
assert.match(
  pcLegalSettingsSource,
  /privacyPolicyUrl/u,
  'PC legal settings must link to the privacy policy.',
);
assert.match(
  pcLegalSettingsSource,
  /termsOfServiceUrl/u,
  'PC legal settings must link to the terms of service.',
);
assert.match(
  pcLegalSettingsSource,
  /rel="noopener noreferrer"/u,
  'PC legal links must open in a new tab with noopener noreferrer.',
);
assert.match(
  pcSettingsPageSource,
  /LegalComplianceSettings/u,
  'PC settings page must render LegalComplianceSettings.',
);
assert.match(
  pcSettingsPageSource,
  /case 'legal'/u,
  'PC settings page must expose a legal compliance tab.',
);
assert.match(
  pcSettingsSidebarSource,
  /'legal'/u,
  'PC settings sidebar must include the legal compliance tab.',
);

assert.equal(
  fs.existsSync(path.join(rootDir, 'SECURITY.md')),
  true,
  'Repository must publish SECURITY.md for commercial privacy/security posture.',
);

console.log('privacy compliance surface contract passed.');
