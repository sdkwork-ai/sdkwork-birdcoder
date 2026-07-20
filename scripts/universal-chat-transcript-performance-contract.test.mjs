import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const universalChatSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps',
    'sdkwork-birdcoder-pc',
    'packages',
    'sdkwork-birdcoder-pc-ui',
    'src',
    'components',
    'UniversalChat.tsx',
  ),
  'utf8',
);
const messageActionsSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps',
    'sdkwork-birdcoder-pc',
    'packages',
    'sdkwork-birdcoder-pc-ui',
    'src',
    'components',
    'chat',
    'messages',
    'messageActions.ts',
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

assert.match(
  universalChatSource,
  /buildVisibleMessageActionTargets,/,
  'UniversalChat must import grouped reply action target generation from the chat message module.',
);

assert.match(
  universalChatSource,
  /environmentSignature=\{transcriptEnvironmentSignature\}/,
  'UniversalChat must pass transcript environment signature so skill changes refresh memoized transcript rendering.',
);

assert.match(
  universalChatSource,
  /previousProps\.engineId !== nextProps\.engineId/,
  'UniversalChat transcript memo comparator must invalidate when engineId changes.',
);
assert.match(
  universalChatSource,
  /previousProps\.environmentSignature !== nextProps\.environmentSignature/,
  'UniversalChat transcript memo comparator must invalidate when environment signature changes.',
);

const messageActionTargetsBody = messageActionsSource.match(
  /export function buildVisibleMessageActionTargets\([\s\S]*?\n\}/,
)?.[0];
assert.ok(
  messageActionTargetsBody,
  'Chat message action helpers must keep visible grouped message action target generation in a dedicated helper.',
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
  /const normalizedMessages = useMemo\(\s*\(\) => projectChatTranscriptToolActivity\(\s*resolveVisibleSessionMessages\(messages, normalizedSessionId\),\s*\{ engineId: selectedEngineId \},\s*\),\s*\[messages, normalizedSessionId, selectedEngineId\],\s*\);/s,
  'UniversalChat must compose session filtering with provider-neutral tool projection in one memoized transcript boundary.',
);

console.log('universal chat transcript performance contract passed.');
