import assert from 'node:assert/strict';
import { readCanonicalServerRustSource, CANONICAL_SERVER_RUST_PATHS } from './birdcoder-canonical-server-rust-sources.mjs';

const servicesSource = readCanonicalServerRustSource(
  'crates/sdkwork-api-birdcoder-standalone-gateway/src/bootstrap/services.rs',
);
const realtimeHubSource = readCanonicalServerRustSource(
  'crates/sdkwork-api-birdcoder-standalone-gateway/src/bootstrap/realtime_hub.rs',
);
const codingSessionPublisherSource = realtimeHubSource.slice(
  realtimeHubSource.indexOf('impl RealtimeEventPublisher for HubRealtimeEventPublisher'),
  realtimeHubSource.indexOf('pub struct HubWorkspaceEventPublisher'),
);
const workspacePublisherSource = realtimeHubSource.slice(
  realtimeHubSource.indexOf('impl HubWorkspaceEventPublisher'),
  realtimeHubSource.indexOf('pub struct HubProjectEventPublisher'),
);

assert.doesNotMatch(
  servicesSource,
  /NoopProjectEventPublisher|NoopDeploymentEventPublisher/u,
  'canonical standalone-gateway services must not wire retired noop project/deployment event publishers.',
);
assert.match(
  servicesSource,
  /HubProjectEventPublisher::new\(realtime_hub\.clone\(\)\)/u,
  'canonical standalone-gateway services must publish project lifecycle events through WorkspaceRealtimeHub.',
);
assert.match(
  servicesSource,
  /HubDeploymentEventPublisher::new\(realtime_hub\.clone\(\)\)/u,
  'canonical standalone-gateway services must publish deployment activity through WorkspaceRealtimeHub.',
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
assert.match(
  codingSessionPublisherSource,
  /publish_session\([\s\S]*&ctx\.tenant_id,[\s\S]*&ctx\.user_id,[\s\S]*&event\.workspace_id,[\s\S]*&event\.coding_session_id/u,
  'durable coding-session payloads must publish through the exact tenant/user/workspace/session channel.',
);
assert.match(
  codingSessionPublisherSource,
  /publish_user_inventory\([\s\S]*&ctx\.tenant_id,[\s\S]*&ctx\.user_id,[\s\S]*&event\.workspace_id/u,
  'non-durable coding-session summaries must publish through the authenticated user inventory channel.',
);
assert.doesNotMatch(
  codingSessionPublisherSource,
  /\n\s*\.publish\(/u,
  'coding-session payloads must never publish through the public workspace channel.',
);
assert.match(
  workspacePublisherSource,
  /\n\s*\.publish\(tenant_id, workspace_id/u,
  'workspace lifecycle invalidation must remain on the tenant-scoped public workspace channel.',
);
assert.doesNotMatch(
  workspacePublisherSource,
  /publish_user_inventory|publish_session/u,
  'public workspace lifecycle events must not be duplicated into user inventory or session channels.',
);

console.log('canonical server realtime event publishers contract passed.');
