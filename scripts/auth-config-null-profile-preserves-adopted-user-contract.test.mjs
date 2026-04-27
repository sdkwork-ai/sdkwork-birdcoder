import assert from 'node:assert/strict';
import fs from 'node:fs';

const authContextSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/context/AuthContext.ts', import.meta.url),
  'utf8',
);

const loadUserCenterConfigMatch = authContextSource.match(
  /const loadUserCenterConfig = async \(\) => \{([\s\S]*?)\n    \};/,
);

assert.ok(
  loadUserCenterConfigMatch,
  'AuthContext must keep user-center config hydration as an explicit bootstrap task.',
);

const loadUserCenterConfigBody = loadUserCenterConfigMatch[1];

assert.match(
  loadUserCenterConfigBody,
  /setUser\(\(previousUser\) =>[\s\S]*resolveFallbackAwareCurrentUser\([\s\S]*currentUserAfterConfigSync,[\s\S]*previousUser \?\? undefined,[\s\S]*\)\);/,
  'Config-synchronized profile hydration must not overwrite an already adopted login user with null or a different stale runtime profile while the runtime profile endpoint is catching up.',
);

assert.doesNotMatch(
  loadUserCenterConfigBody,
  /setUser\(currentUserAfterConfigSync\);/,
  'Config-synchronized profile hydration must not directly publish a nullable profile result over the current authenticated user.',
);

console.log('auth config null profile preserves adopted user contract passed.');
