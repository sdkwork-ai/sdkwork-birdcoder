import assert from 'node:assert/strict';
import fs from 'node:fs';

const authContextSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/context/AuthContext.ts', import.meta.url),
  'utf8',
);

assert.doesNotMatch(
  authContextSource,
  /Promise\.allSettled\(\s*\[\s*authService\.getUserCenterConfig[\s\S]*authService\.getCurrentUser\(\)\s*\]\s*\)/,
  'Auth bootstrap must not gate first-screen auth resolution on the optional user-center config request.',
);

assert.match(
  authContextSource,
  /authService\.getCurrentUser\(\)/,
  'Auth bootstrap must still resolve the current user during initial load.',
);

assert.match(
  authContextSource,
  /authService\.getUserCenterConfig\?\.\(\)/,
  'Auth bootstrap must still load user-center config, but as a non-blocking side task.',
);

console.log('auth bootstrap gating contract passed.');
