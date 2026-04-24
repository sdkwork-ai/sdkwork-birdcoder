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

assert.doesNotMatch(
  codingSessionCreationSource,
  /throw new Error\(\s*'Workbench message session bootstrap requires a project before sending a message\./,
  'ensureWorkbenchCodingSessionForMessage must not throw when the user cancels project resolution; first-turn sending should abort gracefully just like the previous page-local implementations.',
);

assert.match(
  codingSessionCreationSource,
  /if \(!projectId\) \{\s*return null;\s*\}/s,
  'ensureWorkbenchCodingSessionForMessage must return null when no project can be resolved so callers can stop sending without surfacing an exception.',
);

assert.match(
  `${codePageSource}\n${studioPageSource}`,
  /if \(!bootstrappedSession\) \{\s*return;\s*\}/s,
  'CodePage and StudioPage must bail out cleanly when ensureWorkbenchCodingSessionForMessage returns null after a canceled project resolution flow.',
);

console.log('message session bootstrap cancellation contract passed.');
