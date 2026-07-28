import assert from 'node:assert/strict';
import type { AgentSessionItemView } from '@sdkwork/birdcoder-pc-workbench/chat/types';

import { findTranscriptScrollAnchorMessageIndex } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/transcriptScrollAnchor.ts';

function createMessage(
  id: string,
  createdAt: string,
  content: string,
): AgentSessionItemView {
  return {
    agentSessionId: 'session-anchor',
    content,
    createdAt,
    id,
    role: 'assistant',
  };
}

const anchorMessage = createMessage('message-6', '2026-07-28T00:00:06.000Z', 'six');
const prependedMessages = [
  createMessage('message-1', '2026-07-28T00:00:01.000Z', 'one'),
  createMessage('message-2', '2026-07-28T00:00:02.000Z', 'two'),
  anchorMessage,
];

assert.equal(
  findTranscriptScrollAnchorMessageIndex(prependedMessages, {
    messageIdentity: `${anchorMessage.id}\u0001${anchorMessage.createdAt}`,
    occurrence: 0,
  }),
  2,
  'transcript anchoring must find the same message after earlier history is prepended.',
);

const duplicateMessages = [anchorMessage, anchorMessage];
assert.equal(
  findTranscriptScrollAnchorMessageIndex(duplicateMessages, {
    messageIdentity: `${anchorMessage.id}\u0001${anchorMessage.createdAt}`,
    occurrence: 1,
  }),
  1,
  'transcript anchoring must retain occurrence identity when a provider repeats message ids and timestamps.',
);

console.log('transcript scroll anchor contract passed.');
