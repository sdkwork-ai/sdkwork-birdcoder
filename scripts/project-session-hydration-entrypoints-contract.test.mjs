import assert from 'node:assert/strict';
import fs from 'node:fs';

const entrypointPaths = [
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePage.tsx',
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/birdcoderAppContent.tsx',
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/StudioPage.tsx',
];

for (const entrypointPath of entrypointPaths) {
  const source = fs.readFileSync(new URL(entrypointPath, import.meta.url), 'utf8');
  assert.match(
    source,
    /hydrateImportedProjectFromAuthority\(\{\s*appRuntimeReadService,/,
    `${entrypointPath} must synchronize runtime-authority sessions while hydrating a project.`,
  );
}

const projectsHookPath =
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useProjects.ts';
const projectsHookSource = fs.readFileSync(new URL(projectsHookPath, import.meta.url), 'utf8');
assert.match(
  projectsHookSource,
  /synchronizeProjectsSessionsFromAuthority\(\{\s*appRuntimeReadService,/,
  'project inventory loading must synchronize all projects in the fetched page from runtime authority.',
);
assert.match(
  projectsHookSource,
  /fetchProjectsForWorkspace\([\s\S]*?'replace',[\s\S]*?appRuntimeReadService,/,
  'initial and replacement project list loads must enable session synchronization.',
);

console.log('project session hydration entrypoints contract passed.');
