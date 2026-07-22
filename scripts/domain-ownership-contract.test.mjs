import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const reportOnly = process.argv.includes('--report');
const specPath = path.join(root, 'specs/domain-ownership.spec.json');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const violations = [];

function resolve(relativePath) {
  return path.join(root, relativePath);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(resolve(relativePath), 'utf8'));
}

function normalizePath(value) {
  return value.replaceAll('\\', '/');
}

function addViolation(scope, detail) {
  violations.push(`${scope}: ${detail}`);
}

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function compareExactSet(scope, actualValues, expectedValues) {
  const actual = sortedUnique(actualValues);
  const expected = sortedUnique(expectedValues);
  const missing = expected.filter((value) => !actual.includes(value));
  const unexpected = actual.filter((value) => !expected.includes(value));

  for (const value of missing) {
    addViolation(scope, `missing ${value}`);
  }
  for (const value of unexpected) {
    addViolation(scope, `unexpected ${value}`);
  }
}

function tableNamesFromRegistry(registry) {
  return (registry.tables ?? []).map((entry) =>
    typeof entry === 'string' ? entry : entry.table_name ?? entry.name ?? entry.table,
  );
}

function tableNamesFromDdl(source) {
  return [...source.matchAll(/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:["`\[]?\w+["`\]]?\.)?["`\[]?([a-z][a-z0-9_]*)["`\]]?/giu)]
    .map((match) => match[1]);
}

function tableBlocksFromDdl(source) {
  return [...source.matchAll(/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:["`\[]?\w+["`\]]?\.)?["`\[]?([a-z][a-z0-9_]*)["`\]]?\s*\(([\s\S]*?)\);/giu)]
    .map((match) => ({ name: match[1], body: match[2] }));
}

function operationsFromOpenApi(document) {
  const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']);
  const operations = [];
  for (const [routePath, pathItem] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (methods.has(method.toLowerCase())) {
        operations.push({ method: method.toUpperCase(), path: routePath, operation });
      }
    }
  }
  return operations;
}

function pathMatchesPrefix(routePath, prefix) {
  return routePath === prefix || routePath.startsWith(`${prefix}/`);
}

assert.equal(spec.kind, 'sdkwork.application-domain-ownership');
assert.equal(spec.application, 'sdkwork-birdcoder');
assert.equal(spec.status, 'active');
assert.equal(spec.principles.preLaunchDirectCutover, true);
assert.equal(spec.principles.singleWriteOwnerPerBusinessFact, true);
assert.equal(spec.principles.persistentProjections, false);
assert.equal(spec.principles.shadowTables, false);
assert.equal(spec.principles.synchronizedCacheTables, false);
assert.equal(spec.principles.dualWrite, false);
assert.equal(spec.principles.compatibilityFacade, false);

const ownedTables = sortedUnique(spec.persistence.tables);
assert.equal(ownedTables.length, 10, 'BirdCoder target persistence must contain exactly ten tables');
assert.equal(ownedTables.every((name) => name.startsWith('studio_')), true);

const forbiddenTables = sortedUnique(
  spec.dependencies.flatMap((dependency) => dependency.forbiddenLocalTables ?? []),
);
for (const tableName of ownedTables.filter((name) => forbiddenTables.includes(name))) {
  addViolation('ownership contract', `${tableName} is both owned and forbidden`);
}

const registry = readJson(spec.persistence.tableRegistry);
compareExactSet('table registry', tableNamesFromRegistry(registry), ownedTables);

for (const baseline of spec.persistence.baselines) {
  const source = fs.readFileSync(resolve(baseline), 'utf8');
  const tables = tableNamesFromDdl(source);
  compareExactSet(baseline, tables, ownedTables);

  if (/\bBIGSERIAL\b|\bSERIAL\b|\bAUTOINCREMENT\b|\bINTEGER\s+PRIMARY\s+KEY\b/iu.test(source)) {
    addViolation(baseline, 'database-allocated or SQLite rowid primary key syntax is forbidden');
  }

  for (const { name, body } of tableBlocksFromDdl(source)) {
    if (!ownedTables.includes(name)) {
      continue;
    }
    if (!/^\s*id\s+BIGINT\s+NOT\s+NULL\s+PRIMARY\s+KEY\s*(?:,|$)/imu.test(body)) {
      addViolation(baseline, `${name}.id must be explicit BIGINT NOT NULL PRIMARY KEY`);
    }
    for (const reference of body.matchAll(/\bREFERENCES\s+["`\[]?([a-z][a-z0-9_]*)["`\]]?/giu)) {
      if (!ownedTables.includes(reference[1])) {
        addViolation(baseline, `${name} has cross-domain foreign key to ${reference[1]}`);
      }
    }
  }
}

const forbiddenPathPrefixes = sortedUnique(
  spec.dependencies.flatMap((dependency) => dependency.forbiddenLocalPathPrefixes ?? []),
);
const appAuthority = spec.apiOwnership.appApi;
const appDocument = readJson(appAuthority.authorityFile);
const appOperations = operationsFromOpenApi(appDocument);
for (const entry of appOperations) {
  const forbiddenPrefix = forbiddenPathPrefixes.find((prefix) =>
    pathMatchesPrefix(entry.path, prefix),
  );
  if (forbiddenPrefix) {
    addViolation(
      'app API',
      `${entry.method} ${entry.path} retains dependency-owned prefix ${forbiddenPrefix}`,
    );
    continue;
  }
  if (!appAuthority.ownedPathPrefixes.some((prefix) => pathMatchesPrefix(entry.path, prefix))) {
    addViolation('app API', `${entry.method} ${entry.path} is outside the BirdCoder boundary`);
  }
  if (entry.operation['x-sdkwork-owner'] !== 'sdkwork-birdcoder') {
    addViolation('app API', `${entry.method} ${entry.path} has invalid x-sdkwork-owner`);
  }
  if (entry.operation['x-sdkwork-api-authority'] !== appAuthority.authority) {
    addViolation('app API', `${entry.method} ${entry.path} has invalid x-sdkwork-api-authority`);
  }
}

const backendAuthority = spec.apiOwnership.backendApi;
const backendPath = resolve(backendAuthority.authorityFile);
if (fs.existsSync(backendPath)) {
  const backendCount = operationsFromOpenApi(JSON.parse(fs.readFileSync(backendPath, 'utf8'))).length;
  if (backendCount !== backendAuthority.operationCount) {
    addViolation(
      'backend API',
      `expected ${backendAuthority.operationCount} owned operations, found ${backendCount}`,
    );
  }
}

if (spec.apiOwnership.openApi.owned || spec.apiOwnership.openApi.operationCount !== 0) {
  addViolation('open API', 'BirdCoder must own zero Open API operations');
}

const rootCargo = fs.readFileSync(resolve('Cargo.toml'), 'utf8');
for (const component of spec.forbiddenLocalComponents) {
  if (rootCargo.includes(component)) {
    addViolation('Cargo workspace', `retains forbidden component ${component}`);
  }
  const componentRoot = resolve(`crates/${component}`);
  if (fs.existsSync(componentRoot)) {
    addViolation('component roots', `retains forbidden directory crates/${component}`);
  }
}

const staleCanonPatterns = [
  /`codingSessionId` is the BirdCoder logical identity/gu,
  /chat_conversation\/chat_message.*sdkwork-im/giu,
  /BirdCoder owns.*coding session/giu,
];
for (const relativePath of [
  'docs/README.md',
  'docs/product/prd/PRD.md',
  'docs/architecture/tech/TECH_ARCHITECTURE.md',
]) {
  const source = fs.readFileSync(resolve(relativePath), 'utf8');
  for (const pattern of staleCanonPatterns) {
    if (pattern.test(source)) {
      addViolation('documentation Canon', `${relativePath} contains stale ownership text ${pattern}`);
    }
  }
}

violations.sort((left, right) => left.localeCompare(right));

if (reportOnly) {
  const summary = {
    targetTableCount: ownedTables.length,
    currentRegistryTableCount: tableNamesFromRegistry(registry).length,
    currentAppOperationCount: appOperations.length,
    violationCount: violations.length,
  };
  console.log(JSON.stringify(summary, null, 2));
  for (const violation of violations) {
    console.log(`- ${normalizePath(violation)}`);
  }
  process.exit(0);
}

assert.deepEqual(
  violations,
  [],
  ['BirdCoder domain ownership cutover is incomplete.', ...violations].join('\n'),
);

console.log('domain ownership contract passed.');
