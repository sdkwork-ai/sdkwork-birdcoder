import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const codePageSource = fs.readFileSync(
  path.join(rootDir, 'packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx'),
  'utf8',
);
const requestStateHookSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages/sdkwork-birdcoder-code/src/pages/useCodeNewCodingSessionRequestState.ts',
  ),
  'utf8',
);
const surfacePropsSource = fs.readFileSync(
  path.join(rootDir, 'packages/sdkwork-birdcoder-code/src/pages/useCodePageSurfaceProps.ts'),
  'utf8',
);
const engineSelectionCallStart = codePageSource.indexOf('useCodingSessionEngineModelSelection({');
assert.notEqual(
  engineSelectionCallStart,
  -1,
  'CodePage must call useCodingSessionEngineModelSelection.',
);
const engineSelectionCallEnd = codePageSource.indexOf('});', engineSelectionCallStart);
assert.notEqual(
  engineSelectionCallEnd,
  -1,
  'CodePage useCodingSessionEngineModelSelection call must be syntactically closed.',
);
const engineSelectionCallSource = codePageSource.slice(
  engineSelectionCallStart,
  engineSelectionCallEnd,
);

assert.match(
  codePageSource,
  /useCodeNewCodingSessionRequestState\(\)/,
  'CodePage must delegate the pending new-session request state machine into a focused hook so the page stays below its componentization size budget.',
);

assert.match(
  requestStateHookSource,
  /interface PendingNewCodingSessionRequest \{[\s\S]*requestId: number;[\s\S]*projectId: string;[\s\S]*\}/,
  'The new-session request state hook must model new-session creation as an explicit pending selection request instead of leaving the old transcript visually active.',
);

assert.match(
  requestStateHookSource,
  /const \[pendingNewCodingSessionRequest,\s*setPendingNewCodingSessionRequest\]\s*=\s*useState<PendingNewCodingSessionRequest \| null>\(null\);/,
  'The new-session request state hook must track when a new session is being created so the chat can reset immediately.',
);

assert.match(
  requestStateHookSource,
  /const pendingNewCodingSessionRequestRef = useRef<PendingNewCodingSessionRequest \| null>\(null\);/,
  'The new-session request state hook must keep a ref for the pending request so asynchronous creation completion cannot select a stale request after user navigation.',
);

