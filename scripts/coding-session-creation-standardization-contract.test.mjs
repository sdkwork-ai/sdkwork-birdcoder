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
  /export interface WorkbenchCodingSessionSelectionContext \{[\s\S]*projectId: string;[\s\S]*requestedEngineId\?: string;[\s\S]*title\?: string;[\s\S]*\}/,
  'Workbench coding session creation utilities must expose a typed created-session selection context for guarding stale async selection.',
);

assert.match(
  codingSessionCreationSource,
  /export type ShouldSelectWorkbenchCodingSession = \([\s\S]*codingSession: BirdCoderCodingSession,[\s\S]*context: WorkbenchCodingSessionSelectionContext,[\s\S]*\) => boolean;/,
  'Workbench coding session creation utilities must expose a shared created-session selection guard type.',
);

assert.match(
  codingSessionCreationSource,
  /shouldSelectCreatedSession\?: ShouldSelectWorkbenchCodingSession;/,
  'createWorkbenchCodingSessionInProject must accept an optional selection guard.',
);

assert.match(
  codingSessionCreationSource,
  /if \(shouldSelectCreatedSession\?\.\(newSession, selectionContext\) !== false\) \{/,
  'createWorkbenchCodingSessionInProject must skip selecting the created session when the optional selection guard returns false.',
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
  codingSessionActionsSource,
  /type CreateCodingSessionInProjectAction = \([\s\S]*projectId: string,[\s\S]*requestedEngineId\?: string,[\s\S]*\) => Promise<unknown> \| unknown;[\s\S]*createCodingSessionInProject\?: CreateCodingSessionInProjectAction;/,
  'useCodingSessionActions must allow surfaces to provide their page-level create-session callback so event-driven creation cannot bypass UI orchestration.',
);

assert.match(
  codingSessionActionsSource,
  /const createCodingSessionInProjectRef = useRef\(createCodingSessionInProject\);/,
  'useCodingSessionActions must keep the page-level create-session callback in a ref for stable global event listeners.',
);

assert.match(
  codingSessionActionsSource,
  /if \(createCodingSessionInProjectRef\.current\) \{[\s\S]*await createCodingSessionInProjectRef\.current\(targetProjectId, request\?\.engineId\);[\s\S]*return;[\s\S]*\}/s,
  'useCodingSessionActions must prefer the page-level create-session callback before falling back to the low-level helper.',
);

assert.match(
  `${codePageSource}\n${studioPageSource}`,
  /useWorkbenchCodingSessionCreationActions\(/,
  'Workbench surfaces must delegate UI-facing session creation orchestration through the shared useWorkbenchCodingSessionCreationActions hook instead of each page rebuilding success toasts, missing-project guards, and request routing.',
);

assert.match(
  codePageSource,
  /useCodingSessionActions\([\s\S]*createCodingSessionInProject:\s*createCodingSessionInProjectWithTranscriptReset/s,
  'CodePage create-session event listeners must route through the same transcript-reset callback as its visible new-session controls.',
);

assert.match(
  studioPageSource,
  /useCodingSessionActions\([\s\S]*(?:createCodingSessionInProject:\s*createCodingSessionInProject|createCodingSessionInProject,)/s,
  'StudioPage create-session event listeners must route through the shared UI-facing creation action so success, failure, and selection behavior stay standardized.',
);

assert.doesNotMatch(
  `${codePageSource}\n${studioPageSource}`,
  /setTimeout\(\(\) => \{\s*globalEventBus\.emit\('focusChatInput'\);\s*\}, 100\);/s,
  'CodePage and StudioPage must not inline delayed focusChatInput dispatch once the shared coding session creation helper owns that behavior.',
);

console.log('coding session creation standardization contract passed.');
