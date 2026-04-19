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
  /const UniversalChatTranscript = memo\(function UniversalChatTranscript\(/,
  'UniversalChat must isolate transcript rendering behind a memoized transcript component so composer updates do not rerender the full message list.',
);

assert.match(
  universalChatSource,
  /const transcriptEnvironmentRef = useRef<UniversalChatTranscriptEnvironment \| null>\(null\);/,
  'UniversalChat must hold transcript actions and helpers in a stable ref so transcript rendering can stay memoized while callbacks update.',
);

assert.match(
  universalChatSource,
  /<UniversalChatTranscript[\s\S]*messages=\{normalizedMessages\}/,
  'UniversalChat must render transcript content through the memoized transcript component.',
);

assert.match(
  universalChatSource,
  /const normalizedMessages = messages\.length === 0 \? EMPTY_CHAT_MESSAGES : messages;/,
  'UniversalChat must normalize empty message collections to a stable shared reference.',
);

console.log('universal chat transcript performance contract passed.');
