import assert from 'node:assert/strict';
import fs from 'node:fs';

const synchronizedPagePaths = [
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePage.tsx',
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/StudioPage.tsx',
];

for (const entrypointPath of synchronizedPagePaths) {
  const source = fs.readFileSync(new URL(entrypointPath, import.meta.url), 'utf8');
  assert.match(
    source,
    /useImportedProjectSessionSynchronization\(\{\s*agentSessionService,/,
    `${entrypointPath} must use the shared imported-project Session synchronization hook.`,
  );
  assert.match(
    source,
    /await synchronizeImportedProject\([^;]+, true\);/,
    `${entrypointPath} must await forced Session synchronization after importing or remounting a project.`,
  );
}

const synchronizationHookPath =
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useImportedProjectSessionSynchronization.ts';
const synchronizationHookSource = fs.readFileSync(
  new URL(synchronizationHookPath, import.meta.url),
  'utf8',
);
assert.match(
  synchronizationHookSource,
  /coordinatorRef\.current\.synchronize\(scope, async \(\{ signal \}\) => \{/,
  'the shared synchronization hook must coordinate duplicate refreshes with cancellation.',
);
assert.match(
  synchronizationHookSource,
  /hydrateImportedProjectFromAuthority\(\{\s*agentSessionService,/,
  'the shared synchronization hook must hydrate Session data through the injected Agents service.',
);
assert.match(
  synchronizationHookSource,
  /projectService,\s*signal,/,
  'the shared synchronization hook must propagate coordinator cancellation to authority reads.',
);
assert.match(
  synchronizationHookSource,
  /if \(!result\) \{\s*throw new Error\(/,
  'an unavailable authority result must remain retryable instead of being cached as synchronized.',
);

const shellPath =
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/birdcoderAppContent.tsx';
const shellSource = fs.readFileSync(new URL(shellPath, import.meta.url), 'utf8');
assert.match(
  shellSource,
  /const hydrateImportedProjectSelection = useCallback\(\s*async \(projectId: string\) =>/,
  'the app shell must expose an awaitable imported-project hydration action.',
);
assert.match(
  shellSource,
  /hydrateImportedProjectFromAuthority\(\{\s*agentSessionService,/,
  'the app shell must hydrate imported projects through the injected Agents service.',
);
assert.match(
  shellSource,
  /await hydrateImportedProjectSelection\(importedProject\.projectId\);/,
  'the app shell must wait for Session hydration before reporting a successful folder import.',
);

const projectsHookPath =
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useProjects.ts';
const projectsHookSource = fs.readFileSync(new URL(projectsHookPath, import.meta.url), 'utf8');
assert.match(
  projectsHookSource,
  /loadProjectAgentSessionPage\(\s*agentSessionService,\s*project,\s*targetCount,/,
  'project Session expansion must remain server-paginated and use the injected Agents service.',
);

console.log('project session hydration entrypoints contract passed.');
