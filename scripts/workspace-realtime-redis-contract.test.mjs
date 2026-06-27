import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const hubSource = readText('crates/sdkwork-routes-workspace-app-api/src/realtime_hub.rs');
const configSource = readText('crates/sdkwork-routes-workspace-app-api/src/realtime_config.rs');
const servicesSource = readText('crates/sdkwork-birdcoder-standalone-gateway/src/bootstrap/services.rs');
const databaseSource = readText('crates/sdkwork-birdcoder-standalone-gateway/src/bootstrap/database.rs');
const haValues = readText('deployments/kubernetes/values-postgresql-ha.yaml');
const configMap = readText('deployments/kubernetes/templates/configmap.yaml');
const rootCargo = readText('Cargo.toml');

assert.match(rootCargo, /redis = \{ version = "0\.27"/u, 'Workspace must declare redis dependency.');
assert.match(
  hubSource,
  /pub async fn bootstrap\(\)/u,
  'Workspace realtime hub must bootstrap from runtime configuration.',
);
assert.match(
  hubSource,
  /spawn_redis_forwarder/u,
  'Redis realtime hub must forward pub/sub messages to local subscribers.',
);
assert.match(
  configSource,
  /SDKWORK_BIRDCODER_REDIS_ENABLED/u,
  'Realtime config must read SDKWORK_BIRDCODER_REDIS_ENABLED.',
);
assert.match(
  configSource,
  /SDKWORK_BIRDCODER_REALTIME_BACKEND/u,
  'Realtime config must read SDKWORK_BIRDCODER_REALTIME_BACKEND.',
);
assert.match(
  servicesSource,
  /WorkspaceRealtimeHub::bootstrap\(\)\.await/u,
  'API server services wiring must bootstrap the realtime hub.',
);
assert.match(
  databaseSource,
  /bootstrap_birdcoder_database\(pool\.clone\(\)\)/u,
  'API server database bootstrap must use database-host lifecycle for all engines.',
);
assert.doesNotMatch(
  databaseSource,
  /ensure_schema/u,
  'Inline sqlite ensure_schema must be removed once lifecycle baseline is authoritative.',
);
assert.match(
  haValues,
  /realtime:\s*\n\s*backend: redis/u,
  'PostgreSQL HA overlay must require Redis-backed realtime.',
);
assert.match(
  haValues,
  /redis:\s*\n\s*enabled: true/u,
  'PostgreSQL HA overlay must enable Redis.',
);
assert.match(
  configMap,
  /SDKWORK_BIRDCODER_REALTIME_BACKEND/u,
  'Kubernetes config must publish realtime backend selection.',
);
assert.match(
  configMap,
  /SDKWORK_BIRDCODER_REDIS_ENABLED/u,
  'Kubernetes config must publish Redis enablement.',
);

console.log('workspace realtime redis contract passed.');
