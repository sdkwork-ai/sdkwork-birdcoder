import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const workbenchChatSelectionSource = readSource(
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'hooks',
  'useWorkbenchChatSelection.ts',
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
  workbenchChatSelectionSource,
  /currentSessionEngineId\?: string \| null;[\s\S]*currentSessionModelId\?: string \| null;/,
  'Workbench chat selection must accept current session engine and model metadata so session-aware new-session selection is resolved once in the shared hook.',
);

assert.match(
  workbenchChatSelectionSource,
  /resolveWorkbenchPreferredNewSessionSelection\(\s*\{\s*requestedEngineId,[\s\S]*currentSessionEngineId:[\s\S]*currentSessionModelId:/s,
  'Workbench chat selection must forward current session engine/model context into preferred new-session selection resolution.',
);

assert.match(
  codePageSource,
  /useWorkbenchChatSelection\(\{\s*createCodingSession,\s*preferences,\s*updatePreferences,\s*currentSessionEngineId:\s*session\?\.engineId,\s*currentSessionModelId:\s*session\?\.modelId,\s*\}\)/s,
  'CodePage must bind current session engine/model context through the shared workbench chat selection hook.',
);

assert.match(
  studioPageSource,
  /useWorkbenchChatSelection\(\{\s*createCodingSession,\s*preferences,\s*updatePreferences,\s*currentSessionEngineId:\s*selectedSession\?\.engineId,\s*currentSessionModelId:\s*selectedSession\?\.modelId,\s*\}\)/s,
  'StudioPage must bind current session engine/model context through the shared workbench chat selection hook.',
);

assert.doesNotMatch(
  codePageSource,
  /const createCodingSessionWithSelection = useCallback\(/,
  'CodePage must not duplicate session-aware new-session selection wrapping once the shared hook owns that behavior.',
);

assert.doesNotMatch(
  studioPageSource,
  /const createCodingSessionWithSelection = useCallback\(/,
  'StudioPage must not duplicate session-aware new-session selection wrapping once the shared hook owns that behavior.',
);

assert.doesNotMatch(
  codePageSource,
  /resolveWorkbenchPreferredNewSessionSelection/,
  'CodePage must not import or call preferred new-session selection resolution directly after the shared hook absorbs session-aware session creation.',
);

assert.doesNotMatch(
  studioPageSource,
  /resolveWorkbenchPreferredNewSessionSelection/,
  'StudioPage must not import or call preferred new-session selection resolution directly after the shared hook absorbs session-aware session creation.',
);

console.log('session-aware coding session creation contract passed.');
