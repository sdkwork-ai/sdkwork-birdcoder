import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { AgentSessionItemView } from '@sdkwork/birdcoder-pc-workbench/chat/types';

import {
  TRANSCRIPT_ANCHOR_SETTLEMENT_FRAME_LIMIT,
  findTranscriptScrollAnchorMessageIndex,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/transcriptScrollAnchor.ts';

const anchorSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/transcriptScrollAnchor.ts',
    import.meta.url,
  ),
  'utf8',
);

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

assert.equal(
  TRANSCRIPT_ANCHOR_SETTLEMENT_FRAME_LIMIT >= 4,
  true,
  'transcript anchoring must span deferred loading-indicator and pagination-metadata layout updates.',
);
assert.match(
  anchorSource,
  /querySelector<HTMLElement>\('\[data-chat-transcript-track="true"\]'\)[\s\S]*\?\? messageElement/,
  'transcript anchoring must preserve the visible content track when turn padding changes.',
);
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
