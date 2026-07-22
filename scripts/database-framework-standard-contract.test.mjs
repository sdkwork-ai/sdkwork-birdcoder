import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const failures = [];

function exists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function read(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${relativePath} must exist`);
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function failWhen(condition, message) {
  if (condition) {
    failures.push(message);
  }
}

function readRustTree(relativeDirectory) {
  const absoluteDirectory = path.join(rootDir, relativeDirectory);
  if (!fs.existsSync(absoluteDirectory)) {
    failures.push(`${relativeDirectory} must exist`);
    return '';
  }
  return fs
    .readdirSync(absoluteDirectory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.rs'))
    .map((entry) => fs.readFileSync(path.join(entry.parentPath ?? entry.path, entry.name), 'utf8'))
    .join('\n');
}

const rootCargo = read('Cargo.toml');
failWhen(!rootCargo.includes('sdkwork_database_sqlx'), 'root Cargo.toml must declare sdkwork-database-sqlx');
failWhen(!rootCargo.includes('sdkwork_database_id'), 'root Cargo.toml must declare sdkwork-database-id');
failWhen(
  rootCargo.includes('sdkwork-birdcoder-sqlx-repository-pool'),
  'root Cargo.toml must not retain the BirdCoder SQLx pool bridge',
);

const repositoryCargo = read('crates/sdkwork-birdcoder-workspace-repository-sqlx/Cargo.toml');
failWhen(!repositoryCargo.includes('sdkwork_database_sqlx'), 'workbench repositories must consume sdkwork-database-sqlx');
failWhen(!repositoryCargo.includes('sdkwork_database_id'), 'workbench repositories must consume the canonical SDKWork ID provider');
failWhen(repositoryCargo.includes('sdkwork-birdcoder-sqlx-repository-pool'), 'workbench repositories must not consume a local pool adapter');
failWhen(repositoryCargo.includes('rusqlite'), 'workbench repositories must not introduce a second SQLite persistence stack');

const repositorySource = readRustTree('crates/sdkwork-birdcoder-workspace-repository-sqlx/src');
failWhen(!repositorySource.includes('DatabasePool'), 'workbench repositories must accept sdkwork_database_sqlx::DatabasePool');
failWhen(
  !/(?:IdGenerator|SnowflakeIdGenerator)/.test(repositorySource),
  'workbench repositories must receive an SDKWork application ID generator',
);
failWhen(/last_insert_rowid|last_insert_id|RETURNING\s+id/i.test(repositorySource), 'repositories must not allocate IDs inside the database');

const allowedRepositoryModules = new Set([
  'mod.rs',
  'project.rs',
  'project_document_binding.rs',
  'project_runtime_location.rs',
  'project_sandbox_binding.rs',
  'workspace.rs',
]);
const repositoryDirectory = path.join(
  rootDir,
  'crates/sdkwork-birdcoder-workspace-repository-sqlx/src/repository',
);
if (fs.existsSync(repositoryDirectory)) {
  const unexpectedModules = fs
    .readdirSync(repositoryDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.rs') && !allowedRepositoryModules.has(entry.name))
    .map((entry) => entry.name)
    .sort();
  failWhen(
    unexpectedModules.length > 0,
    `workbench repository crate contains non-owned modules: ${unexpectedModules.join(', ')}`,
  );
  for (const requiredModule of allowedRepositoryModules) {
    failWhen(!exists(path.join('crates/sdkwork-birdcoder-workspace-repository-sqlx/src/repository', requiredModule)), `${requiredModule} workbench repository module must exist`);
  }
}

const gatewaySource = readRustTree('crates/sdkwork-api-birdcoder-standalone-gateway/src/bootstrap');
failWhen(!gatewaySource.includes('DatabasePool'), 'standalone gateway must retain the canonical DatabasePool');
failWhen(!gatewaySource.includes('bootstrap_birdcoder_database'), 'standalone gateway must delegate schema lifecycle to database-host');
failWhen(
  !gatewaySource.includes('SnowflakeNodeAllocator'),
  'standalone gateway must allocate one fenced SDKWork Snowflake node lease per process',
);
for (const forbiddenSymbol of [
  'SqliteCodingSessionRepository',
  'SqliteDeploymentRepository',
  'SqliteDocumentRepository',
  'SqliteSkillPackageRepository',
  'SqliteTeamRepository',
  'SqliteProjectWorkspaceBindingRepository',
]) {
  failWhen(gatewaySource.includes(forbiddenSymbol), `standalone gateway must not wire ${forbiddenSymbol}`);
}

for (const forbiddenPath of [
  'crates/sdkwork-birdcoder-coding-sessions-repository-sqlx',
  'crates/sdkwork-birdcoder-document-repository-sqlx',
  'crates/sdkwork-birdcoder-skill-packages-repository-sqlx',
  'crates/sdkwork-birdcoder-model-config-repository-sqlx',
  'crates/sdkwork-birdcoder-chat-repository-sqlx',
  'crates/sdkwork-birdcoder-commerce-repository-sqlx',
  'crates/sdkwork-birdcoder-app-templates-repository-sqlx',
  'crates/sdkwork-birdcoder-sqlx-repository-pool',
]) {
  failWhen(exists(forbiddenPath), `${forbiddenPath} must be removed after owner cutover`);
}

const localDataKernel = [
  read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/data.ts'),
  read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/providers.ts'),
].join('\n');
failWhen(/CREATE\s+TABLE|BIRDCODER_SCHEMA_MIGRATIONS|ai_coding_session|chat_conversation|ai_skill_package/i.test(localDataKernel), 'frontend packages must not retain a second authoritative application schema or owner-domain migrations');

if (failures.length > 0) {
  process.stderr.write(`Database framework standard failed:\n${failures.map((item) => `- ${item}`).join('\n')}\n`);
  process.exit(1);
}

assert.ok(true);
process.stdout.write('Database framework standard passed\n');
