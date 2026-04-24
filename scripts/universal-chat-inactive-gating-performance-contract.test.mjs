import assert from 'node:assert/strict';
import fs from 'node:fs';

const universalChatSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx', import.meta.url),
  'utf8',
);
const progressiveTranscriptSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/useProgressiveTranscriptWindow.ts', import.meta.url),
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
  /useProgressiveTranscriptWindow\(\s*messages,\s*messagesEndRef,\s*isActive,\s*\)/s,
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
  /export function useProgressiveTranscriptWindow\(\s*messages: readonly BirdCoderChatMessage\[\],\s*messagesEndRef: RefObject<HTMLDivElement \| null>,\s*isActive = true,\s*\)/s,
  'useProgressiveTranscriptWindow must accept an activity flag so transcript repair work can be disabled while hidden.',
);

assert.match(
  progressiveTranscriptSource,
  /if \(!isActive \|\| visibleTranscriptStartIndex === 0 \|\| typeof window === 'undefined'\)/,
  'Progressive transcript repair and scroll effects must bail out immediately while the chat surface is inactive.',
);

console.log('universal chat inactive gating performance contract passed.');
