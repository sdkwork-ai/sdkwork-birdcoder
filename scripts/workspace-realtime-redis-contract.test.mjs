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
const servicesSource = readText('crates/sdkwork-api-birdcoder-standalone-gateway/src/bootstrap/services.rs');
const databaseSource = readText('crates/sdkwork-api-birdcoder-standalone-gateway/src/bootstrap/database.rs');
const haValues = readText('deployments/kubernetes/values-postgresql-ha.yaml');
const configMap = readText('deployments/kubernetes/templates/configmap.yaml');
const rootCargo = readText('Cargo.toml');
const redisHubSource = hubSource.slice(hubSource.indexOf('impl RedisHub'));
const memoryHubSource = hubSource.slice(
  hubSource.indexOf('impl MemoryHub'),
  hubSource.indexOf('impl RedisHub'),
);

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
  hubSource,
  /subscribe_public_and_user_inventory/u,
  'Live workspace subscriptions must combine public delivery with authenticated user inventory.',
);
assert.match(
  hubSource,
  /workspace-user-inventory:v1/u,
  'Redis realtime routing must version tenant/user/workspace inventory channel keys.',
);
assert.match(
  hubSource,
  /workspace-session:v1/u,
  'Redis realtime routing must version exact tenant/user/workspace/session channel keys.',
);
assert.match(
  hubSource,
  /base64url_encode/u,
  'Redis routing key components must use collision-free sdkwork-utils encoding.',
);
assert.match(
  hubSource,
  /realtime_channel_from_redis/u,
  'Redis forwarding must parse public, user-inventory, and session channels into typed local routing keys.',
);
assert.match(
  hubSource,
  /redis_patterns/u,
  'Redis forwarding must subscribe only to the active versioned public, user-inventory, and session families.',
);
assert.match(
  hubSource,
  /realtime:workspace:v1:\*/u,
  'Redis forwarding must scope active public traffic to the versioned tenant-aware channel family.',
);
assert.match(
  hubSource,
  /realtime:workspace-user-inventory:v1:\*/u,
  'Redis forwarding must subscribe to the versioned tenant/user/workspace inventory family.',
);
assert.match(
  hubSource,
  /realtime:workspace-session:v1:\*/u,
  'Redis forwarding must subscribe to the versioned exact session family.',
);
assert.match(
  hubSource,
  /RedisRealtimeChannelRoute::LegacyPublic/u,
  'Legacy unscoped public keys must remain recognizable only for explicit fail-closed compatibility.',
);
assert.match(
  hubSource,
  /publish_state: Arc<StdRwLock<RedisPublishState>>/u,
  'Redis realtime publishing must retain one cloneable multiplexed connection.',
);
assert.match(
  redisHubSource,
  /publish_connection_snapshot\(\)/u,
  'Redis realtime publishing must clone the retained multiplexed connection per command.',
);
const redisPublishBody = redisHubSource.slice(
  redisHubSource.indexOf('async fn publish('),
  redisHubSource.indexOf('fn publish_connection_snapshot'),
);
assert.doesNotMatch(
  redisPublishBody,
  /get_multiplexed_async_connection/u,
  'The realtime hot publish path must not establish a Redis connection for every event.',
);
assert.match(
  redisHubSource,
  /refresh_publish_connection\(generation\)\.await/u,
  'A failed retained publish connection must be refreshed for subsequent durable events.',
);
const memoryPublishBody = memoryHubSource.slice(memoryHubSource.indexOf('async fn publish('));
assert.match(
  memoryPublishBody,
  /channels\.read\(\)\.await\.get\(channel\)\.cloned\(\)/u,
  'Memory realtime publishing must clone the sender through a shared read lock.',
);
assert.doesNotMatch(
  memoryPublishBody,
  /channels\.write\(\)|remove_inactive_channels/u,
  'Memory realtime publishing must not serialize all workspaces or sweep the channel table on every event.',
);
const redisForwarderBody = redisHubSource.slice(
  redisHubSource.indexOf('fn spawn_redis_forwarder'),
  redisHubSource.indexOf('fn redis_channel_name'),
);
assert.match(
  redisForwarderBody,
  /channels\.read\(\)\.await\.get\(&realtime_channel\)\.cloned\(\)/u,
  'Redis forwarding must clone the local sender through a shared read lock.',
);
assert.doesNotMatch(
  redisForwarderBody,
  /channels\.write\(\)|remove_inactive_channels/u,
  'Redis forwarding must not serialize all workspace delivery or sweep every local channel per event.',
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
