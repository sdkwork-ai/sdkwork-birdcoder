import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const universalChatPath = path.join(
  rootDir,
  'apps',
    'sdkwork-birdcoder-pc',
    'packages',
  
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'UniversalChat.tsx',
);
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

const universalChatSource = fs.readFileSync(universalChatPath, 'utf8');
const progressiveTranscriptHookSource = fs.readFileSync(progressiveTranscriptHookPath, 'utf8');

assert.match(
  universalChatSource,
  /import \{ useProgressiveTranscriptWindow \} from '\.\/useProgressiveTranscriptWindow';/,
  'UniversalChat must consume progressive transcript paging through a dedicated hook so the large chat component does not accumulate more state-management debt.',
);

assert.match(
  universalChatSource,
  /const \{[\s\S]*renderedMessages[\s\S]*\} = useProgressiveTranscriptWindow\(\s*messages,\s*messagesEndRef,\s*isActive,\s*sessionId,\s*\);/s,
  'UniversalChat transcript must delegate progressive transcript windowing to the dedicated hook.',
);

assert.match(
  progressiveTranscriptHookSource,
  /interface ProgressiveTranscriptWindowState \{[\s\S]*transcriptIdentity: string;[\s\S]*visibleTranscriptStartIndex: number;[\s\S]*\}/s,
  'Progressive transcript rendering must scope its window state to the visible session identity, not only the first message id.',
);

assert.match(
  progressiveTranscriptHookSource,
  /resolveInitialVisibleTranscriptStartIndex\(messageCount\)/,
  'Progressive transcript rendering must use the shared initial transcript window policy so large histories do not block the main thread.',
);

assert.match(
  progressiveTranscriptHookSource,
  /useState<ProgressiveTranscriptWindowState>\(\(\) =>\s*createProgressiveTranscriptWindowState\(transcriptIdentity, messages\.length\)/s,
  'Progressive transcript rendering must initialize the first visible message index from the current message count so large histories avoid a first-frame full render.',
);

assert.match(
  progressiveTranscriptHookSource,
  /const renderedMessages = useMemo\(\(\) => \{[\s\S]*messages\.slice\(visibleTranscriptStartIndex\)/s,
  'Progressive transcript rendering must render a sliced message window instead of always mapping the full transcript payload.',
);

assert.match(
  progressiveTranscriptHookSource,
  /createProgressiveTranscriptWindowState\([\s\S]*visibleTranscriptStartIndex: resolveInitialVisibleTranscriptStartIndex\(messageCount\)/s,
  'Progressive transcript rendering must select a recent-message window when a large session is opened so the latest content appears quickly.',
);

assert.match(
  progressiveTranscriptHookSource,
  /useEffect\(\(\) => \{[\s\S]*shouldLoadEarlierTranscriptPage\(scrollMetrics, visibleTranscriptStartIndex\)[\s\S]*setTranscriptWindowState\(\(previousState\) =>[\s\S]*resolveEarlierTranscriptStartIndex\([\s\S]*activeState\.visibleTranscriptStartIndex/s,
  'Progressive transcript rendering must reveal earlier pages only after the transcript scroll reaches the top threshold.',
);

assert.doesNotMatch(
  universalChatSource,
  /messages\.map\(\(msg, idx\) =>[\s\S]*layout === 'sidebar'/s,
  'UniversalChat transcript must not map the full messages collection directly once progressive transcript rendering is introduced.',
);

console.log('universal chat progressive transcript contract passed.');
