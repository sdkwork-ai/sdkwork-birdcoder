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
const studioPageSource = readSource(
  'packages',
  'sdkwork-birdcoder-studio',
  'src',
  'pages',
  'StudioPage.tsx',
);
const codeDeleteConfirmationSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'useCodeDeleteConfirmation.ts',
);

assert.match(
  workbenchSource,
  /export async function deleteWorkbenchCodingSessionMessages\(/,
  'Workbench messaging must expose a shared deleteWorkbenchCodingSessionMessages helper so message deletion order and semantics stay standardized across surfaces.',
);

assert.match(
  `${studioPageSource}\n${codeDeleteConfirmationSource}`,
  /deleteWorkbenchCodingSessionMessages\(/,
  'StudioPage and useCodeDeleteConfirmation must reuse deleteWorkbenchCodingSessionMessages instead of reimplementing reverse-order deletion locally.',
);

assert.doesNotMatch(
  `${studioPageSource}\n${codeDeleteConfirmationSource}`,
  /for \(let messageIndex = messageIds\.length - 1; messageIndex >= 0; messageIndex -= 1\)/,
  'StudioPage and useCodeDeleteConfirmation must not inline reverse-order message deletion loops once deleteWorkbenchCodingSessionMessages owns that behavior.',
);

console.log('message delete standardization contract passed.');
