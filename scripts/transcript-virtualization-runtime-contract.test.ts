import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type {
  BirdCoderChatMessage,
  CommandExecution,
} from '@sdkwork/birdcoder-pc-contracts-commons';

const modulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/transcriptVirtualization.ts',
  import.meta.url,
);

const {
  buildTranscriptPrefixHeights,
  reconcileTranscriptPrefixHeightsCache,
  resolveTranscriptMessageKey,
  resolveVirtualizedTranscriptWindow,
} = await import(`${modulePath.href}?t=${Date.now()}`);
const commandLifecycleModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/activity/chatCommandLifecycle.ts',
  import.meta.url,
);
const {
  buildChatCommandLifecycleSnapshot,
  resolveChatCommandLiveAnnouncement,
} = await import(`${commandLifecycleModulePath.href}?t=${Date.now()}`);

const virtualizationSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/useVirtualizedTranscriptWindow.ts',
    import.meta.url,
  ),
  'utf8',
);
const transcriptVirtualizationSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/transcriptVirtualization.ts',
    import.meta.url,
  ),
  'utf8',
);
const activitySummarySource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/activity/ChatActivitySummary.tsx',
    import.meta.url,
  ),
  'utf8',
);
const contentBlockRenderersSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentBlocks/ContentBlockRenderers.tsx',
    import.meta.url,
  ),
  'utf8',
);
const universalChatSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx',
    import.meta.url,
  ),
  'utf8',
);

const messages: BirdCoderChatMessage[] = [
  {
    codingSessionId: 'session-1',
    id: 'user-1',
    role: 'user',
    content: 'hello',
    createdAt: '2026-04-21T00:00:00.000Z',
  },
  {
    codingSessionId: 'session-1',
    id: 'assistant-1',
    role: 'assistant',
    content: 'reply',
    createdAt: '2026-04-21T00:00:01.000Z',
  },
];
const assistantMessageKey = resolveTranscriptMessageKey(messages[1], 1);

const prefixHeights = buildTranscriptPrefixHeights(
  messages,
  new Map<string, number>([[assistantMessageKey, 400]]),
);

assert.deepEqual(
  prefixHeights,
  [0, 116, 516],
  'transcript height prefixes should respect measured heights without recalculating visible scroll state',
);

const windowedTranscript = resolveVirtualizedTranscriptWindow({
  isActive: true,
  messages,
  minVirtualizedMessageCount: 0,
  overscanPx: 0,
  prefixHeights,
  viewport: {
    clientHeight: 120,
    scrollTop: 380,
  },
});

assert.equal(windowedTranscript.visibleStartIndex, 1);
assert.deepEqual(
  windowedTranscript.visibleMessages.map((message: BirdCoderChatMessage) => message.id),
  ['assistant-1'],
  'scroll windowing should slice against precomputed height prefixes',
);
assert.equal(windowedTranscript.paddingTop, 116);
assert.equal(windowedTranscript.paddingBottom, 0);

const initialPrefixCache = reconcileTranscriptPrefixHeightsCache({
  measuredHeights: new Map<string, number>(),
  messages,
});
const updatedPrefixCache = reconcileTranscriptPrefixHeightsCache({
  invalidatedMessageIds: [assistantMessageKey],
  measuredHeights: new Map<string, number>([[assistantMessageKey, 400]]),
  messages,
  previousCache: initialPrefixCache,
});

assert.equal(
  updatedPrefixCache.entries[0],
  initialPrefixCache.entries[0],
  'transcript prefix cache should preserve unchanged prefix entries when only a later row measurement changes.',
);

const duplicateIdMessages: BirdCoderChatMessage[] = [
  {
    codingSessionId: 'session-duplicates',
    id: 'provider-message',
    role: 'user',
    content: 'short duplicate id message',
    createdAt: '2026-04-21T00:00:00.000Z',
  },
  {
    codingSessionId: 'session-duplicates',
    id: 'provider-message',
    role: 'assistant',
    content: 'longer duplicate id message\nwith multiple lines\nand a separate measured height',
    createdAt: '2026-04-21T00:00:01.000Z',
  },
];
const firstDuplicateKey = resolveTranscriptMessageKey(duplicateIdMessages[0], 0);
const secondDuplicateKey = resolveTranscriptMessageKey(duplicateIdMessages[1], 1);

assert.notEqual(
  firstDuplicateKey,
  secondDuplicateKey,
  'transcript virtualization must include row position in its measurement key so duplicate provider message ids cannot overwrite each other.',
);

assert.deepEqual(
  buildTranscriptPrefixHeights(
    duplicateIdMessages,
    new Map<string, number>([
      [firstDuplicateKey, 120],
      [secondDuplicateKey, 360],
    ]),
  ),
  [0, 120, 480],
  'duplicate provider message ids must keep independent measured heights so spacer padding remains accurate.',
);

