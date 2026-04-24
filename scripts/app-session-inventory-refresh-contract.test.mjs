import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../packages/sdkwork-birdcoder-shell/src/application/app/BirdcoderApp.tsx', import.meta.url), 'utf8');
const codePageSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx', import.meta.url),
  'utf8',
);
const studioPageSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx', import.meta.url),
  'utf8',
);
const sharedRefreshHookSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/hooks/useSessionRefreshActions.ts', import.meta.url),
  'utf8',
);

assert.match(
  appSource,
  /refreshProjects: refreshActiveProjects,[\s\S]*\} = useProjects\(projectsWorkspaceId\);/,
  'App must own the active workspace session inventory through the shared useProjects store.',
);

assert.doesNotMatch(
  appSource,
  /onSessionInventoryRefresh=/,
  'App must not pass a redundant session inventory refresh callback once the shared projects store owns synchronization.',
);

assert.doesNotMatch(
  codePageSource,
  /onSessionInventoryRefresh\?: \(\) => Promise<void>;/,
  'CodePage props must not keep the obsolete App-level session inventory refresh callback once shared store upserts are authoritative.',
);

assert.doesNotMatch(
  studioPageSource,
  /onSessionInventoryRefresh\?: \(\) => Promise<void>;/,
  'StudioPage props must not keep the obsolete App-level session inventory refresh callback once shared store upserts are authoritative.',
);

assert.match(
  codePageSource,
  /useSessionRefreshActions\(/,
  'CodePage must use the shared session refresh hook instead of inlining refresh orchestration.',
);

assert.match(
  codePageSource,
  /handleRefreshProjectSessions/,
  'CodePage must receive a project refresh handler from the shared refresh hook.',
);

assert.match(
  studioPageSource,
  /useSessionRefreshActions\(/,
  'StudioPage must use the shared session refresh hook instead of inlining refresh orchestration.',
);

assert.match(
  studioPageSource,
  /handleRefreshCodingSessionMessages/,
  'StudioPage must receive a session refresh handler from the shared refresh hook.',
);

assert.match(
  sharedRefreshHookSource,
  /upsertProjectIntoProjectsStore\(/,
  'Shared refresh hook must upsert refreshed project inventory into the shared projects store.',
);

assert.match(
  sharedRefreshHookSource,
  /upsertCodingSessionIntoProjectsStore\(/,
  'Shared refresh hook must upsert refreshed coding session inventory into the shared projects store.',
);

assert.doesNotMatch(
  sharedRefreshHookSource,
  /onSessionInventoryRefresh/,
  'Shared refresh hook must not depend on an obsolete App-level inventory refresh callback.',
);

assert.doesNotMatch(
  sharedRefreshHookSource,
  /Promise\.all\(\[refreshProjects\(\), onSessionInventoryRefresh\?\.\(\)\]\)/,
  'Shared refresh hook must not fan out duplicate inventory reloads after shared store upserts became authoritative.',
);

assert.match(
  sharedRefreshHookSource,
  /refreshProjectSessions\(/,
  'Shared refresh hook must call the project refresh orchestrator.',
);

assert.match(
  sharedRefreshHookSource,
  /refreshCodingSessionMessages\(/,
  'Shared refresh hook must call the session message refresh orchestrator.',
);

assert.match(
  codePageSource,
  /const restoreSelectionAfterRefresh = \(\s*targetProjectId: string,\s*targetCodingSessionId: string \| null,\s*\) => \{/,
  'CodePage must explicitly preserve the selected project and session after refresh.',
);

assert.match(
  studioPageSource,
  /const restoreSelectionAfterRefresh = \(\s*targetProjectId: string,\s*targetCodingSessionId: string \| null,\s*\) => \{/,
  'StudioPage must explicitly preserve the selected project and session after refresh.',
);

console.log('app session inventory refresh contract passed.');
