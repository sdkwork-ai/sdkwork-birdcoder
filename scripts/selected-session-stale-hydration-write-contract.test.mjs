import assert from 'node:assert/strict';
import fs from 'node:fs';

const hookSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useSelectedAgentSessionItems.ts', import.meta.url),
  'utf8',
);

assert.match(
  hookSource,
  /const project =\s*selectedProject\?\.projectId === result\.projectId\s*\? selectedProject\s*:\s*await projectService\.getProjectById\(result\.projectId\);/,
  'Selected-session hydration must resolve authoritative project snapshots before upserting when the currently selected project instance is missing.',
);

assert.match(
  hookSource,
  /const project =[\s\S]*?await projectService\.getProjectById\(result\.projectId\);\s*if \(disposed\) \{\s*return;\s*\}[\s\S]*?upsertAgentSessionIntoProjectsStore\(/s,
  'Selected-session hydration must re-check disposal after awaiting project resolution so stale async completions cannot write an abandoned session back into the projects store.',
);

console.log('selected session stale hydration write contract passed.');
