import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { RELEASE_FLOW_CHECK_COMMANDS } from './run-release-flow-check.mjs';

const rootDir = process.cwd();
const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);
const EXPECTED_SYSTEM_PATHS = [
  '/app/v3/api/system/descriptor',
  '/app/v3/api/system/health',
  '/app/v3/api/system/routes',
  '/app/v3/api/system/runtime',
];
const EXPECTED_DEPENDENCY_AUTHORITIES = Object.freeze({
  agentProjects: 'sdkwork-agents',
  agentProjectComposition: 'sdkwork-agents',
  agentSessions: 'sdkwork-agents',
  agentSessionItems: 'sdkwork-agents',
  agentRuntimeBindings: 'sdkwork-agents',
  skills: 'sdkwork-skills',
  savedPrompts: 'sdkwork-prompts',
  documentContent: 'sdkwork-documents',
  humanMessaging: 'sdkwork-im',
});
const EXPECTED_SDK_DEPENDENCIES = Object.freeze([
  'sdkwork-iam-app-sdk',
  'sdkwork-drive-app-sdk',
  'sdkwork-messaging-app-sdk',
  'sdkwork-membership-app-sdk',
  'sdkwork-skills-app-sdk',
  'sdkwork-agents-app-sdk',
  'sdkwork-prompts-app-sdk',
  'sdkwork-documents-app-sdk',
]);

function resolvePath(relativePath) {
  return path.join(rootDir, ...relativePath.split('/'));
}

