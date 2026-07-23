import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const codePageSource = fs.readFileSync(
  path.join(rootDir, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePage.tsx'),
  'utf8',
);
const requestStateHookSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeNewAgentSessionRequestState.ts',
  ),
  'utf8',
);
const surfacePropsSource = fs.readFileSync(
  path.join(rootDir, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePageSurfaceProps.ts'),
  'utf8',
);
const sessionSelectionHookSource = fs.readFileSync(
  path.join(rootDir, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePageSessionSelection.ts'),
  'utf8',
);
const engineSelectionCallStart = codePageSource.indexOf('useAgentSessionEngineModelSelection({');
assert.notEqual(
  engineSelectionCallStart,
  -1,
  'CodePage must call useAgentSessionEngineModelSelection.',
);
const engineSelectionCallEnd = codePageSource.indexOf('});', engineSelectionCallStart);
assert.notEqual(
  engineSelectionCallEnd,
  -1,
  'CodePage useAgentSessionEngineModelSelection call must be syntactically closed.',
);
const engineSelectionCallSource = codePageSource.slice(
  engineSelectionCallStart,
  engineSelectionCallEnd,
);

assert.match(
  codePageSource,
  /useCodeNewAgentSessionRequestState\(\)/,
  'CodePage must delegate the pending new-session request state machine into a focused hook so the page stays below its componentization size budget.',
);

assert.match(
  requestStateHookSource,
  /interface PendingNewAgentSessionRequest \{[\s\S]*requestId: number;[\s\S]*projectId: string;[\s\S]*\}/,
  'The new-session request state hook must model new-session creation as an explicit pending selection request instead of leaving the old transcript visually active.',
);

assert.match(
  requestStateHookSource,
  /const \[pendingNewAgentSessionRequest,\s*setPendingNewAgentSessionRequest\]\s*=\s*useState<PendingNewAgentSessionRequest \| null>\(null\);/,
  'The new-session request state hook must track when a new session is being created so the chat can reset immediately.',
);

assert.match(
  requestStateHookSource,
  /const pendingNewAgentSessionRequestRef = useRef<PendingNewAgentSessionRequest \| null>\(null\);/,
  'The new-session request state hook must keep a ref for the pending request so asynchronous creation completion cannot select a stale request after user navigation.',
);

assert.match(
  requestStateHookSource,
  /const clearPendingNewAgentSessionRequest = useCallback\(\(requestId\?: number\) =>[\s\S]*pendingNewAgentSessionRequestRef\.current = null;[\s\S]*setPendingNewAgentSessionRequest\(\(previousRequest\) =>[\s\S]*requestId !== undefined && previousRequest\?\.requestId !== requestId[\s\S]*\? previousRequest[\s\S]*: null,[\s\S]*\);/s,
  'The new-session request state hook must clear both the pending request ref and visible state so user navigation cancels stale asynchronous new-session selection.',
);

assert.match(
  requestStateHookSource,
  /const beginPendingNewAgentSessionRequest = useCallback\(\(projectId: string\) =>[\s\S]*pendingNewAgentSessionRequestRef\.current = pendingRequest;[\s\S]*setPendingNewAgentSessionRequest\(pendingRequest\);[\s\S]*return pendingRequest;/s,
  'The new-session request state hook must record each pending request in state and a ref with a unique request id before awaiting creation.',
);

assert.match(
  codePageSource,
  /const createAgentSessionWithTranscriptReset = useCallback\([\s\S]*const pendingRequest = beginPendingNewAgentSessionRequest\(normalizedProjectId\);[\s\S]*await createAgentSessionFromRequest\(\{[\s\S]*\.\.\.request,[\s\S]*projectId: normalizedProjectId,[\s\S]*\}, \{[\s\S]*shouldSelectCreatedSession:[\s\S]*activePendingRequest\?\.requestId === pendingRequest\.requestId[\s\S]*activePendingRequest\.projectId === selectionContext\.projectId[\s\S]*\}\);[\s\S]*clearPendingNewAgentSessionRequest\(pendingRequest\.requestId\);/s,
  'CodePage must only allow asynchronous new-session creation to select the created session while the matching pending request is still active.',
);

assert.doesNotMatch(
  codePageSource,
  /createAgentSessionFromCurrentProjectWithTranscriptReset/u,
  'CodePage must not retain a second current-project transcript-reset wrapper when project-scoped UI and event callers share one callback.',
);

assert.match(
  codePageSource,
  /const createAgentSessionInProjectWithTranscriptReset = useCallback\(async \([\s\S]*projectId: string,[\s\S]*requestedEngineId\?: string,[\s\S]*requestedModelId\?: string,[\s\S]*\) => \{[\s\S]*await createAgentSessionWithTranscriptReset\(\{[\s\S]*engineId: requestedEngineId,[\s\S]*modelId: requestedModelId,[\s\S]*projectId,[\s\S]*source: 'code-sidebar',[\s\S]*\}\);[\s\S]*\}/s,
  'CodePage project-scoped new-session action must remain awaitable and preserve the requested engine/model so global create-session events do not detach from page-level UI orchestration.',
);

assert.match(
  codePageSource,
  /useAgentSessionActions\([\s\S]*\{\s*isActive:\s*isVisible,\s*createAgentSessionFromRequest:\s*createAgentSessionWithTranscriptReset,\s*\}/s,
  'CodePage global create-session events must use the same transcript-reset creation callback as visible new-session controls.',
);

assert.match(
  codePageSource,
  /onNewAgentSessionInProject: createAgentSessionInProjectWithTranscriptReset/u,
  'CodePage visible new-session controls must use the same project-scoped transcript-reset callback as global events.',
);

assert.match(
  sessionSelectionHookSource,
  /const selectSession = useCallback\([\s\S]*if \(!normalizedAgentSessionId\) \{[\s\S]*return;[\s\S]*\}\s*clearPendingNewAgentSessionRequest\(\);[\s\S]*if \([\s\S]*normalizedAgentSessionId ===[\s\S]*setSelectionRefreshToken/s,
  'CodePage session-selection hook must treat every explicit session selection, including selecting the already-active session, as user navigation that cancels any pending new-session visual request.',
);

assert.match(
  sessionSelectionHookSource,
  /const handleProjectSelect = useCallback\(\(id: string \| null\) => \{[\s\S]*clearPendingNewAgentSessionRequest\(\);/s,
  'CodePage session-selection hook must treat explicit project selection as user navigation that cancels any pending new-session visual request.',
);

assert.match(
  sessionSelectionHookSource,
  /const handleSidebarAgentSessionSelect = useCallback\(\([\s\S]*nextAgentSessionId: string \| null[\s\S]*\) => \{[\s\S]*clearPendingNewAgentSessionRequest\(\);/s,
  'CodePage session-selection hook must clear pending new-session state when the user clears or changes the sidebar session selection.',
);

assert.match(
  codePageSource,
  /const visibleSessionId = isNewAgentSessionCreating \? null : sessionId;/,
  'CodePage must expose no visible session id while a new session is being created, so UniversalChat cannot bind to the previous session draft or transcript.',
);

assert.match(
  codePageSource,
  /const selectedAgentSession = isNewAgentSessionCreating \? null : session;/,
  'CodePage must hide the previous selected session object from chat props during new-session creation.',
);

assert.match(
  codePageSource,
  /const selectedAgentSessionItems = useMemo\(\s*\(\) => \(isNewAgentSessionCreating \? \[\] : selectedAgentSession\?\.messages \?\? \[\]\),\s*\[isNewAgentSessionCreating,\s*selectedAgentSession\?\.messages\],\s*\);/s,
  'CodePage must render an empty transcript while the new session request is pending, never the previous session messages.',
);

assert.match(
  codePageSource,
  /const isSelectedAgentSessionHydrating = Boolean\(\s*isNewAgentSessionCreating \|\|[\s\S]*visibleSessionId[\s\S]*isSelectedAgentSessionItemsLoading[\s\S]*selectedAgentSessionItems\.length === 0/s,
  'CodePage must immediately show the transcript loading state while a new session is being created and keep using it for empty selected-session hydration.',
);

assert.match(
  codePageSource,
  /sessionId:\s*visibleSessionId,/,
  'CodePage must pass the visible session id into surface props so pending new-session creation does not leak the previous session into the chat UI.',
);

assert.match(
  codePageSource,
  /showComposerEngineSelector:\s*true,/,
  'CodePage must keep per-turn composer model selection available for both new and existing sessions.',
);

assert.match(
  engineSelectionCallSource,
  /sessionId:\s*visibleSessionId,/,
  'CodePage engine/model selection must be bound to the visible session id so pending new-session creation behaves like an empty composer, not the previous session.',
);

assert.match(
  surfacePropsSource,
  /const mainChatProps = useMemo<UniversalChatComponentProps>\(\(\) => \(\{[\s\S]*sessionId: sessionId \|\| undefined,/s,
  'CodePage surface props must use the already-masked visible session id when binding the main chat surface.',
);

console.log('code new session transcript reset contract passed.');
