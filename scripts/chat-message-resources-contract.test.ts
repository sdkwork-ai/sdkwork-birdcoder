import assert from 'node:assert/strict';

import { projectChatMessageResources } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-resources.ts';
import { resolveChatMessageView } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-view.ts';
import { mergeBirdCoderProjectionMessages } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts';

const oversizedMediaSource = `data:image/png;base64,${'a'.repeat(4 * 1_024 * 1_024)}`;
const boundedResources = projectChatMessageResources([
  {
    id: 'oversized-image',
    kind: 'image',
    mimeType: 'image/png',
    mediaSource: oversizedMediaSource,
    providerEnvelope: { internal: true },
  },
  ...Array.from({ length: 40 }, (_, index) => ({
    id: `resource-${index + 1}`,
    kind: 'file',
    name: `file-${index + 1}.ts`,
    path: `src/file-${index + 1}.ts`,
  })),
]);

assert.equal(boundedResources.length, 32, 'Message resources must have a fixed item budget.');
assert.deepEqual(
  boundedResources[0],
  {
    id: 'oversized-image',
    kind: 'image',
    mimeType: 'image/png',
  },
  'An oversized media source must be dropped whole while retaining its semantic MIME metadata.',
);
assert.equal(
  'providerEnvelope' in (boundedResources[0] as unknown as Record<string, unknown>),
  false,
  'Provider-private envelopes must not cross the resource compatibility boundary.',
);

const attachmentOnlyView = resolveChatMessageView({
  id: 'attachment-only-user',
  codingSessionId: 'resource-session',
  role: 'user',
  content: '',
  resources: [{
    id: 'attachment',
    kind: 'file',
    name: 'provider.ts',
    path: 'src/provider.ts',
  }],
  createdAt: '2026-07-20T00:00:00.000Z',
});
assert.deepEqual(
  attachmentOnlyView.blocks.map((block) => block.type),
  ['resources'],
  'A resource-only user message must remain visible without manufactured Markdown.',
);

const completedProjection = mergeBirdCoderProjectionMessages({
  codingSessionId: 'resource-completed-session',
  existingMessages: [],
  idPrefix: 'authoritative',
  events: [{
    id: 'resource-completed-event',
    codingSessionId: 'resource-completed-session',
    turnId: 'resource-completed-turn',
    kind: 'message.completed',
    sequence: '1',
    payload: {
      role: 'assistant',
      content: '',
      resources: [{
        id: 'citation',
        kind: 'citation',
        path: 'specs/chat-transcript-message.spec.md',
        providerPayload: { raw: 'must-not-survive' },
        citation: {
          lineStart: 141,
          lineEnd: 166,
          note: 'Stable message resource boundary',
          threadIds: ['thread-a'],
          privateTrace: true,
        },
      }],
    },
    createdAt: '2026-07-20T00:00:01.000Z',
  }],
});
assert.equal(completedProjection.length, 1);
assert.deepEqual(completedProjection[0]?.resources, [{
  id: 'citation',
  kind: 'citation',
  path: 'specs/chat-transcript-message.spec.md',
  citation: {
    lineStart: 141,
    lineEnd: 166,
    note: 'Stable message resource boundary',
    threadIds: ['thread-a'],
  },
}]);

const deltaProjection = mergeBirdCoderProjectionMessages({
  codingSessionId: 'resource-delta-session',
  existingMessages: [],
  idPrefix: 'authoritative',
  events: [
    {
      id: 'resource-delta-event-1',
      codingSessionId: 'resource-delta-session',
      turnId: 'resource-delta-turn',
      kind: 'message.delta',
      sequence: '1',
      payload: {
        role: 'user',
        resources: [{ id: 'file-a', kind: 'file', name: 'a.ts', path: 'src/a.ts' }],
      },
      createdAt: '2026-07-20T00:00:02.000Z',
    },
    {
      id: 'resource-delta-event-2',
      codingSessionId: 'resource-delta-session',
      turnId: 'resource-delta-turn',
      kind: 'message.delta',
      sequence: '2',
      payload: {
        role: 'user',
        resources: [{ id: 'file-b', kind: 'file', name: 'b.ts', path: 'src/b.ts' }],
      },
      createdAt: '2026-07-20T00:00:03.000Z',
    },
    {
      id: 'resource-delta-event-3',
      codingSessionId: 'resource-delta-session',
      turnId: 'resource-delta-turn',
      kind: 'message.delta',
      sequence: '3',
      payload: {
        role: 'user',
        resources: [{
          id: 'file-a',
          kind: 'file',
          name: 'a.ts',
          path: 'src/a.ts',
          description: 'Latest metadata',
        }],
      },
      createdAt: '2026-07-20T00:00:04.000Z',
    },
  ],
});
assert.equal(deltaProjection.length, 1);
assert.deepEqual(
  deltaProjection[0]?.resources?.map((resource) => resource.id),
  ['file-a', 'file-b'],
  'Resource deltas must accumulate in stable first-seen order.',
);
assert.equal(
  deltaProjection[0]?.resources?.[0]?.description,
  'Latest metadata',
  'A later delta for the same resource id must replace stale metadata.',
);

console.log('chat message resources contract tests passed');
