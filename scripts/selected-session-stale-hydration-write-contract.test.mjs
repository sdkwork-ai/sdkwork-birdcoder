import assert from 'node:assert/strict';
import fs from 'node:fs';

const hookSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/hooks/useSelectedCodingSessionMessages.ts', import.meta.url),
  'utf8',
);

assert.match(
  hookSource,
  /const synchronizedProject = await projectService\.getProjectById\(result\.projectId\)\.catch\(/,
  'Selected-session hydration must resolve authoritative project snapshots before upserting when the currently selected project instance is missing.',
);

assert.match(
  hookSource,
  /const synchronizedProject = await projectService\.getProjectById\(result\.projectId\)\.catch\([\s\S]*?\);\s*if \(isDisposed\) \{\s*attemptedSessionVersionsByScopeKey\.delete\(synchronizationScopeKey\);\s*return;\s*\}/s,
  'Selected-session hydration must re-check disposal after awaiting project resolution so stale async completions cannot write an abandoned session back into the projects store.',
);

console.log('selected session stale hydration write contract passed.');
