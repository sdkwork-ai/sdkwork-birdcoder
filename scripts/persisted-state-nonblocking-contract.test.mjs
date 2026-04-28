import assert from 'node:assert/strict';
import fs from 'node:fs';

const persistedStatePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/hooks/usePersistedState.ts',
  import.meta.url,
);
const appPath = new URL('../packages/sdkwork-birdcoder-shell/src/application/app/BirdcoderApp.tsx', import.meta.url);

const persistedStateSource = fs.readFileSync(persistedStatePath, 'utf8');
const appSource = fs.readFileSync(appPath, 'utf8');

assert.match(
  persistedStateSource,
  /useEffect\(\(\) => \{\s*if \(!isHydrated \|\| Object\.is\(lastPersistedStateRef\.current, state\)\)/m,
  'usePersistedState must persist after commit, outside the state updater hot path.',
);

assert.doesNotMatch(
  persistedStateSource,
  /setState\(\(previousState\) => \{[\s\S]*setStoredJson\(/m,
  'usePersistedState must not write storage inside setState updaters.',
);

assert.match(
  persistedStateSource,
  /void setStoredJson\(scope, key, state\)\.catch\(\(\) => \{\s*\}\);/m,
  'usePersistedState must explicitly swallow persistence failures so quota or native storage errors never create unhandled rejections.',
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
