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
  'auto-gemini-3',
  'auto-gemini-2.5',
  'gemini-3.1-pro-preview',
  'gemini-3.1-pro-preview-customtools',
  'gemini-3.1-flash-lite-preview',
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
]);

const codexEngine = getWorkbenchCodeEngineDefinition('codex');

assert.equal(normalizeWorkbenchCodeModelId('claude-code', 'gpt-4o'), 'claude-sonnet-4-6');
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
    codeModelId: 'auto-gemini-3',
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
