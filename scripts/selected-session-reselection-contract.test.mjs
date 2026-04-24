import assert from 'node:assert/strict';
import fs from 'node:fs';

const hookSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/hooks/useSelectedCodingSessionMessages.ts', import.meta.url),
  'utf8',
);

assert.doesNotMatch(
  hookSource,
  /const inflightSynchronizationKeys = new Set/,
  'Selected-session hydration must not maintain a second local inflight gate once refreshCodingSessionMessages already deduplicates by session. A second gate can block reselection retries.',
);

assert.doesNotMatch(
  hookSource,
  /if \(inflightSynchronizationKeys\.has\(/,
  'Selected-session hydration must not short-circuit reselection on a stale local inflight key.',
);

assert.match(
  hookSource,
  /if \(isDisposed\) \{\s*attemptedSessionVersionsByScopeKey\.delete\(synchronizationScopeKey\);\s*return;\s*\}/s,
  'Disposed hydration runs must release their attempted-version marker so returning to the same session can resubscribe to the authoritative refresh.',
);

assert.match(
  hookSource,
  /return \(\) => \{\s*isDisposed = true;\s*attemptedSessionVersionsByScopeKey\.delete\(synchronizationScopeKey\);\s*\};/s,
  'Selected-session hydration cleanup must release attempted-version markers when the user switches away from a session.',
);

console.log('selected session reselection contract passed.');
