import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const smokeFiles = [
  '../crates/sdkwork-router-coding-sessions-app-api/tests/handler_smoke.rs',
  '../crates/sdkwork-router-workspace-app-api/tests/handler_smoke.rs',
  '../crates/sdkwork-router-system-app-api/tests/handler_smoke.rs',
];

const listEnvelopeSmokeFiles = [
  '../crates/sdkwork-router-coding-sessions-app-api/tests/handler_smoke.rs',
  '../crates/sdkwork-router-workspace-app-api/tests/handler_smoke.rs',
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
    /json\["meta"\]\["version"\]/,
    `${relativePath} must assert canonical list/data envelope metadata.`,
  );
  assert.match(
    source,
    /json\["requestId"\]/,
    `${relativePath} must assert requestId on successful list responses.`,
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
