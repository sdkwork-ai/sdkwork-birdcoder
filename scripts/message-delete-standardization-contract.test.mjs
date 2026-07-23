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
  
  'sdkwork-birdcoder-pc-workbench',
  'src',
  'workbench',
  'agentSessionCreation.ts',
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
const codeDeleteConfirmationSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-code',
  'src',
  'pages',
  'useCodeDeleteConfirmation.ts',
);

assert.match(
  workbenchSource,
  /export async function deleteWorkbenchAgentSessionItems\(/,
  'Workbench Agents integration must expose a shared deleteWorkbenchAgentSessionItems helper so Session Item deletion order and semantics stay standardized across surfaces.',
);

assert.match(
  `${studioPageSource}\n${codeDeleteConfirmationSource}`,
  /deleteWorkbenchAgentSessionItems\(/,
  'StudioPage and useCodeDeleteConfirmation must reuse deleteWorkbenchAgentSessionItems instead of reimplementing reverse-order Session Item deletion locally.',
);

assert.match(
  workbenchSource,
  /Array\.from\(\s*new Set\(\s*sessionItemIds[\s\S]*\.map\(\(sessionItemId\) => sessionItemId\.trim\(\)\)[\s\S]*\.filter\(\(sessionItemId\) => sessionItemId\.length > 0\)[\s\S]*\)\s*\)/s,
  'deleteWorkbenchAgentSessionItems must de-duplicate Session Item ids before deletion so duplicate provider ids do not trigger a second not-found delete.',
);

assert.doesNotMatch(
  `${studioPageSource}\n${codeDeleteConfirmationSource}`,
  /for \(let itemIndex = sessionItemIds\.length - 1; itemIndex >= 0; itemIndex -= 1\)/,
  'StudioPage and useCodeDeleteConfirmation must not inline reverse-order Session Item deletion loops once deleteWorkbenchAgentSessionItems owns that behavior.',
);

console.log('agent session item delete standardization contract passed.');
