import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const birdcoderAppSource = readSource(
  'packages',
  'sdkwork-birdcoder-shell',
  'src',
  'application',
  'app',
  'BirdcoderApp.tsx',
);

assert.match(
  birdcoderAppSource,
  /useWorkbenchChatSelection\(/,
  'BirdcoderApp must reuse the shared session-aware workbench chat selection hook so shell new-session entry points follow the same engine/model preference resolution as code and studio surfaces.',
);

assert.match(
  birdcoderAppSource,
  /useWorkbenchCodingSessionCreationActions\(/,
  'BirdcoderApp must reuse the shared workbench coding session creation actions hook for project-scoped session creation instead of rebuilding shell-local success and failure orchestration.',
);

assert.doesNotMatch(
  birdcoderAppSource,
  /resolveWorkbenchPreferredNewSessionSelection/,
  'BirdcoderApp must not resolve preferred new-session engine/model locally once shared session-aware selection logic is available.',
);

console.log('shell coding session creation standardization contract passed.');
