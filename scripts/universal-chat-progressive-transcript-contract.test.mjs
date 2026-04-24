import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const universalChatPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-ui',
  'src',
  'components',
  'UniversalChat.tsx',
);
const progressiveTranscriptHookPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-ui',
  'src',
  'components',
  'useProgressiveTranscriptWindow.ts',
);

const universalChatSource = fs.readFileSync(universalChatPath, 'utf8');
const progressiveTranscriptHookSource = fs.readFileSync(progressiveTranscriptHookPath, 'utf8');

assert.match(
  universalChatSource,
  /import \{ useProgressiveTranscriptWindow \} from '\.\/useProgressiveTranscriptWindow';/,
  'UniversalChat must consume progressive transcript paging through a dedicated hook so the large chat component does not accumulate more state-management debt.',
);

assert.match(
  universalChatSource,
  /const \{[\s\S]*renderedMessages[\s\S]*\} = useProgressiveTranscriptWindow\(\s*messages,\s*messagesEndRef,\s*(isActive,)?\s*\);/s,
  'UniversalChat transcript must delegate progressive transcript windowing to the dedicated hook.',
);

assert.match(
  progressiveTranscriptHookSource,
  /const INITIAL_TRANSCRIPT_RENDER_COUNT = \d+;/,
  'Progressive transcript rendering must define an initial transcript render window so large histories do not block the main thread by rendering every row immediately.',
);

assert.match(
  progressiveTranscriptHookSource,
  /const \[visibleTranscriptStartIndex, setVisibleTranscriptStartIndex\] = useState\(\(\) =>\s*resolveInitialVisibleTranscriptStartIndex\(messages\.length\),?\s*\);/s,
  'Progressive transcript rendering must initialize the first visible message index from the current message count so large histories avoid a first-frame full render.',
);

assert.match(
  progressiveTranscriptHookSource,
  /const renderedMessages = useMemo\(\(\) => \{[\s\S]*messages\.slice\(visibleTranscriptStartIndex\)/s,
  'Progressive transcript rendering must render a sliced message window instead of always mapping the full transcript payload.',
);

assert.match(
  progressiveTranscriptHookSource,
  /useEffect\(\(\) => \{[\s\S]*setVisibleTranscriptStartIndex\(Math\.max\(0, messages\.length - INITIAL_TRANSCRIPT_RENDER_COUNT\)\);/s,
  'Progressive transcript rendering must reset to a recent-message window when a large session is opened so the latest content appears quickly.',
);

assert.match(
  progressiveTranscriptHookSource,
  /useEffect\(\(\) => \{[\s\S]*shouldLoadEarlierTranscriptPage\(scrollMetrics, visibleTranscriptStartIndex\)[\s\S]*setVisibleTranscriptStartIndex\(\(previousVisibleTranscriptStartIndex\) =>[\s\S]*resolveEarlierTranscriptStartIndex\(previousVisibleTranscriptStartIndex\)/s,
  'Progressive transcript rendering must reveal earlier pages only after the transcript scroll reaches the top threshold.',
);

assert.doesNotMatch(
  universalChatSource,
  /messages\.map\(\(msg, idx\) =>[\s\S]*layout === 'sidebar'/s,
  'UniversalChat transcript must not map the full messages collection directly once progressive transcript rendering is introduced.',
);

console.log('universal chat progressive transcript contract passed.');
