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
  'AuthContext must keep initial user-center config loading as an explicit bootstrap task.',
);

const loadUserCenterConfigBody = loadUserCenterConfigMatch[1];

assert.match(
  loadUserCenterConfigBody,
  /syncBirdCoderRuntimeUserCenterBindingFromMetadata\(config\);[\s\S]*setAuthConfig\(config\);/,
  'Auth bootstrap must synchronize the runtime user-center binding before publishing config state.',
);

assert.match(
  loadUserCenterConfigBody,
  /try \{[\s\S]*const currentUserAfterConfigSync = await authService\.getCurrentUser\(\);[\s\S]*setUser\(\(previousUser\) =>[\s\S]*resolveFallbackAwareCurrentUser\([\s\S]*currentUserAfterConfigSync,[\s\S]*previousUser \?\? undefined,[\s\S]*\)\);[\s\S]*\} catch \(error\) \{[\s\S]*Failed to refresh current user after user center config sync/,
  'After user-center metadata is synchronized, AuthContext must retry current-user hydration through identity-aware fallback precedence so stale or null profiles cannot overwrite an already adopted login user.',
);

assert.doesNotMatch(
  loadUserCenterConfigBody,
  /setIsLoading\(/,
  'The config-synchronized hydration retry must not re-open the global auth loading gate; it is a recovery pass after the first-screen auth decision.',
);

console.log('auth config hydration retry contract passed.');
