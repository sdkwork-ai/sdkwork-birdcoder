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
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-workbench',
  'src',
  'hooks',
  'useWorkbenchCodingSessionCreationActions.ts',
);

assert.ok(
  fs.existsSync(hookPath),
  'Commons must define a shared useWorkbenchCodingSessionCreationActions hook so workbench surfaces reuse one session-creation action orchestration flow.',
);

const hookSource = fs.readFileSync(hookPath, 'utf8');
const codingSessionCreationSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-workbench',
  'src',
  'workbench',
  'codingSessionCreation.ts',
);
const commonsIndexSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-workbench',
  'src',
  'index.ts',
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
const legacyCommonsWorkbenchPath = path.join(
  rootDir,
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-workbench',
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
  /let newSession: BirdCoderCodingSession;[\s\S]*try \{[\s\S]*newSession = await creation\.promise;[\s\S]*\} catch \(error\) \{[\s\S]*return null;[\s\S]*\}[\s\S]*const selectionContext:/,
  'Persistence failures must be handled before post-creation selection and notification so UI callback errors cannot turn a persisted session into a false creation failure.',
);
assert.match(
  hookSource,
  /return newSession;/,
  'Every caller of a coalesced creation must resume after the shared persistence promise so its own selection guard can be evaluated.',
);

assert.match(
  hookSource,
  /async \(\s*request\?: CreateNewCodingSessionRequest,\s*actionOptions\?: CreateCodingSessionActionOptions,[\s\S]*normalizeCreateNewCodingSessionRequest\(/,
  'The shared workbench coding session creation actions hook must accept one typed request boundary instead of rebuilding positional entry-point orchestration.',
);

assert.match(
  hookSource,
  /!creation\.selected[\s\S]*actionOptions\?\.shouldSelectCreatedSession\?\.\(newSession, selectionContext\) !== false[\s\S]*creation\.selected = true;/,
  'The shared action must evaluate selection per caller after a coalesced request resolves, while selecting the created session at most once.',
);

assert.match(
  hookSource,
  /inFlightCreationsRef\.current\.get\(inFlightKey\)[\s\S]*inFlightCreationsRef\.current\.set\(inFlightKey, creation\)/,
  'The shared action must coalesce identical in-flight requests so double clicks and overlapping shortcuts cannot create duplicate persisted sessions.',
);
assert.match(
  codingSessionCreationSource,
  /showFailureToast\?: boolean;[\s\S]*showSuccessToast\?: boolean;/,
  'The shared command contract must let background provisioning consumers suppress per-pane toasts.',
);
assert.match(
  hookSource,
  /actionOptions\?\.showSuccessToast !== false/,
  'The shared action must honor the command contract success-toast control for background provisioning.',
);
assert.match(
  hookSource,
  /actionOptions\?\.showFailureToast !== false/,
  'The shared action must honor the command contract failure-toast control for background provisioning.',
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