const taskProgressMessages: BirdCoderChatMessage[] = [
  {
    codingSessionId: 'session-progress',
    id: 'assistant-progress',
    role: 'assistant',
    content: 'progress',
    taskProgress: {
      total: 4,
      completed: 2,
    },
    createdAt: '2026-04-21T00:00:02.000Z',
  },
];
assert.deepEqual(
  buildTranscriptPrefixHeights(taskProgressMessages, new Map<string, number>()),
  [0, 208],
  'transcript height estimates must reserve vertical space for taskProgress rows so virtualized engine sessions do not overlap progress UI.',
);

assert.match(
  virtualizationSource,
  /const prefixHeightsCacheRef = useRef<TranscriptPrefixHeightsCache \| null>\(null\);/,
  'useVirtualizedTranscriptWindow should keep a reusable transcript prefix-height cache ref.',
);

assert.match(
  virtualizationSource,
  /measurementScopeKey[\s\S]*measurementScopeKeyRef[\s\S]*resizeObserverRef\.current\?\.unobserve[\s\S]*observedElementsRef\.current\.clear\(\);[\s\S]*messageIdByElementRef\.current\.clear\(\);[\s\S]*messageRefCallbackMapRef\.current\.clear\(\);[\s\S]*measuredHeightsRef\.current\.clear\(\);[\s\S]*prefixHeightsCacheRef\.current = null;/s,
  'useVirtualizedTranscriptWindow must fully reset session-scoped measurement refs so reused row keys cannot carry DOM observation state across sessions.',
);

assert.match(
  virtualizationSource,
  /const didResetMeasurementScope = measurementScopeKeyRef\.current !== normalizedMeasurementScopeKey;/,
  'useVirtualizedTranscriptWindow must detect session-scope changes before resolving the visible window so stale scrollTop cannot create a first-frame blank spacer.',
);

assert.match(
  virtualizationSource,
  /const effectiveViewport = didResetMeasurementScope\s*\?\s*\{\s*clientHeight: viewport\.clientHeight,\s*scrollTop: 0,\s*\}\s*: viewport;/s,
  'useVirtualizedTranscriptWindow must clamp the first visible window after a session switch to scrollTop 0 instead of reusing the previous session scroll position.',
);

assert.match(
  virtualizationSource,
  /useLayoutEffect\(\(\) => \{[\s\S]*const scrollContainer = scrollContainerRef\.current;[\s\S]*scrollContainer\.scrollTop = 0;[\s\S]*\}, \[normalizedMeasurementScopeKey, scrollContainerRef\]\);/s,
  'useVirtualizedTranscriptWindow must reset the real transcript scroll container on scope changes so the next viewport publish cannot reintroduce the previous session scrollTop.',
);

assert.match(
  virtualizationSource,
  /viewport: effectiveViewport,/,
  'useVirtualizedTranscriptWindow must resolve the virtualized range from the session-reset viewport.',
);

assert.match(
  universalChatSource,
  /const messageMeasurementKey = resolveTranscriptMessageKey\(msg, messageIndex\);[\s\S]*const messageRenderKey = `\$\{sessionId\}\\u0001\$\{messageMeasurementKey\}`;[\s\S]*registerMessageElement\(messageMeasurementKey\);[\s\S]*messageRenderKey/s,
  'UniversalChat must include the visible session in React transcript row keys while keeping virtualization measurement keys row-scoped, so same-index same-id rows cannot reuse DOM across sessions.',
);

assert.match(
  universalChatSource,
  /sessionScopeKey\?: string;[\s\S]*const normalizedTranscriptScopeKey = sessionScopeKey\?\.trim\(\) \|\| normalizedSessionId;/s,
  'UniversalChat must accept a project/workspace-scoped transcript key so equal session ids from different projects do not reuse transcript virtualization state.',
);

assert.match(
  universalChatSource,
  /sessionId=\{normalizedTranscriptScopeKey\}/,
  'UniversalChat must pass the scoped transcript key into the transcript renderer instead of using the bare session id for row keys and measurement scope.',
);

