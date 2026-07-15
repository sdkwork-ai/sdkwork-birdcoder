import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const smokeFiles = [
  '../crates/sdkwork-routes-coding-sessions-app-api/tests/handler_smoke.rs',
  '../crates/sdkwork-routes-workspace-app-api/tests/handler_smoke.rs',
  '../crates/sdkwork-routes-system-app-api/tests/handler_smoke.rs',
  '../crates/sdkwork-routes-deployment-backend-api/tests/handler_smoke.rs',
];

const listEnvelopeSmokeFiles = [
  '../crates/sdkwork-routes-coding-sessions-app-api/tests/handler_smoke.rs',
  '../crates/sdkwork-routes-workspace-app-api/tests/handler_smoke.rs',
  '../crates/sdkwork-routes-deployment-backend-api/tests/handler_smoke.rs',
];

for (const relativePath of smokeFiles) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  assert.doesNotMatch(
    source,
    /todo!\(/,
    `${relativePath} must not leave handler smoke tests as todo placeholders.`,
  );
  assert.doesNotMatch(
    source,
    /#\[ignore\]/,
    `${relativePath} must run handler smoke coverage instead of ignored placeholders.`,
  );
}

for (const relativePath of listEnvelopeSmokeFiles) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  assert.match(
    source,
    /create_any_pool_from_config|AnyPool/u,
    `${relativePath} must bootstrap repositories through sqlx AnyPool for engine-agnostic smoke coverage.`,
  );
  assert.match(
    source,
    /json\["code"\], 0/,
    `${relativePath} must assert the numeric zero success code required by the SDKWork response envelope.`,
  );
  assert.match(
    source,
    /json\["traceId"\]/,
    `${relativePath} must assert traceId on successful list responses.`,
  );
  assert.match(
    source,
    /json\["data"\]\["items"\]/,
    `${relativePath} must assert list items inside the standard data envelope.`,
  );
  assert.match(
    source,
    /json\["data"\]\["pageInfo"\]/,
    `${relativePath} must assert pagination metadata inside the standard data envelope.`,
  );
  assert.doesNotMatch(
    source,
    /json\["(?:meta|requestId)"\]/,
    `${relativePath} must not reintroduce legacy meta or requestId response fields.`,
  );
}

const repositoryErrorSource = readFileSync(
  new URL(
    '../crates/sdkwork-birdcoder-coding-sessions-repository-sqlx/src/error.rs',
    import.meta.url,
  ),
  'utf8',
);
assert.match(
  repositoryErrorSource,
  /RepositoryError::NotFound\(msg\) => Self::NotFound\(msg\)/,
  'Coding session repository NotFound errors must surface as API 404 responses.',
);

console.log('router handler smoke contract passed.');
