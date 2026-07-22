import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const repositoriesSource = readText(
  'crates/sdkwork-api-birdcoder-standalone-gateway/src/bootstrap/repositories.rs',
);
const healthSource = readText('crates/sdkwork-api-birdcoder-standalone-gateway/src/health.rs');
const rootCargo = readText('Cargo.toml');
const valuesSource = readText('deployments/kubernetes/values.yaml');
const configMapSource = readText('deployments/kubernetes/templates/configmap.yaml');
const appRuntimeTransportSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appRuntimeTransport.ts',
);
const standaloneGatewayAuthSource = readText(
  'crates/sdkwork-api-birdcoder-standalone-gateway/src/bootstrap/auth.rs',
);
const assemblyAuthSource = readText(
  'crates/sdkwork-api-birdcoder-assembly/src/application_bootstrap/auth.rs',
);
const redisStoreSource = readText(
  '../sdkwork-web-framework/crates/sdkwork-web-store-redis/src/lib.rs',
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
  'Unauthenticated /readyz readiness checks must probe PostgreSQL pools when configured.',
);
assert.match(
  valuesSource,
  /replicaCount: 1[\s\S]*database:\s*\n\s*engine: postgresql[\s\S]*realtime:\s*\n\s*backend: memory/u,
  'Default Kubernetes values must use PostgreSQL while remaining an explicit single-replica profile.',
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
  redisStoreSource,
  /pub struct RedisRateLimitStore/u,
  'HA commerce rate limiting must use the framework-owned Redis-backed RateLimitStore.',
);
for (const authSource of [standaloneGatewayAuthSource, assemblyAuthSource]) {
  assert.match(
    authSource,
    /redis_enabled_from_env\(\)[\s\S]*resolve_redis_config\(\)[\s\S]*shared_rate_limit_store[\s\S]*with_rate_limit_store/u,
    'BirdCoder gateway assemblies must inject the shared Redis rate-limit store when Redis is enabled.',
  );
}
assert.match(
  redisStoreSource,
  /get_multiplexed_async_connection\(\)[\s\S]*map_err\(redis_error\)/u,
  'The framework-owned Redis rate-limit store must propagate dependency failures to the fail-closed interceptor chain.',
);
assert.match(
  readText('deployments/kubernetes/values-postgresql-ha.yaml'),
  /replicaCount: 3[\s\S]*backend: redis[\s\S]*minReplicas: 3/u,
  'PostgreSQL HA values must enable three replicas, Redis realtime, and autoscaling.',
);
assert.match(
  readText('crates/sdkwork-api-birdcoder-standalone-gateway/src/health.rs'),
  /redis::cmd\("PING"\)/u,
  'Readiness checks must PING Redis when realtime backend is redis.',
);
assert.match(
  appRuntimeTransportSource,
  /BIRDCODER_FINALIZED_CODING_SERVER_OPENAPI_OPERATIONS/u,
  'App runtime transport must derive route catalogs from canonical OpenAPI operations in pc-types.',
);

console.log('commercial postgresql ha readiness contract passed.');