assert.match(
  requestStateHookSource,
  /const clearPendingNewCodingSessionRequest = useCallback\(\(requestId\?: number\) =>[\s\S]*pendingNewCodingSessionRequestRef\.current = null;[\s\S]*setPendingNewCodingSessionRequest\(\(previousRequest\) =>[\s\S]*requestId !== undefined && previousRequest\?\.requestId !== requestId[\s\S]*\? previousRequest[\s\S]*: null,[\s\S]*\);/s,
  'The new-session request state hook must clear both the pending request ref and visible state so user navigation cancels stale asynchronous new-session selection.',
);

assert.match(
  requestStateHookSource,
  /const beginPendingNewCodingSessionRequest = useCallback\(\(projectId: string\) =>[\s\S]*pendingNewCodingSessionRequestRef\.current = pendingRequest;[\s\S]*setPendingNewCodingSessionRequest\(pendingRequest\);[\s\S]*return pendingRequest;/s,
  'The new-session request state hook must record each pending request in state and a ref with a unique request id before awaiting creation.',
);

assert.match(
  codePageSource,
  /const createCodingSessionWithTranscriptReset = useCallback\([\s\S]*const pendingRequest = beginPendingNewCodingSessionRequest\(normalizedProjectId\);[\s\S]*await createCodingSessionInProject\(normalizedProjectId, requestedEngineId, \{[\s\S]*shouldSelectCreatedSession:[\s\S]*activePendingRequest\?\.requestId === pendingRequest\.requestId[\s\S]*activePendingRequest\.projectId === selectionContext\.projectId[\s\S]*\}\);[\s\S]*clearPendingNewCodingSessionRequest\(pendingRequest\.requestId\);/s,
  'CodePage must only allow asynchronous new-session creation to select the created session while the matching pending request is still active.',
);

assert.match(
  codePageSource,
  /const createCodingSessionFromCurrentProjectWithTranscriptReset = useCallback\(async \([\s\S]*requestedEngineId\?: string,[\s\S]*requestedModelId\?: string,[\s\S]*\) => \{[\s\S]*await createCodingSessionWithTranscriptReset\([\s\S]*currentProjectId,[\s\S]*requestedEngineId,[\s\S]*requestedModelId,[\s\S]*\);[\s\S]*\}/s,
  'CodePage current-project new-session action must remain awaitable and preserve the requested engine/model so event-driven callers can observe the whole pending lifecycle.',
);

assert.match(
  codePageSource,
  /const createCodingSessionInProjectWithTranscriptReset = useCallback\(async \([\s\S]*projectId: string,[\s\S]*requestedEngineId\?: string,[\s\S]*requestedModelId\?: string,[\s\S]*\) => \{[\s\S]*await createCodingSessionWithTranscriptReset\([\s\S]*projectId,[\s\S]*requestedEngineId,[\s\S]*requestedModelId,[\s\S]*\);[\s\S]*\}/s,
  'CodePage project-scoped new-session action must remain awaitable and preserve the requested engine/model so global create-session events do not detach from page-level UI orchestration.',
);

assert.match(
  codePageSource,
  /useCodingSessionActions\([\s\S]*\{\s*isActive:\s*isVisible,\s*createCodingSessionInProject:\s*createCodingSessionInProjectWithTranscriptReset,\s*\}/s,
  'CodePage global create-session events must use the same transcript-reset creation callback as visible new-session controls.',
);

assert.match(
  codePageSource,
  /const selectSession = useCallback\([\s\S]*if \(!normalizedCodingSessionId\) \{[\s\S]*return;[\s\S]*\}\s*clearPendingNewCodingSessionRequest\(\);[\s\S]*if \([\s\S]*normalizedCodingSessionId ===[\s\S]*setSelectionRefreshToken/s,
  'CodePage must treat every explicit session selection, including selecting the already-active session, as user navigation that cancels any pending new-session visual request.',
);

assert.match(
  codePageSource,
  /const handleProjectSelect = useCallback\(\(id: string \| null\) => \{[\s\S]*clearPendingNewCodingSessionRequest\(\);/s,
  'CodePage must treat explicit project selection as user navigation that cancels any pending new-session visual request.',
);

assert.match(
  codePageSource,
  /const handleSidebarCodingSessionSelect = useCallback\(\(nextCodingSessionId: string \| null\) => \{[\s\S]*clearPendingNewCodingSessionRequest\(\);/s,
  'CodePage must clear pending new-session state when the user clears or changes the sidebar session selection.',
);

assert.match(
  codePageSource,
  /const visibleSessionId = isNewCodingSessionCreating \? null : sessionId;/,
  'CodePage must expose no visible session id while a new session is being created, so UniversalChat cannot bind to the previous session draft or transcript.',
);

assert.match(
  codePageSource,
  /const selectedCodingSession = isNewCodingSessionCreating \? null : session;/,
  'CodePage must hide the previous selected session object from chat props during new-session creation.',
);

assert.match(
  codePageSource,
  /const selectedCodingSessionMessages = useMemo\(\s*\(\) => \(isNewCodingSessionCreating \? \[\] : selectedCodingSession\?\.messages \?\? \[\]\),\s*\[isNewCodingSessionCreating,\s*selectedCodingSession\?\.messages\],\s*\);/s,
  'CodePage must render an empty transcript while the new session request is pending, never the previous session messages.',
);

assert.match(
  codePageSource,
  /const isSelectedCodingSessionHydrating = Boolean\(\s*isNewCodingSessionCreating \|\|[\s\S]*visibleSessionId[\s\S]*isSelectedCodingSessionMessagesLoading[\s\S]*selectedCodingSessionMessages\.length === 0/s,
  'CodePage must immediately show the transcript loading state while a new session is being created and keep using it for empty selected-session hydration.',
);

assert.match(
  codePageSource,
  /sessionId:\s*visibleSessionId,/,
  'CodePage must pass the visible session id into surface props so pending new-session creation does not leak the previous session into the chat UI.',
);

assert.match(
  codePageSource,
  /showComposerEngineSelector:\s*!visibleSessionId,/,
  'CodePage must derive composer engine selector visibility from the visible session id after pending new-session masking.',
);

assert.match(
  engineSelectionCallSource,
  /sessionId:\s*visibleSessionId,/,
  'CodePage engine/model selection must be bound to the visible session id so pending new-session creation behaves like an empty composer, not the previous session.',
);

assert.match(
  surfacePropsSource,
  /sessionId: activeTab === 'ai' \? \(sessionId \|\| undefined\) : undefined,/,
  'CodePage surface props must use the already-masked visible session id when binding the main chat surface.',
);

console.log('code new session transcript reset contract passed.');
