import assert from 'node:assert/strict';
import fs from 'node:fs';

const appWorkspaceMenuSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-shell/src/application/app/AppWorkspaceMenu.tsx', import.meta.url),
  'utf8',
);

assert.doesNotMatch(
  appWorkspaceMenuSource,
  /workspaces\.map\(\(workspace, index\)/,
  'Workspace menu rows must not depend on per-row animation indexes because large workspace inventories would turn them into main-thread animation bookkeeping.',
);

assert.doesNotMatch(
  appWorkspaceMenuSource,
  /menuProjects\.map\(\(project, index\)/,
  'Project menu rows must not depend on per-row animation indexes because large project inventories would turn them into main-thread animation bookkeeping.',
);

assert.doesNotMatch(
  appWorkspaceMenuSource,
  /style=\{\{ animationDelay: `\$\{index \* 20\}ms` \}\}/,
  'Workspace menu must not compute a unique animation delay for every rendered row.',
);

assert.doesNotMatch(
  appWorkspaceMenuSource,
  /animate-in fade-in slide-in-from-left-2 fill-mode-both/,
  'Workspace menu rows must not attach entrance animations to every rendered item in large lists.',
);

console.log('app workspace menu list performance contract passed.');
