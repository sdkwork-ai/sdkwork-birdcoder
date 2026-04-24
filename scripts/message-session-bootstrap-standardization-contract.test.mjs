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
  /export async function ensureWorkbenchCodingSessionForMessage\(/,
  'Workbench message sending must expose a shared ensureWorkbenchCodingSessionForMessage helper so surfaces reuse one authoritative project/session bootstrap flow for first-turn sends.',
);

assert.match(
  `${codePageSource}\n${studioPageSource}`,
  /ensureWorkbenchCodingSessionForMessage\(/,
  'CodePage and StudioPage must reuse the shared ensureWorkbenchCodingSessionForMessage helper when sending the first message without an existing session.',
);

assert.doesNotMatch(
  `${codePageSource}\n${studioPageSource}`,
  /const newTitle\s*=\s*trimmedContent\.slice\(0,\s*20\)\s*\+\s*\(trimmedContent\.length\s*>\s*20\s*\?\s*'\.\.\.'\s*:\s*''\s*\);/s,
  'CodePage and StudioPage must not inline first-message session title generation once the shared message session bootstrap helper owns that behavior.',
);

console.log('message session bootstrap standardization contract passed.');
