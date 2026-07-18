import assert from 'node:assert/strict';
import fs from 'node:fs';

const authPageSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/src/pages/AuthPage.tsx', import.meta.url),
  'utf8',
);
const authContextSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/context/AuthContext.ts', import.meta.url),
  'utf8',
);

assert.match(
  authPageSource,
  /const BIRDCODER_AUTH_APPEARANCE = resolveBirdCoderAuthAppearance\(\);/u,
  'Auth appearance must have stable identity so auth route renders do not restart QR effects.',
);
assert.match(
  authPageSource,
  /const BIRDCODER_AUTH_RUNTIME_CONFIG = resolveBirdCoderAuthRuntimeConfig\(\);/u,
  'Auth runtime config must have stable identity for the lifetime of the login surface.',
);
assert.match(
  authPageSource,
  /appearance=\{BIRDCODER_AUTH_APPEARANCE\}[\s\S]*runtimeConfig=\{BIRDCODER_AUTH_RUNTIME_CONFIG\}/u,
  'The IAM auth routes must receive the stable appearance and runtime config values.',
);
assert.match(
  authContextSource,
  /const initialSessionLoadCompletedRef = useRef\(false\);/u,
  'Auth bootstrap must distinguish the initial protected-data gate from background session validation.',
);
assert.match(
  authContextSource,
  /if \(!initialSessionLoadCompletedRef\.current\) \{\s*setIsLoading\(true\);\s*\}/u,
  'Background token/context changes must not put AuthGate back into its blocking loading state.',
);

console.log('auth QR session stability contract passed.');
