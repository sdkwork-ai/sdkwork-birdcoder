import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  readCanonicalServerRustSource,
  CANONICAL_SERVER_RUST_PATHS,
} from './birdcoder-canonical-server-rust-sources.mjs';

const workspaceRoot = path.resolve(import.meta.dirname, '..');

function readText(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  assert.ok(fs.existsSync(absolutePath), `Expected file to exist: ${absolutePath}`);
  return fs.readFileSync(absolutePath, 'utf8');
}

const serverSource = readCanonicalServerRustSource(
  CANONICAL_SERVER_RUST_PATHS.codingSessionsEventPayload,
);
const bootstrapCatalogSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/bootstrapConsoleCatalog.ts',
);

for (const [label, source, expectedPattern] of [
  [
    'TypeScript bootstrap tenant id',
    bootstrapCatalogSource,
    /export const BIRDCODER_DEFAULT_LOCAL_TENANT_ID = '0';/u,
  ],
  [
    'TypeScript bootstrap owner id',
    bootstrapCatalogSource,
    /export const BIRDCODER_DEFAULT_LOCAL_OWNER_USER_ID = '100000000000000001';/u,
  ],
  [
    'TypeScript bootstrap workspace id',
    bootstrapCatalogSource,
    /export const BIRDCODER_DEFAULT_WORKSPACE_ID = '100000000000000101';/u,
  ],
  [
    'Rust bootstrap workspace id',
    serverSource,
    /pub const BOOTSTRAP_WORKSPACE_ID: &str = "100000000000000101";/u,
  ],
]) {
  assert.match(source, expectedPattern, `${label} must use decimal-string long identifiers.`);
}

console.log('rust long id standard contract passed.');
