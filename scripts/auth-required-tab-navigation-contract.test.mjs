import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-shell/src/application/app/BirdcoderApp.tsx', import.meta.url),
  'utf8',
);

const openAuthenticationSurfaceMatch = appSource.match(
  /const openAuthenticationSurface = useCallback\(\(targetTab: AppTab\) => \{([\s\S]*?)\n  \}, \[\]\);/,
);

assert.ok(
  openAuthenticationSurfaceMatch,
  'App shell must keep an explicit openAuthenticationSurface callback for auth-required tabs.',
);

const openAuthenticationSurfaceBody = openAuthenticationSurfaceMatch[1];

assert.doesNotMatch(
  openAuthenticationSurfaceBody,
  /startTransition\(/,
  'Unauthenticated auth-required tab clicks must switch to the auth surface urgently so Suspense cannot keep the old page visible while the login chunk loads.',
);

assert.match(
  openAuthenticationSurfaceBody,
  /pendingAuthTargetTabRef\.current = targetTab;[\s\S]*setActiveTab\('auth'\);/,
  'Auth-required tab clicks must remember the requested tab and activate the auth surface immediately.',
);

assert.match(
  appSource,
  /if \(!user && requiresAuthenticatedSession\(nextTab\)\) \{\s*openAuthenticationSurface\(nextTab\);\s*return;\s*\}/,
  'Unauthenticated primary tab navigation must continue to route protected tabs through the auth surface.',
);

console.log('auth-required tab navigation contract passed.');
