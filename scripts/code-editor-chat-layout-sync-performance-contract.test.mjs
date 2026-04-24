import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/useCodeEditorChatLayout.ts', import.meta.url),
  'utf8',
);

assert.match(
  source,
  /const persistedChatWidthRef = useRef\(\s*normalizeWorkbenchCodeEditorChatWidth\(initialChatWidth\),\s*\);/s,
  'Editor-mode chat layout should track the latest persisted requested width in a ref so delayed persistence and external preference hydration can be reconciled without extra state churn.',
);

assert.match(
  source,
  /if \(requestedChatWidth === persistedChatWidthRef\.current\) \{\s*return;\s*\}/s,
  'Editor-mode chat layout must skip scheduling persistence when the requested width already matches the latest persisted width.',
);

assert.match(
  source,
  /persistedChatWidthRef\.current = normalizedInitialChatWidth;/,
  'Editor-mode chat layout must update its persisted-width ref when external preference hydration provides a new normalized width.',
);

assert.match(
  source,
  /if \(\s*normalizedInitialChatWidth === persistedChatWidthRef\.current &&\s*normalizedInitialChatWidth === requestedChatWidthRef\.current\s*\) \{\s*return;\s*\}/s,
  'Editor-mode chat layout must bail out of external-width synchronization when the normalized persisted width already matches the requested width, avoiding redundant timeout cleanup and responsive width recomputation.',
);

console.log('code editor chat layout sync performance contract passed.');