function read(relativePath) {
  return fs.readFileSync(resolvePath(relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function operations(openapi) {
  const result = [];
  for (const [routePath, pathItem] of Object.entries(openapi.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (HTTP_METHODS.has(method)) {
        result.push({ method, operation, routePath });
      }
    }
  }
  return result;
}

function materializedFiles(relativePath) {
  const absoluteRoot = resolvePath(relativePath);
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
        files.push(path.relative(rootDir, child).split(path.sep).join('/'));
      }
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

for (const relativePath of [
  'AGENTS.md',
  'sdkwork.app.config.json',
  'specs/component.spec.json',
  'specs/domain-ownership.spec.json',
  'specs/agents-birdcoder-alignment.spec.json',
  'specs/kernel-birdcoder-alignment.spec.json',
  'specs/iam.module.manifest.json',
  'specs/topology.spec.json',
  'apis/README.md',
  'sdks/specs/component.spec.json',
  'sdks/specs/domain-catalog.json',
  'sdks/sdkwork-birdcoder-app-sdk/sdk-manifest.json',
  'sdks/sdkwork-birdcoder-app-sdk/specs/component.spec.json',
  'sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json',
  'sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.sdkgen.json',
  'apps/sdkwork-birdcoder-pc/sdkwork.app.config.json',
  'apps/sdkwork-birdcoder-pc/specs/component.spec.json',
  'crates/sdkwork-api-birdcoder-standalone-gateway/Cargo.toml',
  'crates/sdkwork-api-birdcoder-assembly/assembly-manifest.json',
  'crates/sdkwork-routes-system-app-api/Cargo.toml',
  'docs/README.md',
  'docs/product/prd/PRD.md',
  'docs/architecture/tech/TECH_ARCHITECTURE.md',
  'docs/architecture/decisions/ADR-20260722-domain-ownership-and-single-write-authority.md',
  'docs/migrations/MIG-2026-0002-domain-ownership-cutover.md',
  'scripts/domain-ownership-contract.test.mjs',
  'scripts/persistence-ownership-contract.test.mjs',
  'scripts/birdcoder-sdk-owner-boundary-contract.test.mjs',
  'scripts/birdcoder-sdk-family-standard-contract.test.mjs',
  'scripts/agents-birdcoder-alignment-contract.test.mjs',
  'scripts/technical-debt-contract.test.mjs',
]) {
  assert.equal(fs.existsSync(resolvePath(relativePath)), true, `Missing architecture authority: ${relativePath}`);
}

assert.deepEqual(
  materializedFiles('database'),
  [],
  'BirdCoder must not retain authored database authority files',
);
for (const relativePath of [
  'sdks/sdkwork-birdcoder-backend-sdk/sdk-manifest.json',
  'sdks/sdkwork-birdcoder-open-sdk/sdk-manifest.json',
  'sdks/specs/openapi/birdcoder-app-v3.openapi.json',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/package.json',
  'crates/sdkwork-birdcoder-database-host/Cargo.toml',
  'crates/sdkwork-birdcoder-workspace-repository-sqlx/Cargo.toml',
  'crates/sdkwork-birdcoder-workspace-service/Cargo.toml',
  'crates/sdkwork-birdcoder-project-service/Cargo.toml',
  'crates/sdkwork-routes-workspace-app-api/Cargo.toml',
  'crates/sdkwork-birdcoder-coding-sessions-service/Cargo.toml',
  'crates/sdkwork-birdcoder-chat-repository-sqlx/Cargo.toml',
  'crates/sdkwork-birdcoder-skill-packages-repository-sqlx/Cargo.toml',
]) {
  assert.equal(fs.existsSync(resolvePath(relativePath)), false, `Retired local authority remains: ${relativePath}`);
}

const appManifest = readJson('sdkwork.app.config.json');
const rootComponent = readJson('specs/component.spec.json');
const ownership = readJson('specs/domain-ownership.spec.json');
const iamManifest = readJson('specs/iam.module.manifest.json');
const domainCatalog = readJson('sdks/specs/domain-catalog.json');
const sdkManifest = readJson('sdks/sdkwork-birdcoder-app-sdk/sdk-manifest.json');
const sdkComponent = readJson('sdks/sdkwork-birdcoder-app-sdk/specs/component.spec.json');
const appOpenApi = readJson(
  'sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json',
);
const sdkgenInput = readJson(
  'sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.sdkgen.json',
);
const assembly = readJson('crates/sdkwork-api-birdcoder-assembly/assembly-manifest.json');
const rootPackage = readJson('package.json');

assert.equal(rootComponent.component.domain, 'intelligence');
assert.equal(rootComponent.component.capability, 'coding-workbench');
assert.deepEqual(rootComponent.ownership, {
  boundedContext: 'intelligence/coding-workbench',
  domainContract: 'specs/domain-ownership.spec.json',
  databaseTableCount: 0,
  appApiOperationCount: 4,
  backendApiOperationCount: 0,
  openApiOperationCount: 0,
  iamPermissionCount: 4,
});

assert.equal(ownership.principles.preLaunchDirectCutover, true);
for (const principle of [
  'persistentProjections',
  'shadowTables',
  'synchronizedCacheTables',
  'dualWrite',
  'compatibilityFacade',
]) {
  assert.equal(ownership.principles[principle], false, `${principle} must remain disabled.`);
}
assert.equal(ownership.persistence.systemOfRecord, null);
assert.equal(ownership.persistence.tableRegistry, null);
assert.deepEqual(ownership.persistence.tables, []);
assert.deepEqual(ownership.persistence.baselines, []);
assert.deepEqual(ownership.persistence.engines, []);

const agentsOwnership = ownership.dependencies.find((entry) => entry.owner === 'sdkwork-agents');
const imOwnership = ownership.dependencies.find((entry) => entry.owner === 'sdkwork-im');
assert.ok(agentsOwnership);
assert.ok(imOwnership);
for (const capability of [
  'agent projects',
  'project composition',
  'sessions',
  'turns',
  'session items',
  'interactions',
  'runtime bindings',
]) {
  assert.equal(agentsOwnership.capabilities.includes(capability), true, `Agents ownership is missing ${capability}`);
}
assert.deepEqual(imOwnership.capabilities, [
  'human conversations',
  'human messages',
  'members',
  'read cursors',
]);
assert.equal(agentsOwnership.forbiddenLocalTables.includes('chat_conversation'), false);
assert.equal(imOwnership.forbiddenLocalTables.includes('chat_conversation'), true);
assert.equal(imOwnership.forbiddenLocalTables.includes('chat_message'), true);

const appOperations = operations(appOpenApi);
assert.deepEqual(sdkgenInput, appOpenApi);
assert.equal(appOperations.length, 4);
assert.deepEqual(
  appOperations.map((entry) => entry.routePath).sort(),
  EXPECTED_SYSTEM_PATHS,
);
for (const { operation, routePath } of appOperations) {
  assert.equal(operation['x-sdkwork-owner'], 'sdkwork-birdcoder');
  assert.equal(operation['x-sdkwork-api-authority'], 'sdkwork-birdcoder-app-api');
  assert.equal(operation['x-sdkwork-api-surface'], 'app-api');
  assert.equal(operation['x-sdkwork-domain'], 'system');
  assert.match(operation['x-sdkwork-permission'], /^birdcoder\.system-[a-z-]+\.read$/u);
  assert.equal(routePath.startsWith('/app/v3/api/system/'), true);
}
const operationPermissions = appOperations
  .map((entry) => entry.operation['x-sdkwork-permission'])
  .sort();
assert.deepEqual(
  iamManifest.permissions.catalog.map((entry) => entry.code),
  operationPermissions,
);
assert.equal(ownership.permissionOwnership.permissionCount, 4);
assert.deepEqual([...ownership.permissionOwnership.ownedPermissions].sort(), operationPermissions);

assert.deepEqual(appManifest.metadata.domainOwnership, {
  owner: 'sdkwork-birdcoder',
  capability: 'coding-workbench',
  databaseTableCount: 0,
  apiOperationCounts: { appApi: 4, backendApi: 0, openApi: 0 },
  permissionCount: 4,
  dependencyAuthorities: EXPECTED_DEPENDENCY_AUTHORITIES,
});
assert.deepEqual(appManifest.metadata.releaseEvidence, {
  status: 'blocked',
  verifiedAt: '2026-07-22',
  blockers: ['signed-production-artifact-evidence-missing'],
});

assert.deepEqual(
  assembly.routeCrates.map((entry) => entry.packageName),
  ['sdkwork-routes-system-app-api'],
);
assert.equal(assembly.routeCrates[0].surface, 'app-api');

assert.deepEqual(domainCatalog.domains.map((entry) => entry.domain), ['intelligence']);
const localDomain = domainCatalog.domains[0];
assert.equal(localDomain.owner, 'sdkwork-birdcoder');
assert.equal(localDomain.databasePrefix, null);
assert.deepEqual(localDomain.databasePrefixes, []);
assert.deepEqual(localDomain.apiTags, ['system']);
assert.deepEqual(localDomain.sdkNamespaces, ['system']);
assert.deepEqual(localDomain.capabilities, [
  'systemDescriptor',
  'systemHealth',
  'systemOwnerRoutes',
  'systemRuntimeMetadata',
]);

assert.equal(sdkManifest.sdkOwner, 'sdkwork-birdcoder');
assert.equal(sdkManifest.apiAuthority, 'sdkwork-birdcoder-app-api');
assert.equal(sdkManifest.ownerOnlyOperationCount, 4);
assert.deepEqual(sdkManifest.dependencyApiExports, []);
assert.deepEqual(sdkComponent.contracts.dependencyApiExports, []);
assert.deepEqual(
  sdkManifest.sdkDependencies.map((entry) => entry.workspace),
  EXPECTED_SDK_DEPENDENCIES,
);
assert.deepEqual(sdkComponent.contracts.sdkDependencies, sdkManifest.sdkDependencies);
assert.deepEqual(
  localDomain.dependsOn,
  EXPECTED_SDK_DEPENDENCIES.map((workspace) =>
    workspace.replace(/^sdkwork-/u, '').replace(/-app-sdk$/u, ''),
  ),
  'Domain catalog dependency names must follow the SDK manifest exactly.',
);
assert.equal(
  sdkManifest.sdkDependencies.some((entry) => entry.workspace === 'sdkwork-im-sdk'),
  false,
  'IM ownership must not create an unused BirdCoder runtime SDK dependency.',
);

assert.equal(rootPackage.name, '@sdkwork/birdcoder-workspace');
assert.equal(rootPackage.scripts['check:domain-ownership'], 'node scripts/domain-ownership-contract.test.mjs');
assert.equal(rootPackage.scripts['check:persistence-ownership'], 'node scripts/persistence-ownership-contract.test.mjs');
assert.match(rootPackage.scripts['check:arch'], /scripts\/persistence-ownership-contract\.test\.mjs/u);
assert.equal(
  RELEASE_FLOW_CHECK_COMMANDS.some((command) =>
    /routes-workspace|coding-server|kernel-bridge|provider-sdk/u.test(command),
  ),
  false,
);

const tech = read('docs/architecture/tech/TECH_ARCHITECTURE.md');
assert.match(tech, /BirdCoder server business tables: \*\*0\*\*/u);
assert.match(tech, /App API owns exactly four operations/u);
assert.match(tech, /Project, composition, Session, Turn, Session Item, Interaction, Runtime Binding/u);
assert.match(tech, /Human Conversation, Message, Member, ReadCursor/u);
assert.match(tech, /sessionRuntimeBindings/u);
assert.match(tech, /ProjectDeviceMountRegistry/u);
assert.doesNotMatch(tech, /ProjectRuntimeLocation|ADR-20260716/u);

const prd = read('docs/product/prd/PRD.md');
assert.match(prd, /Agents Session, Turn, Session Item, Interaction, and Runtime Binding/u);
assert.match(prd, /IM Conversation and Message APIs/u);
assert.match(prd, /without a\s+local Session or transcript authority/iu);

const apiCatalog = read('apis/README.md');
assert.match(apiCatalog, /0 Backend API operations/u);
assert.match(apiCatalog, /0 Open API operations/u);
assert.match(apiCatalog, /exactly four System operations/u);
assert.match(apiCatalog, /remain in the Agents API/u);
assert.match(apiCatalog, /generated owner SDK clients/u);

function collectPackageJsonFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectPackageJsonFiles(entryPath));
    } else if (entry.name === 'package.json') {
      files.push(entryPath);
    }
  }
  return files;
}

for (const packageJsonPath of collectPackageJsonFiles(resolvePath('apps/sdkwork-birdcoder-pc'))) {
  const source = fs.readFileSync(packageJsonPath, 'utf8');
  assert.doesNotMatch(source, /birdcoder-pc-(?:codeengine|projection|server)|birdcoder-chat-contracts/u);
}

console.log('sdkwork-birdcoder architecture contract passed.');
