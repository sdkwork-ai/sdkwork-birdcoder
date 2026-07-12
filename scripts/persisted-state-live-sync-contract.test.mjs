import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = await readFile(
  resolve(
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/hooks/usePersistedState.ts',
  ),
  'utf8',
);

assert.match(
  source,
  /const PERSISTED_STATE_SYNC_EVENT = 'sdkwork-birdcoder:persisted-state-sync';/,
  'Persisted state hooks must expose a same-document synchronization channel.',
);

assert.match(
  source,
  /const persistedStateWriteQueues = new Map<string, Promise<void>>\(\);[\s\S]*previousWrite[\s\S]*trySetStoredRawValue[\s\S]*emitPersistedStateSync/,
  'Persisted writes for the same storage key must stay ordered before broadcasting live state.',
);

assert.match(
  source,
  /if \(!didPersist\) \{[\s\S]*throw new Error\(.*Storage rejected/m,
  'Persisted state must keep failed storage writes observable to the retry state machine.',
);

assert.match(
  source,
  /window\.addEventListener\(PERSISTED_STATE_SYNC_EVENT, handlePersistedStateSync\);[\s\S]*window\.addEventListener\('storage', handleStorage\);/,
  'Persisted state hooks must synchronize both same-page consumers and other browser tabs.',
);

assert.match(
  source,
  /detail\.sourceId === sourceIdRef\.current[\s\S]*detail\.scope !== scope[\s\S]*detail\.key !== key/,
  'Persisted state synchronization must ignore self-originated and unrelated updates.',
);

assert.match(
  source,
  /const hydrationRevision = stateRevisionRef\.current;[\s\S]*stateRevisionRef\.current !== hydrationRevision/,
  'Late hydration reads must not overwrite a newer local or synchronized setting value.',
);

assert.match(
  source,
  /lastPersistedStateRef\.current = nextValue;[\s\S]*setState\(nextValue\);[\s\S]*setIsHydrated\(true\);/,
  'Synchronized values must update mounted consumers without scheduling duplicate persistence writes.',
);

console.log('persisted state live sync contract passed.');
