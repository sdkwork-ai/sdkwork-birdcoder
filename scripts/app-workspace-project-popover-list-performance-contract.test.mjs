import assert from 'node:assert/strict';
import fs from 'node:fs';

const workspaceProjectPopoverSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/AppWorkspaceProjectPopover.tsx',
    import.meta.url,
  ),
  'utf8',
);

assert.doesNotMatch(
  workspaceProjectPopoverSource,
  /projects\.map\(\(project, index\)/,
  'Workspace and Project Popover rows must not depend on per-row animation indexes for large inventories.',
);

assert.doesNotMatch(
  workspaceProjectPopoverSource,
  /style=\{\{ animationDelay: `\$\{index \* 20\}ms` \}\}/,
  'Workspace and Project Popover must not compute a unique animation delay for every row.',
);

assert.doesNotMatch(
  workspaceProjectPopoverSource,
  /animate-in fade-in slide-in-from-left-2 fill-mode-both/,
  'Workspace and Project Popover rows must not attach entrance animations to every rendered item.',
);

console.log('app Workspace and Project Popover list performance contract passed.');
