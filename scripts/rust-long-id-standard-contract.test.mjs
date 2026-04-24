import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');

function readText(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  assert.ok(fs.existsSync(absolutePath), `Expected file to exist: ${absolutePath}`);
  return fs.readFileSync(absolutePath, 'utf8');
}

const serverSource = readText('packages/sdkwork-birdcoder-server/src-host/src/lib.rs');
const desktopSource = readText('packages/sdkwork-birdcoder-desktop/src-tauri/src/lib.rs');
const userCenterSource = readText('packages/sdkwork-birdcoder-server/src-host/src/user_center.rs');
const bootstrapCatalogSource = readText(
  'packages/sdkwork-birdcoder-infrastructure/src/storage/bootstrapConsoleCatalog.ts',
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
    'Rust bootstrap tenant id',
    serverSource,
    /const SQLITE_AUTHORITY_DEFAULT_TENANT_ID: &str = "0";/u,
  ],
  [
    'Rust bootstrap owner id',
    serverSource,
    /const BOOTSTRAP_WORKSPACE_OWNER_USER_ID: &str = "100000000000000001";|pub\(crate\) const BOOTSTRAP_WORKSPACE_OWNER_USER_ID: &str = "100000000000000001";/u,
  ],
  [
    'Rust bootstrap workspace id',
    serverSource,
    /const BOOTSTRAP_WORKSPACE_ID: &str = "100000000000000101";/u,
  ],
  [
    'Rust bootstrap project id',
    serverSource,
    /const BOOTSTRAP_PROJECT_ID: &str = "100000000000000201";/u,
  ],
  [
    'Rust bootstrap team id',
    serverSource,
    /const BOOTSTRAP_TEAM_ID: &str = "100000000000000301";/u,
  ],
  [
    'Rust bootstrap team member id',
    serverSource,
    /const BOOTSTRAP_TEAM_MEMBER_ID: &str = "100000000000000302";/u,
  ],
  [
    'Rust bootstrap workspace member id',
    serverSource,
    /const BOOTSTRAP_WORKSPACE_MEMBER_ID: &str = "100000000000000303";/u,
  ],
  [
    'Rust bootstrap project collaborator id',
    serverSource,
    /const BOOTSTRAP_PROJECT_COLLABORATOR_ID: &str = "100000000000000304";/u,
  ],
  [
    'Desktop bootstrap workspace id',
    desktopSource,
    /const DEFAULT_BOOTSTRAP_WORKSPACE_ID: &str = "100000000000000101";/u,
  ],
  [
    'Desktop bootstrap owner id',
    desktopSource,
    /const DEFAULT_BOOTSTRAP_WORKSPACE_OWNER_USER_ID: &str = "100000000000000001";/u,
  ],
  [
    'User center bootstrap tenant id',
    userCenterSource,
    /const DEFAULT_LOCAL_TENANT_ID: &str = "0";/u,
  ],
]) {
  assert.match(source, expectedPattern, `${label} must use decimal-string long identifiers.`);
}

assert.doesNotMatch(
  serverSource,
  /format!\s*\(\s*"\{prefix\}-\{\}"\s*,\s*Uuid::new_v4\(\)\.simple\(\)\s*\)/u,
  'Rust runtime identifiers must not use semantic prefix + UUID formatting.',
);

assert.match(
  serverSource,
  /fn create_identifier\(_entity_kind: &str\) -> String/u,
  'Rust runtime identifier factory must accept entity kind without embedding semantic prefixes.',
);

assert.match(
  serverSource,
  /fn next_decimal_string_identifier\(\) -> String/u,
  'Rust runtime identifier generation must flow through a decimal-string identifier helper.',
);

console.log('rust long id standard contract passed.');
