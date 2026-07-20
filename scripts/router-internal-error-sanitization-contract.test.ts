import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cratesRoot = path.join(repoRoot, 'crates');

const routerErrorFiles = readdirSync(cratesRoot)
  .flatMap((crateName) => {
    const errorPath = path.join(cratesRoot, crateName, 'src', 'error.rs');
    if (!crateName.startsWith('sdkwork-routes-') || !statSync(errorPath, { throwIfNoEntry: false })) {
      return [];
    }
    return [errorPath];
  });

const errorsLib = readFileSync(
  path.join(repoRoot, 'crates/sdkwork-birdcoder-errors/src/client_safe.rs'),
  'utf8',
);
const authBootstrap = readFileSync(
  path.join(repoRoot, 'crates/sdkwork-api-birdcoder-standalone-gateway/src/bootstrap/auth.rs'),
  'utf8',
);

assert.match(
  errorsLib,
  /CLIENT_SAFE_DATA_ACCESS_MESSAGE/,
  'shared client-safe internal messages must be defined in sdkwork-birdcoder-errors.',
);
assert.match(
  authBootstrap,
  /rate_limit:\s*RateLimitPolicy\s*\{/,
  'BirdCoder protected router must enable SDKWork web framework rate limiting.',
);

for (const errorFile of routerErrorFiles) {
  const source = readFileSync(errorFile, 'utf8');
  assert.match(
    source,
    /client_safe_(data_access|internal|event_publish|provider)_problem/,
    `${path.relative(repoRoot, errorFile)} must map repository/internal failures through client-safe helpers.`,
  );
  assert.doesNotMatch(
    source,
    /::Repository\(msg\)|::Internal\(msg\)|::EventPublish\(msg\)|::Provider\(msg\)/,
    `${path.relative(repoRoot, errorFile)} must not forward raw repository/provider messages to clients.`,
  );
}

console.log('router internal error sanitization contract passed.');
