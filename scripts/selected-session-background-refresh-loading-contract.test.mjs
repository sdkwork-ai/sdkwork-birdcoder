import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const hookSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps',
    'sdkwork-birdcoder-pc',
    'packages',
    
    
    
    'sdkwork-birdcoder-pc-workbench',
    'src',
    'hooks',
    'useSelectedAgentSessionItems.ts',
  ),
  'utf8',
);
const codePageSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps',
    'sdkwork-birdcoder-pc',
    'packages',
    'sdkwork-birdcoder-pc-code',
    'src',
    'pages',
    'CodePage.tsx',
  ),
  'utf8',
);
const studioPageSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps',
    'sdkwork-birdcoder-pc',
    'packages',
    'sdkwork-birdcoder-pc-studio',
    'src',
    'pages',
    'StudioPage.tsx',
  ),
  'utf8',
);

assert.match(
  hookSource,
  /selectedAgentSession\?\.items\.length \?\? 0,[\s\S]*pollRevision,[\s\S]*selectedAgentSession\?\.items\.length,/,
  'selected session refresh identity must observe canonical Session Item inventory and polling revision.',
);

assert.match(
  codePageSource,
  /const isSelectedAgentSessionHydrating = Boolean\([\s\S]*isSelectedAgentSessionItemsLoading[\s\S]*selectedAgentSessionItems\.length === 0/s,
  'CodePage must show foreground transcript loading only while the selected canonical Session Item inventory is empty.',
);

assert.match(
  studioPageSource,
  /const isSelectedAgentSessionHydrating = Boolean\([\s\S]*isSelectedAgentSessionItemsLoading[\s\S]*selectedSessionMessages\.length === 0/s,
  'StudioPage must keep an already populated transcript visible while Session Items refresh in the background.',
);

assert.doesNotMatch(
  hookSource,
  /synchronizedSessionVersionsByScopeKey|resolvedAgentSession\.messages/,
  'selected session refresh must not restore the retired shared synchronization map or parallel message inventory.',
);

console.log('selected session background refresh loading contract passed.');
