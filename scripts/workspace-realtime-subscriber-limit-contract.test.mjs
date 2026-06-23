import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const handlersSource = readFileSync(
  'crates/sdkwork-router-workspace-app-api/src/handlers.rs',
  'utf8',
);
const errorSource = readFileSync(
  'crates/sdkwork-router-workspace-app-api/src/error.rs',
  'utf8',
);
const hubSource = readFileSync(
  'crates/sdkwork-router-workspace-app-api/src/realtime_hub.rs',
  'utf8',
);

assert.match(hubSource, /MAX_WORKSPACE_REALTIME_SUBSCRIBERS/);
assert.match(hubSource, /RealtimeSubscriberLimitExceeded/);
assert.match(handlersSource, /map_rate_limited/);
assert.match(errorSource, /StatusCode::TOO_MANY_REQUESTS/);
assert.doesNotMatch(
  handlersSource,
  /hub\.subscribe\(&workspace_id\)[\s\S]*hub\.subscribe\(&workspace_id\)/u,
);

console.log('workspace realtime subscriber limit contract passed.');
