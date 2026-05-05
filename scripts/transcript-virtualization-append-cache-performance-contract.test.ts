import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  reconcileTranscriptPrefixHeightsCache,
  type TranscriptPrefixHeightsCache,
} from '../packages/sdkwork-birdcoder-ui/src/components/transcriptVirtualization.ts';
import type { BirdCoderChatMessage } from '../packages/sdkwork-birdcoder-types/src/index.ts';

function buildMessage(index: number): BirdCoderChatMessage {
  return {
    codingSessionId: 'transcript-virtualization-cache',
    content: `message ${index}`,
    createdAt: '2026-04-29T12:00:00.000Z',
    id: `message-${index}`,
    role: index % 2 === 0 ? 'assistant' : 'user',
  };
}

const initialMessages = Array.from({ length: 128 }, (_, index) => buildMessage(index));
const measuredHeights = new Map<string, number>();
const initialCache = reconcileTranscriptPrefixHeightsCache({
  measuredHeights,
  messages: initialMessages,
  previousCache: null,
});
const appendedMessages = [...initialMessages, buildMessage(128), buildMessage(129)];
const appendedCache = reconcileTranscriptPrefixHeightsCache({
  measuredHeights,
  messages: appendedMessages,
  previousCache: initialCache,
});

assert.equal(
  appendedCache.entries[0],
  initialCache.entries[0],
  'append-only transcript virtualization must reuse existing entry objects instead of rebuilding the whole prefix cache.',
);
assert.equal(
  appendedCache.entries[initialMessages.length - 1],
  initialCache.entries[initialMessages.length - 1],
  'append-only transcript virtualization must keep the unchanged tail entry object stable.',
);
assert.equal(
  appendedCache.prefixHeights[initialMessages.length],
  initialCache.prefixHeights[initialMessages.length],
  'append-only transcript virtualization must preserve the existing prefix height boundary before adding appended rows.',
);
assert.equal(
  appendedCache.messages,
  appendedMessages,
  'append-only transcript virtualization must still retain the latest message array reference for future reconciliation.',
);

const virtualizationSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/transcriptVirtualization.ts', import.meta.url),
  'utf8',
);

assert.match(
  virtualizationSource,
  /function reconcileAppendOnlyTranscriptPrefixHeightsCache\(/,
  'Transcript virtualization must keep an explicit append-only reconciliation fast path for growing transcripts.',
);
assert.match(
  virtualizationSource,
  /const appendOnlyCache = reconcileAppendOnlyTranscriptPrefixHeightsCache\(/,
  'Transcript virtualization must attempt append-only reconciliation before the generic full-array reconciliation path.',
);

const appendOnlyHelperSource = virtualizationSource.match(
  /function reconcileAppendOnlyTranscriptPrefixHeightsCache\([\s\S]*?\n\}/,
)?.[0];
assert.ok(
  appendOnlyHelperSource,
  'Append-only transcript virtualization helper must be inspectable.',
);
assert.doesNotMatch(
  appendOnlyHelperSource,
  /new Map<|new Array\([^)]*messages\.length|for \(let index = 0; index < messages\.length;/,
  'Append-only transcript virtualization must not allocate or scan structures sized to the full message list.',
);

console.log('transcript virtualization append cache performance contract passed.');
