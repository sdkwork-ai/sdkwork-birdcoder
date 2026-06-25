import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { readBirdcoderAppShellSource } from './birdcoder-app-shell-contract-sources.mjs';

const rootDir = process.cwd();
const authPagePath = path.join(
  rootDir,
  'apps',
    'sdkwork-birdcoder-pc',
    'packages',
  
  'sdkwork-birdcoder-pc-auth',
  'src',
  'pages',
  'AuthPage.tsx',
);
const shellAppSource = readBirdcoderAppShellSource(rootDir);
const authPageSource = fs.readFileSync(authPagePath, 'utf8');

assert.match(
  authPageSource,
  /"viewportMode"/u,
  'BirdCoder AuthPage props must omit viewportMode so callers cannot re-enable the shared auth package fixed overlay inside the app shell.',
);

assert.match(
  authPageSource,
  /viewportMode="flow"/u,
  'BirdCoder AuthPage must render SdkworkIamAuthRoutes in flow mode so the login page does not cover AppHeader window controls.',
);

assert.match(
  authPageSource,
  /style=\{\{[\s\S]*height:\s*["']100%["'][\s\S]*minHeight:\s*0[\s\S]*\.\.\.style[\s\S]*\}\}/u,
  'BirdCoder AuthPage must constrain the shared auth route viewport to the shell content area instead of using a full desktop viewport below the AppHeader.',
);

assert.match(
  shellAppSource,
  /<BirdcoderAppHeader[\s\S]*?<AppMainBody/u,
  'BirdcoderApp must render AppHeader before AppMainBody so auth pages inherit the same desktop window controls as the rest of the shell.',
);

assert.doesNotMatch(
  shellAppSource,
  /activeTab !== ['"]auth['"][\s\S]{0,240}<BirdcoderAppHeader/u,
  'BirdcoderAppHeader must not be gated away on the auth tab; only workbench menus may be hidden there.',
);

console.log('auth page app header window controls contract passed.');
