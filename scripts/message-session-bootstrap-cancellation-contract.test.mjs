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

assert.doesNotMatch(
  agentSessionCreationSource,
  /throw new Error\(\s*'Workbench message session bootstrap requires a project before sending a message\./,
  'ensureWorkbenchAgentSessionForMessage must not throw when the user cancels project resolution; first-turn sending should abort gracefully just like the previous page-local implementations.',
);

assert.match(
  agentSessionCreationSource,
  /if \(!projectId\) \{\s*return null;\s*\}/s,
  'ensureWorkbenchAgentSessionForMessage must return null when no project can be resolved so callers can stop sending without surfacing an exception.',
);

assert.match(
  `${codePageSource}\n${studioPageSource}`,
  /if \(!bootstrappedSession\) \{\s*return;\s*\}/s,
  'CodePage and StudioPage must bail out cleanly when ensureWorkbenchAgentSessionForMessage returns null after a canceled project resolution flow.',
);

console.log('message session bootstrap cancellation contract passed.');
