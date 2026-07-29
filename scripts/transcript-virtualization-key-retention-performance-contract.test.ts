import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  hasTranscriptMessageKey,
  resolveTranscriptMessageKey,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/transcriptVirtualization.ts';
import type { AgentSessionItemView } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts';

function buildMessage(index: number): AgentSessionItemView {
  return {
    agentSessionId: 'transcript-key-retention',
    content: `message ${index}`,
    createdAt: '2026-04-29T12:30:00.000Z',
    id: `message-${index}`,
    role: 'assistant',
  };
}

const messages = Array.from({ length: 256 }, (_, index) => buildMessage(index));
const retainedKey = resolveTranscriptMessageKey(messages[128], 128);
const shiftedKey = resolveTranscriptMessageKey(messages[128], 127);
const currentMessageKeys = new Set<string>();
for (let index = 0; index < messages.length; index += 1) {
  currentMessageKeys.add(resolveTranscriptMessageKey(messages[index], index));
}

assert.equal(
  shiftedKey,
  retainedKey,
  'Transcript message identity must remain stable when prepended history shifts an existing row index.',
);
assert.equal(
  hasTranscriptMessageKey(currentMessageKeys, retainedKey),
  true,
  'Transcript message key retention must resolve existing stable keys through the cached key lookup.',
);
assert.equal(
  hasTranscriptMessageKey(currentMessageKeys, 'not-a-valid-key'),
  false,
  'Transcript message key retention must reject unknown keys without scanning the transcript.',
);

const hookSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/useVirtualizedTranscriptWindow.ts', import.meta.url),
  'utf8',
);

assert.match(
  hookSource,
  /const messageIndexesByKey = prefixHeightsCache\.messageIndexesByKey;/,
  'Virtualized transcript cleanup must reuse the key index already maintained by the prefix-height cache.',
);
assert.match(
  hookSource,
  /hasTranscriptMessageKey\(messageIndexesByKey, messageId\)/,
  'Virtualized transcript cleanup must perform constant-time retention checks against the cached key index.',
);
assert.doesNotMatch(
  hookSource,
  /new Set\(\s*messages\.map\(/,
  'Virtualized transcript cleanup must not allocate a duplicate full key Set on every transcript update.',
);
assert.doesNotMatch(
  hookSource,
  /hasTranscriptMessageKey\(messages,/,
  'Virtualized transcript cleanup must not rescan the message array for every retained measurement or observer.',
);

console.log('transcript virtualization key retention performance contract passed.');
