import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
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
  /const reloadSessionInventory = useCallback\(async \(\) => \{/,
  'App must own a reusable session inventory reload callback.',
);

assert.match(
  appSource,
  /void reloadSessionInventory\(\);/,
  'App must reuse the shared session inventory loader during hydration.',
);

assert.match(
  appSource,
  /<CodePage[\s\S]*onSessionInventoryRefresh=\{reloadSessionInventory\}/,
  'App must pass the shared session inventory reload callback into CodePage.',
);

assert.match(
  appSource,
  /<StudioPage[\s\S]*onSessionInventoryRefresh=\{reloadSessionInventory\}/,
  'App must pass the shared session inventory reload callback into StudioPage.',
);

assert.match(
  codePageSource,
  /onSessionInventoryRefresh\?: \(\) => Promise<void>;/,
  'CodePage props must accept the shared session inventory refresh callback.',
);

assert.match(
  studioPageSource,
  /onSessionInventoryRefresh\?: \(\) => Promise<void>;/,
  'StudioPage props must accept the shared session inventory refresh callback.',
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
  /await Promise\.all\(\[refreshProjects\(\), onSessionInventoryRefresh\?\.\(\)\]\);/,
  'Shared refresh hook must reload page projects and the shared App inventory together.',
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
  /const restoreSelectionAfterRefresh = \(\s*targetProjectId: string,\s*targetCodingSessionId: string,\s*\) => \{/,
  'StudioPage must explicitly preserve the selected project and session after refresh.',
);

console.log('app session inventory refresh contract passed.');
