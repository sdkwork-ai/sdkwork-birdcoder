import assert from 'node:assert/strict';
import fs from 'node:fs';

import { readBirdcoderAppShellSource } from './birdcoder-app-shell-contract-sources.mjs';

const appSource = readBirdcoderAppShellSource();
const useProjectsSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useProjects.ts',
    import.meta.url,
  ),
  'utf8',
);

assert.match(
  useProjectsSource,
  /export interface UseProjectsOptions \{[\s\S]*isActive\?: boolean;/,
  'useProjects must expose an explicit isActive option so app shells can prevent unauthenticated Agents project loading.',
);

assert.match(
  useProjectsSource,
  /if \(!isActive\) \{[\s\S]*setStoreSnapshot\(createProjectsStoreSnapshot\(\)\);[\s\S]*return;[\s\S]*\}/,
  'useProjects must reset to an empty snapshot and skip project fetch subscriptions while inactive.',
);

assert.match(
  appSource,
  /useProjects\(\{[\s\S]*?isActive:\s*Boolean\(user\),[\s\S]*?\}\)/s,
  'BirdcoderApp must not load Agents projects until an authenticated user exists.',
);

console.log('auth project loading gating contract passed.');
