import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const repositoriesSource = readText(
  'crates/sdkwork-birdcoder-standalone-gateway/src/bootstrap/repositories.rs',
);
const healthSource = readText('crates/sdkwork-birdcoder-standalone-gateway/src/health.rs');
const rootCargo = readText('Cargo.toml');
const valuesSource = readText('deployments/kubernetes/values.yaml');
const configMapSource = readText('deployments/kubernetes/templates/configmap.yaml');
const appRuntimeTransportSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appRuntimeTransport.ts',
);

assert.match(
  rootCargo,
  /features = \[.*"postgres".*"any"/su,
  'Workspace sqlx dependency must enable postgres and any features for HA repository pools.',
);
assert.match(
  repositoriesSource,
  /birdcoder_repository_any_pool/u,
  'API server repository wiring must resolve AnyPool-backed repositories from DatabasePool.',
);
assert.match(
  readText('deployments/kubernetes/values-postgresql-ha.yaml'),
  /engine: postgresql/u,
  'Kubernetes must ship a PostgreSQL HA values overlay for production scale-out.',
);
assert.match(
  repositoriesSource,
  /pub any_pool: AnyPool/u,
  'Repositories must expose the shared AnyPool for router state wiring.',
);
assert.doesNotMatch(
  repositoriesSource,
  /pool\.as_postgres\(\)\.is_some\(\)/u,
  'PostgreSQL pools must no longer fail fast once AnyPool repositories are wired.',
);
assert.match(
  healthSource,
  /DatabasePool::Postgres/u,
  'Unauthenticated /health must probe PostgreSQL pools when configured.',
);
assert.match(
  valuesSource,
  /database:\s*\n\s*engine: sqlite/u,
  'Kubernetes values must default database.engine to sqlite for single-replica production.',
);
assert.match(
  configMapSource,
  /SDKWORK_BIRDCODER_DATABASE_ENGINE/u,
  'Kubernetes config must publish database engine for runtime bootstrap.',
);
assert.doesNotMatch(
  appRuntimeTransportSource,
  /from ['"]@sdkwork\/birdcoder-backend-sdk['"]/u,
  'App runtime transport must not depend on backend SDK operation catalogs.',
);
assert.match(
  appRuntimeTransportSource,
  /BIRDCODER_FINALIZED_CODING_SERVER_OPENAPI_OPERATIONS/u,
  'App runtime transport must derive route catalogs from canonical OpenAPI operations in pc-types.',
);

console.log('commercial postgresql ha readiness contract passed.');
