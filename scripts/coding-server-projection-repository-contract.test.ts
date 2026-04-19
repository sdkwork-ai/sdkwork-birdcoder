import assert from 'node:assert/strict';

import type { ChatMessage } from '../packages/sdkwork-birdcoder-chat/src/types.ts';
import {
  createJsonBirdCoderCoreSessionProjectionStore,
  executeBirdCoderCoreSessionRun,
  persistBirdCoderCoreSessionRunProjection,
} from '../packages/sdkwork-birdcoder-server/src/index.ts';
import { withMockCodexCliJsonl } from './test-support/mockCodexCliJsonl.ts';

const backingStore = new Map<string, string>();
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: {
      getItem(key: string) {
        return backingStore.has(key) ? backingStore.get(key)! : null;
      },
      setItem(key: string, value: string) {
        backingStore.set(key, value);
      },
      removeItem(key: string) {
        backingStore.delete(key);
      },
    },
  },
});

try {
  const store = createJsonBirdCoderCoreSessionProjectionStore('coding-session-repo-1');

  assert.equal(store.bindings.runtime.entityName, 'coding_session_runtime');
  assert.equal(store.bindings.events.entityName, 'coding_session_event');
  assert.equal(store.bindings.artifacts.entityName, 'coding_session_artifact');
  assert.equal(store.bindings.operations.entityName, 'coding_session_operation');

  const messages: ChatMessage[] = [
    {
      id: 'msg-user-1',
      role: 'user',
      content: 'Inspect and modify the project if required.',
      timestamp: Date.now(),
    },
  ];

  const projection = await withMockCodexCliJsonl(() =>
    executeBirdCoderCoreSessionRun({
      sessionId: 'coding-session-repo-1',
      runtimeId: 'runtime-repo-1',
      turnId: 'turn-repo-1',
      engineId: 'codex',
      modelId: 'codex',
      hostMode: 'server',
      messages,
      options: {
        model: 'codex',
      },
    }),
  );

  await persistBirdCoderCoreSessionRunProjection(store, projection);

  const reloadedStore = createJsonBirdCoderCoreSessionProjectionStore('coding-session-repo-1');
  const snapshot = await reloadedStore.getSessionSnapshot('coding-session-repo-1');

  assert.equal(snapshot.runtime?.id, 'runtime-repo-1');
  assert.equal(snapshot.events.length, projection.events.length);
  assert.equal(snapshot.artifacts.length, projection.artifacts.length);
  assert.deepEqual(
    snapshot.operations.map((operation) => operation.operationId),
    ['turn-repo-1:operation'],
  );
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    delete (globalThis as { window?: unknown }).window;
  }
}

console.log('coding server projection repository contract passed.');
