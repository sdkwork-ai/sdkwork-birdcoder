import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type {
  AgentSessionItemView,
  CommandExecution,
} from '@sdkwork/birdcoder-pc-contracts-commons';

const modulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/transcriptVirtualization.ts',
  import.meta.url,
);

const {
  buildTranscriptPrefixHeights,
  reconcileTranscriptPrefixHeightsCache,
  resolveMeasurementScopeTranscriptViewport,
  resolvePrependAdjustedTranscriptViewport,
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
const commandActivityListSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/activity/ChatCommandActivityList.tsx',
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
const transcriptScrollCoordinatorSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/useTranscriptScrollCoordinator.ts',
    import.meta.url,
  ),
  'utf8',
);

const messages: AgentSessionItemView[] = [
  {
    agentSessionId: 'session-1',
    id: 'user-1',
    role: 'user',
    content: 'hello',
    createdAt: '2026-04-21T00:00:00.000Z',
  },
  {
    agentSessionId: 'session-1',
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
  windowedTranscript.visibleMessages.map((message: AgentSessionItemView) => message.id),
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

const prependedMessages: AgentSessionItemView[] = [
  {
    agentSessionId: 'session-1',
    id: 'user-older',
    role: 'user',
    content: 'older history',
    createdAt: '2026-04-20T23:59:59.000Z',
  },
  ...messages,
];
const shiftedAssistantMessageKey = resolveTranscriptMessageKey(prependedMessages[2], 2);
assert.equal(
  shiftedAssistantMessageKey,
  assistantMessageKey,
  'prepending transcript history must not change the identity of an existing message.',
);

const prependedPrefixCache = reconcileTranscriptPrefixHeightsCache({
  measuredHeights: new Map<string, number>([[assistantMessageKey, 400]]),
  messages: prependedMessages,
  previousCache: updatedPrefixCache,
});
assert.equal(
  prependedPrefixCache.entries[2]?.height,
  400,
  'prepending transcript history must retain measured heights for messages shifted to a new row index.',
);
assert.equal(
  prependedPrefixCache.entries[2],
  updatedPrefixCache.entries[1],
  'prepending transcript history should reuse the cached entry for an unchanged message identity.',
);
assert.deepEqual(
  prependedPrefixCache.prefixHeights,
  [0, 116, 232, 632],
  'prepending transcript history must rebuild spacer prefixes from the earliest changed height.',
);
assert.deepEqual(
  resolvePrependAdjustedTranscriptViewport({
    currentCache: prependedPrefixCache,
    previousCache: updatedPrefixCache,
    viewport: { clientHeight: 300, scrollTop: 200 },
  }),
  { clientHeight: 300, scrollTop: 316 },
  'a prepend render must select the old visual window before the coordinator writes the repaired scrollTop.',
);

const removedLeadingMessageCache = reconcileTranscriptPrefixHeightsCache({
  measuredHeights: new Map<string, number>([[assistantMessageKey, 400]]),
  messages: [messages[1]],
  previousCache: updatedPrefixCache,
});
assert.deepEqual(
  removedLeadingMessageCache.prefixHeights,
  [0, 400],
  'removing a leading row must rebuild prefixes from the moved measured message.',
);
assert.equal(
  removedLeadingMessageCache.entries[0],
  updatedPrefixCache.entries[1],
  'removing a leading row should retain the unchanged measured entry by stable identity.',
);
assert.equal(
  removedLeadingMessageCache.messageIndexesByKey.has(resolveTranscriptMessageKey(messages[0], 0)),
  false,
  'removing a row must prune its key from the current key index.',
);

const streamingIdentityMessage: AgentSessionItemView = {
  sessionId: 'session-streaming-identity',
  id: 'provider-item-7',
  role: 'tool',
  content: 'partial',
  metadata: { agentItemSequence: '0007' },
  createdAt: '2026-04-21T00:00:00.000Z',
};
const completedIdentityMessage: AgentSessionItemView = {
  ...streamingIdentityMessage,
  role: 'assistant',
  content: 'partial response completed with substantially more content',
  metadata: { agentItemSequence: 7 },
};
assert.equal(
  resolveTranscriptMessageKey(streamingIdentityMessage, 4),
  resolveTranscriptMessageKey(completedIdentityMessage, 19),
  'streamed content and projected role updates must preserve canonical transcript message identity.',
);

const repeatedIdentityMessage: AgentSessionItemView = {
  ...streamingIdentityMessage,
  metadata: { agentItemSequence: 8 },
};
assert.notEqual(
  resolveTranscriptMessageKey(streamingIdentityMessage, 4),
  resolveTranscriptMessageKey(repeatedIdentityMessage, 4),
  'stable provider sequence metadata must disambiguate otherwise identical repeated message ids.',
);

const provisionalUserMessage: AgentSessionItemView = {
  sessionId: 'session-provisional',
  id: '',
  turnId: 'turn-provisional',
  role: 'user',
  content: 'draft',
  createdAt: '2026-04-21T00:00:03.000Z',
};
const updatedProvisionalUserMessage: AgentSessionItemView = {
  ...provisionalUserMessage,
  content: 'draft with streamed content',
};
assert.equal(
  resolveTranscriptMessageKey(provisionalUserMessage, 2),
  resolveTranscriptMessageKey(updatedProvisionalUserMessage, 22),
  'provisional blank-id rows must keep identity across prepend and content updates.',
);
assert.notEqual(
  resolveTranscriptMessageKey(provisionalUserMessage, 2),
  resolveTranscriptMessageKey({ ...provisionalUserMessage, role: 'assistant' }, 2),
  'provisional blank-id rows must include their stable role discriminator.',
);

const duplicateIdMessages: AgentSessionItemView[] = [
  {
    agentSessionId: 'session-duplicates',
    id: 'provider-message',
    role: 'user',
    content: 'short duplicate id message',
    createdAt: '2026-04-21T00:00:00.000Z',
  },
  {
    agentSessionId: 'session-duplicates',
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
  'transcript virtualization must use stable message fields to keep duplicate provider ids distinct without binding identity to row position.',
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

const taskProgressMessages: AgentSessionItemView[] = [
  {
    agentSessionId: 'session-progress',
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

const longTranscriptMessages = Array.from({ length: 120 }, (_, index) => ({
  agentSessionId: 'session-inactive-window',
  content: `message ${index}`,
  createdAt: `2026-04-21T00:${String(index).padStart(2, '0')}:00.000Z`,
  id: `message-${index}`,
  role: index % 2 === 0 ? 'user' : 'assistant',
})) as AgentSessionItemView[];
const longTranscriptPrefixHeights = Array.from(
  { length: longTranscriptMessages.length + 1 },
  (_, index) => index * 100,
);
const inactiveWindow = resolveVirtualizedTranscriptWindow({
  isActive: false,
  messages: longTranscriptMessages,
  overscanPx: 0,
  prefixHeights: longTranscriptPrefixHeights,
  viewport: { clientHeight: 300, scrollTop: 6_000 },
});
assert.equal(inactiveWindow.visibleStartIndex, 60);
assert.equal(inactiveWindow.visibleMessages.length, 3);
assert.ok(
  inactiveWindow.visibleMessages.length < longTranscriptMessages.length,
  'deactivating a long transcript must retain a bounded virtual window instead of mounting every historical row.',
);

const toolRichTranscriptMessages = longTranscriptMessages.map((message, index) => (
  index === 40
    ? {
        ...message,
        tool_calls: [{
          id: 'tool-rich-call',
          name: 'mcp__docs__search',
          arguments: { query: 'Codex protocol' },
          status: 'success',
        }],
      }
    : message
));
const toolRichWindow = resolveVirtualizedTranscriptWindow({
  isActive: true,
  messages: toolRichTranscriptMessages,
  overscanPx: 0,
  prefixHeights: longTranscriptPrefixHeights,
  viewport: { clientHeight: 300, scrollTop: 6_000 },
});
assert.equal(toolRichWindow.visibleStartIndex, 0);
assert.equal(toolRichWindow.visibleMessages.length, toolRichTranscriptMessages.length);
assert.equal(toolRichWindow.paddingTop, 0);
assert.equal(toolRichWindow.paddingBottom, 0);

const activeScopeChangedViewport = resolveMeasurementScopeTranscriptViewport({
  didChangeScope: true,
  isActive: true,
  totalHeight: 12_000,
  viewport: { clientHeight: 300, scrollTop: 6_000 },
});
assert.deepEqual(
  activeScopeChangedViewport,
  { clientHeight: 300, scrollTop: 11_700 },
  'switching to an active long transcript must select its estimated bottom window on the first render.',
);
const activeScopeChangedWindow = resolveVirtualizedTranscriptWindow({
  isActive: true,
  messages: longTranscriptMessages,
  overscanPx: 0,
  prefixHeights: longTranscriptPrefixHeights,
  viewport: activeScopeChangedViewport,
});
assert.equal(activeScopeChangedWindow.visibleStartIndex, 117);
assert.equal(activeScopeChangedWindow.visibleMessages.length, 3);
assert.equal(activeScopeChangedWindow.visibleMessages.at(-1)?.id, 'message-119');

assert.match(
  virtualizationSource,
  /interface TranscriptMeasurementScope \{[\s\S]*prefixHeightsCache: TranscriptPrefixHeightsCache \| null;[\s\S]*\}/s,
  'useVirtualizedTranscriptWindow should keep a reusable transcript prefix-height cache inside each measurement scope.',
);

assert.match(
  virtualizationSource,
  /const measurementScope = useMemo\([\s\S]*createTranscriptMeasurementScope\(normalizedMeasurementScopeKey\)[\s\S]*useLayoutEffect\(\(\) => \{[\s\S]*disposeTranscriptMeasurementScope\(previousScope\);[\s\S]*committedMeasurementScopeRef\.current = measurementScope;/s,
  'useVirtualizedTranscriptWindow must isolate session measurement state and dispose the previous scope only after the replacement render commits.',
);

assert.doesNotMatch(
  virtualizationSource,
  /if \([^)]*measurementScopeKeyRef\.current[^)]*\) \{[\s\S]*\.clear\(\);/s,
  'useVirtualizedTranscriptWindow must not clear committed measurement or observer state during render.',
);

assert.match(
  virtualizationSource,
  /pendingMessageIds: Map<string, number>;[\s\S]*requestAnimationFrame\([\s\S]*publishPendingMeasurementChanges[\s\S]*committedPublishedThroughSequence[\s\S]*changeSequence <= measurementState\.publishedThroughSequence/s,
  'useVirtualizedTranscriptWindow must batch measurement keys by frame and clear only the sequences consumed by a committed prefix-cache render.',
);

assert.match(
  virtualizationSource,
  /const effectiveViewport = resolveMeasurementScopeTranscriptViewport\(\{[\s\S]*didChangeScope: viewport\.measurementScopeKey !== normalizedMeasurementScopeKey,[\s\S]*isActive,[\s\S]*totalHeight: totalTranscriptHeight,[\s\S]*viewport,[\s\S]*\}\);/s,
  'useVirtualizedTranscriptWindow must select the active transcript bottom window while a new session scope is waiting for its first viewport publication.',
);

assert.doesNotMatch(
  virtualizationSource,
  /useEffect\(\(\) => \{\s*setViewport\([\s\S]*?\}, \[normalizedMeasurementScopeKey\]\);/s,
  'Measurement scope changes must not synchronize viewport state through an effect.',
);

assert.doesNotMatch(
  virtualizationSource,
  /scrollContainer\.scrollTop\s*=/,
  'useVirtualizedTranscriptWindow must not compete with the transcript coordinator for DOM scroll writes during scope changes.',
);

assert.match(
  transcriptScrollCoordinatorSource,
  /const didChangeScope = currentScopeKeyRef\.current !== normalizedScopeKey;[\s\S]*shouldStickToBottomRef\.current = true;[\s\S]*pendingOperationRef\.current = null;[\s\S]*performScrollOperation\(\{[\s\S]*kind: 'bottom',[\s\S]*scopeKey: normalizedScopeKey,[\s\S]*\}\);/s,
  'The shared transcript coordinator must own real viewport alignment when the visible session scope changes.',
);

assert.match(
  virtualizationSource,
  /resolvePrependAdjustedTranscriptViewport\([\s\S]*viewport: effectiveViewport,[\s\S]*viewport: windowViewport,/,
  'useVirtualizedTranscriptWindow must preserve the visible range during prepend before resolving the virtualized window.',
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
  /estimateTranscriptSessionItemHeight\(/,
  'transcript virtualization must estimate row heights from resolved chat message views instead of role-only heuristics.',
);

assert.match(
  virtualizationSource,
  /options: \{ layout, engineId \}/,
  'useVirtualizedTranscriptWindow must pass layout and engine context into transcript height reconciliation.',
);

assert.match(
  contentBlockRenderersSource,
  /<ChatTaskProgress[\s\S]*isExpanded=\{context\.expandedDisclosureKeys\.has\(disclosureKey\)\}[\s\S]*onToggle=\{\(\) => context\.toggleDisclosure\(disclosureKey\)\}[\s\S]*taskProgress=\{block\.progress\}[\s\S]*t=\{context\.environment\?\.t\}[\s\S]*\/>/,
  'Task progress payloads must render through the shared controlled ChatTaskProgress disclosure so cross-engine planner and reviewer progress survives all the way to the transcript UI.',
);

assert.match(
  commandActivityListSource,
  /const identity = `\$\{index\}\\u0001\$\{command\.toolCallId\?\.trim\(\) \|\| 'command'\}`;[\s\S]*const disclosureKey = `\$\{disclosureScopeKey\}\\u0001command\\u0001\$\{identity\}`;/,
  'Command cards must derive stable disclosure identity from row position and provider call id without mutable command text.',
);

assert.match(
  commandActivityListSource,
  /<ChatCommandActivityRow[\s\S]*key=\{identity\}[\s\S]*commandKey=\{disclosureKey\}/,
  'Command rows must apply stable identity to the React key and the scoped identity to disclosure state.',
);

assert.doesNotMatch(
  commandActivityListSource,
  /key=\{command\.toolCallId \?\?/,
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
): AgentSessionItemView => ({
  agentSessionId: 'session-announcements',
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
  agentSessionId: 'session-announcements',
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
