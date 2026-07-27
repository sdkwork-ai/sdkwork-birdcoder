import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

const rootManifest = readJson('sdkwork.app.config.json');
const pcManifest = readJson('apps/sdkwork-birdcoder-pc/sdkwork.app.config.json');
const tauriConfig = readJson(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src-tauri/tauri.conf.json',
);
const bundleTemplate = readJson(
  'apps/sdkwork-birdcoder-pc/config/tauri/tauri.bundle.template.json',
);

const canonicalIdentifier = rootManifest.app.identifiers.desktopAppId;
assert.equal(pcManifest.app.identifiers.desktopAppId, canonicalIdentifier);
assert.equal(tauriConfig.identifier, canonicalIdentifier);
assert.equal(bundleTemplate.identifier, canonicalIdentifier);

console.log('desktop application identity contract passed.');
