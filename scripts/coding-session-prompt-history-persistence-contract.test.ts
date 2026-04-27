import assert from 'node:assert/strict';

const persistenceModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/chat/persistence.ts',
  import.meta.url,
);
const dataKernelModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts',
  import.meta.url,
);
const promptRepositoryModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/codingSessionPromptEntryRepository.ts',
  import.meta.url,
);
const promptServiceModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedPromptService.ts',
  import.meta.url,
);
const savedPromptRepositoryModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/savedPromptEntryRepository.ts',
  import.meta.url,
);
const storageBindingsModulePath = new URL(
  '../packages/sdkwork-birdcoder-types/src/storageBindings.ts',
  import.meta.url,
);
const runtimeModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/runtime.ts',
  import.meta.url,
);

const backingStore = new Map<string, string>();
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
let setPromptServiceOverrideForTests: ((promptService: unknown | null) => void) | null = null;

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
  const cacheBust = `?t=${Date.now()}`;
  const {
    deleteSessionPromptHistoryEntry,
    listSessionPromptHistory,
    listSessionChatInputHistory,
    saveSessionPromptHistoryEntry,
    setPromptServiceOverrideForTests: bindPromptServiceOverrideForTests,
  } = await import(`${persistenceModulePath.href}${cacheBust}`);
  setPromptServiceOverrideForTests = bindPromptServiceOverrideForTests;
  const { buildProviderScopedStorageKey, createBirdCoderStorageProvider } = await import(
    `${dataKernelModulePath.href}${cacheBust}`
  );
  const { createBirdCoderCodingSessionPromptHistoryRepository } = await import(
    `${promptRepositoryModulePath.href}${cacheBust}`
  );
  const { BIRDCODER_CODING_SESSION_PROMPT_ENTRY_STORAGE_BINDING } = await import(
    `${storageBindingsModulePath.href}${cacheBust}`
  );
  const { buildLocalStoreKey } = await import(`${runtimeModulePath.href}${cacheBust}`);

  const provider = createBirdCoderStorageProvider('sqlite');
  const repository = createBirdCoderCodingSessionPromptHistoryRepository({
    providerId: provider.providerId,
    storage: provider,
  });
  const { ProviderBackedPromptService } = await import(`${promptServiceModulePath.href}${cacheBust}`);
  const { createBirdCoderSavedPromptEntryRepository } = await import(
    `${savedPromptRepositoryModulePath.href}${cacheBust}`
  );
  setPromptServiceOverrideForTests(
    new ProviderBackedPromptService({
      savedPromptRepository: createBirdCoderSavedPromptEntryRepository({
        providerId: provider.providerId,
        storage: provider,
      }),
      sessionPromptHistoryRepository: repository,
    }),
  );

  await repository.clear();

  await saveSessionPromptHistoryEntry('  build api  ', 'session-a');
  await saveSessionPromptHistoryEntry('review ui', 'session-a');
  await saveSessionPromptHistoryEntry('build api', 'session-a');
  await saveSessionPromptHistoryEntry('build api', 'session-b');

  const sessionAEntries = await repository.listBySessionId('session-a');
  const sessionBEntries = await repository.listBySessionId('session-b');

  assert.deepEqual(
    sessionAEntries.map((entry) => ({
      promptText: entry.promptText,
      useCount: entry.useCount,
    })),
    [
      {
        promptText: 'build api',
        useCount: 2,
      },
      {
        promptText: 'review ui',
        useCount: 1,
      },
    ],
    'session prompt history must be deduplicated, session-scoped, and ordered by latest use.',
  );
  assert.deepEqual(
    sessionBEntries.map((entry) => ({
      promptText: entry.promptText,
      useCount: entry.useCount,
    })),
    [
      {
        promptText: 'build api',
        useCount: 1,
      },
    ],
    'prompt history must not leak across sessions.',
  );
  assert.deepEqual(
    (await listSessionPromptHistory('session-a')).map((entry) => entry.text),
    ['build api', 'review ui'],
    'commons session prompt history must be backed by the canonical session prompt repository.',
  );
  assert.deepEqual(
    await listSessionChatInputHistory('session-a'),
    ['build api', 'review ui'],
    'chat input history must read from the same canonical session prompt repository.',
  );

  const legacyStorageKey = buildLocalStoreKey('chat', 'prompt-history.session-a');
  assert.equal(
    backingStore.has(legacyStorageKey),
    false,
    'legacy chat-scoped prompt history keys must no longer receive session prompt history writes.',
  );

  const repositoryStorageKey = buildLocalStoreKey(
    BIRDCODER_CODING_SESSION_PROMPT_ENTRY_STORAGE_BINDING.storageScope,
    buildProviderScopedStorageKey(
      provider.providerId,
      BIRDCODER_CODING_SESSION_PROMPT_ENTRY_STORAGE_BINDING,
    ),
  );
  assert.equal(
    backingStore.has(repositoryStorageKey),
    true,
    'session prompt history must persist through the canonical coding session prompt entry binding.',
  );
  const canonicalPromptHistorySnapshot = backingStore.get(repositoryStorageKey);
  backingStore.set(
    repositoryStorageKey,
    '[{"id":"unsafe-use-count","codingSessionId":"session-unsafe","promptText":"unsafe use count","normalizedPromptText":"unsafe use count","lastUsedAt":"2026-04-23T00:00:00.000Z","useCount":"101777208078558059","createdAt":"2026-04-23T00:00:00.000Z","updatedAt":"2026-04-23T00:00:00.000Z"}]',
  );
  await assert.rejects(
    () => repository.listBySessionId('session-unsafe'),
    /safe integer/u,
    'session prompt history useCount must reject unsafe numeric strings instead of rounding them through Number(value).',
  );
  if (canonicalPromptHistorySnapshot === undefined) {
    backingStore.delete(repositoryStorageKey);
  } else {
    backingStore.set(repositoryStorageKey, canonicalPromptHistorySnapshot);
  }

  await deleteSessionPromptHistoryEntry('build api', 'session-a');
  assert.deepEqual(
    (await repository.listBySessionId('session-a')).map((entry) => entry.promptText),
    ['review ui'],
    'deleting session prompt history must remove only the matching session entry.',
  );
  assert.deepEqual(
    (await repository.listBySessionId('session-b')).map((entry) => entry.promptText),
    ['build api'],
    'deleting a prompt in one session must not affect other sessions.',
  );
} finally {
  setPromptServiceOverrideForTests?.(null);
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

console.log('coding session prompt history persistence contract passed.');
