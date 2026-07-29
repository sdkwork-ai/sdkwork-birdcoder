import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const progressiveTranscriptHookPath = path.join(
  rootDir,
  'apps',
    'sdkwork-birdcoder-pc',
    'packages',
  
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'useProgressiveTranscriptWindow.ts',
);

const progressiveTranscriptHookSource = fs.readFileSync(progressiveTranscriptHookPath, 'utf8');
const universalChatSource = fs.readFileSync(path.join(
  rootDir,
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'UniversalChat.tsx',
), 'utf8');

assert.match(
  progressiveTranscriptHookSource,
  /import \{[\s\S]*isTranscriptWithinTopLoadThreshold,[\s\S]*resolveEarlierTranscriptStartIndex,[\s\S]*shouldLoadEarlierTranscriptPage[\s\S]*\} from '\.\/transcriptPagination';/s,
  'Progressive transcript pagination must import the shared top-load pagination helpers instead of open-coding a separate history expansion policy.',
);

assert.match(
  progressiveTranscriptHookSource,
  /const handleTranscriptScroll = \(\) => \{/,
  'Progressive transcript pagination must centralize top-load behavior in a dedicated transcript scroll handler.',
);

assert.match(
  progressiveTranscriptHookSource,
  /const topLoadAnimationFrameRef = useRef<number \| null>\(null\);/,
  'Progressive transcript pagination must keep a dedicated animation-frame gate for top-load threshold checks.',
);

assert.match(
  progressiveTranscriptHookSource,
  /const pendingTopLoadAfterRemoteRequestRef = useRef\(false\);[\s\S]*setRemoteTopLoadRearmVersion\(\(version\) => version \+ 1\);/s,
  'A user top-scroll intent during an active remote request must rearm one threshold check after that request settles.',
);

assert.match(
  progressiveTranscriptHookSource,
  /scrollContainer\.addEventListener\('wheel', markPendingTopLoadIntent[\s\S]*scrollContainer\.addEventListener\('touchstart', markPendingTopLoadIntent[\s\S]*scrollContainer\.addEventListener\('keydown', handleTranscriptKeyDown/s,
  'Remote top-load rearming must be driven by explicit user input instead of request completion alone.',
);

assert.match(
  progressiveTranscriptHookSource,
  /const scheduleEarlierTranscriptPageRequest = \(\) => \{[\s\S]*topLoadAnimationFrameRef\.current = window\.requestAnimationFrame\(\(\) => \{[\s\S]*requestEarlierTranscriptPage\(\);[\s\S]*\}\);[\s\S]*\}/s,
  'Progressive transcript pagination must batch top-load threshold reads onto animation frames instead of doing layout work inside native scroll events.',
);

const transcriptScrollHandlerMatch = progressiveTranscriptHookSource.match(
  /const handleTranscriptScroll = \(\) => \{([\s\S]*?)\r?\n    \};\r?\n    const handleTranscriptPointerDown/,
);
assert.ok(
  transcriptScrollHandlerMatch,
  'Progressive transcript pagination must keep the transcript scroll listener body inspectable.',
);
const transcriptScrollHandlerBody = transcriptScrollHandlerMatch[1] ?? '';
assert.match(
  transcriptScrollHandlerBody,
  /pendingTopLoadIntentRef\.current[\s\S]*scheduleEarlierTranscriptPageRequest\(\);/,
  'Progressive transcript pagination scroll events must only schedule top-load checks after explicit user intent.',
);
assert.doesNotMatch(
  transcriptScrollHandlerBody,
  /readTranscriptScrollMetrics|shouldLoadEarlierTranscriptPage|requestEarlierTranscriptPage\(\)/,
  'Progressive transcript pagination scroll events must not synchronously read layout or reveal older history.',
);

assert.match(
  progressiveTranscriptHookSource,
  /const pendingTopLoadIntentRef = useRef\(false\);/,
  'Programmatic transcript scroll events must not trigger remote history loading without a preceding user input intent.',
);
assert.match(
  progressiveTranscriptHookSource,
  /const markPendingTopLoadIntent = \(event\?: Event\) => \{[\s\S]*pendingTopLoadIntentRef\.current = true;/s,
  'Transcript input handlers must record user intent before top-load scheduling.',
);

assert.match(
  progressiveTranscriptHookSource,
  /const scrollMetrics = readTranscriptScrollMetrics\(\s*scrollContainerRef,\s*\);[\s\S]*shouldLoadEarlierTranscriptPage\(scrollMetrics, visibleTranscriptStartIndex\)/s,
  'Progressive transcript pagination must gate earlier-history loading behind the shared top-threshold predicate.',
);

assert.match(
  progressiveTranscriptHookSource,
  /const scrollContainer = scrollContainerRef\.current;/s,
  'Progressive transcript pagination must read the explicit transcript scroll container.',
);

assert.match(
  progressiveTranscriptHookSource,
  /useProgressiveTranscriptWindow\(\s*messages: readonly AgentSessionItemView\[\],\s*scrollContainerRef: RefObject<HTMLDivElement \| null>/s,
  'Progressive transcript pagination must require the transcript scroll container as an explicit dependency.',
);
assert.doesNotMatch(
  progressiveTranscriptHookSource,
  /messagesEndRef|parentElement/,
  'Progressive transcript pagination must never infer its viewport from the message-end marker DOM parent.',
);

assert.match(
  universalChatSource,
  /useProgressiveTranscriptWindow\(\s*messages,\s*scrollContainerRef,\s*isActive,\s*sessionId,\s*\{[\s\S]*?\},\s*scrollCoordinator,\s*navigationTargetIndex,\s*\);/s,
  'UniversalChat must pass the real overflow container to progressive transcript pagination.',
);

assert.match(
  progressiveTranscriptHookSource,
  /setTranscriptWindowState\(\(previousState\) =>[\s\S]*resolveEarlierTranscriptStartIndex\([\s\S]*activeState\.visibleTranscriptStartIndex/s,
  'Progressive transcript pagination must reveal exactly one earlier page for each top-threshold load request.',
);

assert.match(
  progressiveTranscriptHookSource,
  /scrollContainer\.addEventListener\('scroll', handleTranscriptScroll, \{ passive: true \}\);/s,
  'Progressive transcript pagination must listen to transcript scroll events so older history is revealed on demand.',
);

assert.match(
  progressiveTranscriptHookSource,
  /scrollContainer\.addEventListener\('scroll',[\s\S]*scheduleEarlierTranscriptPageRequest\(\);/s,
  'Progressive transcript pagination must evaluate an already-top or underfilled viewport after listener setup instead of requiring a synthetic first scroll.',
);

assert.match(
  progressiveTranscriptHookSource,
  /!currentRemoteHistory\?\.hasMoreMessages[\s\S]*return 'not-at-top';[\s\S]*currentRemoteHistory\.isLoadingMessages \|\| remoteLoadRequestRef\.current[\s\S]*return 'blocked';/s,
  'Progressive transcript pagination must distinguish exhausted remote history from a temporarily blocked request gate.',
);

assert.match(
  progressiveTranscriptHookSource,
  /!pendingTopLoadAfterRemoteRequestRef\.current[\s\S]*setRemoteTopLoadRearmVersion\(\(version\) => version \+ 1\);[\s\S]*remoteHistory\?\.isLoadingMessages,\s*transcriptIdentity/s,
  'Progressive transcript pagination must recheck the top threshold only when an explicit pending intent survives until both remote loading gates become idle.',
);

assert.match(
  progressiveTranscriptHookSource,
  /type EarlierTranscriptPageRequestResult = 'blocked' \| 'not-at-top' \| 'started';/,
  'Top-load request evaluation must report whether intent was consumed or remains blocked.',
);

assert.match(
  progressiveTranscriptHookSource,
  /const requestResult = requestEarlierTranscriptPage\(\);[\s\S]*requestResult !== 'blocked'[\s\S]*pendingTopLoadIntentRef\.current = false;[\s\S]*pendingTopLoadAfterRemoteRequestRef\.current = false;/s,
  'Top-load intent must remain pending while request dispatch is blocked and be consumed only after a terminal evaluation.',
);

assert.match(
  progressiveTranscriptHookSource,
  /if \(pendingTopLoadIntentRef\.current\) \{\s*scheduleEarlierTranscriptPageRequest\(\);\s*\}/,
  'Listener reinstallation must reschedule a surviving top-load intent after cleanup cancels its animation frame.',
);

assert.match(
  progressiveTranscriptHookSource,
  /window\.cancelAnimationFrame\(topLoadAnimationFrameRef\.current\);/,
  'Progressive transcript pagination must cancel pending top-load animation frames during listener cleanup.',
);

assert.doesNotMatch(
  progressiveTranscriptHookSource,
  /window\.setTimeout\(/,
  'Progressive transcript pagination must not auto-load older history on a timer because that defeats top-triggered paging and destabilizes the scrollbar.',
);

assert.doesNotMatch(
  progressiveTranscriptHookSource,
  /TRANSCRIPT_REPAIR_FRAME_DELAY_MS/,
  'Progressive transcript pagination must not keep a frame-delay constant once older history is user-driven rather than timer-driven.',
);

console.log('transcript top load contract passed.');
