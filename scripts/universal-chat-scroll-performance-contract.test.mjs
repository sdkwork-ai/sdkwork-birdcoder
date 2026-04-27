import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const universalChatSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-ui',
    'src',
    'components',
    'UniversalChat.tsx',
  ),
  'utf8',
);

assert.match(
  universalChatSource,
  /type ChatScrollSnapshot = \{/,
  'UniversalChat must describe scroll snapshots explicitly so transcript autoscroll behavior can distinguish initial hydration, streamed token growth, and appended messages.',
);

assert.match(
  universalChatSource,
  /function resolveChatScrollTiming\(/,
  'UniversalChat must centralize transcript autoscroll timing policy in a dedicated helper instead of hard-coding frame scheduling for every update.',
);

assert.match(
  universalChatSource,
  /previousSnapshot\.messageId === nextSnapshot\.messageId &&[\s\S]*previousSnapshot\.contentLength !== nextSnapshot\.contentLength[\s\S]*return 'layout';/s,
  'UniversalChat must switch streamed token growth to same-layout scroll updates so repeated assistant output does not schedule overlapping scroll work.',
);

assert.match(
  universalChatSource,
  /const animationFrame = window\.requestAnimationFrame\(\(\) => \{[\s\S]*scrollTranscriptToBottom\(\);[\s\S]*\}\);/s,
  'UniversalChat must batch non-initial transcript autoscroll onto animation frames so layout work does not run synchronously inside React commit bursts.',
);

assert.match(
  universalChatSource,
  /previousSnapshot === null[\s\S]*scrollTranscriptToBottom\(\);[\s\S]*return;/s,
  'UniversalChat must align the initial hydrated transcript to the bottom during layout instead of waiting for a post-paint smooth scroll.',
);

assert.match(
  universalChatSource,
  /scrollContainer\.scrollTop = nextScrollTop;/,
  'UniversalChat must write the transcript scroll container directly instead of using scrollIntoView against a sentinel node.',
);

assert.doesNotMatch(
  universalChatSource,
  /messagesEndRef\.current\?\.scrollIntoView\(/,
  'UniversalChat must not use scrollIntoView for transcript following because it can fight native scrollbar dragging and parent scroll containers.',
);

console.log('universal chat scroll performance contract passed.');
