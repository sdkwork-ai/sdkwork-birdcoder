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
  /throw new Error\(\s*'Workbench agent turn session bootstrap requires a project before submitting a turn input\./,
  'ensureWorkbenchAgentSessionForTurnInput must not throw when the user cancels project resolution; first-turn submission should return control to the calling surface.',
);

assert.match(
  agentSessionCreationSource,
  /if \(!projectId\) \{\s*return null;\s*\}/s,
  'ensureWorkbenchAgentSessionForTurnInput must return null when no project can be resolved so callers can stop turn submission through their standard unavailable-session path.',
);

assert.match(
  `${codePageSource}\n${studioPageSource}`,
  /if \(!bootstrappedSession\) \{\s*throw new Error\(t\('chat\.sendMessageSessionUnavailable'\)\);\s*\}/s,
  'CodePage and StudioPage must stop before turn submission and surface the standard unavailable-session error when ensureWorkbenchAgentSessionForTurnInput returns null.',
);

console.log('agent turn-input session bootstrap cancellation contract passed.');
