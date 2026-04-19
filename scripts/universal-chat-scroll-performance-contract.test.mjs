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
  /function resolveChatScrollBehavior\(/,
  'UniversalChat must centralize transcript autoscroll policy in a dedicated helper instead of hard-coding smooth scrolling for every update.',
);

assert.match(
  universalChatSource,
  /previousSnapshot\.messageId === nextSnapshot\.messageId &&[\s\S]*previousSnapshot\.contentLength !== nextSnapshot\.contentLength[\s\S]*return 'auto';/s,
  'UniversalChat must switch streamed token growth to instant scroll updates so repeated assistant output does not schedule overlapping smooth scroll animations.',
);

assert.match(
  universalChatSource,
  /window\.requestAnimationFrame\(\(\) => \{\s*messagesEndRef\.current\?\.scrollIntoView\(\{\s*behavior: scrollBehavior,\s*block: 'end',?\s*\}\);?\s*\}\)/s,
  'UniversalChat must batch transcript autoscroll onto animation frames so layout work does not run synchronously inside React commit bursts.',
);

assert.doesNotMatch(
  universalChatSource,
  /messagesEndRef\.current\?\.scrollIntoView\(\{ behavior: "smooth" \}\);/,
  'UniversalChat must not unconditionally smooth-scroll every transcript update because streamed message growth and session hydration would monopolize the main thread.',
);

console.log('universal chat scroll performance contract passed.');
