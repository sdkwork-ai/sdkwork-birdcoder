import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  hasTranscriptMessageKey,
  resolveTranscriptMessageKey,
} from '../packages/sdkwork-birdcoder-ui/src/components/transcriptVirtualization.ts';
import type { BirdCoderChatMessage } from '../packages/sdkwork-birdcoder-types/src/index.ts';

function buildMessage(index: number): BirdCoderChatMessage {
  return {
    codingSessionId: 'transcript-key-retention',
    content: `message ${index}`,
    createdAt: '2026-04-29T12:30:00.000Z',
    id: `message-${index}`,
    role: 'assistant',
  };
}

const messages = Array.from({ length: 256 }, (_, index) => buildMessage(index));
const retainedKey = resolveTranscriptMessageKey(messages[128], 128);
const staleKey = resolveTranscriptMessageKey(messages[128], 127);

assert.equal(
  hasTranscriptMessageKey(messages, retainedKey),
  true,
  'Transcript message key retention must resolve existing keyed messages without building a full key Set.',
);
assert.equal(
  hasTranscriptMessageKey(messages, staleKey),
  false,
  'Transcript message key retention must reject stale keys when the index/id pair no longer matches.',
);
assert.equal(
  hasTranscriptMessageKey(messages, 'not-a-valid-key'),
  false,
  'Transcript message key retention must reject malformed keys without scanning the transcript.',
);

const hookSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/useVirtualizedTranscriptWindow.ts', import.meta.url),
  'utf8',
);

assert.match(
  hookSource,
  /hasTranscriptMessageKey/,
  'Virtualized transcript cleanup must use direct key retention checks instead of allocating a full message key Set.',
);
assert.doesNotMatch(
  hookSource,
  /new Set\(\s*messages\.map\(/,
  'Virtualized transcript cleanup must not allocate a full Set from every message on append.',
);
assert.doesNotMatch(
  hookSource,
  /messages\.map\(\(message, index\) => resolveTranscriptMessageKey/,
  'Virtualized transcript cleanup must not map every transcript message just to prune observed element state.',
);

console.log('transcript virtualization key retention performance contract passed.');