assert.match(
  transcriptVirtualizationSource,
  /estimateTranscriptMessageHeight\(/,
  'transcript virtualization must estimate row heights from resolved chat message views instead of role-only heuristics.',
);

assert.match(
  virtualizationSource,
  /options: \{ layout, engineId \}/,
  'useVirtualizedTranscriptWindow must pass layout and engine context into transcript height reconciliation.',
);

assert.match(
  contentBlockRenderersSource,
  /<ChatTaskProgress taskProgress=\{block\.progress\} t=\{context\.environment\?\.t\} \/>/,
  'Task progress payloads must render through the shared ChatTaskProgress block renderer so cross-engine planner and reviewer progress survives all the way to the transcript UI.',
);

assert.match(
  activitySummarySource,
  /const commandKey = `\$\{cmdIdx\}\\u0001\$\{cmd\.toolCallId\?\.trim\(\) \|\| 'command'\}`;[\s\S]*renderCommandExecutionCard\(\{[\s\S]*commandKey,/,
  'Command cards must derive stable disclosure identity from row position and provider call id without mutable command text.',
);

assert.match(
  activitySummarySource,
  /function renderCommandExecutionCard\([\s\S]*<div key=\{commandKey\}/,
  'Command cards must apply the delegated command key to the helper root element.',
);

assert.doesNotMatch(
  activitySummarySource,
  /key=\{cmd\.toolCallId \?\?/,
  'Command cards must not use provider toolCallId alone as a React key because providers may repeat it across progress snapshots.',
);

assert.match(
  virtualizationSource,
  /const prefixHeightsCache = useMemo\(\s*\(\)\s*=>[\s\S]*reconcileTranscriptPrefixHeightsCache\(/s,
  'useVirtualizedTranscriptWindow should reconcile transcript height prefixes through the reusable cache helper.',
);

assert.match(
  virtualizationSource,
  /const windowedTranscript = useMemo\(\s*\(\)\s*=>\s*resolveVirtualizedTranscriptWindow\(/s,
  'useVirtualizedTranscriptWindow should resolve the visible range from the cached prefix heights',
);

assert.doesNotMatch(
  virtualizationSource,
  /const prefixHeights = useMemo\(\s*\(\)\s*=>\s*buildTranscriptPrefixHeights\(/s,
  'useVirtualizedTranscriptWindow must not rebuild full transcript height prefixes inline on every measurement update.',
);

const createAnnouncementCommand = (
  toolCallId: string,
  overrides: Partial<CommandExecution> = {},
): CommandExecution => ({
  command: `run ${toolCallId}`,
  status: 'running',
  toolCallId,
  ...overrides,
});
const createAnnouncementMessage = (
  id: string,
  commands: CommandExecution[],
): BirdCoderChatMessage => ({
  codingSessionId: 'session-announcements',
  commands,
  content: '',
  createdAt: '2026-07-21T00:00:00.000Z',
  id,
  role: 'assistant',
  turnId: 'turn-announcements',
});
const emptyCommandSnapshot = buildChatCommandLifecycleSnapshot([]);
const runningCommandSnapshot = buildChatCommandLifecycleSnapshot([
  createAnnouncementMessage('activity-running', [createAnnouncementCommand('call-1')]),
]);

const providerToolCallSnapshot = buildChatCommandLifecycleSnapshot([{
  codingSessionId: 'session-announcements',
  content: '',
  createdAt: '2026-07-21T00:00:00.000Z',
  id: 'activity-provider-tool-call',
  role: 'assistant',
  tool_calls: [{
    id: 'call-provider-command',
    name: 'bash',
    arguments: { command: 'pnpm test' },
    status: 'running',
  }],
  turnId: 'turn-announcements',
}], 'claude-code');
assert.deepEqual(
  resolveChatCommandLiveAnnouncement(emptyCommandSnapshot, providerToolCallSnapshot),
  { count: 1, kind: 'running' },
  'Provider command tool_calls must enter the single live announcer even when commands is absent.',
);

assert.deepEqual(
  resolveChatCommandLiveAnnouncement(emptyCommandSnapshot, runningCommandSnapshot),
  { count: 1, kind: 'running' },
  'a newly observed live command should publish one running announcement.',
);
assert.equal(
  resolveChatCommandLiveAnnouncement(runningCommandSnapshot, runningCommandSnapshot),
  null,
  'an unchanged command snapshot must stay quiet when transcript virtualization remounts a row.',
);

const equivalentRemountSnapshot = buildChatCommandLifecycleSnapshot([
  createAnnouncementMessage('activity-remounted', [createAnnouncementCommand('call-1')]),
]);
assert.equal(
  resolveChatCommandLiveAnnouncement(runningCommandSnapshot, equivalentRemountSnapshot),
  null,
  'moving the same provider call to a projected row in one turn must preserve announcement identity.',
);

const approvalCommandSnapshot = buildChatCommandLifecycleSnapshot([
  createAnnouncementMessage('activity-approval', [createAnnouncementCommand('call-1', {
    requiresApproval: true,
    runtimeStatus: 'awaiting_approval',
  })]),
]);
assert.deepEqual(
  resolveChatCommandLiveAnnouncement(runningCommandSnapshot, approvalCommandSnapshot),
  { count: 1, kind: 'approval' },
  'a running command that starts waiting for approval should announce the actionable transition once.',
);

const mixedWaitingCommandSnapshot = buildChatCommandLifecycleSnapshot([
  createAnnouncementMessage('activity-waiting', [
    createAnnouncementCommand('call-1', {
      requiresApproval: true,
      runtimeStatus: 'awaiting_approval',
    }),
    createAnnouncementCommand('call-2', {
      kind: 'user_question',
      requiresReply: true,
      runtimeStatus: 'awaiting_user',
    }),
  ]),
]);
assert.deepEqual(
  resolveChatCommandLiveAnnouncement(runningCommandSnapshot, mixedWaitingCommandSnapshot),
  { count: 2, kind: 'waiting' },
  'mixed approval and reply transitions should collapse into one bounded waiting announcement.',
);

const settledCommandSnapshot = buildChatCommandLifecycleSnapshot([
  createAnnouncementMessage('activity-settled', [
    createAnnouncementCommand('call-1', { status: 'success' }),
  ]),
]);
assert.equal(
  resolveChatCommandLiveAnnouncement(runningCommandSnapshot, settledCommandSnapshot),
  null,
  'settled historical command states should remain quiet like the prior inline status policy.',
);

console.log('transcript virtualization runtime contract passed.');
