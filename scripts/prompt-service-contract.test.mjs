import assert from 'node:assert/strict';
import fs from 'node:fs';

const persistencePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/chat/persistence.ts',
  import.meta.url,
);
const persistenceSource = fs.readFileSync(persistencePath, 'utf8');

assert.doesNotMatch(
  persistenceSource,
  /createBirdCoderStorageProvider|createBirdCoderCodingSessionPromptHistoryRepository|getStoredJson|setStoredJson|SAVED_PROMPTS_KEY|readPromptEntries|writePromptEntries/,
  'chat persistence must not construct prompt-domain storage dependencies directly or persist saved prompts through local JSON helpers; it should delegate to the canonical prompt service boundary.',
);

assert.match(
  persistenceSource,
  /createLazyDefaultIdeServices\(\)\.promptService|defaultIdeServices\.promptService|getPromptService\(\)/,
  'chat persistence must delegate prompt-domain operations through the default IDE prompt service.',
);

assert.doesNotMatch(
  persistenceSource,
  /promptHistoryService/,
  'chat persistence should not retain the legacy promptHistoryService name after prompt-domain standardization.',
);

const dataKernelModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts',
  import.meta.url,
);
const defaultIdeServicesModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts',
  import.meta.url,
);
const savedPromptRepositoryModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/savedPromptEntryRepository.ts',
  import.meta.url,
);
const sessionPromptRepositoryModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/codingSessionPromptEntryRepository.ts',
  import.meta.url,
);
const promptServiceModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedPromptService.ts',
  import.meta.url,
);

const backingStore = new Map();
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: {
      getItem(key) {
        return backingStore.has(key) ? backingStore.get(key) : null;
      },
      setItem(key, value) {
        backingStore.set(key, value);
      },
      removeItem(key) {
        backingStore.delete(key);
      },
    },
  },
});

try {
  const cacheBust = `?t=${Date.now()}`;
  const { createBirdCoderStorageProvider } = await import(`${dataKernelModulePath.href}${cacheBust}`);
  const { createBirdCoderSavedPromptEntryRepository } = await import(
    `${savedPromptRepositoryModulePath.href}${cacheBust}`
  );
  const { createBirdCoderCodingSessionPromptHistoryRepository } = await import(
    `${sessionPromptRepositoryModulePath.href}${cacheBust}`
  );
  const { ProviderBackedPromptService } = await import(`${promptServiceModulePath.href}${cacheBust}`);
  const defaultIdeServicesSource = fs.readFileSync(defaultIdeServicesModulePath, 'utf8');

  assert.match(
    defaultIdeServicesSource,
    /promptService:\s*runtime\.promptService/u,
    'default IDE services must expose a canonical prompt service.',
  );
  assert.doesNotMatch(
    defaultIdeServicesSource,
    /promptHistoryService/u,
    'default IDE services must remove the legacy promptHistoryService alias once prompt-domain standardization is complete.',
  );

  const providerId = 'sqlite';
  const storageProvider = createBirdCoderStorageProvider(providerId);
  const promptService = new ProviderBackedPromptService({
    savedPromptRepository: createBirdCoderSavedPromptEntryRepository({
      providerId,
      storage: storageProvider,
    }),
    sessionPromptHistoryRepository: createBirdCoderCodingSessionPromptHistoryRepository({
      providerId,
      storage: storageProvider,
    }),
  });

  assert.ok(
    promptService,
    'prompt-domain runtime must construct a canonical prompt service.',
  );

  await promptService.recordSessionPromptUsage('session-a', '  build api  ');
  await promptService.recordSessionPromptUsage('session-a', 'review ui');
  await promptService.recordSessionPromptUsage('session-a', 'build api');
  await promptService.recordSessionPromptUsage('session-b', 'build api');

  assert.deepEqual(
    (await promptService.listSessionPromptHistory('session-a')).map((entry) => ({
      text: entry.text,
      useCount: entry.useCount,
    })),
    [
      {
        text: 'build api',
        useCount: 2,
      },
      {
        text: 'review ui',
        useCount: 1,
      },
    ],
    'prompt service must deduplicate and order prompts within the active session.',
  );

  await promptService.deleteSessionPromptHistoryEntry('session-a', 'build api');

  assert.deepEqual(
    (await promptService.listSessionPromptHistory('session-a')).map((entry) => entry.text),
    ['review ui'],
    'prompt service deletion must affect only the requested session prompt.',
  );
  assert.deepEqual(
    (await promptService.listSessionPromptHistory('session-b')).map((entry) => entry.text),
    ['build api'],
    'prompt service must preserve other session histories.',
  );

  await promptService.saveSavedPrompt('  summarize release notes  ');
  await promptService.saveSavedPrompt('review ui');
  await promptService.saveSavedPrompt('summarize release notes');

  assert.deepEqual(
    (await promptService.listSavedPrompts()).map((entry) => ({
      text: entry.text,
      useCount: entry.useCount,
    })),
    [
      {
        text: 'summarize release notes',
        useCount: 2,
      },
      {
        text: 'review ui',
        useCount: 1,
      },
    ],
    'prompt service must persist saved prompts canonically, deduplicate them, and order them by latest save.',
  );

  await promptService.deleteSavedPrompt('review ui');

  assert.deepEqual(
    (await promptService.listSavedPrompts()).map((entry) => entry.text),
    ['summarize release notes'],
    'prompt service saved-prompt deletion must remove only the requested prompt.',
  );
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

console.log('prompt service contract passed.');
