import assert from 'node:assert/strict';

import {
  mergePromptEntryRecord,
  normalizePromptEntryRecords,
  normalizeSessionChatInputHistory,
} from '../packages/sdkwork-birdcoder-commons/src/chat/persistence.ts';
import {
  getWorkbenchCodeEngineDefinition,
  normalizeWorkbenchCodeModelId,
  resolveWorkbenchChatSelection,
} from '../packages/sdkwork-birdcoder-codeengine/src/preferences.ts';

assert.deepEqual(getWorkbenchCodeEngineDefinition('gemini').modelIds, [
  'gemini',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
]);

const codexEngine = getWorkbenchCodeEngineDefinition('codex');

assert.equal(normalizeWorkbenchCodeModelId('claude-code', 'gpt-4o'), 'claude-code');
assert.equal(
  normalizeWorkbenchCodeModelId('codex', 'gpt-4o'),
  codexEngine.defaultModelId,
);

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

assert.deepEqual(
  normalizePromptEntryRecords([
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
  mergePromptEntryRecord(
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

assert.deepEqual(
  normalizeSessionChatInputHistory(['  build terminal  ', '', 'review session']),
  ['build terminal', 'review session'],
);

console.log('chat runtime contract passed.');
