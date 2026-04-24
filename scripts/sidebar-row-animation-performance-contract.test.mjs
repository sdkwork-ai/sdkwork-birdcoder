import assert from 'node:assert/strict';
import fs from 'node:fs';

const codeProjectExplorerSessionRowSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/components/ProjectExplorerSessionRow.tsx', import.meta.url),
  'utf8',
);
const codeProjectExplorerProjectSectionSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/components/ProjectExplorerProjectSection.tsx', import.meta.url),
  'utf8',
);
const studioSidebarSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioChatSidebar.tsx', import.meta.url),
  'utf8',
);

assert.doesNotMatch(
  codeProjectExplorerSessionRowSource,
  /ProjectExplorerSessionRowProps[\s\S]*animationDelay: string;/s,
  'Code ProjectExplorer session rows must not carry per-row animation delay props because large session inventories would translate directly into animation bookkeeping on the main thread.',
);

assert.doesNotMatch(
  codeProjectExplorerSessionRowSource,
  /ProjectExplorerSessionRow[\s\S]*animate-in fade-in slide-in-from-left-2 fill-mode-both/s,
  'Code ProjectExplorer session rows must not attach entrance animations to every item because project inventories can be arbitrarily large.',
);

assert.doesNotMatch(
  codeProjectExplorerProjectSectionSource,
  /ProjectExplorerProjectSection[\s\S]*style=\{buildProjectExplorerSurfaceStyle\(`\$\{index \* 50 \+ 150\}ms`/s,
  'Code ProjectExplorer project sections must not compute staggered animation delays while rendering large session inventories.',
);

assert.doesNotMatch(
  studioSidebarSource,
  /StudioProjectMenuRowProps[\s\S]*index: number;/s,
  'Studio project menu rows must not depend on per-row animation indexes.',
);

assert.doesNotMatch(
  studioSidebarSource,
  /StudioSessionMenuRowProps[\s\S]*index: number;/s,
  'Studio session menu rows must not depend on per-row animation indexes.',
);

assert.doesNotMatch(
  studioSidebarSource,
  /StudioProjectMenuRow[\s\S]*animate-in fade-in slide-in-from-left-2 fill-mode-both/s,
  'Studio project menu rows must not attach entrance animations to every rendered item.',
);

assert.doesNotMatch(
  studioSidebarSource,
  /StudioSessionMenuRow[\s\S]*animate-in fade-in slide-in-from-left-2 fill-mode-both/s,
  'Studio session menu rows must not attach entrance animations to every rendered item.',
);

console.log('sidebar row animation performance contract passed.');
