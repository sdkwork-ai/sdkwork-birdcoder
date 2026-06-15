import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const workbenchSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-commons',
  'src',
  'workbench',
  'codingSessionCreation.ts',
);
const codePageSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-code',
  'src',
  'pages',
  'CodePage.tsx',
);
const studioPageSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-studio',
  'src',
  'pages',
  'StudioPage.tsx',
);

assert.match(
  workbenchSource,
  /export async function restoreWorkbenchCodingSessionMessageFiles\(/,
  'Workbench messaging must expose a shared restoreWorkbenchCodingSessionMessageFiles helper so checkpoint restore behavior is standardized across surfaces.',
);

assert.match(
  `${codePageSource}\n${studioPageSource}`,
  /restoreWorkbenchCodingSessionMessageFiles\(/,
  'CodePage and StudioPage must reuse restoreWorkbenchCodingSessionMessageFiles instead of rebuilding restore-plan execution inline.',
);

assert.doesNotMatch(
  `${codePageSource}\n${studioPageSource}`,
  /const restorePlan = buildFileChangeRestorePlan\(msg\?\.fileChanges\);/,
  'CodePage and StudioPage must not inline restore-plan generation once restoreWorkbenchCodingSessionMessageFiles owns that behavior.',
);

console.log('message restore standardization contract passed.');
