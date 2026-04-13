import assert from 'node:assert/strict';

import {
  buildChatHistoryStorageKey,
  mergeStoredPromptEntry,
  normalizeStoredPromptEntries,
} from '../packages/sdkwork-birdcoder-commons/src/chat/persistence.ts';
import {
  getWorkbenchCodeEngineDefinition,
  normalizeWorkbenchCodeModelId,
  resolveWorkbenchChatSelection,
} from '../packages/sdkwork-birdcoder-commons/src/workbench/preferences.ts';

assert.deepEqual(getWorkbenchCodeEngineDefinition('gemini').modelIds, [
  'gemini',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
]);

assert.equal(normalizeWorkbenchCodeModelId('claude-code', 'gpt-4o'), 'claude-code');
assert.equal(normalizeWorkbenchCodeModelId('codex', 'gpt-4o'), 'gpt-4o');

assert.deepEqual(
  resolveWorkbenchChatSelection({
    codeEngineId: 'gemini',
    codeModelId: 'claude-3-opus',
  }),
  {
    codeEngineId: 'gemini',
    codeModelId: 'gemini',
  },
);

assert.equal(buildChatHistoryStorageKey('thread-7'), 'history.thread-7');

assert.deepEqual(
  normalizeStoredPromptEntries([
    { text: '  build terminal  ', timestamp: 30 },
    { text: '', timestamp: 40 },
    { text: 'build terminal', timestamp: 50 },
    { text: 'restore session', timestamp: 'x' },
  ]),
  [
    { text: 'build terminal', timestamp: 30 },
    { text: 'build terminal', timestamp: 50 },
  ],
);

assert.deepEqual(
  mergeStoredPromptEntry(
    [
      { text: 'build terminal', timestamp: 30 },
      { text: 'restore session', timestamp: 20 },
    ],
    'build terminal',
    60,
    2,
  ),
  [
    { text: 'build terminal', timestamp: 60 },
    { text: 'restore session', timestamp: 20 },
  ],
);

console.log('chat runtime contract passed.');
