import { readBirdcoderAppShellSource } from './birdcoder-app-shell-contract-sources.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = readBirdcoderAppShellSource();
const codePageSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePage.tsx', import.meta.url),
  'utf8',
);
const codePageSessionSelectionHookSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePageSessionSelection.ts', import.meta.url),
  'utf8',
);
const studioPageSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/StudioPage.tsx', import.meta.url),
  'utf8',
);
const sharedRefreshHookSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/hooks/useSessionRefreshActions.ts', import.meta.url),
  'utf8',
);
const selectedSessionMessagesHookSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/hooks/useSelectedCodingSessionMessages.ts', import.meta.url),
  'utf8',
);

assert.match(
  appSource,
  /refreshProjects: refreshActiveProjects,[\s\S]*\} = useProjects\(projectsWorkspaceId(?:,\s*\{[\s\S]*?\})?\);/,
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
  sharedRefreshHookSource,
  /projectRefreshGenerationRef\s*=\s*useRef\(0\)[\s\S]*codingSessionRefreshGenerationRef\s*=\s*useRef\(0\)/,
  'Session refresh actions must track independent request generations so an older response cannot clear a newer refresh state.',
);

assert.match(
  sharedRefreshHookSource,
  /const requestGeneration = \+\+projectRefreshGenerationRef\.current;[\s\S]*await refreshProjectSessions\([\s\S]*if \(projectRefreshGenerationRef\.current !== requestGeneration\) \{\s*return;/,
  'Project refresh actions must ignore stale responses before applying inventory or error state.',
);

assert.match(
  sharedRefreshHookSource,
  /const requestGeneration = \+\+codingSessionRefreshGenerationRef\.current;[\s\S]*await refreshCodingSessionMessages\([\s\S]*if \(codingSessionRefreshGenerationRef\.current !== requestGeneration\) \{\s*return;/,
  'Coding-session refresh actions must ignore stale responses before applying inventory or error state.',
);

assert.match(
  sharedRefreshHookSource,
  /if \(projectRefreshGenerationRef\.current === requestGeneration\) \{\s*setRefreshingProjectId\(null\);/,
  'An older project refresh must not clear the visible state for a newer project refresh.',
);

assert.match(
  sharedRefreshHookSource,
  /if \(codingSessionRefreshGenerationRef\.current === requestGeneration\) \{\s*setRefreshingCodingSessionScope\(null\);/,
  'An older coding-session refresh must not clear the visible state for a newer session refresh.',
);

assert.match(
  sharedRefreshHookSource,
  /if \(isPreservedSelectionStillCurrent\(preservedSelection\)\) \{\s*restoreSelectionAfterRefresh\(/,
  'Refresh completion must not restore a selection that the user changed while the request was in flight.',
);

assert.match(
  sharedRefreshHookSource,
  /if \(synchronizedProject\) \{[\s\S]*upsertProjectIntoProjectsStore\([\s\S]*\);\s*\}\s*upsertCodingSessionIntoProjectsStore\(/,
  'Manual session refresh must apply the authoritative refreshed session after any synchronized project snapshot so stale project inventory cannot keep a failed row visible.',
);

assert.match(
  selectedSessionMessagesHookSource,
  /if \(synchronizedProject\) \{[\s\S]*upsertProjectIntoProjectsStore\([\s\S]*\);\s*\}\s*upsertCodingSessionIntoProjectsStore\(/,
  'Selected-session hydration must apply the authoritative refreshed session after any synchronized project snapshot so clicking a successfully loaded transcript clears stale failed status in the sidebar.',
);

assert.match(
  codePageSessionSelectionHookSource,
  /const restoreSelectionAfterRefresh = useCallback\(\(\s*targetProjectId: string,\s*targetCodingSessionId: string \| null,\s*\) => \{/,
  'CodePage session-selection hook must explicitly preserve the selected project and session after refresh.',
);

assert.match(
  studioPageSource,
  /const restoreSelectionAfterRefresh = \(\s*targetProjectId: string,\s*targetCodingSessionId: string \| null,\s*\) => \{/,
  'StudioPage must explicitly preserve the selected project and session after refresh.',
);

console.log('app session inventory refresh contract passed.');
