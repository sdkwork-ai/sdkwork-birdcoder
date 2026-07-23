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
  /export function buildWorkbenchAgentSessionTurnContext\(/,
  'Workbench messaging must expose a shared buildWorkbenchAgentSessionTurnContext helper so every surface emits the same authoritative turn context structure.',
);

assert.match(
  `${codePageSource}\n${studioPageSource}`,
  /buildWorkbenchAgentSessionTurnContext\(/,
  'CodePage and StudioPage must reuse buildWorkbenchAgentSessionTurnContext instead of rebuilding turn context objects inline.',
);

assert.doesNotMatch(
  `${codePageSource}\n${studioPageSource}`,
  /currentFile:\s*selectedFile\s*\?\s*\{/,
  'CodePage and StudioPage must not inline currentFile turn context payloads once buildWorkbenchAgentSessionTurnContext owns that structure.',
);

console.log('message context standardization contract passed.');
