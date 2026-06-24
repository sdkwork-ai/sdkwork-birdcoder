import { readBirdcoderAppShellSource } from './birdcoder-app-shell-contract-sources.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = readBirdcoderAppShellSource();
const authRoutingSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/authAppTabRouting.ts', import.meta.url),
  'utf8',
);

const openAuthenticationSurfaceMatch = authRoutingSource.match(
  /const openAuthenticationSurface = useCallback\(\(targetTab: AppTab\) => \{([\s\S]*?)\n  \}, \[setActiveTab\]\);/,
);

assert.ok(
  openAuthenticationSurfaceMatch,
  'Auth app tab routing must keep an explicit openAuthenticationSurface callback for auth-required tabs.',
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
  authRoutingSource,
  /if \(!user && requiresAuthenticatedSession\(nextTab\)\) \{\s*openAuthenticationSurface\(nextTab\);\s*return;\s*\}/,
  'Unauthenticated primary tab navigation must continue to route protected tabs through the auth surface.',
);

assert.match(
  appSource,
  /useBirdCoderAuthAppTabRouting/u,
  'App shell must compose auth-required tab routing through the dedicated authAppTabRouting hook.',
);

console.log('auth-required tab navigation contract passed.');
