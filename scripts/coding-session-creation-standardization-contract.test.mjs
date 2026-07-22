import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const codingSessionCreationSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-workbench',
  'src',
  'workbench',
  'codingSessionCreation.ts',
);
const codingSessionActionsSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-workbench',
  'src',
  'hooks',
  'useCodingSessionActions.ts',
);
const projectsHookSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-workbench',
  'src',
  'hooks',
  'useProjects.ts',
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
  projectsHookSource,
  /const runtimeLocationId = await resolveProjectRuntimeLocationExecutionId\([\s\S]*projectId,[\s\S]*'terminal',[\s\S]*\{ allowFolderSelection: true \},[\s\S]*\);/,
  'the central UI session-creation flow must delegate local/remote topology and terminal authorization to the injected runtime-location execution resolver.',
);

assert.match(
  projectsHookSource,
  /projectService\.createCodingSession\(projectId, title, \{[\s\S]*runtimeLocationId,[\s\S]*\}\)/,
  'the central UI session-creation flow must forward only the resolved opaque runtimeLocationId to the project service.',
);

assert.doesNotMatch(
  projectsHookSource,
  /createCodingSession\([\s\S]{0,500}(?:localWorkingDirectory|process\.cwd|projectRoot|rootPath)/,
  'coding-session creation must not derive execution authority from a local path or process CWD.',
);

assert.match(
  codingSessionActionsSource,
  /type CreateCodingSessionFromRequestAction = \([\s\S]*request: CreateNewCodingSessionRequest[\s\S]*\) => Promise<unknown> \| unknown;[\s\S]*createCodingSessionFromRequest\?: CreateCodingSessionFromRequestAction;/,
  'useCodingSessionActions must preserve the typed request when delegating event-driven creation into page-level orchestration.',
);

assert.match(
  codingSessionActionsSource,
  /const createCodingSessionFromRequestRef = useRef\(createCodingSessionFromRequest\);/,
  'useCodingSessionActions must keep the page-level create-session callback in a ref for stable global event listeners.',
);

assert.match(
  codingSessionActionsSource,
  /if \(createCodingSessionFromRequestRef\.current\) \{[\s\S]*await createCodingSessionFromRequestRef\.current\(\{[\s\S]*\.\.\.request,[\s\S]*\.\.\.\(targetProjectId \? \{ projectId: targetProjectId \} : \{\}\),[\s\S]*source: request\?\.source \?\? 'global-event',[\s\S]*\}\);[\s\S]*return;[\s\S]*\}[\s\S]*if \(!targetProjectId\) \{/s,
  'useCodingSessionActions must prefer the page-level create-session callback and preserve engine/model selection before falling back to the low-level helper.',
);

assert.match(
  codingSessionActionsSource,
  /createWorkbenchCodingSessionInProject\(\{[\s\S]*title: request\?\.title,/s,
  'The compatibility fallback must preserve a requested session title.',
);

assert.match(
  `${codePageSource}\n${studioPageSource}`,
  /useWorkbenchCodingSessionCreationActions\(/,
  'Workbench surfaces must delegate UI-facing session creation orchestration through the shared useWorkbenchCodingSessionCreationActions hook instead of each page rebuilding success toasts, missing-project guards, and request routing.',
);

assert.match(
  codePageSource,
  /useCodingSessionActions\([\s\S]*createCodingSessionFromRequest:\s*createCodingSessionWithTranscriptReset/s,
  'CodePage create-session event listeners must route through the same transcript-reset callback as its visible new-session controls.',
);

assert.match(
  studioPageSource,
  /const createStudioCodingSessionInProject = useCallback\([\s\S]*createCodingSessionInProject\(projectId, engineId, \{ modelId, source: 'studio' \}\)/s,
  'StudioPage must preserve engine and model selection when adapting the shared UI-facing creation action.',
);

assert.match(
  studioPageSource,
  /useCodingSessionActions\([\s\S]*createCodingSessionFromRequest,/s,
  'StudioPage create-session event listeners must route through the shared UI-facing creation action so success, failure, and selection behavior stay standardized.',
);

assert.doesNotMatch(
  `${codePageSource}\n${studioPageSource}`,
  /setTimeout\(\(\) => \{\s*globalEventBus\.emit\('focusChatInput'\);\s*\}, 100\);/s,
  'CodePage and StudioPage must not inline delayed focusChatInput dispatch once the shared coding session creation helper owns that behavior.',
);

console.log('coding session creation standardization contract passed.');
