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

function listMaterializedFiles(relativeRoot) {
  const absoluteRoot = resolve(relativeRoot);
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
        files.push(normalizePath(path.relative(root, child)));
      }
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function listAuthoredSurfaceFiles(scan) {
  const extensions = new Set(scan.extensions ?? []);
  const excludedSegments = new Set(scan.excludedSegments ?? []);
  const files = [];

  function visit(absolutePath) {
    const relativePath = normalizePath(path.relative(root, absolutePath));
    if (
      relativePath
        .split('/')
        .some((segment) => excludedSegments.has(segment))
    ) {
      return;
    }

    const entry = fs.statSync(absolutePath);
    if (entry.isDirectory()) {
      for (const child of fs.readdirSync(absolutePath)) {
        visit(path.join(absolutePath, child));
      }
      return;
    }

    if (entry.isFile() && extensions.has(path.extname(absolutePath).toLowerCase())) {
      files.push({ absolutePath, relativePath });
    }
  }

  for (const relativeRoot of scan.roots ?? []) {
    const absoluteRoot = resolve(relativeRoot);
    if (fs.existsSync(absoluteRoot)) {
      visit(absoluteRoot);
    }
  }

  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
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
assert.deepEqual(ownedTables, [], 'BirdCoder must not own business tables');
assert.equal(spec.persistence.systemOfRecord, null);
assert.equal(spec.persistence.tableRegistry, null);
assert.deepEqual(spec.persistence.baselines, []);
assert.deepEqual(spec.persistence.engines, []);
assert.deepEqual(spec.persistence.externalReferences, []);
assert.deepEqual(
  listMaterializedFiles('database'),
  [],
  'BirdCoder must not retain authored files under the retired database authority root',
);

const agentsDependency = spec.dependencies.find((dependency) => dependency.owner === 'sdkwork-agents');
const imDependency = spec.dependencies.find((dependency) => dependency.owner === 'sdkwork-im');
assert.ok(agentsDependency, 'sdkwork-agents dependency ownership must be declared');
assert.ok(imDependency, 'sdkwork-im dependency ownership must be declared');
for (const capability of [
  'agent projects',
  'project composition',
  'sessions',
  'turns',
  'session items',
  'interactions',
  'runtime bindings',
]) {
  assert.ok(agentsDependency.capabilities.includes(capability), `Agents must own ${capability}`);
}
assert.deepEqual(
  imDependency.capabilities,
  ['human conversations', 'human messages', 'members', 'read cursors'],
);
for (const legacyTable of ['chat_conversation', 'chat_message']) {
  assert.equal(agentsDependency.forbiddenLocalTables.includes(legacyTable), false);
  assert.equal(imDependency.forbiddenLocalTables.includes(legacyTable), true);
}

const forbiddenTables = sortedUnique(
  spec.dependencies.flatMap((dependency) => dependency.forbiddenLocalTables ?? []),
);
assert.ok(forbiddenTables.length > 0, 'dependency-owned table denylist must not be empty');

const forbiddenPathPrefixes = sortedUnique(
  spec.dependencies.flatMap((dependency) => dependency.forbiddenLocalPathPrefixes ?? []),
);
const appAuthority = spec.apiOwnership.appApi;
const appDocument = readJson(appAuthority.authorityFile);
const appOperations = operationsFromOpenApi(appDocument);
if (appOperations.length !== appAuthority.operationCount) {
  addViolation(
    'app API',
    `expected ${appAuthority.operationCount} owned operations, found ${appOperations.length}`,
  );
}
const ownedPermissions = sortedUnique(
  appOperations.map((entry) => entry.operation['x-sdkwork-permission']),
);
assert.equal(spec.permissionOwnership.permissionCount, 4);
assert.deepEqual(
  sortedUnique(spec.permissionOwnership.ownedPermissions),
  ownedPermissions,
  'Permission ownership must match the permissions referenced by the App API authority',
);
const iamManifest = readJson(spec.permissionOwnership.authority);
assert.deepEqual(
  sortedUnique((iamManifest.permissions?.catalog ?? []).map((entry) => entry.code)),
  ownedPermissions,
  'The BirdCoder IAM catalog must contain only App API permissions',
);
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
const backendPath = backendAuthority.authorityFile
  ? resolve(backendAuthority.authorityFile)
  : null;
if (backendPath && fs.existsSync(backendPath)) {
  const backendCount = operationsFromOpenApi(JSON.parse(fs.readFileSync(backendPath, 'utf8'))).length;
  if (backendCount !== backendAuthority.operationCount) {
    addViolation(
      'backend API',
      `expected ${backendAuthority.operationCount} owned operations, found ${backendCount}`,
    );
  }
} else if (backendAuthority.operationCount !== 0) {
  addViolation('backend API', 'non-zero operation count requires an authority file');
}

if (spec.apiOwnership.openApi.owned || spec.apiOwnership.openApi.operationCount !== 0) {
  addViolation('open API', 'BirdCoder must own zero Open API operations');
}

const runtimeAuthority = spec.runtimeAuthority;
const topology = readJson(runtimeAuthority.topology);
const topologySource = JSON.stringify(topology);
const expectedGateway = runtimeAuthority.standaloneGateway;
if (
  topology.components?.applicationServer?.crate !== expectedGateway.crate
  || topology.components?.applicationServer?.binary !== expectedGateway.binary
) {
  addViolation(
    'runtime authority',
    `topology applicationServer must be ${expectedGateway.crate}/${expectedGateway.binary}`,
  );
}
for (const [profileId, profile] of Object.entries(topology.orchestration?.profiles ?? {})) {
  for (const process of profile.processes ?? []) {
    if (process.role !== 'api-standalone-gateway') {
      continue;
    }
    if (
      process.crate !== expectedGateway.crate
      || process.binary !== expectedGateway.binary
      || 'package' in process
      || 'script' in process
    ) {
      addViolation(
        'runtime authority',
        `${profileId} must use the canonical Rust standalone gateway`,
      );
    }
  }
}
for (const entrypoint of runtimeAuthority.forbiddenApplicationEntrypoints ?? []) {
  if (topologySource.includes(entrypoint)) {
    addViolation('runtime authority', `topology retains forbidden entrypoint ${entrypoint}`);
  }
}

const rootCargo = fs.readFileSync(resolve('Cargo.toml'), 'utf8');
for (const component of spec.forbiddenLocalComponents) {
  if (rootCargo.includes(component)) {
    addViolation('Cargo workspace', `retains forbidden component ${component}`);
  }
  const componentRoot = resolve(`crates/${component}`);
  if (fs.existsSync(componentRoot) && listMaterializedFiles(`crates/${component}`).length > 0) {
    addViolation('component roots', `retains authored files under crates/${component}`);
  }
}

for (const relativePath of spec.forbiddenApplicationComponents ?? []) {
  if (fs.existsSync(resolve(`${relativePath}/package.json`))) {
    addViolation('application component roots', `retains forbidden directory ${relativePath}`);
  }
}

for (const relativePath of spec.forbiddenLocalAuthorityPaths ?? []) {
  if (fs.existsSync(resolve(relativePath))) {
    addViolation('local authority paths', `retains forbidden path ${relativePath}`);
  }
}

const authoredSurfaceScan = spec.authoredSurfaceScan ?? {};
const authoredFiles = listAuthoredSurfaceFiles(authoredSurfaceScan);
const apiDefinitionFiles = listAuthoredSurfaceFiles({
  ...authoredSurfaceScan,
  roots: authoredSurfaceScan.apiDefinitionRoots ?? [],
});
const forbiddenTablePatterns = forbiddenTables.map((tableName) => ({
  tableName,
  pattern: new RegExp(`\\b${escapeRegExp(tableName)}\\b`, 'iu'),
}));
for (const { absolutePath, relativePath } of authoredFiles) {
  const source = fs.readFileSync(absolutePath, 'utf8');
  for (const { tableName, pattern } of forbiddenTablePatterns) {
    if (pattern.test(source)) {
      addViolation('authored persistence surface', `${relativePath} retains forbidden table ${tableName}`);
    }
  }
}
for (const { absolutePath, relativePath } of apiDefinitionFiles) {
  const source = fs.readFileSync(absolutePath, 'utf8');
  for (const routePrefix of forbiddenPathPrefixes) {
    if (source.includes(routePrefix)) {
      addViolation('authored API surface', `${relativePath} retains dependency-owned route ${routePrefix}`);
    }
  }
}

const staleCanonPatterns = [
  /`agentSessionId` is the BirdCoder logical identity/gu,
  /BirdCoder owns.*coding session/giu,
  /BirdCoder owns.*(?:workspace|project)/giu,
  /(?:chat_conversation|chat_message).*owned by sdkwork-agents/giu,
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
    currentRegistryTableCount: 0,
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
