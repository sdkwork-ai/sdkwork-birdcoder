import assert from 'node:assert/strict';
import { readCanonicalServerRustSource, CANONICAL_SERVER_RUST_PATHS } from './birdcoder-canonical-server-rust-sources.mjs';

const servicesSource = readCanonicalServerRustSource(
  'crates/sdkwork-birdcoder-api-server/src/bootstrap/services.rs',
);
const realtimeHubSource = readCanonicalServerRustSource(
  'crates/sdkwork-birdcoder-api-server/src/bootstrap/realtime_hub.rs',
);

assert.doesNotMatch(
  servicesSource,
  /NoopProjectEventPublisher|NoopDeploymentEventPublisher/u,
  'canonical api-server services must not wire retired noop project/deployment event publishers.',
);
assert.match(
  servicesSource,
  /HubProjectEventPublisher::new\(realtime_hub\.clone\(\)\)/u,
  'canonical api-server services must publish project lifecycle events through WorkspaceRealtimeHub.',
);
assert.match(
  servicesSource,
  /HubDeploymentEventPublisher::new\(realtime_hub\.clone\(\)\)/u,
  'canonical api-server services must publish deployment activity through WorkspaceRealtimeHub.',
);
assert.match(
  realtimeHubSource,
  /impl ProjectEventPublisher for HubProjectEventPublisher/u,
  'realtime hub must implement ProjectEventPublisher for project.created/updated/deleted events.',
);
assert.match(
  realtimeHubSource,
  /"project\.created"/u,
  'project event publisher must emit canonical project.created realtime events.',
);
assert.match(
  realtimeHubSource,
  /impl DeploymentEventPublisher for HubDeploymentEventPublisher/u,
  'realtime hub must implement DeploymentEventPublisher for publish/deployment activity.',
);

console.log('canonical server realtime event publishers contract passed.');
