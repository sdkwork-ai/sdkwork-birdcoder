import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { RELEASE_FLOW_CHECK_COMMANDS } from './run-release-flow-check.mjs';

const rootDir = process.cwd();
const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);
const EXPECTED_TABLES = Object.freeze([
  'studio_workspace',
  'studio_project',
  'studio_project_document_binding',
  'studio_project_runtime_location',
  'studio_project_runtime_location_preference',
  'studio_project_runtime_location_idempotency',
  'studio_project_runtime_location_audit',
  'studio_project_sandbox_binding',
  'studio_project_sandbox_binding_idempotency',
  'studio_project_sandbox_binding_audit',
]);
const EXPECTED_DEPENDENCY_AUTHORITIES = Object.freeze({
  agentSessions: 'sdkwork-agents',
  agentSessionItems: 'sdkwork-agents',
  skills: 'sdkwork-skills',
  savedPrompts: 'sdkwork-prompts',
  documentContent: 'sdkwork-documents',
  humanMessaging: 'sdkwork-im',
});
const EXPECTED_OWNER_SDK_DEPENDENCIES = Object.freeze([
  'sdkwork-agents-app-sdk',
  'sdkwork-documents-app-sdk',
  'sdkwork-prompts-app-sdk',
  'sdkwork-skills-app-sdk',
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

function operationCount(openapi) {
  return Object.values(openapi.paths ?? {}).reduce(
    (count, pathItem) => count + Object.keys(pathItem ?? {}).filter((key) => HTTP_METHODS.has(key)).length,
    0,
  );
}

const requiredPaths = [
  'AGENTS.md',
  'sdkwork.app.config.json',
  'specs/README.md',
  'specs/component.spec.json',
  'specs/domain-ownership.spec.json',
  'specs/agents-birdcoder-alignment.spec.json',
  'specs/kernel-birdcoder-alignment.spec.json',
  'specs/topology.spec.json',
  'apis/README.md',
  'database/README.md',
  'database/database.manifest.json',
  'database/contract/schema.yaml',
  'database/contract/table-registry.json',
  'database/ddl/baseline/sqlite/0001_birdcoder_baseline.sql',
  'database/ddl/baseline/postgres/0001_birdcoder_baseline.sql',
  'database/ddl/generated/sqlite_schema.sql',
  'database/ddl/generated/postgres_schema.sql',
  'sdks/README.md',
  'sdks/specs/component.spec.json',
  'sdks/specs/domain-catalog.json',
  'sdks/sdkwork-birdcoder-app-sdk/README.md',
  'sdks/sdkwork-birdcoder-app-sdk/sdk-manifest.json',
  'sdks/sdkwork-birdcoder-app-sdk/specs/component.spec.json',
  'sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json',
  'sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.sdkgen.json',
  'apps/sdkwork-birdcoder-pc/sdkwork.app.config.json',
  'apps/sdkwork-birdcoder-pc/specs/component.spec.json',
  'apps/sdkwork-birdcoder-h5/sdkwork.app.config.json',
  'apps/sdkwork-birdcoder-h5/specs/component.spec.json',
  'apps/sdkwork-birdcoder-flutter-mobile/sdkwork.app.config.json',
  'apps/sdkwork-birdcoder-flutter-mobile/specs/component.spec.json',
  'crates/sdkwork-api-birdcoder-standalone-gateway/Cargo.toml',
  'crates/sdkwork-routes-workspace-app-api/Cargo.toml',
  'crates/sdkwork-routes-system-app-api/Cargo.toml',
  'docs/README.md',
  'docs/product/prd/PRD.md',
  'docs/architecture/tech/TECH_ARCHITECTURE.md',
  'docs/architecture/decisions/ADR-20260722-domain-ownership-and-single-write-authority.md',
  'docs/migrations/MIG-2026-0002-domain-ownership-cutover.md',
  'scripts/domain-ownership-contract.test.mjs',
  'scripts/database-framework-standard-contract.test.mjs',
  'scripts/app-sdk-surface-boundary-contract.test.mjs',
  'scripts/birdcoder-sdk-owner-boundary-contract.test.mjs',
  'scripts/birdcoder-sdk-family-standard-contract.test.mjs',
  'scripts/birdcoder-sdk-family-generated-contract.test.mjs',
  'scripts/birdcoder-sdk-consumer-boundary-contract.test.mjs',
  'scripts/agents-birdcoder-alignment-contract.test.mjs',
  'scripts/kernel-birdcoder-alignment-contract.test.mjs',
  'scripts/technical-debt-contract.test.mjs',
  'scripts/run-quality-fast-check.mjs',
  'scripts/run-release-flow-check.mjs',
  'scripts/run-release-flow-check.test.mjs',
];
for (const relativePath of requiredPaths) {
  assert.equal(fs.existsSync(resolvePath(relativePath)), true, `Missing architecture authority: ${relativePath}`);
}

const forbiddenAuthorityFiles = [
  'sdks/sdkwork-birdcoder-backend-sdk/sdk-manifest.json',
  'sdks/sdkwork-birdcoder-sdk/sdk-manifest.json',
  'sdks/specs/openapi/birdcoder-app-v3.openapi.json',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/package.json',
  'crates/sdkwork-birdcoder-coding-sessions-service/Cargo.toml',
  'crates/sdkwork-birdcoder-coding-sessions-repository-sqlx/Cargo.toml',
  'crates/sdkwork-birdcoder-chat-repository-sqlx/Cargo.toml',
  'crates/sdkwork-birdcoder-skill-packages-repository-sqlx/Cargo.toml',
  'crates/sdkwork-routes-coding-sessions-app-api/Cargo.toml',
  'scripts/coding-server-openapi-export.ts',
  'scripts/patch-coding-session-repo.py',
  'scripts/migrate-coding-sessions-repo-to-sqlx.py',
];
for (const relativePath of forbiddenAuthorityFiles) {
  assert.equal(fs.existsSync(resolvePath(relativePath)), false, `Retired local authority remains: ${relativePath}`);
}

const appManifest = readJson('sdkwork.app.config.json');
const rootComponent = readJson('specs/component.spec.json');
const ownership = readJson('specs/domain-ownership.spec.json');
const tableRegistry = readJson('database/contract/table-registry.json');
const domainCatalog = readJson('sdks/specs/domain-catalog.json');
const sdkManifest = readJson('sdks/sdkwork-birdcoder-app-sdk/sdk-manifest.json');
const sdkComponent = readJson('sdks/sdkwork-birdcoder-app-sdk/specs/component.spec.json');
const appOpenApi = readJson(
  'sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json',
);
const rootPackage = readJson('package.json');

assert.equal(rootComponent.component.domain, 'intelligence');
assert.equal(rootComponent.component.capability, 'coding-workbench');
assert.equal(rootComponent.ownership.boundedContext, 'intelligence/coding-workbench');
assert.deepEqual(rootComponent.ownership, {
  boundedContext: 'intelligence/coding-workbench',
  domainContract: 'specs/domain-ownership.spec.json',
  databaseTableCount: 10,
  appApiOperationCount: 39,
  backendApiOperationCount: 0,
  openApiOperationCount: 0,
  iamPermissionCount: 33,
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
assert.equal(ownership.ownedBoundedContext.domain, 'intelligence');
assert.equal(ownership.ownedBoundedContext.capability, 'coding-workbench');
assert.deepEqual(ownership.persistence.tables, EXPECTED_TABLES);
assert.deepEqual(
  tableRegistry.tables.map((entry) => entry.table_name),
  EXPECTED_TABLES,
);
assert.equal(tableRegistry.tables.every((entry) => entry.owner === 'birdcoder-workbench'), true);
assert.equal(tableRegistry.tables.every((entry) => entry.lifecycle_status === 'active'), true);

assert.equal(ownership.apiOwnership.appApi.operationCount, 39);
assert.equal(ownership.apiOwnership.backendApi.operationCount, 0);
assert.equal(ownership.apiOwnership.backendApi.owned, false);
assert.equal(ownership.apiOwnership.openApi.operationCount, 0);
assert.equal(ownership.apiOwnership.openApi.owned, false);
assert.equal(operationCount(appOpenApi), 39);
assert.equal(appOpenApi.info.title, 'SDKWork BirdCoder App API');
for (const apiPath of Object.keys(appOpenApi.paths ?? {})) {
  assert.equal(apiPath.startsWith('/app/v3/api/'), true, `Non-App API path found: ${apiPath}`);
  assert.doesNotMatch(
    apiPath,
    /\/intelligence\/coding_sessions|\/chat\/conversations|\/skill_packages/u,
    `Dependency-owned API path found in BirdCoder authority: ${apiPath}`,
  );
}

assert.deepEqual(
  appManifest.metadata.domainOwnership.dependencyAuthorities,
  EXPECTED_DEPENDENCY_AUTHORITIES,
);
assert.equal(appManifest.metadata.domainOwnership.databaseTableCount, 10);
assert.deepEqual(appManifest.metadata.domainOwnership.apiOperationCounts, {
  appApi: 39,
  backendApi: 0,
  openApi: 0,
});
assert.deepEqual(appManifest.metadata.releaseEvidence, {
  status: 'blocked',
  verifiedAt: '2026-07-22',
  blockers: ['signed-production-artifact-evidence-missing'],
});

assert.deepEqual(
  domainCatalog.domains.map((entry) => entry.domain),
  ['intelligence'],
  'The SDK domain catalog must not declare a second BirdCoder business domain.',
);
assert.equal(domainCatalog.domains[0]?.owner, 'sdkwork-birdcoder');
assert.deepEqual(domainCatalog.domains[0]?.databasePrefixes, ['studio']);

assert.equal(sdkManifest.sdkOwner, 'sdkwork-birdcoder');
assert.equal(sdkManifest.apiAuthority, 'sdkwork-birdcoder-app-api');
assert.equal(sdkManifest.ownerOnlyOperationCount, 39);
assert.deepEqual(sdkManifest.dependencyApiExports, []);
assert.deepEqual(sdkComponent.contracts.dependencyApiExports, []);
for (const workspace of EXPECTED_OWNER_SDK_DEPENDENCIES) {
  assert.equal(
    sdkManifest.sdkDependencies.some((entry) => entry.workspace === workspace),
    true,
    `SDK manifest is missing dependency owner ${workspace}.`,
  );
  assert.equal(
    sdkComponent.contracts.sdkDependencies.some((entry) => entry.workspace === workspace),
    true,
    `SDK component spec is missing dependency owner ${workspace}.`,
  );
}
assert.equal(
  sdkManifest.sdkDependencies.some((entry) => entry.workspace === 'sdkwork-im-sdk'),
  false,
  'Human messaging ownership must not become an unused BirdCoder runtime SDK dependency.',
);
assert.deepEqual(sdkComponent.contracts.sdkDependencies, sdkManifest.sdkDependencies);

assert.equal(rootPackage.name, '@sdkwork/birdcoder-workspace');
assert.equal(rootPackage.scripts['check:domain-ownership'], 'node scripts/domain-ownership-contract.test.mjs');
assert.equal(rootPackage.scripts['check:technical-debt'], 'node scripts/technical-debt-contract.test.mjs');
assert.equal(rootPackage.scripts['check:release-flow'], 'node scripts/run-release-flow-check.mjs');
assert.equal(
  rootPackage.scripts['check:sdk-family-standard'],
  'node scripts/birdcoder-sdk-owner-boundary-contract.test.mjs && node scripts/birdcoder-sdk-family-standard-contract.test.mjs',
);
assert.equal(rootPackage.scripts['test:birdcoder-agents-integration-contract'], undefined);
assert.equal(rootPackage.scripts['check:data-kernel'], undefined);

const qualityFastSource = read('scripts/run-quality-fast-check.mjs');
for (const requiredCheck of [
  'check:api-transport-standard',
  'check:domain-ownership',
  'check:agents-birdcoder-alignment',
  'check:kernel-birdcoder-alignment',
  'check:sdk-family-standard',
  'check:sdk-family-generated',
  'check:app-composition',
  'check:technical-debt',
  'check:arch',
]) {
  assert.equal(
    qualityFastSource.includes(requiredCheck),
    true,
    `Fast quality gate is missing ${requiredCheck}.`,
  );
}
assert.doesNotMatch(
  qualityFastSource,
  /data-kernel|coding-session-projection|template-instantiation|provider-sdk/u,
);
assert.equal(
  RELEASE_FLOW_CHECK_COMMANDS.some((command) => /coding-server|kernel-bridge|provider-sdk/u.test(command)),
  false,
);

for (const relativePath of [
  'README.md',
  'specs/README.md',
  'docs/architecture/tech/TECH_ARCHITECTURE.md',
]) {
  const source = read(relativePath);
  assert.match(source, /10/u, `${relativePath} must state the canonical table count.`);
  assert.match(source, /39/u, `${relativePath} must state the canonical App API operation count.`);
  assert.match(source, /sdkwork-agents/u, `${relativePath} must state Agents ownership.`);
  assert.match(source, /sdkwork-im/u, `${relativePath} must state human messaging ownership.`);
}

const productRequirementSource = read('docs/product/prd/PRD.md');
assert.match(productRequirementSource, /Agents Project\/Session\/Turn\/SessionItem\/Interaction/u);
assert.match(productRequirementSource, /human IM Conversation\/Message/u);
assert.match(productRequirementSource, /no BirdCoder session or transcript copy/u);

const apiCatalogSource = read('apis/README.md');
assert.match(apiCatalogSource, /App API[^\n]*39/u);
assert.match(apiCatalogSource, /Backend API[^\n]*0/u);
assert.match(apiCatalogSource, /Open API[^\n]*0/u);
assert.match(apiCatalogSource, /Agents App SDK/u);

const databaseCatalogSource = read('database/README.md');
assert.match(databaseCatalogSource, /10/u);
assert.match(databaseCatalogSource, /sdkwork-agents/u);
assert.match(databaseCatalogSource, /sdkwork-im/u);

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

for (const packageJsonPath of collectPackageJsonFiles(resolvePath('apps'))) {
  const source = fs.readFileSync(packageJsonPath, 'utf8');
  assert.doesNotMatch(source, /sdkwork-ide-|sdkwork-bird-|@sdkwork\/bird-/u);
}

console.log('sdkwork-birdcoder architecture contract passed.');
