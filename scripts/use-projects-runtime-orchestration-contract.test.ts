import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const useProjectsSource = readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useProjects.ts', import.meta.url),
  'utf8',
);

assert.doesNotMatch(
  useProjectsSource,
  /const \{ projectService, chatEngine \} = useIDEServices\(\);/,
  'useProjects must not depend on a page-layer chat engine when coding-session turns are already runtime-backed.',
);
assert.doesNotMatch(
  useProjectsSource,
  /chatEngine\.sendMessageStream\(/,
  'useProjects.submitAgentTurnInput must not synthesize assistant output locally through chatEngine.sendMessageStream().',
);
assert.doesNotMatch(
  useProjectsSource,
  /role:\s*'assistant'/,
  'useProjects.submitAgentTurnInput must not pre-create synthetic assistant Session Items in the local project inventory.',
);

console.log('useProjects runtime orchestration contract passed.');
