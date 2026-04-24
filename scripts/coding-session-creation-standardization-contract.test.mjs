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
const codingSessionActionsSource = readSource(
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'hooks',
  'useCodingSessionActions.ts',
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
  /export async function createWorkbenchCodingSessionInProject\(/,
  'Workbench coding session creation utilities must expose a shared createWorkbenchCodingSessionInProject helper so code and studio surfaces reuse one authoritative session creation flow.',
);

assert.match(
  codingSessionCreationSource,
  /globalEventBus\.emit\('focusChatInput'\)/,
  'The shared coding session creation helper must own the standard delayed focusChatInput dispatch so callers do not reimplement it locally.',
);

assert.match(
  codingSessionActionsSource,
  /createWorkbenchCodingSessionInProject\(/,
  'useCodingSessionActions must delegate session creation to the shared workbench coding session creation helper.',
);

assert.match(
  `${codePageSource}\n${studioPageSource}`,
  /useWorkbenchCodingSessionCreationActions\(/,
  'Workbench surfaces must delegate UI-facing session creation orchestration through the shared useWorkbenchCodingSessionCreationActions hook instead of each page rebuilding success toasts, missing-project guards, and request routing.',
);

assert.doesNotMatch(
  `${codePageSource}\n${studioPageSource}`,
  /setTimeout\(\(\) => \{\s*globalEventBus\.emit\('focusChatInput'\);\s*\}, 100\);/s,
  'CodePage and StudioPage must not inline delayed focusChatInput dispatch once the shared coding session creation helper owns that behavior.',
);

console.log('coding session creation standardization contract passed.');
