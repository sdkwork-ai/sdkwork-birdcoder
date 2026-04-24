import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const projectExplorerSource = read(
  'packages/sdkwork-birdcoder-code/src/components/ProjectExplorer.tsx',
);
const codePageSource = read('packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx');

assert.doesNotMatch(
  projectExplorerSource,
  /ComponentProps<typeof Sidebar>/,
  'ProjectExplorer must define its own domain prop boundary instead of depending on Sidebar component props.',
);

assert.doesNotMatch(
  projectExplorerSource,
  /sidebarProps:/,
  'ProjectExplorer must not expose nested sidebarProps because that leaks the implementation component into the domain component API.',
);

assert.doesNotMatch(
  projectExplorerSource,
  /<Sidebar\b/,
  'ProjectExplorer must not be a runtime wrapper around Sidebar because that leaves an unnecessary implementation shell between the code surface and the real inventory implementation.',
);

assert.doesNotMatch(
  projectExplorerSource,
  /memo\(function ProjectExplorer\(/,
  'ProjectExplorer must not add an extra memoized passthrough component layer when it can export the real implementation boundary directly.',
);

assert.doesNotMatch(
  codePageSource,
  /const sidebarProps = \{/,
  'CodePage must build ProjectExplorer props directly instead of assembling a sidebarProps object and wrapping it.',
);

assert.doesNotMatch(
  codePageSource,
  /sidebarProps,/,
  'CodePage must not pass nested sidebarProps into ProjectExplorer after the left inventory surface becomes a first-class domain component.',
);

console.log('project explorer boundary contract passed.');
