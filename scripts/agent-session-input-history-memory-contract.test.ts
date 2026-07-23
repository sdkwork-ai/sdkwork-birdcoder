import assert from 'node:assert/strict';

const persistenceModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/chat/persistence.ts',
  import.meta.url,
);

const browserStorageWrites = new Map<string, string>();
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: {
      getItem(key: string) {
        return browserStorageWrites.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        browserStorageWrites.set(key, value);
      },
      removeItem(key: string) {
        browserStorageWrites.delete(key);
      },
    },
  },
});

try {
  const cacheBust = `?t=${Date.now()}`;
  const {
    deleteSessionPromptHistoryEntry,
    listSessionChatInputHistory,
    listSessionPromptHistory,
    resetChatPresentationMemoryForTests,
    saveSessionChatInputHistoryEntry,
    saveSessionPromptHistoryEntry,
    setPromptServiceOverrideForTests,
  } = await import(`${persistenceModulePath.href}${cacheBust}`);

  let promptDomainCallCount = 0;
  setPromptServiceOverrideForTests({
    async deleteSavedPrompt() {
      promptDomainCallCount += 1;
    },
    async listSavedPrompts() {
      promptDomainCallCount += 1;
      return [];
    },
    async saveSavedPrompt() {
      promptDomainCallCount += 1;
      return { id: 'unused', text: 'unused', updatedAt: null };
    },
  });
  resetChatPresentationMemoryForTests();

  await saveSessionPromptHistoryEntry('  build api  ', 'session-a');
  await saveSessionPromptHistoryEntry('review ui', 'session-a');
  await saveSessionPromptHistoryEntry('build api', 'session-a');
  await saveSessionPromptHistoryEntry('build api', 'session-b');

  assert.deepEqual(
    (await listSessionPromptHistory('session-a')).map((entry) => entry.text),
    ['build api', 'review ui'],
    'composer recall must remain deduplicated and ordered within the active session.',
  );
  assert.deepEqual(
    await listSessionChatInputHistory('session-b'),
    ['build api'],
    'presentation recall must remain session-scoped.',
  );
  assert.equal(
    promptDomainCallCount,
    0,
    'session input recall must not be stored as a Saved Prompt or Prompt Template operation.',
  );
  assert.equal(
    browserStorageWrites.size,
    0,
    'session input recall must not write localStorage or a BirdCoder local database.',
  );

  await deleteSessionPromptHistoryEntry('build api', 'session-a');
  assert.deepEqual(
    (await listSessionPromptHistory('session-a')).map((entry) => entry.text),
    ['review ui'],
    'deleting presentation recall must affect only the selected session entry.',
  );
  assert.deepEqual(
    (await listSessionPromptHistory('session-b')).map((entry) => entry.text),
    ['build api'],
    'deleting presentation recall must not affect another session.',
  );

  assert.deepEqual(
    await saveSessionChatInputHistoryEntry('session-a', 'ship release', 2),
    ['ship release', 'review ui'],
    'chat input recall must apply its presentation limit without changing domain persistence.',
  );

  resetChatPresentationMemoryForTests();
  assert.deepEqual(
    await listSessionPromptHistory('session-a'),
    [],
    'presentation recall must be disposable and reset without a migration or repository operation.',
  );
  setPromptServiceOverrideForTests(null);
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

console.log('agent session input history memory contract passed.');
