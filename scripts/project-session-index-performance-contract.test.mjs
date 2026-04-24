import assert from 'node:assert/strict';
import fs from 'node:fs';

const codingSessionSelectionPath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/codingSessionSelection.ts',
  import.meta.url,
);
const codePagePath = new URL(
  '../packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx',
  import.meta.url,
);
const studioPagePath = new URL(
  '../packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx',
  import.meta.url,
);

const codingSessionSelectionSource = fs.readFileSync(codingSessionSelectionPath, 'utf8');
const codePageSource = fs.readFileSync(codePagePath, 'utf8');
const studioPageSource = fs.readFileSync(studioPagePath, 'utf8');

assert.match(
  codingSessionSelectionSource,
  /export interface BirdCoderProjectCodingSessionIndex/,
  'codingSessionSelection must define a reusable project/session lookup index.',
);

assert.match(
  codingSessionSelectionSource,
  /export function buildProjectCodingSessionIndex\(/,
  'codingSessionSelection must expose a shared project/session index builder.',
);

assert.doesNotMatch(
  codingSessionSelectionSource,
  /resolveLatestCodingSessionIdForProject[\s\S]*?\.sort\(/,
  'resolveLatestCodingSessionIdForProject must avoid full-array sorting in the hot path.',
);

assert.match(
  codingSessionSelectionSource,
  /resolveLatestCodingSessionIdForProject[\s\S]*buildProjectCodingSessionIndex\(projects\)/,
  'resolveLatestCodingSessionIdForProject must reuse the shared project/session index instead of rescanning the project tree.',
);

assert.match(
  codePageSource,
  /buildProjectCodingSessionIndex/,
  'CodePage must consume the shared project/session index to avoid repeated tree scans.',
);

assert.doesNotMatch(
  codePageSource,
  /resolveSession\(sessionId\)\s*\?\?\s*resolveCodingSessionLocationInProjects\(projects,\s*sessionId\)/,
  'CodePage must not perform a redundant fallback coding-session location scan once it already resolved the shared project/session index.',
);

assert.match(
  studioPageSource,
  /buildProjectCodingSessionIndex/,
  'StudioPage must consume the shared project/session index to avoid repeated tree scans.',
);

assert.doesNotMatch(
  studioPageSource,
  /resolveCodingSessionLocation\(sessionId\)\s*\?\?\s*resolveCodingSessionLocationInProjects\(projects,\s*sessionId\)/,
  'StudioPage must not perform a redundant fallback coding-session location scan once it already resolved the shared project/session index.',
);

console.log('project/session index performance contract passed.');
