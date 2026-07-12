import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const failures = [];

function read(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  assert.ok(fs.existsSync(absolutePath), `${relativePath} must exist`);
  return fs.readFileSync(absolutePath, 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function fail(message) {
  failures.push(message);
}

const rootCargo = read('Cargo.toml');
if (!rootCargo.includes('sdkwork_database_sqlx')) {
  fail('root Cargo.toml must declare sdkwork-database-sqlx workspace dependency');
}
if (!rootCargo.includes('sdkwork_database_config')) {
  fail('root Cargo.toml must declare sdkwork-database-config workspace dependency');
}

const apiServerCargo = read('crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml');
if (!apiServerCargo.includes('sdkwork_database_sqlx')) {
  fail('sdkwork-birdcoder-standalone-gateway must declare sdkwork-database-sqlx dependency');
}
if (!apiServerCargo.includes('sqlx')) {
  fail('sdkwork-birdcoder-standalone-gateway must depend on sqlx for schema bootstrap');
}
if (apiServerCargo.includes('rusqlite')) {
  fail('sdkwork-birdcoder-standalone-gateway must not depend on rusqlite after sqlx migration');
}

const apiServerSources = [
  'crates/sdkwork-birdcoder-standalone-gateway/src/bootstrap/repositories.rs',
  'crates/sdkwork-birdcoder-standalone-gateway/src/bootstrap/database.rs',
  'crates/sdkwork-birdcoder-standalone-gateway/src/bootstrap/config.rs',
  'crates/sdkwork-birdcoder-standalone-gateway/src/bootstrap/state.rs',
  'crates/sdkwork-birdcoder-standalone-gateway/src/bootstrap/mod.rs',
  'crates/sdkwork-birdcoder-standalone-gateway/src/health.rs',
].map((relativePath) => read(relativePath)).join('\n');

if (!apiServerSources.includes('bootstrap_database')) {
  fail('sdkwork-birdcoder-standalone-gateway bootstrap must call database::bootstrap_database');
}
if (!apiServerSources.includes('resolve_birdcoder_database_config')) {
  fail('sdkwork-birdcoder-standalone-gateway must resolve SDKWORK_BIRDCODER database config explicitly');
}
if (!apiServerSources.includes('database_pool')) {
  fail('sdkwork-birdcoder-standalone-gateway AppState must retain sdkwork-database pool');
}
if (!apiServerSources.includes('wire_repositories(database_pool')) {
  fail('wire_repositories must consume sdkwork-database pool');
}
if (!apiServerSources.includes('AnyPool')) {
  fail('standalone-gateway repositories must use sqlx AnyPool for engine-agnostic persistence');
}
if (!apiServerSources.includes('DatabasePool::Postgres')) {
  fail('standalone-gateway health checks must probe PostgreSQL pools when configured');
}
if (!apiServerSources.includes('bootstrap_birdcoder_database(pool.clone())')) {
  fail('standalone-gateway database bootstrap must use database-host lifecycle for all engines');
}
if (apiServerSources.includes('ensure_schema')) {
  fail('standalone-gateway database bootstrap must not keep inline ensure_schema after lifecycle unification');
}

const sqlxRepoCrates = [
  'crates/sdkwork-birdcoder-coding-sessions-repository-sqlx/Cargo.toml',
  'crates/sdkwork-birdcoder-workspace-repository-sqlx/Cargo.toml',
  'crates/sdkwork-birdcoder-document-repository-sqlx/Cargo.toml',
  'crates/sdkwork-birdcoder-membership-repository-sqlx/Cargo.toml',
  'crates/sdkwork-birdcoder-skill-packages-repository-sqlx/Cargo.toml',
  'crates/sdkwork-birdcoder-model-config-repository-sqlx/Cargo.toml',
];
for (const relativePath of sqlxRepoCrates) {
  const cargoToml = read(relativePath);
  if (!cargoToml.includes('sqlx')) {
    fail(`${relativePath} must depend on sqlx per DATABASE_SPEC.md`);
  }
  if (cargoToml.includes('rusqlite')) {
    fail(`${relativePath} must not depend on rusqlite after sqlx migration`);
  }
}

const repositoryPoolCrate = read('crates/sdkwork-birdcoder-sqlx-repository-pool/Cargo.toml');
if (!repositoryPoolCrate.includes('sdkwork_database_sqlx')) {
  fail('birdcoder sqlx repository pool bridge must depend on sdkwork-database-sqlx');
}

const iamEnvScript = read('scripts/birdcoder-iam-env.mjs');
if (!iamEnvScript.includes('SDKWORK_BIRDCODER_DATABASE_URL')) {
  fail('birdcoder-iam-env must bridge legacy sqlite path to SDKWORK_BIRDCODER_DATABASE_URL');
}

const canonicalOpenApi = read('deployments/server-windows/x64/openapi/coding-server-v1.json');
const canonicalOpenApiDocument = readJson('deployments/server-windows/x64/openapi/coding-server-v1.json');
const canonicalOpenApiPathKeys = Object.keys(canonicalOpenApiDocument.paths ?? {});
if (canonicalOpenApiPathKeys.some((routePath) => routePath === '/app/v3/api/coding_sessions' || routePath.startsWith('/app/v3/api/coding_sessions/'))) {
  fail('canonical coding-server OpenAPI must not keep legacy /app/v3/api/coding_sessions paths');
}
if (!canonicalOpenApiPathKeys.includes('/app/v3/api/intelligence/coding_sessions')) {
  fail('canonical coding-server OpenAPI must declare intelligence coding_sessions routes');
}
if (canonicalOpenApiPathKeys.some((routePath) => routePath.includes('coding-sessions'))) {
  fail('canonical coding-server OpenAPI must use lower_snake_case coding_sessions path segments');
}

const dataKernelPaths = [
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/data.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/providers.ts',
];
const dataKernel = dataKernelPaths.map((relativePath) => read(relativePath)).join('\n');
if (!dataKernel.includes('ops_schema_migration_history')) {
  fail('TypeScript data kernel must track ops_schema_migration_history per DATABASE_SPEC.md');
}

if (failures.length > 0) {
  process.stderr.write(`Database framework standard failed:\n${failures.map((item) => `- ${item}`).join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('Database framework standard passed\n');
