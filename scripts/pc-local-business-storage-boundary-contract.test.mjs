import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');

const forbiddenAuthorityPaths = [
  'apps/sdkwork-birdcoder-common/packages/sdkwork-birdcoder-chat-contracts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-projection',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/package.json',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/coding-session.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/data.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/storageBindings.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appRuntimeTransport.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/consoleQueries.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkTransportShared.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/agentSessionItemProjection.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/agentSessionSelection.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/storage/dataKernel.ts',
  'crates/sdkwork-birdcoder-tauri-host/src/commands/sql_commands.rs',
];

for (const relativePath of forbiddenAuthorityPaths) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) continue;

  const stats = fs.statSync(absolutePath);
  const containsFiles = stats.isDirectory()
    ? fs.readdirSync(absolutePath, { recursive: true, withFileTypes: true })
      .some((entry) => entry.isFile() || entry.isSymbolicLink())
    : true;
  assert.equal(
    containsFiles,
    false,
    `BirdCoder must not restore local business storage authority: ${relativePath}`,
  );
}

const workbenchSourceRoot = path.join(
  rootDir,
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src',
);
const allowedLocalSettingsConsumers = new Set([
  'hooks/useFileSystem.ts',
  'hooks/usePersistedState.ts',
  'index.ts',
  'terminal/runConfigStorage.ts',
  'terminal/runtime.ts',
  'workbench/preferences.ts',
]);
const localSettingsImportPattern = /from\s+['"][^'"]*storage\/localStore(?:\.ts)?['"]/u;
const forbiddenBusinessScopePattern = /(?:getStoredJson|setStoredJson|setStoredRawValue|trySetStoredRawValue)\(\s*['"](?:agent|audit|chat|conversation|message|session|terminal-governance|transcript)/u;

function collectSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(absolutePath);
    }
    return /\.(?:ts|tsx)$/u.test(entry.name) ? [absolutePath] : [];
  });
}

const localSettingsConsumers = [];
for (const absolutePath of collectSourceFiles(workbenchSourceRoot)) {
  const source = fs.readFileSync(absolutePath, 'utf8');
  if (!localSettingsImportPattern.test(source)) {
    continue;
  }

  const relativePath = path.relative(workbenchSourceRoot, absolutePath).replaceAll('\\', '/');
  localSettingsConsumers.push(relativePath);
  assert.equal(
    forbiddenBusinessScopePattern.test(source),
    false,
    `${relativePath} must not persist Agent, message, audit, or transcript facts in UI settings.`,
  );
}

assert.deepEqual(
  localSettingsConsumers.sort(),
  [...allowedLocalSettingsConsumers].sort(),
  'Only approved device UI settings and recovery consumers may import localStore.',
);

const infrastructurePackage = JSON.parse(
  fs.readFileSync(
    path.join(
      rootDir,
      'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/package.json',
    ),
    'utf8',
  ),
);
assert.equal(
  Object.keys(infrastructurePackage.exports ?? {}).some((key) => key.startsWith('./storage')),
  false,
  'Infrastructure must expose no local business storage subpath.',
);

const deviceStateSource = fs.readFileSync(
  path.join(
    rootDir,
    'crates/sdkwork-birdcoder-tauri-host/src/commands/local_store_commands.rs',
  ),
  'utf8',
);
const hostStateSource = fs.readFileSync(
  path.join(rootDir, 'crates/sdkwork-birdcoder-tauri-host/src/host/state.rs'),
  'utf8',
);

assert.match(
  deviceStateSource,
  /APP_SETTINGS_SCOPE\s*=>\s*key\s*==\s*APP_SETTINGS_KEY,[\s\S]*PROJECT_DEVICE_MOUNTS_SCOPE\s*=>\s*is_project_device_mount_key\(key\),[\s\S]*_\s*=>\s*false,/u,
  'Tauri device-state access must fail closed outside its explicit scope/key allowlist.',
);
assert.doesNotMatch(
  deviceStateSource,
  /\bkv_store\b/u,
  'Tauri device-state commands must not retain the generic kv_store table name.',
);
assert.match(
  deviceStateSource,
  /\bdevice_state_entry\b/u,
  'Tauri device-state commands must target the device_state_entry table.',
);
assert.match(
  hostStateSource,
  /CHECK\s*\([\s\S]*scope = 'settings'[\s\S]*scope = 'project-device-mounts'[\s\S]*scope = 'desktop-runtime-location-identity'[\s\S]*\)/u,
  'The device-state table must enforce the same scope allowlist at the SQLite boundary.',
);
assert.match(
  hostStateSource,
  /SDKWORK_BIRDCODER_DEVICE_STATE_FILE/u,
  'The Tauri host must use the device-state-specific runtime override.',
);
assert.match(
  hostStateSource,
  /birdcoder-device-state\.sqlite3/u,
  'The Tauri host default file must be named as device state rather than business storage.',
);

console.log('PC local business storage boundary contract passed.');
