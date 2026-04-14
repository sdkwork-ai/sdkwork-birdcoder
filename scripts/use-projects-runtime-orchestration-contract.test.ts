import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const useProjectsSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/hooks/useProjects.ts', import.meta.url),
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
  'useProjects.sendMessage must not synthesize assistant output locally through chatEngine.sendMessageStream().',
);
assert.doesNotMatch(
  useProjectsSource,
  /role:\s*'assistant'/,
  'useProjects.sendMessage must not pre-create synthetic assistant messages in the local project mirror.',
);

console.log('useProjects runtime orchestration contract passed.');
