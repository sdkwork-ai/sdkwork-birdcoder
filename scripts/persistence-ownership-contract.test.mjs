import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const agentsRoot = path.resolve(rootDir, '..', 'sdkwork-agents');
const imRoot = path.resolve(rootDir, '..', 'sdkwork-im');

function resolveFrom(root, relativePath) {
  return path.join(root, ...relativePath.split('/'));
}

function exists(root, relativePath) {
  return fs.existsSync(resolveFrom(root, relativePath));
}

function read(root, relativePath) {
  return fs.readFileSync(resolveFrom(root, relativePath), 'utf8');
}

function readJson(root, relativePath) {
  return JSON.parse(read(root, relativePath));
}

function materializedFiles(root, relativePath) {
  const absoluteRoot = resolveFrom(root, relativePath);
  if (!fs.existsSync(absoluteRoot)) {
    return [];
  }
  const files = [];
  const pending = [absoluteRoot];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(child);
      } else if (entry.isFile()) {
        files.push(path.relative(root, child).split(path.sep).join('/'));
      }
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

assert.deepEqual(
  materializedFiles(rootDir, 'database'),
  [],
  'BirdCoder must not retain authored files under the retired database authority root',
);

const rootCargo = read(rootDir, 'Cargo.toml');
for (const forbiddenDependency of [
  'sdkwork_database_config',
  'sdkwork_database_lifecycle',
  'sdkwork_database_spi',
  'sdkwork_database_sqlx',
  'sdkwork_database_id',
  'sqlx =',
]) {
  assert.equal(
    rootCargo.includes(forbiddenDependency),
    false,
    `BirdCoder must not retain server persistence dependency ${forbiddenDependency}`,
  );
}

for (const retiredComponent of [
  'crates/sdkwork-birdcoder-database-host',
  'crates/sdkwork-birdcoder-workspace-repository-sqlx',
  'crates/sdkwork-birdcoder-workspace-service',
  'crates/sdkwork-birdcoder-project-service',
  'crates/sdkwork-routes-workspace-app-api',
]) {
  assert.deepEqual(
    materializedFiles(rootDir, retiredComponent),
    [],
    `${retiredComponent} must not retain authored authority after the Agents cutover`,
  );
}

const assemblyBootstrap = read(
  rootDir,
  'crates/sdkwork-api-birdcoder-assembly/src/application_bootstrap/mod.rs',
);
assert.doesNotMatch(
  assemblyBootstrap,
  /bootstrap_database|wire_repositories|wire_services|DatabasePool|sqlx/iu,
  'BirdCoder API assembly must not bootstrap an application-owned business database',
);

const ownership = readJson(rootDir, 'specs/domain-ownership.spec.json');
assert.equal(ownership.persistence.systemOfRecord, null);
assert.equal(ownership.persistence.tableRegistry, null);
assert.deepEqual(ownership.persistence.tables, []);
assert.deepEqual(ownership.persistence.baselines, []);
assert.deepEqual(ownership.persistence.engines, []);
for (const disabledPattern of [
  'persistentProjections',
  'shadowTables',
  'synchronizedCacheTables',
  'dualWrite',
  'compatibilityFacade',
]) {
  assert.equal(ownership.principles[disabledPattern], false, `${disabledPattern} must stay disabled`);
}

const rootComponent = readJson(rootDir, 'specs/component.spec.json');
const appManifest = readJson(rootDir, 'sdkwork.app.config.json');
assert.equal(rootComponent.ownership.databaseTableCount, 0);
assert.equal(appManifest.metadata?.domainOwnership?.databaseTableCount, 0);

const agentsAuthority = ownership.externalAuthorities.find((entry) => entry.owner === 'sdkwork-agents');
const imAuthority = ownership.externalAuthorities.find((entry) => entry.owner === 'sdkwork-im');
assert.ok(agentsAuthority);
assert.ok(imAuthority);
assert.equal(agentsAuthority.ownerTableRegistry, '../sdkwork-agents/database/contract/table-registry.json');
assert.equal(imAuthority.ownerTableRegistry, '../sdkwork-im/database/contract/table-registry.json');

assert.equal(
  exists(agentsRoot, 'database/contract/table-registry.json'),
  true,
  'sdkwork-agents must publish its canonical table registry for ownership auditing',
);
const agentsRegistry = readJson(agentsRoot, 'database/contract/table-registry.json');
const agentsTables = new Set((agentsRegistry.tables ?? []).map((entry) => entry.table_name));
assert.ok(agentsTables.size > 0, 'sdkwork-agents canonical table registry must not be empty');
assert.equal(
  [...agentsTables].some((tableName) => tableName.includes('workspace')),
  false,
  'sdkwork-agents must use Project as the aggregate and must not introduce a Workspace table',
);

assert.equal(
  exists(imRoot, 'database/contract/table-registry.json'),
  true,
  'sdkwork-im must publish its canonical table registry for ownership auditing',
);
const imRegistry = readJson(imRoot, 'database/contract/table-registry.json');
const imTables = new Set((imRegistry.tables ?? []).map((entry) => entry.table_name));
assert.ok(imTables.size > 0, 'sdkwork-im canonical table registry must not be empty');

const ownerTables = new Set([...agentsTables, ...imTables]);
const retiredLocalTables = new Set(
  ownership.externalAuthorities.flatMap((entry) => entry.retiredLocalTables ?? []),
);
assert.deepEqual(
  [...ownerTables].filter((tableName) => retiredLocalTables.has(tableName)),
  [],
  'BirdCoder must reference owner registries instead of copying canonical external tables',
);
assert.deepEqual(
  ownership.persistence.tables.filter((tableName) => ownerTables.has(tableName)),
  [],
  'BirdCoder must not persist any table declared by Agents or IM',
);

console.log('persistence ownership contract passed.');
