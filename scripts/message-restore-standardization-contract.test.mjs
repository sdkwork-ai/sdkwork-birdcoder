import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const workbenchSource = readSource(
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'workbench',
  'codingSessionCreation.ts',
);
const codePageSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'CodePage.tsx',
);
const studioPageSource = readSource(
  'packages',
  'sdkwork-birdcoder-studio',
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
