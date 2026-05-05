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
  /export const UniversalChat = memo\(function UniversalChat\(/,
  'UniversalChat must memoize the outer shell so parent layout churn does not rerender composer, prompt, and model-menu state when chat props are unchanged.',
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

assert.doesNotMatch(
  universalChatSource,
  /<UniversalChatTranscript\b[^>]*\bkey=\{/s,
  'UniversalChat must not force transcript remounts through a synthetic key because session switches and history expansion should preserve scroll/runtime state inside the memoized transcript boundary.',
);

assert.match(
  universalChatSource,
  /const messageActionTargets = useMemo\(\s*\(\) =>[\s\S]*?buildVisibleMessageActionTargets\(\s*renderedMessages,\s*visibleStartIndex,\s*visibleMessages\.length,\s*\),[\s\S]*?\[renderedMessages, visibleMessages\.length, visibleStartIndex\],?[\s\S]*?\);/s,
  'UniversalChat transcript must precompute grouped reply action targets only for the virtualized visible message window so large progressively loaded transcripts do not rescan every loaded row.',
);

const messageActionTargetsBody = universalChatSource.match(
  /function buildVisibleMessageActionTargets\([\s\S]*?\n\}/,
)?.[0];
assert.ok(
  messageActionTargetsBody,
  'UniversalChat must keep visible grouped message action target generation in a dedicated helper.',
);
assert.doesNotMatch(
  messageActionTargetsBody,
  /\.slice\(index,\s*endIndex \+ 1\)/,
  'UniversalChat must not allocate a grouped message slice for every reply segment while building action targets.',
);
assert.doesNotMatch(
  messageActionTargetsBody,
  /new Array<ChatMessageActionTarget \| null>\(messages\.length\)/,
  'UniversalChat must not allocate action target arrays sized to the full transcript when only a virtualized subset is visible.',
);

assert.match(
  universalChatSource,
  /const normalizedMessages = useMemo\(\s*\(\) => resolveVisibleSessionMessages\(messages, normalizedSessionId\),\s*\[messages, normalizedSessionId\],\s*\);/s,
  'UniversalChat must normalize visible message collections through the active session-aware helper while preserving stable references for clean inputs.',
);

console.log('universal chat transcript performance contract passed.');
