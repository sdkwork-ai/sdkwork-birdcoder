import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const smokeFiles = [
  '../crates/sdkwork-routes-workspace-app-api/tests/handler_smoke.rs',
  '../crates/sdkwork-routes-system-app-api/tests/handler_smoke.rs',
];

const retiredAuthorityPaths = [
  '../crates/sdkwork-routes-coding-sessions-app-api',
  '../crates/sdkwork-routes-deployment-backend-api',
  '../crates/sdkwork-birdcoder-coding-sessions-repository-sqlx',
  '../crates/sdkwork-birdcoder-coding-sessions-service',
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

for (const relativePath of retiredAuthorityPaths) {
  assert.equal(
    existsSync(fileURLToPath(new URL(relativePath, import.meta.url))),
    false,
    `${relativePath} is a retired BirdCoder authority and must not exist.`,
  );
}

console.log('router handler smoke contract passed.');
