import { readBirdcoderAppShellSource } from './birdcoder-app-shell-contract-sources.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const persistedStatePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/usePersistedState.ts',
  import.meta.url,
);
const appSource = readBirdcoderAppShellSource();
const persistedStateSource = fs.readFileSync(persistedStatePath, 'utf8');

assert.match(
  persistedStateSource,
  /useEffect\(\(\) => \{\s*if \(!isHydrated \|\| !hydratedRef\.current\)/m,
  'usePersistedState must persist after commit, outside the state updater hot path.',
);

assert.match(
  persistedStateSource,
  /!storageMayBeDirtyRef\.current[\s\S]*Object\.is\(lastPersistedStateRef\.current, state\)/m,
  'usePersistedState must keep storage dirty when an asynchronous write is still pending or failed.',
);

assert.doesNotMatch(
  persistedStateSource,
  /setState\(\(previousState\) => \{[\s\S]*setStoredJson\(/m,
  'usePersistedState must not write storage inside setState updaters.',
);

assert.match(
  persistedStateSource,
  /void queuePersistedStateWrite\(\{[\s\S]*?key,[\s\S]*?rawValue,[\s\S]*?scope,[\s\S]*?sourceId:[\s\S]*?\}\)[\s\S]*?\.catch\(\(error\) => \{[\s\S]*?console\.warn\(/m,
  'usePersistedState must explicitly swallow persistence failures so quota or native storage errors never create unhandled rejections.',
);

assert.match(
  persistedStateSource,
  /MAX_PERSIST_RETRIES\s*=\s*3[\s\S]*PERSIST_RETRY_DELAYS_MS/m,
  'usePersistedState must retry transient persistence failures without an unbounded timer loop.',
);

assert.match(
  persistedStateSource,
  /try \{\s*rawValue = serializeStoredValue\(state\);\s*\} catch \(error\) \{[\s\S]*?console\.warn\([\s\S]*?return;/m,
  'usePersistedState must keep serialization failures non-fatal before scheduling persistence.',
);

assert.doesNotMatch(
  appSource,
  /setRecoverySnapshot\(nextRecoverySnapshot\)/,
  'App recovery synchronization must not trigger a second full-App render for persistence.',
);

assert.match(
  appSource,
  /window\.setTimeout\(\(\) => \{\s*recoverySnapshotPersistTimeoutRef\.current = null;\s*persistWorkbenchRecoverySnapshot\(nextRecoverySnapshot\);/m,
  'App must defer recovery snapshot persistence so rapid workspace and session changes do not synchronously block the main thread.',
);

assert.match(
  appSource,
  /function persistWorkbenchRecoverySnapshot\(snapshot: WorkbenchRecoverySnapshot\): void \{\s*void setStoredJson\('workbench', 'recovery-context', snapshot\)\.catch\(\(\) => \{\s*\}\);\s*\}/m,
  'App recovery snapshot persistence must explicitly swallow storage failures so startup recovery never becomes an unhandled rejection.',
);

console.log('persisted state nonblocking contract passed.');
