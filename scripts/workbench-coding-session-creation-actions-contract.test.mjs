import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const hookPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'hooks',
  'useWorkbenchCodingSessionCreationActions.ts',
);

assert.ok(
  fs.existsSync(hookPath),
  'Commons must define a shared useWorkbenchCodingSessionCreationActions hook so workbench surfaces reuse one session-creation action orchestration flow.',
);

const hookSource = fs.readFileSync(hookPath, 'utf8');
const commonsIndexSource = readSource(
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'index.ts',
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
const legacyCommonsWorkbenchPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'workbench.ts',
);

assert.match(
  hookSource,
  /export function useWorkbenchCodingSessionCreationActions\(/,
  'The shared workbench coding session creation actions hook must export a named hook for reuse across workbench surfaces.',
);

assert.match(
  hookSource,
  /createWorkbenchCodingSessionInProject\(/,
  'The shared workbench coding session creation actions hook must delegate the actual create-select-focus sequence into the shared createWorkbenchCodingSessionInProject helper.',
);

assert.match(
  hookSource,
  /async \(\s*projectId: string,\s*requestedEngineId\?: string,\s*options\?: \{[\s\S]*shouldSelectCreatedSession\?:[\s\S]*\},\s*\)/,
  'The shared workbench coding session creation actions hook must accept a per-call created-session selection guard so UI surfaces can prevent stale async creation from overriding newer user navigation.',
);

assert.match(
  hookSource,
  /shouldSelectCreatedSession:\s*options\?\.shouldSelectCreatedSession,/,
  'The shared workbench coding session creation actions hook must pass the per-call selection guard into createWorkbenchCodingSessionInProject.',
);

assert.match(
  commonsIndexSource,
  /export \* from '\.\/hooks\/useWorkbenchCodingSessionCreationActions\.ts';/,
  'Commons public index must export useWorkbenchCodingSessionCreationActions for package consumers.',
);

assert.ok(
  !fs.existsSync(legacyCommonsWorkbenchPath),
  'Commons must not restore the legacy src/workbench.ts barrel; workbench consumers should import shared hooks from the root package entrypoint.',
);

assert.match(
  codePageSource,
  /useWorkbenchCodingSessionCreationActions\(/,
  'CodePage must use the shared workbench coding session creation actions hook.',
);

assert.match(
  studioPageSource,
  /useWorkbenchCodingSessionCreationActions\(/,
  'StudioPage must use the shared workbench coding session creation actions hook.',
);

assert.doesNotMatch(
  codePageSource,
  /const handleNewSessionInProject = useCallback\(/,
  'CodePage must not define a local project session creation action once the shared hook owns that orchestration.',
);

assert.doesNotMatch(
  studioPageSource,
  /const handleCreateCodingSessionInProject = useCallback\(/,
  'StudioPage must not define a local project session creation action once the shared hook owns that orchestration.',
);

console.log('workbench coding session creation actions contract passed.');
