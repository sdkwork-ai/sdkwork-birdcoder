import assert from 'node:assert/strict';
import fs from 'node:fs';

const appProjectMenuSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/AppProjectMenu.tsx',
    import.meta.url,
  ),
  'utf8',
);

assert.doesNotMatch(
  appProjectMenuSource,
  /projects\.map\(\(project, index\)/,
  'Project menu rows must not depend on per-row animation indexes for large inventories.',
);

assert.doesNotMatch(
  appProjectMenuSource,
  /style=\{\{ animationDelay: `\$\{index \* 20\}ms` \}\}/,
  'Project menu must not compute a unique animation delay for every row.',
);

assert.doesNotMatch(
  appProjectMenuSource,
  /animate-in fade-in slide-in-from-left-2 fill-mode-both/,
  'Project menu rows must not attach entrance animations to every rendered item.',
);

console.log('app project menu list performance contract passed.');
