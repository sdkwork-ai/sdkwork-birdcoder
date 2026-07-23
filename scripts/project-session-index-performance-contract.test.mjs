import assert from 'node:assert/strict';
import fs from 'node:fs';

const agentSessionSelectionPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/agentSessionSelection.ts',
  import.meta.url,
);
const codePagePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePage.tsx',
  import.meta.url,
);
const studioPagePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/StudioPage.tsx',
  import.meta.url,
);

const agentSessionSelectionSource = fs.readFileSync(agentSessionSelectionPath, 'utf8');
const codePageSource = fs.readFileSync(codePagePath, 'utf8');
const studioPageSource = fs.readFileSync(studioPagePath, 'utf8');

assert.match(
  agentSessionSelectionSource,
  /export interface BirdCoderProjectAgentSessionIndex/,
  'agentSessionSelection must define a reusable project/session lookup index.',
);

assert.match(
  agentSessionSelectionSource,
  /export function buildProjectAgentSessionIndex\(/,
  'agentSessionSelection must expose a shared project/session index builder.',
);

assert.doesNotMatch(
  agentSessionSelectionSource,
  /resolveLatestAgentSessionIdForProject[\s\S]*?\.sort\(/,
  'resolveLatestAgentSessionIdForProject must avoid full-array sorting in the hot path.',
);

assert.match(
  agentSessionSelectionSource,
  /resolveLatestAgentSessionIdForProject[\s\S]*buildProjectAgentSessionIndex\(projects\)/,
  'resolveLatestAgentSessionIdForProject must reuse the shared project/session index instead of rescanning the project tree.',
);

assert.match(
  codePageSource,
  /buildProjectAgentSessionIndex/,
  'CodePage must consume the shared project/session index to avoid repeated tree scans.',
);

assert.doesNotMatch(
  codePageSource,
  /resolveSession\(sessionId\)\s*\?\?\s*resolveAgentSessionLocationInProjects\(projects,\s*sessionId\)/,
  'CodePage must not perform a redundant fallback coding-session location scan once it already resolved the shared project/session index.',
);

assert.match(
  studioPageSource,
  /buildProjectAgentSessionIndex/,
  'StudioPage must consume the shared project/session index to avoid repeated tree scans.',
);

assert.doesNotMatch(
  studioPageSource,
  /resolveAgentSessionLocation\(sessionId\)\s*\?\?\s*resolveAgentSessionLocationInProjects\(projects,\s*sessionId\)/,
  'StudioPage must not perform a redundant fallback coding-session location scan once it already resolved the shared project/session index.',
);

console.log('project/session index performance contract passed.');
