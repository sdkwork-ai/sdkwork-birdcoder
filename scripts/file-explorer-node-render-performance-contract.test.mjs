import assert from 'node:assert/strict';
import fs from 'node:fs';

const fileExplorerSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/FileExplorer.tsx', import.meta.url),
  'utf8',
);

assert.doesNotMatch(
  fileExplorerSource,
  /animate-in fade-in slide-in-from-left-2 fill-mode-both/,
  'FileExplorer must not attach staggered entrance animations to every rendered node because large project trees would turn editor-mode entry into a main-thread style and animation storm.',
);

assert.doesNotMatch(
  fileExplorerSource,
  /animationDelay:\s*`\$\{\(depth \* 50\) \+ \(index \* 30\)\}ms`/,
  'FileExplorer must not compute per-node animation delays during tree rendering because the delay bookkeeping scales with every visible node.',
);

console.log('file explorer node render performance contract passed.');
