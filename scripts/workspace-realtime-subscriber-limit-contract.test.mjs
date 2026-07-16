import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const handlersSource = readFileSync(
  'crates/sdkwork-routes-workspace-app-api/src/handlers.rs',
  'utf8',
);
const errorSource = readFileSync(
  'crates/sdkwork-routes-workspace-app-api/src/error.rs',
  'utf8',
);
const hubSource = readFileSync(
  'crates/sdkwork-routes-workspace-app-api/src/realtime_hub.rs',
  'utf8',
);

assert.match(hubSource, /MAX_WORKSPACE_REALTIME_SUBSCRIBERS/);
assert.match(hubSource, /RealtimeSubscriberLimitExceeded/);
assert.match(handlersSource, /map_rate_limited/);
assert.match(errorSource, /StatusCode::TOO_MANY_REQUESTS/);
assert.match(
  handlersSource,
  /REALTIME_WEBSOCKET_HEARTBEAT_INTERVAL[\s\S]*Message::Ping/u,
  'WebSocket delivery must emit bounded server heartbeats for browser clients.',
);
assert.match(
  handlersSource,
  /REALTIME_WEBSOCKET_PONG_TIMEOUT[\s\S]*Message::Pong[\s\S]*wait_for_websocket_pong/u,
  'WebSocket heartbeats must require the matching pong before the liveness timeout.',
);
assert.match(
  handlersSource,
  /validate_workspace_realtime_websocket_protocol\(&headers\)[\s\S]*\.protocols\(\[WORKSPACE_REALTIME_WEBSOCKET_PROTOCOL\]\)/u,
  'WebSocket upgrades must require the canonical application protocol exactly once before negotiation.',
);
assert.match(
  handlersSource,
  /subscribe_public_and_user_inventory\(&iam\.tenant_id, &iam\.user_id, &workspace_id\)/u,
  'Live-only workspace delivery must atomically merge public events with the authenticated user inventory.',
);
assert.match(
  handlersSource,
  /subscribe_session\([\s\S]*&iam\.tenant_id,[\s\S]*&iam\.user_id,[\s\S]*&workspace_id,[\s\S]*&coding_session_id/u,
  'Durable delivery must subscribe only to the exact authenticated coding-session channel.',
);
assert.match(
  hubSource,
  /WorkspaceRealtimeConnectionPermit[\s\S]*MAX_WORKSPACE_REALTIME_SUBSCRIBERS/u,
  'Every tenant/workspace external connection must hold a shared bounded connection permit.',
);
assert.match(
  hubSource,
  /workspace_connection_limit_accumulates_across_session_channels/u,
  'The workspace connection limit must have a regression covering accumulation across session channels.',
);
assert.match(
  handlersSource,
  /REALTIME_AUTHORIZATION_LEASE[\s\S]*authorization_lease_deadline[\s\S]*AuthorizationLeaseExpired/u,
  'SSE and WebSocket subscriptions must have a bounded authorization lease.',
);
assert.match(
  handlersSource,
  /code: 1008[\s\S]*authorization lease expired/u,
  'WebSocket authorization lease expiry must close with policy-violation code 1008.',
);
assert.match(
  handlersSource,
  /CACHE_CONTROL[\s\S]*no-cache, no-store, no-transform[\s\S]*x-accel-buffering[\s\S]*from_static\("no"\)/u,
  'SSE responses must disable caching, transformation, and reverse-proxy buffering.',
);
assert.match(
  handlersSource,
  /page\.events\.len\(\) > REALTIME_REPLAY_PAGE_SIZE/u,
  'Replay providers must not expand the delivery queue above one bounded page.',
);
assert.doesNotMatch(
  handlersSource,
  /hub\.subscribe\(&workspace_id\)[\s\S]*hub\.subscribe\(&workspace_id\)/u,
);

console.log('workspace realtime subscriber limit contract passed.');
