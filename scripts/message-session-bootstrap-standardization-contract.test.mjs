import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const agentSessionCreationSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-workbench',
  'src',
  'workbench',
  'agentSessionCreation.ts',
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
  agentSessionCreationSource,
  /export async function ensureWorkbenchAgentSessionForMessage\(/,
  'Workbench message sending must expose a shared ensureWorkbenchAgentSessionForMessage helper so surfaces reuse one authoritative project/session bootstrap flow for first-turn sends.',
);

assert.match(
  `${codePageSource}\n${studioPageSource}`,
  /ensureWorkbenchAgentSessionForMessage\(/,
  'CodePage and StudioPage must reuse the shared ensureWorkbenchAgentSessionForMessage helper when sending the first message without an existing session.',
);

assert.doesNotMatch(
  `${codePageSource}\n${studioPageSource}`,
  /const newTitle\s*=\s*trimmedContent\.slice\(0,\s*20\)\s*\+\s*\(trimmedContent\.length\s*>\s*20\s*\?\s*'\.\.\.'\s*:\s*''\s*\);/s,
  'CodePage and StudioPage must not inline first-message session title generation once the shared message session bootstrap helper owns that behavior.',
);

console.log('message session bootstrap standardization contract passed.');
