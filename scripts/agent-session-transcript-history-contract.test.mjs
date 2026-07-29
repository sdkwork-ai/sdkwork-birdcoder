import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

const chatSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx',
);
const progressiveWindowSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/useProgressiveTranscriptWindow.ts',
);
const codeSurfaceSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePageSurfaceProps.ts',
);
const editorPanelSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodeEditorWorkspacePanel.tsx',
);
const studioPageSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/StudioPage.tsx',
);
const studioSidebarSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/StudioChatSidebar.tsx',
);
const refreshHookSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useSessionRefreshActions.ts',
);

assert.match(
  chatSource,
  /hasMoreRemoteMessages\?: boolean;[\s\S]*isLoadingMoreRemoteMessages\?: boolean;[\s\S]*onLoadMoreRemoteMessages\?: \(\) => void \| Promise<void>;/,
  'UniversalChat must expose explicit remote transcript continuation state.',
);
assert.match(
  chatSource,
  /computeTranscriptRepairScrollTop\([\s\S]*pendingPrepend\.metrics[\s\S]*scrollContainer\.scrollHeight/,
  'Remote transcript prepends must preserve the visible scroll anchor.',
);
assert.match(
  chatSource,
  /const settleAnchor = \(\) => \{[\s\S]*isUserControllingScrollRef\.current[\s\S]*finishAnchorRepair\(\);[\s\S]*restoreTranscriptScrollAnchor/,
  'User scroll intent must cancel a pending remote prepend anchor repair.',
);
assert.match(
  chatSource,
  /interface RemoteMessageRequestState \{[\s\S]*isRequesting: boolean;[\s\S]*sessionId: string;[\s\S]*\}/,
  'Remote transcript request state must be scoped to the Session that started it.',
);
assert.match(
  chatSource,
  /previousState\.sessionId === sessionId[\s\S]*isRequesting: false[\s\S]*: previousState/,
  'A completed remote transcript request must not clear another Session request state.',
);
const sessionChangeEffect = chatSource.match(
  /useLayoutEffect\(\(\) => \{\s*pendingRemotePrependRef\.current = null;([\s\S]*?)\}, \[sessionId\]\);/,
);
assert.ok(
  sessionChangeEffect,
  'UniversalChat must reset the pending remote prepend anchor before layout repair when the Session changes.',
);
assert.doesNotMatch(
  sessionChangeEffect[1],
  /set[A-Z][A-Za-z0-9]*\(/,
  'The Session-change cleanup effect must not write React state and trigger an update loop.',
);
assert.match(
  chatSource,
  /pendingPrepend\.sessionId !== sessionId[\s\S]*pendingRemotePrependRef\.current = null/,
  'A pending remote prepend anchor must never be applied to another Session.',
);
assert.match(
  chatSource,
  /pendingPrepend\.messageCount === messages\.length[\s\S]*pendingPrepend\.firstMessageId === firstMessageId[\s\S]*!isLoadingMoreRemoteMessages && !isRequestingRemoteMessages[\s\S]*pendingRemotePrependRef\.current = null/,
  'An empty or duplicate-only remote page must clear its pending prepend anchor after loading settles.',
);
assert.match(
  chatSource,
  /interface TranscriptDisclosureState \{[\s\S]*keys: ReadonlySet<string>;[\s\S]*sessionId: string;[\s\S]*\}/,
  'Transcript disclosure state must be scoped to the Session that owns it.',
);
assert.doesNotMatch(
  chatSource,
  /useEffect\(\(\) => \{\s*setTranscriptDisclosureState\([\s\S]*?\}, \[sessionId\]\);/,
  'Session changes must not reset transcript disclosure state through an effect.',
);
assert.match(
  chatSource,
  /interface QueuedTurnPresentationState \{[\s\S]*scopeKey: string;[\s\S]*\}/,
  'Queued turn presentation state must belong to a single Session scope.',
);
const queueScopeEffect = chatSource.match(
  /useEffect\(\(\) => \{\s*clearQueuedTurnDispatchSettlementTimer\(\);\s*queuedTurnFlushGateRef\.current = createWorkbenchAgentTurnInputQueueFlushGateState\(\);([\s\S]*?)\}, \[clearQueuedTurnDispatchSettlementTimer, normalizedQueueScopeKey\]\);/,
);
assert.ok(
  queueScopeEffect,
  'UniversalChat must reset queue refs when the Session queue scope changes.',
);
assert.doesNotMatch(
  queueScopeEffect[1],
  /set[A-Z][A-Za-z0-9]*\(/,
  'Session queue scope changes must not force a render through an effect.',
);
assert.match(
  chatSource,
  /interface SessionPromptHistoryState \{[\s\S]*scopeKey: string;[\s\S]*\}[\s\S]*interface SessionPromptNavigationState \{[\s\S]*scopeKey: string;[\s\S]*\}/,
  'Prompt history and keyboard navigation state must belong to a single Session scope.',
);
const promptHistoryHydrationEffect = chatSource.match(
  /useEffect\(\(\) => \{([\s\S]*?)if \(hydratedSessionPromptHistoryIdRef\.current === normalizedSessionStateScopeKey\)([\s\S]*?)\}, \[isActive, normalizedSessionStateScopeKey\]\);/,
);
assert.ok(
  promptHistoryHydrationEffect,
  'UniversalChat must hydrate prompt history when the active Session scope changes.',
);
assert.doesNotMatch(
  promptHistoryHydrationEffect[2],
  /setHistoryIndex|setTempInput|syncHistoryPrompts\(\[\]\)/,
  'Prompt history hydration must not reset Session state through immediate effect updates.',
);
assert.match(
  chatSource,
  /!hasEarlierMessages && hasMoreRemoteMessages[\s\S]*chat\.loadEarlierMessages/,
  'The server continuation control must appear only after locally loaded messages are visible.',
);
assert.doesNotMatch(
  progressiveWindowSource,
  /transcriptIdentity\s*=\s*`\$\{normalizedTranscriptScopeKey\}\\u0001\$\{firstMessageId\}`/,
  'Prepending a server page must not reset the local transcript window as though a new Session opened.',
);
assert.match(
  progressiveWindowSource,
  /interface ProgressiveTranscriptWindowState \{[\s\S]*transcriptIdentity: string;[\s\S]*\}/,
  'Progressive transcript window state must belong to a single Session scope.',
);
assert.doesNotMatch(
  progressiveWindowSource,
  /useEffect\(\(\) => \{[\s\S]*previousTranscriptIdentityRef[\s\S]*set(?:IsLoadingEarlierMessages|VisibleTranscriptStartIndex)/,
  'Session identity changes must not synchronize transcript window state through an effect.',
);
assert.match(
  codeSurfaceSource,
  /const mainChatProps[\s\S]*hasMoreRemoteMessages,[\s\S]*isLoadingMoreRemoteMessages,[\s\S]*onLoadMoreRemoteMessages,/,
  'The main coding chat must receive server transcript continuation props.',
);
assert.match(
  codeSurfaceSource,
  /const workspaceProps[\s\S]*hasMoreRemoteMessages,[\s\S]*isLoadingMoreRemoteMessages,[\s\S]*onLoadMoreRemoteMessages,/,
  'The editor workspace chat must receive the same server transcript continuation props.',
);
assert.match(
  editorPanelSource,
  /<DeferredUniversalChat[\s\S]*hasMoreRemoteMessages=\{hasMoreRemoteMessages\}[\s\S]*isLoadingMoreRemoteMessages=\{isLoadingMoreRemoteMessages\}[\s\S]*onLoadMoreRemoteMessages=\{onLoadMoreRemoteMessages\}/,
  'The editor sidebar must forward all transcript continuation props to UniversalChat.',
);
assert.match(
  studioPageSource,
  /handleLoadEarlierSelectedAgentSessionItems[\s\S]*hasMoreRemoteMessages=\{Boolean\(selectedSession\?\.itemPageInfo\?\.hasMore\)\}[\s\S]*isLoadingMoreRemoteMessages=\{isLoadingEarlierSelectedAgentSessionItems\}[\s\S]*onLoadMoreRemoteMessages=\{handleLoadEarlierSelectedAgentSessionItems\}/,
  'Studio must expose canonical Session history continuation state and action to its chat sidebar.',
);
assert.match(
  studioSidebarSource,
  /<DeferredUniversalChat[\s\S]*hasMoreRemoteMessages=\{hasMoreRemoteMessages\}[\s\S]*isLoadingMoreRemoteMessages=\{isLoadingMoreRemoteMessages\}[\s\S]*onLoadMoreRemoteMessages=\{onLoadMoreRemoteMessages\}/,
  'Studio chat must forward all transcript continuation props to UniversalChat.',
);
assert.match(
  refreshHookSource,
  /const cancelActiveEarlierItemsRequest = useCallback\(\(\) => \{[\s\S]*activeEarlierItemsRequestRef\.current = null;[\s\S]*activeRequest\?\.controller\.abort[\s\S]*setLoadingEarlierAgentSessionScope\(null\);/,
  'Transcript continuation cancellation must abort superseded work and clear its visible loading state.',
);
assert.match(
  refreshHookSource,
  /activeRequest\?\.scopeKey === scopeKey[\s\S]*return activeRequest\.promise;[\s\S]*cancelActiveEarlierItemsRequest\(\);/,
  'Transcript continuation requests must deduplicate by Session scope and cancel a different active scope.',
);
assert.doesNotMatch(
  chatSource,
  /fetch\(|axios\.|Authorization|Access-Token/,
  'UniversalChat must not bypass the injected Agents SDK service path.',
);

console.log('agent session transcript history contract passed.');
