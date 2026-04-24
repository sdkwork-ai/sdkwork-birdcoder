import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const codingSessionCreationSource = readSource(
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
  codingSessionCreationSource,
  /export function buildWorkbenchCodingSessionTurnContext\(/,
  'Workbench messaging must expose a shared buildWorkbenchCodingSessionTurnContext helper so every surface emits the same authoritative turn context structure.',
);

assert.match(
  `${codePageSource}\n${studioPageSource}`,
  /buildWorkbenchCodingSessionTurnContext\(/,
  'CodePage and StudioPage must reuse buildWorkbenchCodingSessionTurnContext instead of rebuilding turn context objects inline.',
);

assert.doesNotMatch(
  `${codePageSource}\n${studioPageSource}`,
  /currentFile:\s*selectedFile\s*\?\s*\{/,
  'CodePage and StudioPage must not inline currentFile turn context payloads once buildWorkbenchCodingSessionTurnContext owns that structure.',
);

console.log('message context standardization contract passed.');
