import assert from 'node:assert/strict';
import fs from 'node:fs';

const universalChatSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx', import.meta.url),
  'utf8',
);
const progressiveTranscriptSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/useProgressiveTranscriptWindow.ts', import.meta.url),
  'utf8',
);

assert.match(
  universalChatSource,
  /isActive\?: boolean;/,
  'UniversalChat must accept an optional activity flag so hidden chat surfaces can keep state without continuing expensive transcript and event work.',
);

assert.match(
  universalChatSource,
  /isActive = true,/,
  'UniversalChat must default the activity flag to true so visible chat surfaces behave normally.',
);

assert.match(
  universalChatSource,
  /useProgressiveTranscriptWindow\(\s*messages,\s*messagesEndRef,\s*isActive,\s*sessionId,/s,
  'UniversalChat transcript rendering must forward the activity flag into the progressive transcript window hook.',
);

assert.match(
  universalChatSource,
  /if \(!isActive\) \{\s*return;\s*\}/s,
  'UniversalChat must guard hidden-state effects instead of continuing background work while the surface is inactive.',
);

assert.match(
  universalChatSource,
  /previousProps\.isActive !== nextProps\.isActive/,
  'UniversalChatTranscript memoization must include the activity flag so hidden and reactivated chat surfaces rerender with the correct transcript lifecycle.',
);

assert.match(
  progressiveTranscriptSource,
  /export function useProgressiveTranscriptWindow\(\s*messages: readonly AgentSessionItemView\[\],\s*messagesEndRef: RefObject<HTMLDivElement \| null>,\s*isActive = true,\s*transcriptScopeKey = '',\s*remoteHistory\?: ProgressiveTranscriptRemoteHistory,\s*scrollCoordinator\?: Pick<[\s\S]*'beginPrepend' \| 'cancelPrepend' \| 'completePrepend'[\s\S]*>,\s*\)/s,
  'useProgressiveTranscriptWindow must accept activity gating and a restricted prepend coordinator instead of owning scroll writes.',
);

assert.match(
  progressiveTranscriptSource,
  /!isActive[\s\S]*\|\| \(visibleTranscriptStartIndex === 0 && !canLoadRemoteMessages\)[\s\S]*\|\| typeof window === 'undefined'/s,
  'Progressive transcript repair and scroll effects must bail out immediately while the chat surface is inactive.',
);

console.log('universal chat inactive gating performance contract passed.');
