import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-shell/src/application/app/BirdcoderApp.tsx', import.meta.url),
  'utf8',
);
const useWorkspacesSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/hooks/useWorkspaces.ts', import.meta.url),
  'utf8',
);

assert.match(
  useWorkspacesSource,
  /export interface UseWorkspacesOptions \{[\s\S]*isActive\?: boolean;/,
  'useWorkspaces must expose an explicit isActive option so app shells can prevent unauthenticated workspace loading.',
);

assert.match(
  useWorkspacesSource,
  /if \(!isActive\) \{[\s\S]*setStoreSnapshot\(createWorkspacesStoreSnapshot\(\)\);[\s\S]*return;[\s\S]*\}/,
  'useWorkspaces must reset to an empty snapshot and skip fetch subscription work while inactive.',
);

assert.match(
  appSource,
  /useWorkspaces\(\{\s*isActive: Boolean\(user\),\s*\}\)/,
  'BirdcoderApp must not load workspaces until an authenticated user exists.',
);

console.log('auth workspace loading gating contract passed.');
