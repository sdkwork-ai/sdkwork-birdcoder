import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');

function readText(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  assert.ok(fs.existsSync(absolutePath), `Expected file to exist: ${absolutePath}`);
  return fs.readFileSync(absolutePath, 'utf8');
}

const rustCatalogSource = readText('packages/sdkwork-birdcoder-codeengine/src-host/src/catalog.rs');
const tsManifestSource = readText('packages/sdkwork-birdcoder-codeengine/src/manifest.ts');
const generatedCatalogSource = readText(
  'packages/sdkwork-birdcoder-codeengine/src-host/generated/engine-catalog.json',
);

assert.match(
  rustCatalogSource,
  /const ENGINE_CATALOG_DEFAULT_TENANT_ID: &str = "0";/u,
  'Rust codeengine catalog default tenant id must use the canonical decimal-string long tenant id.',
);
assert.match(
  tsManifestSource,
  /const ENGINE_CATALOG_DEFAULT_TENANT_ID = '0';/u,
  'TypeScript codeengine manifest default tenant id must use the canonical decimal-string long tenant id.',
);
assert.doesNotMatch(
  generatedCatalogSource,
  /"tenantId"\s*:\s*"tenant-default"/u,
  'Generated codeengine catalog must not publish legacy semantic tenant ids.',
);
assert.match(
  generatedCatalogSource,
  /"tenantId"\s*:\s*"0"/u,
  'Generated codeengine catalog must publish the canonical decimal-string long tenant id.',
);

console.log('codeengine catalog tenant standard contract passed.');
