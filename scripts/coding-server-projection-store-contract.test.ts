import assert from 'node:assert/strict';

import type { ChatMessage } from '../packages/sdkwork-birdcoder-chat/src/types.ts';
import {
  createInMemoryBirdCoderCoreSessionProjectionStore,
  executeBirdCoderCoreSessionRun,
  persistBirdCoderCoreSessionRunProjection,
} from '../packages/sdkwork-birdcoder-server/src/index.ts';
import { withMockCodexCliJsonl } from './test-support/mockCodexCliJsonl.ts';

const messages: ChatMessage[] = [
  {
    id: 'msg-user-1',
    role: 'user',
    content: 'Inspect the workspace and update files if necessary.',
    timestamp: Date.now(),
  },
];

const store = createInMemoryBirdCoderCoreSessionProjectionStore();

await withMockCodexCliJsonl(async () => {
  await assert.rejects(
    () =>
      executeBirdCoderCoreSessionRun({
        sessionId: 'coding-session-missing-model',
        runtimeId: 'runtime-missing-model',
        turnId: 'turn-missing-model',
        engineId: 'codex',
        hostMode: 'server',
        messages,
        options: {},
      } as Parameters<typeof executeBirdCoderCoreSessionRun>[0]),
    /model id/i,
    'coding-server execution must reject session runs that do not carry an explicit model id.',
  );

  const firstProjection = await executeBirdCoderCoreSessionRun({
    sessionId: 'coding-session-aggregate-1',
    runtimeId: 'runtime-shared-1',
    turnId: 'turn-1',
    engineId: 'codex',
    modelId: 'codex',
    hostMode: 'server',
    messages,
    options: {
      model: 'codex',
    },
  });
  assert.equal(firstProjection.runtime.modelId, 'codex');

  const secondProjection = await executeBirdCoderCoreSessionRun({
    sessionId: 'coding-session-aggregate-1',
    runtimeId: 'runtime-shared-1',
    turnId: 'turn-2',
    engineId: 'codex',
    modelId: 'codex',
    hostMode: 'server',
    messages,
    options: {
      model: 'codex',
    },
  });
  assert.equal(secondProjection.runtime.modelId, 'codex');

  await persistBirdCoderCoreSessionRunProjection(store, firstProjection);
  const snapshot = await persistBirdCoderCoreSessionRunProjection(store, secondProjection);

  assert.equal(snapshot.codingSessionId, 'coding-session-aggregate-1');
  assert.equal(snapshot.runtime?.id, 'runtime-shared-1');
  assert.equal(snapshot.events.length, firstProjection.events.length + secondProjection.events.length);
  assert.equal(snapshot.artifacts.length, firstProjection.artifacts.length + secondProjection.artifacts.length);
  assert.equal(snapshot.operations.length, 2);
  assert.deepEqual(
    snapshot.operations.map((operation) => operation.operationId),
    ['turn-1:operation', 'turn-2:operation'],
  );

  const uniqueEventIds = new Set(snapshot.events.map((event) => event.id));
  assert.equal(
    uniqueEventIds.size,
    snapshot.events.length,
    'event ids must stay unique even when multiple turns share the same runtime',
  );
});

console.log('coding server projection store contract passed.');
